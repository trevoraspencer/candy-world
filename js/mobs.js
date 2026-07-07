'use strict';

// ====== MOBS ======
const MOB_PIG = 0, MOB_COW = 1, MOB_SHEEP = 2, MOB_CHICKEN = 3;
const MOB_GOAT = 4, MOB_UNICORN = 5, MOB_WARDEN = 6;
const MOB_CANDY_VILLAGER = 7, MOB_GINGER_VILLAGER = 8;

const MOB_NAMES = ['Pig', 'Cow', 'Sheep', 'Chicken', 'Goat', 'Unicorn', 'Warden', 'Candy Villager', 'Gingerbread Villager'];
const ANIMAL_MOB_TYPES = new Set([MOB_PIG, MOB_COW, MOB_SHEEP, MOB_CHICKEN, MOB_GOAT, MOB_UNICORN]);

// mobs and MAX_MOBS are now game.mobs and game.MAX_MOBS (initialized in state.js)
let mobVAO = null;
let mobVBO = null;

const MOB_FACE_DEFS = [
    { nIdx: 0, corners: [[0,0,0],[0,1,0],[0,1,1],[0,0,1]] },
    { nIdx: 1, corners: [[1,0,1],[1,1,1],[1,1,0],[1,0,0]] },
    { nIdx: 2, corners: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]] },
    { nIdx: 3, corners: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]] },
    { nIdx: 4, corners: [[1,0,0],[1,1,0],[0,1,0],[0,0,0]] },
    { nIdx: 5, corners: [[0,0,1],[0,1,1],[1,1,1],[1,0,1]] }
];
const MOB_TRI_INDICES = [0, 1, 2, 0, 2, 3];

// Persistent vertex buffer for mob meshing — grown on demand, written
// in place each frame so renderMobs avoids per-frame array allocations.
let mobVertBuffer = new Float32Array(65536);
let mobVertCount = 0;
let _nextMobId = 0; // unique mob IDs for dirty tracking
let _prevMobFrameKey = ''; // cached visible mob set for buffer skip
let _prevMobVertCount = 0;
function ensureMobCapacity(extra) {
    if(mobVertCount + extra <= mobVertBuffer.length) return;
    let newLen = mobVertBuffer.length;
    while(newLen < mobVertCount + extra) newLen *= 2;
    const grown = new Float32Array(newLen);
    grown.set(mobVertBuffer);
    mobVertBuffer = grown;
}

function colorRgb(hex) {
    return [
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255
    ];
}

// Pre-computed mob colors
const COL_CHOCOLATE = colorRgb('#D2691E');
const COL_BLUSH = colorRgb('#FADCE6');
const COL_HOT_PINK = colorRgb('#FF69B4');
const COL_BROWN = colorRgb('#8B4513');
const COL_SNOW = colorRgb('#FFF8FB');
const COL_LIGHT_PINK = colorRgb('#FFB6C1');
const COL_TAN = colorRgb('#DEB887');
const COL_DARK_PLUM = colorRgb('#6B1640');
const COL_LAVENDER = colorRgb('#FFF0F5');
const COL_MAGENTA = colorRgb('#C71585');
const COL_GOLD = colorRgb('#FFD700');
const COL_ROSE = colorRgb('#E8B4C8');
const COL_DARK_WINE = colorRgb('#3D1525');
const COL_PALE_PINK = colorRgb('#F5D5E0');
const COL_DEEP_PINK = colorRgb('#FF1493');
const COL_EYE = colorRgb('#1F140F');
const COL_CREAM = colorRgb('#FFF8E7');
const COL_WHITE = colorRgb('#FFFFFF');
const COL_RED = colorRgb('#E03030');

// Simple per-mob color jitter using the 0-1 variant for visual variety without new assets
function jitterColor(col, v, amt = 0.07) {
    const j = (v - 0.5) * amt;
    return [
        Math.max(0, Math.min(1, col[0] + j)),
        Math.max(0, Math.min(1, col[1] + j * 0.7)),
        Math.max(0, Math.min(1, col[2] + j * 1.1))
    ];
}

function isAnimalMob(type) {
    return ANIMAL_MOB_TYPES.has(type);
}

function getMobRenderSize(mob) {
    if(mob.type === MOB_WARDEN) return mob.baby ? 0.8 : 1.5;
    let size = mob.baby ? 0.5 : 0.8;
    if(isAnimalMob(mob.type)) size *= 3;
    return size;
}

// pushMobPart: local-space cuboid relative to mob position, rotated by mob.yaw (+ optional headYaw for head parts).
// This is the key fix: animals now face their movement direction instead of sliding sideways.
function pushMobPart(mob, lx0, ly0, lz0, lx1, ly1, lz1, color, headYawOffset = 0) {
    const yaw = (mob.yaw || 0) + (headYawOffset || 0);
    const theta = Math.PI / 2 - yaw; // maps local +X to velocity (sin(yaw), cos(yaw))
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    // 8 local corners of the AABB, rotated in XZ only (Y up stays)
    const lcorners = [
        [lx0, ly0, lz0], [lx1, ly0, lz0], [lx0, ly1, lz0], [lx1, ly1, lz0],
        [lx0, ly0, lz1], [lx1, ly0, lz1], [lx0, ly1, lz1], [lx1, ly1, lz1]
    ];
    const wcorners = lcorners.map(([lx, ly, lz]) => [
        mob.x + (lx * c - lz * s),
        mob.y + ly,
        mob.z + (lx * s + lz * c)
    ]);

    ensureMobCapacity(6 * 6 * 7);
    const r = color[0], g = color[1], b = color[2];
    for (let f = 0; f < 6; f++) {
        const face = MOB_FACE_DEFS[f];
        const n = face.nIdx;
        for (let ti = 0; ti < 6; ti++) {
            const ci = MOB_TRI_INDICES[ti];
            const bits = face.corners[ci]; // [xbit, ybit, zbit]
            const idx = (bits[0] ? 1 : 0) + (bits[1] ? 2 : 0) + (bits[2] ? 4 : 0);
            const w = wcorners[idx];
            mobVertBuffer[mobVertCount++] = w[0];
            mobVertBuffer[mobVertCount++] = w[1];
            mobVertBuffer[mobVertCount++] = w[2];
            mobVertBuffer[mobVertCount++] = r;
            mobVertBuffer[mobVertCount++] = g;
            mobVertBuffer[mobVertCount++] = b;
            mobVertBuffer[mobVertCount++] = n;
        }
    }
}

function variantSeed(mob, salt) {
    const v = mob.variant != null ? mob.variant : 0.5;
    return ((v * 997.0 + salt * 0.131) % 1 + 1) % 1;
}

function pushMobPatch(mob, lx0, ly0, lz0, lx1, ly1, lz1, color, headYawOffset = 0) {
    pushMobPart(mob, lx0, ly0, lz0, lx1, ly1, lz1, color, headYawOffset);
}

function pushMobEyesForward(mob, s, baseY, bob, headHalfW, headYawOff, eyeScale = 0.045) {
    const es = eyeScale * s;
    const ey = baseY + bob + 0.05 * s;
    const ez = headHalfW * 0.58;
    pushMobPart(mob, 0.09 * s, ey - es * 0.2, -ez - es * 0.25, 0.135 * s, ey + es * 0.85, -ez + es * 0.35, COL_EYE, headYawOff);
    pushMobPart(mob, 0.09 * s, ey - es * 0.2,  ez - es * 0.35, 0.135 * s, ey + es * 0.85,  ez + es * 0.25, COL_EYE, headYawOff);
}

function getQuadrupedLayout(mob, opts = {}) {
    const s = getMobRenderSize(mob);
    const legH = (opts.legH || 0.42) * s;
    const bodyH = (opts.bodyH || 0.36) * s;
    const bodyHalfL = (opts.bodyHalfL || 0.34) * s;
    const bodyHalfW = (opts.bodyHalfW || 0.18) * s;
    const headL = (opts.headL || 0.24) * s;
    const headH = (opts.headH || 0.24) * s;
    const headW = (opts.headW || 0.15) * s;
    const t = mob.animTime || 0;
    const isMoving = (mob.state === 'wander' || mob.state === 'follow');
    const phase = t * 6.2;
    const bob = isMoving ? Math.sin(phase * 2) * 0.028 * s : Math.sin(t * 2.3) * 0.012 * s;
    const bodyY0 = legH + bob;
    const bodyY1 = bodyY0 + bodyH;
    return { s, legH, bodyH, bodyHalfL, bodyHalfW, headL, headH, headW, bodyY0, bodyY1, t, headYawOff: mob.headYaw || 0 };
}

