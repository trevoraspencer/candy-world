'use strict';

// ====== WEBGL SETUP ======
game.canvas = document.getElementById('game');
function resizeCanvas() {
    const { cssWidth, cssHeight, width, height, cappedDpr, renderScale, pixelRatio } = CandyCore.computeRenderSize(
        window.innerWidth, window.innerHeight, window.devicePixelRatio,
        game.settings.renderScale, game.settings.maxDevicePixelRatio
    );
    if(game.canvas.width !== width) game.canvas.width = width;
    if(game.canvas.height !== height) game.canvas.height = height;
    game.canvas.style.width = cssWidth + 'px';
    game.canvas.style.height = cssHeight + 'px';
    if(game.gl) game.gl.viewport(0, 0, game.canvas.width, game.canvas.height);
    game.projMatrix = mat4_perspective(Math.PI / 180 * game.settings.fov, game.canvas.width / game.canvas.height, 0.1, 200);
    game.renderMetrics = { cssWidth, cssHeight, width, height, cappedDpr, renderScale, pixelRatio };
}
function setRenderScale(scale) {
    const allowed = [0.5, 0.75, 1];
    const numeric = Number(scale);
    game.settings.renderScale = allowed.reduce((best, value) =>
        Math.abs(value - numeric) < Math.abs(best - numeric) ? value : best, 1);
    resizeCanvas();
    if(typeof scheduleSaveGame === 'function') scheduleSaveGame();
    return game.settings.renderScale;
}
window.addEventListener('resize', resizeCanvas);
document.addEventListener('fullscreenchange', resizeCanvas);
resizeCanvas();

game.gl = game.canvas.getContext('webgl2', { alpha: false, antialias: false });
if(!game.gl) {
    document.getElementById('loading').innerHTML = '<h1 style="color:#fff">WebGL2 not supported!</h1><p style="color:#fff">Please use a modern browser.</p>';
    throw new Error('No WebGL2');
}

game.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    const loading = document.getElementById('loading');
    if(loading) {
        loading.style.display = 'flex';
        loading.style.opacity = '1';
        loading.innerHTML = '<h1 style="color:#fff">Graphics context lost</h1><p style="color:#fff">Restoring the game...</p>';
    }
}, false);

game.canvas.addEventListener('webglcontextrestored', () => {
    // Flush the latest state before reloading so block edits made after
    // the last debounced save aren't lost on the round-trip.
    if(typeof saveGameNow === 'function') saveGameNow();
    window.location.reload();
}, false);

function compileShader(src, type) {
    const s = game.gl.createShader(type);
    game.gl.shaderSource(s, src);
    game.gl.compileShader(s);
    if(!game.gl.getShaderParameter(s, game.gl.COMPILE_STATUS)) {
        console.error('Shader error:', game.gl.getShaderInfoLog(s), '\n', src);
        game.gl.deleteShader(s);
        return null;
    }
    return s;
}
function createProgram(vSrc, fSrc) {
    const v = compileShader(vSrc, game.gl.VERTEX_SHADER);
    const f = compileShader(fSrc, game.gl.FRAGMENT_SHADER);
    if(!v || !f) return null;
    const p = game.gl.createProgram();
    game.gl.attachShader(p, v); game.gl.attachShader(p, f);
    game.gl.linkProgram(p);
    if(!game.gl.getProgramParameter(p, game.gl.LINK_STATUS)) {
        console.error('Link error:', game.gl.getProgramInfoLog(p));
        return null;
    }
    return p;
}

// ====== SHARED GLSL CONSTANTS ======
// Shared snippets used by multiple shader programs to eliminate duplicate boilerplate.

const GLSL_PREAMBLE = '#version 300 es\nprecision highp float;\n';

// Vertex shader: uVP matrix declaration and standard transform
const GLSL_UVP_DECL = 'uniform mat4 uVP;\n';
const GLSL_TRANSFORM = '    gl_Position = uVP * vec4(aPos, 1.0);\n';

// Vertex shader: camera position + fog varying declarations
const GLSL_CAM_DECL = 'uniform vec3 uCamPos;\n';
const GLSL_FOG_VARYING_OUT = 'out float vFog;\n';

// Fragment shader: fog varying input + daylight/fog color declarations
const GLSL_FOG_VARYING_IN = 'in float vFog;\n';
const GLSL_DAYLIGHT_FOG_DECL = 'uniform float uDaylight;\nuniform vec3 uFogColor;\n';

// Fragment shader: apply fog to color (assumes 'color' vec3 is defined)
const GLSL_APPLY_FOG = '    color = mix(color, uFogColor, vFog);\n';

/**
 * Generate fog distance + clamp calculation GLSL code.
 * @param {string} posExpr - GLSL position expression (e.g. 'aPos' or 'pos')
 * @returns {string} GLSL code computing distance and fog factor
 */
function fogCalc(posExpr) {
    return '    float dist = distance(' + posExpr + ', uCamPos);\n    vFog = clamp((dist - 40.0) / 25.0, 0.0, 1.0);\n';
}

/**
 * Generate normal-based directional lighting if/else chain GLSL code.
 * @param {string} base  - Default light value
 * @param {string} top   - +Y (up) light value
 * @param {string} bottom - -Y (down) light value
 * @param {string} posX  - +X light value
 * @param {string} negX  - -X light value
 * @param {string} negZ  - -Z light value
 * @param {string} posZ  - +Z light value
 * @returns {string} GLSL code for normal-based lighting
 */
