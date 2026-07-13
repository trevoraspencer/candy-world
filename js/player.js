'use strict';

// ====== BLOCK HIGHLIGHT (Line rendering) ======
let lineVAO, lineVBO;
const blockHighlightLines = new Float32Array(160);
let blockHighlightVertexCount = 24;
{
    lineVAO = game.gl.createVertexArray();
    lineVBO = game.gl.createBuffer();
    game.gl.bindVertexArray(lineVAO);
    game.gl.bindBuffer(game.gl.ARRAY_BUFFER, lineVBO);
    game.gl.bufferData(game.gl.ARRAY_BUFFER, blockHighlightLines.byteLength, game.gl.DYNAMIC_DRAW);
    game.gl.enableVertexAttribArray(lAPos);
    game.gl.vertexAttribPointer(lAPos, 3, game.gl.FLOAT, false, 12, 0);
    game.gl.bindVertexArray(null);
}

function updateBlockHighlight(bx, by, bz, nx, ny, nz, progress) {
    const e = 0.002; // slight expansion to avoid z-fighting
    const x0 = bx - e, y0 = by - e, z0 = bz - e;
    const x1 = bx + 1 + e, y1 = by + 1 + e, z1 = bz + 1 + e;
    const values = [
        // Bottom face
        x0,y0,z0, x1,y0,z0,
        x1,y0,z0, x1,y0,z1,
        x1,y0,z1, x0,y0,z1,
        x0,y0,z1, x0,y0,z0,
        // Top face
        x0,y1,z0, x1,y1,z0,
        x1,y1,z0, x1,y1,z1,
        x1,y1,z1, x0,y1,z1,
        x0,y1,z1, x0,y1,z0,
        // Verticals
        x0,y0,z0, x0,y1,z0,
        x1,y0,z0, x1,y1,z0,
        x1,y0,z1, x1,y1,z1,
        x0,y0,z1, x0,y1,z1
    ];
    const stage = Math.max(0, Math.min(8, Math.ceil((progress || 0) * 8)));
    const cracks = [
        [-.02,.5,.28,.52], [.28,.52,.42,.78], [.28,.52,.48,.31], [.48,.31,.72,.18],
        [.42,.78,.68,.91], [.48,.31,.78,.43], [.78,.43,1.02,.34], [.42,.78,.54,1.02]
    ];
    for(let i=0;i<stage;i++) for(let endpoint=0;endpoint<2;endpoint++) {
        const a=cracks[i][endpoint*2], b=cracks[i][endpoint*2+1];
        if(Math.abs(nx)>0) values.push(nx>0?x1:x0,y0+a,z0+b);
        else if(Math.abs(ny)>0) values.push(x0+a,ny>0?y1:y0,z0+b);
        else values.push(x0+a,y0+b,nz>0?z1:z0);
    }
    blockHighlightVertexCount = values.length / 3;
    blockHighlightLines.fill(0);
    blockHighlightLines.set(values);
    game.gl.bindBuffer(game.gl.ARRAY_BUFFER, lineVBO);
    game.gl.bufferSubData(game.gl.ARRAY_BUFFER, 0, blockHighlightLines.subarray(0, values.length));
}

// ====== FRUSTUM CULLING ======
// Planes are packed as 6 × (nx, ny, nz, d) into one flat Float32Array
// reused each frame to avoid GC churn.
const frustumPlaneData = new Float32Array(24);
function extractFrustumPlanes(vp) {
    const o = frustumPlaneData;
    // Left
    o[0] = vp[3]+vp[0]; o[1] = vp[7]+vp[4]; o[2] = vp[11]+vp[8]; o[3] = vp[15]+vp[12];
    // Right
    o[4] = vp[3]-vp[0]; o[5] = vp[7]-vp[4]; o[6] = vp[11]-vp[8]; o[7] = vp[15]-vp[12];
    // Bottom
    o[8] = vp[3]+vp[1]; o[9] = vp[7]+vp[5]; o[10] = vp[11]+vp[9]; o[11] = vp[15]+vp[13];
    // Top
    o[12] = vp[3]-vp[1]; o[13] = vp[7]-vp[5]; o[14] = vp[11]-vp[9]; o[15] = vp[15]-vp[13];
    // Near
    o[16] = vp[3]+vp[2]; o[17] = vp[7]+vp[6]; o[18] = vp[11]+vp[10]; o[19] = vp[15]+vp[14];
    // Far
    o[20] = vp[3]-vp[2]; o[21] = vp[7]-vp[6]; o[22] = vp[11]-vp[10]; o[23] = vp[15]-vp[14];
    for(let i = 0; i < 24; i += 4) {
        const len = Math.sqrt(o[i]*o[i] + o[i+1]*o[i+1] + o[i+2]*o[i+2]);
        if(len > 0) { o[i]/=len; o[i+1]/=len; o[i+2]/=len; o[i+3]/=len; }
    }
    return o;
}

function isChunkInFrustum(cx, cz, planes) {
    const x0 = cx*16, z0 = cz*16;
    const x1 = x0+16, z1 = z0+16;
    const y0 = 0, y1 = CHUNK_H;
    for(let i = 0; i < 24; i += 4) {
        const px = planes[i]   > 0 ? x1 : x0;
        const py = planes[i+1] > 0 ? y1 : y0;
        const pz = planes[i+2] > 0 ? z1 : z0;
        if(planes[i]*px + planes[i+1]*py + planes[i+2]*pz + planes[i+3] < 0) return false;
    }
    return true;
}

