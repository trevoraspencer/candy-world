'use strict';

// ====== MAIN RENDER LOOP ======
// game.lastTime and game.gameTime are now game.lastTime and game.gameTime (initialized in state.js)
let frameCount = 0;
let perfFrameCount = 0;
let fps = 0;
let fpsTimer = 0;
let debugTimer = 0;
const ENABLE_PERF_LOGS = false;
const visibleOpaqueChunks = [];
const visibleWaterChunks = [];
const renderEye = [0, 0, 0];
const renderCenter = [0, 0, 0];
const renderUp = [0, 1, 0];
const viewMatrix = new Float32Array(16);
const vpMatrix = new Float32Array(16);

function render(now) {
    requestAnimationFrame(render);
    const dt = Math.min((now - game.lastTime) / 1000, 0.05);
    game.lastTime = now;
    game.gameTime += dt;
    frameCount++;
    fpsTimer += dt;
    if(fpsTimer >= 1) { fps = frameCount; frameCount = 0; fpsTimer = 0; }

    perfFrameCount++;
    if(perfFrameCount % 60 === 0) {
        if(ENABLE_PERF_LOGS) {
            const meshEntries = performance.getEntriesByName('meshChunk', 'measure');
            const mobUpdateEntries = performance.getEntriesByName('updateMobs', 'measure');
            const mobRenderEntries = performance.getEntriesByName('renderMobs', 'measure');
            const remeshEntries = performance.getEntriesByName('remesh', 'measure');
            const meshTime = meshEntries.length > 0 ? meshEntries[meshEntries.length - 1].duration.toFixed(2) : 'N/A';
            const mobUpdateTime = mobUpdateEntries.length > 0 ? mobUpdateEntries[mobUpdateEntries.length - 1].duration.toFixed(2) : 'N/A';
            const mobRenderTime = mobRenderEntries.length > 0 ? mobRenderEntries[mobRenderEntries.length - 1].duration.toFixed(2) : 'N/A';
            const remeshTime = remeshEntries.length > 0 ? remeshEntries[remeshEntries.length - 1].duration.toFixed(2) : 'N/A';
            console.log('[Perf FPS:' + fps + '] meshChunk: ' + meshTime + 'ms | updateMobs: ' + mobUpdateTime + 'ms | renderMobs: ' + mobRenderTime + 'ms | remesh: ' + remeshTime + 'ms');
        }
        performance.clearMeasures();
        performance.clearMarks();
    }

    // Update day/night cycle
    updateDayNight(dt);

    // Check station UI disruption: close if player moves too far or block is destroyed
    if(game.craftingTableOpen && game.craftingTablePos) {
        const cp = game.craftingTablePos;
        const cdx = game.player.x - (cp.x + 0.5);
        const cdy = game.player.y - (cp.y + 0.5);
        const cdz = game.player.z - (cp.z + 0.5);
        if(cdx*cdx + cdy*cdy + cdz*cdz > 36 || getBlock(cp.x, cp.y, cp.z) !== CRAFTING_TABLE) {
            closeCraftingTableUI();
        }
    }
    if(game.furnaceOpen && game.furnacePos) {
        const fp = game.furnacePos;
        const fdx = game.player.x - (fp.x + 0.5);
        const fdy = game.player.y - (fp.y + 0.5);
        const fdz = game.player.z - (fp.z + 0.5);
        if(fdx*fdx + fdy*fdy + fdz*fdz > 36 || getBlock(fp.x, fp.y, fp.z) !== FURNACE) {
            closeFurnaceUI();
        }
    }

    // Update game.player
    updatePlayer(dt);

    // Update game.mobs and effects
    performance.mark('updateMobs_start');
    updateMobs(dt);
    performance.mark('updateMobs_end');
    performance.measure('updateMobs', 'updateMobs_start', 'updateMobs_end');
    updateEffects(dt);

    // Block targeting
    const camX = game.player.x, camY = game.player.y + 1.62, camZ = game.player.z;
    const lookX = -Math.sin(game.player.yaw) * Math.cos(game.player.pitch);
    const lookY = Math.sin(game.player.pitch);
    const lookZ = -Math.cos(game.player.yaw) * Math.cos(game.player.pitch);
    game.targetBlock = raycast(camX, camY, camZ, lookX, lookY, lookZ, 6);

    // Block breaking
    const miningActive = game.miningKeyHeld || (game.mouseDown[0] && game.pointerLocked);
    if(miningActive && game.targetBlock && !game.inventoryOpen && !game.tradeTarget && !game.petPanelOpen && !game.questPanelOpen && !game.craftingTableOpen && !game.furnaceOpen && !game.controlsOverlayOpen) {
        if(!game.breakingBlock || game.breakingBlock.x !== game.targetBlock.x || game.breakingBlock.y !== game.targetBlock.y || game.breakingBlock.z !== game.targetBlock.z) {
            game.breakingBlock = { x: game.targetBlock.x, y: game.targetBlock.y, z: game.targetBlock.z };
            game.breakProgress = 0;
        }
        const hardness = BLOCK_HARDNESS[game.targetBlock.block] || 1;
        if(hardness < Infinity) {
            const heldItem = game.inventory[game.selectedSlot];
            const toolMult = heldItem ? getToolMultiplier(heldItem.id, game.targetBlock.block) : 0.5;
            game.breakProgress += dt / (hardness / toolMult);
            if(game.breakProgress >= 1.0) {
                if(addItem(game.targetBlock.block, 1)) {
                    setBlock(game.targetBlock.x, game.targetBlock.y, game.targetBlock.z, AIR);
                    updateHotbar();
                }
                game.breakProgress = 0;
                game.breakingBlock = null;
            }
        }
    } else {
        if(!miningActive) { game.breakProgress = 0; game.breakingBlock = null; }
    }
    updateBreakOverlay(miningActive && game.targetBlock && !game.inventoryOpen && !game.tradeTarget && !game.petPanelOpen && !game.questPanelOpen && !game.craftingTableOpen && !game.furnaceOpen && !game.controlsOverlayOpen && game.breakProgress > 0);

    // Remesh dirty game.chunks (max 4 per frame for perf)
    performance.mark('remesh_start');
    let remeshed = 0;
    for(const key of game.dirtyChunks) {
        if(remeshed >= 4) break;
        const cx = (key / WORLD_CZ) | 0;
        const cz = key - cx * WORLD_CZ;
        meshChunk(cx, cz);
        game.dirtyChunks.delete(key);
        remeshed++;
    }
    performance.mark('remesh_end');
    performance.measure('remesh', 'remesh_start', 'remesh_end');

    // === RENDERING ===
    game.gl.clear(game.gl.COLOR_BUFFER_BIT | game.gl.DEPTH_BUFFER_BIT);

    renderEye[0] = camX; renderEye[1] = camY; renderEye[2] = camZ;
    renderCenter[0] = camX + lookX; renderCenter[1] = camY + lookY; renderCenter[2] = camZ + lookZ;
    mat4_lookAt(renderEye, renderCenter, renderUp, viewMatrix);
    mat4_multiply(game.projMatrix, viewMatrix, vpMatrix);
    const frustumPlanes = extractFrustumPlanes(vpMatrix);

    visibleOpaqueChunks.length = 0;
    visibleWaterChunks.length = 0;
    for(const mesh of game.chunkMeshes.values()) {
        const dx = mesh.centerX - camX;
        const dz = mesh.centerZ - camZ;
        if(dx * dx + dz * dz > 80 * 80) continue;
        if(!isChunkInFrustum(mesh.cx, mesh.cz, frustumPlanes)) continue;
        if(mesh.vao && mesh.vertCount > 0) visibleOpaqueChunks.push(mesh);
        if(mesh.waterVao && mesh.waterVertCount > 0) visibleWaterChunks.push(mesh);
    }

    // Render opaque terrain
    game.gl.useProgram(game.terrainProgram);
    game.gl.uniformMatrix4fv(tUni.uVP, false, vpMatrix);
    game.gl.uniform3f(tUni.uCamPos, camX, camY, camZ);
    game.gl.uniform1f(tUni.uDaylight, game.daylight);
    game.gl.uniform3f(tUni.uFogColor, game.skyR, game.skyG, game.skyB);
    game.gl.activeTexture(game.gl.TEXTURE0);
    game.gl.bindTexture(game.gl.TEXTURE_2D, game.atlasTexture);
    game.gl.uniform1i(tUni.uAtlas, 0);

    for(const mesh of visibleOpaqueChunks) {
        game.gl.bindVertexArray(mesh.vao);
        game.gl.drawArrays(game.gl.TRIANGLES, 0, mesh.vertCount);
    }

    // Render water with blending
    game.gl.enable(game.gl.BLEND);
    game.gl.blendFunc(game.gl.SRC_ALPHA, game.gl.ONE_MINUS_SRC_ALPHA);
    game.gl.depthMask(false);

    game.gl.useProgram(waterProgram);
    game.gl.uniformMatrix4fv(wUni.uVP, false, vpMatrix);
    game.gl.uniform3f(wUni.uCamPos, camX, camY, camZ);
    game.gl.uniform1f(wUni.uDaylight, game.daylight);
    game.gl.uniform3f(wUni.uFogColor, game.skyR, game.skyG, game.skyB);
    game.gl.activeTexture(game.gl.TEXTURE0);
    game.gl.bindTexture(game.gl.TEXTURE_2D, game.atlasTexture);
    game.gl.uniform1i(wUni.uAtlas, 0);

    for(const mesh of visibleWaterChunks) {
        game.gl.bindVertexArray(mesh.waterVao);
        game.gl.drawArrays(game.gl.TRIANGLES, 0, mesh.waterVertCount);
    }

    // Render clouds
    game.gl.useProgram(cloudProgram);
    game.gl.uniformMatrix4fv(cUni.uVP, false, vpMatrix);
    game.gl.activeTexture(game.gl.TEXTURE0);
    game.gl.bindTexture(game.gl.TEXTURE_2D, cloudTexture);
    game.gl.uniform1i(cUni.uTex, 0);
    game.gl.uniform2f(cUni.uOffset, game.gameTime * 0.003, 0);
    game.gl.bindVertexArray(cloudVAO);
    game.gl.drawArrays(game.gl.TRIANGLES, 0, 6);

    game.gl.depthMask(true);
    game.gl.disable(game.gl.BLEND);

    // Render block highlight
    if(game.targetBlock) {
        updateBlockHighlight(game.targetBlock.x, game.targetBlock.y, game.targetBlock.z);
        game.gl.useProgram(game.lineProgram);
        game.gl.uniformMatrix4fv(lUni.uVP, false, vpMatrix);
        const targetIsBreaking = game.breakingBlock &&
            game.breakingBlock.x === game.targetBlock.x &&
            game.breakingBlock.y === game.targetBlock.y &&
            game.breakingBlock.z === game.targetBlock.z;
        const p = targetIsBreaking ? Math.max(0, Math.min(1, game.breakProgress)) : 0;
        const pulse = targetIsBreaking ? 0.5 + 0.5 * Math.sin(game.gameTime * 28) : 0;
        game.gl.uniform4f(lUni.uColor, 1.0, 0.2 + p * 0.55, 0.45 + p * 0.45, 0.75 + pulse * 0.25);
        game.gl.bindVertexArray(lineVAO);
        game.gl.drawArrays(game.gl.LINES, 0, 24);
    }

    performance.mark('renderMobs_start');
    renderMobs(vpMatrix);
    performance.mark('renderMobs_end');
    performance.measure('renderMobs', 'renderMobs_start', 'renderMobs_end');
    renderParticles(vpMatrix);
    updateNameTags(vpMatrix);

    // Update effect HUD
    updateEffectHUD();

    // Update debug info
    debugTimer += dt;
    if(debugTimer >= 0.25) {
        debugTimer = 0;
        const timeLabel = game.dayTime < DAY_CYCLE_LENGTH*0.2 ? 'Dawn' : game.dayTime < DAY_CYCLE_LENGTH*0.45 ? 'Day' : game.dayTime < DAY_CYCLE_LENGTH*0.55 ? 'Dusk' : game.dayTime < DAY_CYCLE_LENGTH*0.9 ? 'Night' : 'Dawn';
        const debugEl = document.getElementById('debug-info');
        const modeLabel = game.flyMode ? ' | Flying' : '';
        const saveLabel = game.saveErrored ? ' | ! Save storage full' : '';
        debugEl.textContent = `FPS: ${fps} | Pos: ${game.player.x.toFixed(1)}, ${game.player.y.toFixed(1)}, ${game.player.z.toFixed(1)} | Biome: ${['Forest','Mountains','Deep Dark','Plains','Beach'][getBiome(Math.floor(game.player.x), Math.floor(game.player.z))]} | Chunks: ${visibleOpaqueChunks.length}/${game.chunkMeshes.size} | ${timeLabel}${modeLabel}${saveLabel}`;
    }
}

