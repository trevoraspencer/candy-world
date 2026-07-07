'use strict';

// ====== DAY/NIGHT CYCLE (Wave 3) ======
const DAY_CYCLE_LENGTH = 600;

function lerp(a, b, t) { return a + (b - a) * t; }

function updateDayNight(dt) {
    game.dayTime = (game.dayTime + dt) % DAY_CYCLE_LENGTH;
    const t = game.dayTime / DAY_CYCLE_LENGTH;

    // Daylight intensity
    if (t < 0.2) { game.daylight = 0.35 + (t / 0.2) * 0.65; }
    else if (t < 0.45) { game.daylight = 1.0; }
    else if (t < 0.55) { game.daylight = 1.0 - ((t - 0.45) / 0.1) * 0.65; }
    else if (t < 0.9) { game.daylight = 0.35; }
    else { game.daylight = 0.35 + ((t - 0.9) / 0.1) * 0.65; }

    // Sky color: dawn warm pink, day light pink, dusk deeper pink, night dark magenta
    const sc = [
        [1.0, 0.69, 0.75], [1.0, 0.82, 0.86],
        [1.0, 0.56, 0.67], [0.29, 0.0, 0.16]
    ];
    if (t < 0.15) {
        const f = t / 0.15;
        game.skyR = lerp(sc[0][0], sc[1][0], f); game.skyG = lerp(sc[0][1], sc[1][1], f); game.skyB = lerp(sc[0][2], sc[1][2], f);
    } else if (t < 0.45) {
        game.skyR = sc[1][0]; game.skyG = sc[1][1]; game.skyB = sc[1][2];
    } else if (t < 0.55) {
        const f = (t - 0.45) / 0.1;
        game.skyR = lerp(sc[1][0], sc[2][0], f); game.skyG = lerp(sc[1][1], sc[2][1], f); game.skyB = lerp(sc[1][2], sc[2][2], f);
    } else if (t < 0.65) {
        const f = (t - 0.55) / 0.1;
        game.skyR = lerp(sc[2][0], sc[3][0], f); game.skyG = lerp(sc[2][1], sc[3][1], f); game.skyB = lerp(sc[2][2], sc[3][2], f);
    } else if (t < 0.9) {
        game.skyR = sc[3][0]; game.skyG = sc[3][1]; game.skyB = sc[3][2];
    } else {
        const f = (t - 0.9) / 0.1;
        game.skyR = lerp(sc[3][0], sc[0][0], f); game.skyG = lerp(sc[3][1], sc[0][1], f); game.skyB = lerp(sc[3][2], sc[0][2], f);
    }
    game.gl.clearColor(game.skyR, game.skyG, game.skyB, 1.0);
}

// ====== EFFECTS SYSTEM (Wave 3) ======
// game.activeEffects is now game.activeEffects (initialized in state.js)
const EFFECT_SPEED = 'speed';
const EFFECT_SPARKLE = 'sparkle';
const EFFECT_JUMP = 'jump';

const SURVIVAL_LOW_ENERGY_HUNGER = 6;
const SURVIVAL_WELL_FED_HUNGER = 18;
const SURVIVAL_MIN_HEALTH = 6;
const SURVIVAL_WALK_HUNGER_DRAIN = 0.018;
const SURVIVAL_SPRINT_HUNGER_DRAIN = 0.035;
const SURVIVAL_MINING_HUNGER_DRAIN = 0.025;
const SURVIVAL_JUMP_HUNGER_COST = 0.18;
const SURVIVAL_HEAL_INTERVAL = 7;
const SURVIVAL_CRASH_INTERVAL = 8;
const SURVIVAL_NOTICE_INTERVAL = 14;

function addEffect(type, duration) {
    const idx = game.activeEffects.findIndex(e => e.type === type);
    if (idx >= 0) game.activeEffects.splice(idx, 1);
    game.activeEffects.push({ type, timeRemaining: duration, duration });
}

function hasEffect(type) {
    return game.activeEffects.some(e => e.type === type);
}

// ====== GENTLE SURVIVAL LOOP ======
function clampPlayerMeter(value) {
    return Math.max(0, Math.min(20, value));
}

function showSurvivalNotice(message) {
    if (game.survival.noticeCooldown > 0) return;
    if (typeof showQuestNotification === 'function') showQuestNotification(message);
    game.survival.noticeCooldown = SURVIVAL_NOTICE_INTERVAL;
}

function setPlayerHealth(value) {
    const next = clampPlayerMeter(value);
    if (Math.abs(next - game.playerHealth) < 0.001) return false;
    game.playerHealth = next;
    if (typeof updateHearts === 'function') updateHearts();
    if (typeof scheduleSaveGame === 'function') scheduleSaveGame();
    return true;
}

