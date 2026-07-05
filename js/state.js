'use strict';

// ====== BIOMES ======
const BIOME_FOREST = 0, BIOME_MOUNTAINS = 1, BIOME_DEEP_DARK = 2, BIOME_PLAINS = 3, BIOME_BEACH = 4;

// ====== WORLD CONSTANTS ======
const WORLD_CX = 16, WORLD_CZ = 16; // 16x16 chunks
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
    biomeMap: null,
    projMatrix: null,
    worldLoaded: false,
    modifiedBlocks: new Map(), // "x,y,z" -> block id, recorded after initial generation

    // Player state
    player: {
        x: 128, y: 50, z: 128,
        vx: 0, vy: 0, vz: 0,
        yaw: 0, pitch: 0,
        onGround: false,
        width: 0.6, height: 1.8
    },
    playerHealth: 20, // 0-20, displayed as 10 hearts
    playerHunger: 20, // 0-20, displayed as 10 icons
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

    // Effects & particles (from effects.js)
    activeEffects: [],
    particles: [],

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

    // Render loop state (from render.js)
    lastTime: 0,
    gameTime: 0,

    // Controls overlay state
    controlsOverlayOpen: false,

    // Persistence state (from persistence.js)
    saveErrored: false
};
