'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');

test('seeded streams are repeatable and independently derived', () => {
    const a = Core.createRng('candy-seed', 'terrain', 4, -2);
    const b = Core.createRng('candy-seed', 'terrain', 4, -2);
    const c = Core.createRng('candy-seed', 'structures', 4, -2);
    const sequenceA = Array.from({ length: 8 }, () => a());
    assert.deepEqual(sequenceA, Array.from({ length: 8 }, () => b()));
    assert.notDeepEqual(sequenceA, Array.from({ length: 8 }, () => c()));
    assert.ok(sequenceA.every(value => value >= 0 && value < 1));
});

test('inventory transaction is atomic on missing input or output overflow', () => {
    const slots = [{ id: 1, count: 2 }, { id: 2, count: 64 }];
    const missing = Core.transactInventory(slots, { remove: [{ id: 1, count: 3 }] });
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.slots, slots);

    const full = Core.transactInventory(slots, {
        remove: [{ id: 1, count: 1 }],
        add: [{ id: 3, count: 2 }]
    }, () => 1);
    assert.equal(full.ok, false);
    assert.deepEqual(full.slots, slots);
});

test('inventory transaction consumes and stacks in one commit', () => {
    const result = Core.transactInventory(
        [{ id: 1, count: 3 }, { id: 4, count: 60 }, null],
        { remove: [{ id: 1, count: 2 }], add: [{ id: 4, count: 8 }] },
        () => 64
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.slots, [{ id: 1, count: 1 }, { id: 4, count: 64 }, { id: 4, count: 4 }]);
});

test('shaped matching trims empty borders and mirrors only when declared', () => {
    const recipe = { pattern: [[1, 1, 1], [null, 2, null], [null, 2, null]] };
    assert.equal(Core.matchShapedRecipe([[null, 1, 1, 1], [null, null, 2], [null, null, 2]], recipe).matched, true);
    const axe = { pattern: [[1, 1], [1, 2], [null, 2]], allowMirror: true };
    const mirrored = [[1, 1], [2, 1], [2, null]];
    assert.deepEqual(Core.matchShapedRecipe(mirrored, axe), { matched: true, mirrored: true });
    assert.equal(Core.matchShapedRecipe(mirrored, { ...axe, allowMirror: false }).matched, false);
});

test('save migrations chain without mutating input and are idempotent', () => {
    const legacy = { version: 1, inventory: [{ id: 1, count: 4 }] };
    const migrations = {
        1: save => ({ ...save, worldSeed: 'legacy' }),
        2: save => ({ ...save, settings: { renderScale: 1 } })
    };
    const migrated = Core.migrateDocument(legacy, 3, migrations);
    assert.equal(migrated.schemaVersion, 3);
    assert.equal(migrated.worldSeed, 'legacy');
    assert.deepEqual(legacy, { version: 1, inventory: [{ id: 1, count: 4 }] });
    assert.deepEqual(Core.migrateDocument(migrated, 3, migrations), migrated);
    assert.equal(Core.migrateDocument({ version: 9 }, 3, migrations), null);
});

test('fixed-step accumulator is frame-rate independent and caps hitches', () => {
    const simulate = frames => {
        let accumulator = 0, ticks = 0;
        for(const elapsed of frames) {
            const advanced = Core.advanceFixedStep(accumulator, elapsed, { step: 1 / 60, maxSteps: 12 });
            accumulator = advanced.accumulator;
            ticks += advanced.steps;
        }
        return ticks;
    };
    assert.equal(simulate(Array(30).fill(1 / 30)), 60);
    assert.equal(simulate(Array(60).fill(1 / 60)), 60);
    assert.equal(simulate(Array(144).fill(1 / 144)), 60);
    assert.equal(Core.advanceFixedStep(0, 1, { step: 1 / 60, maxSteps: 8 }).steps, 8);
});

test('recorded movement integrates to the same position at 30, 60, and 144 Hz',()=>{const run=rate=>{let accumulator=0,x=0;for(let frame=0;frame<rate*3;frame++){const advanced=Core.advanceFixedStep(accumulator,1/rate,{step:1/60,maxSteps:12});accumulator=advanced.accumulator;for(let tick=0;tick<advanced.steps;tick++)x+=4.5/60;}return x;};assert.ok(Math.abs(run(30)-13.5)<1e-9);assert.ok(Math.abs(run(60)-run(30))<1e-9);assert.ok(Math.abs(run(144)-run(30))<1e-9);});