// ====== DDA RAYCAST ======
function raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sdx = dx > 0 ? 1 : -1, sdy = dy > 0 ? 1 : -1, sdz = dz > 0 ? 1 : -1;
    // Guard against zero-direction axes: any 1/d would be Infinity and
    // (frac) * Infinity is NaN when the ray origin lies exactly on an
    // integer plane along that axis. Treat zero components as 'never
    // crosses an X/Y/Z plane' by setting tm/td to +Infinity.
    const tdx = dx === 0 ? Infinity : Math.abs(1/dx);
    const tdy = dy === 0 ? Infinity : Math.abs(1/dy);
    const tdz = dz === 0 ? Infinity : Math.abs(1/dz);
    let tmx = dx === 0 ? Infinity : (dx > 0 ? (x + 1 - ox) * tdx : (ox - x) * tdx);
    let tmy = dy === 0 ? Infinity : (dy > 0 ? (y + 1 - oy) * tdy : (oy - y) * tdy);
    let tmz = dz === 0 ? Infinity : (dz > 0 ? (z + 1 - oz) * tdz : (oz - z) * tdz);
    let dist = 0;
    let nx = 0, ny = 0, nz = 0;

    for(let i = 0; i < 200; i++) {
        const b = getBlock(x, y, z);
        if(b !== AIR && b !== WATER) {
            return { x, y, z, nx, ny, nz, block: b, dist };
        }
        if(tmx < tmy && tmx < tmz) {
            dist = tmx; x += sdx; tmx += tdx;
            nx = -sdx; ny = 0; nz = 0;
        } else if(tmy < tmz) {
            dist = tmy; y += sdy; tmy += tdy;
            nx = 0; ny = -sdy; nz = 0;
        } else {
            dist = tmz; z += sdz; tmz += tdz;
            nx = 0; ny = 0; nz = -sdz;
        }
        if(dist > maxDist) break;
    }
    return null;
}

// ====== PLAYER PHYSICS ======
function playerAABB(px, py, pz) {
    const hw = game.player.width / 2;
    return {
        x0: px - hw, y0: py, z0: pz - hw,
        x1: px + hw, y1: py + game.player.height, z1: pz + hw
    };
}

function aabbOverlapsSolid(aabb) {
    // A block at integer (i,j,k) occupies [i,i+1]; AABB [x0,x1] overlaps
    // it iff x0 < i+1 AND x1 > i. So i ranges floor(x0) .. ceil(x1)-1.
    const x0 = Math.floor(aabb.x0), y0 = Math.floor(aabb.y0), z0 = Math.floor(aabb.z0);
    const x1 = Math.ceil(aabb.x1) - 1, y1 = Math.ceil(aabb.y1) - 1, z1 = Math.ceil(aabb.z1) - 1;
    for(let y = y0; y <= y1; y++)
        for(let z = z0; z <= z1; z++)
            for(let x = x0; x <= x1; x++) {
                const block=getBlock(x,y,z),boxes=getBlockCollisionBoxes(block,x,y,z);
                if(boxesOverlapAabb(aabb,x,y,z,boxes))return true;
            }
    return false;
}

function highestSupportY(px,pz,aroundY){const hw=game.player.width/2,x0=Math.floor(px-hw),x1=Math.ceil(px+hw)-1,z0=Math.floor(pz-hw),z1=Math.ceil(pz+hw)-1;let top=-Infinity;for(let y=Math.max(0,Math.floor(aroundY)-2);y<=Math.min(CHUNK_H-1,Math.floor(aroundY)+1);y++)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)for(const box of getBlockCollisionBoxes(getBlock(x,y,z),x,y,z)){if(px+hw>x+box[0]&&px-hw<x+box[3]&&pz+hw>z+box[2]&&pz-hw<z+box[5]){const candidate=y+box[4];if(candidate<=aroundY+.3)top=Math.max(top,candidate);}}return top;}

