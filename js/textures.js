import * as THREE from 'three';

const textureCache = new Map();
const SIZE = 1024;
function randomGenerator(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}
function makeNoise(random) {
  const grids = [8,16,32,64,128].map(size => ({size,values:Float32Array.from({length:size*size},random)}));
  return (u,v,octaves=5) => {
    let result=0, weight=1, total=0;
    for (let level=0;level<octaves;level++) {
      const {size,values}=grids[level];
      const x=((u%1+1)%1)*size,y=((v%1+1)%1)*size;
      const ix=Math.floor(x),iy=Math.floor(y);
      const dx=x-ix,dy=y-iy;
      const sx=dx*dx*(3-2*dx),sy=dy*dy*(3-2*dy);
      const a=values[iy*size+ix],b=values[iy*size+(ix+1)%size];
      const c=values[((iy+1)%size)*size+ix],d=values[((iy+1)%size)*size+(ix+1)%size];
      result+=((a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy)*weight;
      total+=weight; weight*=.5;
    }
    return result/total;
  };
}
function blend(a,b,t) { return a.map((v,i)=>v+(b[i]-v)*Math.max(0,Math.min(1,t))); }

// Hand-drawn geographic silhouettes, expressed as longitude / latitude.
// These are an illustrative map, not an external image or geographic dataset.
const CONTINENTS = [
  [[-168,71],[-149,70],[-138,60],[-128,53],[-125,42],[-117,32],[-107,24],[-97,17],[-89,16],[-86,10],[-80,9],[-83,18],[-89,22],[-98,25],[-97,29],[-90,29],[-82,25],[-81,30],[-75,36],[-67,45],[-58,49],[-62,57],[-76,60],[-83,66],[-100,73],[-123,72],[-145,69]],
  [[-81,12],[-71,12],[-62,8],[-51,3],[-35,-6],[-39,-17],[-47,-24],[-52,-33],[-62,-42],[-68,-55],[-75,-49],[-74,-31],[-71,-18],[-79,-5]],
  [[-17,36],[-5,36],[9,37],[23,33],[33,31],[35,23],[44,12],[51,11],[43,-2],[40,-13],[35,-23],[26,-35],[18,-34],[11,-18],[9,-3],[-1,4],[-10,5],[-17,15]],
  [[-10,36],[-10,44],[-2,49],[8,54],[7,59],[21,71],[32,70],[29,60],[43,67],[67,72],[104,77],[135,72],[178,64],[169,59],[152,60],[145,48],[136,44],[131,33],[122,30],[121,22],[109,18],[107,9],[102,2],[98,12],[91,22],[81,8],[74,19],[66,25],[58,23],[52,16],[43,13],[35,29],[28,35],[25,40],[16,41],[10,45],[1,43],[-3,36]],
  [[113,-22],[122,-17],[130,-13],[137,-12],[143,-17],[147,-20],[153,-29],[150,-38],[140,-39],[132,-33],[121,-34],[114,-29]],
  [[-53,60],[-43,59],[-22,70],[-20,81],[-40,84],[-60,78]],
  [[47,-13],[50,-16],[47,-25],[44,-25],[44,-18]],
  [[-10,51],[-6,59],[-2,58],[1,51]],
  [[130,32],[135,36],[140,42],[145,44],[142,38],[137,34]],
  [[96,5],[104,-4],[106,-6],[100,-3]],
  [[108,6],[118,7],[119,-4],[112,-4]],
  [[130,-3],[141,-2],[152,-9],[144,-10],[136,-5]],
  [[166,-34],[174,-39],[179,-42],[173,-46],[167,-44],[172,-39]],
];
function landMask() {
  const canvas=makeCanvas(SIZE,SIZE/2),ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  for (const points of CONTINENTS) {
    ctx.beginPath();
    const projected=points.map(([lon,lat])=>[(lon+180)/360*SIZE,(90-lat)/180*SIZE/2]);
    const first=projected[0],last=projected.at(-1);
    ctx.moveTo((first[0]+last[0])/2,(first[1]+last[1])/2);
    projected.forEach(([x,y],i)=>{
      const next=projected[(i+1)%projected.length];
      ctx.quadraticCurveTo(x,y,(x+next[0])/2,(y+next[1])/2);
    });
    ctx.closePath();ctx.fill();
  }
  return ctx.getImageData(0,0,SIZE,SIZE/2).data;
}
function crater(ctx,x,y,r,random) {
  ctx.save();ctx.translate(x,y);ctx.scale(1,.64+random()*.45);
  const gradient=ctx.createRadialGradient(-r*.2,-r*.18,r*.04,0,0,r);
  gradient.addColorStop(0,'rgba(20,18,17,.27)');
  gradient.addColorStop(.68,'rgba(28,26,24,.27)');
  gradient.addColorStop(.8,'rgba(210,204,192,.19)');
  gradient.addColorStop(1,'rgba(110,104,95,0)');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.restore();
}
export function planetTexture(body) {
  if (textureCache.has(body.id)) return textureCache.get(body.id);
  const seed=[...body.id].reduce((a,c)=>a*31+c.charCodeAt(0),17);
  const random=randomGenerator(seed),noise=makeNoise(random);
  const canvas=makeCanvas(SIZE,SIZE/2),ctx=canvas.getContext('2d');
  const pixels=ctx.createImageData(canvas.width,canvas.height);
  const mask=body.texture==='earth'?landMask():null;
  for (let y=0;y<canvas.height;y++) {
    const v=y/canvas.height, latitude=90-v*180;
    for (let x=0;x<canvas.width;x++) {
      const u=x/canvas.width,i=(y*canvas.width+x)*4;
      const n=noise(u,v),fine=(random()-.5)*8;
      let color;
      switch(body.texture) {
        case 'earth': {
          const coastX=(x+Math.round((noise(u*4,v*3,2)-.5)*12)+SIZE)%SIZE;
          const coastY=Math.max(0,Math.min(SIZE/2-1,y+Math.round((noise(u*3+.2,v*4,2)-.5)*7)));
          const land=mask[(coastY*SIZE+coastX)*4+3]>128;
          if (land) {
            color=blend([55,94,62],[141,146,100],n);
            // A warm, dry belt across the Sahara and Arabian peninsula.
            const longitude=u*360-180;
            if (latitude>12&&latitude<34&&longitude>-18&&longitude<63) color=blend([119,108,71],[185,164,112],n);
            if (Math.abs(latitude)>63) color=blend(color,[183,193,184],(Math.abs(latitude)-63)/16);
          } else color=blend([19,60,100],[48,106,152],n);
          if (latitude<-72+noise(u,.14,2)*5) color=blend([185,202,211],[238,239,230],n);
          const clouds=noise(u*3+Math.sin(v*24)*.08,v*1.7+.32,4);
          const cloudAlpha=Math.max(0,(clouds-.51)*3.1)*(.8+Math.sin(v*Math.PI)*.2);
          color=blend(color,[241,246,242],cloudAlpha);
          break;
        }
        case 'jupiter': {
          const warp=(noise(u,v,3)-.5)*.038;
          const band=Math.sin((v+warp)*Math.PI*38)+Math.sin((v+warp*.6)*Math.PI*73)*.33;
          color=blend([144,105,75],[224,208,177],(band+1.3)/2.6);
          color=blend(color,[244,231,204],Math.max(0,n-.52)*.7);
          break;
        }
        case 'saturn': {
          const bands=.5+Math.sin((v+(n-.5)*.018)*Math.PI*54)*.16+Math.sin(v*132)*.035;
          color=blend([162,147,112],[220,205,163],bands*.5+n*.5);
          break;
        }
        case 'venus': {
          const clouds=noise(u+(n-.5)*.13,v+.13,4);
          color=blend([168,134,86],[230,207,158],clouds);
          break;
        }
        case 'uranus': color=blend([124,183,188],[181,221,220],.4+n*.5+Math.sin(v*80)*.03);break;
        case 'neptune': color=blend([55,96,150],[115,157,196],n*.7+Math.sin(v*65+(n-.5)*3)*.07);break;
        case 'sun': color=blend([223,94,20],[255,208,89],n);break;
        case 'mars': {
          color=blend([99,58,41],[191,117,76],n);
          if (Math.abs(latitude)>80+noise(u,.5,2)*4) color=blend(color,[205,195,173],.8);
          break;
        }
        case 'moon': color=blend([65,67,68],[165,168,167],n);break;
        default: color=blend([80,74,68],[163,151,133],n);
      }
      const poleShade=body.texture==='sun'?1:1-.12*Math.pow(Math.abs(v-.5)*2,6);
      pixels.data[i]=color[0]*poleShade+fine;
      pixels.data[i+1]=color[1]*poleShade+fine;
      pixels.data[i+2]=color[2]*poleShade+fine;
      pixels.data[i+3]=255;
    }
  }
  ctx.putImageData(pixels,0,0);
  if (['rock','moon','mars'].includes(body.texture)) {
    const count=body.texture==='mars'?100:330;
    for (let i=0;i<count;i++) {
      const x=random()*SIZE,y=random()*SIZE/2,r=2+Math.pow(random(),3)*23;
      crater(ctx,x,y,r,random);
      if (x<r) crater(ctx,x+SIZE,y,r,random);
      if (x>SIZE-r) crater(ctx,x-SIZE,y,r,random);
    }
  }
  if (body.texture==='jupiter') {
    ctx.save();ctx.translate(SIZE*.71,SIZE*.31);ctx.scale(1,.49);
    const spot=ctx.createRadialGradient(-7,-4,2,0,0,45);
    spot.addColorStop(0,'#c29471');spot.addColorStop(.52,'#b07853');spot.addColorStop(.78,'#c39970');spot.addColorStop(1,'rgba(191,170,137,0)');
    ctx.fillStyle=spot;ctx.beginPath();ctx.ellipse(0,0,48,40,-.15,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#dbba9050';ctx.lineWidth=2;
    for (let radius=12;radius<43;radius+=5) {ctx.beginPath();ctx.ellipse(0,0,radius,radius*.85,-.15,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;
  texture.anisotropy=4;
  textureCache.set(body.id,texture);
  return texture;
}

export function glowTexture() {
  const canvas=makeCanvas(256,256),ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(128,128,0,128,128,128);
  gradient.addColorStop(0,'rgba(255,227,160,.8)');
  gradient.addColorStop(.17,'rgba(255,196,110,.5)');
  gradient.addColorStop(.3,'rgba(250,158,65,.15)');
  gradient.addColorStop(.6,'rgba(220,109,32,.035)');
  gradient.addColorStop(1,'rgba(220,109,32,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function ringTexture() {
  const canvas=makeCanvas(1024,8),ctx=canvas.getContext('2d'),random=randomGenerator(610);
  for (let x=0;x<1024;x++) {
    const r=x/1024;
    let alpha=(.3+random()*.45)*(r<.08?r/.08:1);
    if (r>.61&&r<.67) alpha*=.08;
    if (r>.88) alpha*=.6;
    const shade=Math.round(155+random()*65);
    ctx.fillStyle=`rgba(${shade+15},${shade+7},${shade-17},${alpha})`;ctx.fillRect(x,0,1,8);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function starTexture() {
  const canvas=makeCanvas(32,32),ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(16,16,0,16,16,16);
  gradient.addColorStop(0,'#fff');gradient.addColorStop(.15,'rgba(255,255,255,.9)');gradient.addColorStop(.4,'rgba(255,255,255,.2)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);return new THREE.CanvasTexture(canvas);
}
export { randomGenerator };