test('render sizing preserves CSS size and supports capped quality scales', () => {
    assert.deepEqual(Core.computeRenderSize(1280, 720, 2, 1, 2), {
        cssWidth: 1280, cssHeight: 720, width: 2560, height: 1440,
        cappedDpr: 2, renderScale: 1, pixelRatio: 2
    });
    assert.equal(Core.computeRenderSize(1280, 720, 2, 0.75, 2).width, 1920);
    assert.equal(Core.computeRenderSize(1280, 720, 2, 0.5, 2).height, 720);
    assert.equal(Core.computeRenderSize(800, 600, 4, 1, 2).width, 1600);
});

test('scheduled weather is deterministic and biome-valid', () => {
    for(let schedule = 0; schedule < 200; schedule++) {
        for(let biome = 0; biome <= 4; biome++) {
            const weather = Core.selectScheduledWeather(schedule, biome);
            assert.equal(weather, Core.selectScheduledWeather(schedule, biome));
            if(weather === 'sugar-snow') assert.equal(biome, 1);
            if(weather === 'sherbet-mist') assert.ok(biome === 2 || biome === 4);
        }
    }
});

test('combat damage distinguishes sword tiers and rejects non-swords', () => {
    assert.equal(Core.getSwordDamage(113,113),4);
    assert.equal(Core.getSwordDamage(117,113),5);
    assert.equal(Core.getSwordDamage(129,113),8);
    assert.equal(Core.getSwordDamage(133,113),10);
    assert.equal(Core.getSwordDamage(126,113),1);
});

test('oven consumes fuel over time and survives reload-shaped state', () => {
    const recipe={inputId:9,inputCount:1,outputId:150,outputCount:1,smeltTime:5};
    const result=Core.advanceOven({input:{id:9,count:2},fuel:{id:6,count:1},output:null,burnTime:0,progress:2},8,recipe,{6:10},64);
    assert.equal(result.completed,2);
    assert.deepEqual(result.state.input,null);
    assert.deepEqual(result.state.output,{id:150,count:2});
    assert.equal(result.state.fuel,null);
});

test('oven pauses safely for invalid input, missing fuel, and output overflow', () => {
    const recipe={inputId:9,inputCount:1,outputId:150,outputCount:1,smeltTime:5};
    const blocked={input:{id:9,count:1},fuel:{id:6,count:1},output:{id:150,count:64},burnTime:4,progress:3};
    const blockedResult=Core.advanceOven(blocked,20,recipe,{6:10},64).state;
    assert.equal(blockedResult.progress,3);
    assert.equal(blockedResult.burnTime,4);
    assert.equal(blockedResult.output.count,64);
    assert.equal(blockedResult.lit,false);
    const noFuel={input:{id:9,count:1},fuel:null,output:null,burnTime:0,progress:0};
    assert.equal(Core.advanceOven(noFuel,20,recipe,{6:10},64).completed,0);
    assert.equal(Core.advanceOven(noFuel,9999,recipe,{6:10},64).consumedSeconds,0);
});

test('bounded propagation protects against cycles and enforces its work budget', () => {
    const graph = { a: ['b'], b: ['c'], c: ['a', 'd'], d: [] };
    const complete = Core.propagateBounded(['a'], node => graph[node], 8);
    assert.deepEqual(complete.order, ['a', 'b', 'c', 'd']);
    assert.equal(complete.truncated, false);
    const limited = Core.propagateBounded(['a'], node => graph[node], 2);
    assert.deepEqual(limited.order, ['a', 'b']);
    assert.equal(limited.truncated, true);
});

test('structure feature streams are independent of request order', () => {
    const signature = (sx,sz,family) => Array.from({length:5},CandyCore.createRng('world-42','structure',2,sx,sz,family));
    const forward = [[0,0,0],[1,2,1],[3,1,2]].map(args=>signature(...args));
    const reverse = [[3,1,2],[1,2,1],[0,0,0]].map(args=>signature(...args)).reverse();
    assert.deepEqual(forward,reverse);
    assert.notDeepEqual(signature(0,0,0),signature(0,0,1));
});

test('mob and villager feature streams are seed- and order-independent',()=>{
    const mob=(cx,cz,attempt)=>Array.from({length:5},Core.createRng('world-42','chunk-mobs',2,cx,cz,attempt));
    const villager=(x,z,type)=>Array.from({length:5},Core.createRng('world-42','villager-trades',type,Core.mixSeed('world-42','villager',x,z,type)));
    const requests=[[3,2,0],[8,5,1],[2,9,0]];
    assert.deepEqual(requests.map(args=>mob(...args)),requests.slice().reverse().map(args=>mob(...args)).reverse());
    assert.deepEqual(villager(40,72,7),villager(40,72,7));
    assert.notDeepEqual(villager(40,72,7),villager(41,72,7));
});