function updatePlayer(dt) {
    if(game.inventoryOpen || game.tradeTarget || game.petPanelOpen || game.questPanelOpen || game.craftingTableOpen || game.furnaceOpen || game.chestOpen || game.controlsOverlayOpen) return;

    // Movement direction from game.keys. sin/cos already give a unit vector,
    // so the vec3_normalize / array wrappers were redundant — inline as
    // scalars to avoid per-frame allocations.
    const sy = Math.sin(game.player.yaw), cy = Math.cos(game.player.yaw);
    const fwdX = -sy, fwdZ = -cy;
    const rightX = cy, rightZ = -sy;

    let mx = 0, mz = 0;
    if(game.keys[game.keyBindings.forward]) { mx += fwdX; mz += fwdZ; }
    if(game.keys[game.keyBindings.back]) { mx -= fwdX; mz -= fwdZ; }
    if(game.keys[game.keyBindings.left]) { mx -= rightX; mz -= rightZ; }
    if(game.keys[game.keyBindings.right]) { mx += rightX; mz += rightZ; }

    const len = Math.sqrt(mx*mx + mz*mz);
    const descendKey = game.keys['ShiftLeft'] || game.keys['ShiftRight'] || game.keys['ControlLeft'] || game.keys['ControlRight'];
    let speed = 4.5;
    const wantsSprint = (game.keys['ShiftLeft'] || game.keys['ShiftRight']) && !game.flyMode;
    if(wantsSprint && (typeof canSurvivalSprint !== 'function' || canSurvivalSprint())) speed = 6.75;
    if(typeof getSurvivalMovementSpeedMultiplier === 'function') speed *= getSurvivalMovementSpeedMultiplier();
    if(hasEffect(EFFECT_SPEED)) speed *= 1.5;
    if(len > 0) {
        mx = (mx / len) * speed;
        mz = (mz / len) * speed;
    }

    if(game.flyMode) {
        const flySpeed = speed * 1.5;
        game.player.vy = 0;
        if(game.keys['Space']) game.player.vy += flySpeed;
        if(descendKey) game.player.vy -= flySpeed;
        if(game.player.vy !== 0) game.player.onGround = false;
    } else {
        // Gravity
        game.player.vy -= 20 * dt;
        if(game.player.vy < -50) game.player.vy = -50;

        // Jump
        if(game.keys['Space'] && game.player.onGround) {
            game.player.vy = hasEffect(EFFECT_JUMP) ? 12 : 8;
            game.player.onGround = false;
            if(typeof addSurvivalExertion === 'function') addSurvivalExertion(SURVIVAL_JUMP_HUNGER_COST);
        }
        const bodyBlock=getBlock(Math.floor(game.player.x),Math.floor(game.player.y+.8),Math.floor(game.player.z));
        if(bodyBlock===WAFER_LADDER){game.player.vy=Math.max(game.player.vy,(game.keys[game.keyBindings.forward]||game.keys.Space)?3:-2);game.player.onGround=false;}
    }

    // Move X with auto-step
    const newX = game.player.x + mx * dt;
    if(!aabbOverlapsSolid(playerAABB(newX, game.player.y, game.player.z))) {
        game.player.x = newX;
    } else if(game.player.onGround && !aabbOverlapsSolid(playerAABB(newX, game.player.y + 1.0, game.player.z))) {
        // Auto-step up 1 block
        game.player.x = newX;
        game.player.y += 1.0;
        game.player.onGround = false;
    }

    // Move Y
    const impactVelocity = game.player.vy;
    const verticalMotion=CandyCore.computeMotionSubsteps(0,game.player.vy*dt,0,.25);let verticalCollision=false;
    for(let step=0;step<verticalMotion.steps;step++){const candidateY=game.player.y+verticalMotion.dy;if(aabbOverlapsSolid(playerAABB(game.player.x,candidateY,game.player.z))){verticalCollision=true;break;}game.player.y=candidateY;}
    if(!verticalCollision) {
        game.player.onGround = false;
    } else {
        if(game.player.vy < 0) {
            game.player.onGround = true;
            const support=highestSupportY(game.player.x,game.player.z,game.player.y);
            if(Number.isFinite(support))game.player.y=support;
            if(impactVelocity < -11) damagePlayer(Math.floor((Math.abs(impactVelocity)-10)*.7),{type:'fall'});
        }
        game.player.vy = 0;
    }

    // Move Z with auto-step
    const newZ = game.player.z + mz * dt;
    if(!aabbOverlapsSolid(playerAABB(game.player.x, game.player.y, newZ))) {
        game.player.z = newZ;
    } else if(game.player.onGround && !aabbOverlapsSolid(playerAABB(game.player.x, game.player.y + 1.0, newZ))) {
        // Auto-step up 1 block
        game.player.z = newZ;
        game.player.y += 1.0;
        game.player.onGround = false;
    }

    // Clamp to world bounds
    game.player.x = Math.max(0.5, Math.min(WORLD_W - 0.5, game.player.x));
    game.player.z = Math.max(0.5, Math.min(WORLD_D - 0.5, game.player.z));
    if(game.player.y < 0) { game.player.y = 40; game.player.vy = 0; } // respawn if fall through world

    // Biome visit tracking for quests
    if(typeof trackBiomeVisit === 'function' && typeof getBiome === 'function') {
        var currentBiome = getBiome(Math.floor(game.player.x), Math.floor(game.player.z));
        trackBiomeVisit(currentBiome);
    }
    if(typeof trackStructureDiscovery==='function')trackStructureDiscovery();
    const savedMove=game.persistenceMovement;savedMove.elapsed+=dt;if(savedMove.elapsed>=1&&((game.player.x-savedMove.x)**2+(game.player.z-savedMove.z)**2)>=.25){savedMove.x=game.player.x;savedMove.z=game.player.z;savedMove.elapsed=0;scheduleSaveGame();}
}

// ====== INVENTORY SYSTEM ======
function initInventory() {
    game.inventory.fill(null);
    if(game.worldMode === 'survival') return;
    if(game.worldMode === 'cozy') {
        game.inventory[0]={id:ITEM_COOKIE,count:3};
        game.inventory[1]={id:WOOD,count:4};
        game.inventory[2]={id:FROSTING_WHITE,count:4};
        return;
    }
    game.inventory[0] = { id: DIRT, count: 64 };
    game.inventory[1] = { id: STONE, count: 64 };
    game.inventory[2] = { id: PLANKS, count: 32 };
    game.inventory[3] = { id: GLASS, count: 16 };
    game.inventory[4] = { id: CRAFTING_TABLE, count: 1 };
    game.inventory[5] = { id: CANDY_CANE_PILLAR, count: 32 };
    game.inventory[6] = { id: FROSTING_PINK, count: 32 };
    game.inventory[7] = { id: LEAVES, count: 32 };
    game.inventory[8] = { id: WOOD, count: 32 };
    if(game.worldMode === 'creative') { game.creativeMode=true; populateCreativeInventory(); game.flyMode=true; }
}

