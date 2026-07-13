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
    game.chunkRevisions.set(key,(game.chunkRevisions.get(key)||0)+1);
    updateLightSource(wx, wy, wz, val);
    updateSkyHeightColumn(wx, wz);
    if(game.worldLoaded && typeof recordBlockEdit === 'function') recordBlockEdit(wx, wy, wz, val);
    game.dirtyChunks.add(key);
    // Mark neighbors dirty if on edge
    if(lx === 0 && cx > 0){const neighbor=chunkKey(cx-1,cz);game.dirtyChunks.add(neighbor);game.chunkRevisions.set(neighbor,(game.chunkRevisions.get(neighbor)||0)+1);}
    if(lx === 15 && cx < WORLD_CX-1){const neighbor=chunkKey(cx+1,cz);game.dirtyChunks.add(neighbor);game.chunkRevisions.set(neighbor,(game.chunkRevisions.get(neighbor)||0)+1);}
    if(lz === 0 && cz > 0){const neighbor=chunkKey(cx,cz-1);game.dirtyChunks.add(neighbor);game.chunkRevisions.set(neighbor,(game.chunkRevisions.get(neighbor)||0)+1);}
    if(lz === 15 && cz < WORLD_CZ-1){const neighbor=chunkKey(cx,cz+1);game.dirtyChunks.add(neighbor);game.chunkRevisions.set(neighbor,(game.chunkRevisions.get(neighbor)||0)+1);}
}

function worldPositionKey(x, y, z) { return x + ',' + y + ',' + z; }

function updateLightSource(x, y, z, blockId) {
    const key = worldPositionKey(x, y, z);
    const entry = BLOCK_REGISTRY[blockId];
    if(entry && entry.emission > 0) game.lightSources.set(key, entry.emission);
    else game.lightSources.delete(key);
    if(!game.worldLoaded) return;
    const radius = 8;
    for(let cz = Math.max(0, (z - radius) >> 4); cz <= Math.min(WORLD_CZ - 1, (z + radius) >> 4); cz++) {
        for(let cx = Math.max(0, (x - radius) >> 4); cx <= Math.min(WORLD_CX - 1, (x + radius) >> 4); cx++) {
            game.dirtyChunks.add(chunkKey(cx, cz));
        }
    }
}

function rebuildLightSources() {
    game.lightSources.clear();
    for(const [key, chunk] of game.chunks) {
        const cx = Math.floor(key / WORLD_CZ), cz = key % WORLD_CZ;
        for(let y = 0; y < CHUNK_H; y++) for(let z = 0; z < CHUNK_D; z++) for(let x = 0; x < CHUNK_W; x++) {
            const blockId = chunk[blockIndex(x, y, z)];
            const entry = BLOCK_REGISTRY[blockId];
            if(entry && entry.emission > 0) {
                game.lightSources.set(worldPositionKey(cx * CHUNK_W + x, y, cz * CHUNK_D + z), entry.emission);
            }
        }
    }
    for(const key of game.chunks.keys()){const cx=Math.floor(key/WORLD_CZ),cz=key%WORLD_CZ;for(let z=cz*16;z<cz*16+16;z++)for(let x=cx*16;x<cx*16+16;x++)updateSkyHeightColumn(x,z);}
}

function updateSkyHeightColumn(x, z) {
    if(x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D) return;
    let height = 0;
    for(let y = CHUNK_H - 1; y >= 0; y--) {
        const block = getBlock(x, y, z);
        if(isSolid(block) && !isTransparent(block)) { height = y + 1; break; }
    }
    game.skyHeightMap[z * WORLD_W + x] = height;
}

function getSkyLightAt(x, y, z) {
    if(x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D || y >= CHUNK_H) return 1;
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if(y >= game.skyHeightMap[z * WORLD_W + x]) return 1;
    for(let distance = 1; distance <= 5; distance++) {
        const candidates = [[x-distance,z],[x+distance,z],[x,z-distance],[x,z+distance]];
        for(const candidate of candidates) {
            const sx = candidate[0], sz = candidate[1];
            if(sx < 0 || sx >= WORLD_W || sz < 0 || sz >= WORLD_D) return 0.5;
            if(y >= game.skyHeightMap[sz * WORLD_W + sx]) return 0.58 - distance * 0.07;
        }
    }
    return 0;
}

