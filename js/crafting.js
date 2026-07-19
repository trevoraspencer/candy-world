'use strict';

// ====== CRAFTING SYSTEM ======
// Recipes are categorized by where they can be crafted:
//   BASIC_RECIPES    — available from the inventory crafting panel (simple hand-crafting)
//   ADVANCED_RECIPES — require a placed Crafting Table block (tools, treats, decorative)
//   SMELTING_RECIPES — require a placed Furnace block (ore smelting, glass)

const BASIC_RECIPES = [
    // Basic materials (hand-craftable)
    { result: { id: PLANKS, count: 4 }, ingredients: [{ id: WOOD, count: 1 }] },
    { result: { id: ITEM_STICK, count: 4 }, ingredients: [{ id: PLANKS, count: 2 }] },
    { result: { id: CRAFTING_TABLE, count: 1 }, ingredients: [{ id: PLANKS, count: 4 }] },
    { result: { id: FURNACE, count: 1 }, ingredients: [{ id: STONE, count: 8 }] },
    { result: { id: ITEM_SUGAR, count: 4 }, ingredients: [{ id: CANDY_CANE, count: 1 }] },
    { result: { id: ITEM_FLOUR, count: 4 }, ingredients: [{ id: SAND, count: 1 }, { id: ITEM_SUGAR, count: 1 }] },
    { result: { id: FROSTING_WHITE, count: 2 }, ingredients: [{ id: ITEM_SUGAR, count: 2 }] },
];