function updateBreakOverlay(visible) {
    const overlay = document.getElementById('break-overlay');
    if(!overlay) return;

    if(!visible) {
        overlay.style.display = 'none';
        return;
    }

    overlay.style.display = 'block';
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelWidth = Math.floor(width * dpr);
    const pixelHeight = Math.floor(height * dpr);
    if(overlay.width !== pixelWidth || overlay.height !== pixelHeight) {
        overlay.width = pixelWidth;
        overlay.height = pixelHeight;
        overlay.style.width = width + 'px';
        overlay.style.height = height + 'px';
    }

    const ctx = overlay.getContext('2d');
    const progress = Math.max(0, Math.min(1, game.breakProgress));
    const cx = width / 2;
    const cy = height / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = 'rgba(61, 21, 37, 0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 35, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 214, 232, ${0.7 + progress * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();

    const cracks = [
        [[0, -6], [-9, -18], [-21, -25]],
        [[4, -4], [17, -10], [28, -18]],
        [[-3, 2], [-18, 4], [-30, 13]],
        [[2, 5], [10, 21], [19, 31]],
        [[-1, 0], [-7, 16], [-17, 27]],
        [[6, 1], [20, 6], [31, 4]],
        [[-5, -3], [-17, -9], [-28, -7]]
    ];
    const shown = Math.ceil(progress * cracks.length);
    drawCracks(ctx, cracks.slice(0, shown), cx, cy, 5, 'rgba(61, 21, 37, 0.85)');
    drawCracks(ctx, cracks.slice(0, shown), cx, cy, 2, 'rgba(255, 240, 245, 0.95)');

    ctx.font = '800 12px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(61, 21, 37, 0.9)';
    ctx.fillText(Math.round(progress * 100) + '%', cx + 1, cy + 55);
    ctx.fillStyle = 'rgba(255, 248, 240, 0.98)';
    ctx.fillText(Math.round(progress * 100) + '%', cx, cy + 54);
    ctx.restore();
}