function addItem(id, count) {
    if(!canAddItem(id, count)) return false;

    const maxStack = getItemMaxStack(id);
    // Try to stack with existing (tools don't stack)
    if (maxStack > 1) {
        for(let i = 0; i < 36; i++) {
            if(game.inventory[i] && game.inventory[i].id === id && game.inventory[i].count < maxStack) {
                const space = maxStack - game.inventory[i].count;
                const add = Math.min(count, space);
                game.inventory[i].count += add;
                count -= add;
                if(count <= 0) {
                    if(typeof scheduleSaveGame === 'function') scheduleSaveGame();
                    if(typeof updateRecipeGuideUI === 'function') updateRecipeGuideUI();
                    return true;
                }
            }
        }
    }
    // Find empty slot
    for(let i = 0; i < 36; i++) {
        if(!game.inventory[i]) {
            const add = Math.min(count, maxStack);
            game.inventory[i] = { id, count: add };
            count -= add;
            if(count <= 0) {
                if(typeof scheduleSaveGame === 'function') scheduleSaveGame();
                if(typeof updateRecipeGuideUI === 'function') updateRecipeGuideUI();
                return true;
            }
        }
    }
    return false; // unreachable given canAddItem above
}

function canAddItem(id, count) {
    return canAddItemToSlots(game.inventory, id, count);
}

function canAddItemAfterRemoving(id, count, removals) {
    const slots = game.inventory.map(slot => slot ? { id: slot.id, count: slot.count } : null);
    for(const removal of removals) {
        if(!removeItemFromSlots(slots, removal.id, removal.count)) return false;
    }
    return canAddItemToSlots(slots, id, count);
}

function removeItemFromSlots(slots, id, count) {
    let remaining = count;
    for(let i = 0; i < slots.length; i++) {
        if(slots[i] && slots[i].id === id) {
            const take = Math.min(remaining, slots[i].count);
            slots[i].count -= take;
            if(slots[i].count <= 0) slots[i] = null;
            remaining -= take;
            if(remaining <= 0) return true;
        }
    }
    return remaining <= 0;
}

function canAddItemToSlots(slots, id, count) {
    let remaining = count;
    const maxStack = getItemMaxStack(id);

    if(maxStack > 1) {
        for(let i = 0; i < slots.length; i++) {
            if(slots[i] && slots[i].id === id && slots[i].count < maxStack) {
                remaining -= Math.min(remaining, maxStack - slots[i].count);
                if(remaining <= 0) return true;
            }
        }
    }

    for(let i = 0; i < slots.length; i++) {
        if(!slots[i]) {
            remaining -= Math.min(remaining, maxStack);
            if(remaining <= 0) return true;
        }
    }

    return remaining <= 0;
}

function removeFromSlot(slot) {
    if(!game.inventory[slot]) return;
    game.inventory[slot].count--;
    if(game.inventory[slot].count <= 0) game.inventory[slot] = null;
    if(typeof scheduleSaveGame === 'function') scheduleSaveGame();
    if(typeof updateRecipeGuideUI === 'function') updateRecipeGuideUI();
    // Try to deliver any pending quest rewards that now fit
    if(typeof tryGrantPendingRewards === 'function') tryGrantPendingRewards();
}

let cursorStackX = window.innerWidth * 0.5;
let cursorStackY = window.innerHeight * 0.5;
const inventoryDrag={active:false,indices:new Set(),suppressClick:false};
document.addEventListener('mouseup',()=>{if(!inventoryDrag.active)return;inventoryDrag.active=false;if(inventoryDrag.indices.size>1&&game.cursorStack){const result=CandyCore.distributeStack(game.inventory,game.cursorStack,[...inventoryDrag.indices],getItemMaxStack);game.inventory=result.slots;game.cursorStack=result.cursor;inventoryDrag.suppressClick=result.moved>0;if(result.moved){updateInventoryUI();updateHotbar();scheduleSaveGame();}}inventoryDrag.indices.clear();});

function updateCursorStackPosition(x, y) {
    cursorStackX = x;
    cursorStackY = y;
    const cursor = document.getElementById('cursor-stack');
    if(cursor) {
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
    }
    updateCursorStackUI();
}

function updateCursorStackUI() {
    const cursor = document.getElementById('cursor-stack');
    if(!cursor) return;

    cursor.innerHTML = '';
    if((!game.inventoryOpen && !game.craftingTableOpen && !game.furnaceOpen && !game.chestOpen) || !game.cursorStack) {
        cursor.style.display = 'none';
        return;
    }

    const icon = document.createElement('div');
    icon.className = 'slot-icon';
    setItemIcon(icon, game.cursorStack.id);
    icon.title = BLOCK_NAMES[game.cursorStack.id] || '';
    cursor.appendChild(icon);

    if(game.cursorStack.count > 1) {
        const cnt = document.createElement('div');
        cnt.className = 'slot-count';
        cnt.textContent = game.cursorStack.count;
        cursor.appendChild(cnt);
    }

    cursor.style.display = 'flex';
    cursor.style.left = cursorStackX + 'px';
    cursor.style.top = cursorStackY + 'px';
}

