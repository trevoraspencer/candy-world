'use strict';

const SAVE_KEY = 'candy-world-save-v2';
// Older builds stored the save under this accidental all-asterisks key.
// loadSavedGame() migrates it to SAVE_KEY once, so existing saves survive.
const LEGACY_SAVE_KEY = '***********************';
const CURRENT_SAVE_VERSION = 2;
let saveTimer = null;
let loadedSave = null;
let saveDirty = false;
// saveErrored is now game.saveErrored (initialized in state.js)

// --- Save format migration ---
// Each migration function transforms a save from version N to version N+1.
// migrateSave() chains them sequentially from the save's version to CURRENT_SAVE_VERSION.

function migrateV1ToV2(save) {
    // v1 saves use 'version: 1'. v2 adds explicit 'schemaVersion' field.
    // Data shape is identical — this migration just normalizes the header.
    save.schemaVersion = 2;
    return save;
}

const SAVE_MIGRATIONS = {
    1: migrateV1ToV2
};

function migrateSave(save) {
    if (!save || typeof save !== 'object' || Array.isArray(save)) return null;
    // Determine starting version: prefer schemaVersion, fall back to version, default to 1
    const startVersion = save.schemaVersion || save.version || 1;
    let v = startVersion;
    while (v < CURRENT_SAVE_VERSION) {
        const migrator = SAVE_MIGRATIONS[v];
        if (typeof migrator === 'function') {
            save = migrator(save);
        } else {
            console.warn('No migrator registered for save version ' + v + ', skipping to version ' + (v + 1));
        }
        v++;
        save.schemaVersion = v;
        save.version = v;
    }
    return save;
}

function blockEditKey(x, y, z) {
    return x + ',' + y + ',' + z;
}

function recordBlockEdit(x, y, z, blockId) {
    game.modifiedBlocks.set(blockEditKey(x, y, z), blockId);
    scheduleSaveGame();
}

function isSaveObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isWorldBlockCoord(x, y, z) {
    return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
        x >= 0 && x < WORLD_W &&
        y >= 0 && y < CHUNK_H &&
        z >= 0 && z < WORLD_D;
}

function isValidBlockId(blockId) {
    return Number.isInteger(blockId) && !!BLOCK_REGISTRY[blockId];
}

function isValidItemId(itemId) {
    return Number.isInteger(itemId) && itemId > AIR && typeof BLOCK_NAMES[itemId] === 'string';
}

function sanitizeInventorySlot(slot) {
    if(!isSaveObject(slot) || !isValidItemId(slot.id) || !Number.isInteger(slot.count) || slot.count <= 0) return null;
    const maxStack = typeof getItemMaxStack === 'function' ? getItemMaxStack(slot.id) : 64;
    return { id: slot.id, count: Math.min(slot.count, maxStack) };
}

function sanitizePetName(name, type) {
    if(typeof name !== 'string') return MOB_NAMES[type] || 'Pet';
    const clean = name.trim().slice(0, 20);
    return clean || MOB_NAMES[type] || 'Pet';
}

function loadSavedGame() {
    try {
        let raw = localStorage.getItem(SAVE_KEY);
        if (raw === null) {
            const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
            if (legacyRaw !== null) {
                raw = legacyRaw;
                // One-time migration: copy to the new key, then drop the old one.
                // If the copy fails (e.g. quota), keep the legacy key so nothing is lost.
                try {
                    localStorage.setItem(SAVE_KEY, legacyRaw);
                    localStorage.removeItem(LEGACY_SAVE_KEY);
                } catch (migrateErr) {
                    console.warn('Failed to migrate save to new storage key:', migrateErr);
                }
            }
        }
        const parsed = raw ? JSON.parse(raw) : null;
        loadedSave = isSaveObject(parsed) ? parsed : null;
        if (loadedSave) {
            loadedSave = migrateSave(loadedSave);
        }
    } catch (err) {
        console.warn('Failed to read save data:', err);
        loadedSave = null;
    }
    return loadedSave;
}

function applySavedBlocks() {
    if(!loadedSave) loadSavedGame();
    if(!loadedSave || !Array.isArray(loadedSave.blocks)) return;

    const wasLoaded = game.worldLoaded;
    game.worldLoaded = false;
    try {
        for(const edit of loadedSave.blocks) {
            if(!Array.isArray(edit) || edit.length !== 4) continue;
            const [x, y, z, blockId] = edit;
            if(!isWorldBlockCoord(x, y, z)) continue;
            if(!isValidBlockId(blockId)) continue;
            setBlock(x, y, z, blockId);
            game.modifiedBlocks.set(blockEditKey(x, y, z), blockId);
        }
    } finally {
        game.worldLoaded = wasLoaded;
    }
}