function drawCracks(ctx, cracks, cx, cy, lineWidth, strokeStyle) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;
    for(const crack of cracks) {
        ctx.beginPath();
        ctx.moveTo(cx + crack[0][0], cy + crack[0][1]);
        for(let i = 1; i < crack.length; i++) {
            ctx.lineTo(cx + crack[i][0], cy + crack[i][1]);
        }
        ctx.stroke();
    }
}

// ====== CONTROLS OVERLAY ======
function toggleControlsOverlay() {
    game.controlsOverlayOpen = !game.controlsOverlayOpen;
    const overlay = document.getElementById('controls-overlay');
    if (game.controlsOverlayOpen) {
        overlay.style.display = 'flex';
        if (typeof exitGamePointerLock === 'function') exitGamePointerLock();
        else if (document.exitPointerLock) document.exitPointerLock();
    } else {
        overlay.style.display = 'none';
        if (typeof requestGamePointerLock === 'function') requestGamePointerLock();
        else if (game.canvas.requestPointerLock) game.canvas.requestPointerLock();
    }
}

const controlsCloseBtn = document.getElementById('controls-close');
if(controlsCloseBtn) {
    controlsCloseBtn.addEventListener('click', function() {
        if(game.controlsOverlayOpen) toggleControlsOverlay();
    });
}
