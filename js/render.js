'use strict';

// ====== MAIN RENDER LOOP ======
// game.lastTime and game.gameTime are now game.lastTime and game.gameTime (initialized in state.js)
let frameCount = 0;
let perfFrameCount = 0;
let fps = 0;
let fpsTimer = 0;
let debugTimer = 0;
let simulationAccumulator=0;
const frameTimeSamples=[];
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
    const frameDt = Math.min((now - game.lastTime) / 1000, 0.05);
    const fixed=game.paused?{steps:0,accumulator:simulationAccumulator,alpha:0}:CandyCore.advanceFixedStep(simulationAccumulator,frameDt,{step:1/60,maxSteps:12});simulationAccumulator=fixed.accumulator;const dt=fixed.steps/60;
    game.lastTime = now;
    game.gameTime += dt;
    frameCount++;
    frameTimeSamples.push(frameDt*1000);if(frameTimeSamples.length>600)frameTimeSamples.shift();if(perfFrameCount%120===0&&frameTimeSamples.length){const sorted=frameTimeSamples.slice().sort((a,b)=>a-b),pick=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];document.documentElement.dataset.frameStats=[pick(.5).toFixed(2),pick(.95).toFixed(2),pick(.99).toFixed(2),fps].join(',');}
    fpsTimer += frameDt;
    if(fpsTimer >= 1) { fps = frameCount; frameCount = 0; fpsTimer = 0; }
    updateTutorial(dt);

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

    for(let tick=0;tick<fixed.steps;tick++){
        const step=1/60;updateDayNight(step);updatePlayer(step);updateMobs(step);updateEffects(step);updateItemDrops(step);updateOvens(step);updateFarming(step);updateMechanisms(step);
    }

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
    if(game.chestOpen&&game.chestPos){const cp=game.chestPos,dx=game.player.x-(cp.x+.5),dy=game.player.y-(cp.y+.5),dz=game.player.z-(cp.z+.5);if(dx*dx+dy*dy+dz*dz>36||getBlock(cp.x,cp.y,cp.z)!==CUPCAKE_CHEST)closeChest();}

    const viewMotion = updateFirstPersonPresentation(dt);

    // Update game.mobs and effects
    performance.mark('updateMobs_start');
    performance.mark('updateMobs_end');
    performance.measure('updateMobs', 'updateMobs_start', 'updateMobs_end');
    CandyAudio.update(dt);

    // Block targeting
    const camX = game.player.x, camY = game.player.y + 1.62, camZ = game.player.z;
    const lookX = -Math.sin(game.player.yaw) * Math.cos(game.player.pitch);
    const lookY = Math.sin(game.player.pitch);
    const lookZ = -Math.cos(game.player.yaw) * Math.cos(game.player.pitch);
    game.targetBlock = raycast(camX, camY, camZ, lookX, lookY, lookZ, 6);

    // Block breaking
    const miningActive = game.miningKeyHeld || (game.mouseDown[0] && game.pointerLocked);
    if(miningActive && game.presentation.actionTime <= 0.04) playViewAction('mine', 0.28);
    if(miningActive && game.targetBlock && !game.inventoryOpen && !game.tradeTarget && !game.petPanelOpen && !game.questPanelOpen && !game.craftingTableOpen && !game.furnaceOpen && !game.controlsOverlayOpen) {
        game.actionHelper.actionSeen = true;
        if(!game.breakingBlock || game.breakingBlock.x !== game.targetBlock.x || game.breakingBlock.y !== game.targetBlock.y || game.breakingBlock.z !== game.targetBlock.z) {
            game.breakingBlock = { x: game.targetBlock.x, y: game.targetBlock.y, z: game.targetBlock.z };
            game.breakProgress = 0;
            game.breakStage = -1;
        }
        const hardness = BLOCK_HARDNESS[game.targetBlock.block] || 1;
        if(hardness < Infinity) {
            const heldItem = game.inventory[game.selectedSlot];
            const toolMult = heldItem ? getToolMultiplier(heldItem.id, game.targetBlock.block) : 0.5;
            game.breakProgress += dt / (hardness / toolMult);
            const nextStage = Math.min(7, Math.floor(game.breakProgress * 8));
            if(nextStage !== game.breakStage) {
                game.breakStage = nextStage;
                spawnBlockFeedback(game.targetBlock, game.targetBlock.block, 3);
                CandyEvents.emit('blockHit', { blockId:game.targetBlock.block, position:game.targetBlock });
            }
            if(game.breakProgress >= 1.0) {
                // Creative mode: break the block without collecting the drop.
                // The creative inventory is always full (every slot a max stack,
                // and placement never decrements), so addItem() would always
                // fail and no block could ever be broken.
                const brokenBlockId = game.targetBlock.block;
                const heldTool=game.inventory[game.selectedSlot]?.id;
                const contentsCommitted=brokenBlockId===FURNACE?breakBlockEntity(game.targetBlock.x,game.targetBlock.y,game.targetBlock.z):breakUtilityBlock(game.targetBlock.x,game.targetBlock.y,game.targetBlock.z,brokenBlockId);
                if(contentsCommitted){
                    if(brokenBlockId===FURNACE)breakUtilityBlock(game.targetBlock.x,game.targetBlock.y,game.targetBlock.z,brokenBlockId);
                    if(isCropBlock(brokenBlockId))harvestCrop(game.targetBlock.x,game.targetBlock.y,game.targetBlock.z,brokenBlockId,true);
                    setBlock(game.targetBlock.x, game.targetBlock.y, game.targetBlock.z, AIR);
                    if(!game.creativeMode) for(const drop of getBlockDrops(brokenBlockId,heldTool,game.targetBlock.x*31+game.targetBlock.y*17+game.targetBlock.z)) spawnItemDrop(drop.id,drop.count,game.targetBlock.x+.5,game.targetBlock.y+.7,game.targetBlock.z+.5,{x:game.targetBlock.nx*.7,y:1.5,z:game.targetBlock.nz*.7});
                    if(!game.creativeMode)damageHeldTool(1);
                    CandyEvents.emit('blockBroken', { blockId:brokenBlockId, position:game.targetBlock });
                    updateHotbar();
                }
                game.breakProgress = 0;
                game.breakingBlock = null;
                game.breakStage = -1;
            }
        }
    } else {
        if(!miningActive) { game.breakProgress = 0; game.breakingBlock = null; }
    }
    updateBreakOverlay(miningActive && game.targetBlock && !game.inventoryOpen && !game.tradeTarget && !game.petPanelOpen && !game.questPanelOpen && !game.craftingTableOpen && !game.furnaceOpen && !game.controlsOverlayOpen && game.breakProgress > 0);
    updateChunkStreaming();

    // Remesh dirty game.chunks (max 4 per frame for perf)
    performance.mark('remesh_start');
    let remeshed = 0;
    if(perfFrameCount%4===0)for(const key of game.dirtyChunks) {
        if(remeshed >= 1) break;
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

    game.gl.disable(game.gl.DEPTH_TEST);
    game.gl.disable(game.gl.CULL_FACE);
    game.gl.useProgram(skyProgram);
    game.gl.uniform3f(skyUni.uTop, game.skyR * 0.58, game.skyG * 0.62, game.skyB * 0.82);
    game.gl.uniform3f(skyUni.uHorizon, game.fogR, game.fogG, game.fogB);
    game.gl.uniform1f(skyUni.uDayT, game.dayTime / DAY_CYCLE_LENGTH);
    game.gl.uniform1f(skyUni.uDaylight, game.daylight);
    game.gl.bindVertexArray(skyVAO);
    game.gl.drawArrays(game.gl.TRIANGLES, 0, 3);
    game.gl.enable(game.gl.DEPTH_TEST);
    game.gl.enable(game.gl.CULL_FACE);

    renderEye[0] = camX + viewMotion.x; renderEye[1] = camY - viewMotion.y; renderEye[2] = camZ;
    renderCenter[0] = renderEye[0] + lookX; renderCenter[1] = renderEye[1] + lookY; renderCenter[2] = renderEye[2] + lookZ;
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
    visibleWaterChunks.sort((a, b) => {
        const adx = a.centerX - camX, adz = a.centerZ - camZ;
        const bdx = b.centerX - camX, bdz = b.centerZ - camZ;
        return (bdx * bdx + bdz * bdz) - (adx * adx + adz * adz);
    });

    // Render opaque terrain
    game.gl.useProgram(game.terrainProgram);
    game.gl.uniformMatrix4fv(tUni.uVP, false, vpMatrix);
    game.gl.uniform3f(tUni.uCamPos, camX, camY, camZ);
    game.gl.uniform1f(tUni.uDaylight, game.daylight);
    game.gl.uniform3f(tUni.uSunDir, game.sunDirection[0], game.sunDirection[1], game.sunDirection[2]);
    game.gl.uniform3f(tUni.uFogColor, game.fogR, game.fogG, game.fogB);
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
    game.gl.uniform1f(wUni.uTime, game.gameTime);
    const cameraInWater = getBlock(Math.floor(camX), Math.floor(camY), Math.floor(camZ)) === WATER;
    game.gl.uniform3f(wUni.uFogColor, cameraInWater ? 0.72 : game.fogR, cameraInWater ? 0.25 : game.fogG, cameraInWater ? 0.52 : game.fogB);
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
    game.gl.bindVertexArray(cloudVAO);
    const cloudLayers = [[0,0.003,0.55],[6,0.0018,0.36],[-5,0.0045,0.24]];
    for(const layer of cloudLayers) {
        game.gl.uniform2f(cUni.uOffset, game.gameTime * layer[1], layer[0] * 0.017);
        game.gl.uniform1f(cUni.uHeight, layer[0]);
        game.gl.uniform1f(cUni.uAlpha, layer[2] * (1 - game.weather.intensity * 0.2));
        game.gl.drawArrays(game.gl.TRIANGLES, 0, 6);
    }

    game.gl.depthMask(true);
    game.gl.disable(game.gl.BLEND);

    // Render block highlight
    if(game.targetBlock) {
        updateBlockHighlight(game.targetBlock.x, game.targetBlock.y, game.targetBlock.z,
            game.targetBlock.nx, game.targetBlock.ny, game.targetBlock.nz, game.breakProgress);
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
        game.gl.drawArrays(game.gl.LINES, 0, blockHighlightVertexCount);
    }

    performance.mark('renderMobs_start');
    renderMobs(vpMatrix);
    performance.mark('renderMobs_end');
    performance.measure('renderMobs', 'renderMobs_start', 'renderMobs_end');
    renderParticles(vpMatrix);
    renderItemDrops(vpMatrix);
    updateNameTags(vpMatrix);

    // Update effect HUD
    updateEffectHUD();
    updateActionHelper(miningActive);

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

    overlay.style.display = 'none';
    return;

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

// ====== ACTION HELPER HUD ======
function isAnyPanelOpen() {
    return game.inventoryOpen || game.tradeTarget || game.petPanelOpen || game.questPanelOpen ||
        game.craftingTableOpen || game.furnaceOpen || game.controlsOverlayOpen || isRecipeGuideVisible();
}

function isRecipeGuideVisible() {
    const guide = document.getElementById('recipe-guide');
    return !!guide && window.getComputedStyle(guide).display !== 'none';
}

function isMovementKeyDown() {
    return game.keys['KeyW'] || game.keys['KeyA'] || game.keys['KeyS'] || game.keys['KeyD'] ||
        game.keys['ArrowUp'] || game.keys['ArrowLeft'] || game.keys['ArrowDown'] || game.keys['ArrowRight'] ||
        game.keys['Space'] || game.keys['ShiftLeft'] || game.keys['ShiftRight'] ||
        game.keys['ControlLeft'] || game.keys['ControlRight'];
}

function getSelectedItemName() {
    const item = game.inventory[game.selectedSlot];
    return item ? (BLOCK_NAMES[item.id] || 'Item') : '';
}

function getBlockActionHint(blockId) {
    if(blockId === CRAFTING_TABLE) {
        return {
            title: 'Crafting Table',
            detail: 'Right-click or press F to craft advanced items.',
            kind: 'interact'
        };
    }
    if(blockId === FURNACE) {
        return {
            title: 'Furnace',
            detail: 'Right-click or press F to smelt ores and sand.',
            kind: 'interact'
        };
    }
    return {
        title: BLOCK_NAMES[blockId] || 'Block',
        detail: 'Hold R or left-click to mine it.',
        kind: 'target'
    };
}

function getMobActionHint(item) {
    if(typeof findTargetMob !== 'function') return null;
    const mobTarget = findTargetMob(5);
    if(!mobTarget || !mobTarget.mob) return null;
    const mob = mobTarget.mob;
    const name = MOB_NAMES[mob.type] || 'Friend';
    if(item && isTreatItem(item.id) && typeof isAnimalMob === 'function' && isAnimalMob(mob.type) && !mob.tamed) {
        return {
            title: 'Tame ' + name,
            detail: 'Right-click with ' + (BLOCK_NAMES[item.id] || 'a treat') + ' to make a pet.',
            kind: 'interact'
        };
    }
    if(mob.tamed) {
        return {
            title: mob.petName || name,
            detail: 'Press P to open your pet panel.',
            kind: 'pet'
        };
    }
    return null;
}

function getVillagerActionHint() {
    if(typeof findTargetVillager !== 'function') return null;
    const villagerTarget = findTargetVillager();
    if(!villagerTarget || !villagerTarget.mob) return null;
    if(game.targetBlock && villagerTarget.dist > game.targetBlock.dist + 0.35) return null;
    return {
        title: MOB_NAMES[villagerTarget.mob.type] || 'Villager',
        detail: 'Press T to trade.',
        kind: 'interact'
    };
}

function getHeldItemActionHint(item) {
    if(!item) {
        return {
            title: 'Empty hand',
            detail: 'Aim at blocks to mine. Press E for inventory.',
            kind: 'starter'
        };
    }
    const name = BLOCK_NAMES[item.id] || 'Item';
    if(isTreatItem(item.id)) {
        return {
            title: name,
            detail: 'Right-click to eat, or aim at an animal to tame it.',
            kind: 'interact'
        };
    }
    if(isPlaceableBlockItem(item.id)) {
        return {
            title: name,
            detail: 'Aim at a block, then press F or right-click to place.',
            kind: 'target'
        };
    }
    if(isToolItem(item.id)) {
        return {
            title: name,
            detail: 'Aim at a block and hold R or left-click.',
            kind: 'target'
        };
    }
    return {
        title: name,
        detail: 'Press E to manage inventory. H shows controls.',
        kind: 'starter'
    };
}

function applyActionHelperHint(hint, visible) {
    const helper = document.getElementById('action-helper');
    if(!helper) return;
    if(!visible || !hint) {
        helper.className = 'action-helper';
        helper.setAttribute('aria-hidden', 'true');
        return;
    }

    const titleEl = document.getElementById('action-helper-title');
    const detailEl = document.getElementById('action-helper-detail');
    if(titleEl && game.actionHelper.lastTitle !== hint.title) titleEl.textContent = hint.title;
    if(detailEl && game.actionHelper.lastDetail !== hint.detail) detailEl.textContent = hint.detail;
    game.actionHelper.lastTitle = hint.title;
    game.actionHelper.lastDetail = hint.detail;
    game.actionHelper.lastKind = hint.kind || '';

    helper.className = 'action-helper visible' + (hint.kind ? ' ' + hint.kind : '');
    helper.setAttribute('aria-hidden', 'false');
}

function updateActionHelper(miningActive) {
    if(isMovementKeyDown()) game.actionHelper.movementSeen = true;
    if(miningActive && game.targetBlock) game.actionHelper.actionSeen = true;

    if(!game.worldLoaded || isAnyPanelOpen()) {
        applyActionHelperHint(null, false);
        return;
    }

    if(!game.pointerLocked) {
        applyActionHelperHint({
            title: game.actionHelper.pointerLockedOnce ? 'Click to return' : 'Click to play',
            detail: 'WASD to move. H or ? shows controls.',
            kind: 'starter'
        }, true);
        return;
    }

    const item = game.inventory[game.selectedSlot];
    const mobHint = getMobActionHint(item);
    if(mobHint) {
        applyActionHelperHint(mobHint, true);
        return;
    }

    const villagerHint = getVillagerActionHint();
    if(villagerHint) {
        applyActionHelperHint(villagerHint, true);
        return;
    }

    if(game.targetBlock) {
        const blockHint = getBlockActionHint(game.targetBlock.block);
        const heldName = getSelectedItemName();
        if(item && isPlaceableBlockItem(item.id) && game.targetBlock.block !== CRAFTING_TABLE && game.targetBlock.block !== FURNACE) {
            blockHint.detail = 'F/right-click places ' + heldName + '. Hold R/left-click mines.';
        }
        applyActionHelperHint(blockHint, true);
        return;
    }

    if(!game.actionHelper.movementSeen || game.gameTime < 14) {
        applyActionHelperHint({
            title: 'Explore Sweet, Sweet World',
            detail: 'WASD moves, mouse looks, E opens inventory.',
            kind: 'starter'
        }, true);
        return;
    }

    if(!game.actionHelper.actionSeen || (item && (isTreatItem(item.id) || isPlaceableBlockItem(item.id) || isToolItem(item.id)))) {
        applyActionHelperHint(getHeldItemActionHint(item), true);
        return;
    }

    applyActionHelperHint(null, false);
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