function makeNormalLighting(base, top, bottom, posX, negX, negZ, posZ) {
    return '    float nIdx = aNorm;\n' +
           '    float light = ' + base + ';\n' +
           '    if(nIdx > 2.5 && nIdx < 3.5) light = ' + top + ';      // +Y top\n' +
           '    else if(nIdx > 1.5 && nIdx < 2.5) light = ' + bottom + ';  // -Y bottom\n' +
           '    else if(nIdx > 0.5 && nIdx < 1.5) light = ' + posX + ';    // +X\n' +
           '    else if(nIdx < 0.5) light = ' + negX + ';                    // -X\n' +
           '    else if(nIdx > 3.5 && nIdx < 4.5) light = ' + negZ + ';     // -Z\n' +
           '    else light = ' + posZ + ';                                    // +Z\n';
}

/**
 * Extract uniform locations from a WebGL program into an object.
 * @param {WebGLProgram} program - The compiled shader program
 * @param {string[]} names - Array of uniform names to extract
 * @returns {Object} Object mapping uniform names to their WebGL locations
 */
function getUniforms(program, names) {
    const u = {};
    for (const name of names) {
        u[name] = game.gl.getUniformLocation(program, name);
    }
    return u;
}

// ====== SHADERS ======
// Each shader composes from shared GLSL constants + unique-specific code.
// Terrain, water, mob shaders share fog, lighting, and daylight application.

// Terrain shader
const terrainVS = GLSL_PREAMBLE +
    'in vec3 aPos;\nin vec2 aUV;\nin float aNorm;\nin float aAO;\nin vec2 aLight;\n' +
    GLSL_UVP_DECL +
    GLSL_CAM_DECL +
    'uniform vec3 uSunDir;\nout vec2 vUV;\nout float vLight;\nout vec2 vVoxelLight;\n' +
    GLSL_FOG_VARYING_OUT +
    'void main() {\n' +
    GLSL_TRANSFORM +
    '    vUV = aUV;\n' +
    '    vec3 normal = aNorm < 0.5 ? vec3(-1,0,0) : aNorm < 1.5 ? vec3(1,0,0) : aNorm < 2.5 ? vec3(0,-1,0) : aNorm < 3.5 ? vec3(0,1,0) : aNorm < 4.5 ? vec3(0,0,-1) : vec3(0,0,1);\n' +
    '    float light = 0.48 + max(0.0, dot(normal, normalize(uSunDir))) * 0.52;\n' +
    '    float ao = 1.0 - aAO * 0.2;\n' +
    '    vLight = light * ao;\n' +
    '    vVoxelLight = aLight;\n' +
    fogCalc('aPos') +
    '}\n';

const terrainFS = GLSL_PREAMBLE +
    'in vec2 vUV;\nin float vLight;\nin vec2 vVoxelLight;\n' +
    GLSL_FOG_VARYING_IN +
    'uniform sampler2D uAtlas;\n' +
    GLSL_DAYLIGHT_FOG_DECL +
    'out vec4 fragColor;\n' +
    'void main() {\n' +
    '    vec4 tex = texture(uAtlas, vUV);\n' +
    '    if(tex.a < 0.01) discard;\n' +
    '    float illumination = max(0.045, max(vVoxelLight.x * uDaylight, vVoxelLight.y));\n' +
    '    vec3 linearColor = pow(tex.rgb, vec3(2.2)) * vLight * illumination;\n' +
    '    vec3 color = pow(max(linearColor, vec3(0.0)), vec3(1.0 / 2.2));\n' +
    GLSL_APPLY_FOG +
    '    fragColor = vec4(color, tex.a);\n' +
    '}\n';

// Water shader (same structure as terrain but with alpha and wave offset)
const waterVS = GLSL_PREAMBLE +
    'in vec3 aPos;\nin vec2 aUV;\nin float aNorm;\nin float aAO;\nin vec2 aLight;\nin float aMaterial;\n' +
    GLSL_UVP_DECL +
    GLSL_CAM_DECL +
    'uniform float uTime;\nout vec2 vUV;\nout float vLight;\nout vec2 vVoxelLight;\nout float vMaterial;\n' +
    GLSL_FOG_VARYING_OUT +
    'void main() {\n' +
    '    vec3 pos = aPos;\n' +
    '    if(aMaterial < 0.5) pos.y -= 0.08 + sin(aPos.x * 0.7 + aPos.z * 0.5 + uTime * 1.6) * 0.025;\n' +
    '    gl_Position = uVP * vec4(pos, 1.0);\n' +
    '    vUV = aUV + (aMaterial < 0.5 ? vec2(uTime * 0.003, sin(uTime * 0.7 + aPos.x) * 0.0008) : vec2(0.0));\n' +
    '    vLight = 0.8;\n' +
    '    vMaterial = aMaterial;\n' +
    '    vVoxelLight = aLight;\n' +
    fogCalc('pos') +
    '}\n';

const waterFS = GLSL_PREAMBLE +
    'in vec2 vUV;\nin float vLight;\nin vec2 vVoxelLight;\nin float vMaterial;\n' +
    GLSL_FOG_VARYING_IN +
    'uniform sampler2D uAtlas;\n' +
    GLSL_DAYLIGHT_FOG_DECL +
    'out vec4 fragColor;\n' +
    'void main() {\n' +
    '    vec4 tex = texture(uAtlas, vUV);\n' +
    '    float illumination = max(0.06, max(vVoxelLight.x * uDaylight, vVoxelLight.y));\n' +
    '    vec3 color = pow(pow(tex.rgb, vec3(2.2)) * vLight * illumination, vec3(1.0 / 2.2));\n' +
    GLSL_APPLY_FOG +
    '    float alpha = vMaterial < 0.5 ? 0.58 : max(0.18, tex.a * 0.72);\n' +
    '    fragColor = vec4(color, alpha);\n' +
    '}\n';