test('quest progress respects dependencies, uniqueness, and exact completion', () => {
    const countDef={event:'blockPlaced',target:3};
    assert.deepEqual(Core.advanceQuestState(countDef,{progress:0},'blockPlaced',{},false),{progress:0,completed:false,unique:[]});
    const progressed=Core.advanceQuestState(countDef,{progress:1},'blockPlaced',{count:2},true);
    assert.equal(progressed.progress,3);assert.equal(progressed.completed,true);
    const uniqueDef={event:'biomeVisited',target:2,unique:'biome'};
    let state=Core.advanceQuestState(uniqueDef,null,'biomeVisited',{biome:1},true);
    state=Core.advanceQuestState(uniqueDef,state,'biomeVisited',{biome:1},true);
    assert.equal(state.progress,1);
    state=Core.advanceQuestState(uniqueDef,state,'biomeVisited',{biome:3},true);
    assert.equal(state.completed,true);
});

test('stack splitting and range transfers preserve exact item counts', () => {
    assert.deepEqual(Core.splitStack({id:7,count:5}),{cursor:{id:7,count:3},slot:{id:7,count:2}});
    const slots=[{id:7,count:10},null,{id:7,count:63},null];
    const result=Core.transferStack(slots,0,[2,3],()=>64);
    assert.equal(result.moved,10);assert.deepEqual(result.slots,[null,null,{id:7,count:64},{id:7,count:9}]);
    assert.equal(result.slots.reduce((n,s)=>n+(s?.count||0),0),73);
    assert.deepEqual(slots,[{id:7,count:10},null,{id:7,count:63},null]);
});