// ====== HUD RENDERING ======
function appendDurabilityBar(container,slot){if(!slot||!isToolItem(slot.id))return;const max=getToolMaxDurability(slot.id),value=Number.isFinite(slot.durability)?slot.durability:max,bar=document.createElement('span');bar.className='durability-bar';bar.style.setProperty('--durability',String(value/max));bar.title=value+' / '+max+' durability';container.appendChild(bar);}
function updateHotbar() {
    const hotbar = document.getElementById('hotbar');
    hotbar.innerHTML = '';
    for(let i = 0; i < 9; i++) {
        const slot = document.createElement('div');
        slot.className = 'hotbar-slot' + (i === game.selectedSlot ? ' selected' : '');
        const num = document.createElement('div');
        num.className = 'slot-number';
        num.textContent = i + 1;
        slot.appendChild(num);
        if(game.inventory[i]) {
            const icon = document.createElement('div');
            icon.className = 'slot-icon';
            setItemIcon(icon, game.inventory[i].id);
            slot.appendChild(icon);
            if(game.inventory[i].count > 1) {
                const cnt = document.createElement('div');
                cnt.className = 'slot-count';
                cnt.textContent = game.inventory[i].count;
                slot.appendChild(cnt);
            }
            appendDurabilityBar(slot,game.inventory[i]);
        }
        slot.addEventListener('click', () => {
            game.selectedSlot = i;
            updateHotbar();
            if(typeof scheduleSaveGame === 'function') scheduleSaveGame();
        });
        hotbar.appendChild(slot);
    }
    if(typeof updateRecipeGuideUI === 'function') updateRecipeGuideUI();
    updateHeldItemUI();
}

function updateHeldItemUI() {
    const item = game.inventory[game.selectedSlot];
    const id = item ? item.id : null;
    const icon = document.getElementById('held-item-icon');
    const name = document.getElementById('selected-item-name');
    if(icon) {
        if(id == null) {
            icon.style.backgroundImage = 'none';
            icon.style.backgroundColor = 'transparent';
            icon.classList.add('empty');
        } else {
            icon.classList.remove('empty');
            setItemIcon(icon, id);
        }
    }
    if(id !== game.presentation.heldItemId) {
        game.presentation.heldItemId = id;
        game.presentation.labelUntil = performance.now() + 1600;
        if(name) name.textContent = id == null ? 'Empty hands' : (BLOCK_NAMES[id] || 'Unknown item');
    }
}

function playViewAction(action, duration) {
    if((action==='mine'||action==='attack')&&(game.presentation.action!==action||game.presentation.actionTime<=.04))CandyEvents.emit('toolSwing',{action,position:{x:game.player.x,y:game.player.y+1,z:game.player.z}});
    game.presentation.action = action || 'interact';
    game.presentation.actionTime = Math.max(game.presentation.actionTime, duration || 0.3);
}

function updateFirstPersonPresentation(dt) {
    const p = game.presentation;
    const dx = game.player.x - p.prevX, dz = game.player.z - p.prevZ;
    const speed = Math.min(8, Math.sqrt(dx*dx + dz*dz) / Math.max(0.001, dt));
    p.prevX = game.player.x; p.prevZ = game.player.z;
    if(speed > 0.08 && game.player.onGround) p.bobPhase += dt * (7 + speed * 0.75);
    if(speed>.3&&game.player.onGround){p.stepDistance+=speed*dt;const interval=speed>5.2?1.45:1.8;if(p.stepDistance>=interval){p.stepDistance%=interval;CandyEvents.emit('footstep',{blockId:getBlock(Math.floor(game.player.x),Math.max(0,Math.floor(game.player.y)-1),Math.floor(game.player.z)),position:{x:game.player.x,y:game.player.y,z:game.player.z}});}}else if(!game.player.onGround)p.stepDistance=0;
    const motion = game.settings.reducedMotion ? 0 : game.settings.viewBob;
    const targetBobX = Math.cos(p.bobPhase) * Math.min(1, speed/5) * 0.018 * motion;
    const targetBobY = Math.abs(Math.sin(p.bobPhase)) * Math.min(1, speed/5) * 0.025 * motion;
    p.bobX += (targetBobX - p.bobX) * Math.min(1, dt*12);
    p.bobY += (targetBobY - p.bobY) * Math.min(1, dt*12);
    if(!p.wasGrounded && game.player.onGround && p.previousYVelocity < -5) {
        p.landingDip = Math.min(0.1, Math.abs(p.previousYVelocity) * 0.006) * (game.settings.reducedMotion?0:game.settings.cameraShake);
        playViewAction('land', 0.22);
    }
    p.landingDip += (0 - p.landingDip) * Math.min(1, dt*11);
    p.wasGrounded = game.player.onGround;
    p.previousYVelocity = game.player.vy;
    p.actionTime = Math.max(0, p.actionTime-dt);
    if(p.actionTime === 0) p.action = 'idle';

    const sprinting = speed > 5.2 && game.player.onGround;
    const targetFov = game.settings.fov + (sprinting && !game.settings.reducedMotion ? 6 : 0);
    p.currentFov += (targetFov-p.currentFov) * Math.min(1,dt*7);
    game.projMatrix = mat4_perspective(Math.PI/180*p.currentFov, game.canvas.width/game.canvas.height,0.1,200);

    const held = document.getElementById('held-item');
    const blocked = isGameplayInputBlocked() || !game.worldLoaded || !game.pointerLocked;
    if(held) {
        held.hidden = blocked;
        const actionProgress = p.actionTime > 0 ? Math.sin(Math.min(1,p.actionTime/0.3)*Math.PI) : 0;
        const swing = (p.action === 'mine' || p.action === 'place' || p.action === 'attack') ? actionProgress : 0;
        const eat = p.action === 'eat' ? actionProgress : 0;
        held.style.transform = `translate3d(${p.bobX*420-swing*45}px,${p.bobY*220+p.landingDip*240-eat*55}px,0) rotate(${swing*28-eat*12}deg)`;
    }
    const label = document.getElementById('selected-item-name');
    if(label) label.classList.toggle('visible', performance.now() < p.labelUntil && !blocked);
    return {x:p.bobX,y:p.bobY+p.landingDip};
}

