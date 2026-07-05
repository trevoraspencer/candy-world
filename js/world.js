'use strict';

// ====== WORLD DATA ======
// Bit-packed integer key — cheaper than string concat in the hot
// getBlock/setBlock path. WORLD_CX/WORLD_CZ are 16, so cx,cz each fit
// in 8 bits with room to spare; using WORLD_CZ as the multiplier keeps
// the mapping reversible.
function chunkKey(cx, cz) { return cx * WORLD_CZ + cz; }
function blockIndex(x, y, z) { return x + z * 16 + y * 256; }

function getBlock(wx, wy, wz) {
    if(wy < 0 || wy >= CHUNK_H) return AIR;
    if(wx < 0 || wx >= WORLD_W || wz < 0 || wz >= WORLD_D) return AIR;
    const cx = (wx >> 4), cz = (wz >> 4);
    const chunk = game.chunks.get(chunkKey(cx, cz));
    if(!chunk) return AIR;
    return chunk[blockIndex(wx & 15, wy, wz & 15)];
}

function setBlock(wx, wy, wz, val) {
    if(wy < 0 || wy >= CHUNK_H) return;
    if(wx < 0 || wx >= WORLD_W || wz < 0 || wz >= WORLD_D) return;
    const cx = (wx >> 4), cz = (wz >> 4);
    const key = chunkKey(cx, cz);
    let chunk = game.chunks.get(key);
    if(!chunk) return;
    const lx = wx & 15, lz = wz & 15;
    const idx = blockIndex(lx, wy, lz);
    if(chunk[idx] === val) return; // no-op: don't dirty mesh or save diff
    chunk[idx] = val;
    if(game.worldLoaded && typeof recordBlockEdit === 'function') recordBlockEdit(wx, wy, wz, val);
    game.dirtyChunks.add(key);
    // Mark neighbors dirty if on edge
    if(lx === 0 && cx > 0) game.dirtyChunks.add(chunkKey(cx-1, cz));
    if(lx === 15 && cx < WORLD_CX-1) game.dirtyChunks.add(chunkKey(cx+1, cz));
    if(lz === 0 && cz > 0) game.dirtyChunks.add(chunkKey(cx, cz-1));
    if(lz === 15 && cz < WORLD_CZ-1) game.dirtyChunks.add(chunkKey(cx, cz+1));
}

// ====== BIOME GENERATION ======
function clamp01(t) {
    return Math.max(0, Math.min(1, t));
}

function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function getCoastFactor(wx, wz) {
    const edgeDist = Math.min(wx, wz, WORLD_W - 1 - wx, WORLD_D - 1 - wz);
    const coastNoise = fbm2D(wx * 0.018 + 900, wz * 0.018 + 900, 4);
    const coastlineDepth = 40 + Math.floor(coastNoise * 24);
    return clamp01(1 - edgeDist / coastlineDepth);
}

function generateBiomeMap() {
    game.biomeMap = new Uint8Array(WORLD_W * WORLD_D);
    for(let z = 0; z < WORLD_D; z++) {
        for(let x = 0; x < WORLD_W; x++) {
            const coastFactor = getCoastFactor(x, z);
            const temp = fbm2D(x * 0.008, z * 0.008, 3);
            const moist = fbm2D(x * 0.006 + 500, z * 0.006 + 500, 3);
            let biome;
            if(coastFactor > 0.18) biome = BIOME_BEACH;
            else if(temp > 0.55 && moist > 0.5) biome = BIOME_FOREST;
            else if(temp < 0.4 && moist > 0.5) biome = BIOME_MOUNTAINS;
            else if(temp < 0.4 && moist < 0.4) biome = BIOME_DEEP_DARK;
            else biome = BIOME_PLAINS;
            game.biomeMap[z * WORLD_W + x] = biome;
        }
    }
}

function getBiome(wx, wz) {
    if(!Number.isFinite(wx) || !Number.isFinite(wz)) return BIOME_PLAINS;
    wx = Math.floor(wx);
    wz = Math.floor(wz);
    if(wx < 0 || wx >= WORLD_W || wz < 0 || wz >= WORLD_D) return BIOME_PLAINS;
    return game.biomeMap[wz * WORLD_W + wx];
}