const ADVANCED_RECIPES = [
    // Wood tools
    { result: { id: ITEM_WOOD_PICKAXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: PLANKS, count: 3 }] },
    { result: { id: ITEM_WOOD_AXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: PLANKS, count: 3 }] },
    { result: { id: ITEM_WOOD_SHOVEL, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: PLANKS, count: 1 }] },
    { result: { id: ITEM_WOOD_SWORD, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 1 }, { id: PLANKS, count: 2 }] },
    // Stone tools
    { result: { id: ITEM_STONE_PICKAXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: STONE, count: 3 }] },
    { result: { id: ITEM_STONE_AXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: STONE, count: 3 }] },
    { result: { id: ITEM_STONE_SHOVEL, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: STONE, count: 1 }] },
    { result: { id: ITEM_STONE_SWORD, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 1 }, { id: STONE, count: 2 }] },
    // Iron tools
    { result: { id: ITEM_IRON_PICKAXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_IRON_INGOT, count: 3 }] },
    { result: { id: ITEM_IRON_AXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_IRON_INGOT, count: 3 }] },
    { result: { id: ITEM_IRON_SHOVEL, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_IRON_INGOT, count: 1 }] },
    { result: { id: ITEM_IRON_SWORD, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 1 }, { id: ITEM_IRON_INGOT, count: 2 }] },
    // Gold tools
    { result: { id: ITEM_GOLD_PICKAXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_GOLD_INGOT, count: 3 }] },
    { result: { id: ITEM_GOLD_AXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_GOLD_INGOT, count: 3 }] },
    { result: { id: ITEM_GOLD_SHOVEL, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_GOLD_INGOT, count: 1 }] },
    { result: { id: ITEM_GOLD_SWORD, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 1 }, { id: ITEM_GOLD_INGOT, count: 2 }] },
    // Diamond tools
    { result: { id: ITEM_DIAMOND_PICKAXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_DIAMOND_GEM, count: 3 }] },
    { result: { id: ITEM_DIAMOND_AXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_DIAMOND_GEM, count: 3 }] },
    { result: { id: ITEM_DIAMOND_SHOVEL, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_DIAMOND_GEM, count: 1 }] },
    { result: { id: ITEM_DIAMOND_SWORD, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 1 }, { id: ITEM_DIAMOND_GEM, count: 2 }] },
    // Netherite tools
    { result: { id: ITEM_NETHERITE_PICKAXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_NETHERITE_INGOT, count: 3 }] },
    { result: { id: ITEM_NETHERITE_AXE, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_NETHERITE_INGOT, count: 3 }] },
    { result: { id: ITEM_NETHERITE_SHOVEL, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 2 }, { id: ITEM_NETHERITE_INGOT, count: 1 }] },
    { result: { id: ITEM_NETHERITE_SWORD, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 1 }, { id: ITEM_NETHERITE_INGOT, count: 2 }] },
    // Treats
    { result: { id: ITEM_CUPCAKE, count: 1 }, ingredients: [{ id: ITEM_FLOUR, count: 2 }, { id: ITEM_SUGAR, count: 1 }, { id: FROSTING_PINK, count: 1 }] },
    { result: { id: ITEM_COOKIE, count: 2 }, ingredients: [{ id: ITEM_FLOUR, count: 2 }, { id: ITEM_SUGAR, count: 1 }] },
    { result: { id: ITEM_CANDY, count: 3 }, ingredients: [{ id: ITEM_SUGAR, count: 3 }, { id: FROSTING_PINK, count: 1 }] },
    { result: { id: ITEM_LOLLIPOP, count: 1 }, ingredients: [{ id: ITEM_STICK, count: 1 }, { id: ITEM_SUGAR, count: 2 }, { id: FROSTING_PINK, count: 1 }] },
    // Decorative blocks
    { result: { id: FROSTING_PINK, count: 2 }, ingredients: [{ id: ITEM_SUGAR, count: 2 }, { id: REDSTONE_ORE, count: 1 }] },
    { result: { id: FROSTING_BROWN, count: 2 }, ingredients: [{ id: ITEM_SUGAR, count: 2 }, { id: DIRT, count: 1 }] },
    { result: { id: SPRINKLE, count: 4 }, ingredients: [{ id: ITEM_SUGAR, count: 1 }, { id: ITEM_LAPIS_GEM, count: 1 }] },
    { result: { id: SUGAR_BLOCK, count: 1 }, ingredients: [{ id: ITEM_SUGAR, count: 4 }] },
    { result: { id: CUPCAKE_CHEST, count: 1 }, ingredients: [{ id: PLANKS, count: 8 }] },
    { result: { id: WAFER_DOOR, count: 2 }, ingredients: [{ id: PLANKS, count: 6 }] },
    { result: { id: CANDY_FENCE, count: 3 }, ingredients: [{ id: PLANKS, count: 4 }, { id: ITEM_STICK, count: 2 }] },
    { result: { id: WAFER_LADDER, count: 3 }, ingredients: [{ id: ITEM_STICK, count: 7 }] },
    { result: { id: CANDY_SIGN, count: 2 }, ingredients: [{ id: PLANKS, count: 6 }, { id: ITEM_STICK, count: 1 }] },
    { result: { id: WAFER_SLAB, count: 6 }, ingredients: [{ id: PLANKS, count: 3 }] },
    { result: { id: WAFER_STAIRS, count: 4 }, ingredients: [{ id: PLANKS, count: 6 }] },
    { result: { id: MARSHMALLOW_BED, count: 1 }, ingredients: [{ id: FROSTING_WHITE, count: 3 }, { id: PLANKS, count: 3 }] },
    { result: { id: LOLLIPOP_LAMP, count: 1 }, ingredients: [{ id: ITEM_SUGAR, count: 2 }, { id: GLASS, count: 1 }, { id: REDSTONE_ORE, count: 1 }] },
    { result: { id: ITEM_WAFER_HOE, count: 1 }, ingredients: [{ id: PLANKS, count: 2 }, { id: ITEM_STICK, count: 2 }] },
    { result: { id: JELLY_WIRE, count: 8 }, ingredients: [{ id: ITEM_SUGAR, count: 2 }, { id: REDSTONE_ORE, count: 1 }] },
    { result: { id: SUGAR_SWITCH, count: 1 }, ingredients: [{ id: ITEM_SUGAR, count: 1 }, { id: ITEM_STICK, count: 1 }] },
    { result: { id: FROSTING_PLATE, count: 2 }, ingredients: [{ id: FROSTING_WHITE, count: 2 }] },
    { result: { id: DELAY_CANDY, count: 1 }, ingredients: [{ id: JELLY_WIRE, count: 2 }, { id: ITEM_SUGAR, count: 1 }] },
    { result: { id: NOTE_CANDY, count: 1 }, ingredients: [{ id: PLANKS, count: 4 }, { id: ITEM_SUGAR, count: 1 }] },
];