function appendQuadrupedMob(mob, palette, opts = {}) {
    const s = getMobRenderSize(mob);
    const legH = (opts.legH || 0.42) * s;
    const bodyH = (opts.bodyH || 0.36) * s;
    const bodyHalfL = (opts.bodyHalfL || 0.34) * s;
    const bodyHalfW = (opts.bodyHalfW || 0.18) * s;
    const headL = (opts.headL || 0.24) * s;
    const headH = (opts.headH || 0.24) * s;
    const headW = (opts.headW || 0.15) * s;
    const legW = (opts.legW || 0.09) * s;
    const t = mob.animTime || 0;
    const isMoving = (mob.state === 'wander' || mob.state === 'follow');

    // Rich walk cycle using animTime: 4-phase diagonal gait + forward stride in local +X (forward)
    const phase = t * 6.2;
    const liftA = Math.sin(phase) * 0.55 + 0.45;       // front-left + back-right
    const liftB = Math.sin(phase + Math.PI) * 0.55 + 0.45; // front-right + back-left
    const strideA = Math.cos(phase) * 0.07 * s;        // forward/back component
    const strideB = Math.cos(phase + Math.PI) * 0.07 * s;
    const legLiftA = Math.max(0.02, liftA) * legH * 0.65;
    const legLiftB = Math.max(0.02, liftB) * legH * 0.65;

    // Body bob + subtle breathing when idle
    const bob = isMoving ? Math.sin(phase * 2) * 0.028 * s : Math.sin(t * 2.3) * 0.012 * s;
    const bodyY0 = legH + bob;
    const bodyY1 = bodyY0 + bodyH;

    // Color variety via variant
    const v = mob.variant || 0.5;
    const bodyCol   = jitterColor(palette.body, v, isMoving ? 0.06 : 0.04);
    const headCol   = jitterColor(palette.head || palette.body, v * 0.9 + 0.05, 0.05);
    const legsCol   = jitterColor(palette.legs || palette.body, v, 0.05);

    // Main body (rotated by yaw)
    pushMobPart(mob, -bodyHalfL, bodyY0, -bodyHalfW, bodyHalfL, bodyY1, bodyHalfW, bodyCol);

    // Head group — rotated by yaw + headYaw for look tracking
    const headYawOff = mob.headYaw || 0;
    pushMobPart(mob, bodyHalfL - 0.02 * s, bodyY0 + 0.03 * s, -headW, bodyHalfL + headL, bodyY0 + headH, headW, headCol, headYawOff);

    // Eyes (tiny, dark, on front of head, headYaw rotated)
    const eyeY = bodyY0 + headH * 0.55;
    const eyeZ = headW * 0.72;
    const eyeSize = 0.035 * s;
    pushMobPart(mob, bodyHalfL + headL * 0.78, eyeY - eyeSize*0.3, -eyeZ - eyeSize*0.3, bodyHalfL + headL + 0.02*s, eyeY + eyeSize*0.7, -eyeZ + eyeSize*0.3, COL_EYE, headYawOff);
    pushMobPart(mob, bodyHalfL + headL * 0.78, eyeY - eyeSize*0.3,  eyeZ - eyeSize*0.3, bodyHalfL + headL + 0.02*s, eyeY + eyeSize*0.7,  eyeZ + eyeSize*0.3, COL_EYE, headYawOff);

    // Ears (always — big quality win, floppy or upright via palette)
    const earCol = palette.ear || headCol;
    const earH = headH * 0.55;
    // Left ear
    pushMobPart(mob, bodyHalfL + headL * 0.15, bodyY0 + headH * 0.78, -headW * 0.95, bodyHalfL + headL * 0.38, bodyY0 + headH + earH, -headW * 0.55, earCol, headYawOff);
    // Right ear
    pushMobPart(mob, bodyHalfL + headL * 0.15, bodyY0 + headH * 0.78,  headW * 0.55, bodyHalfL + headL * 0.38, bodyY0 + headH + earH,  headW * 0.95, earCol, headYawOff);

    // Snout (with tiny nostril dots for extra detail)
    if (palette.snout) {
        const snoutCol = jitterColor(palette.snout, v, 0.04);
        pushMobPart(mob, bodyHalfL + headL * 0.68, bodyY0 + 0.07 * s, -headW * 0.42, bodyHalfL + headL + 0.11 * s, bodyY0 + headH * 0.58, headW * 0.42, snoutCol, headYawOff);
        // Nostrils (very small dark)
        const nZ = headW * 0.28;
        pushMobPart(mob, bodyHalfL + headL + 0.06*s, bodyY0 + headH*0.22, -nZ-0.012*s, bodyHalfL + headL + 0.095*s, bodyY0 + headH*0.38, -nZ+0.012*s, COL_EYE, headYawOff);
        pushMobPart(mob, bodyHalfL + headL + 0.06*s, bodyY0 + headH*0.22,  nZ-0.012*s, bodyHalfL + headL + 0.095*s, bodyY0 + headH*0.38,  nZ+0.012*s, COL_EYE, headYawOff);
    }

    // Belly / wool detail
    if (palette.belly) {
        const bellyCol = jitterColor(palette.belly, v, 0.05);
        pushMobPart(mob, -bodyHalfL * 0.68, bodyY0 + 0.015*s, -bodyHalfW * 0.78, bodyHalfL * 0.58, bodyY0 + bodyH * 0.52, bodyHalfW * 0.78, bellyCol);
    }
    // Extra wool puffs for sheep (fluffy layered look)
    if (palette.wool) {
        const woolCol = jitterColor(palette.wool, v, 0.08);
        pushMobPart(mob, -bodyHalfL*0.55, bodyY0+bodyH*0.15, -bodyHalfW*0.95, -bodyHalfL*0.25, bodyY0+bodyH*0.48, -bodyHalfW*0.55, woolCol);
        pushMobPart(mob, -bodyHalfL*0.15, bodyY0+bodyH*0.18,  bodyHalfW*0.52,  bodyHalfL*0.18, bodyY0+bodyH*0.52,  bodyHalfW*0.98, woolCol);
        pushMobPart(mob,  bodyHalfL*0.22, bodyY0+bodyH*0.12, -bodyHalfW*0.9,   bodyHalfL*0.52, bodyY0+bodyH*0.45, -bodyHalfW*0.48, woolCol);
    }

    // Horns (multi-segment for goat/unicorn/cow)
    if (palette.horn) {
        const hornCol = jitterColor(palette.horn, v, 0.03);
        // Left horn
        pushMobPart(mob, bodyHalfL + headL*0.22, bodyY0 + headH*0.88, -headW*0.68, bodyHalfL + headL*0.42, bodyY0 + headH + 0.14*s, -headW*0.42, hornCol, headYawOff);
        // Right horn
        pushMobPart(mob, bodyHalfL + headL*0.22, bodyY0 + headH*0.88,  headW*0.42, bodyHalfL + headL*0.42, bodyY0 + headH + 0.14*s,  headW*0.68, hornCol, headYawOff);
        // Extra tip for unicorn/goat
        if (palette.hornTip) {
            pushMobPart(mob, bodyHalfL + headL*0.38, bodyY0 + headH + 0.08*s, -headW*0.55, bodyHalfL + headL*0.48, bodyY0 + headH + 0.18*s, -headW*0.38, hornCol, headYawOff);
            pushMobPart(mob, bodyHalfL + headL*0.38, bodyY0 + headH + 0.08*s,  headW*0.38, bodyHalfL + headL*0.48, bodyY0 + headH + 0.18*s,  headW*0.55, hornCol, headYawOff);
        }
    }

    // Mane (layered for unicorn)
    if (palette.mane) {
        const maneCol = jitterColor(palette.mane, v, 0.06);
        pushMobPart(mob, bodyHalfL + headL*0.08, bodyY0 + 0.08*s, headW*0.52, bodyHalfL + headL*0.52, bodyY0 + headH*0.88, headW*0.88, maneCol, headYawOff);
        if (palette.mane2) {
            pushMobPart(mob, bodyHalfL + headL*0.05, bodyY0 + 0.12*s, headW*0.38, bodyHalfL + headL*0.48, bodyY0 + headH*0.78, headW*0.72, jitterColor(palette.mane2, v, 0.05), headYawOff);
        }
    }

    // Tail with wag (animated side offset + length)
    if (palette.tail) {
        const tailCol = jitterColor(palette.tail, v, 0.05);
        const wag = Math.sin(t * 4.8 + 1.2) * 0.06 * s;
        // Base
        pushMobPart(mob, -bodyHalfL - 0.12*s, bodyY0 + 0.06*s, -0.025*s, -bodyHalfL + 0.01*s, bodyY0 + bodyH*0.62, 0.025*s, tailCol);
        // Wagging tip (side offset via local Z)
        pushMobPart(mob, -bodyHalfL - 0.18*s, bodyY0 + 0.10*s + wag*0.4, -0.04*s + wag, -bodyHalfL - 0.02*s, bodyY0 + bodyH*0.78, 0.04*s + wag, tailCol);
    }

    // Legs with stride (front pair at +X, rear at -X; diagonal timing)
    const frontX = bodyHalfL * 0.40;
    const rearX  = -bodyHalfL * 0.70;
    const lW2 = legW * 0.5;
    // Rear-left (liftA + strideA)
    pushMobPart(mob, rearX, legLiftA, -bodyHalfW*0.70 + strideA*0.3, rearX + legW, legH, -bodyHalfW*0.70 + legW + strideA*0.3, legsCol);
    // Rear-right (liftB + strideB)
    pushMobPart(mob, rearX, legLiftB,  bodyHalfW*0.30 + strideB*0.3, rearX + legW, legH,  bodyHalfW*0.30 + legW + strideB*0.3, legsCol);
    // Front-left (liftB + strideB)
    pushMobPart(mob, frontX, legLiftB, -bodyHalfW*0.70 + strideB*0.5, frontX + legW, legH, -bodyHalfW*0.70 + legW + strideB*0.5, legsCol);
    // Front-right (liftA + strideA)
    pushMobPart(mob, frontX, legLiftA,  bodyHalfW*0.30 + strideA*0.5, frontX + legW, legH,  bodyHalfW*0.30 + legW + strideA*0.5, legsCol);
}

function appendPigDetails(mob) {
    const L = getQuadrupedLayout(mob);
    const { s, bodyHalfL, bodyY0, bodyH, headL, headH, headW, t, headYawOff } = L;
    const wag = Math.sin(t * 4.8 + 1.2) * 0.08 * s;
    pushMobPart(mob, -bodyHalfL - 0.23 * s, bodyY0 + bodyH * 0.35, -0.07 * s + wag, -bodyHalfL - 0.13 * s, bodyY0 + bodyH * 0.55, -0.02 * s + wag, COL_HOT_PINK);
    pushMobPart(mob, -bodyHalfL - 0.31 * s, bodyY0 + bodyH * 0.49, 0.02 * s + wag, -bodyHalfL - 0.20 * s, bodyY0 + bodyH * 0.67, 0.08 * s + wag, COL_HOT_PINK);
    pushMobPart(mob, bodyHalfL + headL * 0.12, bodyY0 + headH * 0.70, -headW * 1.05, bodyHalfL + headL * 0.34, bodyY0 + headH * 0.94, -headW * 0.48, COL_BROWN, headYawOff);
    pushMobPart(mob, bodyHalfL + headL * 0.12, bodyY0 + headH * 0.70,  headW * 0.48, bodyHalfL + headL * 0.34, bodyY0 + headH * 0.94,  headW * 1.05, COL_BROWN, headYawOff);
}

