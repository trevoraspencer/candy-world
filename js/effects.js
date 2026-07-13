'use strict';

// ====== DAY/NIGHT CYCLE (Wave 3) ======
const DAY_CYCLE_LENGTH = 600;

function lerp(a, b, t) { return a + (b - a) * t; }

function updateDayNight(dt) {
    game.dayTime = (game.dayTime + dt) % DAY_CYCLE_LENGTH;
    const t = game.dayTime / DAY_CYCLE_LENGTH;
    const sunAngle = (t - 0.25) * Math.PI * 2;
    game.sunDirection[0] = Math.cos(sunAngle) * 0.35;
    game.sunDirection[1] = Math.sin(sunAngle);
    game.sunDirection[2] = 0.45;

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

const WEATHER_TYPES = Object.freeze({
    CLEAR: 'clear',
    SPRINKLES: 'sprinkles',
    SUGAR_SNOW: 'sugar-snow',
    SHERBET_MIST: 'sherbet-mist',
    CANDY_STORM: 'candy-storm'
});

function selectScheduledWeather(scheduleIndex, biome) {
    return CandyCore.selectScheduledWeather(scheduleIndex, biome);
}

function updateWeather(dt) {
    const biome = getBiome(Math.floor(game.player.x), Math.floor(game.player.z));
    const scheduleIndex = Math.floor((game.dayTime + 17) / 75);
    if(!game.weather.auditForced && scheduleIndex !== game.weather.scheduleIndex) {
        game.weather.scheduleIndex = scheduleIndex;
        game.weather.type = selectScheduledWeather(scheduleIndex, biome);
        if(typeof scheduleSaveGame === 'function') scheduleSaveGame();
    }
    const target = game.weather.type === WEATHER_TYPES.CLEAR ? 0 : 1;
    game.weather.intensity += (target - game.weather.intensity) * Math.min(1, dt * 0.7);

    game.fogR = game.skyR; game.fogG = game.skyG; game.fogB = game.skyB;
    if(game.weather.type === WEATHER_TYPES.SHERBET_MIST) {
        game.fogR = lerp(game.fogR, 0.93, game.weather.intensity * 0.45);
        game.fogG = lerp(game.fogG, 0.68, game.weather.intensity * 0.45);
        game.fogB = lerp(game.fogB, 0.78, game.weather.intensity * 0.45);
    } else if(game.weather.type === WEATHER_TYPES.CANDY_STORM) {
        game.fogR *= 1 - game.weather.intensity * 0.28;
        game.fogG *= 1 - game.weather.intensity * 0.38;
        game.fogB *= 1 - game.weather.intensity * 0.24;
    } else if(game.weather.type === WEATHER_TYPES.SUGAR_SNOW) {
        game.fogR = lerp(game.fogR, 0.92, game.weather.intensity * 0.28);
        game.fogG = lerp(game.fogG, 0.9, game.weather.intensity * 0.28);
        game.fogB = lerp(game.fogB, 0.96, game.weather.intensity * 0.28);
    }

    const particleRate = 24 * game.settings.particleIntensity * game.weather.intensity;
    game.weather.particleCarry = (game.weather.particleCarry || 0) + particleRate * dt;
    while(game.weather.particleCarry >= 1 && game.particles.length < MAX_PARTICLES) {
        game.weather.particleCarry--;
        const index = Math.floor(game.gameTime * 60 + game.weather.particleCarry * 17);
        const px = game.player.x + (hash2D(index, 91) - 0.5) * 22;
        const pz = game.player.z + (hash2D(index, 137) - 0.5) * 22;
        const snow = game.weather.type === WEATHER_TYPES.SUGAR_SNOW;
        const color = snow ? [1,0.97,1,0.9] : [1,0.35,0.68,0.85];
        spawnParticle(px, game.player.y + 9 + hash2D(index, 211) * 5, pz,
            snow ? 0.15 : -0.4, snow ? -1.4 : -6, snow ? 0.1 : 0.25, color, snow ? 5 : 2.2);
    }
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

function damagePlayer(amount,source) {
    if(game.difficulty==='peaceful'||game.combat.invulnerableTime>0||game.combat.dead)return false;
    game.combat.invulnerableTime=.8;
    const next=game.playerHealth-Math.max(0,amount);
    if(game.worldMode==='cozy'&&next<=0){setPlayerHealth(1);showSurvivalNotice('That was close! Cozy mode kept you safe.');}
    else {setPlayerHealth(next);if(next<=0)killPlayer(source);}
    CandyEvents.emit('playerDamaged',{amount,source,position:game.player});return true;
}

function killPlayer(source) {
    if(game.combat.dead)return;game.combat.dead=true;game.paused=true;clearInputState();document.exitPointerLock?.();
    if(game.worldMode==='survival')for(let i=0;i<game.inventory.length;i++){const slot=game.inventory[i];if(slot){spawnItemDrop(slot.id,slot.count,game.player.x,game.player.y+1,game.player.z,{x:(hash2D(i,1)-.5)*3,y:2,z:(hash2D(i,2)-.5)*3});game.inventory[i]=null;}}
    updateHotbar();setMetaVisible('respawn-overlay',true);document.getElementById('respawn-button').focus();
}

function respawnPlayer() {
    const p=game.spawnPoint;game.player.x=p.x;game.player.y=p.y;game.player.z=p.z;game.player.vy=0;game.playerHealth=20;game.playerHunger=Math.max(10,game.playerHunger);game.combat.dead=false;game.combat.invulnerableTime=2;updateHearts();updateHunger();setMetaVisible('respawn-overlay',false);game.paused=false;requestGamePointerLock();scheduleSaveGame();
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
    return game.paused || game.inventoryOpen || game.tradeTarget || game.petPanelOpen || game.questPanelOpen ||
        game.craftingTableOpen || game.furnaceOpen || game.chestOpen || game.controlsOverlayOpen;
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
    game.combat.attackCooldown=Math.max(0,game.combat.attackCooldown-dt);
    game.combat.invulnerableTime=Math.max(0,game.combat.invulnerableTime-dt);

    if (!isSurvivalMeterActive()) {
        game.survival.regenTimer = 0;
        game.survival.crashTimer = 0;
        return;
    }

    if (isGameplayInputBlocked()) return;
    const headBlock=getBlock(Math.floor(game.player.x),Math.floor(game.player.y+1.62),Math.floor(game.player.z));
    game.survival.drownTimer=headBlock===WATER?game.survival.drownTimer+dt:Math.max(0,game.survival.drownTimer-dt*3);
    if(game.survival.drownTimer>8){game.survival.drownTimer=6;damagePlayer(2,{type:'drowning'});}

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

function blockColorToParticle(blockId) {
    const hex = BLOCK_COLORS[blockId] || '#FF69B4';
    const value = parseInt(hex.slice(1), 16);
    return [((value>>16)&255)/255,((value>>8)&255)/255,(value&255)/255,1];
}

function spawnBlockFeedback(target, blockId, amount) {
    if(!target) return;
    const color = blockColorToParticle(blockId);
    const count = Math.max(1, Math.min(8, amount || 3));
    for(let i=0;i<count;i++) {
        const seed=target.x*97+target.y*193+target.z*389+i*53+game.breakStage*17;
        const ja=hash2D(seed,11)-.5,jb=hash2D(seed,29)-.5;
        const x=target.x+.5+target.nx*.51+(target.nx?0:ja*.7);
        const y=target.y+.5+target.ny*.51+(target.ny?0:jb*.7);
        const z=target.z+.5+target.nz*.51+(target.nz?0:ja*.7);
        spawnParticle(x,y,z,target.nx*1.1+ja,Math.max(.5,target.ny*1.1+hash2D(seed,47)*1.7),target.nz*1.1+jb,color,.45+hash2D(seed,71)*.4);
    }
}

function spawnPlacementFeedback(x,y,z,blockId) {
    const color=blockColorToParticle(blockId);
    for(let i=0;i<6;i++) {
        const angle=i*Math.PI/3;
        spawnParticle(x+.5,y+.15,z+.5,Math.cos(angle)*.75,.6+hash2D(i+x,y+z),Math.sin(angle)*.75,color,.55);
    }
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
    updateWeather(dt);

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
    game.gl.useProgram(game.lineProgram);
    game.gl.uniformMatrix4fv(lUni.uVP, false, vp);

    if (!particleVAO) {
        particleVAO = game.gl.createVertexArray();
        particleVBO = game.gl.createBuffer();
        game.gl.bindVertexArray(particleVAO);
        game.gl.bindBuffer(game.gl.ARRAY_BUFFER, particleVBO);
        game.gl.enableVertexAttribArray(lAPos);
        game.gl.vertexAttribPointer(lAPos, 3, game.gl.FLOAT, false, 0, 0);
    }

    game.gl.bindVertexArray(particleVAO);
    game.gl.enable(game.gl.BLEND);
    game.gl.blendFunc(game.gl.SRC_ALPHA, game.gl.ONE_MINUS_SRC_ALPHA);
    game.gl.depthMask(false);
    const palette=[[1,.41,.71,1],[1,.97,1,1],[.72,.42,.25,1],[.9,.84,.88,1],[.25,.08,.16,1],[1,.2,.35,1]];
    for(let paletteIndex=0;paletteIndex<palette.length;paletteIndex++) {
        const color=palette[paletteIndex];
        let off=0;
        for(const p of game.particles) {
            const dx=p.x-game.player.x,dz=p.z-game.player.z;
            if(dx*dx+dz*dz>2500) continue;
            let nearestIndex=0,best=Infinity;
            for(let ci=0;ci<palette.length;ci++) {
                const candidate=palette[ci];
                const d=(p.color[0]-candidate[0])**2+(p.color[1]-candidate[1])**2+(p.color[2]-candidate[2])**2;
                if(d<best){best=d;nearestIndex=ci;}
            }
            if(nearestIndex!==paletteIndex) continue;
            const s=.05*(p.life/p.maxLife);
            particleVertBuffer[off++]=p.x-s; particleVertBuffer[off++]=p.y; particleVertBuffer[off++]=p.z;
            particleVertBuffer[off++]=p.x+s; particleVertBuffer[off++]=p.y; particleVertBuffer[off++]=p.z;
            particleVertBuffer[off++]=p.x; particleVertBuffer[off++]=p.y-s; particleVertBuffer[off++]=p.z;
            particleVertBuffer[off++]=p.x; particleVertBuffer[off++]=p.y+s; particleVertBuffer[off++]=p.z;
        }
        if(!off) continue;
        game.gl.uniform4f(lUni.uColor,color[0],color[1],color[2],.9);
        game.gl.bindBuffer(game.gl.ARRAY_BUFFER,particleVBO);
        game.gl.bufferData(game.gl.ARRAY_BUFFER,particleVertBuffer.subarray(0,off),game.gl.DYNAMIC_DRAW);
        game.gl.drawArrays(game.gl.LINES,0,off/3);
    }
    game.gl.depthMask(true);
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
