'use strict';

const SAVE_KEY = 'candy-world-save-v2';
const SAVE_BACKUP_KEY = SAVE_KEY + '-backup';
// Older builds stored the save under this accidental all-asterisks key.
// loadSavedGame() migrates it to SAVE_KEY once, so existing saves survive.
const LEGACY_SAVE_KEY = '***********************';
const CURRENT_SAVE_VERSION = 2;
const MAX_SAVED_BLOCK_EDITS = 300000;
const MAX_SAVED_PETS = 80;
const MAX_SAVED_INVENTORY_SLOTS = 36;
const MAX_SAVED_PENDING_REWARDS = 36;
let saveTimer = null;
let loadedSave = null;
let loadedSaveSource = null;
let saveLoadAttempted = false;
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

function getSaveVersion(save) {
    if(!isSaveObject(save)) return null;
    if(Number.isInteger(save.schemaVersion)) return save.schemaVersion;
    if(Number.isInteger(save.version)) return save.version;
    return 1;
}

function migrateSave(save) {
    if (!save || typeof save !== 'object' || Array.isArray(save)) return null;
    // Determine starting version: prefer schemaVersion, fall back to version, default to 1.
    const startVersion = getSaveVersion(save);
    if(!Number.isInteger(startVersion) || startVersion < 1 || startVersion > CURRENT_SAVE_VERSION) return null;
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

function createSaveDiagnostics() {
    return {
        loaded: false,
        source: null,
        recoveredFrom: null,
        attempts: [],
        sanitized: {
            blocksDropped: 0,
            blocksTruncated: 0,
            duplicateBlocksCollapsed: 0,
            inventorySlotsDropped: 0,
            petsDropped: 0,
            pendingRewardsTruncated: 0,
            visitedBiomesDropped: 0
        }
    };
}

function cloneSaveDiagnostics(diagnostics) {
    return JSON.parse(JSON.stringify(diagnostics));
}

function addSaveAttempt(diagnostics, source, status, detail) {
    diagnostics.attempts.push({
        source,
        status,
        detail: detail || ''
    });
}

function mergeSanitizeStats(target, source) {
    for(const key in target.sanitized) {
        if(Object.prototype.hasOwnProperty.call(source, key)) {
            target.sanitized[key] += source[key];
        }
    }
}

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function sanitizePlayerSave(player) {
    if(!isSaveObject(player)) return null;
    const clean = {};
    if(Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.z)) {
        clean.x = clampNumber(player.x, 0.5, WORLD_W - 0.5);
        clean.y = clampNumber(player.y, 1, CHUNK_H - 1);
        clean.z = clampNumber(player.z, 0.5, WORLD_D - 0.5);
    }
    if(Number.isFinite(player.yaw)) clean.yaw = player.yaw;
    if(Number.isFinite(player.pitch)) clean.pitch = clampNumber(player.pitch, -Math.PI/2 + 0.01, Math.PI/2 - 0.01);
    if(Number.isFinite(player.health)) clean.health = clampNumber(player.health, 0, 20);
    if(Number.isFinite(player.hunger)) clean.hunger = clampNumber(player.hunger, 0, 20);
    if(Number.isInteger(player.selectedSlot)) clean.selectedSlot = clampNumber(player.selectedSlot, 0, 8);
    if(typeof player.flyMode === 'boolean') clean.flyMode = player.flyMode;
    return Object.keys(clean).length > 0 ? clean : null;
}

function sanitizeInventorySlots(slots, stats) {
    const clean = new Array(MAX_SAVED_INVENTORY_SLOTS).fill(null);
    for(let i = 0; i < MAX_SAVED_INVENTORY_SLOTS; i++) {
        const slot = sanitizeInventorySlot(slots[i]);
        if(slot) clean[i] = slot;
        else if(slots[i] != null) stats.inventorySlotsDropped++;
    }
    if(slots.length > MAX_SAVED_INVENTORY_SLOTS) {
        for(let i = MAX_SAVED_INVENTORY_SLOTS; i < slots.length; i++) {
            if(slots[i] != null) stats.inventorySlotsDropped++;
        }
    }
    return clean;
}

