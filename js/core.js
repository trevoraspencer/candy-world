'use strict';

// Browser-neutral deterministic and transactional helpers. This file deliberately
// has no DOM or WebGL dependencies so the same code can run under node:test.
(function initCandyCore(root, factory) {
    const api = factory();
    if(typeof module === 'object' && module.exports) module.exports = api;
    if(root) root.CandyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCandyCore() {
    function hashString(value) {
        const text = String(value);
        let hash = 2166136261;
        for(let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function mixSeed(seed, ...parts) {
        let mixed = hashString(seed);
        for(const part of parts) {
            mixed ^= hashString(part);
            mixed = Math.imul(mixed ^ (mixed >>> 16), 2246822507) >>> 0;
            mixed = Math.imul(mixed ^ (mixed >>> 13), 3266489909) >>> 0;
        }
        return (mixed ^ (mixed >>> 16)) >>> 0;
    }

    function createRng(seed, ...streamParts) {
        let state = mixSeed(seed, ...streamParts) || 0x6d2b79f5;
        return function random() {
            state = (state + 0x6d2b79f5) >>> 0;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
    }

    function cloneSlots(slots) {
        if(!Array.isArray(slots)) return [];
        return slots.map(slot => slot && Number.isInteger(slot.id) && Number.isInteger(slot.count) && slot.count > 0
            ? Object.assign({ id: slot.id, count: slot.count },Number.isFinite(slot.durability)?{durability:slot.durability}:{})
            : null);
    }

    function countInSlots(slots, id) {
        let total = 0;
        for(const slot of slots || []) if(slot && slot.id === id) total += slot.count;
        return total;
    }

    function transactInventory(slots, transaction, getMaxStack) {
        const next = cloneSlots(slots);
        const removes = Array.isArray(transaction && transaction.remove) ? transaction.remove : [];
        const adds = Array.isArray(transaction && transaction.add) ? transaction.add : [];
        const maxFor = typeof getMaxStack === 'function' ? getMaxStack : () => 64;

        for(const entry of removes) {
            if(!entry || !Number.isInteger(entry.id) || !Number.isInteger(entry.count) || entry.count <= 0 ||
               countInSlots(next, entry.id) < entry.count) return { ok: false, slots: cloneSlots(slots), reason: 'missing-items' };
            let remaining = entry.count;
            for(let i = 0; i < next.length && remaining > 0; i++) {
                if(!next[i] || next[i].id !== entry.id) continue;
                const taken = Math.min(next[i].count, remaining);
                next[i].count -= taken;
                remaining -= taken;
                if(next[i].count === 0) next[i] = null;
            }
        }

        for(const entry of adds) {
            if(!entry || !Number.isInteger(entry.id) || !Number.isInteger(entry.count) || entry.count <= 0) {
                return { ok: false, slots: cloneSlots(slots), reason: 'invalid-addition' };
            }
            const maxStack = Math.max(1, Math.floor(maxFor(entry.id)) || 1);
            let remaining = entry.count;
            for(let i = 0; i < next.length && remaining > 0; i++) {
                const slot = next[i];
                if(!slot || slot.id !== entry.id || slot.count >= maxStack) continue;
                const added = Math.min(remaining, maxStack - slot.count);
                slot.count += added;
                remaining -= added;
            }
            for(let i = 0; i < next.length && remaining > 0; i++) {
                if(next[i]) continue;
                const added = Math.min(remaining, maxStack);
                next[i] = { id: entry.id, count: added };
                remaining -= added;
            }
            if(remaining > 0) return { ok: false, slots: cloneSlots(slots), reason: 'inventory-full' };
        }
        return { ok: true, slots: next, reason: null };
    }

    function trimPattern(pattern) {
        if(!Array.isArray(pattern) || pattern.length === 0) return [];
        const width = pattern.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
        const rows = pattern.map(row => {
            const normalized = Array.isArray(row) ? row.slice(0, width) : [];
            while(normalized.length < width) normalized.push(null);
            return normalized;
        });
        while(rows.length && rows[0].every(cell => cell == null || cell === 0)) rows.shift();
        while(rows.length && rows[rows.length - 1].every(cell => cell == null || cell === 0)) rows.pop();
        if(!rows.length) return [];
        let left = Infinity, right = -1;
        for(const row of rows) for(let x = 0; x < row.length; x++) {
            if(row[x] != null && row[x] !== 0) { left = Math.min(left, x); right = Math.max(right, x); }
        }
        if(right < left) return [];
        return rows.map(row => row.slice(left, right + 1).map(cell => cell || null));
    }

    function patternsEqual(a, b) {
        return a.length === b.length && a.every((row, y) =>
            row.length === b[y].length && row.every((cell, x) => cell === b[y][x]));
    }

    function matchShapedRecipe(grid, recipe) {
        const actual = trimPattern(grid);
        const expected = trimPattern(recipe && recipe.pattern);
        if(patternsEqual(actual, expected)) return { matched: true, mirrored: false };
        if(recipe && recipe.allowMirror) {
            const mirrored = expected.map(row => row.slice().reverse());
            if(patternsEqual(actual, mirrored)) return { matched: true, mirrored: true };
        }
        return { matched: false, mirrored: false };
    }

    function migrateDocument(document, currentVersion, migrations) {
        if(!document || typeof document !== 'object' || Array.isArray(document)) return null;
        let next = JSON.parse(JSON.stringify(document));
        let version = Number.isInteger(next.schemaVersion) ? next.schemaVersion :
            (Number.isInteger(next.version) ? next.version : 1);
        if(version < 1 || version > currentVersion) return null;
        while(version < currentVersion) {
            const migration = migrations && migrations[version];
            if(typeof migration !== 'function') return null;
            next = migration(next);
            if(!next || typeof next !== 'object' || Array.isArray(next)) return null;
            version++;
            next.version = version;
            next.schemaVersion = version;
        }
        next.version = currentVersion;
        next.schemaVersion = currentVersion;
        return next;
    }

    function advanceFixedStep(accumulator, elapsedSeconds, options) {
        const step = options && options.step > 0 ? options.step : 1 / 60;
        const maxSteps = options && options.maxSteps > 0 ? Math.floor(options.maxSteps) : 8;
        const cappedElapsed = Math.min(Math.max(0, elapsedSeconds || 0), step * maxSteps);
        let remainder = Math.max(0, accumulator || 0) + cappedElapsed;
        let steps = Math.min(maxSteps, Math.floor((remainder + 1e-12) / step));
        remainder -= steps * step;
        if(steps === maxSteps && remainder >= step) remainder %= step;
        return { steps, accumulator: remainder, alpha: Math.min(1, remainder / step) };
    }

    function computeRenderSize(cssWidth, cssHeight, devicePixelRatio, renderScale, maxDevicePixelRatio) {
        const widthCss = Math.max(1, Math.floor(Number(cssWidth) || 1));
        const heightCss = Math.max(1, Math.floor(Number(cssHeight) || 1));
        const scale = Math.max(0.5, Math.min(1, Number(renderScale) || 1));
        const cap = Math.max(1, Number(maxDevicePixelRatio) || 2);
        const cappedDpr = Math.min(Math.max(1, Number(devicePixelRatio) || 1), cap);
        const pixelRatio = cappedDpr * scale;
        return {
            cssWidth: widthCss,
            cssHeight: heightCss,
            width: Math.max(1, Math.round(widthCss * pixelRatio)),
            height: Math.max(1, Math.round(heightCss * pixelRatio)),
            cappedDpr,
            renderScale: scale,
            pixelRatio
        };
    }

    function selectScheduledWeather(scheduleIndex, biome) {
        const roll = createRng('candy-weather', scheduleIndex, biome)();
        if(roll < 0.52) return 'clear';
        if(biome === 1) return roll < 0.88 ? 'sugar-snow' : 'candy-storm';
        if(biome === 4) return roll < 0.9 ? 'sherbet-mist' : 'sprinkles';
        if(biome === 2) return 'sherbet-mist';
        return roll < 0.86 ? 'sprinkles' : 'candy-storm';
    }

    function getSwordDamage(itemId, firstSwordId) {
        const base=Number.isInteger(firstSwordId)?firstSwordId:113;
        if(!Number.isInteger(itemId)||itemId<base||itemId>base+20||(itemId-base)%4!==0)return 1;
        return [4,5,6,5,8,10][Math.floor((itemId-base)/4)]||1;
    }

    function advanceOven(oven,elapsed,recipe,fuelValues,maxStack) {
        const next=JSON.parse(JSON.stringify(oven||{}));
        next.input=next.input||null;next.fuel=next.fuel||null;next.output=next.output||null;
        next.burnTime=Math.max(0,Number(next.burnTime)||0);next.progress=Math.max(0,Number(next.progress)||0);
        let remaining=Math.max(0,Math.min(300,Number(elapsed)||0)),completed=0;
        const outputLimit=Math.max(1,maxStack||64);
        function valid(){return recipe&&next.input&&next.input.id===recipe.inputId&&next.input.count>=recipe.inputCount&&(!next.output||(next.output.id===recipe.outputId&&next.output.count+recipe.outputCount<=outputLimit));}
        while(remaining>1e-6&&completed<64&&valid()) {
            if(next.burnTime<=1e-6){const fuelValue=next.fuel&&fuelValues[next.fuel.id];if(!fuelValue)break;next.fuel.count--;if(next.fuel.count<=0)next.fuel=null;next.burnTime=fuelValue;}
            const needed=Math.max(0.001,recipe.smeltTime-next.progress),step=Math.min(remaining,next.burnTime,needed);
            next.burnTime-=step;next.progress+=step;remaining-=step;
            if(next.progress+1e-6>=recipe.smeltTime){next.input.count-=recipe.inputCount;if(next.input.count<=0)next.input=null;if(next.output)next.output.count+=recipe.outputCount;else next.output={id:recipe.outputId,count:recipe.outputCount};next.progress=0;completed++;}
        }
        next.lit=next.burnTime>0&&valid();
        return {state:next,completed,consumedSeconds:(Math.max(0,Math.min(300,Number(elapsed)||0))-remaining)};
    }

    function propagateBounded(sources, getNeighbors, budget) {
        const limit = Math.max(0, Math.floor(Number(budget) || 0));
        const queue = Array.isArray(sources) ? sources.slice() : [];
        const visited = new Set();
        const order = [];
        while(queue.length && order.length < limit) {
            const node = queue.shift();
            const key = typeof node === 'string' ? node : JSON.stringify(node);
            if(visited.has(key)) continue;
            visited.add(key);
            order.push(node);
            const neighbors = typeof getNeighbors === 'function' ? getNeighbors(node) : [];
            if(Array.isArray(neighbors)) queue.push(...neighbors);
        }
        return { order, visited, truncated: queue.length > 0 };
    }

    function advanceQuestState(definition, state, eventType, data, dependenciesComplete) {
        const next = Object.assign({ progress: 0, completed: false, unique: [] }, state || {});
        next.unique = Array.isArray(next.unique) ? next.unique.slice() : [];
        if(next.completed || definition.event !== eventType || dependenciesComplete === false) return next;
        if(definition.unique) {
            const value = data && typeof data === 'object' ? data[definition.unique] : data;
            if(value != null && !next.unique.includes(value)) next.unique.push(value);
            next.progress = next.unique.length;
        } else if(definition.absolute) {
            next.progress = Math.max(next.progress, Number(data && data.value != null ? data.value : data) || 0);
        } else {
            const amount = data && typeof data === 'object' && Number.isFinite(data.count) ? data.count : 1;
            next.progress += Math.max(0, amount);
        }
        next.progress = Math.min(definition.target, Math.floor(next.progress));
        next.completed = next.progress >= definition.target;
        return next;
    }

    function splitStack(stack) {
        if(!stack || !Number.isInteger(stack.id) || !Number.isInteger(stack.count) || stack.count < 1) return { cursor:null,slot:null };
        const cursorCount=Math.ceil(stack.count/2),slotCount=stack.count-cursorCount;
        const meta=Number.isFinite(stack.durability)?{durability:stack.durability}:{};return {cursor:Object.assign({id:stack.id,count:cursorCount},meta),slot:slotCount?Object.assign({id:stack.id,count:slotCount},meta):null};
    }

    function transferStack(slots,fromIndex,destinationIndices,getMaxStack) {
        const next=cloneSlots(slots),source=next[fromIndex];
        if(!source||!Array.isArray(destinationIndices))return{ok:false,slots:cloneSlots(slots),moved:0};
        let remaining=source.count,moved=0,max=Math.max(1,(getMaxStack||(()=>64))(source.id)||1);
        for(const index of destinationIndices){const slot=next[index];if(!slot||slot.id!==source.id||slot.count>=max)continue;const amount=Math.min(remaining,max-slot.count);slot.count+=amount;remaining-=amount;moved+=amount;if(!remaining)break;}
        for(const index of destinationIndices){if(!remaining)break;if(next[index])continue;const amount=Math.min(remaining,max);next[index]=Object.assign({id:source.id,count:amount},Number.isFinite(source.durability)?{durability:source.durability}:{});remaining-=amount;moved+=amount;}
        next[fromIndex]=remaining?Object.assign({id:source.id,count:remaining},Number.isFinite(source.durability)?{durability:source.durability}:{}):null;
        return{ok:moved>0,slots:next,moved};
    }

    function planChunkRing(centerX,centerZ,radius,worldWidth,worldDepth,velocityX,velocityZ) {
        const planned=[];for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){const cx=centerX+dx,cz=centerZ+dz;if(cx<0||cz<0||cx>=worldWidth||cz>=worldDepth)continue;planned.push({cx,cz,score:dx*dx+dz*dz-((velocityX||0)*dx+(velocityZ||0)*dz)*.25});}planned.sort((a,b)=>a.score-b.score||a.cz-b.cz||a.cx-b.cx);return planned;
    }
    function compactBlockEdit(existingEdits,key,blockId,baselineBlockId){const next=new Map(existingEdits||[]);if(blockId===baselineBlockId)next.delete(key);else next.set(key,blockId);return next;}
    function selectCheckpoint(manifest,records,validator){if(!manifest||typeof manifest!=='object')return null;const valid=typeof validator==='function'?validator:value=>typeof value==='string';for(const generation of [manifest.active,manifest.previous]){if(!generation)continue;const record=records instanceof Map?records.get(generation):records&&records[generation];if(record&&valid(record.payload))return{generation,payload:record.payload,recovered:generation!==manifest.active};}return null;}
    function transferBetween(sourceSlots,destinationSlots,sourceIndex,getMaxStack){const source=cloneSlots(sourceSlots),destination=cloneSlots(destinationSlots),stack=source[sourceIndex];if(!stack)return{ok:false,source:cloneSlots(sourceSlots),destination:cloneSlots(destinationSlots),moved:0};let remaining=stack.count,max=Math.max(1,(getMaxStack||(()=>64))(stack.id)||1);for(const slot of destination){if(!slot||slot.id!==stack.id||slot.count>=max)continue;const amount=Math.min(remaining,max-slot.count);slot.count+=amount;remaining-=amount;if(!remaining)break;}for(let i=0;i<destination.length&&remaining;i++){if(destination[i])continue;const amount=Math.min(remaining,max);destination[i]=Object.assign({id:stack.id,count:amount},Number.isFinite(stack.durability)?{durability:stack.durability}:{});remaining-=amount;}const moved=stack.count-remaining;source[sourceIndex]=remaining?Object.assign({id:stack.id,count:remaining},Number.isFinite(stack.durability)?{durability:stack.durability}:{}):null;return{ok:moved>0,source,destination,moved};}
    function computeMotionSubsteps(dx,dy,dz,maxDistance){const limit=Math.max(.01,Number(maxDistance)||.25),steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx||0),Math.abs(dy||0),Math.abs(dz||0))/limit));return{steps,dx:(dx||0)/steps,dy:(dy||0)/steps,dz:(dz||0)/steps};}
    function distributeStack(slots,cursor,indices,getMaxStack){const next=cloneSlots(slots),held=cursor&&Number.isInteger(cursor.id)&&cursor.count>0?{...cursor}:null;if(!held)return{slots:next,cursor:null,moved:0};const unique=[...new Set(indices||[])].filter(index=>Number.isInteger(index)&&index>=0&&index<next.length),max=Math.max(1,(getMaxStack||(()=>64))(held.id)||1);let moved=0,progress=true;while(held.count>0&&progress){progress=false;for(const index of unique){const slot=next[index];if(slot&&slot.id!==held.id||slot&&slot.count>=max)continue;if(slot)slot.count++;else next[index]=Object.assign({id:held.id,count:1},Number.isFinite(held.durability)?{durability:held.durability}:{});held.count--;moved++;progress=true;if(!held.count)break;}}return{slots:next,cursor:held.count?held:null,moved};}
    function isCurrentSaveGeneration(captured,current){return Number.isInteger(captured)&&captured===current;}
    async function writeToDurableBackends(writeLocalStorage,writeIndexedDb) {
        const result={ok:false,localStorage:false,indexedDb:false,localStorageError:null,indexedDbError:null};
        try {
            if(typeof writeLocalStorage!=='function')throw new TypeError('Local storage writer is required');
            writeLocalStorage();
            result.localStorage=true;
        } catch(error) {
            result.localStorageError=error;
        }
        try {
            if(typeof writeIndexedDb!=='function')throw new TypeError('IndexedDB writer is required');
            result.indexedDb=(await writeIndexedDb())===true;
        } catch(error) {
            result.indexedDbError=error;
        }
        result.ok=result.localStorage||result.indexedDb;
        return result;
    }
    function groupBlockEdits(edits,chunkDepth){const grouped=new Map(),depth=Math.max(1,chunkDepth|0);for(const [key,id] of edits||[]){const parts=String(key).split(','),x=Number(parts[0]),z=Number(parts[2]);if(!Number.isInteger(x)||!Number.isInteger(z))continue;const chunk=(x>>4)*depth+(z>>4);if(!grouped.has(chunk))grouped.set(chunk,new Map());grouped.get(chunk).set(key,id);}return grouped;}
    function computeStreamingConfig(viewDistance){const activeRadius=Math.max(2,Math.min(4,Math.round(Number(viewDistance)||4)-1)),prefetchRadius=activeRadius+4,maxLoaded=(activeRadius*2+9)**2+36;return{activeRadius,prefetchRadius,maxLoaded};}
    function shouldAdvanceCrop(seed,x,y,z,tick,hydrated,light,factor){if(!hydrated||Number(light)<=.45)return false;const roll=(mixSeed(seed,'crop',x,y,z,tick)>>>0)/4294967296;return roll<Math.min(.95,.22*Math.max(0,Number(factor)||1));}

    return {
        hashString,
        mixSeed,
        createRng,
        cloneSlots,
        countInSlots,
        transactInventory,
        trimPattern,
        matchShapedRecipe,
        migrateDocument,
        advanceFixedStep,
        computeRenderSize,
        selectScheduledWeather,
        getSwordDamage,
        advanceOven,
        propagateBounded,
        advanceQuestState,
        splitStack,
        transferStack,
        planChunkRing,
        compactBlockEdit,
        selectCheckpoint,
        transferBetween,
        computeMotionSubsteps,
        distributeStack,
        isCurrentSaveGeneration,
        writeToDurableBackends,
        groupBlockEdits,
        computeStreamingConfig,
        shouldAdvanceCrop
    };
});
