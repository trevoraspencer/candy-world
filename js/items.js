'use strict';

const ITEM_ICONS = [];

// ====== ITEM TYPES (100+ = non-block items) ======
const ITEM_STICK = 100, ITEM_SUGAR = 101, ITEM_FLOUR = 102;
const ITEM_WOOD_PICKAXE = 110, ITEM_WOOD_AXE = 111, ITEM_WOOD_SHOVEL = 112, ITEM_WOOD_SWORD = 113;
const ITEM_STONE_PICKAXE = 114, ITEM_STONE_AXE = 115, ITEM_STONE_SHOVEL = 116, ITEM_STONE_SWORD = 117;
const ITEM_IRON_PICKAXE = 118, ITEM_IRON_AXE = 119, ITEM_IRON_SHOVEL = 120, ITEM_IRON_SWORD = 121;
const ITEM_GOLD_PICKAXE = 122, ITEM_GOLD_AXE = 123, ITEM_GOLD_SHOVEL = 124, ITEM_GOLD_SWORD = 125;
const ITEM_DIAMOND_PICKAXE = 126, ITEM_DIAMOND_AXE = 127, ITEM_DIAMOND_SHOVEL = 128, ITEM_DIAMOND_SWORD = 129;
const ITEM_NETHERITE_PICKAXE = 130, ITEM_NETHERITE_AXE = 131, ITEM_NETHERITE_SHOVEL = 132, ITEM_NETHERITE_SWORD = 133;
const ITEM_CUPCAKE = 140, ITEM_COOKIE = 141, ITEM_CANDY = 142, ITEM_LOLLIPOP = 143;
const ITEM_IRON_INGOT = 150, ITEM_GOLD_INGOT = 151, ITEM_DIAMOND_GEM = 152, ITEM_NETHERITE_INGOT = 153, ITEM_LAPIS_GEM = 154;