function updateHearts() {
    const div = document.getElementById('hearts');
    div.innerHTML = '';
    for(let i = 0; i < 10; i++) {
        const h = document.createElement('span');
        h.className = 'heart ' + (i < Math.ceil(game.playerHealth / 2) ? 'full' : 'empty');
        div.appendChild(h);
    }
    div.setAttribute('aria-label', 'Health ' + Math.ceil(game.playerHealth) + ' of 20');
}

function updateHunger() {
    const div = document.getElementById('hunger');
    div.innerHTML = '';
    for(let i = 0; i < 10; i++) {
        const c = document.createElement('span');
        c.className = 'cupcake ' + (i < Math.ceil(game.playerHunger / 2) ? 'full' : 'empty');
        div.appendChild(c);
    }
    div.setAttribute('aria-label', 'Hunger ' + Math.ceil(game.playerHunger) + ' of 20');
}

function updateInventoryUI() {
    const grid = document.getElementById('inv-grid');
    grid.innerHTML = '';
    const creativeTools=document.getElementById('creative-inventory-tools');creativeTools.hidden=!game.creativeMode;const search=document.getElementById('creative-search').value.trim().toLowerCase(),category=document.getElementById('creative-category').value;
    const slotCount = game.inventory.length;
    for(let i = 0; i < slotCount; i++) {
        const candidate=game.inventory[i];if(game.creativeMode&&candidate){const name=(BLOCK_NAMES[candidate.id]||'').toLowerCase(),matchesCategory=category==='all'||category==='blocks'&&candidate.id<=LAST_BLOCK||category==='tools'&&isToolItem(candidate.id)||category==='food'&&isTreatItem(candidate.id)||category==='materials'&&candidate.id>LAST_BLOCK&&!isToolItem(candidate.id)&&!isTreatItem(candidate.id);if(search&&!name.includes(search)||!matchesCategory)continue;}
        const slot = document.createElement('button');slot.type='button';slot.setAttribute('role','gridcell');slot.setAttribute('aria-label','Inventory slot '+(i+1)+(game.inventory[i]?' '+game.inventory[i].count+' '+BLOCK_NAMES[game.inventory[i].id]:' empty'));
        slot.className = 'inv-slot';
        slot.dataset.slot = i;
        if(game.inventory[i]) {
            const icon = document.createElement('div');
            icon.className = 'slot-icon';
            setItemIcon(icon, game.inventory[i].id);
            icon.title = BLOCK_NAMES[game.inventory[i].id] || '';
            slot.appendChild(icon);
            if(game.inventory[i].count > 1) {
                const cnt = document.createElement('div');
                cnt.className = 'slot-count';
                cnt.textContent = game.inventory[i].count;
                slot.appendChild(cnt);
            }
            appendDurabilityBar(slot,game.inventory[i]);
        }
        slot.addEventListener('click', (event) => {
            // Click handling for game.inventory
            const slotIdx = parseInt(slot.dataset.slot);
            if(inventoryDrag.suppressClick){inventoryDrag.suppressClick=false;event.preventDefault();return;}
            if(event.shiftKey&&game.inventory[slotIdx]){if(game.chestOpen&&game.chestPos){const chest=getChestState(game.chestPos),moved=CandyCore.transferBetween(game.inventory,chest.slots,slotIdx,getItemMaxStack);if(moved.ok){game.inventory=moved.source;chest.slots=moved.destination;renderChestUI();}}else{const destinations=slotIdx<9?Array.from({length:27},(_,n)=>n+9):Array.from({length:9},(_,n)=>n),moved=CandyCore.transferStack(game.inventory,slotIdx,destinations,getItemMaxStack);if(moved.ok)game.inventory=moved.slots;}updateInventoryUI();updateHotbar();scheduleSaveGame();return;}
            if(game.cursorStack === null) {
                if(game.inventory[slotIdx]) {
                    game.cursorStack = game.inventory[slotIdx];
                    game.inventory[slotIdx] = null;
                }
            } else {
                if(!game.inventory[slotIdx]) {
                    game.inventory[slotIdx] = game.cursorStack;
                    game.cursorStack = null;
                } else if(game.inventory[slotIdx].id === game.cursorStack.id) {
                    const maxSt = getItemMaxStack(game.inventory[slotIdx].id);
                    const space = maxSt - game.inventory[slotIdx].count;
                    const add = Math.min(game.cursorStack.count, space);
                    game.inventory[slotIdx].count += add;
                    game.cursorStack.count -= add;
                    if(game.cursorStack.count <= 0) game.cursorStack = null;
                } else {
                    // Swap
                    const tmp = game.inventory[slotIdx];
                    game.inventory[slotIdx] = game.cursorStack;
                    game.cursorStack = tmp;
                }
            }
            updateInventoryUI();
            if(game.inventoryOpen && typeof updateCraftingUI === 'function') updateCraftingUI();
            updateHotbar();
            if(typeof scheduleSaveGame === 'function') scheduleSaveGame();
        });
        slot.addEventListener('mousedown',event=>{if(event.button===0&&game.cursorStack){inventoryDrag.active=true;inventoryDrag.indices.clear();inventoryDrag.indices.add(Number(slot.dataset.slot));event.preventDefault();}});slot.addEventListener('mouseenter',()=>{if(inventoryDrag.active)inventoryDrag.indices.add(Number(slot.dataset.slot));});
        slot.addEventListener('contextmenu',event=>{event.preventDefault();const slotIdx=Number(slot.dataset.slot),held=game.inventory[slotIdx];if(!game.cursorStack&&held){const split=CandyCore.splitStack(held);game.cursorStack=split.cursor;game.inventory[slotIdx]=split.slot;}else if(game.cursorStack){if(!held){game.inventory[slotIdx]={id:game.cursorStack.id,count:1};game.cursorStack.count--;}else if(held.id===game.cursorStack.id&&held.count<getItemMaxStack(held.id)){held.count++;game.cursorStack.count--;}if(game.cursorStack.count<=0)game.cursorStack=null;}updateInventoryUI();updateHotbar();scheduleSaveGame();});
        slot.addEventListener('dblclick',()=>{const held=game.inventory[i];if(!held)return;const max=getItemMaxStack(held.id);for(let j=0;j<game.inventory.length&&held.count<max;j++){if(j===i||!game.inventory[j]||game.inventory[j].id!==held.id)continue;const take=Math.min(max-held.count,game.inventory[j].count);held.count+=take;game.inventory[j].count-=take;if(game.inventory[j].count===0)game.inventory[j]=null;}updateInventoryUI();updateHotbar();scheduleSaveGame();});
        grid.appendChild(slot);
    }
    updateCursorStackUI();
}
document.getElementById('creative-search').addEventListener('input',updateInventoryUI);document.getElementById('creative-category').addEventListener('change',updateInventoryUI);

