'use strict';

// ====== BLOCK TYPES ======
const AIR=0, STONE=1, DIRT=2, GRASS=3, SAND=4, WATER=5, WOOD=6, LEAVES=7, SNOW=8;
const IRON_ORE=9, GOLD_ORE=10, LAPIS_ORE=11, REDSTONE_ORE=12, DIAMOND_ORE=13, NETHERITE_ORE=14;
const FROSTING_WHITE=15, FROSTING_BROWN=16, FROSTING_PINK=17, SPRINKLE=18;
const CANDY_CANE=19, CANDY_CANE_PILLAR=20, PLANKS=21, GLASS=22;
const CRAFTING_TABLE=23, FURNACE=24, BEDROCK=25, MUSHROOM_STALK=26, MUSHROOM_CAP=27;
const DARK_STONE=28, DARK_GRASS=29, SUGAR_BLOCK=30, LOLLIPOP_STICK=31, LOLLIPOP_TOP=32;

// ====== BLOCK REGISTRY ======
// Single source of truth for all block definitions.
// Each block ID maps to {name, hardness, tiles, color, toolType, transparent, solid}.
// Adding a new block type only requires an entry here + generation rules + atlas tile.
const BLOCK_REGISTRY = {};
BLOCK_REGISTRY[AIR]              = {name:'Air',             hardness:0,        tiles:null,       color:null,      toolType:null,      transparent:true,  solid:false};
BLOCK_REGISTRY[STONE]            = {name:'Stone',           hardness:3.0,      tiles:[0,0,0],    color:'#F5D5E0', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[DIRT]             = {name:'Dirt',            hardness:0.5,      tiles:[1,1,1],    color:'#E8B4C8', toolType:'shovel',  transparent:false, solid:true};
BLOCK_REGISTRY[GRASS]            = {name:'Grass',           hardness:0.5,      tiles:[2,3,1],    color:'#FFB6C1', toolType:'shovel',  transparent:false, solid:true};
BLOCK_REGISTRY[SAND]             = {name:'Sand',            hardness:0.5,      tiles:[4,4,4],    color:'#FFF8F0', toolType:'shovel',  transparent:false, solid:true};
BLOCK_REGISTRY[WATER]            = {name:'Water',           hardness:Infinity, tiles:[5,5,5],    color:'#FF9FD1', toolType:null,      transparent:true,  solid:false};
BLOCK_REGISTRY[WOOD]             = {name:'Wood',            hardness:1.0,      tiles:[7,6,7],    color:'#FADCE6', toolType:'axe',     transparent:false, solid:true};
BLOCK_REGISTRY[LEAVES]           = {name:'Leaves',          hardness:0.3,      tiles:[8,8,8],    color:'#FF0000', toolType:null,      transparent:true,  solid:true};
BLOCK_REGISTRY[SNOW]             = {name:'Snow',            hardness:0.3,      tiles:[9,9,9],    color:'#FF2222', toolType:'shovel',  transparent:false, solid:true};
BLOCK_REGISTRY[IRON_ORE]         = {name:'Iron Ore',        hardness:5.0,      tiles:[10,10,10], color:'#E8D0D8', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[GOLD_ORE]         = {name:'Gold Ore',        hardness:5.0,      tiles:[11,11,11], color:'#D4A860', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[LAPIS_ORE]        = {name:'Lapis Ore',       hardness:5.0,      tiles:[12,12,12], color:'#87CEEB', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[REDSTONE_ORE]     = {name:'Redstone Ore',    hardness:5.0,      tiles:[13,13,13], color:'#C71585', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[DIAMOND_ORE]      = {name:'Diamond Ore',     hardness:5.0,      tiles:[14,14,14], color:'#D2A679', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[NETHERITE_ORE]    = {name:'Netherite Ore',   hardness:5.0,      tiles:[15,15,15], color:'#D3D3D3', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[FROSTING_WHITE]   = {name:'Frosting White',  hardness:0.5,      tiles:[16,16,16], color:'#FFFAFA', toolType:null,      transparent:false, solid:true};
BLOCK_REGISTRY[FROSTING_BROWN]   = {name:'Frosting Brown',  hardness:0.5,      tiles:[17,17,17], color:'#7B3F00', toolType:null,      transparent:false, solid:true};
BLOCK_REGISTRY[FROSTING_PINK]    = {name:'Frosting Pink',   hardness:0.5,      tiles:[18,18,18], color:'#FF69B4', toolType:null,      transparent:false, solid:true};
BLOCK_REGISTRY[SPRINKLE]         = {name:'Sprinkle',        hardness:0.5,      tiles:[19,19,19], color:'#FFB6C1', toolType:null,      transparent:false, solid:true};
BLOCK_REGISTRY[CANDY_CANE]       = {name:'Candy Cane',      hardness:1.0,      tiles:[20,20,20], color:'#FF4444', toolType:'axe',     transparent:false, solid:true};
BLOCK_REGISTRY[CANDY_CANE_PILLAR] = {name:'Candy Cane Pillar', hardness:1.0,     tiles:[21,21,21], color:'#FF4444', toolType:'axe',     transparent:false, solid:true};
BLOCK_REGISTRY[PLANKS]           = {name:'Planks',          hardness:1.0,      tiles:[22,22,22], color:'#FADCE6', toolType:'axe',     transparent:false, solid:true};
BLOCK_REGISTRY[GLASS]            = {name:'Glass',           hardness:0.3,      tiles:[23,23,23], color:'#FFE0EC', toolType:null,      transparent:true,  solid:true};
BLOCK_REGISTRY[CRAFTING_TABLE]   = {name:'Crafting Table',  hardness:1.0,      tiles:[24,25,22], color:'#E8B4C8', toolType:'axe',     transparent:false, solid:true};
BLOCK_REGISTRY[FURNACE]          = {name:'Furnace',         hardness:3.0,      tiles:[0,26,0],   color:'#D0B0B8', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[BEDROCK]          = {name:'Bedrock',         hardness:Infinity, tiles:[27,27,27], color:'#8B0045', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[MUSHROOM_STALK]   = {name:'Mushroom Stalk',  hardness:0.5,      tiles:[28,28,28], color:'#FFF8DC', toolType:null,      transparent:false, solid:true};
BLOCK_REGISTRY[MUSHROOM_CAP]     = {name:'Mushroom Cap',    hardness:0.5,      tiles:[29,29,29], color:'#FF69B4', toolType:null,      transparent:false, solid:true};
BLOCK_REGISTRY[DARK_STONE]       = {name:'Dark Stone',      hardness:3.0,      tiles:[30,30,30], color:'#8B0045', toolType:'pickaxe', transparent:false, solid:true};
BLOCK_REGISTRY[DARK_GRASS]       = {name:'Dark Grass',      hardness:0.5,      tiles:[31,32,30], color:'#6B0035', toolType:'shovel',  transparent:false, solid:true};
BLOCK_REGISTRY[SUGAR_BLOCK]      = {name:'Sugar Block',     hardness:0.5,      tiles:[33,33,33], color:'#FFF0F5', toolType:null,      transparent:false, solid:true};
BLOCK_REGISTRY[LOLLIPOP_STICK]   = {name:'Lollipop Stick',  hardness:1.0,      tiles:[34,34,34], color:'#DEB887', toolType:'axe',     transparent:false, solid:true};
BLOCK_REGISTRY[LOLLIPOP_TOP]     = {name:'Lollipop Top',    hardness:0.5,      tiles:[35,35,35], color:'#FF1493', toolType:null,      transparent:false, solid:true};

// ====== DERIVED LOOKUPS (computed from BLOCK_REGISTRY) ======
// These arrays are still extended by items.js for non-block items (tools, treats, etc.)
const BLOCK_NAMES = [];
const BLOCK_HARDNESS = [];
const BLOCK_TILES = [];
const BLOCK_COLORS = [];

for (let i = 0; i <= LOLLIPOP_TOP; i++) {
    const entry = BLOCK_REGISTRY[i];
    if (!entry) continue;
    BLOCK_NAMES[i] = entry.name;
    BLOCK_HARDNESS[i] = entry.hardness;
    BLOCK_TILES[i] = entry.tiles;
    BLOCK_COLORS[i] = entry.color;
}

function isTransparent(b) { return BLOCK_REGISTRY[b] ? BLOCK_REGISTRY[b].transparent : false; }
function isSolid(b) { return BLOCK_REGISTRY[b] ? BLOCK_REGISTRY[b].solid : false; }

// Tile indices: each block -> [top, side, bottom]
// Tiles are 16x16 in a 16x16 grid atlas (256x256)
const TILE_TOP = 0, TILE_SIDE = 1, TILE_BOTTOM = 2;