const SMELTING_RECIPES = [
    // Ore smelting & glass (furnace-only)
    { result: { id: ITEM_IRON_INGOT, count: 1 }, ingredients: [{ id: IRON_ORE, count: 1 }] },
    { result: { id: ITEM_GOLD_INGOT, count: 1 }, ingredients: [{ id: GOLD_ORE, count: 1 }] },
    { result: { id: ITEM_DIAMOND_GEM, count: 1 }, ingredients: [{ id: DIAMOND_ORE, count: 1 }] },
    { result: { id: ITEM_NETHERITE_INGOT, count: 1 }, ingredients: [{ id: NETHERITE_ORE, count: 1 }] },
    { result: { id: ITEM_LAPIS_GEM, count: 1 }, ingredients: [{ id: LAPIS_ORE, count: 1 }] },
    { result: { id: GLASS, count: 1 }, ingredients: [{ id: SAND, count: 4 }] },
];

function expandIngredientPattern(recipe, width) {
    const cells=[];
    for(const ingredient of recipe.ingredients) for(let i=0;i<ingredient.count;i++) cells.push(ingredient.id);
    const rows=[];for(let i=0;i<cells.length;i+=width) rows.push(cells.slice(i,i+width));
    return rows;
}

function configureRecipePatterns() {
    const basicPatterns=new Map([
        [PLANKS,[[WOOD]]],[ITEM_STICK,[[PLANKS],[PLANKS]]],[CRAFTING_TABLE,[[PLANKS,PLANKS],[PLANKS,PLANKS]]],
        [ITEM_SUGAR,[[CANDY_CANE]]],[ITEM_FLOUR,[[SAND,ITEM_SUGAR]]],[FROSTING_WHITE,[[ITEM_SUGAR,ITEM_SUGAR]]]
    ]);
    for(const recipe of BASIC_RECIPES) recipe.pattern=basicPatterns.get(recipe.result.id)||expandIngredientPattern(recipe,2);
    for(const recipe of ADVANCED_RECIPES) {
        const result=recipe.result.id;
        if(isToolItem(result)) {
            const material=recipe.ingredients.find(ingredient=>ingredient.id!==ITEM_STICK)?.id;
            const kind=(result-ITEM_WOOD_PICKAXE)%4;
            if(kind===0) recipe.pattern=[[material,material,material],[null,ITEM_STICK,null],[null,ITEM_STICK,null]];
            else if(kind===1){recipe.pattern=[[material,material],[material,ITEM_STICK],[null,ITEM_STICK]];recipe.allowMirror=true;}
            else if(kind===2) recipe.pattern=[[material],[ITEM_STICK],[ITEM_STICK]];
            else recipe.pattern=[[material],[material],[ITEM_STICK]];
        } else recipe.pattern=expandIngredientPattern(recipe,3);
    }
    const byResult=id=>ADVANCED_RECIPES.find(recipe=>recipe.result.id===id);
    byResult(CUPCAKE_CHEST).pattern=[[PLANKS,PLANKS,PLANKS],[PLANKS,null,PLANKS],[PLANKS,PLANKS,PLANKS]];
    byResult(WAFER_DOOR).pattern=[[PLANKS,PLANKS],[PLANKS,PLANKS],[PLANKS,PLANKS]];
    byResult(CANDY_FENCE).pattern=[[PLANKS,ITEM_STICK,PLANKS],[PLANKS,ITEM_STICK,PLANKS]];
    byResult(WAFER_LADDER).pattern=[[ITEM_STICK,null,ITEM_STICK],[ITEM_STICK,ITEM_STICK,ITEM_STICK],[ITEM_STICK,null,ITEM_STICK]];
    byResult(CANDY_SIGN).pattern=[[PLANKS,PLANKS,PLANKS],[PLANKS,PLANKS,PLANKS],[null,ITEM_STICK,null]];
    byResult(WAFER_SLAB).pattern=[[PLANKS,PLANKS,PLANKS]];
    byResult(WAFER_STAIRS).pattern=[[PLANKS,null,null],[PLANKS,PLANKS,null],[PLANKS,PLANKS,PLANKS]];byResult(WAFER_STAIRS).allowMirror=true;
    byResult(MARSHMALLOW_BED).pattern=[[FROSTING_WHITE,FROSTING_WHITE,FROSTING_WHITE],[PLANKS,PLANKS,PLANKS]];
    byResult(ITEM_WAFER_HOE).pattern=[[PLANKS,PLANKS],[null,ITEM_STICK],[null,ITEM_STICK]];byResult(ITEM_WAFER_HOE).allowMirror=true;
    const oven=BASIC_RECIPES.find(recipe=>recipe.result.id===FURNACE);
    oven.pattern=[[STONE,STONE,STONE],[STONE,null,STONE],[STONE,STONE,STONE]];
}
configureRecipePatterns();
const BASIC_GRID_RECIPES=BASIC_RECIPES.filter(recipe=>recipe.result.id!==FURNACE);
const TABLE_GRID_RECIPES=ADVANCED_RECIPES.concat(BASIC_RECIPES.filter(recipe=>recipe.result.id===FURNACE));