// Line shader (minimal: uVP transform only)
const lineVS = GLSL_PREAMBLE +
    'in vec3 aPos;\n' +
    GLSL_UVP_DECL +
    'void main() {\n' +
    GLSL_TRANSFORM +
    '}\n';

const lineFS = GLSL_PREAMBLE +
    'uniform vec4 uColor;\nout vec4 fragColor;\n' +
    'void main() {\n' +
    '    fragColor = uColor;\n' +
    '}\n';

// Mob shader (lighting + fog, no atlas texturing)
const mobVS = GLSL_PREAMBLE +
    'in vec3 aPos;\nin vec3 aColor;\nin float aNorm;\n' +
    GLSL_UVP_DECL +
    GLSL_CAM_DECL +
    'out vec3 vColor;\nout float vLight;\n' +
    GLSL_FOG_VARYING_OUT +
    'void main() {\n' +
    GLSL_TRANSFORM +
    '    vColor = aColor;\n' +
    makeNormalLighting('0.62', '1.0', '0.45', '0.72', '0.68', '0.82', '0.77') +
    fogCalc('aPos') +
    '    vLight = light;\n' +
    '}\n';

const mobFS = GLSL_PREAMBLE +
    'in vec3 vColor;\nin float vLight;\n' +
    GLSL_FOG_VARYING_IN +
    GLSL_DAYLIGHT_FOG_DECL +
    'out vec4 fragColor;\n' +
    'void main() {\n' +
    '    vec3 color = vColor * vLight * uDaylight;\n' +
    GLSL_APPLY_FOG +
    '    fragColor = vec4(color, 1.0);\n' +
    '}\n';

game.terrainProgram = createProgram(terrainVS, terrainFS);
const waterProgram = createProgram(waterVS, waterFS);
game.lineProgram = createProgram(lineVS, lineFS);
game.mobProgram = createProgram(mobVS, mobFS);
if(!game.terrainProgram || !waterProgram || !game.lineProgram || !game.mobProgram) {
    throw new Error('Failed to create required WebGL shader programs');
}

// Get uniform locations via shared helper
const tUni = getUniforms(game.terrainProgram, ['uVP', 'uCamPos', 'uAtlas', 'uDaylight', 'uFogColor', 'uSunDir']);
const wUni = getUniforms(waterProgram, ['uVP', 'uCamPos', 'uAtlas', 'uDaylight', 'uFogColor', 'uTime']);
const lUni = getUniforms(game.lineProgram, ['uVP', 'uColor']);
const mUni = getUniforms(game.mobProgram, ['uVP', 'uCamPos', 'uDaylight', 'uFogColor']);

// Attribute locations (cached once after link — don't query inside hot loops)
const tAPos = game.gl.getAttribLocation(game.terrainProgram, 'aPos');
const tAUV = game.gl.getAttribLocation(game.terrainProgram, 'aUV');
const tANorm = game.gl.getAttribLocation(game.terrainProgram, 'aNorm');
const tAAO = game.gl.getAttribLocation(game.terrainProgram, 'aAO');
const tALight = game.gl.getAttribLocation(game.terrainProgram, 'aLight');
const wAPos = game.gl.getAttribLocation(waterProgram, 'aPos');
const wAUV = game.gl.getAttribLocation(waterProgram, 'aUV');
const wANorm = game.gl.getAttribLocation(waterProgram, 'aNorm');
const wAAO = game.gl.getAttribLocation(waterProgram, 'aAO');
const wALight = game.gl.getAttribLocation(waterProgram, 'aLight');
const wAMaterial = game.gl.getAttribLocation(waterProgram, 'aMaterial');
const lAPos = game.gl.getAttribLocation(game.lineProgram, 'aPos');
const mAPos = game.gl.getAttribLocation(game.mobProgram, 'aPos');
const mAColor = game.gl.getAttribLocation(game.mobProgram, 'aColor');
const mANorm = game.gl.getAttribLocation(game.mobProgram, 'aNorm');

game.gl.enable(game.gl.DEPTH_TEST);
game.gl.enable(game.gl.CULL_FACE);
game.gl.cullFace(game.gl.BACK);
game.gl.clearColor(1.0, 0.82, 0.86, 1.0); // #FFD1DC