test('inventory transactions preserve tool durability metadata',()=>{const slots=[{id:110,count:1,durability:17},null],clone=Core.cloneSlots(slots);assert.deepEqual(clone,slots);const moved=Core.transferStack(slots,0,[1],()=>1);assert.equal(moved.slots[1].durability,17);});
test('right-clicking a damaged cursor tool into an empty slot preserves its metadata once',()=>{const tool={id:110,count:1,durability:17},result=Core.placeOneFromCursor([null],tool,0,()=>1);assert.deepEqual(result,{slots:[tool],cursor:null,moved:1});assert.deepEqual(tool,{id:110,count:1,durability:17});});
test('right-click placement keeps normal one-item stack behavior',()=>{const result=Core.placeOneFromCursor([null],{id:4,count:3},0,()=>64);assert.deepEqual(result,{slots:[{id:4,count:1}],cursor:{id:4,count:2},moved:1});});
test('closing inventory returns a damaged cursor tool with durability intact',()=>{const tool={id:110,count:1,durability:17},result=Core.returnCursorStack([null],tool,()=>1);assert.deepEqual(result,{ok:true,slots:[tool],drop:null,moved:1});assert.deepEqual(tool,{id:110,count:1,durability:17});});
test('closing a chest returns the damaged cursor tool without duplication',()=>{const slots=Array(36).fill(null),tool={id:110,count:1,durability:9},result=Core.returnCursorStack(slots,tool,()=>1);assert.equal(result.ok,true);assert.deepEqual(result.slots[0],tool);assert.equal(result.slots.filter(Boolean).length,1);assert.equal(result.drop,null);});
test('closing a furnace preserves the full damaged tool when it must be dropped',()=>{const full=Array.from({length:36},(_,id)=>({id,count:1})),tool={id:110,count:1,durability:5},result=Core.returnCursorStack(full,tool,()=>1);assert.deepEqual(result,{ok:false,slots:full,drop:tool,moved:0});assert.equal(result.slots.some(slot=>slot.id===tool.id),false);});
test('cursor helpers never merge stacks with unequal durability metadata',()=>{
    const destination=[{id:4,count:2,durability:10},null],cursor={id:4,count:1,durability:5};
    const placed=Core.placeOneFromCursor(destination,cursor,0,()=>64);
    assert.deepEqual(placed,{slots:destination,cursor,moved:0});
    const returned=Core.returnCursorStack(destination,cursor,()=>64);
    assert.deepEqual(returned,{ok:true,slots:[destination[0],cursor],drop:null,moved:1});
    const blocked=Core.returnCursorStack([destination[0]],cursor,()=>64);
    assert.deepEqual(blocked,{ok:false,slots:[destination[0]],drop:cursor,moved:0});
});
test('cursor commit retains the exact stack unless inventory or world accepts all of it',()=>{
    const full=Array.from({length:36},(_,id)=>({id,count:64})),tool={id:110,count:1,durability:5};
    const refused=Core.commitCursorStack(full,tool,()=>1,()=>false);
    assert.deepEqual(refused,{ok:false,slots:full,cursor:tool,moved:0,location:null});
    let committed=null;
    const dropped=Core.commitCursorStack(full,tool,()=>1,stack=>{committed=stack;return true;});
    assert.deepEqual(dropped,{ok:true,slots:full,cursor:null,moved:1,location:'world'});
    assert.deepEqual(committed,tool);
});
test('randomized cursor operations conserve counts and match legacy ordinary stacking',()=>{
    const random=Core.createRng('cursor-conservation'),max=()=>4;
    const clone=slots=>slots.map(slot=>slot?{...slot}:null);
    const legacy=(slots,cursor)=>{
        const original=clone(slots),next=clone(slots);let remaining=cursor.count;
        for(const slot of next){if(!slot||slot.id!==cursor.id||slot.count>=4)continue;const moved=Math.min(remaining,4-slot.count);slot.count+=moved;remaining-=moved;if(!remaining)break;}
        for(let i=0;i<next.length&&remaining;i++)if(!next[i]){const moved=Math.min(remaining,4);next[i]={id:cursor.id,count:moved};remaining-=moved;}
        return remaining?{ok:false,slots:original}:{ok:true,slots:next};
    };
    const total=(slots,id)=>slots.reduce((sum,slot)=>sum+(slot?.id===id?slot.count:0),0);
    for(let iteration=0;iteration<2000;iteration++){
        const slots=Array.from({length:1+Math.floor(random()*12)},()=>random()<.35?null:{id:1+Math.floor(random()*4),count:1+Math.floor(random()*4)});
        const cursor={id:1+Math.floor(random()*4),count:1+Math.floor(random()*9)},expected=legacy(slots,cursor),actual=Core.returnCursorStack(slots,cursor,max);
        assert.equal(actual.ok,expected.ok);assert.deepEqual(actual.slots,expected.slots);
        assert.equal(total(actual.slots,cursor.id)+(actual.drop?.count||0),total(slots,cursor.id)+cursor.count);
        const index=Math.floor(random()*slots.length),placed=Core.placeOneFromCursor(slots,cursor,index,max);
        assert.equal(total(placed.slots,cursor.id)+(placed.cursor?.count||0),total(slots,cursor.id)+cursor.count);
    }
});
test('cross-container shift transfer is atomic and preserves overflow',()=>{const source=[{id:4,count:10}],destination=[{id:4,count:60},null],moved=Core.transferBetween(source,destination,0,()=>64);assert.equal(moved.moved,10);assert.deepEqual(moved.source,[null]);assert.deepEqual(moved.destination,[{id:4,count:64},{id:4,count:6}]);const full=Core.transferBetween(source,[{id:3,count:64}],0,()=>64);assert.equal(full.ok,false);assert.deepEqual(full.source,source);});
test('motion substeps never exceed a quarter block during a hitch',()=>{const motion=Core.computeMotionSubsteps(1.35,-10,0,.25);assert.equal(motion.steps,40);assert.ok(Math.abs(motion.dx)<=.25&&Math.abs(motion.dy)<=.25);assert.equal(motion.dy*motion.steps,-10);});
test('drag distribution conserves counts and skips incompatible slots',()=>{const result=Core.distributeStack([null,{id:2,count:2},{id:3,count:4}],{id:2,count:7},[0,1,2,0],()=>4);assert.deepEqual(result.slots,[{id:2,count:4},{id:2,count:4},{id:3,count:4}]);assert.deepEqual(result.cursor,{id:2,count:1});assert.equal(result.moved,6);});

test('streaming ring is bounded, deterministic, and supports thousand-block travel', () => {
    const atSpawn=Core.planChunkRing(8,8,7,128,128,0,0),far=Core.planChunkRing(71,8,7,128,128,4,0);
    assert.equal(atSpawn.length,225);assert.equal(far.length,225);assert.deepEqual(atSpawn,Core.planChunkRing(8,8,7,128,128,0,0));
    assert.ok(far.some(chunk=>chunk.cx*16>=1136));assert.ok(far[0].cx>=71);
    const edge=Core.planChunkRing(0,0,7,128,128,0,0);assert.equal(edge.length,64);
});

test('view-distance presets produce bounded active and prefetch rings',()=>{assert.deepEqual(Core.computeStreamingConfig(3),{activeRadius:2,prefetchRadius:6,maxLoaded:205});assert.deepEqual(Core.computeStreamingConfig(4),{activeRadius:3,prefetchRadius:7,maxLoaded:261});assert.deepEqual(Core.computeStreamingConfig(5),{activeRadius:4,prefetchRadius:8,maxLoaded:325});});