// Combined list for backward compatibility (used by countItem, removeItem, etc.)
const RECIPES = BASIC_RECIPES.concat(ADVANCED_RECIPES).concat(SMELTING_RECIPES);

let craftedFeedbackTimer = null;

const RECIPE_CATEGORY_META = {
    crafting: { recipes: BASIC_GRID_RECIPES, label: 'Inventory', readyText: 'Ready in the 2×2 grid.' },
    table: { recipes: TABLE_GRID_RECIPES, label: 'Crafting Table', readyText: 'Ready in the 3×3 grid.' },
    furnace: { recipes: SMELTING_RECIPES, label: 'Furnace', readyText: 'Ready at a Furnace.' }
};

function getRecipeCategoryMeta(category) {
    return RECIPE_CATEGORY_META[category] || null;
}

function sanitizeRecipeGuide(ref) {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return null;
    const meta = getRecipeCategoryMeta(ref.category);
    if (!meta) return null;
    if (!Number.isInteger(ref.recipeIndex) || ref.recipeIndex < 0 || ref.recipeIndex >= meta.recipes.length) return null;
    return { category: ref.category, recipeIndex: ref.recipeIndex };
}

function getRecipeGuideEntry() {
    const ref = sanitizeRecipeGuide(game.recipeGuide);
    if (!ref) {
        game.recipeGuide = null;
        return null;
    }
    const meta = getRecipeCategoryMeta(ref.category);
    return {
        category: ref.category,
        recipeIndex: ref.recipeIndex,
        recipe: meta.recipes[ref.recipeIndex],
        meta: meta
    };
}

function isTrackingRecipe(category, recipeIndex) {
    const ref = sanitizeRecipeGuide(game.recipeGuide);
    return !!ref && ref.category === category && ref.recipeIndex === recipeIndex;
}

function trackRecipe(category, recipeIndex) {
    const ref = sanitizeRecipeGuide({ category: category, recipeIndex: recipeIndex });
    if (!ref) return;
    game.recipeGuide = ref;
    refreshRecipeGuideSurfaces();
    if (typeof scheduleSaveGame === 'function') scheduleSaveGame();
}

function clearRecipeGuide() {
    game.recipeGuide = null;
    refreshRecipeGuideSurfaces();
    if (typeof scheduleSaveGame === 'function') scheduleSaveGame();
}

function formatItemCount(id, count) {
    return count + ' ' + (BLOCK_NAMES[id] || '???');
}