function getTerrainHeight(wx, wz, biome) {
    const n = fbm2D(wx * 0.015, wz * 0.015, 3);
    switch(biome) {
        case BIOME_FOREST: return Math.floor(28 + n * 12);
        case BIOME_MOUNTAINS: return Math.floor(35 + n * 25);
        case BIOME_DEEP_DARK: return Math.floor(20 + n * 8);
        case BIOME_PLAINS: return Math.floor(30 + n * 5);
        case BIOME_BEACH: {
            const coastFactor = smoothstep(0.18, 1.0, getCoastFactor(wx, wz));
            const duneNoise = fbm2D(wx * 0.035 + 1200, wz * 0.035 + 1200, 3);
            const shoreNoise = fbm2D(wx * 0.07 + 1700, wz * 0.07 + 1700, 2);
            const duneHeight = WATER_LEVEL + 3 + duneNoise * 4 + shoreNoise * 1.5;
            const shoreHeight = WATER_LEVEL - 1 + duneNoise * 2 + shoreNoise;
            const oceanFloor = WATER_LEVEL - 9 + duneNoise * 4;
            if(coastFactor < 0.45) {
                return Math.floor(lerp(duneHeight, shoreHeight, coastFactor / 0.45));
            }
            return Math.floor(lerp(shoreHeight, oceanFloor, (coastFactor - 0.45) / 0.55));
        }
        default: return 30;
    }
}

function getSurfaceBlock(biome) {
    switch(biome) {
        case BIOME_FOREST: return GRASS;
        case BIOME_MOUNTAINS: return SNOW;
        case BIOME_DEEP_DARK: return DARK_GRASS;
        case BIOME_PLAINS: return GRASS;
        case BIOME_BEACH: return SAND;
        default: return GRASS;
    }
}

function getFillerBlock(biome) {
    switch(biome) {
        case BIOME_BEACH: return SAND;
        case BIOME_DEEP_DARK: return DARK_STONE;
        default: return DIRT;
    }
}

// ====== CHUNK GENERATION ======
function generateChunk(cx, cz) {
    const data = new Uint8Array(16 * CHUNK_H * 16);
    const ox = cx * 16, oz = cz * 16;

    for(let lz = 0; lz < 16; lz++) {
        for(let lx = 0; lx < 16; lx++) {
            const wx = ox + lx, wz = oz + lz;
            const biome = getBiome(wx, wz);
            const h = getTerrainHeight(wx, wz, biome);
            const surface = getSurfaceBlock(biome);
            const filler = getFillerBlock(biome);
            const stoneBlock = biome === BIOME_DEEP_DARK ? DARK_STONE : STONE;

            for(let y = 0; y < CHUNK_H; y++) {
                let block = AIR;
                if(y === 0) block = BEDROCK;
                else if(y < h - 4) block = stoneBlock;
                else if(y < h) block = filler;
                else if(y === h) block = surface;
                else if(y <= WATER_LEVEL) block = WATER;

                // Ores (only in stone)
                if(block === STONE || block === DARK_STONE) {
                    if(y < 48 && noise3D(wx*0.08, y*0.08, wz*0.08) > 0.7) block = IRON_ORE;
                    else if(y < 32 && noise3D(wx*0.06+100, y*0.06, wz*0.06+100) > 0.75) block = GOLD_ORE;
                    else if(y < 28 && noise3D(wx*0.05+200, y*0.05, wz*0.05+200) > 0.78) block = LAPIS_ORE;
                    else if(y < 16 && noise3D(wx*0.05+300, y*0.05, wz*0.05+300) > 0.8) block = REDSTONE_ORE;
                    else if(y < 16 && noise3D(wx*0.04+400, y*0.04, wz*0.04+400) > 0.82) block = DIAMOND_ORE;
                    else if(y < 8 && noise3D(wx*0.03+500, y*0.03, wz*0.03+500) > 0.85) block = NETHERITE_ORE;
                }

                data[blockIndex(lx, y, lz)] = block;
            }
        }
    }
    return data;
}

