'use strict';

// ====== BIOMES ======
const BIOME_FOREST = 0, BIOME_MOUNTAINS = 1, BIOME_DEEP_DARK = 2, BIOME_PLAINS = 3, BIOME_BEACH = 4;

// ====== WORLD CONSTANTS ======
const LEGACY_WORLD_CX=16,LEGACY_WORLD_CZ=16;
const WORLD_CX = 128, WORLD_CZ = 128; // streamed 2048×2048 generator-v2 world
const CHUNK_W = 16, CHUNK_H = 64, CHUNK_D = 16;
const WORLD_W = WORLD_CX * CHUNK_W; // 256
const WORLD_D = WORLD_CZ * CHUNK_D; // 256
const WATER_LEVEL = 20;

// ====== GAME SINGLETON ======
// All mutable game state is centralized in this single object.
// Consumer files access state via game.* instead of bare globals.
const game = {
    // Rendering (GL handles — assigned in webgl.js)
    canvas: null,
    gl: null,
    terrainProgram: null,
    lineProgram: null,
    mobProgram: null,
    atlasTexture: null,
    atlasCanvas: null,

    // World state
    chunks: new Map(), // chunkKey(cx,cz) -> Uint8Array
    chunkMeshes: new Map(), // chunkKey(cx,cz) -> { cx, cz, centerX, centerZ, vao, vertCount, waterVao, waterVertCount }
    dirtyChunks: new Set(),
    chunkRevisions: new Map(),
    biomeMap: null,
    projMatrix: null,
    worldLoaded: false,
    worldStarted: false,
    paused: true,
    worldMode: 'survival',
    difficulty: 'gentle',
    generatorVersion: 2,
    worldSeed:'candy-default',worldName:'Candy World',worldSlot:'slot-1',
    modifiedBlocks: new Map(), // "x,y,z" -> block id, recorded after initial generation
    modifiedBlocksByChunk: new Map(),
    lightSources: new Map(), // "x,y,z" -> normalized block-light strength
    skyHeightMap: new Uint8Array(WORLD_W * WORLD_D),
    chunkStreaming:{activeRadius:3,prefetchRadius:7,maxLoaded:260,pending:new Set(),lastCenterX:-1,lastCenterZ:-1},

    // Player state
    player: {
        x: 128, y: 50, z: 128,
        vx: 0, vy: 0, vz: 0,
        yaw: 0, pitch: 0,
        onGround: false,
        width: 0.6, height: 1.8
    },
    persistenceMovement:{x:128,z:128,elapsed:0},
    playerHealth: 20, // 0-20, displayed as 10 hearts
    playerHunger: 20, // 0-20, displayed as 10 icons
    survival: {
        hungerDrain: 0,
        regenTimer: 0,
        crashTimer: 0,
        noticeCooldown: 0,
        drownTimer: 0
    },
    selectedSlot: 0,
    inventoryOpen: false,
    cursorStack: null, // for inventory drag

    // Input state
    keys: {},
    mouseDown: [false, false, false],
    pointerLocked: false,
    flyMode: false,
    lastSpaceTapTime: 0,
    miningKeyHeld: false,

    // Block interaction state
    targetBlock: null, // {x,y,z, nx,ny,nz, block, dist}
    breakProgress: 0,
    breakingBlock: null, // {x,y,z}
    breakStage: -1,

    // Inventory: 36 slots
    inventory: new Array(36).fill(null),

    // Creative mode state
    creativeMode: false,
    survivalInventory: new Array(36).fill(null),

    // Pet taming state
    tamedPets: [], // references to tamed mobs in mobs[]
    petPanelOpen: false,

    // Day/night cycle (from effects.js)
    daylight: 1.0,
    dayTime: 0, // 0-600 seconds (10-minute full cycle)
    skyR: 1.0,
    skyG: 0.82,
    skyB: 0.86,
    fogR: 1.0,
    fogG: 0.82,
    fogB: 0.86,
    sunDirection: [0.35, 0.82, 0.45],
    weather: { type: 'clear', intensity: 0, scheduleIndex: -1 },

    // Effects & particles (from effects.js)
    activeEffects: [],
    particles: [],
    itemDrops: [],
    combat: { attackCooldown:0, invulnerableTime:0, dead:false },
    spawnPoint: { x:128.5,y:40,z:128.5 },
    spawnManager: { timer:1, sequence:0, warnedCycle:-1 },
    farming: { accumulator:0, tick:0 },
    mechanism: { accumulator:0, tick:0, lastProcessed:0 },

    // Mob state (from mobs.js)
    mobs: [],
    MAX_MOBS: 80,
    tradeTarget: null, // current villager mob being traded with

    // Quest state (from quests.js)
    questPanelOpen: false,
    visitedBiomes: [], // array of distinct biome IDs visited (persisted across sessions)
    pendingQuestRewards: [], // rewards that couldn't be added to full inventory

    // Block station UI state (furnace/crafting table)
    craftingTableOpen: false,
    craftingTablePos: null, // {x, y, z} of the placed Crafting Table block
    furnaceOpen: false,
    furnacePos: null, // {x, y, z} of the placed Furnace block
    recipeGuide: null, // { category, recipeIndex } for the tracked recipe helper
    playerCraftGrid: new Array(4).fill(null),
    tableCraftGrid: new Array(9).fill(null),
    blockEntities: new Map(),
    blockStates: new Map(),
    chestOpen: false,
    chestPos: null,

    // Render loop state (from render.js)
    lastTime: 0,
    gameTime: 0,

    // Controls overlay state
    controlsOverlayOpen: false,
    debugVisible: false,

    // First-run and contextual HUD helper state (from render.js)
    actionHelper: {
        pointerLockedOnce: false,
        movementSeen: false,
        actionSeen: false,
        lastTitle: '',
        lastDetail: '',
        lastKind: ''
    },
    presentation: {
        bobPhase: 0,
        bobX: 0,
        bobY: 0,
        landingDip: 0,
        wasGrounded: false,
        previousYVelocity: 0,
        prevX: 128,
        prevZ: 128,
        action: 'idle',
        actionTime: 0,
        labelUntil: 0,
        heldItemId: null,
        currentFov: 70
        ,stepDistance:0
    },

    // Persistence state (from persistence.js)
    saveErrored: false,
    saveDiagnostics: null,

    // User-facing quality/accessibility settings. These defaults are deliberately
    // conservative and are migrated into world metadata by persistence.js.
    settings: {
        renderScale: 1,
        maxDevicePixelRatio: 2,
        fov: 70,
        viewDistance: 4,
        hudScale: 1,
        reducedMotion: false,
        viewBob: 1,
        cameraShake: 1,
        particleIntensity: 1,
        flashingIntensity: 1,
        flashing: true,
        mouseSensitivity: 0.002,
        masterVolume: 0.8,
        effectsVolume: 0.8,
        ambienceVolume: 0.6
    },
    keyBindings:{forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',mine:'KeyR',place:'KeyF',inventory:'KeyE',pets:'KeyP',quests:'KeyQ'},
    tutorial: { step:0, dismissed:false, movementTime:0 }
};

try {
    const savedSettings=JSON.parse(localStorage.getItem('candy-world-settings-v1')||'null');
    if(savedSettings&&typeof savedSettings==='object') {
        for(const key of Object.keys(game.settings)) if(Object.prototype.hasOwnProperty.call(savedSettings,key)) game.settings[key]=savedSettings[key];
        if(savedSettings.keyBindings&&typeof savedSettings.keyBindings==='object')for(const key of Object.keys(game.keyBindings))if(typeof savedSettings.keyBindings[key]==='string')game.keyBindings[key]=savedSettings.keyBindings[key];
        if(savedSettings.tutorial&&typeof savedSettings.tutorial==='object') game.tutorial={...game.tutorial,...savedSettings.tutorial};
    }
} catch(_) { /* malformed preferences fall back safely */ }