// Full-screen procedural sky: gradient, wafer sun, peppermint moon and stars.
const skyProgram = createProgram(
    GLSL_PREAMBLE +
    'out vec2 vUV;\nvoid main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUV=p*0.5; gl_Position=vec4(p*2.0-1.0,1.0,1.0); }\n',
    GLSL_PREAMBLE +
    'in vec2 vUV; uniform vec3 uTop; uniform vec3 uHorizon; uniform float uDayT; uniform float uDaylight; out vec4 fragColor;\n' +
    'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\n' +
    'void main(){ vec2 uv=vUV; vec3 color=mix(uHorizon,uTop,smoothstep(0.0,1.0,uv.y));\n' +
    'float angle=(uDayT-0.25)*6.2831853; vec2 sun=vec2(0.5+cos(angle)*0.37,0.2+sin(angle)*0.58); vec2 moon=vec2(1.0)-sun;\n' +
    'float sd=length(uv-sun); float md=length(uv-moon); float wafer=step(0.5,fract((uv.x+uv.y)*95.0));\n' +
    'color=mix(color,mix(vec3(1.0,0.74,0.28),vec3(1.0,0.9,0.58),wafer),smoothstep(0.075,0.055,sd)*smoothstep(-0.1,0.08,sin(angle)));\n' +
    'float mint=step(0.5,fract(atan(uv.y-moon.y,uv.x-moon.x)*5.0/3.14159)); color=mix(color,mix(vec3(0.96,0.93,1.0),vec3(0.9,0.22,0.46),mint),smoothstep(0.065,0.048,md)*smoothstep(0.1,-0.08,sin(angle)));\n' +
    'float star=step(0.9975,hash(floor(uv*vec2(520.0,290.0)))); color+=vec3(star*(1.0-uDaylight)*0.75); fragColor=vec4(color,1.0); }\n'
);
if(!skyProgram) throw new Error('Failed to create sky shader program');
const skyUni = getUniforms(skyProgram, ['uTop','uHorizon','uDayT','uDaylight']);
const skyVAO = game.gl.createVertexArray();