function appendCowDetails(mob) {
    const L = getQuadrupedLayout(mob, { bodyHalfL: 0.38, bodyHalfW: 0.2, bodyH: 0.4 });
    const { s, bodyHalfL, bodyHalfW, bodyY0, bodyH, headL, headH, headW, headYawOff } = L;
    pushMobPart(mob, bodyHalfL + headL * 0.55, bodyY0 + 0.02 * s, -headW * 0.58, bodyHalfL + headL + 0.15 * s, bodyY0 + headH * 0.45, headW * 0.58, COL_LIGHT_PINK, headYawOff);
    const spots = [
        [-0.52, -1.04, 0.18, COL_DARK_PLUM],
        [-0.08,  1.01, 0.16, COL_CHOCOLATE],
        [ 0.28, -1.03, 0.14, COL_DARK_PLUM],
        [ 0.58,  1.02, 0.13, COL_CHOCOLATE]
    ];
    for (const [px, side, sz, col] of spots) {
        const y = bodyY0 + bodyH * (0.42 + variantSeed(mob, px * 10) * 0.25);
        const x = px * bodyHalfL;
        const z0 = side < 0 ? -bodyHalfW - 0.035 * s : bodyHalfW - 0.005 * s;
        const z1 = side < 0 ? -bodyHalfW + 0.005 * s : bodyHalfW + 0.035 * s;
        pushMobPatch(mob, x - sz * s, y, z0, x + sz * s, y + sz * 0.75 * s, z1, col);
    }
    pushMobPart(mob, -bodyHalfL * 0.45, bodyY0 - 0.05 * s, -0.08 * s, -bodyHalfL * 0.18, bodyY0 + 0.05 * s, 0.08 * s, COL_LIGHT_PINK);
    for (const z of [-0.055 * s, 0.035 * s]) {
        pushMobPart(mob, -bodyHalfL * 0.36, bodyY0 - 0.11 * s, z, -bodyHalfL * 0.29, bodyY0 - 0.02 * s, z + 0.03 * s, COL_LIGHT_PINK);
    }
    pushMobPart(mob, bodyHalfL + headL * 0.36, bodyY0 + headH + 0.10 * s, -headW * 0.62, bodyHalfL + headL * 0.55, bodyY0 + headH + 0.25 * s, -headW * 0.44, COL_TAN, headYawOff);
    pushMobPart(mob, bodyHalfL + headL * 0.36, bodyY0 + headH + 0.10 * s,  headW * 0.44, bodyHalfL + headL * 0.55, bodyY0 + headH + 0.25 * s,  headW * 0.62, COL_TAN, headYawOff);
}

function appendSheepDetails(mob) {
    const L = getQuadrupedLayout(mob, { bodyHalfL: 0.36, bodyHalfW: 0.2, bodyH: 0.42, headL: 0.22 });
    const { s, bodyHalfL, bodyHalfW, bodyY0, bodyH, headL, headH, headW, headYawOff } = L;
    const woolCol = jitterColor(COL_CREAM, mob.variant || 0.5, 0.08);
    const puffs = [
        [-0.60, 0.55, -0.98], [-0.05, 0.62, 0.92], [0.35, 0.48, -0.94],
        [0.10, 0.76, -0.15], [-0.38, 0.68, 0.42], [0.58, 0.62, 0.35]
    ];
    for (const [px, py, pz] of puffs) {
        const r = 0.12 * s * (0.9 + variantSeed(mob, px * 10 + pz) * 0.25);
        pushMobPart(mob, px * bodyHalfL - r * 0.5, bodyY0 + py * bodyH, pz * bodyHalfW - r * 0.45, px * bodyHalfL + r * 0.5, bodyY0 + py * bodyH + r, pz * bodyHalfW + r * 0.45, woolCol);
    }
    pushMobPart(mob, bodyHalfL + headL * 0.54, bodyY0 + headH * 0.22, -headW * 0.55, bodyHalfL + headL + 0.05 * s, bodyY0 + headH * 0.75, headW * 0.55, COL_CREAM, headYawOff);
    const legW = 0.06 * s;
    for (const [lx, lz] of [[-bodyHalfL * 0.70, -bodyHalfW * 0.55], [-bodyHalfL * 0.70, bodyHalfW * 0.15], [bodyHalfL * 0.40, -bodyHalfW * 0.55], [bodyHalfL * 0.40, bodyHalfW * 0.15]]) {
        pushMobPart(mob, lx, 0, lz, lx + legW, 0.045 * s, lz + legW, COL_DARK_PLUM);
    }
}

function appendGoatDetails(mob) {
    const L = getQuadrupedLayout(mob, { bodyHalfL: 0.34, bodyHalfW: 0.17, headL: 0.2, bodyH: 0.34 });
    const { s, bodyHalfL, bodyHalfW, bodyY0, bodyH, headL, headH, headW, headYawOff } = L;
    pushMobPart(mob, bodyHalfL + headL * 0.46, bodyY0 + 0.00 * s, -headW * 0.25, bodyHalfL + headL + 0.08 * s, bodyY0 + headH * 0.36, headW * 0.25, COL_ROSE, headYawOff);
    pushMobPart(mob, bodyHalfL * 0.10, bodyY0 + bodyH * 0.56, -bodyHalfW * 0.95, bodyHalfL * 0.50, bodyY0 + bodyH * 0.88, -bodyHalfW * 0.55, COL_MAGENTA);
    const hornCol = COL_DARK_WINE;
    for (const side of [-1, 1]) {
        const z0 = side < 0 ? -headW * 0.67 : headW * 0.47;
        const z1 = z0 + side * 0.13 * s;
        const z2 = z0 + side * 0.08 * s;
        const z3 = z0 + side * 0.19 * s;
        pushMobPart(mob, bodyHalfL + headL * 0.44, bodyY0 + headH + 0.15 * s, Math.min(z0, z1), bodyHalfL + headL * 0.61, bodyY0 + headH + 0.31 * s, Math.max(z0, z1), hornCol, headYawOff);
        pushMobPart(mob, bodyHalfL + headL * 0.58, bodyY0 + headH + 0.27 * s, Math.min(z2, z3), bodyHalfL + headL * 0.72, bodyY0 + headH + 0.43 * s, Math.max(z2, z3), hornCol, headYawOff);
    }
    pushMobPart(mob, -bodyHalfL - 0.08 * s, bodyY0 + bodyH * 0.55, -0.02 * s, -bodyHalfL - 0.02 * s, bodyY0 + bodyH * 0.80, 0.02 * s, COL_ROSE);
}

function appendUnicornDetails(mob) {
    const L = getQuadrupedLayout(mob, { bodyHalfL: 0.38, bodyHalfW: 0.18, headL: 0.24, headH: 0.26 });
    const { s, bodyHalfL, bodyHalfW, bodyY0, bodyH, headL, headH, headW, headYawOff } = L;
    pushMobPart(mob, bodyHalfL + headL * 0.40, bodyY0 + headH + 0.04 * s, -headW * 0.08, bodyHalfL + headL * 0.52, bodyY0 + headH + 0.30 * s, headW * 0.08, COL_GOLD, headYawOff);
    pushMobPart(mob, bodyHalfL + headL * 0.44, bodyY0 + headH + 0.28 * s, -headW * 0.05, bodyHalfL + headL * 0.50, bodyY0 + headH + 0.40 * s, headW * 0.05, COL_CREAM, headYawOff);
    pushMobPart(mob, bodyHalfL + headL * 0.62, bodyY0 + headH * 0.34, -headW * 0.24, bodyHalfL + headL + 0.06 * s, bodyY0 + headH * 0.73, headW * 0.24, COL_CREAM, headYawOff);
    for (let i = 0; i < 4; i++) {
        const ox = bodyHalfL + headL * (0.04 - i * 0.17);
        pushMobPart(mob, ox, bodyY0 + bodyH * (0.44 + i * 0.05), headW * 0.42, ox + headL * 0.20, bodyY0 + bodyH * 0.84, headW * 0.78, i % 2 === 0 ? COL_HOT_PINK : COL_ROSE, headYawOff);
    }
    const legW = 0.09 * s;
    for (const [lx, lz] of [[-bodyHalfL * 0.70, -bodyHalfW * 0.55], [-bodyHalfL * 0.70, bodyHalfW * 0.15], [bodyHalfL * 0.40, -bodyHalfW * 0.55], [bodyHalfL * 0.40, bodyHalfW * 0.15]]) {
        pushMobPart(mob, lx, 0, lz, lx + legW, 0.05 * s, lz + legW, COL_GOLD);
    }
}

function appendChickenMob(mob) {
    const s = getMobRenderSize(mob);
    const t = mob.animTime || 0;
    const phase = t * 7.5;
    const isMoving = (mob.state === 'wander' || mob.state === 'follow');
    const lift = isMoving ? Math.sin(phase) * 0.5 + 0.5 : 0.15;
    const legLiftA = Math.max(0.03, lift) * 0.22 * s;
    const legLiftB = Math.max(0.03, 1 - lift) * 0.22 * s;
    const flap = Math.sin(phase * 1.6) * (isMoving ? 0.12 : 0.03) * s;
    const headBob = Math.sin(phase * 2.1) * 0.02 * s;
    const headYawOff = (mob.headYaw || 0) * 0.6; // chickens turn head less dramatically

    // Stacked body reads rounder from a distance.
    pushMobPart(mob, -0.17*s, 0.18*s, -0.145*s, 0.15*s, 0.48*s, 0.145*s, COL_HOT_PINK);
    pushMobPart(mob, -0.13*s, 0.42*s, -0.12*s, 0.13*s, 0.59*s, 0.12*s, COL_LIGHT_PINK);
    // Head (slightly forward, headYaw for look)
    pushMobPart(mob, 0.08*s, 0.48*s + headBob, -0.09*s, 0.26*s, 0.70*s + headBob, 0.09*s, COL_HOT_PINK, headYawOff);
    // Comb (3 stacked red boxes on top of head)
    const combCol = COL_DEEP_PINK;
    pushMobPart(mob, 0.14*s, 0.68*s + headBob, -0.04*s, 0.23*s, 0.74*s + headBob, 0.04*s, combCol, headYawOff);
    pushMobPart(mob, 0.15*s, 0.73*s + headBob, -0.03*s, 0.22*s, 0.80*s + headBob, 0.03*s, combCol, headYawOff);
    // Beak (gold)
    pushMobPart(mob, 0.24*s, 0.55*s + headBob, -0.03*s, 0.32*s, 0.62*s + headBob, 0.03*s, COL_GOLD, headYawOff);
    // Wattle
    pushMobPart(mob, 0.23*s, 0.46*s + headBob, -0.025*s, 0.28*s, 0.56*s + headBob, 0.025*s, COL_RED, headYawOff);
    // Eye (small dark, head rotated)
    pushMobPart(mob, 0.20*s, 0.58*s + headBob, -0.095*s, 0.25*s, 0.64*s + headBob, -0.055*s, COL_EYE, headYawOff);
    // Two-segment wings/quills.
    pushMobPart(mob, -0.07*s, 0.30*s + flap, -0.20*s, 0.08*s, 0.50*s + flap*0.6, -0.12*s, COL_MAGENTA);
    pushMobPart(mob, -0.13*s, 0.24*s + flap*0.8, -0.22*s, 0.02*s, 0.38*s + flap*0.5, -0.15*s, COL_DEEP_PINK);
    pushMobPart(mob, -0.07*s, 0.30*s - flap,  0.12*s, 0.08*s, 0.50*s - flap*0.6,  0.20*s, COL_MAGENTA);
    pushMobPart(mob, -0.13*s, 0.24*s - flap*0.8, 0.15*s, 0.02*s, 0.38*s - flap*0.5, 0.22*s, COL_DEEP_PINK);
    // Tail feathers (small fan)
    pushMobPart(mob, -0.20*s, 0.38*s, -0.05*s, -0.12*s, 0.52*s, 0.05*s, COL_DEEP_PINK);
    // Legs (better alternate + small stride)
    const legCol = COL_MAGENTA;
    pushMobPart(mob, -0.03*s, legLiftA, -0.04*s, 0.01*s, 0.24*s, -0.01*s, legCol);
    pushMobPart(mob, -0.03*s, legLiftB,  0.01*s, 0.01*s, 0.24*s,  0.04*s, legCol);
    pushMobPart(mob, 0.00*s, 0.00*s, -0.075*s, 0.08*s, 0.035*s, -0.015*s, COL_GOLD);
    pushMobPart(mob, 0.00*s, 0.00*s,  0.015*s, 0.08*s, 0.035*s,  0.075*s, COL_GOLD);
}