function getBlockLightAt(x, y, z) {
    let strongest = 0;
    for(const [key, emission] of game.lightSources) {
        const parts = key.split(',');
        const distance = Math.abs(x - Number(parts[0])) + Math.abs(y - Number(parts[1])) + Math.abs(z - Number(parts[2]));
        if(distance > 8) continue;
        strongest = Math.max(strongest, emission * Math.max(0, 1 - distance / 9));
        if(strongest >= 0.95) break;
    }
    return strongest;
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
    const extent=game.generatorVersion<2?256:WORLD_W,edgeDist = Math.min(wx, wz, extent - 1 - wx, extent - 1 - wz);
    const coastNoise = fbm2D(wx * 0.018 + 900, wz * 0.018 + 900, 4);
    const coastlineDepth = 40 + Math.floor(coastNoise * 24);
    return clamp01(1 - edgeDist / coastlineDepth);
}

function generateBiomeMap() {
    const extent=game.generatorVersion<2?256:0;game.biomeMap=extent?new Uint8Array(extent*extent):null;
    for(let z = 0; z < extent; z++) {
        for(let x = 0; x < extent; x++) {
            const coastFactor = getCoastFactor(x, z);
            const temp = fbm2D(x * 0.008, z * 0.008, 3);
            const moist = fbm2D(x * 0.006 + 500, z * 0.006 + 500, 3);
            let biome;
            if(coastFactor > 0.18) biome = BIOME_BEACH;
            else if(temp > 0.55 && moist > 0.5) biome = BIOME_FOREST;
            else if(temp < 0.4 && moist > 0.5) biome = BIOME_MOUNTAINS;
            else if(temp < 0.4 && moist < 0.4) biome = game.generatorVersion >= 2 ? BIOME_PLAINS : BIOME_DEEP_DARK;
            else biome = BIOME_PLAINS;
            game.biomeMap[z * extent + x] = biome;
        }
    }
}

