'use strict';

function runGameplayAcceptanceAudit(status){
    if(!EVIDENCE_SLOT||!game.worldLoaded)return null;
    const results={},px=Math.floor(game.player.x),pz=Math.floor(game.player.z),surface=Math.floor(findGround(px,pz));

    const lightX=(px>>4)*16+15,lightY=Math.min(CHUNK_H-3,surface+2),lightZ=pz;
    setBlock(lightX,lightY,lightZ,LOLLIPOP_LAMP);
    results.crossChunkLight=getBlockLightAt(lightX+2,lightY,lightZ)>0;
    setBlock(lightX,lightY,lightZ,AIR);
    results.lightRemoval=getBlockLightAt(lightX+2,lightY,lightZ)===0;

    const ovenPos={x:px+2,y:Math.floor(findGround(px+2,pz)),z:pz};
    setBlock(ovenPos.x,ovenPos.y,ovenPos.z,FURNACE);
    const oven=getOvenState(ovenPos,true),recipe=getOvenRecipe(IRON_ORE);
    oven.input={id:IRON_ORE,count:1};oven.fuel={id:WOOD,count:1};oven.output=null;oven.burnTime=0;oven.progress=0;
    simulateOven(ovenPos,oven,recipe.smeltTime+.2);
    results.oven=oven.output?.id===recipe.outputId&&oven.output.count===recipe.outputCount&&oven.input===null;

    const farmX=px-2,farmZ=pz,farmY=Math.floor(findGround(farmX,farmZ));
    setBlock(farmX,farmY,farmZ,FROSTING_SOIL);setBlock(farmX+1,farmY,farmZ,WATER);plantCrop(farmX,farmY+1,farmZ,COOKIE_CROP);
    const crop=getBlockState(farmX,farmY+1,farmZ,true);crop.growth=CROP_MAX_STAGE;const dropsBefore=game.itemDrops.length;
    harvestCrop(farmX,farmY+1,farmZ,COOKIE_CROP,false);
    results.farming=crop.growth===0&&game.itemDrops.length>dropsBefore;

    const mechY=Math.floor(findGround(px,pz-3)),switchPos={x:px-1,y:mechY,z:pz-3},wirePos={x:px,y:mechY,z:pz-3},lampPos={x:px+1,y:mechY,z:pz-3};
    for(const [pos,id] of [[switchPos,SUGAR_SWITCH],[wirePos,JELLY_WIRE],[lampPos,LOLLIPOP_LAMP]]){setBlock(pos.x,pos.y,pos.z,id);initializePlacedBlockState(pos.x,pos.y,pos.z,id);}
    getBlockState(lampPos.x,lampPos.y,lampPos.z,true).manualOn=false;interactMechanism({...switchPos,block:SUGAR_SWITCH});updateMechanisms(.11);
    results.mechanism=!!getBlockState(wirePos.x,wirePos.y,wirePos.z,false)?.powered&&!!getBlockState(lampPos.x,lampPos.y,lampPos.z,false)?.powered;

    const mob=spawnMob(MOB_PIG,px+.5,surface,pz-3.5,false),mobCount=game.mobs.length;mob.health=1;mob.hurtTime=0;damageMob(mob,2,game.player);
    results.combat=mob.dead&&game.mobs.length===mobCount-1;

    game.inventory.length=36;for(let i=0;i<36;i++)game.inventory[i]=null;
    spawnItemDrop(ITEM_COOKIE,1,game.player.x,game.player.y+1,game.player.z,{x:0,y:0,z:0});const pickup=game.itemDrops.at(-1);pickup.age=1;updateItemDrops(.05);
    results.pickup=game.inventory.some(slot=>slot?.id===ITEM_COOKIE)&&!game.itemDrops.includes(pickup);

    const bedY=Math.floor(findGround(px+3,pz));setBlock(px+3,bedY,pz,MARSHMALLOW_BED);game.dayTime=DAY_CYCLE_LENGTH*.7;
    interactUtilityBlock({x:px+3,y:bedY,z:pz,block:MARSHMALLOW_BED});
    results.sleep=game.dayTime<DAY_CYCLE_LENGTH*.2&&Math.abs(game.spawnPoint.x-(px+3.5))<.01;

    const passed=Object.values(results).every(Boolean);document.documentElement.dataset.systemAudit=Object.entries(results).map(([key,value])=>key+':'+(value?'pass':'fail')).join(',');
    status.textContent=(passed?'Gameplay systems passed: ':'Gameplay systems failed: ')+Object.keys(results).join(', ');scheduleSaveGame();return results;
}
