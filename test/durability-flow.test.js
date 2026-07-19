'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../js/core.js');

const readSource = file => fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const body = source.indexOf('{', start);
    let depth = 0;
    for(let index = body; index < source.length; index++) {
        if(source[index] === '{') depth++;
        else if(source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Could not extract ${name}`);
}

function loadDrops() {
    const game = { itemDrops: [], player: { x:0, y:0, z:0 } };
    const picked = [];
    const context = vm.createContext({
        CandyCore: Core,
        CandyEvents: { emit() {} },
        game,
        getItemMaxStack: id => id === 110 ? 1 : 64,
        hash2D: () => 0,
        isSolid: () => false,
        getBlock: () => 0,
        addItemStack: stack => { picked.push({ id:stack.id, count:stack.count, durability:stack.durability }); return true; }
    });
    new vm.Script(readSource('drops.js')).runInContext(context);
    return {
        game,
        picked,
        spawn: vm.runInContext('spawnItemDrop', context),
        commit: vm.runInContext('commitItemDropStacks', context),
        update: vm.runInContext('updateItemDrops', context)
    };
}

test('world drops report saturation and retain a refused cursor stack', () => {
    const drops = loadDrops();
    drops.game.itemDrops = Array.from({ length:192 }, (_, index) => ({ id:index + 1, count:1, x:index, y:1, z:0, age:1, spin:0 }));
    assert.equal(drops.spawn(999, 1, 0, 1, 0), false);
    assert.equal(drops.game.itemDrops.length, 192);

    const inventory = Array.from({ length:36 }, (_, id) => ({ id:id + 1, count:64 }));
    const tool = { id:110, count:1, durability:7 };
    const refused = Core.commitCursorStack(inventory, tool, () => 1, stack => drops.spawn(stack.id, stack.count, 0, 1, 0, undefined, stack));
    assert.deepEqual(refused, { ok:false, slots:inventory, cursor:tool, moved:0, location:null });

    drops.game.itemDrops.pop();
    const accepted = Core.commitCursorStack(inventory, tool, () => 1, stack => drops.spawn(stack.id, stack.count, 0, 1, 0, undefined, stack));
    assert.equal(accepted.ok, true);
    assert.equal(accepted.cursor, null);
    assert.equal(drops.game.itemDrops.at(-1).durability, 7);
});

test('saturated world-drop merges never overflow a stack or partially accept a source', () => {
    const drops = loadDrops();
    const saturated = () => Array.from({ length:192 }, (_, index) => ({ id:1000 + index, count:64, x:index, y:1, z:0, age:1, spin:0 }));

    drops.game.itemDrops = saturated();
    drops.game.itemDrops[0] = { id:4, count:64, x:0, y:1, z:0, age:1, spin:0 };
    const fullSnapshot = structuredClone(drops.game.itemDrops);
    assert.equal(drops.spawn(4, 1, 0, 1, 0), false);
    assert.deepEqual(drops.game.itemDrops, fullSnapshot);
    assert.ok(drops.game.itemDrops.every(drop => drop.count <= 64));

    drops.game.itemDrops = saturated();
    drops.game.itemDrops[0] = { id:4, count:63, x:0, y:1, z:0, age:1, spin:0 };
    const partialSnapshot = structuredClone(drops.game.itemDrops);
    assert.equal(drops.spawn(4, 2, 0, 1, 0), false);
    assert.deepEqual(drops.game.itemDrops, partialSnapshot);
    assert.equal(drops.spawn(999, 1, 0, 1, 0), false);
    assert.deepEqual(drops.game.itemDrops, partialSnapshot);

    drops.game.itemDrops[1] = { id:4, count:63, x:10, y:1, z:0, age:1, spin:0 };
    assert.equal(drops.spawn(4, 2, 0, 1, 0), true);
    assert.equal(drops.game.itemDrops[0].count, 64);
    assert.equal(drops.game.itemDrops[1].count, 64);
});

test('multi-stack drop commits roll back earlier merges when a later stack is refused', () => {
    const drops = loadDrops();
    drops.game.itemDrops = Array.from({ length:192 }, (_, index) => ({ id:1000 + index, count:64, x:index, y:1, z:0, age:1, spin:0 }));
    drops.game.itemDrops[0] = { id:4, count:63, x:0, y:1, z:0, age:1, spin:0 };
    const before = structuredClone(drops.game.itemDrops);

    assert.equal(drops.commit([{ id:4, count:1 }, { id:999, count:1 }], 0, 1, 0), false);
    assert.deepEqual(JSON.parse(JSON.stringify(drops.game.itemDrops)), before);
});

test('drop creation, merging, and pickup preserve metadata boundaries', () => {
    const drops = loadDrops();
    assert.equal(drops.spawn(4, 2, 0, 1, 0), true);
    assert.equal(drops.spawn(4, 3, 0, 1, 0), true);
    assert.equal(drops.game.itemDrops.length, 1);
    assert.equal(drops.game.itemDrops[0].count, 5);

    assert.equal(drops.spawn(4, 1, 0, 1, 0, undefined, { durability:10 }), true);
    assert.equal(drops.spawn(4, 1, 0, 1, 0, undefined, { durability:5 }), true);
    assert.equal(drops.game.itemDrops.length, 3);
    drops.game.itemDrops = [{ id:110, count:1, durability:9, x:0, y:1, z:0, vx:0, vy:0, vz:0, age:1, spin:0 }];
    drops.update(.01);
    assert.deepEqual(drops.picked, [{ id:110, count:1, durability:9 }]);
    assert.equal(drops.game.itemDrops.length, 0);
});

test('drop save and load paths round-trip durability', () => {
    const persistence = readSource('persistence.js');
    const serialize = vm.runInNewContext(`(${extractFunction(persistence, 'serializeItemDrops')})`, {
        game:{ itemDrops:[{ id:110, count:1, durability:12, x:1, y:2, z:3, age:4, spin:5 }] },
        MAX_ITEM_DROPS:192
    });
    const saved = serialize();
    assert.equal(saved[0].durability, 12);

    const sanitize = vm.runInNewContext(`${extractFunction(persistence, 'sanitizeInventorySlot')};${extractFunction(persistence, 'sanitizeItemDrop')};sanitizeItemDrop`, {
        isSaveObject:value=>!!value&&typeof value==='object'&&!Array.isArray(value),
        isValidItemId:id=>id===110,
        getItemMaxStack:()=>1,
        isToolItem:()=>true,
        getToolMaxDurability:()=>64,
        clampNumber:(value,min,max)=>Math.max(min,Math.min(max,value)),
        WORLD_W:128,
        WORLD_D:128,
        CHUNK_H:64
    });
    const loaded = sanitize(saved[0]);
    assert.equal(loaded.id, 110);
    assert.equal(loaded.count, 1);
    assert.equal(loaded.durability, 12);
});

test('closing the crafting table returns the cursor and refuses to close on failed commit', () => {
    const closeSource = extractFunction(readSource('player.js'), 'closeCraftingTableUI');
    const createClose = overrides => vm.runInNewContext(`(${closeSource})`, {
        game: { cursorStack:{ id:110, count:1, durability:11 }, craftingTableOpen:true, craftingTablePos:{ x:1, y:2, z:3 }, canvas:{} },
        returnCraftGrid: () => true,
        returnCursorStackToInventory: () => true,
        document: { getElementById: () => ({ style:{} }) },
        requestGamePointerLock() {},
        ...overrides
    });
    let returned = 0;
    const successGame = { cursorStack:{ id:110, count:1, durability:11 }, craftingTableOpen:true, craftingTablePos:{} , canvas:{} };
    const close = createClose({ game:successGame, returnCursorStackToInventory:()=>{returned++;successGame.cursorStack=null;return true;} });
    assert.equal(close(), true);
    assert.equal(returned, 1);
    assert.equal(successGame.craftingTableOpen, false);

    const blockedGame = { cursorStack:{ id:110, count:1, durability:11 }, craftingTableOpen:true, craftingTablePos:{}, canvas:{} };
    const blocked = createClose({ game:blockedGame, returnCursorStackToInventory:()=>false });
    assert.equal(blocked(), false);
    assert.equal(blockedGame.craftingTableOpen, true);
    assert.deepEqual(blockedGame.cursorStack, { id:110, count:1, durability:11 });
});

test('crafting-grid return passes complete stacks and retains an uncommitted stack', () => {
    const returnSource = extractFunction(readSource('crafting.js'), 'returnCraftGrid');
    const tool = { id:110, count:1, durability:13 };
    const grid = [tool];
    let added=null,dropped=null;
    const returnGrid = vm.runInNewContext(`(${returnSource})`, {
        game:{ player:{ x:1, y:2, z:3 } },
        getCraftGridConfig:()=>({ grid }),
        addItemStack:stack=>{added=stack;return false;},
        spawnItemDrop:(id,count,x,y,z,velocity,stack)=>{dropped=stack;return true;},
        renderCraftGrid() {}
    });
    assert.equal(returnGrid('table'), true);
    assert.equal(added, tool);
    assert.equal(dropped, tool);
    assert.equal(grid[0], null);

    const blockedGrid = [tool];
    const blocked = vm.runInNewContext(`(${returnSource})`, {
        game:{ player:{ x:1, y:2, z:3 } },
        getCraftGridConfig:()=>({ grid:blockedGrid }),
        addItemStack:()=>false,
        spawnItemDrop:()=>false,
        renderCraftGrid() {}
    });
    assert.equal(blocked('table'), false);
    assert.equal(blockedGrid[0], tool);
});

test('chest, oven, and death drop complete source stacks', () => {
    const tool = { id:110, count:1, durability:15 };
    const captured = [];
    const spawn = (id,count,x,y,z,velocity,stack) => { captured.push(stack); return true; };
    const commit = stacks => { captured.push(...stacks.filter(Boolean)); return true; };

    const chest = vm.runInNewContext(`(${extractFunction(readSource('utilities.js'), 'breakUtilityBlock')})`, {
        game:{ blockEntities:new Map([['1,2,3',{ type:'chest', slots:[tool] }]]), blockStates:new Map() },
        blockEntityKey:()=> '1,2,3', commitItemDropStacks:commit, updateFenceConnectionsAround() {}, scheduleSaveGame() {}
    });
    assert.equal(chest(1,2,3,1), true);

    const oven = vm.runInNewContext(`(${extractFunction(readSource('oven.js'), 'breakBlockEntity')})`, {
        game:{ blockEntities:new Map([['1,2,3',{ input:tool, fuel:null, output:null }]]) },
        blockEntityKey:()=> '1,2,3', commitItemDropStacks:commit, updateLightSource() {}, AIR:0, scheduleSaveGame() {}
    });
    assert.equal(oven(1,2,3), true);

    const deathGame={ worldMode:'survival', inventory:[tool], player:{ x:1, y:2, z:3 }, combat:{ dead:false }, paused:false };
    const death = vm.runInNewContext(`(${extractFunction(readSource('effects.js'), 'killPlayer')})`, {
        game:deathGame, spawnItemDrop:spawn, hash2D:()=>.5, clearInputState() {}, document:{ exitPointerLock() {}, getElementById:()=>({ focus() {} }) }, updateHotbar() {}, setMetaVisible() {}
    });
    death({ type:'test' });
    assert.deepEqual(captured, [tool,tool,tool]);
    assert.equal(deathGame.inventory[0], null);
});

test('chest and oven destruction retain their entities when contents cannot be committed', () => {
    const tool = { id:110, count:1, durability:15 };
    const blockedCommit = () => false;

    let chestSaves=0,chestConnections=0;
    const chestState={ type:'chest', slots:[tool] },chestGame={
        blockEntities:new Map([['1,2,3',chestState]]),
        blockStates:new Map([['1,2,3',{ facing:1 }]])
    };
    const chest = vm.runInNewContext(`(${extractFunction(readSource('utilities.js'), 'breakUtilityBlock')})`, {
        game:chestGame,
        blockEntityKey:()=> '1,2,3',
        commitItemDropStacks:blockedCommit,
        updateFenceConnectionsAround() { chestConnections++; },
        scheduleSaveGame() { chestSaves++; }
    });
    assert.equal(chest(1,2,3,1), false);
    assert.equal(chestGame.blockEntities.get('1,2,3'), chestState);
    assert.equal(chestGame.blockStates.has('1,2,3'), true);
    assert.equal(chestConnections, 0);
    assert.equal(chestSaves, 0);

    let ovenSaves=0,lightUpdates=0;
    const ovenState={ type:'oven', input:tool, fuel:null, output:null },ovenGame={
        blockEntities:new Map([['1,2,3',ovenState]])
    };
    const oven = vm.runInNewContext(`(${extractFunction(readSource('oven.js'), 'breakBlockEntity')})`, {
        game:ovenGame,
        blockEntityKey:()=> '1,2,3',
        commitItemDropStacks:blockedCommit,
        updateLightSource() { lightUpdates++; },
        AIR:0,
        scheduleSaveGame() { ovenSaves++; }
    });
    assert.equal(oven(1,2,3), false);
    assert.equal(ovenGame.blockEntities.get('1,2,3'), ovenState);
    assert.equal(lightUpdates, 0);
    assert.equal(ovenSaves, 0);
});