// ====== TEXTURE ATLAS GENERATION ======
function generateAtlas() {
    const size = 256;
    const tileSize = 16;
    const c2d = document.createElement('canvas');
    c2d.width = size; c2d.height = size;
    const ctx = c2d.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function tileXY(idx) {
        return [(idx % 16) * tileSize, Math.floor(idx / 16) * tileSize];
    }

    function fillTile(idx, baseColor) {
        const [tx, ty] = tileXY(idx);
        ctx.fillStyle = baseColor;
        ctx.fillRect(tx, ty, tileSize, tileSize);
    }

    function addNoise(idx, colors, density) {
        const [tx, ty] = tileXY(idx);
        for(let py = 0; py < tileSize; py++) {
            for(let px = 0; px < tileSize; px++) {
                if(hash2D(px + idx*100, py + idx*200) < density) {
                    ctx.fillStyle = colors[Math.floor(hash2D(px*7+idx, py*13+idx) * colors.length)];
                    ctx.fillRect(tx+px, ty+py, 1, 1);
                }
            }
        }
    }

    function addOreSpecks(idx, baseColor, oreColor) {
        fillTile(idx, baseColor);
        addNoise(idx, ['#E8C0D0', '#D8B0C0'], 0.15);
        const [tx, ty] = tileXY(idx);
        for(let i = 0; i < 6; i++) {
            const px = Math.floor(hash2D(i*31+idx, i*47) * 14) + 1;
            const py = Math.floor(hash2D(i*53+idx, i*71) * 14) + 1;
            ctx.fillStyle = oreColor;
            ctx.fillRect(tx+px, ty+py-1, 1, 4);
            ctx.fillRect(tx+px-1, ty+py, 3, 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(tx+px, ty+py-1, 1, 1);
        }
    }

    function drawMarshmallowStone(idx, variant) {
        fillTile(idx, ['#E9D9E2','#E3D2DE','#F0E2E8','#DDCBD8'][variant]);
        const [tx, ty] = tileXY(idx);
        ctx.fillStyle = '#BFA8B8';
        for(let i = 0; i < 7; i++) {
            const px = 1 + Math.floor(hash2D(idx*19+i*41, 7) * 13);
            const py = 1 + Math.floor(hash2D(idx*23+i*37, 11) * 13);
            ctx.fillRect(tx+px,ty+py,2,1);
            if(i % 2 === 0) ctx.fillRect(tx+px,ty+py+1,1,1);
        }
        ctx.fillStyle = '#FFF6FA';
        ctx.fillRect(tx+2+variant,ty+3,4,1);
        ctx.fillRect(tx+11-variant,ty+10,2,1);
    }

    function drawGrahamCrumb(idx, variant) {
        fillTile(idx, ['#B87845','#A96839','#C48751','#9B5C34'][variant]);
        const [tx, ty] = tileXY(idx);
        ctx.fillStyle = '#704026';
        ctx.fillRect(tx, ty+7+(variant%2), 16, 1);
        for(let i = 0; i < 11; i++) {
            const px = Math.floor(hash2D(idx*31+i*13, 17) * 16);
            const py = Math.floor(hash2D(idx*47+i*29, 19) * 16);
            ctx.fillRect(tx+px,ty+py,1+(i%3===0?1:0),1);
        }
        ctx.fillStyle = '#E0AC72';
        for(let x=2+(variant%2);x<16;x+=5) ctx.fillRect(tx+x,ty+3,1,1);
    }

    function drawWafer(idx, variant, side) {
        if(side) drawGrahamCrumb(idx, variant);
        else fillTile(idx, ['#F36F9B','#EA638E','#FF82AA','#D95882'][variant]);
        const [tx, ty] = tileXY(idx);
        if(side) {
            ctx.fillStyle = '#F36F9B'; ctx.fillRect(tx,ty,16,3);
            for(let x=variant;x<16;x+=4) ctx.fillRect(tx+x,ty+3,2,1+(x%3));
        } else {
            ctx.strokeStyle = '#B83E68'; ctx.lineWidth = 1;
            for(let p=variant%2;p<16;p+=4) {
                ctx.beginPath(); ctx.moveTo(tx+p,ty); ctx.lineTo(tx+p,ty+16); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(tx,ty+p); ctx.lineTo(tx+16,ty+p); ctx.stroke();
            }
            ctx.fillStyle='#FFD4E2'; ctx.fillRect(tx+2+variant,ty+2,2,1);
        }
    }

    // Tile 0: Stone
    drawMarshmallowStone(0, 0);

    // Tile 1: Dirt
    drawGrahamCrumb(1, 0);

    // Tile 2: Grass top
    drawWafer(2, 0, false);

    // Tile 3: Grass side (dirt with grass strip on top)
    drawWafer(3, 0, true);

    // Tile 4: Sand
    fillTile(4, '#FFF8F0');
    addNoise(4, ['#FFFDF8', '#F9F1E5', '#F4E8DA'], 0.22);

    // Tile 5: Water
    fillTile(5, '#FF9FD1');
    {
        const [tx, ty] = tileXY(5);
        for(let py = 0; py < tileSize; py++) {
            for(let px = 0; px < tileSize; px++) {
                if((px + py * 2) % 8 < 2) {
                    ctx.fillStyle = 'rgba(255,240,246,0.7)';
                    ctx.fillRect(tx+px, ty+py, 1, 1);
                } else if((px * 3 + py) % 11 === 0) {
                    ctx.fillStyle = 'rgba(255,120,190,0.35)';
                    ctx.fillRect(tx+px, ty+py, 1, 1);
                }
            }
        }
    }

    // Tile 6: Wood bark
    fillTile(6, '#70402C');
    {
        const [tx, ty] = tileXY(6);
        for(let px = 0; px < tileSize; px += 3) {
            ctx.fillStyle = px % 2 ? '#43251C' : '#9B6042';
            ctx.fillRect(tx+px, ty, 1, tileSize);
        }
        addNoise(6, ['#B77A55'], 0.08);
    }

    // Tile 7: Wood top (rings)
    fillTile(7, '#8A5337');
    {
        const [tx, ty] = tileXY(7);
        const cx = 8, cy = 8;
        for(let py = 0; py < tileSize; py++) {
            for(let px = 0; px < tileSize; px++) {
                const d = Math.sqrt((px-cx)*(px-cx)+(py-cy)*(py-cy));
                if(Math.floor(d) % 3 === 0) {
                    ctx.fillStyle = d < 4 ? '#D09468' : '#4A291F';
                    ctx.fillRect(tx+px, ty+py, 1, 1);
                }
            }
        }
    }

    // Tile 8: Leaves (red/white candy cane diagonal stripes)
    {
        const [tx, ty] = tileXY(8);
        for(let py = 0; py < tileSize; py++) {
            for(let px = 0; px < tileSize; px++) {
                ctx.fillStyle = ((px + py) % 6 < 3) ? '#FF0000' : '#FFFFFF';
                ctx.fillRect(tx+px, ty+py, 1, 1);
            }
        }
    }

    // Tile 9: Snow (red)
    fillTile(9, '#FF2222');
    addNoise(9, ['#FF4444', '#EE1111', '#FF3333'], 0.15);

    // Tile 10-15: Ores
    addOreSpecks(10, '#F5D5E0', '#FFFFFF');    // Iron
    addOreSpecks(11, '#F5D5E0', '#8B6914');    // Gold
    addOreSpecks(12, '#F5D5E0', '#87CEEB');    // Lapis
    addOreSpecks(13, '#F5D5E0', '#C71585');    // Redstone
    addOreSpecks(14, '#F5D5E0', '#D2A679');    // Diamond
    addOreSpecks(15, '#F5D5E0', '#D3D3D3');    // Netherite

    // Tile 16: Frosting White
    fillTile(16, '#FFFAFA');
    {
        const [tx, ty] = tileXY(16);
        for(let px = 0; px < tileSize; px += 4) {
            const dripLen = Math.floor(hash2D(px, 1616) * 4) + 2;
            ctx.fillStyle = '#F0E8EA';
            ctx.fillRect(tx+px, ty + tileSize - dripLen, 2, dripLen);
        }
    }

    // Tile 17: Frosting Brown
    fillTile(17, '#7B3F00');
    addNoise(17, ['#6B3500', '#8B4500'], 0.15);

    // Tile 18: Frosting Pink
    fillTile(18, '#FF69B4');
    addNoise(18, ['#FF5AA0', '#FF79C4'], 0.1);

    // Tile 19: Sprinkle
    fillTile(19, '#FFB6C1');
    {
        const [tx, ty] = tileXY(19);
        const sprinkleColors = ['#FF0000','#00FF00','#0000FF','#FFFF00','#FF00FF','#00FFFF','#FF8800'];
        for(let i = 0; i < 20; i++) {
            const px = Math.floor(hash2D(i*17, 1919) * tileSize);
            const py = Math.floor(hash2D(i*31, 1920) * tileSize);
            ctx.fillStyle = sprinkleColors[i % sprinkleColors.length];
            ctx.fillRect(tx+px, ty+py, 2, 1);
        }
    }

    // Tile 20: Candy Cane (diagonal stripes)
    {
        const [tx, ty] = tileXY(20);
        for(let py = 0; py < tileSize; py++) {
            for(let px = 0; px < tileSize; px++) {
                ctx.fillStyle = ((px + py) % 8 < 4) ? '#FF2222' : '#FFFFFF';
                ctx.fillRect(tx+px, ty+py, 1, 1);
            }
        }
    }

    // Tile 21: Candy Cane Pillar (vertical stripes)
    {
        const [tx, ty] = tileXY(21);
        for(let py = 0; py < tileSize; py++) {
            for(let px = 0; px < tileSize; px++) {
                ctx.fillStyle = (px % 6 < 3) ? '#FF2222' : '#FFFFFF';
                ctx.fillRect(tx+px, ty+py, 1, 1);
            }
        }
    }

    // Tile 22: Planks
    fillTile(22, '#FADCE6');
    {
        const [tx, ty] = tileXY(22);
        for(let py = 0; py < tileSize; py += 4) {
            ctx.fillStyle = '#E8C0D0';
            ctx.fillRect(tx, ty+py, tileSize, 1);
        }
        addNoise(22, ['#EDD0DA'], 0.05);
    }

    // Tile 23: Glass
    fillTile(23, 'rgba(255,224,236,0.3)');
    {
        const [tx, ty] = tileXY(23);
        ctx.strokeStyle = '#FFD0E0';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx+0.5, ty+0.5, tileSize-1, tileSize-1);
        // cross highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(tx+2, ty+2, 4, 4);
    }

    // Tile 24: Crafting Table top
    fillTile(24, '#E8B4C8');
    {
        const [tx, ty] = tileXY(24);
        ctx.strokeStyle = '#8B0045';
        ctx.lineWidth = 1;
        for(let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(tx + i*4, ty); ctx.lineTo(tx + i*4, ty + tileSize);
            ctx.moveTo(tx, ty + i*4); ctx.lineTo(tx + tileSize, ty + i*4);
            ctx.stroke();
        }
    }

    // Tile 25: Crafting Table side
    fillTile(25, '#FADCE6');
    addNoise(25, ['#E8C0D0'], 0.1);
    {
        const [tx, ty] = tileXY(25);
        ctx.fillStyle = '#C08090';
        ctx.fillRect(tx+4, ty+4, 8, 8);
        ctx.fillStyle = '#E8B4C8';
        ctx.fillRect(tx+5, ty+5, 6, 6);
    }

    // Tile 26: Furnace front
    fillTile(26, '#F5D5E0');
    addNoise(26, ['#E8C0D0'], 0.1);
    {
        const [tx, ty] = tileXY(26);
        ctx.fillStyle = '#3D0020';
        ctx.fillRect(tx+4, ty+5, 8, 8);
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(tx+5, ty+10, 6, 3);
    }

    // Tile 27: Bedrock
    fillTile(27, '#8B0045');
    addNoise(27, ['#6B0035', '#7B0040', '#5B0030', '#9B0050'], 0.35);

    // Tile 28: Mushroom Stalk
    fillTile(28, '#FFF8DC');
    addNoise(28, ['#F0E8CC', '#EEDDBB'], 0.1);

    // Tile 29: Mushroom Cap
    fillTile(29, '#FF69B4');
    {
        const [tx, ty] = tileXY(29);
        for(let i = 0; i < 5; i++) {
            const px = Math.floor(hash2D(i*23, 2929) * 12) + 2;
            const py = Math.floor(hash2D(i*37, 2930) * 12) + 2;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(tx+px, ty+py, 3, 3);
        }
    }

    // Tile 30: Dark Stone
    fillTile(30, '#8B0045');
    addNoise(30, ['#7B0040', '#6B0035'], 0.2);

    // Tile 31: Dark Grass top
    fillTile(31, '#6B0035');
    addNoise(31, ['#5B002B', '#7B0040', '#550028'], 0.25);

    // Tile 32: Dark Grass side
    fillTile(32, '#8B0045');
    addNoise(32, ['#7B0040'], 0.15);
    {
        const [tx, ty] = tileXY(32);
        ctx.fillStyle = '#6B0035';
        ctx.fillRect(tx, ty, tileSize, 3);
    }

    // Tile 33: Sugar Block
    fillTile(33, '#FFF0F5');
    addNoise(33, ['#FFE0EC', '#FFFFFF'], 0.15);

    // Tile 34: Lollipop Stick
    fillTile(34, '#DEB887');
    {
        const [tx, ty] = tileXY(34);
        ctx.fillStyle = '#C8A070';
        ctx.fillRect(tx+6, ty, 4, tileSize);
        ctx.fillStyle = '#E8C8A0';
        ctx.fillRect(tx+7, ty, 2, tileSize);
    }

    // Tile 35: Lollipop Top
    fillTile(35, '#FF1493');
    {
        const [tx, ty] = tileXY(35);
        for(let py = 0; py < tileSize; py++) {
            for(let px = 0; px < tileSize; px++) {
                if((px + py) % 5 < 2) {
                    ctx.fillStyle = '#FF69B4';
                    ctx.fillRect(tx+px, ty+py, 1, 1);
                }
            }
        }
    }

    for(let variant=1; variant<4; variant++) {
        drawMarshmallowStone(39+variant, variant);
        drawGrahamCrumb(42+variant, variant);
        drawWafer(45+variant, variant, false);
        drawWafer(48+variant, variant, true);
    }
    // Utility blocks — original candy-pixel silhouettes.
    drawWafer(60,2,false); { const [x,y]=tileXY(60);ctx.fillStyle='#7A2948';ctx.fillRect(x+2,y+4,12,9);ctx.fillStyle='#FFD85C';ctx.fillRect(x+7,y+7,2,3); }
    drawGrahamCrumb(61,2); { const [x,y]=tileXY(61);ctx.fillStyle='#FFF0F5';ctx.fillRect(x,y,16,4);ctx.fillStyle='#7A2948';ctx.fillRect(x+1,y+4,14,1); }
    drawWafer(62,1,true); { const [x,y]=tileXY(62);ctx.fillStyle='#4A291F';ctx.fillRect(x+2,y+2,12,12);ctx.fillStyle='#FFD85C';ctx.fillRect(x+11,y+7,2,2); }
    fillTile(63,'#FFF8F0'); { const [x,y]=tileXY(63);for(let p=-12;p<20;p+=7){ctx.fillStyle='#F13B55';ctx.fillRect(x+p,y,3,16);} }
    fillTile(64,'rgba(0,0,0,0)'); { const [x,y]=tileXY(64);ctx.fillStyle='#9B5C34';ctx.fillRect(x+3,y,2,16);ctx.fillRect(x+11,y,2,16);for(let p=2;p<16;p+=4)ctx.fillRect(x+3,y+p,10,2); }
    drawGrahamCrumb(65,3); { const [x,y]=tileXY(65);ctx.fillStyle='#4A291F';ctx.fillRect(x+2,y+4,12,1);ctx.fillRect(x+4,y+8,8,1); }
    drawWafer(66,2,true);
    fillTile(67,'#FFF5FA'); { const [x,y]=tileXY(67);ctx.fillStyle='#FF8DB6';ctx.fillRect(x,y+10,16,6);ctx.fillStyle='#D6C2CF';ctx.fillRect(x,y+9,16,1); }
    fillTile(68,'#FFD85C'); { const [x,y]=tileXY(68);ctx.fillStyle='#FFF4A8';ctx.fillRect(x+3,y+3,10,10);ctx.fillStyle='#FF7A32';ctx.fillRect(x+6,y,4,3);ctx.fillRect(x+6,y+13,4,3); }
    drawGrahamCrumb(69,3);{const[x,y]=tileXY(69);ctx.fillStyle='#FFF0F5';for(let p=1;p<16;p+=4)ctx.fillRect(x+p,y,2,16);}
    drawGrahamCrumb(70,3);{const[x,y]=tileXY(70);ctx.fillStyle='#9EDBFF';for(let p=1;p<16;p+=4)ctx.fillRect(x+p,y,2,16);}
    fillTile(71,'rgba(0,0,0,0)');{const[x,y]=tileXY(71);ctx.fillStyle='#E3B45F';ctx.fillRect(x+7,y+3,2,13);for(let p=4;p<13;p+=3){ctx.fillRect(x+4,y+p,3,2);ctx.fillRect(x+9,y+p+1,3,2);}}
    fillTile(72,'rgba(0,0,0,0)');{const[x,y]=tileXY(72);ctx.fillStyle='#F7F0C0';ctx.fillRect(x+4,y,3,16);ctx.fillRect(x+10,y,3,16);ctx.fillStyle='#E13B70';ctx.fillRect(x+4,y+5,3,2);ctx.fillRect(x+10,y+10,3,2);}
    fillTile(73,'rgba(0,0,0,0)');{const[x,y]=tileXY(73);ctx.fillStyle='#79B844';ctx.fillRect(x+2,y+5,12,9);ctx.fillStyle='#E13B70';ctx.fillRect(x+4,y+7,3,3);ctx.fillRect(x+10,y+10,3,3);}
    for(let stage=0;stage<4;stage++){const idx=74+stage,[x,y]=tileXY(idx),height=4+stage*4;fillTile(idx,'rgba(0,0,0,0)');ctx.fillStyle='#E3B45F';ctx.fillRect(x+7,y+16-height,2,height);if(stage>1){ctx.fillRect(x+4,y+7,3,2);ctx.fillRect(x+9,y+10,3,2);}}
    for(let stage=0;stage<4;stage++){const idx=78+stage,[x,y]=tileXY(idx),size=4+stage*3;fillTile(idx,'rgba(0,0,0,0)');ctx.fillStyle='#79B844';ctx.fillRect(x+8-size/2,y+15-size,size,size);if(stage===3){ctx.fillStyle='#E13B70';ctx.fillRect(x+4,y+8,3,3);ctx.fillRect(x+10,y+11,3,3);}}
    for(let stage=0;stage<4;stage++){const idx=82+stage,[x,y]=tileXY(idx),height=4+stage*4;fillTile(idx,'rgba(0,0,0,0)');ctx.fillStyle='#F7F0C0';ctx.fillRect(x+5,y+16-height,2,height);ctx.fillRect(x+10,y+16-height,2,height);}
    fillTile(86,'rgba(0,0,0,0)');{const[x,y]=tileXY(86);ctx.fillStyle='#E13B70';ctx.fillRect(x,y+7,16,3);ctx.fillRect(x+7,y,3,16);ctx.fillStyle='#FF9ABB';ctx.fillRect(x+7,y+7,3,3);}
    fillTile(87,'#F7F0C0');{const[x,y]=tileXY(87);ctx.fillStyle='#8A5337';ctx.fillRect(x+6,y+3,4,10);ctx.fillStyle='#E13B70';ctx.fillRect(x+5,y+2,6,4);}
    fillTile(88,'#FFF0F5');{const[x,y]=tileXY(88);ctx.fillStyle='#C57B9B';ctx.fillRect(x+1,y+11,14,3);}
    fillTile(89,'#9C7AF4');{const[x,y]=tileXY(89);ctx.fillStyle='#FFF0F5';ctx.fillRect(x+2,y+7,12,2);ctx.fillStyle='#FFD85C';ctx.fillRect(x+5,y+5,2,6);ctx.fillRect(x+10,y+5,2,6);}
    fillTile(90,'#57B8D9');{const[x,y]=tileXY(90);ctx.fillStyle='#3D1525';ctx.fillRect(x+6,y+3,4,8);ctx.fillRect(x+4,y+9,4,4);ctx.fillStyle='#FFF0F5';ctx.fillRect(x+9,y+2,2,2);}

    game.atlasCanvas = c2d;

    // Upload to WebGL
    const tex = game.gl.createTexture();
    game.gl.bindTexture(game.gl.TEXTURE_2D, tex);
    game.gl.texImage2D(game.gl.TEXTURE_2D, 0, game.gl.RGBA, game.gl.RGBA, game.gl.UNSIGNED_BYTE, c2d);
    game.gl.texParameteri(game.gl.TEXTURE_2D, game.gl.TEXTURE_MIN_FILTER, game.gl.NEAREST);
    game.gl.texParameteri(game.gl.TEXTURE_2D, game.gl.TEXTURE_MAG_FILTER, game.gl.NEAREST);
    game.gl.texParameteri(game.gl.TEXTURE_2D, game.gl.TEXTURE_WRAP_S, game.gl.CLAMP_TO_EDGE);
    game.gl.texParameteri(game.gl.TEXTURE_2D, game.gl.TEXTURE_WRAP_T, game.gl.CLAMP_TO_EDGE);
    return tex;
}

