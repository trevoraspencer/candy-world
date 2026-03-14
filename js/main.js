'use strict';

// ====== WORLD GENERATION & LOADING ======
function findPlayerSpawn() {
    let bestX = 128, bestZ = 128, bestH = 0;
    for(let dz = -16; dz <= 16; dz += 4) {
        for(let dx = -16; dx <= 16; dx += 4) {
            const sx = 128 + dx, sz = 128 + dz;
            const b = getBiome(sx, sz);
            const biomeBonus = (b === BIOME_BEACH) ? -10 : 0;
            const h = getTerrainHeight(sx, sz, b) + biomeBonus;
            if(h > bestH) { bestH = h; bestX = sx; bestZ = sz; }
        }
    }
    let spawnY = WATER_LEVEL + 2;
    for(let y = CHUNK_H - 2; y >= 0; y--) {
        if(isSolid(getBlock(bestX, y, bestZ)) && !isSolid(getBlock(bestX, y + 1, bestZ))) {
            spawnY = y + 2;
            break;
        }
    }
    return { bestX, bestZ, spawnY };
}

async function loadWorld() {
    const loadbar = document.getElementById('loadbar-inner');
    const loadText = document.getElementById('load-text');

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
    const totalChunks = WORLD_CX * WORLD_CZ;
    let generated = 0;
    let lastYield = performance.now();
    for(let cz = 0; cz < WORLD_CZ; cz++) {
        for(let cx = 0; cx < WORLD_CX; cx++) {
            game.chunks.set(chunkKey(cx, cz), generateChunk(cx, cz));
            generated++;
            if(performance.now() - lastYield > 16) {
                const pct = 5 + (generated / totalChunks) * 45;
                loadbar.style.width = pct + '%';
                loadText.textContent = `Generating terrain... ${generated}/${totalChunks} chunks`;
                await new Promise(r => setTimeout(r, 0));
                lastYield = performance.now();
            }
        }
    }

    // Generate trees
    loadText.textContent = 'Planting candy trees...';
    loadbar.style.width = '50%';
    await new Promise(r => setTimeout(r, 10));
    generateTrees();
    loadbar.style.width = '55%';
    await new Promise(r => setTimeout(r, 10));

    loadText.textContent = 'Finding spawn point...';
    loadbar.style.width = '56%';
    await new Promise(r => setTimeout(r, 10));
    const spawn = findPlayerSpawn();

    loadSavedGame();

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

    loadText.textContent = 'Restoring saved world...';
    loadbar.style.width = '64%';
    await new Promise(r => setTimeout(r, 10));
    applySavedBlocks();

    loadText.textContent = 'Painting item icons...';
    loadbar.style.width = '65%';
    await new Promise(r => setTimeout(r, 10));
    generateItemIcons();

    // Mesh all chunks — same time-based yield pattern as generation.
    loadText.textContent = 'Building meshes...';
    let meshed = 0;
    lastYield = performance.now();
    for(let cz = 0; cz < WORLD_CZ; cz++) {
        for(let cx = 0; cx < WORLD_CX; cx++) {
            meshChunk(cx, cz);
            meshed++;
            if(performance.now() - lastYield > 16) {
                const pct = 65 + (meshed / totalChunks) * 30;
                loadbar.style.width = pct + '%';
                loadText.textContent = `Building meshes... ${meshed}/${totalChunks}`;
                await new Promise(r => setTimeout(r, 0));
                lastYield = performance.now();
            }
        }
    }
    game.dirtyChunks.clear();

    game.player.x = spawn.bestX + 0.5;
    game.player.z = spawn.bestZ + 0.5;
    game.player.y = spawn.spawnY;
    game.player.vy = 0;
    game.player.onGround = false;

    // Init game.inventory and HUD
    initInventory();
    applySavedPlayerState();
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

loadWorld();