// ====== TREE GENERATION ======
function placeTree(wx, wz, h, biome) {
    switch(biome) {
        case BIOME_FOREST: {
            const trunk = 4 + Math.floor(hash2D(wx*3, wz*7) * 3);
            const rad = 2 + Math.floor(hash2D(wx*11, wz*13) * 2);
            for(let y = 1; y <= trunk; y++) setBlock(wx, h+y, wz, CANDY_CANE_PILLAR);
            const cy = h + trunk;
            for(let dy = -rad; dy <= rad; dy++)
                for(let dx = -rad; dx <= rad; dx++)
                    for(let dz = -rad; dz <= rad; dz++) {
                        if(dx*dx+dy*dy+dz*dz <= rad*rad+1) {
                            const bx=wx+dx, by=cy+dy, bz=wz+dz;
                            if(getBlock(bx,by,bz)===AIR) setBlock(bx,by,bz, LEAVES);
                        }
                    }
            break;
        }
        case BIOME_MOUNTAINS: {
            const trunk = 5 + Math.floor(hash2D(wx*5, wz*9) * 3);
            for(let y = 1; y <= trunk; y++) setBlock(wx, h+y, wz, WOOD);
            // Cone of leaves
            for(let layer = 0; layer < trunk - 1; layer++) {
                const by = h + trunk - layer;
                const rad = Math.floor(layer * 0.7) + 1;
                for(let dx = -rad; dx <= rad; dx++)
                    for(let dz = -rad; dz <= rad; dz++) {
                        if(Math.abs(dx)+Math.abs(dz) <= rad+1) {
                            const bx=wx+dx, bz=wz+dz;
                            if(getBlock(bx,by,bz)===AIR) {
                                setBlock(bx,by,bz, layer === 0 ? SNOW : LEAVES);
                            }
                        }
                    }
            }
            break;
        }
        case BIOME_PLAINS: {
            const trunk = 3 + Math.floor(hash2D(wx*7, wz*11) * 3);
            const rad = 2;
            for(let y = 1; y <= trunk; y++) setBlock(wx, h+y, wz, LOLLIPOP_STICK);
            const cy = h + trunk + 1;
            for(let dy = -rad; dy <= rad; dy++)
                for(let dx = -rad; dx <= rad; dx++)
                    for(let dz = -rad; dz <= rad; dz++) {
                        if(dx*dx+dy*dy+dz*dz <= rad*rad) {
                            const bx=wx+dx, by=cy+dy, bz=wz+dz;
                            if(getBlock(bx,by,bz)===AIR) setBlock(bx,by,bz, LOLLIPOP_TOP);
                        }
                    }
            break;
        }
        case BIOME_BEACH: {
            const trunk = 5 + Math.floor(hash2D(wx*9, wz*13) * 3);
            for(let y = 1; y <= trunk; y++) setBlock(wx, h+y, wz, WOOD);
            const cy = h + trunk;
            for(let dx = -2; dx <= 2; dx++)
                for(let dz = -2; dz <= 2; dz++) {
                    if(Math.abs(dx)+Math.abs(dz) <= 3) {
                        if(getBlock(wx+dx,cy,wz+dz)===AIR) setBlock(wx+dx,cy,wz+dz, FROSTING_PINK);
                        if(getBlock(wx+dx,cy+1,wz+dz)===AIR && Math.abs(dx)+Math.abs(dz)<=1)
                            setBlock(wx+dx,cy+1,wz+dz, FROSTING_PINK);
                    }
                }
            break;
        }
        case BIOME_DEEP_DARK: {
            const trunk = 3 + Math.floor(hash2D(wx*11, wz*17) * 3);
            const rad = 2 + Math.floor(hash2D(wx*13, wz*19));
            for(let y = 1; y <= trunk; y++) setBlock(wx, h+y, wz, MUSHROOM_STALK);
            const cy = h + trunk;
            for(let dx = -rad; dx <= rad; dx++)
                for(let dz = -rad; dz <= rad; dz++) {
                    if(dx*dx+dz*dz <= rad*rad+1) {
                        if(getBlock(wx+dx,cy,wz+dz)===AIR) setBlock(wx+dx,cy,wz+dz, MUSHROOM_CAP);
                        if(dx*dx+dz*dz <= (rad-1)*(rad-1) && getBlock(wx+dx,cy+1,wz+dz)===AIR)
                            setBlock(wx+dx,cy+1,wz+dz, MUSHROOM_CAP);
                    }
                }
            break;
        }
    }
}

