'use strict';

const MAX_ITEM_DROPS=192;
let dropVAO=null,dropVBO=null;
const dropVerts=new Float32Array(18);

function spawnItemDrop(id,count,x,y,z,velocity) {
    if(!Number.isInteger(id)||count<=0)return;
    for(const drop of game.itemDrops) {
        const dx=drop.x-x,dy=drop.y-y,dz=drop.z-z;
        if(drop.id===id&&dx*dx+dy*dy+dz*dz<2.25&&drop.count+count<=getItemMaxStack(id)){drop.count+=count;return;}
    }
    if(game.itemDrops.length>=MAX_ITEM_DROPS) {
        const same=game.itemDrops.find(drop=>drop.id===id);
        if(same){same.count+=count;return;}
        return;
    }
    game.itemDrops.push({id,count,x,y,z,vx:velocity?.x||0,vy:velocity?.y||1.5,vz:velocity?.z||0,age:0,spin:hash2D(x*31+id,z*47)*Math.PI*2});
}

function updateItemDrops(dt) {
    if(dt<=0)return;
    for(let i=game.itemDrops.length-1;i>=0;i--) {
        const drop=game.itemDrops[i];drop.age+=dt;drop.spin+=dt*2.2;
        const dx=game.player.x-drop.x,dy=game.player.y+1-drop.y,dz=game.player.z-drop.z;
        const distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(drop.age>.35&&distance<3.5) {
            const speed=8*(1-distance/5);drop.vx+=dx/Math.max(.1,distance)*speed*dt;drop.vy+=dy/Math.max(.1,distance)*speed*dt;drop.vz+=dz/Math.max(.1,distance)*speed*dt;
        } else drop.vy-=12*dt;
        const nx=drop.x+drop.vx*dt,ny=drop.y+drop.vy*dt,nz=drop.z+drop.vz*dt;
        if(!isSolid(getBlock(Math.floor(nx),Math.floor(ny),Math.floor(nz)))){drop.x=nx;drop.y=ny;drop.z=nz;}else{drop.vx*=.45;drop.vz*=.45;drop.vy=Math.max(0,drop.vy)*.15;}
        if(drop.age>.35&&distance<.9&&addItem(drop.id,drop.count)){CandyEvents.emit('itemPickedUp',{itemId:drop.id,count:drop.count});game.itemDrops.splice(i,1);continue;}
        if(drop.age>300||drop.y<0)game.itemDrops.splice(i,1);
    }
    for(let i=0;i<game.itemDrops.length;i++)for(let j=game.itemDrops.length-1;j>i;j--){const a=game.itemDrops[i],b=game.itemDrops[j];const dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;if(a.id===b.id&&a.count+b.count<=getItemMaxStack(a.id)&&dx*dx+dy*dy+dz*dz<1){a.count+=b.count;game.itemDrops.splice(j,1);}}
}

function renderItemDrops(vp) {
    if(!game.itemDrops.length)return;
    if(!dropVAO){dropVAO=game.gl.createVertexArray();dropVBO=game.gl.createBuffer();game.gl.bindVertexArray(dropVAO);game.gl.bindBuffer(game.gl.ARRAY_BUFFER,dropVBO);game.gl.bufferData(game.gl.ARRAY_BUFFER,dropVerts.byteLength,game.gl.DYNAMIC_DRAW);game.gl.enableVertexAttribArray(lAPos);game.gl.vertexAttribPointer(lAPos,3,game.gl.FLOAT,false,12,0);}
    game.gl.useProgram(game.lineProgram);game.gl.uniformMatrix4fv(lUni.uVP,false,vp);game.gl.bindVertexArray(dropVAO);game.gl.lineWidth(2);
    for(const drop of game.itemDrops){const bob=Math.sin(drop.age*3+drop.spin)*.08,s=.16+(drop.count>1?.03:0),x=drop.x,y=drop.y+bob,z=drop.z;dropVerts.set([x-s,y,z,x+s,y,z,x,y-s,z,x,y+s,z,x,y,z-s,x,y,z+s]);const color=blockColorToParticle(drop.id);game.gl.uniform4f(lUni.uColor,color[0],color[1],color[2],1);game.gl.bindBuffer(game.gl.ARRAY_BUFFER,dropVBO);game.gl.bufferSubData(game.gl.ARRAY_BUFFER,0,dropVerts);game.gl.drawArrays(game.gl.LINES,0,6);}game.gl.bindVertexArray(null);
}