function setPlayerHunger(value) {
    const previous = game.playerHunger;
    const next = clampPlayerMeter(value);
    if (Math.abs(next - previous) < 0.001) return false;

    game.playerHunger = next;
    if (typeof updateHunger === 'function') updateHunger();
    if (typeof scheduleSaveGame === 'function') scheduleSaveGame();

    if (!game.creativeMode && previous > SURVIVAL_LOW_ENERGY_HUNGER && next <= SURVIVAL_LOW_ENERGY_HUNGER && next > 0) {
        showSurvivalNotice('Energy is getting low. A treat will help!');
    } else if (!game.creativeMode && previous > 0 && next <= 0) {
        showSurvivalNotice('Sugar crash! Find a treat to bounce back.');
    }
    return true;
}

function restorePlayerHealth(amount) {
    setPlayerHealth(game.playerHealth + amount);
}

function restorePlayerHunger(amount) {
    game.survival.hungerDrain = 0;
    setPlayerHunger(game.playerHunger + amount);
}

function isSurvivalMeterActive() {
    return game.worldLoaded && !game.creativeMode && !game.flyMode;
}

function isGameplayInputBlocked() {
    return game.inventoryOpen || game.tradeTarget || game.petPanelOpen || game.questPanelOpen ||
        game.craftingTableOpen || game.furnaceOpen || game.controlsOverlayOpen;
}

function consumePlayerHunger(amount) {
    if (!isSurvivalMeterActive() || amount <= 0 || game.playerHunger <= 0) return;
    game.survival.hungerDrain += amount;
    if (game.survival.hungerDrain < 1) return;

    const hungerLost = Math.floor(game.survival.hungerDrain);
    game.survival.hungerDrain -= hungerLost;
    setPlayerHunger(game.playerHunger - hungerLost);
}

function addSurvivalExertion(amount) {
    consumePlayerHunger(amount);
}

function canSurvivalSprint() {
    return game.creativeMode || game.flyMode || game.playerHunger > SURVIVAL_LOW_ENERGY_HUNGER;
}

function getSurvivalMovementSpeedMultiplier() {
    if (game.creativeMode || game.flyMode) return 1;
    if (game.playerHunger <= 0) return 0.8;
    if (game.playerHunger <= SURVIVAL_LOW_ENERGY_HUNGER) return 0.92;
    return 1;
}

function updateSurvival(dt) {
    if (!game.worldLoaded) return;

    game.survival.noticeCooldown = Math.max(0, game.survival.noticeCooldown - dt);

    if (!isSurvivalMeterActive()) {
        game.survival.regenTimer = 0;
        game.survival.crashTimer = 0;
        return;
    }

    if (isGameplayInputBlocked()) return;

    const moving = game.keys['KeyW'] || game.keys['ArrowUp'] ||
        game.keys['KeyS'] || game.keys['ArrowDown'] ||
        game.keys['KeyA'] || game.keys['ArrowLeft'] ||
        game.keys['KeyD'] || game.keys['ArrowRight'];
    const sprinting = moving && canSurvivalSprint() && (game.keys['ShiftLeft'] || game.keys['ShiftRight']);
    const mining = (game.miningKeyHeld || (game.mouseDown[0] && game.pointerLocked)) && game.targetBlock;

    let drain = 0;
    if (moving) drain += SURVIVAL_WALK_HUNGER_DRAIN;
    if (sprinting) drain += SURVIVAL_SPRINT_HUNGER_DRAIN;
    if (mining) drain += SURVIVAL_MINING_HUNGER_DRAIN;
    consumePlayerHunger(drain * dt);

    if (game.playerHunger >= SURVIVAL_WELL_FED_HUNGER && game.playerHealth < 20) {
        game.survival.regenTimer += dt;
        if (game.survival.regenTimer >= SURVIVAL_HEAL_INTERVAL) {
            game.survival.regenTimer = 0;
            restorePlayerHealth(1);
        }
    } else {
        game.survival.regenTimer = 0;
    }

    if (game.playerHunger <= 0 && game.playerHealth > SURVIVAL_MIN_HEALTH) {
        game.survival.crashTimer += dt;
        if (game.survival.crashTimer >= SURVIVAL_CRASH_INTERVAL) {
            game.survival.crashTimer = 0;
            setPlayerHealth(Math.max(SURVIVAL_MIN_HEALTH, game.playerHealth - 1));
            showSurvivalNotice('Sugar crash! Find a treat to bounce back.');
        }
    } else {
        game.survival.crashTimer = 0;
    }
}

// ====== PARTICLE SYSTEM (Wave 3) ======
// game.particles is now game.particles (initialized in state.js)
const MAX_PARTICLES = 200;
let particleVAO = null, particleVBO = null;
// 4 vertices per particle (two crossed segments) * 3 floats = 12.
const particleVertBuffer = new Float32Array(MAX_PARTICLES * 12);