function generateTrees() {
    for(let wz = 2; wz < WORLD_D - 2; wz++) {
        for(let wx = 2; wx < WORLD_W - 2; wx++) {
            const biome = getBiome(wx, wz);
            const r = hash2D(wx * 47 + 12345, wz * 91 + 67890);
            let density;
            switch(biome) {
                case BIOME_FOREST: density = 0.04; break;
                case BIOME_MOUNTAINS: density = 0.005; break;
                case BIOME_DEEP_DARK: density = 0.03; break;
                case BIOME_PLAINS: density = 0.01; break;
                case BIOME_BEACH: density = 0.003; break;
                default: density = 0;
            }
            if(r < density) {
                const h = getTerrainHeight(wx, wz, biome);
                if(h > WATER_LEVEL && h < CHUNK_H - 10) {
                    const surface = getBlock(wx, h, wz);
                    if(surface !== AIR && surface !== WATER && getBlock(wx, h+1, wz) === AIR) {
                        placeTree(wx, wz, h, biome);
                    }
                }
            }
        }
    }
}

// ====== CHUNK MESHING ======
function getBlockInChunkOrWorld(chunk, cx, cz, lx, ly, lz) {
    if(ly < 0 || ly >= CHUNK_H) return AIR;
    if(lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
        return chunk[blockIndex(lx, ly, lz)];
    }
    const wx = cx * 16 + lx, wz = cz * 16 + lz;
    return getBlock(wx, ly, wz);
}

function getSideDropDepth(chunk, cx, cz, lx, ly, lz, nx, nz, maxDepth) {
    let depth = 0;
    for(let dy = 0; dy < maxDepth; dy++) {
        const neighbor = getBlockInChunkOrWorld(chunk, cx, cz, lx + nx, ly - dy, lz + nz);
        if(isSolid(neighbor)) break;
        depth++;
    }
    return depth;
}

function getFaceTileIndex(block, face, chunk, cx, cz, lx, ly, lz) {
    const tiles = BLOCK_TILES[block];
    let tileIdx = tiles[face.tileType];

    if(face.tileType !== TILE_SIDE || face.ny !== 0) return tileIdx;
    if(block !== GRASS && block !== DARK_GRASS && block !== SNOW) return tileIdx;

    const dropDepth = getSideDropDepth(chunk, cx, cz, lx, ly, lz, face.nx, face.nz, 4);
    if(dropDepth < 3 || ly === 0) return tileIdx;

    const below = getBlockInChunkOrWorld(chunk, cx, cz, lx, ly - 1, lz);
    const belowTiles = BLOCK_TILES[below];
    if(!belowTiles) return tileIdx;

    return belowTiles[TILE_SIDE];
}