function getBiome(wx, wz) {
    if(!Number.isFinite(wx) || !Number.isFinite(wz)) return BIOME_PLAINS;
    wx = Math.floor(wx);
    wz = Math.floor(wz);
    if(wx < 0 || wx >= WORLD_W || wz < 0 || wz >= WORLD_D) return BIOME_PLAINS;
    if(game.generatorVersion<2&&game.biomeMap&&wx<256&&wz<256)return game.biomeMap[wz*256+wx];
    const temp=fbm2D(wx*.008,wz*.008,3),moist=fbm2D(wx*.006+500,wz*.006+500,3),coast=getCoastFactor(wx,wz);
    if(coast>.18)return BIOME_BEACH;if(temp>.55&&moist>.5)return BIOME_FOREST;if(temp<.4&&moist>.5)return BIOME_MOUNTAINS;return BIOME_PLAINS;
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
function decorateUndergroundChunk(data,cx,cz){const ox=cx*16,oz=cz*16,at=(x,y,z)=>data[blockIndex(x,y,z)],put=(x,y,z,id)=>{if(x>=0&&x<16&&z>=0&&z<16&&y>1&&y<CHUNK_H-1)data[blockIndex(x,y,z)]=id;};for(let lz=0;lz<16;lz++)for(let lx=0;lx<16;lx++){const wx=ox+lx,wz=oz+lz,cellX=Math.floor(wx/32),cellZ=Math.floor(wz/32),active=hash2D(cellX*811+77,cellZ*613+91)<.16,gx=cellX*32+8+Math.floor(hash2D(cellX*37,cellZ*41)*16),gz=cellZ*32+8+Math.floor(hash2D(cellX*43,cellZ*47)*16),gy=8+Math.floor(hash2D(cellX*53,cellZ*59)*11);if(active)for(let y=3;y<25;y++){const dx=wx-gx,dy=y-gy,dz=wz-gz,d=Math.sqrt(dx*dx+dy*dy+dz*dz);if(d<3.1)put(lx,y,lz,AIR);else if(d<4.5)put(lx,y,lz,hash2D(wx*17+y,wz*23)>.82?SPRINKLE:GLASS);}const sectorX=Math.floor(wx/64),sectorZ=Math.floor(wz/64),mine=hash2D(sectorX*101+301,sectorZ*137+701)<.2,offsetX=5+Math.floor(hash2D(sectorX*17,sectorZ*19)*20),offsetZ=5+Math.floor(hash2D(sectorX*23,sectorZ*29)*20),localX=((wx-sectorX*64-offsetX)%24+24)%24,localZ=((wz-sectorZ*64-offsetZ)%24+24)%24;if(mine&&(localX<=2||localZ<=2))for(let y=10;y<=13;y++)put(lx,y,lz,y===10?PLANKS:AIR);}for(let lz=1;lz<15;lz++)for(let lx=1;lx<15;lx++)for(let y=4;y<30;y++){if(at(lx,y,lz)!==AIR||!isSolid(at(lx,y+1,lz))||hash2D((ox+lx)*79+y*13,(oz+lz)*83)>.008)continue;put(lx,y,lz,FROSTING_BROWN);if(y>4&&at(lx,y-1,lz)===AIR)put(lx,y-1,lz,FROSTING_BROWN);}return data;}
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

                const undergroundDark = game.generatorVersion >= 2 && y < 21 && noise3D(wx*.018+731,y*.025+91,wz*.018+419) > .53;
                if(undergroundDark && block === STONE) block = DARK_STONE;

                // Coordinate-stable caves and near-surface entrances.
                if(game.generatorVersion >= 2 && y > 2 && y < h - 2 && (block === STONE || block === DARK_STONE || block === DIRT)) {
                    const tunnel=noise3D(wx*.042+33,y*.061+77,wz*.042+115);
                    const detail=noise3D(wx*.086+211,y*.074+19,wz*.086+307);
                    const entranceField=noise2D(wx*.028+1401,wz*.028+1709);
                    const cave=tunnel>.66&&detail>.43;
                    const entrance=entranceField>.79&&y>h-10&&tunnel>.57;
                    if(cave||entrance) block=AIR;
                }

                // Ores (only in stone)
                if(block === STONE || block === DARK_STONE) {
                    if(game.generatorVersion < 2) {
                        if(y < 48 && noise3D(wx*0.08,y*0.08,wz*0.08)>0.7) block=IRON_ORE;
                        else if(y < 32 && noise3D(wx*.06+100,y*.06,wz*.06+100)>.75) block=GOLD_ORE;
                        else if(y < 28 && noise3D(wx*.05+200,y*.05,wz*.05+200)>.78) block=LAPIS_ORE;
                        else if(y < 16 && noise3D(wx*.05+300,y*.05,wz*.05+300)>.8) block=REDSTONE_ORE;
                        else if(y < 16 && noise3D(wx*.04+400,y*.04,wz*.04+400)>.82) block=DIAMOND_ORE;
                        else if(y < 8 && noise3D(wx*.03+500,y*.03,wz*.03+500)>.85) block=NETHERITE_ORE;
                    } else if(y < 46 && noise3D(wx*0.08, y*0.08, wz*0.08) > 0.72) block = IRON_ORE;
                    else if(y < 30 && noise3D(wx*0.06+100, y*0.06, wz*0.06+100) > 0.77) block = GOLD_ORE;
                    else if(y < 26 && noise3D(wx*0.05+200, y*0.05, wz*0.05+200) > 0.79) block = LAPIS_ORE;
                    else if(y < 18 && noise3D(wx*0.05+300, y*0.05, wz*0.05+300) > 0.81) block = REDSTONE_ORE;
                    else if(y < 14 && noise3D(wx*0.04+400, y*0.04, wz*0.04+400) > 0.83) block = DIAMOND_ORE;
                    else if(y < 7 && noise3D(wx*0.03+500, y*0.03, wz*0.03+500) > 0.86) block = NETHERITE_ORE;
                }

                data[blockIndex(lx, y, lz)] = block;
            }
        }
    }
    return game.generatorVersion>=2?decorateUndergroundChunk(data,cx,cz):data;
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