game.atlasTexture = generateAtlas();

// ====== CLOUD TEXTURE ======
let cloudTexture;
function generateCloudTexture() {
    const size = 256;
    const c2d = document.createElement('canvas');
    c2d.width = size; c2d.height = size;
    const ctx = c2d.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            const v = fbm2D(x * 0.02, y * 0.02, 4);
            const alpha = Math.max(0, (v - 0.45) * 4);
            const i = (y * size + x) * 4;
            imgData.data[i] = 255; imgData.data[i+1] = 240; imgData.data[i+2] = 243;
            imgData.data[i+3] = Math.min(255, alpha * 180);
        }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = game.gl.createTexture();
    game.gl.bindTexture(game.gl.TEXTURE_2D, tex);
    game.gl.texImage2D(game.gl.TEXTURE_2D, 0, game.gl.RGBA, game.gl.RGBA, game.gl.UNSIGNED_BYTE, c2d);
    game.gl.texParameteri(game.gl.TEXTURE_2D, game.gl.TEXTURE_MIN_FILTER, game.gl.LINEAR);
    game.gl.texParameteri(game.gl.TEXTURE_2D, game.gl.TEXTURE_MAG_FILTER, game.gl.LINEAR);
    game.gl.texParameteri(game.gl.TEXTURE_2D, game.gl.TEXTURE_WRAP_S, game.gl.REPEAT);
    game.gl.texParameteri(game.gl.TEXTURE_2D, game.gl.TEXTURE_WRAP_T, game.gl.REPEAT);
    return tex;
}
cloudTexture = generateCloudTexture();

