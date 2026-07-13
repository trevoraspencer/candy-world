'use strict';

const STRUCTURE_FAMILIES=['gingerbread-village','cupcake-shrine','candy-castle','sprinkle-geode'];

function structurePlan(seed,sectorX,sectorZ,familyIndex){
    const rng=CandyCore.createRng(seed,'structure',game.generatorVersion,sectorX,sectorZ,familyIndex);
    return {family:STRUCTURE_FAMILIES[familyIndex%STRUCTURE_FAMILIES.length],rotation:Math.floor(rng()*4),offsetX:10+Math.floor(rng()*28),offsetZ:10+Math.floor(rng()*28),lootRolls:[rng(),rng(),rng()]};
}

function rotateStructure(dx,dz,rotation){for(let i=0;i<rotation;i++){const next=dx;dx=-dz;dz=next;}return[dx,dz];}

function structureLoot(plan){const common=[ITEM_COOKIE_SEEDS,ITEM_FLOUR,ITEM_GUMMY_BERRIES,ITEM_IRON_INGOT],rare=[ITEM_GOLD_INGOT,ITEM_LAPIS_GEM,ITEM_DIAMOND_GEM];return plan.lootRolls.map((roll,index)=>({id:index===2&&roll>.82?rare[Math.floor(roll*rare.length)%rare.length]:common[Math.floor(roll*common.length)%common.length],count:1+Math.floor(roll*3)}));}

function setStructureBlock(x,y,z,blockId){setBlock(x,y,z,blockId);if(getBlock(x,y,z)===blockId){game.modifiedBlocks.set(blockEditKey(x,y,z),blockId);indexBlockEdit(x,y,z,blockId);}}
function placeStructureChest(x,y,z,plan){setStructureBlock(x,y,z,CUPCAKE_CHEST);game.blockStates.set(blockEntityKey(x,y,z),{facing:plan.rotation,open:false,text:'',connections:0});const slots=new Array(27).fill(null);structureLoot(plan).forEach((item,index)=>slots[index]=item);game.blockEntities.set(blockEntityKey(x,y,z),{type:'chest',structure:plan.family,opened:false,slots});}

function structureBiomeAllowed(family,biome){if(family==='gingerbread-village')return biome===BIOME_PLAINS||biome===BIOME_FOREST;if(family==='cupcake-shrine')return biome===BIOME_FOREST||biome===BIOME_BEACH;if(family==='candy-castle')return biome===BIOME_MOUNTAINS||biome===BIOME_PLAINS;return biome!==BIOME_BEACH;}
function siteForPosition(x,z,spawnX,spawnZ,family,relaxed){x=Math.floor(x);z=Math.floor(z);if(x<9||z<9||x>=WORLD_W-9||z>=WORLD_D-9||(x-spawnX)**2+(z-spawnZ)**2<30**2)return null;if(!relaxed&&!structureBiomeAllowed(family,getBiome(x,z)))return null;let min=CHUNK_H,max=0;for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){const y=getHighestSolidY(x+dx,z+dz);min=Math.min(min,y);max=Math.max(max,y);}return max-min<=(relaxed?5:3)&&max>WATER_LEVEL&&max<CHUNK_H-14?{x,y:max+1,z}:null;}
function siteForStructure(plan,sectorX,sectorZ,spawnX,spawnZ){return siteForPosition(sectorX*64+plan.offsetX,sectorZ*64+plan.offsetZ,spawnX,spawnZ,plan.family,false);}

function placeExplorationStructure(site,plan){const {x,y,z}=site,wall=plan.family==='candy-castle'?STONE:plan.family==='sprinkle-geode'?GLASS:plan.family==='cupcake-shrine'?FROSTING_PINK:PLANKS,accent=plan.family==='candy-castle'?CANDY_CANE_PILLAR:plan.family==='sprinkle-geode'?SPRINKLE:FROSTING_WHITE;
    for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){setStructureBlock(x+dx,y-1,z+dz,wall);if(Math.abs(dx)===4||Math.abs(dz)===4)for(let dy=0;dy<4;dy++)setStructureBlock(x+dx,y+dy,z+dz,wall);}
    const [doorX,doorZ]=rotateStructure(0,-4,plan.rotation);for(let dy=0;dy<3;dy++)setStructureBlock(x+doorX,y+dy,z+doorZ,AIR);
    for(const [dx,dz] of [[-3,-3],[3,-3],[-3,3],[3,3]])for(let dy=4;dy<7;dy++)setStructureBlock(x+dx,y+dy,z+dz,accent);
    placeStructureChest(x,y,z,plan);game.generatedStructures.push({family:plan.family,x,y,z,rotation:plan.rotation});
}

function generateExplorationStructures(spawnX,spawnZ){game.generatedStructures=[];const occupied=[],seed=game.worldSeed||'legacy-candy-world';for(let familyIndex=0;familyIndex<STRUCTURE_FAMILIES.length;familyIndex++){const plan=structurePlan(seed,Math.floor(spawnX/64),Math.floor(spawnZ/64),familyIndex),rng=CandyCore.createRng(seed,'nearby-structure-site',game.generatorVersion,familyIndex);let site=null;for(let relaxed=0;relaxed<2&&!site;relaxed++)for(let attempt=0;attempt<96&&!site;attempt++){const base=familyIndex*Math.PI/2,angle=base+(rng()-.5)*1.05,radius=32+rng()*13,x=spawnX+Math.cos(angle)*radius,z=spawnZ+Math.sin(angle)*radius,candidate=siteForPosition(x,z,spawnX,spawnZ,plan.family,!!relaxed);if(candidate&&!occupied.some(other=>(other.x-candidate.x)**2+(other.z-candidate.z)**2<24**2))site=candidate;}if(site){placeExplorationStructure(site,plan);occupied.push(site);}}document.documentElement.dataset.structureStats=game.generatedStructures.map(s=>s.family).join(',');}