// ====== CREATIVE MODE SYSTEM ======
function toggleCreativeMode() {
    if (game.creativeMode) {
        // Switch back to Survival: restore saved game.inventory
        game.creativeMode = false;
        restoreSurvivalInventory();
    } else {
        // Switch to Creative: save current game.inventory, populate with all items
        game.creativeMode = true;
        // Deep copy current game.inventory
        for (let i = 0; i < 36; i++) {
            game.survivalInventory[i] = game.inventory[i] ? { id: game.inventory[i].id, count: game.inventory[i].count } : null;
        }
        populateCreativeInventory();
    }
    updateModeIndicator();
    updateHotbar();
    if (typeof scheduleSaveGame === 'function') scheduleSaveGame();
    // Quest hook: creative toggle
    CandyEvents.emit('creativeToggled',{enabled:game.creativeMode});
}

function populateCreativeInventory() {
    // Count all creative items to determine game.inventory size
    let creativeItems = [];
    // Add all blocks (IDs 1-32, excluding AIR=0 and WATER=5)
    for (let id = 1; id <= LAST_BLOCK; id++) {
        if (id === 5) continue; // Skip WATER (AIR=0 is already outside the loop range)
        if (!BLOCK_TILES[id]) continue; // Skip blocks without tiles
        creativeItems.push({ id: id, count: 64 });
    }
    // Add all non-block items (IDs 100+) that have names/colors defined
    for (let id = 100; id < 200; id++) {
        if (!BLOCK_NAMES[id] && !BLOCK_COLORS[id]) continue; // Skip undefined items
        const maxStack = getItemMaxStack(id);
        creativeItems.push({ id: id, count: maxStack });
    }
    // Expand game.inventory array to fit all creative items
    const newSize = Math.max(36, creativeItems.length);
    game.inventory.length = newSize;
    for (let i = 0; i < newSize; i++) {
        game.inventory[i] = i < creativeItems.length ? { id: creativeItems[i].id, count: creativeItems[i].count } : null;
    }
}

function restoreSurvivalInventory() {
    // Shrink game.inventory back to 36 slots and restore survival items
    game.inventory.length = 36;
    for (let i = 0; i < 36; i++) {
        game.inventory[i] = game.survivalInventory[i] ? { id: game.survivalInventory[i].id, count: game.survivalInventory[i].count } : null;
    }
    // Clear the backup
    for (let i = 0; i < 36; i++) game.survivalInventory[i] = null;
}

function updateModeIndicator() {
    const indicator = document.getElementById('mode-indicator');
    if (indicator) {
        indicator.textContent = game.creativeMode ? 'Creative' : 'Survival';
        indicator.className = 'mode-indicator ' + (game.creativeMode ? 'creative' : 'survival');
    }
    const btn = document.getElementById('creative-toggle');
    if (btn) {
        btn.textContent = game.creativeMode ? 'CREATIVE' : 'SURVIVAL';
    }
}