// Item names and colors
BLOCK_NAMES[ITEM_STICK] = 'Stick'; BLOCK_COLORS[ITEM_STICK] = '#DEB887';
BLOCK_NAMES[ITEM_SUGAR] = 'Sugar'; BLOCK_COLORS[ITEM_SUGAR] = '#FFF5EE';
BLOCK_NAMES[ITEM_FLOUR] = 'Flour'; BLOCK_COLORS[ITEM_FLOUR] = '#FFFAF0';
BLOCK_NAMES[ITEM_WOOD_PICKAXE] = 'Wood Pickaxe'; BLOCK_COLORS[ITEM_WOOD_PICKAXE] = '#FADCE6';
BLOCK_NAMES[ITEM_WOOD_AXE] = 'Wood Axe'; BLOCK_COLORS[ITEM_WOOD_AXE] = '#FADCE6';
BLOCK_NAMES[ITEM_WOOD_SHOVEL] = 'Wood Shovel'; BLOCK_COLORS[ITEM_WOOD_SHOVEL] = '#FADCE6';
BLOCK_NAMES[ITEM_WOOD_SWORD] = 'Wood Sword'; BLOCK_COLORS[ITEM_WOOD_SWORD] = '#FADCE6';
BLOCK_NAMES[ITEM_STONE_PICKAXE] = 'Stone Pickaxe'; BLOCK_COLORS[ITEM_STONE_PICKAXE] = '#F5D5E0';
BLOCK_NAMES[ITEM_STONE_AXE] = 'Stone Axe'; BLOCK_COLORS[ITEM_STONE_AXE] = '#F5D5E0';
BLOCK_NAMES[ITEM_STONE_SHOVEL] = 'Stone Shovel'; BLOCK_COLORS[ITEM_STONE_SHOVEL] = '#F5D5E0';
BLOCK_NAMES[ITEM_STONE_SWORD] = 'Stone Sword'; BLOCK_COLORS[ITEM_STONE_SWORD] = '#F5D5E0';
BLOCK_NAMES[ITEM_IRON_PICKAXE] = 'Iron Pickaxe'; BLOCK_COLORS[ITEM_IRON_PICKAXE] = '#E8D0D8';
BLOCK_NAMES[ITEM_IRON_AXE] = 'Iron Axe'; BLOCK_COLORS[ITEM_IRON_AXE] = '#E8D0D8';
BLOCK_NAMES[ITEM_IRON_SHOVEL] = 'Iron Shovel'; BLOCK_COLORS[ITEM_IRON_SHOVEL] = '#E8D0D8';
BLOCK_NAMES[ITEM_IRON_SWORD] = 'Iron Sword'; BLOCK_COLORS[ITEM_IRON_SWORD] = '#E8D0D8';
BLOCK_NAMES[ITEM_GOLD_PICKAXE] = 'Gold Pickaxe'; BLOCK_COLORS[ITEM_GOLD_PICKAXE] = '#D4A860';
BLOCK_NAMES[ITEM_GOLD_AXE] = 'Gold Axe'; BLOCK_COLORS[ITEM_GOLD_AXE] = '#D4A860';
BLOCK_NAMES[ITEM_GOLD_SHOVEL] = 'Gold Shovel'; BLOCK_COLORS[ITEM_GOLD_SHOVEL] = '#D4A860';
BLOCK_NAMES[ITEM_GOLD_SWORD] = 'Gold Sword'; BLOCK_COLORS[ITEM_GOLD_SWORD] = '#D4A860';
BLOCK_NAMES[ITEM_DIAMOND_PICKAXE] = 'Diamond Pickaxe'; BLOCK_COLORS[ITEM_DIAMOND_PICKAXE] = '#B9F2FF';
BLOCK_NAMES[ITEM_DIAMOND_AXE] = 'Diamond Axe'; BLOCK_COLORS[ITEM_DIAMOND_AXE] = '#B9F2FF';
BLOCK_NAMES[ITEM_DIAMOND_SHOVEL] = 'Diamond Shovel'; BLOCK_COLORS[ITEM_DIAMOND_SHOVEL] = '#B9F2FF';
BLOCK_NAMES[ITEM_DIAMOND_SWORD] = 'Diamond Sword'; BLOCK_COLORS[ITEM_DIAMOND_SWORD] = '#B9F2FF';
BLOCK_NAMES[ITEM_NETHERITE_PICKAXE] = 'Netherite Pickaxe'; BLOCK_COLORS[ITEM_NETHERITE_PICKAXE] = '#4A4A5A';
BLOCK_NAMES[ITEM_NETHERITE_AXE] = 'Netherite Axe'; BLOCK_COLORS[ITEM_NETHERITE_AXE] = '#4A4A5A';
BLOCK_NAMES[ITEM_NETHERITE_SHOVEL] = 'Netherite Shovel'; BLOCK_COLORS[ITEM_NETHERITE_SHOVEL] = '#4A4A5A';
BLOCK_NAMES[ITEM_NETHERITE_SWORD] = 'Netherite Sword'; BLOCK_COLORS[ITEM_NETHERITE_SWORD] = '#4A4A5A';
BLOCK_NAMES[ITEM_CUPCAKE] = 'Cupcake'; BLOCK_COLORS[ITEM_CUPCAKE] = '#FF69B4';
BLOCK_NAMES[ITEM_COOKIE] = 'Cookie'; BLOCK_COLORS[ITEM_COOKIE] = '#D2B48C';
BLOCK_NAMES[ITEM_CANDY] = 'Candy'; BLOCK_COLORS[ITEM_CANDY] = '#FF1493';
BLOCK_NAMES[ITEM_LOLLIPOP] = 'Lollipop'; BLOCK_COLORS[ITEM_LOLLIPOP] = '#FF6EC7';
BLOCK_NAMES[ITEM_IRON_INGOT] = 'Iron Ingot'; BLOCK_COLORS[ITEM_IRON_INGOT] = '#E8D0D8';
BLOCK_NAMES[ITEM_GOLD_INGOT] = 'Gold Ingot'; BLOCK_COLORS[ITEM_GOLD_INGOT] = '#D4A860';
BLOCK_NAMES[ITEM_DIAMOND_GEM] = 'Diamond'; BLOCK_COLORS[ITEM_DIAMOND_GEM] = '#B9F2FF';
BLOCK_NAMES[ITEM_NETHERITE_INGOT] = 'Netherite Ingot'; BLOCK_COLORS[ITEM_NETHERITE_INGOT] = '#4A4A5A';
BLOCK_NAMES[ITEM_LAPIS_GEM] = 'Lapis'; BLOCK_COLORS[ITEM_LAPIS_GEM] = '#87CEEB';

// Tool / treat classification
function isToolItem(id) { return id >= 110 && id <= 133; }
function isTreatItem(id) { return id >= 140 && id <= 143; }
function getItemMaxStack(id) { return isToolItem(id) ? 1 : 64; }