function getMissingIngredients(recipe) {
    const missing = [];
    for (const ing of recipe.ingredients) {
        const owned = countItem(ing.id);
        if (owned < ing.count) {
            missing.push({
                id: ing.id,
                count: ing.count - owned,
                owned: owned,
                required: ing.count
            });
        }
    }
    return missing;
}

function getRecipeGuideStatus(entry) {
    const recipe = entry.recipe;
    if (canCraft(recipe)) return entry.meta.readyText;

    const missing = getMissingIngredients(recipe);
    if (missing.length === 0) {
        return 'Free inventory space for ' + formatItemCount(recipe.result.id, recipe.result.count) + '.';
    }

    return 'Need ' + missing.map(function(ing) {
        return formatItemCount(ing.id, ing.count);
    }).join(', ') + '.';
}

function refreshRecipeGuideSurfaces() {
    updateRecipeGuideUI();
    if (game.inventoryOpen) updateCraftingUI();
    if (game.craftingTableOpen) updateCraftingTableUI();
    if (game.furnaceOpen) updateFurnaceUI();
}

function countItem(id) {
    let total = 0;
    // Iterate the live length: creative mode grows game.inventory beyond 36 slots.
    for (let i = 0; i < game.inventory.length; i++) {
        if (game.inventory[i] && game.inventory[i].id === id) total += game.inventory[i].count;
    }
    return total;
}

function removeItem(id, count) {
    let remaining = count;
    // Iterate the live length: creative mode grows game.inventory beyond 36 slots.
    for (let i = 0; i < game.inventory.length; i++) {
        if (game.inventory[i] && game.inventory[i].id === id) {
            const take = Math.min(remaining, game.inventory[i].count);
            game.inventory[i].count -= take;
            if (game.inventory[i].count <= 0) game.inventory[i] = null;
            remaining -= take;
            if (remaining <= 0) {
                if(typeof scheduleSaveGame === 'function') scheduleSaveGame();
                return true;
            }
        }
    }
    if(remaining <= 0 && typeof scheduleSaveGame === 'function') scheduleSaveGame();
    return remaining <= 0;
}

function canCraft(recipe) {
    for (const ing of recipe.ingredients) {
        if (countItem(ing.id) < ing.count) return false;
    }
    return canAddItemAfterRemoving(recipe.result.id, recipe.result.count, recipe.ingredients);
}

function doCraft(recipe) {
    if (!canCraft(recipe)) return false;
    for (const ing of recipe.ingredients) {
        removeItem(ing.id, ing.count);
    }
    addItem(recipe.result.id, recipe.result.count);
    CandyEvents.emit('itemCrafted', { itemId:recipe.result.id, count:recipe.result.count });
    // Quest hook: treat crafting
    if (typeof isTreatItem === 'function' && isTreatItem(recipe.result.id)) {
        if (typeof advanceQuest === 'function') {
        }
    }
    return true;
}

function getCraftGridConfig(category) {
    if(category==='crafting') return {grid:game.playerCraftGrid,size:2,recipes:BASIC_GRID_RECIPES,gridId:'player-craft-grid',outputId:'player-craft-output'};
    return {grid:game.tableCraftGrid,size:3,recipes:TABLE_GRID_RECIPES,gridId:'table-craft-grid',outputId:'table-craft-output'};
}

function craftGridMatrix(grid,size) {
    const matrix=[];
    for(let y=0;y<size;y++){const row=[];for(let x=0;x<size;x++)row.push(grid[y*size+x]?.id||null);matrix.push(row);}
    return matrix;
}

function getMatchingGridRecipe(category) {
    const config=getCraftGridConfig(category),matrix=craftGridMatrix(config.grid,config.size);
    for(const recipe of config.recipes) {
        const match=CandyCore.matchShapedRecipe(matrix,recipe);
        if(match.matched)return {recipe,match};
    }
    return null;
}