function applySavedPlayerState() {
    if(!loadedSave) loadSavedGame();
    if(!loadedSave) return;

    if(isSaveObject(loadedSave.player)) {
        const p = loadedSave.player;
        if(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
            game.player.x = Math.max(0.5, Math.min(WORLD_W - 0.5, p.x));
            game.player.y = Math.max(1, Math.min(CHUNK_H - 1, p.y));
            game.player.z = Math.max(0.5, Math.min(WORLD_D - 0.5, p.z));
        }
        if(Number.isFinite(p.yaw)) game.player.yaw = p.yaw;
        if(Number.isFinite(p.pitch)) game.player.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, p.pitch));
        if(Number.isFinite(p.health)) game.playerHealth = Math.max(0, Math.min(20, p.health));
        if(Number.isFinite(p.hunger)) game.playerHunger = Math.max(0, Math.min(20, p.hunger));
        if(Number.isInteger(p.selectedSlot)) game.selectedSlot = Math.max(0, Math.min(8, p.selectedSlot));
        game.flyMode = !!p.flyMode;
    }

    if(Array.isArray(loadedSave.inventory)) {
        for(let i = 0; i < game.inventory.length; i++) {
            game.inventory[i] = sanitizeInventorySlot(loadedSave.inventory[i]);
        }
    }

    if(Number.isFinite(loadedSave.dayTime)) {
        game.dayTime = ((loadedSave.dayTime % DAY_CYCLE_LENGTH) + DAY_CYCLE_LENGTH) % DAY_CYCLE_LENGTH;
    }

    // Restore creative mode state
    if(loadedSave.creativeMode) {
        game.creativeMode = true;
        // The loaded game.inventory is the survival backup — copy it, then populate creative
        for(let i = 0; i < 36; i++) {
            game.survivalInventory[i] = game.inventory[i] ? { id: game.inventory[i].id, count: game.inventory[i].count } : null;
        }
        populateCreativeInventory();
    }

    // Restore tamed pets
    if(Array.isArray(loadedSave.tamedPets)) {
        for(const petData of loadedSave.tamedPets) {
            if(!isSaveObject(petData)) continue;
            if(!Number.isInteger(petData.type) || !MOB_NAMES[petData.type]) continue;
            if(typeof isAnimalMob === 'function' && !isAnimalMob(petData.type)) continue;
            if(!Number.isFinite(petData.x) || !Number.isFinite(petData.z)) continue;
            const px = Math.max(1, Math.min(WORLD_W - 2, petData.x));
            const pz = Math.max(1, Math.min(WORLD_D - 2, petData.z));
            const py = Number.isFinite(petData.y)
                ? Math.max(1, Math.min(CHUNK_H - 2, petData.y))
                : findGround(Math.floor(px), Math.floor(pz));
            const mob = {
                type: petData.type,
                x: px, y: py, z: pz,
                vx: 0, vy: 0, vz: 0,
                yaw: Math.random() * Math.PI * 2,
                targetYaw: Math.random() * Math.PI * 2,
                state: 'follow',
                stateTimer: 999,
                baby: false,
                trades: null,
                built: false,
                tamed: true,
                petName: sanitizePetName(petData.name, petData.type),
                animTime: 0,
                headYaw: 0,
                variant: hash2D(Math.floor(px * 19.3 + pz * 7.7), Math.floor(py * 3.1 + petData.type * 11)),
                _mobId: _nextMobId++,
                _cachedVerts: null,
                _cachedVertCount: 0,
                _prevGeom: null
            };
            game.mobs.push(mob);
            game.tamedPets.push(mob);
        }
    }

    // Restore quest state
    if(typeof loadQuestSaveData === 'function') {
        loadQuestSaveData(loadedSave.quests);
    }

    // Restore visited biomes
    if(Array.isArray(loadedSave.visitedBiomes)) {
        game.visitedBiomes = [];
        for(const biome of loadedSave.visitedBiomes) {
            if(!Number.isInteger(biome) || biome < BIOME_FOREST || biome > BIOME_BEACH) continue;
            if(!game.visitedBiomes.includes(biome)) game.visitedBiomes.push(biome);
        }
    }
}

function serializeInventory() {
    // In creative mode, serialize the survival inventory backup (the real inventory)
    const source = game.creativeMode ? game.survivalInventory : game.inventory;
    return source.map(slot => slot ? { id: slot.id, count: slot.count } : null);
}

function saveGameNow() {
    if(!game.worldLoaded) return;
    if(!saveDirty) return;
    saveDirty = false;
    const save = {
        version: CURRENT_SAVE_VERSION,
        schemaVersion: CURRENT_SAVE_VERSION,
        savedAt: Date.now(),
        creativeMode: game.creativeMode,
        player: {
            x: game.player.x,
            y: game.player.y,
            z: game.player.z,
            yaw: game.player.yaw,
            pitch: game.player.pitch,
            health: game.playerHealth,
            hunger: game.playerHunger,
            selectedSlot: game.selectedSlot,
            flyMode: game.flyMode
        },
        inventory: serializeInventory(),
        dayTime: game.dayTime,
        blocks: Array.from(game.modifiedBlocks, ([key, blockId]) => {
            const [x, y, z] = key.split(',').map(Number);
            return [x, y, z, blockId];
        }),
        tamedPets: game.tamedPets.map(mob => ({
            type: mob.type,
            name: mob.petName,
            x: mob.x,
            y: mob.y,
            z: mob.z
        })),
        quests: typeof getQuestSaveData === 'function' ? getQuestSaveData() : {},
        visitedBiomes: game.visitedBiomes.slice()
    };

    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (err) {
        console.warn('Failed to save game:', err);
        saveDirty = true; // remain dirty so we retry next change
        game.saveErrored = true;
    }
}

function scheduleSaveGame() {
    if(!game.worldLoaded) return;
    saveDirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveGameNow, 500);
}

window.addEventListener('beforeunload', saveGameNow);