// Creative toggle button click handler
const creativeToggleBtn = document.getElementById('creative-toggle');
if(creativeToggleBtn) {
    creativeToggleBtn.addEventListener('click', function() {
        showQuestNotification('World rules are chosen when the world is created.');
    });
}

function toggleInventory() {
    // Close station UIs if open
    if(game.craftingTableOpen) { closeCraftingTableUI(); return; }
    if(game.furnaceOpen) { closeFurnaceUI(); return; }
    // Close trade panel if open
    if (game.tradeTarget) { closeTradePanel(); return; }
    // Close quest panel if open
    if (typeof game.questPanelOpen !== 'undefined' && game.questPanelOpen) { toggleQuestPanel(); return; }
    game.inventoryOpen = !game.inventoryOpen;
    const overlay = document.getElementById('inventory-overlay');
    overlay.style.display = game.inventoryOpen ? 'flex' : 'none';
    if(game.inventoryOpen) {
        if(typeof exitGamePointerLock === 'function') exitGamePointerLock();
        else if(document.exitPointerLock) document.exitPointerLock();
        updateInventoryUI();
        updateCraftingUI();
    } else {
        returnCraftGrid('crafting');
        if(game.cursorStack) {
            addItem(game.cursorStack.id, game.cursorStack.count);
            game.cursorStack = null;
            updateHotbar();
        }
        updateCursorStackUI();
        // Try to deliver any pending quest rewards now that game.inventory may have space
        if(typeof tryGrantPendingRewards === 'function') tryGrantPendingRewards();
        if(typeof requestGamePointerLock === 'function') requestGamePointerLock();
        else if(game.canvas.requestPointerLock) game.canvas.requestPointerLock();
    }
}

// ====== CRAFTING TABLE UI ======
function openCraftingTableUI(bx, by, bz) {
    // Close any other open UIs first
    if(game.inventoryOpen) {
        returnCraftGrid('crafting');
        game.inventoryOpen = false;
        document.getElementById('inventory-overlay').style.display = 'none';
        if(game.cursorStack) { addItem(game.cursorStack.id, game.cursorStack.count); game.cursorStack = null; }
        updateCursorStackUI();
    }
    if(game.furnaceOpen) closeFurnaceUI();
    if(game.tradeTarget) closeTradePanel();
    if(game.petPanelOpen) togglePetPanel();
    if(game.questPanelOpen) toggleQuestPanel();

    game.craftingTableOpen = true;
    game.craftingTablePos = { x: bx, y: by, z: bz };
    if(typeof exitGamePointerLock === 'function') exitGamePointerLock();
    else if(document.exitPointerLock) document.exitPointerLock();
    document.getElementById('crafting-table-overlay').style.display = 'flex';
    if(typeof updateCraftingTableUI === 'function') updateCraftingTableUI();
}

function closeCraftingTableUI() {
    returnCraftGrid('table');
    game.craftingTableOpen = false;
    game.craftingTablePos = null;
    document.getElementById('crafting-table-overlay').style.display = 'none';
    if(typeof requestGamePointerLock === 'function') requestGamePointerLock();
    else if(game.canvas.requestPointerLock) game.canvas.requestPointerLock();
}

// ====== FURNACE UI ======
function openFurnaceUI(bx, by, bz) {
    // Close any other open UIs first
    if(game.inventoryOpen) {
        returnCraftGrid('crafting');
        game.inventoryOpen = false;
        document.getElementById('inventory-overlay').style.display = 'none';
        if(game.cursorStack) { addItem(game.cursorStack.id, game.cursorStack.count); game.cursorStack = null; }
        updateCursorStackUI();
    }
    if(game.craftingTableOpen) closeCraftingTableUI();
    if(game.tradeTarget) closeTradePanel();
    if(game.petPanelOpen) togglePetPanel();
    if(game.questPanelOpen) toggleQuestPanel();

    game.furnaceOpen = true;
    game.furnacePos = { x: bx, y: by, z: bz };
    if(typeof exitGamePointerLock === 'function') exitGamePointerLock();
    else if(document.exitPointerLock) document.exitPointerLock();
    document.getElementById('furnace-overlay').style.display = 'flex';
    const ovenState=getOvenState(game.furnacePos,true);
    applyOvenOfflineProgress(game.furnacePos,ovenState);
    if(typeof updateFurnaceUI === 'function') updateFurnaceUI();
}

function closeFurnaceUI() {
    if(game.cursorStack){if(!addItem(game.cursorStack.id,game.cursorStack.count))spawnItemDrop(game.cursorStack.id,game.cursorStack.count,game.player.x,game.player.y+1,game.player.z);game.cursorStack=null;}
    game.furnaceOpen = false;
    game.furnacePos = null;
    document.getElementById('furnace-overlay').style.display = 'none';
    updateCursorStackUI();
    if(typeof requestGamePointerLock === 'function') requestGamePointerLock();
    else if(game.canvas.requestPointerLock) game.canvas.requestPointerLock();
}

// Close button listeners for station UIs
const craftingTableCloseBtn = document.getElementById('crafting-table-close');
if(craftingTableCloseBtn) {
    craftingTableCloseBtn.addEventListener('click', function() {
        if(game.craftingTableOpen) closeCraftingTableUI();
    });
}
const furnaceCloseBtn = document.getElementById('furnace-close');
if(furnaceCloseBtn) {
    furnaceCloseBtn.addEventListener('click', function() {
        if(game.furnaceOpen) closeFurnaceUI();
    });
}
