'use strict';

// ====== INPUT HANDLING ======
let pendingPointerLockAction = null;

function isSecondaryActionEvent(e) {
    return e.button === 2 || (e.button === 0 && e.ctrlKey);
}

function requestGamePointerLock() {
    const request = game.canvas.requestPointerLock || game.canvas.webkitRequestPointerLock;
    if(!request) return;
    // Browsers may throw synchronously (NotSupported/Security) or reject
    // a returned Promise if the call isn't tied to a fresh user gesture.
    try {
        const result = request.call(game.canvas);
        if(result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_) { /* ignore — user can re-click to retry */ }
}

function exitGamePointerLock() {
    const exit = document.exitPointerLock || document.webkitExitPointerLock;
    if(!exit) return;
    try { exit.call(document); } catch (_) { /* no-op */ }
}

function isPlaceableBlockItem(id) {
    return !!BLOCK_TILES[id] && id !== WATER;
}

function handlePlaceAction() {
    const item = game.inventory[game.selectedSlot];

    // Check for block station interaction first: if the target block is a
    // placed Crafting Table or Furnace, open its UI instead of placing.
    if (game.targetBlock) {
        const tb = game.targetBlock;
        if (tb.block === CRAFTING_TABLE) {
            game.actionHelper.actionSeen = true;
            openCraftingTableUI(tb.x, tb.y, tb.z);
            return true;
        }
        if (tb.block === FURNACE) {
            game.actionHelper.actionSeen = true;
            openFurnaceUI(tb.x, tb.y, tb.z);
            return true;
        }
    }

    // Pet taming: if holding treat, check for animal target first
    if(item && isTreatItem(item.id)) {
        const mobTarget = findTargetMob(5);
        if(mobTarget) {
            // Looking at a mob while holding treat
            if(isAnimalMob(mobTarget.mob.type) && !mobTarget.mob.tamed) {
                // Valid untamed animal → tame it, consume treat
                game.actionHelper.actionSeen = true;
                tameAnimal(mobTarget.mob);
                if(!game.creativeMode) removeFromSlot(game.selectedSlot);
                updateHotbar();
                return true;
            }
            // Warden, villager, or already-tamed → no action, no consume
            return false;
        }
        // No mob target → eat the treat (existing behavior)
        game.actionHelper.actionSeen = true;
        eatTreat(item.id);
        if(!game.creativeMode) removeFromSlot(game.selectedSlot);
        updateHotbar();
        return true;
    }

    if(game.targetBlock && item && isPlaceableBlockItem(item.id)) {
        const px2 = game.targetBlock.x + game.targetBlock.nx;
        const py2 = game.targetBlock.y + game.targetBlock.ny;
        const pz2 = game.targetBlock.z + game.targetBlock.nz;
        // Block at (i,j,k) occupies [i,i+1]; reject placement only if it
        // actually intersects the game.player AABB (not just shares a floor).
        const pAABB = playerAABB(game.player.x, game.player.y, game.player.z);
        const overlaps = pAABB.x0 < px2 + 1 && pAABB.x1 > px2 &&
                         pAABB.y0 < py2 + 1 && pAABB.y1 > py2 &&
                         pAABB.z0 < pz2 + 1 && pAABB.z1 > pz2;
        if(!overlaps) {
            game.actionHelper.actionSeen = true;
            setBlock(px2, py2, pz2, item.id);
            if(!game.creativeMode) removeFromSlot(game.selectedSlot);
            updateHotbar();
            if(typeof advanceQuest === 'function') advanceQuest('place-block');
            return true;
        }
        return false;
    }

    return false;
}

function handleInteractAction() {
    const villagerTarget = findTargetVillager();
    if(!villagerTarget) return false;
    if(game.targetBlock && villagerTarget.dist > game.targetBlock.dist + 0.35) return false;
    const villager = villagerTarget.mob;
    if(villager.trades && villager.trades.length > 0) {
        game.actionHelper.actionSeen = true;
        openTradePanel(villager);
        return true;
    }
    return false;
}

function handleSecondaryAction() {
    return handlePlaceAction();
}

document.addEventListener('keydown', (e) => {
    game.keys[e.code] = true;
    const gameInputBlocked = game.inventoryOpen || game.tradeTarget || game.petPanelOpen || game.questPanelOpen || game.craftingTableOpen || game.furnaceOpen || game.controlsOverlayOpen;

    if(e.code === 'Space' && !gameInputBlocked) {
        e.preventDefault();
        if(!e.repeat) {
            const now = performance.now();
            if(now - game.lastSpaceTapTime < 300) {
                game.flyMode = !game.flyMode;
                game.lastSpaceTapTime = 0;
                if(game.flyMode && game.player.vy < 0) game.player.vy = 0;
            } else {
                game.lastSpaceTapTime = now;
            }
        }
    }

    if(e.code === 'KeyR' && !gameInputBlocked) {
        e.preventDefault();
        game.miningKeyHeld = true;
    }
    if(e.code === 'KeyF' && !gameInputBlocked && !e.repeat) {
        e.preventDefault();
        handlePlaceAction();
    }
    if(e.code === 'KeyT' && !gameInputBlocked && !e.repeat) {
        e.preventDefault();
        handleInteractAction();
    }
    if(e.code === 'KeyE') {
        e.preventDefault();
        game.miningKeyHeld = false;
        if(game.controlsOverlayOpen) return; // don't open inventory under the controls overlay
        if(game.craftingTableOpen) { closeCraftingTableUI(); return; }
        if(game.furnaceOpen) { closeFurnaceUI(); return; }
        if(game.questPanelOpen) { toggleQuestPanel(); return; }
        if(game.petPanelOpen) { togglePetPanel(); return; }
        toggleInventory();
    }
    if(e.code === 'KeyP' && !gameInputBlocked && !e.repeat) {
        e.preventDefault();
        togglePetPanel();
    }
    if(e.code === 'KeyQ' && !e.repeat) {
        e.preventDefault();
        if(game.inventoryOpen || game.tradeTarget || game.craftingTableOpen || game.furnaceOpen || game.controlsOverlayOpen) return;
        if(game.petPanelOpen) { togglePetPanel(); return; }
        toggleQuestPanel();
    }
    if(e.code === 'KeyC' && !gameInputBlocked && !e.repeat) {
        e.preventDefault();
        toggleCreativeMode();
    }
    if(e.code === 'KeyH' && !e.repeat) {
        e.preventDefault();
        // Allow closing the overlay, but never open it on top of another panel
        // (its close path would re-lock the pointer under the remaining modal).
        if(!game.controlsOverlayOpen && gameInputBlocked) return;
        toggleControlsOverlay();
    }
    if(e.code === 'Slash' && e.shiftKey && !e.repeat) {
        e.preventDefault();
        if(!game.controlsOverlayOpen && gameInputBlocked) return;
        toggleControlsOverlay();
    }
    if(e.code >= 'Digit1' && e.code <= 'Digit9' && !gameInputBlocked) {
        game.selectedSlot = parseInt(e.code.charAt(5)) - 1;
        updateHotbar();
    }
});
document.addEventListener('keyup', (e) => {
    game.keys[e.code] = false;
    if(e.code === 'KeyR') game.miningKeyHeld = false;
});

game.canvas.addEventListener('mousedown', (e) => {
    if(!game.pointerLocked && !game.inventoryOpen && !game.tradeTarget && !game.petPanelOpen && !game.questPanelOpen && !game.craftingTableOpen && !game.furnaceOpen && !game.controlsOverlayOpen) {
        e.preventDefault();
        if(isSecondaryActionEvent(e)) {
            game.mouseDown[2] = true;
            pendingPointerLockAction = 'secondary';
        } else if(e.button === 0) {
            game.mouseDown[0] = true;
            pendingPointerLockAction = 'primary';
        }
        requestGamePointerLock();
    }
});

document.addEventListener('mousedown', (e) => {
    if(!game.pointerLocked || game.inventoryOpen || game.tradeTarget || game.petPanelOpen || game.questPanelOpen || game.craftingTableOpen || game.furnaceOpen || game.controlsOverlayOpen) return;

    if(isSecondaryActionEvent(e)) {
        e.preventDefault();
        game.mouseDown[2] = true;
        handleSecondaryAction();
        return;
    }

    if(e.button === 0) game.mouseDown[0] = true;
});

document.addEventListener('mouseup', (e) => {
    if(isSecondaryActionEvent(e)) {
        game.mouseDown[2] = false;
        if(pendingPointerLockAction === 'secondary') pendingPointerLockAction = null;
    }
    if(e.button === 0) {
        game.mouseDown[0] = false;
        if(pendingPointerLockAction === 'primary') pendingPointerLockAction = null;
        game.breakProgress = 0;
        game.breakingBlock = null;
    }
});
document.addEventListener('contextmenu', (e) => {
    if(game.pointerLocked || e.target === game.canvas) e.preventDefault();
});

// Scroll wheel for hotbar slot selection
document.addEventListener('wheel', (e) => {
    if(!game.pointerLocked || game.tradeTarget || game.controlsOverlayOpen) return;    e.preventDefault();
    if(e.deltaY > 0) {
        game.selectedSlot = (game.selectedSlot + 1) % 9;
    } else if(e.deltaY < 0) {
        game.selectedSlot = (game.selectedSlot + 8) % 9;
    }
    updateHotbar();
}, { passive: false });

// Mouse look
document.addEventListener('mousemove', (e) => {
    if(game.inventoryOpen || game.craftingTableOpen || game.furnaceOpen || game.controlsOverlayOpen) {
        updateCursorStackPosition(e.clientX, e.clientY);
        return;
    }
    if(game.tradeTarget) return;
    if(!game.pointerLocked) return;
    game.player.yaw -= e.movementX * 0.002;
    game.player.pitch -= e.movementY * 0.002;
    game.player.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, game.player.pitch));
});

