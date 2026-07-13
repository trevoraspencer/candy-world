'use strict';

// ====== WORLD GENERATION & LOADING ======
function findPlayerSpawn() {
    let bestX = 128, bestZ = 128, bestScore = -Infinity;
    for(let dz = -16; dz <= 16; dz += 4) {
        for(let dx = -16; dx <= 16; dx += 4) {
            const sx = 128 + dx, sz = 128 + dz;
            const b = getBiome(sx, sz);
            const h = getTerrainHeight(sx, sz, b);
            let slope=0;
            for(const off of [[3,0],[-3,0],[0,3],[0,-3]]) slope=Math.max(slope,Math.abs(h-getTerrainHeight(sx+off[0],sz+off[1],getBiome(sx+off[0],sz+off[1]))));
            const biomeScore=b===BIOME_PLAINS?16:b===BIOME_FOREST?12:b===BIOME_MOUNTAINS?2:b===BIOME_DEEP_DARK?-8:-20;
            const score=biomeScore-slope*5-Math.sqrt(dx*dx+dz*dz)*.08;
            if(h>WATER_LEVEL+1&&h<CHUNK_H-12&&score>bestScore){bestScore=score;bestX=sx;bestZ=sz;}
        }
    }
    const spawnY=getTerrainHeight(bestX,bestZ,getBiome(bestX,bestZ))+1;
    return { bestX, bestZ, spawnY };
}

function setSpawnFeatureBlock(x,y,z,blockId){setBlock(x,y,z,blockId);if(getBlock(x,y,z)===blockId){game.modifiedBlocks.set(blockEditKey(x,y,z),blockId);indexBlockEdit(x,y,z,blockId);}}
function prepareFreshSpawn(spawn) {
    const radius=7;
    for(let dz=-radius;dz<=radius;dz++) for(let dx=-radius;dx<=radius;dx++) {
        if(dx*dx+dz*dz>radius*radius) continue;
        const x=spawn.bestX+dx,z=spawn.bestZ+dz;
        const ground=getTerrainHeight(x,z,getBiome(x,z));
        for(let y=ground+1;y<Math.min(CHUNK_H,ground+14);y++) if(getBlock(x,y,z)!==AIR)setSpawnFeatureBlock(x,y,z,AIR);
    }
    const markerX=spawn.bestX+5, markerZ=spawn.bestZ;
    const markerY=getTerrainHeight(markerX,markerZ,getBiome(markerX,markerZ));
    for(let y=1;y<=3;y++) setSpawnFeatureBlock(markerX,markerY+y,markerZ,CANDY_CANE_PILLAR);
    setSpawnFeatureBlock(markerX,markerY+4,markerZ,FROSTING_WHITE);
    const treeX=spawn.bestX+10,treeZ=spawn.bestZ+2;
    const treeBiome=getBiome(treeX,treeZ),treeY=getTerrainHeight(treeX,treeZ,treeBiome);
    if(treeY>WATER_LEVEL&&getBlock(treeX,treeY+1,treeZ)===AIR){placeTree(treeX,treeZ,treeY,treeBiome===BIOME_BEACH?BIOME_PLAINS:treeBiome);for(let y=treeY+1;y<Math.min(CHUNK_H,treeY+13);y++)for(let z=treeZ-4;z<=treeZ+4;z++)for(let x=treeX-4;x<=treeX+4;x++){const block=getBlock(x,y,z);if(block!==AIR){game.modifiedBlocks.set(blockEditKey(x,y,z),block);indexBlockEdit(x,y,z,block);}}}
    carveSpawnCaveEntrance(spawn.bestX-11,spawn.bestZ-5);
}

function carveSpawnCaveEntrance(startX,startZ) {
    const surface=getTerrainHeight(startX,startZ,getBiome(startX,startZ));
    for(let step=0;step<16;step++) {
        const x=startX+Math.floor(step/2),z=startZ;
        const floorY=surface-Math.floor(step/2);
        for(let dx=0;dx<2;dx++) for(let dy=1;dy<=3;dy++) setSpawnFeatureBlock(x+dx,floorY+dy,z,AIR);
        setSpawnFeatureBlock(x,floorY,z,STONE);setSpawnFeatureBlock(x+1,floorY,z,STONE);
    }
}