function appendVillagerMob(mob, palette) {
    const s = getMobRenderSize(mob);
    const t = mob.animTime || game.gameTime;
    const moving = mob.state === 'wander';
    const bob = moving ? Math.max(0, Math.sin(t * 5.0 + mob.x * 0.3) * 0.04 * s) : Math.sin(t * 1.8) * 0.008 * s;
    const swing = moving ? Math.sin(t * 5.5) * 0.05 * s : 0;
    const headYawOff = (mob.headYaw || 0) * 0.45;

    pushMobPart(mob, -0.15*s, 0.24*s, -0.115*s, 0.16*s, 0.58*s, 0.115*s, palette.body);
    pushMobPart(mob, -0.13*s, 0.30*s, -0.122*s, 0.165*s, 0.54*s, 0.122*s, palette.body);
    pushMobPart(mob, -0.135*s, 0.58*s + bob, -0.135*s, 0.135*s, 0.86*s + bob, 0.135*s, palette.head, headYawOff);
    pushMobPart(mob, 0.12*s, 0.66*s + bob, -0.035*s, 0.18*s, 0.75*s + bob, 0.035*s, palette.head, headYawOff);
    pushMobEyesForward(mob, s, 0.71*s, bob, 0.135*s, headYawOff, 0.04);
    pushMobPart(mob, -0.13*s, 0.84*s + bob, -0.15*s, 0.13*s, 0.89*s + bob, 0.15*s, palette.hat, headYawOff);
    pushMobPart(mob, -0.09*s, 0.89*s + bob, -0.105*s, 0.09*s, 1.01*s + bob, 0.105*s, palette.hat, headYawOff);
    pushMobPart(mob, -0.02*s + swing, 0.20*s, -0.205*s, 0.10*s + swing, 0.52*s, -0.125*s, palette.arms);
    pushMobPart(mob, -0.02*s - swing, 0.20*s,  0.125*s, 0.10*s - swing, 0.52*s,  0.205*s, palette.arms);
    pushMobPart(mob, -0.09*s, 0.02*s, -0.085*s, 0.03*s, 0.27*s, -0.015*s, palette.legs);
    pushMobPart(mob, -0.09*s, 0.02*s,  0.015*s, 0.03*s, 0.27*s,  0.085*s, palette.legs);
    pushMobPart(mob, -0.11*s, 0.0, -0.105*s, 0.05*s, 0.04*s, -0.015*s, COL_DARK_PLUM);
    pushMobPart(mob, -0.11*s, 0.0,  0.015*s, 0.05*s, 0.04*s,  0.105*s, COL_DARK_PLUM);
    if (mob.type === MOB_CANDY_VILLAGER) {
        appendCandyVillagerDetails(mob, s, bob, swing);
    } else if (mob.type === MOB_GINGER_VILLAGER) {
        appendGingerVillagerDetails(mob, s, bob);
    }
}

function appendCandyVillagerDetails(mob, s, bob, swing) {
    pushMobPatch(mob, 0.125*s, 0.30*s, -0.085*s, 0.172*s, 0.54*s, 0.085*s, COL_CREAM);
    pushMobPatch(mob, -0.075*s, 0.98*s + bob, -0.09*s, 0.075*s, 1.08*s + bob, 0.09*s, COL_WHITE);
    pushMobPatch(mob, 0.137*s, 0.69*s + bob, -0.115*s, 0.173*s, 0.73*s + bob, -0.075*s, COL_BLUSH);
    pushMobPatch(mob, 0.137*s, 0.69*s + bob,  0.075*s, 0.173*s, 0.73*s + bob,  0.115*s, COL_BLUSH);
    pushMobPart(mob, 0.10*s + swing, 0.18*s, -0.28*s, 0.15*s + swing, 0.48*s, -0.23*s, COL_WHITE);
    pushMobPart(mob, 0.13*s + swing, 0.30*s, -0.29*s, 0.18*s + swing, 0.42*s, -0.22*s, COL_RED);
}

function appendGingerVillagerDetails(mob, s, bob) {
    const buttons = [COL_HOT_PINK, COL_GOLD, COL_DEEP_PINK];
    for (let i = 0; i < 3; i++) {
        const by = 0.31 * s + i * 0.08 * s;
        pushMobPatch(mob, 0.162*s, by, -0.025*s, 0.188*s, by + 0.035*s, 0.025*s, buttons[i]);
    }
    for (const [z0, z1] of [[-0.21*s, -0.13*s], [0.13*s, 0.21*s]]) {
        pushMobPatch(mob, 0.05*s, 0.49*s, z0, 0.12*s, 0.53*s, z1, COL_WHITE);
    }
    pushMobPatch(mob, 0.13*s, 0.56*s, -0.10*s, 0.17*s, 0.60*s, 0.10*s, COL_WHITE);
    pushMobPatch(mob, -0.16*s, 0.84*s + bob, -0.16*s, 0.16*s, 0.88*s + bob, 0.16*s, COL_WHITE);
    pushMobPart(mob, -0.06*s, 0.52*s, -0.18*s, 0.04*s, 0.61*s, -0.12*s, COL_TAN);
    pushMobPart(mob, -0.06*s, 0.52*s,  0.12*s, 0.04*s, 0.61*s,  0.18*s, COL_TAN);
}

function appendWardenMob(mob) {
    const s = getMobRenderSize(mob);
    const t = mob.animTime || game.gameTime;
    const sway = mob.state === 'wander' || mob.state === 'follow' || mob.state === 'flee' ? Math.sin(t * 4 + mob.x * 0.2) * 0.05 * s : 0;
    const pulse = 1.0 + Math.sin(t * 3.2) * 0.08;
    pushMobPart(mob, -0.17*s, 0.0, -0.10*s, 0.17*s, 0.30*s, 0.10*s, COL_ROSE);
    pushMobPart(mob, -0.22*s, 0.28*s, -0.12*s, 0.22*s, 0.76*s, 0.12*s, COL_PALE_PINK);
    pushMobPart(mob, -0.30*s, 0.66*s, -0.14*s, 0.30*s, 0.88*s, 0.14*s, COL_PALE_PINK);
    pushMobPart(mob, -0.20*s, 0.88*s, -0.17*s, 0.20*s, 1.18*s, 0.17*s, COL_PALE_PINK);
    pushMobPart(mob, 0.08*s, 0.98*s, -0.11*s, 0.14*s, 1.06*s, -0.045*s, COL_EYE);
    pushMobPart(mob, 0.08*s, 0.98*s,  0.045*s, 0.14*s, 1.06*s,  0.11*s, COL_EYE);
    pushMobPart(mob, -0.08*s, 1.18*s, -0.09*s, 0.08*s, 1.24*s, 0.09*s, COL_DEEP_PINK);
    pushMobPart(mob, -0.05*s, 1.23*s, -0.065*s, -0.01*s, 1.31*s, -0.015*s, COL_ROSE);
    pushMobPart(mob, -0.01*s, 1.23*s, -0.03*s, 0.03*s, 1.31*s, 0.03*s, COL_ROSE);
    pushMobPart(mob, 0.03*s, 1.23*s, 0.015*s, 0.07*s, 1.31*s, 0.065*s, COL_ROSE);
    pushMobPart(mob, -0.40*s, 0.28*s, -0.06*s, -0.28*s, 0.78*s + sway, 0.06*s, COL_PALE_PINK);
    pushMobPart(mob, -0.48*s, 0.50*s + sway * 0.5, -0.055*s, -0.36*s, 0.68*s + sway, 0.055*s, COL_ROSE);
    pushMobPart(mob, 0.28*s, 0.28*s, -0.06*s, 0.40*s, 0.78*s - sway, 0.06*s, COL_PALE_PINK);
    pushMobPart(mob, 0.36*s, 0.50*s - sway * 0.5, -0.055*s, 0.48*s, 0.68*s - sway, 0.055*s, COL_ROSE);
    pushMobPart(mob, -0.15*s, 0.0, -0.09*s, -0.04*s, 0.32*s, 0.02*s, COL_ROSE);
    pushMobPart(mob, 0.04*s, 0.0, -0.02*s, 0.15*s, 0.32*s, 0.09*s, COL_ROSE);
    const core = 0.07 * s * pulse;
    pushMobPart(mob, -core, 0.41*s, -core, core, 0.41*s + core * 2, core, COL_DEEP_PINK);
}