function handleCraftGridSlot(category,index) {
    const config=getCraftGridConfig(category),slot=config.grid[index];
    if(!game.cursorStack&&slot){game.cursorStack=slot;config.grid[index]=null;}
    else if(game.cursorStack&&!slot){config.grid[index]=game.cursorStack;game.cursorStack=null;}
    else if(game.cursorStack&&slot&&slot.id===game.cursorStack.id&&CandyCore.stackMetadataMatches(slot,game.cursorStack)){const space=getItemMaxStack(slot.id)-slot.count,move=Math.min(space,game.cursorStack.count);slot.count+=move;game.cursorStack.count-=move;if(game.cursorStack.count<=0)game.cursorStack=null;}
    else if(game.cursorStack&&slot){config.grid[index]=game.cursorStack;game.cursorStack=slot;}
    renderCraftGrid(category);updateCursorStackUI();scheduleSaveGame();
}

function consumeMatchedGrid(config) {
    for(let i=0;i<config.grid.length;i++)if(config.grid[i]){config.grid[i].count--;if(config.grid[i].count<=0)config.grid[i]=null;}
}

function craftFromGrid(category,shiftCraft) {
    const config=getCraftGridConfig(category);let crafted=0;
    do {
        const match=getMatchingGridRecipe(category);if(!match||!canAddItem(match.recipe.result.id,match.recipe.result.count))break;
        consumeMatchedGrid(config);addItem(match.recipe.result.id,match.recipe.result.count);CandyEvents.emit('itemCrafted',{itemId:match.recipe.result.id,count:match.recipe.result.count});crafted++;
    } while(shiftCraft&&crafted<64);
    if(crafted){updateInventoryUI();updateHotbar();scheduleSaveGame();if(category==='crafting')updateCraftingUI();else updateCraftingTableUI();}
    else renderCraftGrid(category);return crafted>0;
}

function returnCraftGrid(category) {
    const config=getCraftGridConfig(category);let complete=true;
    for(let i=0;i<config.grid.length;i++){const slot=config.grid[i];if(!slot)continue;if(addItemStack(slot)||spawnItemDrop(slot.id,slot.count,game.player.x,game.player.y+1,game.player.z,undefined,slot))config.grid[i]=null;else complete=false;}
    renderCraftGrid(category);
    return complete;
}

function autofillRecipe(category,recipe) {
    const config=getCraftGridConfig(category);if(config.grid.some(Boolean))return false;
    const pattern=CandyCore.trimPattern(recipe.pattern),removals=[];
    for(const row of pattern)for(const id of row)if(id){const entry=removals.find(item=>item.id===id);if(entry)entry.count++;else removals.push({id,count:1});}
    const transaction=CandyCore.transactInventory(game.inventory,{remove:removals},getItemMaxStack);if(!transaction.ok)return false;
    game.inventory=transaction.slots;
    for(let y=0;y<pattern.length;y++)for(let x=0;x<pattern[y].length;x++){const id=pattern[y][x];if(id)config.grid[y*config.size+x]={id,count:1};}
    updateInventoryUI();updateHotbar();renderCraftGrid(category);scheduleSaveGame();return true;
}

function renderCraftGrid(category) {
    const config=getCraftGridConfig(category),container=document.getElementById(config.gridId),output=document.getElementById(config.outputId);if(!container||!output)return;
    container.innerHTML='';
    for(let i=0;i<config.grid.length;i++){const button=document.createElement('button');button.type='button';button.className='craft-grid-slot';button.setAttribute('aria-label','Crafting slot '+(i+1));const slot=config.grid[i];if(slot){const icon=document.createElement('div');icon.className='slot-icon';setItemIcon(icon,slot.id);button.appendChild(icon);if(slot.count>1){const count=document.createElement('span');count.className='slot-count';count.textContent=slot.count;button.appendChild(count);}}button.addEventListener('click',()=>handleCraftGridSlot(category,i));container.appendChild(button);}
    output.innerHTML='';output.classList.remove('ready');const match=getMatchingGridRecipe(category);
    if(match){const icon=document.createElement('div');icon.className='slot-icon';setItemIcon(icon,match.recipe.result.id);output.appendChild(icon);if(match.recipe.result.count>1){const count=document.createElement('span');count.className='slot-count';count.textContent=match.recipe.result.count;output.appendChild(count);}output.classList.add('ready');output.disabled=false;output.title=BLOCK_NAMES[match.recipe.result.id]||'Crafted item';}else output.disabled=true;
    output.onclick=event=>craftFromGrid(category,event.shiftKey);
}