// Cloud VAO
let cloudVAO, cloudProgram;
let cUni;
{
    cloudProgram = createProgram(
        GLSL_PREAMBLE +
        'in vec3 aPos;\nin vec2 aUV; uniform float uHeight;\n' +
        GLSL_UVP_DECL +
        'out vec2 vUV;\n' +
        'void main() {\n' +
        '    gl_Position = uVP * vec4(aPos + vec3(0.0,uHeight,0.0), 1.0);\n' +
        '    vUV = aUV;\n' +
        '}\n',
        GLSL_PREAMBLE +
        'in vec2 vUV;\nuniform sampler2D uTex;\nuniform vec2 uOffset;\nuniform float uAlpha;\nout vec4 fragColor;\n' +
        'void main() {\n' +
        '    vec4 c = texture(uTex, vUV + uOffset);\n' +
        '    if(c.a < 0.05) discard;\n' +
        '    fragColor = vec4(c.rgb, c.a * uAlpha);\n' +
        '}\n'
    );
    if(!cloudProgram) throw new Error('Failed to create cloud shader program');
    cUni = getUniforms(cloudProgram, ['uVP', 'uTex', 'uOffset', 'uHeight', 'uAlpha']);
    const S = 200;
    const verts = new Float32Array([
        -S,58,-S, 0,0,  S,58,-S, 8,0,  S,58,S, 8,8,
        -S,58,-S, 0,0,  S,58,S, 8,8,  -S,58,S, 0,8
    ]);
    cloudVAO = game.gl.createVertexArray();
    game.gl.bindVertexArray(cloudVAO);
    const buf = game.gl.createBuffer();
    game.gl.bindBuffer(game.gl.ARRAY_BUFFER, buf);
    game.gl.bufferData(game.gl.ARRAY_BUFFER, verts, game.gl.STATIC_DRAW);
    const aPos = game.gl.getAttribLocation(cloudProgram, 'aPos');
    const aUV = game.gl.getAttribLocation(cloudProgram, 'aUV');
    game.gl.enableVertexAttribArray(aPos);
    game.gl.vertexAttribPointer(aPos, 3, game.gl.FLOAT, false, 20, 0);
    game.gl.enableVertexAttribArray(aUV);
    game.gl.vertexAttribPointer(aUV, 2, game.gl.FLOAT, false, 20, 12);
    game.gl.bindVertexArray(null);
}