function sanitizeSavedBlocks(blocks, stats) {
    const editsByKey = new Map();
    const limit = Math.min(blocks.length, MAX_SAVED_BLOCK_EDITS);
    for(let i = 0; i < limit; i++) {
        const edit = blocks[i];
        if(!Array.isArray(edit) || edit.length !== 4) {
            stats.blocksDropped++;
            continue;
        }
        const [x, y, z, blockId] = edit;
        if(!isWorldBlockCoord(x, y, z) || !isValidBlockId(blockId)) {
            stats.blocksDropped++;
            continue;
        }
        const key = blockEditKey(x, y, z);
        if(editsByKey.has(key)) stats.duplicateBlocksCollapsed++;
        editsByKey.set(key, [x, y, z, blockId]);
    }
    if(blocks.length > limit) stats.blocksTruncated += blocks.length - limit;
    return Array.from(editsByKey.values());
}

function sanitizeSavedPets(pets, stats) {
    const clean = [];
    const limit = Math.min(MAX_SAVED_PETS, game.MAX_MOBS || MAX_SAVED_PETS);
    for(const petData of pets) {
        if(clean.length >= limit) {
            stats.petsDropped++;
            continue;
        }
        if(!isSaveObject(petData) ||
           !Number.isInteger(petData.type) ||
           !MOB_NAMES[petData.type] ||
           (typeof isAnimalMob === 'function' && !isAnimalMob(petData.type)) ||
           !Number.isFinite(petData.x) ||
           !Number.isFinite(petData.z)) {
            stats.petsDropped++;
            continue;
        }
        const pet = {
            type: petData.type,
            name: sanitizePetName(petData.name, petData.type),
            x: clampNumber(petData.x, 1, WORLD_W - 2),
            z: clampNumber(petData.z, 1, WORLD_D - 2)
        };
        if(Number.isFinite(petData.y)) pet.y = clampNumber(petData.y, 1, CHUNK_H - 2);
        clean.push(pet);
    }
    return clean;
}

function sanitizeVisitedBiomes(biomes, stats) {
    const clean = [];
    for(const biome of biomes) {
        if(!Number.isInteger(biome) || biome < BIOME_FOREST || biome > BIOME_BEACH) {
            stats.visitedBiomesDropped++;
            continue;
        }
        if(!clean.includes(biome)) clean.push(biome);
    }
    return clean;
}

function sanitizeQuestSave(quests, stats) {
    if(!isSaveObject(quests)) return null;
    const clean = {};
    for(const key in quests) {
        if(!Object.prototype.hasOwnProperty.call(quests, key)) continue;
        if(key === '_pendingRewards') continue;
        const saved = quests[key];
        if(!isSaveObject(saved)) continue;
        const q = {};
        if(Number.isFinite(saved.progress)) q.progress = Math.max(0, Math.floor(saved.progress));
        q.completed = !!saved.completed;
        if(Array.isArray(saved.craftedTreatTypes)) {
            q.craftedTreatTypes = saved.craftedTreatTypes.slice(0, 16);
        }
        clean[key] = q;
    }
    if(Array.isArray(quests._pendingRewards)) {
        const pending = [];
        const limit = Math.min(quests._pendingRewards.length, MAX_SAVED_PENDING_REWARDS);
        for(let i = 0; i < limit; i++) pending.push(quests._pendingRewards[i]);
        if(quests._pendingRewards.length > limit) stats.pendingRewardsTruncated += quests._pendingRewards.length - limit;
        clean._pendingRewards = pending;
    }
    return clean;
}