function updateCraftingUI() {
    const list = document.getElementById('crafting-list');
    if (!list) return;
    list.innerHTML = '';
    // Only show basic recipes in the inventory crafting panel
    renderCraftGrid('crafting');
    _renderRecipeList(list, BASIC_GRID_RECIPES, 'crafting');
    updateRecipeGuideUI();
}

// ====== CRAFTING TABLE UI ======
function updateCraftingTableUI() {
    const list = document.getElementById('crafting-table-list');
    if (!list) return;
    list.innerHTML = '';
    renderCraftGrid('table');
    _renderRecipeList(list, TABLE_GRID_RECIPES, 'table');
    updateRecipeGuideUI();
}

// ====== FURNACE UI ======
function updateFurnaceUI() {
    const list = document.getElementById('furnace-list');
    if (!list) return;
    list.innerHTML = '';
    renderOvenUI();
    _renderRecipeList(list, SMELTING_RECIPES, 'furnace');
    updateRecipeGuideUI();
}

// ====== SHARED RECIPE LIST RENDERER ======
let _recentlyCrafted = null; // { category, recipeIndex }

function _renderRecipeGuideCard(container) {
    const entry = getRecipeGuideEntry();
    if (!entry) return;

    const card = document.createElement('div');
    card.className = 'recipe-guide-card';

    const icon = document.createElement('div');
    icon.className = 'recipe-guide-icon';
    setItemIcon(icon, entry.recipe.result.id);
    card.appendChild(icon);

    const body = document.createElement('div');
    body.className = 'recipe-guide-body';

    const title = document.createElement('div');
    title.className = 'recipe-guide-title';
    title.textContent = 'Tracking ' + formatItemCount(entry.recipe.result.id, entry.recipe.result.count);
    body.appendChild(title);

    const station = document.createElement('div');
    station.className = 'recipe-guide-station';
    station.textContent = entry.meta.label;
    body.appendChild(station);

    const status = document.createElement('div');
    status.className = 'recipe-guide-status' + (canCraft(entry.recipe) ? ' ready' : '');
    status.textContent = getRecipeGuideStatus(entry);
    body.appendChild(status);

    card.appendChild(body);

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'recipe-guide-clear';
    clear.textContent = 'Clear';
    clear.addEventListener('click', function(event) {
        event.stopPropagation();
        clearRecipeGuide();
    });
    card.appendChild(clear);

    container.appendChild(card);
}

function updateRecipeGuideUI() {
    const hud = document.getElementById('recipe-guide');
    if (!hud) return;

    const entry = getRecipeGuideEntry();
    hud.innerHTML = '';
    if (!entry) {
        hud.style.display = 'none';
        return;
    }

    const name = document.createElement('div');
    name.className = 'recipe-guide-hud-title';
    name.textContent = formatItemCount(entry.recipe.result.id, entry.recipe.result.count);
    hud.appendChild(name);

    const station = document.createElement('div');
    station.className = 'recipe-guide-hud-station';
    station.textContent = entry.meta.label;
    hud.appendChild(station);

    const status = document.createElement('div');
    status.className = 'recipe-guide-hud-status' + (canCraft(entry.recipe) ? ' ready' : '');
    status.textContent = getRecipeGuideStatus(entry);
    hud.appendChild(status);

    hud.style.display = 'block';
}