function appendMobGeometry(mob) {
    switch(mob.type) {
        case MOB_PIG:
            appendQuadrupedMob(mob, { body: COL_CHOCOLATE, belly: COL_BLUSH, head: COL_CHOCOLATE, snout: COL_HOT_PINK, legs: COL_BROWN, ear: COL_BROWN, tail: COL_HOT_PINK });
            appendPigDetails(mob);
            break;
        case MOB_COW:
            appendQuadrupedMob(mob, { body: COL_SNOW, belly: COL_LIGHT_PINK, head: COL_SNOW, horn: COL_TAN, hornTip: COL_DARK_PLUM, legs: COL_DARK_PLUM, tail: COL_LIGHT_PINK, ear: COL_SNOW }, { bodyHalfL: 0.38, bodyHalfW: 0.2, bodyH: 0.4 });
            appendCowDetails(mob);
            break;
        case MOB_SHEEP:
            appendQuadrupedMob(mob, { body: COL_LIGHT_PINK, head: COL_LAVENDER, legs: COL_LIGHT_PINK, wool: COL_CREAM, ear: COL_LAVENDER }, { bodyHalfL: 0.36, bodyHalfW: 0.2, bodyH: 0.42, headL: 0.22, legW: 0.06 });
            appendSheepDetails(mob);
            break;
        case MOB_CHICKEN:
            appendChickenMob(mob);
            break;
        case MOB_GOAT:
            appendQuadrupedMob(mob, { body: COL_MAGENTA, head: COL_ROSE, horn: COL_DARK_WINE, hornTip: COL_DARK_WINE, legs: COL_MAGENTA, tail: COL_ROSE, ear: COL_ROSE }, { bodyHalfL: 0.34, bodyHalfW: 0.17, headL: 0.2, bodyH: 0.34 });
            appendGoatDetails(mob);
            break;
        case MOB_UNICORN:
            appendQuadrupedMob(mob, { body: COL_LAVENDER, head: COL_LAVENDER, mane: COL_HOT_PINK, mane2: COL_ROSE, legs: COL_LAVENDER, tail: COL_LIGHT_PINK, ear: COL_LAVENDER }, { bodyHalfL: 0.38, bodyHalfW: 0.18, headL: 0.24, headH: 0.26 });
            appendUnicornDetails(mob);
            break;
        case MOB_CANDY_VILLAGER:
            appendVillagerMob(mob, { body: COL_LIGHT_PINK, head: COL_LAVENDER, hat: COL_HOT_PINK, arms: COL_LIGHT_PINK, legs: COL_LIGHT_PINK });
            break;
        case MOB_GINGER_VILLAGER:
            appendVillagerMob(mob, { body: COL_CHOCOLATE, head: COL_LAVENDER, hat: COL_BLUSH, arms: COL_CHOCOLATE, legs: COL_CHOCOLATE });
            break;
        case MOB_WARDEN:
            appendWardenMob(mob);
            break;
    }
}

// Villager trade templates
const VILLAGER_TRADE_TEMPLATES = {
    [MOB_CANDY_VILLAGER]: [
        { give: [{ id: DIRT, count: 10 }], receive: { id: ITEM_SUGAR, count: 4 } },
        { give: [{ id: STONE, count: 8 }], receive: { id: ITEM_IRON_INGOT, count: 1 } },
        { give: [{ id: ITEM_SUGAR, count: 10 }], receive: { id: ITEM_CUPCAKE, count: 1 } },
        { give: [{ id: WOOD, count: 8 }], receive: { id: ITEM_STICK, count: 16 } },
        { give: [{ id: IRON_ORE, count: 3 }], receive: { id: ITEM_IRON_INGOT, count: 2 } },
    ],
    [MOB_GINGER_VILLAGER]: [
        { give: [{ id: SAND, count: 8 }], receive: { id: ITEM_FLOUR, count: 4 } },
        { give: [{ id: ITEM_FLOUR, count: 4 }], receive: { id: ITEM_COOKIE, count: 3 } },
        { give: [{ id: LEAVES, count: 16 }], receive: { id: ITEM_CANDY, count: 2 } },
        { give: [{ id: GOLD_ORE, count: 2 }], receive: { id: ITEM_GOLD_INGOT, count: 2 } },
        { give: [{ id: ITEM_SUGAR, count: 6 }], receive: { id: ITEM_LOLLIPOP, count: 1 } },
    ]
};

// game.tradeTarget is now game.tradeTarget (initialized in state.js)

function generateVillagerTrades(mobType) {
    const templates = VILLAGER_TRADE_TEMPLATES[mobType];
    if (!templates) return [];
    // Pick 3-4 random trades
    const shuffled = [...templates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3 + Math.floor(Math.random() * 2));
}

function spawnMob(type, x, y, z, baby) {
    if (game.mobs.length >= game.MAX_MOBS) return null;
    const mob = {
        type, x, y, z,
        vx: 0, vy: 0, vz: 0,
        yaw: Math.random() * Math.PI * 2,
        targetYaw: Math.random() * Math.PI * 2,
        state: 'idle',
        stateTimer: 2 + Math.random() * 3,
        baby: !!baby,
        trades: null,
        built: false,
        tamed: false,
        petName: '',
        // New for quality upgrade: independent animation clock, head look offset, and procedural color variant
        animTime: 0,
        headYaw: 0,
        variant: hash2D(Math.floor(x * 19.3 + z * 7.7), Math.floor(y * 3.1 + type * 11)),
        // Dirty tracking for render optimization
        _mobId: _nextMobId++,
        _cachedVerts: null,
        _cachedVertCount: 0,
        _prevGeom: null
    };
    if (type === MOB_CANDY_VILLAGER || type === MOB_GINGER_VILLAGER) {
        mob.trades = generateVillagerTrades(type);
    }
    game.mobs.push(mob);
    return mob;
}

function findGround(x, z) {
    for (let y = CHUNK_H - 1; y >= 0; y--) {
        if (isSolid(getBlock(x, y, z))) return y + 1;
    }
    return 1;
}

function isDryMobColumn(x, z) {
    const ix = Math.max(0, Math.min(WORLD_W - 1, Math.floor(x)));
    const iz = Math.max(0, Math.min(WORLD_D - 1, Math.floor(z)));
    const groundY = findGround(ix, iz);
    return getBlock(ix, groundY, iz) !== WATER && getBlock(ix, groundY + 1, iz) !== WATER;
}

