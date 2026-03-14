'use strict';

// ====== MATH LIBRARY ======
function mat4_perspective(fov, aspect, near, far, out) {
    const m = out || new Float32Array(16);
    m.fill(0);
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    m[0] = f / aspect; m[5] = f;
    m[10] = (far + near) * nf; m[11] = -1;
    m[14] = 2 * far * near * nf;
    return m;
}

function mat4_lookAt(eye, center, up, out) {
    const m = out || new Float32Array(16);
    m.fill(0);
    let zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
    let len = Math.sqrt(zx*zx+zy*zy+zz*zz);
    if(len>0){zx/=len;zy/=len;zz/=len;}
    let xx = up[1]*zz - up[2]*zy, xy = up[2]*zx - up[0]*zz, xz = up[0]*zy - up[1]*zx;
    len = Math.sqrt(xx*xx+xy*xy+xz*xz);
    if(len>0){xx/=len;xy/=len;xz/=len;}
    let yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
    m[0]=xx; m[1]=yx; m[2]=zx;
    m[4]=xy; m[5]=yy; m[6]=zy;
    m[8]=xz; m[9]=yz; m[10]=zz;
    m[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
    m[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
    m[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
    m[15]=1;
    return m;
}

function mat4_multiply(a, b, out) {
    const m = out || new Float32Array(16);
    for(let i=0;i<4;i++) for(let j=0;j<4;j++) {
        m[j*4+i] = a[i]*b[j*4] + a[4+i]*b[j*4+1] + a[8+i]*b[j*4+2] + a[12+i]*b[j*4+3];
    }
    return m;
}
