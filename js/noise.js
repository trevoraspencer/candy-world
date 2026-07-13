'use strict';

// ====== NOISE ======
function hash2D(x, y) {
    if(typeof game!=='undefined'&&game.generatorVersion>=2&&game.worldSeed){const offset=CandyCore.mixSeed(game.worldSeed,'terrain');x+=offset&65535;y+=(offset>>>16)&65535;}
    let n = ((x * 374761393 + y * 668265263) | 0);
    n = (((n ^ (n >> 13)) * 1274126177) | 0);
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}
function noise2D(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2D(ix, iy), b = hash2D(ix+1, iy);
    const c = hash2D(ix, iy+1), d = hash2D(ix+1, iy+1);
    return a + (b-a)*sx + (c-a)*sy + (a-b-c+d)*sx*sy;
}
function fbm2D(x, y, octaves) {
    let val = 0, amp = 1, freq = 1, total = 0;
    for(let i = 0; i < octaves; i++) {
        val += noise2D(x * freq, y * freq) * amp;
        total += amp; amp *= 0.5; freq *= 2;
    }
    return val / total;
}
function hash3D(x, y, z) {
    if(typeof game!=='undefined'&&game.generatorVersion>=2&&game.worldSeed){const offset=CandyCore.mixSeed(game.worldSeed,'terrain-3d');x+=offset&1023;y+=(offset>>>10)&1023;z+=(offset>>>20)&1023;}
    let n = ((x * 374761393 + y * 668265263 + z * 1013904223) | 0);
    n = (((n ^ (n >> 13)) * 1274126177) | 0);
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}
function noise3D(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x-ix, fy = y-iy, fz = z-iz;
    const sx = fx*fx*(3-2*fx), sy = fy*fy*(3-2*fy), sz = fz*fz*(3-2*fz);
    const v000=hash3D(ix,iy,iz), v100=hash3D(ix+1,iy,iz);
    const v010=hash3D(ix,iy+1,iz), v110=hash3D(ix+1,iy+1,iz);
    const v001=hash3D(ix,iy,iz+1), v101=hash3D(ix+1,iy,iz+1);
    const v011=hash3D(ix,iy+1,iz+1), v111=hash3D(ix+1,iy+1,iz+1);
    const a = v000+(v100-v000)*sx, b = v010+(v110-v010)*sx;
    const c = v001+(v101-v001)*sx, d = v011+(v111-v011)*sx;
    const e = a+(b-a)*sy, f = c+(d-c)*sy;
    return e+(f-e)*sz;
}