function findNearbyDryLand(x, z, maxRadius = 6) {
    const baseX = Math.floor(x);
    const baseZ = Math.floor(z);
    if(isDryMobColumn(baseX, baseZ)) {
        return { x: baseX + 0.5, y: findGround(baseX, baseZ), z: baseZ + 0.5 };
    }
    for(let radius = 1; radius <= maxRadius; radius++) {
        for(let dz = -radius; dz <= radius; dz++) {
            for(let dx = -radius; dx <= radius; dx++) {
                if(Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
                const nx = baseX + dx;
                const nz = baseZ + dz;
                if(nx < 1 || nx >= WORLD_W - 1 || nz < 1 || nz >= WORLD_D - 1) continue;
                if(isDryMobColumn(nx, nz)) {
                    return { x: nx + 0.5, y: findGround(nx, nz), z: nz + 0.5 };
                }
            }
        }
    }
    return null;
}

function snapMobToDryLand(mob) {
    const dry = findNearbyDryLand(mob.x, mob.z, 8);
    if(!dry) return false;
    mob.x = dry.x;
    mob.y = dry.y;
    mob.z = dry.z;
    mob.vx = 0;
    mob.vy = 0;
    mob.vz = 0;
    return true;
}

function isAreaDryLand(x0, z0, w, d) {
    for(let dz = 0; dz < d; dz++)
        for(let dx = 0; dx < w; dx++)
            if(!isDryMobColumn(x0 + dx, z0 + dz)) return false;
    return true;
}

function getMobTypesForBiome(biome, r) {
    let mobTypes = [];
    let maxSpawn = 0;
    switch (biome) {
        case BIOME_FOREST:
            mobTypes = [MOB_PIG, MOB_COW, MOB_SHEEP, MOB_CANDY_VILLAGER];
            maxSpawn = 2 + Math.floor(r * 3); break;
        case BIOME_MOUNTAINS:
            mobTypes = [MOB_GOAT, MOB_SHEEP, MOB_GINGER_VILLAGER];
            maxSpawn = 1 + Math.floor(r * 2); break;
        case BIOME_DEEP_DARK:
            mobTypes = [MOB_WARDEN];
            maxSpawn = r > 0.7 ? 1 : 0; break;
        case BIOME_PLAINS:
            mobTypes = [MOB_SHEEP, MOB_CHICKEN, MOB_UNICORN, MOB_CANDY_VILLAGER];
            maxSpawn = 2 + Math.floor(r * 2); break;
        case BIOME_BEACH:
            mobTypes = [MOB_CHICKEN, MOB_PIG];
            maxSpawn = 1 + Math.floor(r * 2); break;
    }
    return { mobTypes, maxSpawn };
}

function trySpawnMobAt(x, z, mobTypes) {
    if (!mobTypes || mobTypes.length === 0) return false;
    const clampX = Math.max(1, Math.min(WORLD_W - 2, Math.floor(x)));
    const clampZ = Math.max(1, Math.min(WORLD_D - 2, Math.floor(z)));
    const gy = findGround(clampX, clampZ);
    if (gy < WATER_LEVEL - 2 || !isDryMobColumn(clampX, clampZ)) return false;
    const mt = mobTypes[Math.floor(Math.random() * mobTypes.length)];
    const isBaby = Math.random() < 0.2;
    return spawnMob(mt, clampX + 0.5, gy, clampZ + 0.5, isBaby) !== null;
}

function getChunkOrderFromCenter(cx0, cz0) {
    const chunks = [];
    for (let cz = 0; cz < WORLD_CZ; cz++) {
        for (let cx = 0; cx < WORLD_CX; cx++) {
            const dx = cx - cx0;
            const dz = cz - cz0;
            chunks.push({ cx, cz, dist: dx * dx + dz * dz });
        }
    }
    chunks.sort((a, b) => a.dist - b.dist);
    return chunks;
}

function hasNearbyMob(x, z, minDist) {
    const minDistSq = minDist * minDist;
    for (const mob of game.mobs) {
        const dx = mob.x - x;
        const dz = mob.z - z;
        if (dx * dx + dz * dz < minDistSq) return true;
    }
    return false;
}

function countLandAnimalsNear(wx, wz, radius) {
    const radiusSq = radius * radius;
    let count = 0;
    for (const mob of game.mobs) {
        if (!ANIMAL_MOB_TYPES.has(mob.type)) continue;
        const dx = mob.x - wx;
        const dz = mob.z - wz;
        if (dx * dx + dz * dz <= radiusSq) count++;
    }
    return count;
}

function freeFarAnimalSlot(wx, wz, protectedRadius) {
    if (game.mobs.length < game.MAX_MOBS) return true;
    const protectedRadiusSq = protectedRadius * protectedRadius;
    let farIndex = -1;
    let farDistSq = protectedRadiusSq;
    for (let i = 0; i < game.mobs.length; i++) {
        const mob = game.mobs[i];
        if (mob.tamed || !ANIMAL_MOB_TYPES.has(mob.type)) continue;
        const dx = mob.x - wx;
        const dz = mob.z - wz;
        const distSq = dx * dx + dz * dz;
        if (distSq > farDistSq) {
            farDistSq = distSq;
            farIndex = i;
        }
    }
    if (farIndex < 0) return false;
    game.mobs.splice(farIndex, 1);
    return true;
}

function ensureAnimalsNearSpawn(spawnX, spawnZ, options) {
    const radius = (options && options.radius) || 56;
    const minCount = (options && options.minCount) || 14;
    const maxAttempts = (options && options.maxAttempts) || 720;
    const px = typeof spawnX === 'number' ? spawnX : game.player.x;
    const pz = typeof spawnZ === 'number' ? spawnZ : game.player.z;
    let nearby = countLandAnimalsNear(px, pz, radius);
    for (let attempt = 0; attempt < maxAttempts && nearby < minCount; attempt++) {
        if (!freeFarAnimalSlot(px, pz, radius * 1.2)) break;

        const angle = hash2D(Math.floor(px) * 13 + attempt, Math.floor(pz) * 7 + attempt) * Math.PI * 2;
        const dist = 8 + hash2D(Math.floor(pz) * 29 + attempt, Math.floor(px) * 11 + attempt) * (radius - 8);
        const mx = px + Math.sin(angle) * dist;
        const mz = pz + Math.cos(angle) * dist;
        const clampX = Math.max(1, Math.min(WORLD_W - 2, Math.floor(mx)));
        const clampZ = Math.max(1, Math.min(WORLD_D - 2, Math.floor(mz)));
        if (hasNearbyMob(clampX + 0.5, clampZ + 0.5, 5)) continue;

        const biome = getBiome(clampX, clampZ);
        const r = hash2D(clampX * 13 + attempt, clampZ * 29);
        const { mobTypes } = getMobTypesForBiome(biome, r);
        const animalTypes = mobTypes.filter(t => ANIMAL_MOB_TYPES.has(t));
        if (animalTypes.length === 0) continue;
        if (trySpawnMobAt(clampX, clampZ, animalTypes)) nearby++;
    }
    return nearby;
}

function spawnMobs(spawnX, spawnZ) {
    const phaseATarget = 12 + Math.floor(Math.random() * 5);
    let phaseASpawned = 0;

    for (let attempt = 0; attempt < 30 && phaseASpawned < phaseATarget && game.mobs.length < game.MAX_MOBS; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 44;
        const mx = spawnX + Math.sin(angle) * dist;
        const mz = spawnZ + Math.cos(angle) * dist;

        const biome = getBiome(mx, mz);
        const r = hash2D(Math.floor(mx * 13), Math.floor(mz * 29));
        const { mobTypes } = getMobTypesForBiome(biome, r);
        const animalTypes = mobTypes.filter(t => ANIMAL_MOB_TYPES.has(t));
        if (animalTypes.length === 0) continue;

        const clampX = Math.max(1, Math.min(WORLD_W - 2, Math.floor(mx)));
        const clampZ = Math.max(1, Math.min(WORLD_D - 2, Math.floor(mz)));
        if (hasNearbyMob(clampX + 0.5, clampZ + 0.5, 6)) continue;

        if (trySpawnMobAt(mx, mz, animalTypes)) phaseASpawned++;
    }

    const cx0 = Math.floor(spawnX / 16);
    const cz0 = Math.floor(spawnZ / 16);
    const chunkOrder = getChunkOrderFromCenter(cx0, cz0);

    for (const { cx, cz } of chunkOrder) {
        if (game.mobs.length >= game.MAX_MOBS) break;

        const biome = getBiome(cx * 16 + 8, cz * 16 + 8);
        const r = hash2D(cx * 137 + 999, cz * 251 + 777);
        const { mobTypes, maxSpawn } = getMobTypesForBiome(biome, r);
        if (mobTypes.length === 0 || maxSpawn === 0) continue;

        let spawned = false;
        for (let attempt = 0; attempt < maxSpawn && !spawned && game.mobs.length < game.MAX_MOBS; attempt++) {
            const mx = cx * 16 + Math.floor(Math.random() * 16);
            const mz = cz * 16 + Math.floor(Math.random() * 16);
            if (trySpawnMobAt(mx, mz, mobTypes)) spawned = true;
        }
    }
}

// Villager house building
function placeVillagerHouse(vx, vy, vz, type) {
    const wall = type === MOB_GINGER_VILLAGER ? FROSTING_BROWN : FROSTING_PINK;
    const roof = FROSTING_WHITE;
    for (let dx = 0; dx < 5; dx++) {
        for (let dz = 0; dz < 5; dz++) {
            // Floor
            setBlock(vx + dx, vy, vz + dz, PLANKS);
            // Walls (edges only)
            for (let dy = 1; dy <= 3; dy++) {
                if (dx === 0 || dx === 4 || dz === 0 || dz === 4) {
                    // Door opening at front center
                    if (dx === 2 && dz === 0 && dy <= 2) continue;
                    // Window on side
                    if ((dx === 0 || dx === 4) && dz === 2 && dy === 2) {
                        setBlock(vx + dx, vy + dy, vz + dz, GLASS);
                        continue;
                    }
                    setBlock(vx + dx, vy + dy, vz + dz, wall);
                }
            }
            // Roof
            setBlock(vx + dx, vy + 4, vz + dz, roof);
        }
    }
    // Crafting table inside
    setBlock(vx + 1, vy + 1, vz + 3, CRAFTING_TABLE);
}

function buildVillagerHouses() {
    for (const mob of game.mobs) {
        if ((mob.type === MOB_CANDY_VILLAGER || mob.type === MOB_GINGER_VILLAGER) && !mob.baby && !mob.built) {
            const hx = Math.floor(mob.x) - 2;
            const hz = Math.floor(mob.z) - 2;
            const hy = findGround(hx + 2, hz + 2) - 1;
            if (hy > WATER_LEVEL && hy < 55 && isAreaDryLand(hx, hz, 5, 5)) {
                placeVillagerHouse(hx, hy, hz, mob.type);
                mob.built = true;
            }
        }
    }
}

// ====== MOB AI ======
function updateMobs(dt) {
    for (let i = game.mobs.length - 1; i >= 0; i--) {
        const mob = game.mobs[i];
        if(!isDryMobColumn(mob.x, mob.z) && !snapMobToDryLand(mob)) {
            if(mob.tamed) continue; // Never despawn tamed pets
            if(mob === game.tradeTarget) closeTradePanel();
            game.mobs.splice(i, 1);
            continue;
        }

        mob.stateTimer -= dt;

        // Tamed pets always follow their owner (overrides idle/wander)
        if (mob.tamed) {
            const tdx = mob.x - game.player.x, tdz = mob.z - game.player.z;
            const tDist = Math.sqrt(tdx * tdx + tdz * tdz);
            if (tDist > 3.5) {
                mob.state = 'follow';
                mob.targetYaw = Math.atan2(game.player.x - mob.x, game.player.z - mob.z);
                mob.stateTimer = 2;
            } else if (mob.state === 'follow' && tDist <= 3) {
                mob.state = 'idle';
                mob.stateTimer = 1 + Math.random() * 2;
            }
        } else {
            // Normal idle/wander state transitions for untamed game.mobs
            if (mob.stateTimer <= 0) {
            if (mob.state === 'idle') {
                mob.state = 'wander';
                mob.targetYaw = Math.random() * Math.PI * 2;
                mob.stateTimer = 3 + Math.random() * 5;
            } else {
                mob.state = 'idle';
                mob.stateTimer = 2 + Math.random() * 3;
            }
        }
        } // end else (untamed mob state transitions)

        // Follow state: game.player holds treat within 8 blocks (untamed animals only)
        const dx = mob.x - game.player.x, dz = mob.z - game.player.z;
        const distToPlayer = Math.sqrt(dx * dx + dz * dz);
        if (!mob.tamed) {
            const held = game.inventory[game.selectedSlot];
            const holdingTreat = held && isTreatItem(held.id);
            if (holdingTreat && distToPlayer < 8 && mob.type !== MOB_CANDY_VILLAGER && mob.type !== MOB_GINGER_VILLAGER) {
                mob.state = 'follow';
                mob.targetYaw = Math.atan2(game.player.x - mob.x, game.player.z - mob.z);
            }
        }

        // Flee-from-warden: animals and villagers detect nearby warden and flee
        if (mob.type !== MOB_WARDEN && (isAnimalMob(mob.type) || mob.type === MOB_CANDY_VILLAGER || mob.type === MOB_GINGER_VILLAGER)) {
            for (const other of game.mobs) {
                if (other === mob || other.type !== MOB_WARDEN) continue;
                const wdx = mob.x - other.x, wdz = mob.z - other.z;
                const wDist = Math.sqrt(wdx * wdx + wdz * wdz);
                if (wDist < 10) {
                    mob.state = 'flee';
                    mob.targetYaw = Math.atan2(wdx, wdz); // direction away from warden
                    mob.stateTimer = Math.max(mob.stateTimer, 1.5);
                    break;
                }
            }
        }

        // Advance per-mob animation clock (used by geometry for smooth non-snapping motion)
        const isMoving = (mob.state === 'wander' || mob.state === 'follow' || mob.state === 'flee');
        mob.animTime = (mob.animTime || 0) + dt * (isMoving ? 1.15 : 0.55);

        // Head tracking / idle look-around (only animals for now)
        if (isAnimalMob(mob.type)) {
            let targetHead = 0;
            if (mob.state === 'follow') {
                const lookYaw = Math.atan2(game.player.x - mob.x, game.player.z - mob.z);
                targetHead = lookYaw - mob.yaw;
            } else if (mob.state === 'idle') {
                // subtle random head turns while standing
                targetHead = Math.sin(mob.animTime * 0.65 + mob.x * 0.4) * 0.7;
            }
            while (targetHead > Math.PI) targetHead -= Math.PI * 2;
            while (targetHead < -Math.PI) targetHead += Math.PI * 2;
            targetHead = Math.max(-1.05, Math.min(1.05, targetHead));
            mob.headYaw += (targetHead - mob.headYaw) * Math.min(1, dt * 5.0);
        }

        // Movement (smoothed acceleration instead of instant velocity for less glitchy feel)
        if (isMoving) {
            const speed = mob.state === 'follow' ? 3.0 : mob.state === 'flee' ? 4.5 : (mob.baby ? 2.0 : 1.5);
            const desiredVx = Math.sin(mob.yaw) * speed;
            const desiredVz = Math.cos(mob.yaw) * speed;
            const accel = (mob.state === 'follow' || mob.state === 'flee' ? 11 : 7.5) * dt;
            mob.vx += (desiredVx - mob.vx) * accel;
            mob.vz += (desiredVz - mob.vz) * accel;
        } else {
            mob.vx *= (1 - 9 * dt);
            mob.vz *= (1 - 9 * dt);
        }

        // Smooth yaw rotation (body)
        let yawDiff = mob.targetYaw - mob.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        mob.yaw += yawDiff * Math.min(1, dt * 5);

        // Inter-mob separation: repulsion from nearby same-type mobs prevents overlapping
        let sepX = 0, sepZ = 0;
        for (let j = 0; j < game.mobs.length; j++) {
            if (j === i) continue;
            const other = game.mobs[j];
            if (other.type !== mob.type) continue;
            const sdx = mob.x - other.x, sdz = mob.z - other.z;
            const sDistSq = sdx * sdx + sdz * sdz;
            if (sDistSq < 4.0 && sDistSq > 0.001) { // ~2 block radius
                const sDist = Math.sqrt(sDistSq);
                // Force inversely proportional to distance (stronger when closer)
                const force = 1.0 / sDist;
                sepX += (sdx / sDist) * force;
                sepZ += (sdz / sDist) * force;
            }
        }
        if (sepX !== 0 || sepZ !== 0) {
            mob.vx += sepX * dt * 4.0;
            mob.vz += sepZ * dt * 4.0;
        }

        // Gravity
        mob.vy -= 20 * dt;

        // Apply movement
        const nextX = mob.x + mob.vx * dt;
        const nextZ = mob.z + mob.vz * dt;
        if (isDryMobColumn(nextX, nextZ)) {
            mob.x = nextX;
            mob.z = nextZ;
        } else {
            const dry = findNearbyDryLand(nextX, nextZ, 6);
            if (dry) mob.targetYaw = Math.atan2(dry.x - mob.x, dry.z - mob.z);
            mob.state = 'wander';
            mob.stateTimer = 1.5;
            mob.vx = 0;
            mob.vz = 0;
        }
        mob.y += mob.vy * dt;

        // Ground collision
        const groundY = findGround(Math.floor(mob.x), Math.floor(mob.z));
        if (mob.y <= groundY) {
            mob.y = groundY;
            mob.vy = 0;
        }

        // Wall detection: improved steering (feelers instead of blind 90° snap)
        const fx = Math.floor(mob.x + mob.vx * 0.6);
        const fz = Math.floor(mob.z + mob.vz * 0.6);
        if (!isDryMobColumn(fx, fz) || isSolid(getBlock(fx, Math.floor(mob.y + 0.5), fz))) {
            // Try several angled directions relative to current yaw; pick first clear one
            const feelerOffsets = [0.7, -0.7, 1.4, -1.4, 2.2, -2.2];
            let chosen = mob.yaw + Math.PI * 0.6 + (Math.random() - 0.5) * 0.8;
            for (const da of feelerOffsets) {
                const ty = mob.yaw + da;
                const tx = mob.x + Math.sin(ty) * 2.0;
                const tz = mob.z + Math.cos(ty) * 2.0;
                if (isDryMobColumn(tx, tz)) { chosen = ty; break; }
            }
            mob.targetYaw = chosen;
            mob.state = 'wander';
            mob.stateTimer = 1.8;
            mob.vx *= 0.3;
            mob.vz *= 0.3;
        }

        // Keep in world bounds
        mob.x = Math.max(1, Math.min(WORLD_W - 2, mob.x));
        mob.z = Math.max(1, Math.min(WORLD_D - 2, mob.z));
    }
}

// ====== MOB DIRTY TRACKING (render optimization) ======
const GEOM_POS_EPS = 0.001;
const GEOM_ANGLE_EPS = 0.001;
const GEOM_ANIM_EPS = 0.1;

function isMobGeomDirty(mob) {
    const p = mob._prevGeom;
    if (!p) return true;
    return Math.abs(mob.x - p.x) > GEOM_POS_EPS ||
           Math.abs(mob.y - p.y) > GEOM_POS_EPS ||
           Math.abs(mob.z - p.z) > GEOM_POS_EPS ||
           Math.abs(mob.yaw - p.yaw) > GEOM_ANGLE_EPS ||
           Math.abs(mob.headYaw - p.headYaw) > GEOM_ANGLE_EPS ||
           Math.abs(mob.animTime - p.animTime) > GEOM_ANIM_EPS ||
           mob.state !== p.state ||
           mob.baby !== p.baby;
}

function saveMobGeomState(mob) {
    mob._prevGeom = {
        x: mob.x, y: mob.y, z: mob.z,
        yaw: mob.yaw, headYaw: mob.headYaw,
        animTime: mob.animTime, state: mob.state,
        baby: mob.baby
    };
}

// ====== MOB RENDERING ======
function renderMobs(vp) {
    if (game.mobs.length === 0) return;

    const camX = game.player.x, camZ = game.player.z;

    // Determine visible mobs and check dirty status
    let anyDirty = false;
    const visible = [];
    for (const mob of game.mobs) {
        const ddx = mob.x - camX, ddz = mob.z - camZ;
        const dist = Math.sqrt(ddx * ddx + ddz * ddz);
        if (dist > 80) continue;
        visible.push(mob);
        if (isMobGeomDirty(mob)) anyDirty = true;
    }

    if (visible.length === 0) return;

    // Check if the set of visible mobs changed since last frame
    const frameKey = visible.map(m => m._mobId).join(',');
    const setChanged = frameKey !== _prevMobFrameKey;
    const needsBufferUpdate = anyDirty || setChanged;

    if (needsBufferUpdate) {
        // Rebuild vertex buffer
        mobVertCount = 0;
        for (const mob of visible) {
            if (isMobGeomDirty(mob)) {
                // Dirty mob: rebuild geometry from scratch
                const start = mobVertCount;
                appendMobGeometry(mob);
                const count = mobVertCount - start;
                // Cache vertices for future non-dirty frames
                if (!mob._cachedVerts || mob._cachedVerts.length < count) {
                    mob._cachedVerts = new Float32Array(count);
                }
                mob._cachedVerts.set(mobVertBuffer.subarray(start, start + count));
                mob._cachedVertCount = count;
                saveMobGeomState(mob);
            } else if (mob._cachedVerts && mob._cachedVertCount > 0) {
                // Non-dirty mob: copy cached geometry (skip expensive rebuild)
                ensureMobCapacity(mob._cachedVertCount);
                mobVertBuffer.set(mob._cachedVerts.subarray(0, mob._cachedVertCount), mobVertCount);
                mobVertCount += mob._cachedVertCount;
            }
        }
        _prevMobVertCount = mobVertCount;
        _prevMobFrameKey = frameKey;
    } else {
        // No mob geometry changed and same visible set — reuse previous buffer
        mobVertCount = _prevMobVertCount;
    }

    if (mobVertCount === 0) return;

    game.gl.disable(game.gl.CULL_FACE);   // disabled for rotated game.mobs (prevents "see-through" / inside-out animals)
    game.gl.useProgram(game.mobProgram);
    game.gl.uniformMatrix4fv(mUni.uVP, false, vp);
    game.gl.uniform3f(mUni.uCamPos, game.player.x, game.player.y + 1.62, game.player.z);
    game.gl.uniform1f(mUni.uDaylight, game.daylight);
    game.gl.uniform3f(mUni.uFogColor, game.skyR, game.skyG, game.skyB);

    if (!mobVAO) {
        mobVAO = game.gl.createVertexArray();
        mobVBO = game.gl.createBuffer();
        game.gl.bindVertexArray(mobVAO);
        game.gl.bindBuffer(game.gl.ARRAY_BUFFER, mobVBO);
        game.gl.enableVertexAttribArray(mAPos);
        game.gl.enableVertexAttribArray(mAColor);
        game.gl.enableVertexAttribArray(mANorm);
        game.gl.vertexAttribPointer(mAPos, 3, game.gl.FLOAT, false, 28, 0);
        game.gl.vertexAttribPointer(mAColor, 3, game.gl.FLOAT, false, 28, 12);
        game.gl.vertexAttribPointer(mANorm, 1, game.gl.FLOAT, false, 28, 24);
    } else {
        game.gl.bindVertexArray(mobVAO);
        game.gl.bindBuffer(game.gl.ARRAY_BUFFER, mobVBO);
    }

    // Only upload to GPU when buffer content changed
    if (needsBufferUpdate) {
        game.gl.bufferData(game.gl.ARRAY_BUFFER, mobVertBuffer.subarray(0, mobVertCount), game.gl.DYNAMIC_DRAW);
    }

    game.gl.drawArrays(game.gl.TRIANGLES, 0, mobVertCount / 7);
    game.gl.bindVertexArray(null);
    game.gl.enable(game.gl.CULL_FACE);    // re-enable culling for terrain and everything else
}

// ====== VILLAGER TRADING ======
function getPlayerLookVector() {
    const lookX = -Math.sin(game.player.yaw) * Math.cos(game.player.pitch);
    const lookY = Math.sin(game.player.pitch);
    const lookZ = -Math.cos(game.player.yaw) * Math.cos(game.player.pitch);
    return { x: lookX, y: lookY, z: lookZ };
}

function findTargetVillager(maxDist = 4) {
    const camX = game.player.x;
    const camY = game.player.y + 1.62;
    const camZ = game.player.z;
    const look = getPlayerLookVector();
    let best = null;
    let bestDot = 0.94;
    for (const mob of game.mobs) {
        if (mob.type !== MOB_CANDY_VILLAGER && mob.type !== MOB_GINGER_VILLAGER) continue;
        const dx = mob.x - camX;
        const dy = mob.y + 0.9 - camY;
        const dz = mob.z - camZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > maxDist) continue;
        const dot = (dx * look.x + dy * look.y + dz * look.z) / dist;
        if (dot > bestDot) {
            bestDot = dot;
            best = { mob, dist, dot };
        }
    }
    return best;
}