function _renderRecipeList(container, recipes, category) {
    _renderRecipeGuideCard(container);

    for (let ri = 0; ri < recipes.length; ri++) {
        const recipe = recipes[ri];
        const craftable = canCraft(recipe);
        const tracked = isTrackingRecipe(category, ri);
        const recentlyCrafted = _recentlyCrafted && _recentlyCrafted.category === category && _recentlyCrafted.recipeIndex === ri;
        const row = document.createElement('div');
        row.className = 'craft-row' + (craftable ? ' craftable' : ' dimmed') + (recentlyCrafted ? ' crafted' : '') + (tracked ? ' tracked' : '');
        row.setAttribute('aria-disabled', craftable ? 'false' : 'true');

        const icon = document.createElement('div');
        icon.className = 'craft-result-icon';
        setItemIcon(icon, recipe.result.id);
        row.appendChild(icon);

        const info = document.createElement('div');
        info.className = 'craft-info';
        const name = document.createElement('div');
        name.className = 'craft-result-name';
        const resultName = (recipe.result.count > 1 ? recipe.result.count + 'x ' : '') + (BLOCK_NAMES[recipe.result.id] || '???');
        name.textContent = resultName;
        info.appendChild(name);

        const ings = document.createElement('div');
        ings.className = 'craft-ingredients';
        for (const ing of recipe.ingredients) {
            const owned = countItem(ing.id);
            const chip = document.createElement('span');
            chip.className = 'craft-ingredient-chip' + (owned < ing.count ? ' missing' : '');
            chip.textContent = (BLOCK_NAMES[ing.id] || '???') + ' ' + owned + '/' + ing.count;
            ings.appendChild(chip);
        }
        info.appendChild(ings);
        row.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'craft-actions';

        const status = document.createElement(craftable ? 'button' : 'span');
        status.className = 'craft-status ' + (recentlyCrafted ? 'crafted' : (craftable ? 'craft-action' : 'missing'));
        status.textContent = recentlyCrafted ? 'Crafted!' : (category === 'furnace' ? (craftable ? 'Load oven' : 'Missing') : (craftable ? 'Fill grid' : 'Missing'));
        if (craftable) {
            status.type = 'button';
            status.setAttribute('aria-label', (category === 'furnace' ? 'Smelt ' : 'Craft ') + resultName);
        }
        actions.appendChild(status);

        const track = document.createElement('button');
        track.type = 'button';
        track.className = 'craft-track' + (tracked ? ' tracked' : '');
        track.textContent = tracked ? 'Clear' : 'Track';
        track.setAttribute('aria-pressed', tracked ? 'true' : 'false');
        track.setAttribute('aria-label', (tracked ? 'Clear tracked recipe for ' : 'Track recipe for ') + resultName);
        track.addEventListener('click', function(event) {
            event.stopPropagation();
            if (tracked) clearRecipeGuide();
            else trackRecipe(category, ri);
        });
        actions.appendChild(track);
        row.appendChild(actions);

        if (craftable) {
            const craftRecipe = () => {
                if(category==='crafting'||category==='table') {
                    autofillRecipe(category,recipe);
                    if(category==='crafting')updateCraftingUI();else updateCraftingTableUI();
                    return;
                }
                if(category==='furnace'){autofillOvenRecipe(recipe);updateFurnaceUI();return;}
                if (!doCraft(recipe)) return;
                _recentlyCrafted = { category: category, recipeIndex: ri };
                clearTimeout(craftedFeedbackTimer);
                craftedFeedbackTimer = setTimeout(() => {
                    _recentlyCrafted = null;
                    // Refresh whichever panel(s) are open
                    if (category === 'crafting') updateCraftingUI();
                    if (category === 'table') updateCraftingTableUI();
                    if (category === 'furnace') updateFurnaceUI();
                }, 900);
                // Refresh the current panel
                if (category === 'crafting') updateCraftingUI();
                if (category === 'table') updateCraftingTableUI();
                if (category === 'furnace') updateFurnaceUI();
                // Also refresh inventory if visible
                if (category === 'crafting') {
                    updateInventoryUI();
                    updateHotbar();
                }
                if (category === 'table' || category === 'furnace') {
                    updateHotbar();
                }
                updateRecipeGuideUI();
            };
            row.addEventListener('click', craftRecipe);
        }
        container.appendChild(row);
    }
}