function generateTrees(minX=2,maxX=WORLD_W-2,minZ=2,maxZ=WORLD_D-2) {
    for(let wz = Math.max(2,minZ); wz < Math.min(WORLD_D-2,maxZ); wz++) {
        for(let wx = Math.max(2,minX); wx < Math.min(WORLD_W-2,maxX); wx++) {
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

function placeBiomeProp(wx, wz, h, biome, variant) {
    const setIfAir = (x, y, z, block) => {
        if(getBlock(x, y, z) === AIR) setBlock(x, y, z, block);
    };
    if(biome === BIOME_FOREST) {
        if(variant === 0) for(let y=1;y<=2;y++) setIfAir(wx,h+y,wz,CANDY_CANE);
        else if(variant === 1) { setIfAir(wx,h+1,wz,LOLLIPOP_STICK); setIfAir(wx,h+2,wz,FROSTING_WHITE); }
        else { setIfAir(wx,h+1,wz,DIRT); if(hash2D(wx,wz)>0.5) setIfAir(wx+1,h+1,wz,DIRT); }
    } else if(biome === BIOME_MOUNTAINS) {
        if(variant === 0) for(let y=1;y<=3;y++) setIfAir(wx,h+y,wz,GLASS);
        else if(variant === 1) { setIfAir(wx,h+1,wz,FROSTING_WHITE); setIfAir(wx+1,h+1,wz,FROSTING_WHITE); }
        else { setIfAir(wx,h+1,wz,STONE); setIfAir(wx,h+2,wz,SNOW); setIfAir(wx+1,h+1,wz,STONE); }
    } else if(biome === BIOME_DEEP_DARK) {
        if(variant === 0) for(let y=1;y<=3;y++) setIfAir(wx,h+y,wz,DARK_STONE);
        else if(variant === 1) { setIfAir(wx,h+1,wz,MUSHROOM_STALK); setIfAir(wx,h+2,wz,MUSHROOM_CAP); }
        else { setIfAir(wx,h+1,wz,REDSTONE_ORE); setIfAir(wx+1,h+1,wz,DARK_GRASS); }
    } else if(biome === BIOME_PLAINS) {
        if(variant === 0) { setIfAir(wx,h+1,wz,LOLLIPOP_TOP); setIfAir(wx+1,h+1,wz,LOLLIPOP_TOP); }
        else if(variant === 1) { setIfAir(wx,h+1,wz,LOLLIPOP_STICK); setIfAir(wx,h+2,wz,FROSTING_PINK); }
        else { setIfAir(wx,h+1,wz,SPRINKLE); setIfAir(wx+1,h+1,wz,SPRINKLE); }
    } else if(biome === BIOME_BEACH) {
        if(variant === 0) { setIfAir(wx,h+1,wz,GLASS); setIfAir(wx,h+2,wz,GLASS); }
        else if(variant === 1) { setIfAir(wx,h+1,wz,SUGAR_BLOCK); setIfAir(wx+1,h+1,wz,FROSTING_PINK); }
        else { setIfAir(wx,h+1,wz,FROSTING_WHITE); setIfAir(wx-1,h+1,wz,FROSTING_WHITE); }
    }
}

function generateBiomeProps(spawnX, spawnZ,minX=3,maxX=WORLD_W-3,minZ=3,maxZ=WORLD_D-3) {
    game.biomePropCounts = [0,0,0,0,0];
    for(let wz=Math.max(3,minZ); wz<Math.min(WORLD_D-3,maxZ); wz++) for(let wx=Math.max(3,minX); wx<Math.min(WORLD_W-3,maxX); wx++) {
        const dx=wx-spawnX, dz=wz-spawnZ;
        if(dx*dx+dz*dz < 15*15) continue;
        const biome = getBiome(wx,wz);
        const chance = hash2D(wx*157+biome*991,wz*263+1701);
        if(chance > 0.0065) continue;
        const h = getTerrainHeight(wx,wz,biome);
        const surface = getBlock(wx,h,wz);
        if(h <= WATER_LEVEL || getBlock(wx,h+1,wz) !== AIR || surface !== getSurfaceBlock(biome)) continue;
        const variant = Math.floor(hash2D(wx*313+7,wz*419+11)*3);
        placeBiomeProp(wx,wz,h,biome,variant);
        game.biomePropCounts[biome]++;
    }
}

// ====== LANDMARK GENERATION ======
const WAYSTONE_SECTOR_SIZE = 64;
const WAYSTONE_MARGIN = 12;
const WAYSTONE_RADIUS = 4;
const WAYSTONE_SPAWN_CLEAR_RADIUS = 26;

function getHighestSolidY(wx, wz) {
    for(let y = CHUNK_H - 2; y >= 1; y--) {
        if(isSolid(getBlock(wx, y, wz))) return y;
    }
    return -1;
}

function isWaystoneSurfaceBlock(block) {
    return block === GRASS || block === SAND || block === SNOW || block === DARK_GRASS ||
        block === DIRT || block === STONE || block === DARK_STONE;
}

function getWaystonePalette(biome) {
    switch(biome) {
        case BIOME_FOREST:
            return {
                floor: PLANKS,
                foundation: DIRT,
                rim: CANDY_CANE_PILLAR,
                pillar: CANDY_CANE_PILLAR,
                accent: LEAVES,
                cap: LEAVES,
                highlight: FROSTING_WHITE,
                sparkle: SPRINKLE,
                rewards: [IRON_ORE, SUGAR_BLOCK, CANDY_CANE, FROSTING_PINK]
            };
        case BIOME_MOUNTAINS:
            return {
                floor: SNOW,
                foundation: STONE,
                rim: GLASS,
                pillar: LOLLIPOP_STICK,
                accent: FROSTING_WHITE,
                cap: LOLLIPOP_TOP,
                highlight: SNOW,
                sparkle: GOLD_ORE,
                rewards: [GOLD_ORE, LAPIS_ORE, IRON_ORE, GLASS]
            };
        case BIOME_DEEP_DARK:
            return {
                floor: DARK_STONE,
                foundation: DARK_STONE,
                rim: MUSHROOM_STALK,
                pillar: MUSHROOM_STALK,
                accent: MUSHROOM_CAP,
                cap: MUSHROOM_CAP,
                highlight: FROSTING_PINK,
                sparkle: REDSTONE_ORE,
                rewards: [REDSTONE_ORE, LAPIS_ORE, DIAMOND_ORE, FROSTING_BROWN]
            };
        case BIOME_BEACH:
            return {
                floor: SUGAR_BLOCK,
                foundation: SAND,
                rim: GLASS,
                pillar: CANDY_CANE_PILLAR,
                accent: FROSTING_PINK,
                cap: FROSTING_WHITE,
                highlight: GLASS,
                sparkle: GOLD_ORE,
                rewards: [GOLD_ORE, SUGAR_BLOCK, GLASS, FROSTING_WHITE]
            };
        case BIOME_PLAINS:
        default:
            return {
                floor: FROSTING_WHITE,
                foundation: DIRT,
                rim: LOLLIPOP_STICK,
                pillar: LOLLIPOP_STICK,
                accent: LOLLIPOP_TOP,
                cap: LOLLIPOP_TOP,
                highlight: FROSTING_PINK,
                sparkle: SUGAR_BLOCK,
                rewards: [SUGAR_BLOCK, SPRINKLE, IRON_ORE, CANDY_CANE]
            };
    }
}

function canPlaceWaystone(wx, wz, spawnX, spawnZ) {
    if(wx < WAYSTONE_MARGIN || wx >= WORLD_W - WAYSTONE_MARGIN ||
       wz < WAYSTONE_MARGIN || wz >= WORLD_D - WAYSTONE_MARGIN) return null;

    const dxSpawn = wx - spawnX;
    const dzSpawn = wz - spawnZ;
    if(dxSpawn * dxSpawn + dzSpawn * dzSpawn < WAYSTONE_SPAWN_CLEAR_RADIUS * WAYSTONE_SPAWN_CLEAR_RADIUS) {
        return null;
    }

    let minY = CHUNK_H;
    let maxY = -1;
    for(let dz = -WAYSTONE_RADIUS; dz <= WAYSTONE_RADIUS; dz++) {
        for(let dx = -WAYSTONE_RADIUS; dx <= WAYSTONE_RADIUS; dx++) {
            if(dx * dx + dz * dz > WAYSTONE_RADIUS * WAYSTONE_RADIUS) continue;
            const sx = wx + dx;
            const sz = wz + dz;
            const surfaceY = getHighestSolidY(sx, sz);
            if(surfaceY <= WATER_LEVEL || surfaceY >= CHUNK_H - 14) return null;
            if(!isWaystoneSurfaceBlock(getBlock(sx, surfaceY, sz))) return null;
            if(getBlock(sx, surfaceY + 1, sz) !== AIR) return null;
            minY = Math.min(minY, surfaceY);
            maxY = Math.max(maxY, surfaceY);
        }
    }

    if(maxY - minY > 2) return null;
    const baseY = maxY + 1;
    if(baseY + 13 >= CHUNK_H) return null;

    for(let dz = -WAYSTONE_RADIUS; dz <= WAYSTONE_RADIUS; dz++) {
        for(let dx = -WAYSTONE_RADIUS; dx <= WAYSTONE_RADIUS; dx++) {
            if(dx * dx + dz * dz > WAYSTONE_RADIUS * WAYSTONE_RADIUS) continue;
            const sx = wx + dx;
            const sz = wz + dz;
            const surfaceY = getHighestSolidY(sx, sz);
            for(let y = surfaceY + 1; y <= baseY + 13; y++) {
                if(getBlock(sx, y, sz) !== AIR) return null;
            }
        }
    }

    return { x: wx, z: wz, baseY, biome: getBiome(wx, wz) };
}

function findWaystoneSite(sectorX, sectorZ, spawnX, spawnZ) {
    const minX = sectorX * WAYSTONE_SECTOR_SIZE + WAYSTONE_MARGIN;
    const minZ = sectorZ * WAYSTONE_SECTOR_SIZE + WAYSTONE_MARGIN;
    const maxX = Math.min((sectorX + 1) * WAYSTONE_SECTOR_SIZE - WAYSTONE_MARGIN - 1, WORLD_W - WAYSTONE_MARGIN - 1);
    const maxZ = Math.min((sectorZ + 1) * WAYSTONE_SECTOR_SIZE - WAYSTONE_MARGIN - 1, WORLD_D - WAYSTONE_MARGIN - 1);
    if(minX > maxX || minZ > maxZ) return null;

    for(let attempt = 0; attempt < 40; attempt++) {
        const rx = hash2D(sectorX * 211 + attempt * 17 + 31, sectorZ * 293 + attempt * 19 + 47);
        const rz = hash2D(sectorX * 307 + attempt * 23 + 59, sectorZ * 197 + attempt * 29 + 83);
        const wx = Math.floor(minX + rx * (maxX - minX + 1));
        const wz = Math.floor(minZ + rz * (maxZ - minZ + 1));
        const site = canPlaceWaystone(wx, wz, spawnX, spawnZ);
        if(site) return site;
    }

    return null;
}

function placeWaystonePlatform(wx, wz, baseY, palette) {
    for(let dz = -WAYSTONE_RADIUS; dz <= WAYSTONE_RADIUS; dz++) {
        for(let dx = -WAYSTONE_RADIUS; dx <= WAYSTONE_RADIUS; dx++) {
            const distSq = dx * dx + dz * dz;
            if(distSq > WAYSTONE_RADIUS * WAYSTONE_RADIUS) continue;

            const sx = wx + dx;
            const sz = wz + dz;
            const surfaceY = getHighestSolidY(sx, sz);
            for(let y = surfaceY + 1; y < baseY; y++) {
                setBlock(sx, y, sz, palette.foundation);
            }

            const edge = distSq > 10 || Math.abs(dx) === WAYSTONE_RADIUS || Math.abs(dz) === WAYSTONE_RADIUS;
            setBlock(sx, baseY, sz, edge ? palette.rim : palette.floor);

            if(edge && (Math.abs(dx) + Math.abs(dz)) % 2 === 0 && distSq > 11) {
                setBlock(sx, baseY + 1, sz, palette.rim);
            }
        }
    }
}

function placeWaystoneBeacon(wx, wz, baseY, palette, variant) {
    const height = 8 + Math.floor(variant * 3);
    for(let y = 1; y <= height; y++) {
        setBlock(wx, baseY + y, wz, palette.pillar);
    }

    const swirl = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for(let y = 2; y < height; y += 2) {
        const dir = swirl[(y + Math.floor(variant * 11)) % swirl.length];
        setBlock(wx + dir[0], baseY + y, wz + dir[1], palette.accent);
    }

    const topY = baseY + height + 1;
    for(let dy = -1; dy <= 1; dy++) {
        for(let dz = -2; dz <= 2; dz++) {
            for(let dx = -2; dx <= 2; dx++) {
                if(dx * dx + dz * dz + dy * dy * 2 > 5) continue;
                const block = (dx + dz + dy) % 2 === 0 ? palette.cap : palette.highlight;
                setBlock(wx + dx, topY + dy, wz + dz, block);
            }
        }
    }
    setBlock(wx, topY + 2, wz, palette.sparkle);
}

function placeWaystoneRewards(wx, wz, baseY, palette) {
    const rewardSpots = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    for(let i = 0; i < rewardSpots.length; i++) {
        const spot = rewardSpots[i];
        setBlock(wx + spot[0], baseY + 1, wz + spot[1], palette.rewards[i]);
    }

    const sprinkleSpots = [[2, 2], [-2, 2], [2, -2], [-2, -2]];
    for(let i = 0; i < sprinkleSpots.length; i++) {
        const spot = sprinkleSpots[i];
        setBlock(wx + spot[0], baseY + 1, wz + spot[1], SPRINKLE);
    }
}

function placeCandyWaystone(site, sectorX, sectorZ) {
    const palette = getWaystonePalette(site.biome);
    const variant = hash2D(site.x * 17 + sectorX * 101, site.z * 23 + sectorZ * 103);
    placeWaystonePlatform(site.x, site.z, site.baseY, palette);
    placeWaystoneBeacon(site.x, site.z, site.baseY, palette, variant);
    placeWaystoneRewards(site.x, site.z, site.baseY, palette);
}

function generateCandyWaystones(spawnX, spawnZ) {
    const sectorsX = Math.ceil(WORLD_W / WAYSTONE_SECTOR_SIZE);
    const sectorsZ = Math.ceil(WORLD_D / WAYSTONE_SECTOR_SIZE);
    for(let sectorZ = 0; sectorZ < sectorsZ; sectorZ++) {
        for(let sectorX = 0; sectorX < sectorsX; sectorX++) {
            const site = findWaystoneSite(sectorX, sectorZ, spawnX, spawnZ);
            if(site) placeCandyWaystone(site, sectorX, sectorZ);
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

    if(isCropBlock(block)) {
        const stage=Math.min(3,Math.floor((getBlockState(cx*CHUNK_W+lx,ly,cz*CHUNK_D+lz,false)?.growth||0)/2));
        return block===COOKIE_CROP?74+stage:block===GUMMY_BUSH?78+stage:82+stage;
    }

    const wx = cx * CHUNK_W + lx, wz = cz * CHUNK_D + lz;
    const variant = Math.floor(hash2D(wx * 17 + ly * 31 + block * 101, wz * 29 + face.tileType * 43) * 4);
    if(block === STONE) tileIdx = [0,40,41,42][variant];
    else if(block === DIRT) tileIdx = [1,43,44,45][variant];
    else if(block === GRASS && face.tileType === TILE_TOP) tileIdx = [2,46,47,48][variant];
    else if(block === GRASS && face.tileType === TILE_SIDE) tileIdx = [3,49,50,51][variant];
    else if(block === GRASS && face.tileType === TILE_BOTTOM) tileIdx = [1,43,44,45][variant];

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

function emitPartialBlockGeometry(verts,block,wx,wy,wz,boxes,tileUV,tileInset,tileUVInset){const tileIdx=BLOCK_TILES[block]?.[0]??0,uBase=(tileIdx%16)*tileUV+tileInset,vBase=Math.floor(tileIdx/16)*tileUV+tileInset;for(const box of boxes)for(const face of MESH_FACES){const skyLight=getSkyLightAt(wx+face.nx,wy+face.ny,wz+face.nz),blockLight=getBlockLightAt(wx+face.nx,wy+face.ny,wz+face.nz);for(const cornerIndex of MESH_IDX_NORMAL){const corner=face.corners[cornerIndex],uv=MESH_UV_CORNERS[cornerIndex],x=wx+box[0]+corner[0]*(box[3]-box[0]),y=wy+box[1]+corner[1]*(box[4]-box[1]),z=wz+box[2]+corner[2]*(box[5]-box[2]);verts.push(x,y,z,uBase+uv[0]*tileUVInset,vBase+uv[1]*tileUVInset,face.nIdx,0,skyLight,blockLight);}}}

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

                const renderBoxes=typeof getBlockRenderBoxes==='function'?getBlockRenderBoxes(block,ox+lx,ly,oz+lz):null;
                if(renderBoxes){emitPartialBlockGeometry(opaqueVerts,block,ox+lx,ly,oz+lz,renderBoxes,tileUV,tileInset,tileUVInset);continue;}

                const isWaterBlock = block === WATER;
                const isTranslucentBlock = isWaterBlock || block === GLASS;

                for(let f = 0; f < 6; f++) {
                    const face = MESH_FACES[f];
                    const nlx = lx + face.nx, nly = ly + face.ny, nlz = lz + face.nz;
                    const neighbor = getBlockInChunkOrWorld(chunk, cx, cz, nlx, nly, nlz);

                    if(isTranslucentBlock) {
                        if(neighbor === block) continue;
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

                    const verts = isTranslucentBlock ? waterVerts : opaqueVerts;
                    const idx = (meshCornerAO[0] + meshCornerAO[2] > meshCornerAO[1] + meshCornerAO[3])
                        ? MESH_IDX_FLIPPED : MESH_IDX_NORMAL;
                    const nIdx = face.nIdx;
                    const lightX = ox + lx + face.nx;
                    const lightY = ly + face.ny;
                    const lightZ = oz + lz + face.nz;
                    const skyLight = getSkyLightAt(lightX, lightY, lightZ);
                    const blockLight = getBlockLightAt(lightX, lightY, lightZ);
                    for(let k = 0; k < 6; k++) {
                        const i = idx[k];
                        verts.push(meshCornerX[i], meshCornerY[i], meshCornerZ[i],
                                   meshCornerU[i], meshCornerV[i], nIdx, meshCornerAO[i], skyLight, blockLight);
                        if(isTranslucentBlock) verts.push(isWaterBlock ? 0 : 1);
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
        const stride = 36;
        bindMeshAttrib(tAPos, 3, stride, 0);
        bindMeshAttrib(tAUV, 2, stride, 12);
        bindMeshAttrib(tANorm, 1, stride, 20);
        bindMeshAttrib(tAAO, 1, stride, 24);
        bindMeshAttrib(tALight, 2, stride, 28);
        game.gl.bindVertexArray(null);
        mesh.vertCount = opaqueVerts.length / 9;
    }

    // Water mesh
    if(waterVerts.length > 0) {
        const data = new Float32Array(waterVerts);
        mesh.waterVao = game.gl.createVertexArray();
        mesh.waterVbo = game.gl.createBuffer();
        game.gl.bindVertexArray(mesh.waterVao);
        game.gl.bindBuffer(game.gl.ARRAY_BUFFER, mesh.waterVbo);
        game.gl.bufferData(game.gl.ARRAY_BUFFER, data, game.gl.STATIC_DRAW);
        const stride = 40;
        bindMeshAttrib(wAPos, 3, stride, 0);
        bindMeshAttrib(wAUV, 2, stride, 12);
        bindMeshAttrib(wANorm, 1, stride, 20);
        bindMeshAttrib(wAAO, 1, stride, 24);
        bindMeshAttrib(wALight, 2, stride, 28);
        bindMeshAttrib(wAMaterial, 1, stride, 36);
        game.gl.bindVertexArray(null);
        mesh.waterVertCount = waterVerts.length / 10;
    }

    game.chunkMeshes.set(key, mesh);
    performance.mark('meshChunk_end');
    performance.measure('meshChunk', 'meshChunk_start', 'meshChunk_end');
}