function spawnParticle(x, y, z, vx, vy, vz, color, life) {
    if (game.particles.length >= MAX_PARTICLES) game.particles.shift();
    game.particles.push({x, y, z, vx, vy, vz, color, life, maxLife: life});
}

function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy -= 3 * dt;
        p.life -= dt;
        if (p.life <= 0) game.particles.splice(i, 1);
    }
}

function updateEffects(dt) {
    updateSurvival(dt);

    for (let i = game.activeEffects.length - 1; i >= 0; i--) {
        game.activeEffects[i].timeRemaining -= dt;
        if (game.activeEffects[i].timeRemaining <= 0) game.activeEffects.splice(i, 1);
    }
    // Sparkle effect game.particles around game.player
    if (hasEffect(EFFECT_SPARKLE) && Math.random() < 0.3) {
        spawnParticle(
            game.player.x + (Math.random()-0.5)*2, game.player.y + Math.random()*1.8, game.player.z + (Math.random()-0.5)*2,
            (Math.random()-0.5)*0.5, Math.random()*2, (Math.random()-0.5)*0.5,
            [1.0, 0.7, 0.85, 1.0], 1.0 + Math.random()
        );
    }
    // Ambient game.particles near game.mobs
    for (const mob of game.mobs) {
        if (mob.baby && Math.random() < 0.02) {
            spawnParticle(mob.x+(Math.random()-0.5), mob.y+0.8, mob.z+(Math.random()-0.5),
                0, 1.0, 0, [1.0, 0.08, 0.58, 1.0], 1.5);
        }
        if (mob.type === MOB_UNICORN && Math.random() < 0.05) {
            spawnParticle(
                mob.x+(Math.random()-0.5)*1.5, mob.y+0.5+Math.random(), mob.z+(Math.random()-0.5)*1.5,
                (Math.random()-0.5), Math.random()*1.5, (Math.random()-0.5),
                [1.0, 1.0, 0.8, 1.0], 1.0 + Math.random()
            );
        }
    }
    updateParticles(dt);
}

function renderParticles(vp) {
    if (game.particles.length === 0) return;
    const buf = particleVertBuffer;
    let off = 0;
    for (const p of game.particles) {
        const dx = p.x - game.player.x, dz = p.z - game.player.z;
        if (dx*dx + dz*dz > 50*50) continue;
        const s = 0.05 * (p.life / p.maxLife);
        buf[off++] = p.x - s; buf[off++] = p.y;     buf[off++] = p.z;
        buf[off++] = p.x + s; buf[off++] = p.y;     buf[off++] = p.z;
        buf[off++] = p.x;     buf[off++] = p.y - s; buf[off++] = p.z;
        buf[off++] = p.x;     buf[off++] = p.y + s; buf[off++] = p.z;
    }
    if (off === 0) return;

    game.gl.useProgram(game.lineProgram);
    game.gl.uniformMatrix4fv(lUni.uVP, false, vp);
    game.gl.uniform4f(lUni.uColor, 1.0, 0.41, 0.71, 0.8);

    if (!particleVAO) {
        particleVAO = game.gl.createVertexArray();
        particleVBO = game.gl.createBuffer();
        game.gl.bindVertexArray(particleVAO);
        game.gl.bindBuffer(game.gl.ARRAY_BUFFER, particleVBO);
        game.gl.enableVertexAttribArray(lAPos);
        game.gl.vertexAttribPointer(lAPos, 3, game.gl.FLOAT, false, 0, 0);
    }

    game.gl.bindVertexArray(particleVAO);
    game.gl.bindBuffer(game.gl.ARRAY_BUFFER, particleVBO);
    game.gl.bufferData(game.gl.ARRAY_BUFFER, buf.subarray(0, off), game.gl.DYNAMIC_DRAW);
    game.gl.enable(game.gl.BLEND);
    game.gl.blendFunc(game.gl.SRC_ALPHA, game.gl.ONE_MINUS_SRC_ALPHA);
    game.gl.disable(game.gl.DEPTH_TEST);
    game.gl.drawArrays(game.gl.LINES, 0, off / 3);
    game.gl.enable(game.gl.DEPTH_TEST);
    game.gl.disable(game.gl.BLEND);
}

function updateEffectHUD() {
    const div = document.getElementById('effects');
    if (!div) return;
    div.innerHTML = '';
    for (const eff of game.activeEffects) {
        const el = document.createElement('div');
        el.className = 'effect-badge';
        const name = eff.type === EFFECT_SPEED ? 'Speed' : eff.type === EFFECT_SPARKLE ? 'Sparkle' : 'Jump';
        const icon = eff.type === EFFECT_SPEED ? '\u26A1' : eff.type === EFFECT_SPARKLE ? '\u2728' : '\uD83E\uDD98';
        el.textContent = icon + ' ' + name + ' ' + Math.ceil(eff.timeRemaining) + 's';
        div.appendChild(el);
    }
}