function openTradePanel(mob) {
    game.tradeTarget = mob;
    const overlay = document.getElementById('trade-overlay');
    const title = document.getElementById('trade-title');
    const list = document.getElementById('trade-list');
    title.textContent = MOB_NAMES[mob.type] + ' Trades';
    list.innerHTML = '';

    for (let ti = 0; ti < mob.trades.length; ti++) {
        const trade = mob.trades[ti];
        const row = document.createElement('div');
        row.className = 'trade-row';

        // Check if game.player can do this trade
        let canDo = canAddItemAfterRemoving(trade.receive.id, trade.receive.count, trade.give);
        for (const g of trade.give) {
            if (countItem(g.id) < g.count) { canDo = false; break; }
        }
        if (canDo) row.classList.add('can-trade');

        // Give items
        const giveSpan = document.createElement('span');
        giveSpan.className = 'trade-text';
        giveSpan.textContent = trade.give.map(g => g.count + ' ' + (BLOCK_NAMES[g.id] || '???')).join(' + ');
        row.appendChild(giveSpan);

        const arrow = document.createElement('span');
        arrow.className = 'trade-arrow';
        arrow.textContent = ' -> ';
        row.appendChild(arrow);

        const rcvIcon = document.createElement('span');
        rcvIcon.className = 'trade-icon';
        setItemIcon(rcvIcon, trade.receive.id);
        row.appendChild(rcvIcon);

        const rcvText = document.createElement('span');
        rcvText.className = 'trade-text';
        rcvText.textContent = ' ' + trade.receive.count + ' ' + (BLOCK_NAMES[trade.receive.id] || '???');
        row.appendChild(rcvText);

        if (canDo) {
            row.addEventListener('click', () => {
                if(!canAddItemAfterRemoving(trade.receive.id, trade.receive.count, trade.give)) {
                    openTradePanel(mob);
                    return;
                }
                // Execute trade
                for (const g of trade.give) removeItem(g.id, g.count);
                addItem(trade.receive.id, trade.receive.count);
                // Quest hook: trade completion
                if (typeof advanceQuest === 'function') advanceQuest('complete-trade');
                openTradePanel(mob); // refresh
                updateHotbar();
            });
        }
        list.appendChild(row);
    }

    overlay.style.display = 'flex';
    if(typeof exitGamePointerLock === 'function') exitGamePointerLock();
    else if(document.exitPointerLock) document.exitPointerLock();
}