// Pointer lock change — handle both prefixed and unprefixed for Safari
function handlePointerLockChange() {
    const lockElement = document.pointerLockElement || document.webkitPointerLockElement;
    game.pointerLocked = lockElement === game.canvas;
    game.canvas.style.cursor = game.pointerLocked ? 'none' : 'default';
    if(game.pointerLocked) game.actionHelper.pointerLockedOnce = true;
    if(game.pointerLocked && pendingPointerLockAction) {
        const pendingAction = pendingPointerLockAction;
        pendingPointerLockAction = null;
        if(pendingAction === 'secondary' && game.mouseDown[2]) handleSecondaryAction();
    }
    if(!game.pointerLocked) {
        pendingPointerLockAction = null;
        game.mouseDown = [false, false, false];
        game.miningKeyHeld = false;
        game.breakProgress = 0;
        game.breakingBlock = null;
    }
}
document.addEventListener('pointerlockchange', handlePointerLockChange);
document.addEventListener('webkitpointerlockchange', handlePointerLockChange);

function clearInputState() {
    for(const code of Object.keys(game.keys)) game.keys[code] = false;
    game.mouseDown = [false, false, false];
    game.miningKeyHeld = false;
    pendingPointerLockAction = null;
    game.breakProgress = 0;
    game.breakingBlock = null;
}

window.addEventListener('blur', clearInputState);