function normalizeSave(save, diagnostics) {
    const migrated = migrateSave(save);
    if(!migrated) return null;

    const stats = {
        blocksDropped: 0,
        blocksTruncated: 0,
        duplicateBlocksCollapsed: 0,
        inventorySlotsDropped: 0,
        petsDropped: 0,
        pendingRewardsTruncated: 0,
        visitedBiomesDropped: 0
    };
    const clean = {
        version: CURRENT_SAVE_VERSION,
        schemaVersion: CURRENT_SAVE_VERSION
    };
    let hasPayload = false;

    if(Number.isFinite(migrated.savedAt)) clean.savedAt = Math.max(0, Math.floor(migrated.savedAt));
    clean.creativeMode = !!migrated.creativeMode;

    const player = sanitizePlayerSave(migrated.player);
    if(player) {
        clean.player = player;
        hasPayload = true;
    }

    if(Array.isArray(migrated.inventory)) {
        clean.inventory = sanitizeInventorySlots(migrated.inventory, stats);
        hasPayload = true;
    }

    if(Number.isFinite(migrated.dayTime)) {
        clean.dayTime = ((migrated.dayTime % DAY_CYCLE_LENGTH) + DAY_CYCLE_LENGTH) % DAY_CYCLE_LENGTH;
        hasPayload = true;
    }

    if(Array.isArray(migrated.blocks)) {
        clean.blocks = sanitizeSavedBlocks(migrated.blocks, stats);
        hasPayload = true;
    }

    if(Array.isArray(migrated.tamedPets)) {
        clean.tamedPets = sanitizeSavedPets(migrated.tamedPets, stats);
        hasPayload = true;
    }

    const quests = sanitizeQuestSave(migrated.quests, stats);
    if(quests) {
        clean.quests = quests;
        hasPayload = true;
    }

    if(typeof sanitizeRecipeGuide === 'function') {
        const recipeGuide = sanitizeRecipeGuide(migrated.recipeGuide);
        clean.recipeGuide = recipeGuide;
        if(recipeGuide) hasPayload = true;
    }

    if(Array.isArray(migrated.visitedBiomes)) {
        clean.visitedBiomes = sanitizeVisitedBiomes(migrated.visitedBiomes, stats);
        hasPayload = true;
    }

    if(!hasPayload) return null;
    mergeSanitizeStats(diagnostics, stats);
    return clean;
}

function readSaveCandidate(key, source, diagnostics) {
    let raw = null;
    try {
        raw = localStorage.getItem(key);
    } catch (err) {
        addSaveAttempt(diagnostics, source, 'unreadable', err && err.message ? err.message : 'storage read failed');
        return null;
    }
    if(raw === null) {
        addSaveAttempt(diagnostics, source, 'missing');
        return null;
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        addSaveAttempt(diagnostics, source, 'invalid-json', err && err.message ? err.message : 'parse failed');
        return null;
    }

    const clean = normalizeSave(parsed, diagnostics);
    if(!clean) {
        addSaveAttempt(diagnostics, source, 'invalid-schema');
        return null;
    }

    addSaveAttempt(diagnostics, source, 'loaded');
    return { source, raw, save: clean };
}

function promoteRecoveredSave(candidate) {
    if(!candidate || candidate.source === 'primary') return;
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(candidate.save));
        if(candidate.source === 'legacy') localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch (err) {
        console.warn('Loaded save from ' + candidate.source + ', but failed to promote it to the primary save key:', err);
    }
}

function publishSaveDiagnostics(diagnostics) {
    game.saveDiagnostics = cloneSaveDiagnostics(diagnostics);
    if(!diagnostics.loaded) return;
    if(diagnostics.recoveredFrom) {
        const primaryAttempt = diagnostics.attempts.find(attempt => attempt.source === 'primary');
        const primaryDetail = primaryAttempt && primaryAttempt.status !== 'missing'
            ? 'after primary save failed validation'
            : 'because no primary save was available';
        console.warn('Recovered Sweet, Sweet World save from ' + diagnostics.source + ' ' + primaryDetail + '.');
    }
    const s = diagnostics.sanitized;
    if(s.blocksDropped || s.blocksTruncated || s.duplicateBlocksCollapsed || s.inventorySlotsDropped ||
       s.petsDropped || s.pendingRewardsTruncated || s.visitedBiomesDropped) {
        console.warn('Save data was sanitized before loading:', s);
    }
}

function getSaveDiagnostics() {
    return game.saveDiagnostics ? cloneSaveDiagnostics(game.saveDiagnostics) : null;
}