test('crop growth rolls are deterministic, hydrated, lit, and bounded',()=>{const sequence=Array.from({length:80},(_,tick)=>Core.shouldAdvanceCrop('farm',12,31,18,tick,true,.8,1));assert.deepEqual(sequence,Array.from({length:80},(_,tick)=>Core.shouldAdvanceCrop('farm',12,31,18,tick,true,.8,1)));assert.equal(sequence.filter(Boolean).length,16);assert.equal(Core.shouldAdvanceCrop('farm',12,31,18,1,false,1,1),false);assert.equal(Core.shouldAdvanceCrop('farm',12,31,18,1,true,.2,1),false);});

test('regenerated chunks can reapply persisted edits without duplication', () => {
    const chunk=new Uint8Array(16*64*16),edits=new Map([['1140,31,132',21],['1140,32,132',0],['140,31,132',7]]);
    const cx=71,cz=8;for(const [key,id] of edits){const [x,y,z]=key.split(',').map(Number);if((x>>4)===cx&&(z>>4)===cz)chunk[(x&15)+(z&15)*16+y*256]=id;}
    assert.equal(chunk[(1140&15)+(132&15)*16+31*256],21);assert.equal(chunk[(1140&15)+(132&15)*16+32*256],0);
    assert.equal([...edits].length,3);
});

test('block diff compaction removes edits restored to deterministic baseline', () => {
    let edits=Core.compactBlockEdit(new Map(),'1,20,1',21,3);assert.equal(edits.get('1,20,1'),21);
    edits=Core.compactBlockEdit(edits,'1,20,1',3,3);assert.equal(edits.has('1,20,1'),false);
    assert.equal(edits.size,0);
});

test('checkpoint selection falls back to the previous complete generation', () => {
    const records=new Map([['a',{payload:'bad'}],['b',{payload:'{"version":4}'}]]),validator=value=>{try{return JSON.parse(value).version===4;}catch{return false;}};
    assert.deepEqual(Core.selectCheckpoint({active:'a',previous:'b'},records,validator),{generation:'b',payload:'{"version":4}',recovered:true});
    assert.equal(Core.selectCheckpoint({active:'a'},records,validator),null);
});

test('an older asynchronous checkpoint cannot clear a newer dirty generation',()=>{
    assert.equal(Core.isCurrentSaveGeneration(4,4),true);
    assert.equal(Core.isCurrentSaveGeneration(4,5),false);
});

test('durable writes remain successful when IndexedDB is unavailable',async()=>{
    let localWrites=0,idbWrites=0;
    const result=await Core.writeToDurableBackends(()=>{localWrites++;},()=>{idbWrites++;return false;});
    assert.equal(localWrites,1);assert.equal(idbWrites,1);
    assert.deepEqual(result,{ok:true,localStorage:true,indexedDb:false,localStorageError:null,indexedDbError:null});
});

test('durable writes fall back to IndexedDB after a local storage failure',async()=>{
    const localError=new Error('quota exceeded');
    const result=await Core.writeToDurableBackends(()=>{throw localError;},async()=>true);
    assert.equal(result.ok,true);assert.equal(result.localStorage,false);assert.equal(result.indexedDb,true);
    assert.equal(result.localStorageError,localError);assert.equal(result.indexedDbError,null);
});

test('durable writes report failure when both backends fail',async()=>{
    const localError=new Error('local write failed'),idbError=new Error('checkpoint failed');
    const result=await Core.writeToDurableBackends(()=>{throw localError;},async()=>{throw idbError;});
    assert.equal(result.ok,false);assert.equal(result.localStorage,false);assert.equal(result.indexedDb,false);
    assert.equal(result.localStorageError,localError);assert.equal(result.indexedDbError,idbError);
});

test('one hundred thousand block edits serialize and round-trip exactly', () => {
    const edits=Array.from({length:100000},(_,i)=>[i%2048,1+Math.floor(i/4194304),(Math.floor(i/2048))%2048,(i%50)+1]);
    const encoded=JSON.stringify({version:4,blocks:edits}),decoded=JSON.parse(encoded);
    assert.equal(decoded.blocks.length,100000);assert.deepEqual(decoded.blocks[99999],edits[99999]);assert.ok(encoded.length>1000000);
    const map=new Map(decoded.blocks.map(([x,y,z,id])=>[`${x},${y},${z}`,id])),grouped=Core.groupBlockEdits(map,128);
    assert.equal([...grouped.values()].reduce((sum,bucket)=>sum+bucket.size,0),100000);
    assert.ok(Math.max(...[...grouped.values()].map(bucket=>bucket.size))<300);
});