async function loadWorld() {
    const loadbar = document.getElementById('loadbar-inner');
    const loadText = document.getElementById('load-text');
    const preloadedSave = await loadSavedGameAsync();
    game.generatorVersion = preloadedSave ? (preloadedSave.generatorVersion || 1) : 2;
    if(preloadedSave){game.worldSeed=typeof preloadedSave.worldSeed==='string'?preloadedSave.worldSeed:'legacy-candy-world';game.worldName=typeof preloadedSave.worldName==='string'?preloadedSave.worldName:'Legacy Candy World';}

    // Generate biome map
    loadText.textContent = 'Generating biome map...';
    loadbar.style.width = '2%';
    await new Promise(r => setTimeout(r, 10));

    generateBiomeMap();
    loadbar.style.width = '5%';
    await new Promise(r => setTimeout(r, 10));

    // Generate all chunks — yield based on elapsed wall time so the
    // loading bar animates smoothly without paying a setTimeout clamp
    // (~4ms) on every chunk.
    const legacy=game.generatorVersion<2,focusX=preloadedSave?.player?.x||128,focusZ=preloadedSave?.player?.z||128,focusCx=Math.floor(focusX/16),focusCz=Math.floor(focusZ/16);
    const startupRadius=game.chunkStreaming.activeRadius,minCx=legacy?0:Math.max(0,focusCx-startupRadius),maxCx=legacy?LEGACY_WORLD_CX-1:Math.min(WORLD_CX-1,focusCx+startupRadius);
    const minCz=legacy?0:Math.max(0,focusCz-startupRadius),maxCz=legacy?LEGACY_WORLD_CZ-1:Math.min(WORLD_CZ-1,focusCz+startupRadius);
    const totalChunks=(maxCx-minCx+1)*(maxCz-minCz+1);
    let generated = 0;
    let lastYield = performance.now();
    for(let cz = minCz; cz <= maxCz; cz++) {
        for(let cx = minCx; cx <= maxCx; cx++) {
            game.chunks.set(chunkKey(cx, cz), generateChunk(cx, cz));
            generated++;
            if(performance.now() - lastYield > 16 && generated < totalChunks - 1) {
                const pct = 5 + (generated / totalChunks) * 45;
                loadbar.style.width = pct + '%';
                loadText.textContent = `Generating terrain... ${generated}/${totalChunks} chunks`;
                await new Promise(r => setTimeout(r, 1));
                lastYield = performance.now();
            }
        }
    }

    // Generate trees
    loadText.textContent = 'Planting candy trees...';
    loadbar.style.width = '50%';
    await new Promise(r => setTimeout(r, 10));
    generateTrees(minCx*16,(maxCx+1)*16,minCz*16,(maxCz+1)*16);
    loadbar.style.width = '55%';
    await new Promise(r => setTimeout(r, 10));

    loadText.textContent = 'Finding spawn point...';
    loadbar.style.width = '56%';
    await new Promise(r => setTimeout(r, 10));
    const spawn = findPlayerSpawn();

    const existingSave = preloadedSave;
    if(!existingSave) prepareFreshSpawn(spawn);

    loadText.textContent = 'Sprinkling biome details...';
    if(!existingSave || existingSave.generatorVersion >= 2) generateBiomeProps(spawn.bestX,spawn.bestZ,minCx*16,(maxCx+1)*16,minCz*16,(maxCz+1)*16);

    loadText.textContent = 'Spawning creatures...';
    loadbar.style.width = '57%';
    await new Promise(r => setTimeout(r, 10));
    spawnMobs(spawn.bestX, spawn.bestZ);
    loadbar.style.width = '59%';
    await new Promise(r => setTimeout(r, 10));

    loadText.textContent = 'Building candy houses...';
    loadbar.style.width = '61%';
    await new Promise(r => setTimeout(r, 10));
    buildVillagerHouses();
    loadbar.style.width = '63%';
    await new Promise(r => setTimeout(r, 10));

    loadText.textContent = 'Raising candy waystones...';
    loadbar.style.width = '64%';
    await new Promise(r => setTimeout(r, 10));
    generateCandyWaystones(spawn.bestX, spawn.bestZ);
    loadbar.style.width = '65%';
    await new Promise(r => setTimeout(r, 10));

    if(!existingSave || existingSave.generatorVersion >= 2) {
        loadText.textContent = 'Hiding structure treasures...';
        generateExplorationStructures(spawn.bestX, spawn.bestZ);
    }

    loadText.textContent = 'Restoring saved world...';
    loadbar.style.width = '66%';
    await new Promise(r => setTimeout(r, 10));
    applySavedBlocks();

    rebuildLightSources();

    loadText.textContent = 'Painting item icons...';
    loadbar.style.width = '67%';
    await new Promise(r => setTimeout(r, 10));
    generateItemIcons();

    // Mesh all chunks — same time-based yield pattern as generation.
    loadText.textContent = 'Building meshes...';
    let meshed = 0;
    lastYield = performance.now();
    for(const key of game.chunks.keys()) {
            const cx=Math.floor(key/WORLD_CZ),cz=key%WORLD_CZ;if(legacy||Math.max(Math.abs(cx-focusCx),Math.abs(cz-focusCz))<=2)meshChunk(cx,cz);
            meshed++;
    }
    game.dirtyChunks.clear();
    loadText.textContent = 'Positioning your explorer...';

    game.player.x = spawn.bestX + 0.5;
    game.player.z = spawn.bestZ + 0.5;
    game.player.y = spawn.spawnY;
    game.player.vy = 0;
    game.player.onGround = false;
    if(!existingSave) game.spawnPoint={x:spawn.bestX+.5,y:spawn.spawnY,z:spawn.bestZ+.5};

    // Init game.inventory and HUD
    loadText.textContent = 'Packing your candy basket...';
    initInventory();
    applySavedPlayerState();
    loadText.textContent = 'Gathering nearby friends...';
    ensureAnimalsNearSpawn(game.player.x, game.player.z);
    updateHotbar();
    updateHearts();
    updateHunger();
    updateModeIndicator();
    game.worldLoaded = true;
    scheduleSaveGame();

    // Hide loading screen
    loadbar.style.width = '100%';
    loadText.textContent = 'Ready! Click to play.';
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 500);

    // Start game loop
    game.lastTime = performance.now();
    requestAnimationFrame(render);
}

initializeTitleScreen();
initializeWorldSlotPicker();
document.getElementById('respawn-button').addEventListener('click', respawnPlayer);