function setItemIcon(el, id) {
    if (ITEM_ICONS[id]) {
        el.style.backgroundImage = 'url(' + ITEM_ICONS[id] + ')';
        el.style.backgroundSize = 'cover';
        el.style.backgroundColor = 'transparent';
    } else {
        el.style.backgroundImage = 'none';
        el.style.backgroundColor = BLOCK_COLORS[id] || '#888';
    }
}

function generateItemIcons() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function px(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
    }

    // (a) Block icons — extract top tile from atlas
    for (let id = 1; id <= 32; id++) {
        if (!BLOCK_TILES[id]) continue;
        const tileIdx = BLOCK_TILES[id][0]; // top face
        const sx = (tileIdx % 16) * 16;
        const sy = Math.floor(tileIdx / 16) * 16;
        ctx.clearRect(0, 0, 16, 16);
        ctx.drawImage(game.atlasCanvas, sx, sy, 16, 16, 0, 0, 16, 16);
        ITEM_ICONS[id] = c.toDataURL();
    }

    // (b) Tool icons — template approach
    const toolTemplates = [
        // Pickaxe
        [
            '......HHH......',
            '.....HhHhH.....',
            '......h.Hh.....',
            '.........Sh....',
            '........S.h....',
            '.......S.......',
            '......S........',
            '.....S.........',
            '....S..........',
            '...S...........',
            '..s............',
            '.s.............',
            '................',
            '................',
            '................',
            '................',
        ],
        // Axe
        [
            '................',
            '.......HHH.....',
            '......HhHhH....',
            '.....HHhHh.....',
            '.....HHHSh.....',
            '......h.S......',
            '.......S.......',
            '......S........',
            '.....S.........',
            '....S..........',
            '...S...........',
            '..s............',
            '.s.............',
            '................',
            '................',
            '................',
        ],
        // Shovel
        [
            '................',
            '.......HH......',
            '......HhHH.....',
            '......HhhH.....',
            '.......Hh......',
            '.......S.......',
            '......S........',
            '.....S.........',
            '....S..........',
            '...S...........',
            '..S............',
            '.s.............',
            '................',
            '................',
            '................',
            '................',
        ],
        // Sword
        [
            '................',
            '..........HH...',
            '.........HhH...',
            '........HhH....',
            '.......HhH.....',
            '......HhH......',
            '.....HhH.......',
            '....HhH........',
            '...sSH.........',
            '..S.s..........',
            '.sS............',
            '..s............',
            '................',
            '................',
            '................',
            '................',
        ],
    ];

    const tierHeadColors = [
        ['#FADCE6', '#E8C0D0'],  // Wood
        ['#D0C0C8', '#B0A0A8'],  // Stone
        ['#E0E0E0', '#C0C0C0'],  // Iron
        ['#FFD700', '#C8A800'],  // Gold
        ['#7DF9FF', '#50D0E0'],  // Diamond
        ['#5A5A6A', '#3A3A4A'],  // Netherite
    ];
    const handleColor = '#8B6040';
    const handleShadow = '#6B4830';

    for (let tier = 0; tier < 6; tier++) {
        for (let tool = 0; tool < 4; tool++) {
            const id = 110 + tier * 4 + tool;
            const template = toolTemplates[tool];
            const [headCol, headShad] = tierHeadColors[tier];
            ctx.clearRect(0, 0, 16, 16);
            for (let y = 0; y < 16; y++) {
                const row = template[y];
                if (!row) continue;
                for (let x = 0; x < 16; x++) {
                    const ch = row[x];
                    if (ch === 'H') px(x, y, headCol);
                    else if (ch === 'h') px(x, y, headShad);
                    else if (ch === 'S') px(x, y, handleColor);
                    else if (ch === 's') px(x, y, handleShadow);
                }
            }
            ITEM_ICONS[id] = c.toDataURL();
        }
    }

    // (c) Material icons
    // Stick
    ctx.clearRect(0, 0, 16, 16);
    for (let i = 0; i < 10; i++) {
        px(4 + i, 12 - i, '#8B6040');
        px(5 + i, 12 - i, '#A07850');
    }
    ITEM_ICONS[ITEM_STICK] = c.toDataURL();

    // Sugar
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 10; y < 15; y++)
        for (let x = 4; x < 12; x++) {
            if (y >= 14 - Math.abs(x - 8) * 0.6) px(x, y, '#FFFFFF');
        }
    for (let i = 0; i < 6; i++) {
        const sx2 = 5 + Math.floor(hash2D(ITEM_SUGAR * 17 + i * 31, 1) * 6);
        const sy2 = 10 + Math.floor(hash2D(ITEM_SUGAR * 19 + i * 37, 2) * 4);
        px(sx2, sy2, '#FFF8EE');
    }
    // sparkle dots
    px(6, 8, '#FFFFFF'); px(7, 7, '#FFFDF0'); px(10, 9, '#FFFFFF');
    ITEM_ICONS[ITEM_SUGAR] = c.toDataURL();

    // Flour
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 9; y < 15; y++)
        for (let x = 3; x < 13; x++) {
            if (y >= 14 - Math.abs(x - 8) * 0.8) px(x, y, '#F5E6D0');
        }
    for (let y = 9; y < 15; y++)
        for (let x = 4; x < 12; x++) {
            if (y >= 14 - Math.abs(x - 8) * 0.7) px(x, y, '#FAF0E0');
        }
    ITEM_ICONS[ITEM_FLOUR] = c.toDataURL();

    // (d) Treat icons
    // Cupcake
    ctx.clearRect(0, 0, 16, 16);
    // wrapper
    for (let y = 9; y < 15; y++)
        for (let x = 4; x < 12; x++) {
            const inset = Math.floor((y - 9) * 0.3);
            if (x >= 4 + inset && x < 12 - inset) px(x, y, '#D06080');
        }
    // wrapper lines
    for (let y = 9; y < 15; y++) {
        const inset = Math.floor((y - 9) * 0.3);
        px(5 + inset, y, '#E070A0');
        px(10 - inset, y, '#E070A0');
    }
    // cake body
    for (let x = 5; x < 11; x++) px(x, 8, '#F0D0A0');
    for (let x = 5; x < 11; x++) px(x, 7, '#F0D0A0');
    // frosting
    for (let x = 4; x < 12; x++) px(x, 6, '#FF69B4');
    for (let x = 5; x < 11; x++) px(x, 5, '#FF79C4');
    for (let x = 6; x < 10; x++) px(x, 4, '#FF89D4');
    px(7, 3, '#FF99E4'); px(8, 3, '#FF99E4');
    // cherry on top
    px(7, 2, '#FF0040'); px(8, 2, '#FF0040');
    ITEM_ICONS[ITEM_CUPCAKE] = c.toDataURL();

    // Cookie
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 4; y < 13; y++)
        for (let x = 4; x < 13; x++) {
            const dx = x - 8, dy = y - 8;
            if (dx * dx + dy * dy <= 18) px(x, y, '#C8A070');
        }
    // edge darkening
    for (let y = 4; y < 13; y++)
        for (let x = 4; x < 13; x++) {
            const dx = x - 8, dy = y - 8;
            if (dx * dx + dy * dy > 14 && dx * dx + dy * dy <= 18) px(x, y, '#B08860');
        }
    // chocolate chips
    px(6, 6, '#5A3020'); px(9, 7, '#5A3020'); px(7, 9, '#5A3020');
    px(10, 10, '#5A3020'); px(5, 8, '#5A3020');
    ITEM_ICONS[ITEM_COOKIE] = c.toDataURL();

    // Candy
    ctx.clearRect(0, 0, 16, 16);
    // wrapper ends (twisted)
    for (let i = 0; i < 3; i++) {
        px(2, 6 + i, '#FF90C0'); px(3, 6 + i, '#FFB0D0');
        px(12, 6 + i, '#FF90C0'); px(13, 6 + i, '#FFB0D0');
    }
    px(1, 7, '#FF80B0'); px(14, 7, '#FF80B0');
    // candy body
    for (let y = 5; y < 11; y++)
        for (let x = 4; x < 12; x++) {
            const stripe = (x + y) % 4 < 2;
            px(x, y, stripe ? '#FF1493' : '#FF69B4');
        }
    ITEM_ICONS[ITEM_CANDY] = c.toDataURL();

    // Lollipop
    ctx.clearRect(0, 0, 16, 16);
    // stick
    for (let y = 9; y < 15; y++) { px(7, y, '#C8A070'); px(8, y, '#B08860'); }
    // candy circle
    for (let y = 1; y < 10; y++)
        for (let x = 3; x < 13; x++) {
            const dx = x - 8, dy = y - 5;
            if (dx * dx + dy * dy <= 16) {
                const stripe = (x + y) % 3 < 2;
                px(x, y, stripe ? '#FF1493' : '#FF90D0');
            }
        }
    // swirl highlight
    px(6, 4, '#FFFFFF'); px(7, 3, '#FFFFFF'); px(9, 5, '#FFD0E8');
    ITEM_ICONS[ITEM_LOLLIPOP] = c.toDataURL();

    // (e) Resource icons
    // Iron Ingot
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 7; y < 13; y++)
        for (let x = 3; x < 13; x++) {
            if (y < 9) { if (x >= 4 && x < 12) px(x, y, '#E8E0E0'); }
            else if (y < 11) { if (x >= 3 && x < 13) px(x, y, '#D0C8C8'); }
            else { if (x >= 4 && x < 12) px(x, y, '#B8B0B0'); }
        }
    // highlight
    for (let x = 5; x < 11; x++) px(x, 7, '#F0F0F0');
    ITEM_ICONS[ITEM_IRON_INGOT] = c.toDataURL();

    // Gold Ingot
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 7; y < 13; y++)
        for (let x = 3; x < 13; x++) {
            if (y < 9) { if (x >= 4 && x < 12) px(x, y, '#FFD700'); }
            else if (y < 11) { if (x >= 3 && x < 13) px(x, y, '#D4A800'); }
            else { if (x >= 4 && x < 12) px(x, y, '#B08800'); }
        }
    for (let x = 5; x < 11; x++) px(x, 7, '#FFE840');
    ITEM_ICONS[ITEM_GOLD_INGOT] = c.toDataURL();

    // Diamond Gem
    ctx.clearRect(0, 0, 16, 16);
    // top facets
    for (let x = 5; x < 11; x++) px(x, 4, '#D0FFFF');
    for (let x = 4; x < 12; x++) px(x, 5, '#B9F2FF');
    for (let x = 3; x < 13; x++) px(x, 6, '#A0E8F8');
    for (let x = 3; x < 13; x++) px(x, 7, '#90D8E8');
    // bottom facets (narrowing)
    for (let x = 4; x < 12; x++) px(x, 8, '#80C8D8');
    for (let x = 5; x < 11; x++) px(x, 9, '#70B8C8');
    for (let x = 6; x < 10; x++) px(x, 10, '#60A8B8');
    for (let x = 7; x < 9; x++) px(x, 11, '#50A0B0');
    px(7, 12, '#4898A8');
    // facet lines
    px(5, 5, '#E0FFFF'); px(6, 5, '#E0FFFF');
    px(8, 6, '#C8F0FF'); px(4, 7, '#70B0C0');
    ITEM_ICONS[ITEM_DIAMOND_GEM] = c.toDataURL();

    // Netherite Ingot
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 7; y < 13; y++)
        for (let x = 3; x < 13; x++) {
            if (y < 9) { if (x >= 4 && x < 12) px(x, y, '#5A5A6A'); }
            else if (y < 11) { if (x >= 3 && x < 13) px(x, y, '#4A4A5A'); }
            else { if (x >= 4 && x < 12) px(x, y, '#3A3A4A'); }
        }
    for (let x = 5; x < 11; x++) px(x, 7, '#6A6A7A');
    ITEM_ICONS[ITEM_NETHERITE_INGOT] = c.toDataURL();

    // Lapis Gem
    ctx.clearRect(0, 0, 16, 16);
    // oval gem shape
    for (let y = 4; y < 12; y++)
        for (let x = 5; x < 11; x++) {
            const dx = (x - 8) / 3, dy = (y - 8) / 4;
            if (dx * dx + dy * dy <= 1) px(x, y, '#4488CC');
        }
    // inner highlight
    for (let y = 5; y < 9; y++)
        for (let x = 6; x < 10; x++) {
            const dx = (x - 7.5) / 2, dy = (y - 7) / 2.5;
            if (dx * dx + dy * dy <= 0.8) px(x, y, '#60AAEE');
        }
    px(7, 5, '#88CCFF'); px(6, 6, '#78BBEE');
    ITEM_ICONS[ITEM_LAPIS_GEM] = c.toDataURL();
}