// Face definitions: [normal direction, 4 corner offsets, which tile face
// (top/side/bottom), per-corner AO neighbor offsets]. Hoisted to module
// scope so meshChunk doesn't rebuild this 6-entry nested structure for
// every chunk remesh.
const MESH_FACES = [
    // -X face (normalIdx=0)
    { nx:-1,ny:0,nz:0, nIdx:0, corners: [[0,0,0],[0,1,0],[0,1,1],[0,0,1]], tileType: TILE_SIDE,
      aoNeighbors: [
        [[-1,-1,0],[-1,0,-1],[-1,-1,-1]],
        [[-1,1,0],[-1,0,-1],[-1,1,-1]],
        [[-1,1,0],[-1,0,1],[-1,1,1]],
        [[-1,-1,0],[-1,0,1],[-1,-1,1]]
      ]},
    // +X face (normalIdx=1)
    { nx:1,ny:0,nz:0, nIdx:1, corners: [[1,0,1],[1,1,1],[1,1,0],[1,0,0]], tileType: TILE_SIDE,
      aoNeighbors: [
        [[1,-1,0],[1,0,1],[1,-1,1]],
        [[1,1,0],[1,0,1],[1,1,1]],
        [[1,1,0],[1,0,-1],[1,1,-1]],
        [[1,-1,0],[1,0,-1],[1,-1,-1]]
      ]},
    // -Y face (normalIdx=2)
    { nx:0,ny:-1,nz:0, nIdx:2, corners: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]], tileType: TILE_BOTTOM,
      aoNeighbors: [
        [[0,-1,1],[-1,-1,0],[-1,-1,1]],
        [[0,-1,1],[1,-1,0],[1,-1,1]],
        [[0,-1,-1],[1,-1,0],[1,-1,-1]],
        [[0,-1,-1],[-1,-1,0],[-1,-1,-1]]
      ]},
    // +Y face (normalIdx=3)
    { nx:0,ny:1,nz:0, nIdx:3, corners: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], tileType: TILE_TOP,
      aoNeighbors: [
        [[0,1,-1],[-1,1,0],[-1,1,-1]],
        [[0,1,-1],[1,1,0],[1,1,-1]],
        [[0,1,1],[1,1,0],[1,1,1]],
        [[0,1,1],[-1,1,0],[-1,1,1]]
      ]},
    // -Z face (normalIdx=4)
    { nx:0,ny:0,nz:-1, nIdx:4, corners: [[1,0,0],[1,1,0],[0,1,0],[0,0,0]], tileType: TILE_SIDE,
      aoNeighbors: [
        [[1,-1,0],[0,0,-1],[1,-1,-1]],
        [[1,1,0],[0,0,-1],[1,1,-1]],
        [[-1,1,0],[0,0,-1],[-1,1,-1]],
        [[-1,-1,0],[0,0,-1],[-1,-1,-1]]
      ]},
    // +Z face (normalIdx=5)
    { nx:0,ny:0,nz:1, nIdx:5, corners: [[0,0,1],[0,1,1],[1,1,1],[1,0,1]], tileType: TILE_SIDE,
      aoNeighbors: [
        [[-1,-1,0],[0,0,1],[-1,-1,1]],
        [[-1,1,0],[0,0,1],[-1,1,1]],
        [[1,1,0],[0,0,1],[1,1,1]],
        [[1,-1,0],[0,0,1],[1,-1,1]]
      ]}
];
const MESH_UV_CORNERS = [[0,1],[1,1],[1,0],[0,0]];
const MESH_IDX_NORMAL  = [0,2,1, 0,3,2];
const MESH_IDX_FLIPPED = [1,3,2, 1,0,3];
// Scratch storage for per-face corner data so we don't allocate inside
// the per-voxel inner loop.
const meshCornerX = new Float64Array(4);
const meshCornerY = new Float64Array(4);
const meshCornerZ = new Float64Array(4);
const meshCornerU = new Float64Array(4);
const meshCornerV = new Float64Array(4);
const meshCornerAO = new Int32Array(4);

function meshChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const chunk = game.chunks.get(key);
    if(!chunk) return;

    performance.mark('meshChunk_start');

    const opaqueVerts = [];
    const waterVerts = [];
    const ox = cx * 16, oz = cz * 16;
    const tileUV = 1 / 16;
    const tileInset = 0.5 / 256;
    const tileUVInset = tileUV - 1 / 256;

    for(let ly = 0; ly < CHUNK_H; ly++) {
        for(let lz = 0; lz < 16; lz++) {
            for(let lx = 0; lx < 16; lx++) {
                const block = chunk[blockIndex(lx, ly, lz)];
                if(block === AIR) continue;

                const tiles = BLOCK_TILES[block];
                if(!tiles) continue;

                const isWaterBlock = block === WATER;

                for(let f = 0; f < 6; f++) {
                    const face = MESH_FACES[f];
                    const nlx = lx + face.nx, nly = ly + face.ny, nlz = lz + face.nz;
                    const neighbor = getBlockInChunkOrWorld(chunk, cx, cz, nlx, nly, nlz);

                    if(isWaterBlock) {
                        if(neighbor === WATER) continue;
                        if(!isTransparent(neighbor)) continue;
                    } else {
                        if(!isTransparent(neighbor)) continue;
                        if(neighbor === block && block === GLASS) continue;
                    }

                    const tileIdx = getFaceTileIndex(block, face, chunk, cx, cz, lx, ly, lz);
                    const tileRow = Math.floor(tileIdx / 16);
                    const tileCol = tileIdx % 16;
                    const uBase = tileCol * tileUV + tileInset;
                    const vBase = tileRow * tileUV + tileInset;

                    // AO for each of the four corners.
                    for(let c = 0; c < 4; c++) {
                        const aon = face.aoNeighbors[c];
                        const s1 = isSolid(getBlockInChunkOrWorld(chunk, cx, cz, lx+aon[0][0], ly+aon[0][1], lz+aon[0][2]));
                        const s2 = isSolid(getBlockInChunkOrWorld(chunk, cx, cz, lx+aon[1][0], ly+aon[1][1], lz+aon[1][2]));
                        const cn = isSolid(getBlockInChunkOrWorld(chunk, cx, cz, lx+aon[2][0], ly+aon[2][1], lz+aon[2][2]));
                        meshCornerAO[c] = (s1 && s2) ? 3 : ((s1?1:0)+(s2?1:0)+(cn?1:0));
                    }

                    // Corner positions and UVs (4 corners per face).
                    for(let c = 0; c < 4; c++) {
                        const corner = face.corners[c];
                        const uvc = MESH_UV_CORNERS[c];
                        meshCornerX[c] = ox + lx + corner[0];
                        meshCornerY[c] = ly + corner[1];
                        meshCornerZ[c] = oz + lz + corner[2];
                        meshCornerU[c] = uBase + uvc[0] * tileUVInset;
                        meshCornerV[c] = vBase + uvc[1] * tileUVInset;
                    }

                    const verts = isWaterBlock ? waterVerts : opaqueVerts;
                    const idx = (meshCornerAO[0] + meshCornerAO[2] > meshCornerAO[1] + meshCornerAO[3])
                        ? MESH_IDX_FLIPPED : MESH_IDX_NORMAL;
                    const nIdx = face.nIdx;
                    for(let k = 0; k < 6; k++) {
                        const i = idx[k];
                        verts.push(meshCornerX[i], meshCornerY[i], meshCornerZ[i],
                                   meshCornerU[i], meshCornerV[i], nIdx, meshCornerAO[i]);
                    }
                }
            }
        }
    }

    function bindMeshAttrib(loc, size, stride, offset) {
        if(loc < 0) return;
        game.gl.enableVertexAttribArray(loc);
        game.gl.vertexAttribPointer(loc, size, game.gl.FLOAT, false, stride, offset);
    }

    // Delete old mesh
    const old = game.chunkMeshes.get(key);
    if(old) {
        game.gl.deleteVertexArray(old.vao);
        game.gl.deleteBuffer(old.vbo);
        if(old.waterVao) { game.gl.deleteVertexArray(old.waterVao); game.gl.deleteBuffer(old.waterVbo); }
    }

    const mesh = {
        cx,
        cz,
        centerX: cx * 16 + 8,
        centerZ: cz * 16 + 8,
        vao: null,
        vbo: null,
        vertCount: 0,
        waterVao: null,
        waterVbo: null,
        waterVertCount: 0
    };

    // Opaque mesh
    if(opaqueVerts.length > 0) {
        const data = new Float32Array(opaqueVerts);
        mesh.vao = game.gl.createVertexArray();
        mesh.vbo = game.gl.createBuffer();
        game.gl.bindVertexArray(mesh.vao);
        game.gl.bindBuffer(game.gl.ARRAY_BUFFER, mesh.vbo);
        game.gl.bufferData(game.gl.ARRAY_BUFFER, data, game.gl.STATIC_DRAW);
        // aPos: 3 floats, aUV: 2 floats, aNorm: 1 float, aAO: 1 float = 7 floats * 4 = 28 bytes
        const stride = 28;
        bindMeshAttrib(tAPos, 3, stride, 0);
        bindMeshAttrib(tAUV, 2, stride, 12);
        bindMeshAttrib(tANorm, 1, stride, 20);
        bindMeshAttrib(tAAO, 1, stride, 24);
        game.gl.bindVertexArray(null);
        mesh.vertCount = opaqueVerts.length / 7;
    }

    // Water mesh
    if(waterVerts.length > 0) {
        const data = new Float32Array(waterVerts);
        mesh.waterVao = game.gl.createVertexArray();
        mesh.waterVbo = game.gl.createBuffer();
        game.gl.bindVertexArray(mesh.waterVao);
        game.gl.bindBuffer(game.gl.ARRAY_BUFFER, mesh.waterVbo);
        game.gl.bufferData(game.gl.ARRAY_BUFFER, data, game.gl.STATIC_DRAW);
        const stride = 28;
        bindMeshAttrib(wAPos, 3, stride, 0);
        bindMeshAttrib(wAUV, 2, stride, 12);
        bindMeshAttrib(wANorm, 1, stride, 20);
        bindMeshAttrib(wAAO, 1, stride, 24);
        game.gl.bindVertexArray(null);
        mesh.waterVertCount = waterVerts.length / 7;
    }

    game.chunkMeshes.set(key, mesh);
    performance.mark('meshChunk_end');
    performance.measure('meshChunk', 'meshChunk_start', 'meshChunk_end');
}
