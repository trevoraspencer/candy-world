'use strict';

// ====== TOOL SYSTEM ======
const TOOL_MULTIPLIERS = {};
// Pickaxes: bonus on stone, ore
TOOL_MULTIPLIERS[ITEM_WOOD_PICKAXE] = 2; TOOL_MULTIPLIERS[ITEM_STONE_PICKAXE] = 3;
TOOL_MULTIPLIERS[ITEM_IRON_PICKAXE] = 4; TOOL_MULTIPLIERS[ITEM_GOLD_PICKAXE] = 5;
TOOL_MULTIPLIERS[ITEM_DIAMOND_PICKAXE] = 5; TOOL_MULTIPLIERS[ITEM_NETHERITE_PICKAXE] = 6;
// Axes: bonus on wood
TOOL_MULTIPLIERS[ITEM_WOOD_AXE] = 2; TOOL_MULTIPLIERS[ITEM_STONE_AXE] = 3;
TOOL_MULTIPLIERS[ITEM_IRON_AXE] = 4; TOOL_MULTIPLIERS[ITEM_GOLD_AXE] = 5;
TOOL_MULTIPLIERS[ITEM_DIAMOND_AXE] = 5; TOOL_MULTIPLIERS[ITEM_NETHERITE_AXE] = 6;
// Shovels: bonus on dirt/sand
TOOL_MULTIPLIERS[ITEM_WOOD_SHOVEL] = 2; TOOL_MULTIPLIERS[ITEM_STONE_SHOVEL] = 3;
TOOL_MULTIPLIERS[ITEM_IRON_SHOVEL] = 4; TOOL_MULTIPLIERS[ITEM_GOLD_SHOVEL] = 5;
TOOL_MULTIPLIERS[ITEM_DIAMOND_SHOVEL] = 5; TOOL_MULTIPLIERS[ITEM_NETHERITE_SHOVEL] = 6;
// Swords (general low mult)
TOOL_MULTIPLIERS[ITEM_WOOD_SWORD] = 1; TOOL_MULTIPLIERS[ITEM_STONE_SWORD] = 1.5;
TOOL_MULTIPLIERS[ITEM_IRON_SWORD] = 2; TOOL_MULTIPLIERS[ITEM_GOLD_SWORD] = 2;
TOOL_MULTIPLIERS[ITEM_DIAMOND_SWORD] = 2.5; TOOL_MULTIPLIERS[ITEM_NETHERITE_SWORD] = 3;

// Tool type classification for bonus matching
const PICKAXES = new Set([ITEM_WOOD_PICKAXE, ITEM_STONE_PICKAXE, ITEM_IRON_PICKAXE, ITEM_GOLD_PICKAXE, ITEM_DIAMOND_PICKAXE, ITEM_NETHERITE_PICKAXE]);
const AXES = new Set([ITEM_WOOD_AXE, ITEM_STONE_AXE, ITEM_IRON_AXE, ITEM_GOLD_AXE, ITEM_DIAMOND_AXE, ITEM_NETHERITE_AXE]);
const SHOVELS = new Set([ITEM_WOOD_SHOVEL, ITEM_STONE_SHOVEL, ITEM_IRON_SHOVEL, ITEM_GOLD_SHOVEL, ITEM_DIAMOND_SHOVEL, ITEM_NETHERITE_SHOVEL]);
// Tool category Sets derived from BLOCK_REGISTRY
const STONE_BLOCKS = new Set(Object.keys(BLOCK_REGISTRY).filter(function(id) { return BLOCK_REGISTRY[id].toolType === 'pickaxe'; }).map(Number));
const WOOD_BLOCKS = new Set(Object.keys(BLOCK_REGISTRY).filter(function(id) { return BLOCK_REGISTRY[id].toolType === 'axe'; }).map(Number));
const DIRT_BLOCKS = new Set(Object.keys(BLOCK_REGISTRY).filter(function(id) { return BLOCK_REGISTRY[id].toolType === 'shovel'; }).map(Number));

function getToolMultiplier(toolId, blockType) {
    if (!toolId || !TOOL_MULTIPLIERS[toolId]) return 0.5; // bare hand
    const base = TOOL_MULTIPLIERS[toolId];
    // Bonus: right tool for right block
    if (PICKAXES.has(toolId) && STONE_BLOCKS.has(blockType)) return base;
    if (AXES.has(toolId) && WOOD_BLOCKS.has(blockType)) return base;
    if (SHOVELS.has(toolId) && DIRT_BLOCKS.has(blockType)) return base;
    // Wrong tool type gets reduced multiplier
    if (PICKAXES.has(toolId) || AXES.has(toolId) || SHOVELS.has(toolId)) return base * 0.4;
    return base * 0.5; // swords
}