function loadSavedGame() {
    if(saveLoadAttempted) return loadedSave;
    saveLoadAttempted = true;

    const diagnostics = createSaveDiagnostics();
    const selected =
        readSaveCandidate(SAVE_KEY, 'primary', diagnostics) ||
        readSaveCandidate(SAVE_BACKUP_KEY, 'backup', diagnostics) ||
        readSaveCandidate(LEGACY_SAVE_KEY, 'legacy', diagnostics);
    if(selected) {
        loadedSave = selected.save;
        loadedSaveSource = selected.source;
        diagnostics.loaded = true;
        diagnostics.source = selected.source;
        if(selected.source !== 'primary') diagnostics.recoveredFrom = 'primary';
        promoteRecoveredSave(selected);
    } else {
        loadedSave = null;
        loadedSaveSource = null;
    }
    publishSaveDiagnostics(diagnostics);
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

function ensureRoomForSavedPet(px, pz) {
    if(game.mobs.length < game.MAX_MOBS) return true;
    if(typeof freeFarAnimalSlot === 'function' && freeFarAnimalSlot(px, pz, 0)) return true;
    for(let i = 0; i < game.mobs.length; i++) {
        if(game.mobs[i].tamed) continue;
        if(game.mobs[i] === game.tradeTarget && typeof closeTradePanel === 'function') closeTradePanel();
        game.mobs.splice(i, 1);
        return true;
    }
    return game.mobs.length < game.MAX_MOBS;
}

function noteDroppedSavedPet() {
    if(game.saveDiagnostics && game.saveDiagnostics.sanitized) {
        game.saveDiagnostics.sanitized.petsDropped++;
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

    if(typeof sanitizeRecipeGuide === 'function') {
        game.recipeGuide = sanitizeRecipeGuide(loadedSave.recipeGuide);
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
            if(!ensureRoomForSavedPet(px, pz)) {
                noteDroppedSavedPet();
                continue;
            }
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
    return sanitizeInventorySlots(source, {
        inventorySlotsDropped: 0
    });
}

function serializeBlockEdits() {
    const edits = [];
    for(const [key, blockId] of game.modifiedBlocks) {
        const coords = key.split(',').map(Number);
        if(coords.length !== 3) continue;
        const [x, y, z] = coords;
        if(!isWorldBlockCoord(x, y, z) || !isValidBlockId(blockId)) continue;
        edits.push([x, y, z, blockId]);
    }
    return edits;
}

function serializeTamedPets() {
    const pets = [];
    for(const mob of game.tamedPets) {
        if(!mob || !mob.tamed || !Number.isInteger(mob.type) || !MOB_NAMES[mob.type]) continue;
        if(typeof isAnimalMob === 'function' && !isAnimalMob(mob.type)) continue;
        if(!Number.isFinite(mob.x) || !Number.isFinite(mob.y) || !Number.isFinite(mob.z)) continue;
        pets.push({
            type: mob.type,
            name: sanitizePetName(mob.petName, mob.type),
            x: clampNumber(mob.x, 1, WORLD_W - 2),
            y: clampNumber(mob.y, 1, CHUNK_H - 2),
            z: clampNumber(mob.z, 1, WORLD_D - 2)
        });
    }
    return pets;
}

function serializeVisitedBiomes() {
    return sanitizeVisitedBiomes(game.visitedBiomes, {
        visitedBiomesDropped: 0
    });
}

function serializeRecipeGuide() {
    return typeof sanitizeRecipeGuide === 'function' ? sanitizeRecipeGuide(game.recipeGuide) : null;
}

function buildSaveData() {
    return {
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
        blocks: serializeBlockEdits(),
        tamedPets: serializeTamedPets(),
        quests: typeof getQuestSaveData === 'function' ? getQuestSaveData() : {},
        visitedBiomes: serializeVisitedBiomes(),
        recipeGuide: serializeRecipeGuide()
    };
}

function backupPrimaryBeforeOverwrite() {
    if(loadedSaveSource === 'backup') return;
    try {
        const currentRaw = localStorage.getItem(SAVE_KEY);
        if(currentRaw !== null) localStorage.setItem(SAVE_BACKUP_KEY, currentRaw);
    } catch (err) {
        console.warn('Failed to refresh save backup before writing:', err);
    }
}

function ensureInitialSaveBackup(serialized) {
    try {
        if(localStorage.getItem(SAVE_BACKUP_KEY) === null) {
            localStorage.setItem(SAVE_BACKUP_KEY, serialized);
        }
    } catch (err) {
        console.warn('Primary save succeeded, but backup save could not be updated:', err);
    }
}

function saveGameNow() {
    if(!game.worldLoaded) return;
    if(!saveDirty) return;

    let serialized;
    try {
        serialized = JSON.stringify(buildSaveData());
    } catch (err) {
        console.warn('Failed to serialize save game:', err);
        saveDirty = true;
        game.saveErrored = true;
        return;
    }

    try {
        backupPrimaryBeforeOverwrite();
        localStorage.setItem(SAVE_KEY, serialized);
        ensureInitialSaveBackup(serialized);
        loadedSaveSource = 'primary';
        saveDirty = false;
        game.saveErrored = false; // clear the HUD warning once a save succeeds
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
