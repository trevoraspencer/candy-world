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

// Combined list for backward compatibility (used by countItem, removeItem, etc.)
const RECIPES = BASIC_RECIPES.concat(ADVANCED_RECIPES).concat(SMELTING_RECIPES);

let craftedFeedbackTimer = null;

function countItem(id) {
    let total = 0;
    for (let i = 0; i < 36; i++) {
        if (game.inventory[i] && game.inventory[i].id === id) total += game.inventory[i].count;
    }
    return total;
}

function removeItem(id, count) {
    let remaining = count;
    for (let i = 0; i < 36; i++) {
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
    // Quest hook: treat crafting
    if (typeof isTreatItem === 'function' && isTreatItem(recipe.result.id)) {
        if (typeof advanceQuest === 'function') {
            advanceQuest('craft-treat', recipe.result.id);
        }
    }
    return true;
}

function updateCraftingUI() {
    const list = document.getElementById('crafting-list');
    if (!list) return;
    list.innerHTML = '';
    // Only show basic recipes in the inventory crafting panel
    _renderRecipeList(list, BASIC_RECIPES, 'crafting');
}

// ====== CRAFTING TABLE UI ======
function updateCraftingTableUI() {
    const list = document.getElementById('crafting-table-list');
    if (!list) return;
    list.innerHTML = '';
    _renderRecipeList(list, ADVANCED_RECIPES, 'table');
}

// ====== FURNACE UI ======
function updateFurnaceUI() {
    const list = document.getElementById('furnace-list');
    if (!list) return;
    list.innerHTML = '';
    _renderRecipeList(list, SMELTING_RECIPES, 'furnace');
}

// ====== SHARED RECIPE LIST RENDERER ======
let _recentlyCrafted = null; // { category, recipeIndex }

function _renderRecipeList(container, recipes, category) {
    for (let ri = 0; ri < recipes.length; ri++) {
        const recipe = recipes[ri];
        const craftable = canCraft(recipe);
        const recentlyCrafted = _recentlyCrafted && _recentlyCrafted.category === category && _recentlyCrafted.recipeIndex === ri;
        const row = document.createElement('div');
        row.className = 'craft-row' + (craftable ? ' craftable' : ' dimmed') + (recentlyCrafted ? ' crafted' : '');
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

        const status = document.createElement(craftable ? 'button' : 'span');
        status.className = 'craft-status ' + (recentlyCrafted ? 'crafted' : (craftable ? 'craft-action' : 'missing'));
        status.textContent = recentlyCrafted ? 'Crafted!' : (category === 'furnace' ? (craftable ? 'Smelt' : 'Missing') : (craftable ? 'Craft' : 'Missing'));
        if (craftable) {
            status.type = 'button';
            status.setAttribute('aria-label', (category === 'furnace' ? 'Smelt ' : 'Craft ') + resultName);
        }
        row.appendChild(status);

        if (craftable) {
            const craftRecipe = () => {
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
            };
            row.addEventListener('click', craftRecipe);
        }
        container.appendChild(row);
    }
}