function closeTradePanel() {
    game.tradeTarget = null;
    document.getElementById('trade-overlay').style.display = 'none';
    if(typeof requestGamePointerLock === 'function') requestGamePointerLock();
    else if(game.canvas.requestPointerLock) game.canvas.requestPointerLock();
}

const tradeCloseButton = document.getElementById('trade-close');
if(tradeCloseButton) {
    tradeCloseButton.addEventListener('click', closeTradePanel);
}

// Pet panel close button
const petCloseButton = document.getElementById('pet-close');
if(petCloseButton) {
    petCloseButton.addEventListener('click', togglePetPanel);
}

// Pet HUD button
const petHudButton = document.getElementById('pet-btn');
if(petHudButton) {
    petHudButton.addEventListener('click', function () {
        if(game.petPanelOpen) return; // already open
        togglePetPanel();
    });
}

// ====== EATING TREATS ======
// ====== PET TAMING ======
function findTargetMob(maxDist) {
    maxDist = maxDist || 5;
    const camX = game.player.x;
    const camY = game.player.y + 1.62;
    const camZ = game.player.z;
    const look = getPlayerLookVector();
    let best = null;
    let bestDot = 0.9;
    for (const mob of game.mobs) {
        const mobCenterY = mob.y + getMobRenderSize(mob) * 0.5;
        const dx = mob.x - camX;
        const dy = mobCenterY - camY;
        const dz = mob.z - camZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > maxDist) continue;
        const dot = (dx * look.x + dy * look.y + dz * look.z) / dist;
        // Use more generous threshold for close game.mobs
        const threshold = dist < 2.5 ? 0.7 : 0.9;
        if (dot > threshold && dot > bestDot) {
            bestDot = dot;
            best = { mob, dist, dot };
        }
    }
    // If no directional match, check for any untamed animal within 2.5 blocks (closest).
    // Only tameable mobs qualify here — otherwise a nearby tamed pet, villager, or
    // warden would swallow the action and make treats impossible to eat (see input.js).
    if (!best) {
        let closestDist = 2.5;
        for (const mob of game.mobs) {
            if (!isAnimalMob(mob.type) || mob.tamed) continue;
            const dx = mob.x - camX;
            const dz = mob.z - camZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < closestDist) {
                closestDist = dist;
                best = { mob, dist, dot: 0 };
            }
        }
    }
    return best;
}

function tameAnimal(mob) {
    mob.tamed = true;
    mob.petName = MOB_NAMES[mob.type];
    mob.state = 'follow';
    mob.stateTimer = 999;
    game.tamedPets.push(mob);

    // Taming game.particles
    for (let i = 0; i < 12; i++) {
        spawnParticle(
            mob.x + (Math.random() - 0.5) * 1.5,
            mob.y + 0.5 + Math.random() * 1.5,
            mob.z + (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 2,
            Math.random() * 3,
            (Math.random() - 0.5) * 2,
            [1.0, 0.41, 0.71, 1.0],
            0.8 + Math.random() * 0.6
        );
    }

    // Unicorn special effects: sparkle game.particles + rainbow effect
    if (mob.type === MOB_UNICORN) {
        for (let i = 0; i < 40; i++) {
            const hue = (i / 40) * 360;
            const r = Math.sin(hue * Math.PI / 180) * 0.5 + 0.5;
            const g = Math.sin((hue + 120) * Math.PI / 180) * 0.5 + 0.5;
            const b = Math.sin((hue + 240) * Math.PI / 180) * 0.5 + 0.5;
            spawnParticle(
                mob.x + (Math.random() - 0.5) * 3,
                mob.y + Math.random() * 3,
                mob.z + (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 4,
                Math.random() * 5,
                (Math.random() - 0.5) * 4,
                [r, g, b, 1.0],
                1.5 + Math.random() * 1.0
            );
        }
        // Add sparkle effect to game.player
        addEffect(EFFECT_SPARKLE, 10);
    }

    // Quest hooks for taming
    if (typeof advanceQuest === 'function') {
        advanceQuest('tame-animal');
        if (mob.type === MOB_UNICORN) {
            advanceQuest('tame-unicorn');
        }
    }

    if (typeof scheduleSaveGame === 'function') scheduleSaveGame();
    updatePetPanel();
}

function renamePet(mob, newName) {
    mob.petName = newName || MOB_NAMES[mob.type];
    if (typeof scheduleSaveGame === 'function') scheduleSaveGame();
}

function updatePetPanel() {
    const list = document.getElementById('pet-list');
    const emptyMsg = document.getElementById('pet-list-empty');
    if (!list) return;

    if (emptyMsg) {
        emptyMsg.style.display = game.tamedPets.length === 0 ? 'block' : 'none';
    }

    list.innerHTML = '';
    for (let i = 0; i < game.tamedPets.length; i++) {
        const pet = game.tamedPets[i];
        const row = document.createElement('div');
        row.className = 'pet-row';

        // Pet species icon (colored square)
        const icon = document.createElement('div');
        icon.className = 'pet-icon';
        icon.style.backgroundColor = BLOCK_COLORS[ITEM_CUPCAKE + pet.type] || '#FF69B4';
        row.appendChild(icon);

        // Pet species label
        const species = document.createElement('span');
        species.className = 'pet-species';
        species.textContent = MOB_NAMES[pet.type];
        row.appendChild(species);

        // Editable name input
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'pet-name-input';
        nameInput.value = pet.petName;
        nameInput.maxLength = 20;
        nameInput.addEventListener('change', function () {
            renamePet(pet, this.value);
        });
        nameInput.addEventListener('keydown', function (e) {
            e.stopPropagation(); // prevent game game.keys while typing
        });
        row.appendChild(nameInput);

        list.appendChild(row);
    }
}

function togglePetPanel() {
    game.petPanelOpen = !game.petPanelOpen;
    const overlay = document.getElementById('pet-overlay');
    if (game.petPanelOpen) {
        updatePetPanel();
        overlay.style.display = 'flex';
        if (typeof exitGamePointerLock === 'function') exitGamePointerLock();
        else if (document.exitPointerLock) document.exitPointerLock();
    } else {
        overlay.style.display = 'none';
        if (typeof requestGamePointerLock === 'function') requestGamePointerLock();
        else if (game.canvas.requestPointerLock) game.canvas.requestPointerLock();
    }
}

// ====== NAME TAG RENDERING ======
function projectToScreen(wx, wy, wz, vp) {
    const x = vp[0] * wx + vp[4] * wy + vp[8] * wz + vp[12];
    const y = vp[1] * wx + vp[5] * wy + vp[9] * wz + vp[13];
    const z = vp[2] * wx + vp[6] * wy + vp[10] * wz + vp[14];
    const w = vp[3] * wx + vp[7] * wy + vp[11] * wz + vp[15];
    if (w <= 0.01) return null;
    const ndcX = x / w;
    const ndcY = y / w;
    return {
        x: (ndcX + 1) * 0.5 * window.innerWidth,
        y: (1 - ndcY) * 0.5 * window.innerHeight,
        z: z / w
    };
}

function updateNameTags(vp) {
    const container = document.getElementById('name-tags');
    if (!container) return;

    // Sync game.tamedPets array with actual game.mobs (remove dead references)
    for (let i = game.tamedPets.length - 1; i >= 0; i--) {
        if (!game.mobs.includes(game.tamedPets[i])) {
            game.tamedPets.splice(i, 1);
        }
    }

    // Build or update tags
    const existing = container.children;
    const needed = game.tamedPets.length;

    // Add or remove tag elements to match game.tamedPets count
    while (existing.length < needed) {
        const tag = document.createElement('div');
        tag.className = 'name-tag';
        container.appendChild(tag);
    }
    while (existing.length > needed) {
        container.removeChild(container.lastChild);
    }

    for (let i = 0; i < game.tamedPets.length; i++) {
        const pet = game.tamedPets[i];
        const tag = existing[i];
        const dx = pet.x - game.player.x;
        const dz = pet.z - game.player.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > 80 * 80) {
            tag.style.display = 'none';
            continue;
        }

        const mobSize = getMobRenderSize(pet);
        const screen = projectToScreen(pet.x, pet.y + mobSize + 0.3, pet.z, vp);
        if (!screen || screen.z < -1 || screen.z > 1) {
            tag.style.display = 'none';
            continue;
        }

        tag.style.display = 'block';
        tag.textContent = pet.petName;
        tag.style.left = screen.x + 'px';
        tag.style.top = screen.y + 'px';

        // Fade with distance
        const dist = Math.sqrt(distSq);
        const alpha = dist > 40 ? Math.max(0, 1 - (dist - 40) / 40) : 1;
        tag.style.opacity = alpha;
    }
}

function eatTreat(treatId) {
    switch (treatId) {
        case ITEM_CUPCAKE:
            restorePlayerHealth(6);
            restorePlayerHunger(4);
            break;
        case ITEM_COOKIE:
            restorePlayerHunger(2);
            addEffect(EFFECT_SPEED, 10);
            break;
        case ITEM_CANDY:
            restorePlayerHunger(1);
            addEffect(EFFECT_SPARKLE, 15);
            break;
        case ITEM_LOLLIPOP:
            restorePlayerHunger(3);
            addEffect(EFFECT_JUMP, 20);
            break;
    }
    // Spawn burst of game.particles when eating
    for (let i = 0; i < 8; i++) {
        spawnParticle(
            game.player.x + (Math.random()-0.5)*0.5, game.player.y + 1.5, game.player.z + (Math.random()-0.5)*0.5,
            (Math.random()-0.5)*2, Math.random()*3, (Math.random()-0.5)*2,
            [1.0, 0.41, 0.71, 1.0], 0.5 + Math.random()*0.5
        );
    }
}
