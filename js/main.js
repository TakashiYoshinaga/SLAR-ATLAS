import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BODIES, EARTH_YEAR_SECONDS, EARTH_YEAR_DAYS } from './data.js';
import { createSimulation, advanceSimulation, localPosition, spinAngle } from './simulation.js';
import { planetTexture, glowTexture, ringTexture, starTexture, randomGenerator } from './textures.js';
import { textFor, bodyName, bodyCategory, bodyDescription, timeScaleText } from './i18n.js';
import { labelAnchor, updateLabelVisibility } from './label-layout.js';
import { isMobileLayout, viewingArea, framing } from './layout.js';
import { createTapTracker } from './tap.js';
import { createMobileUI } from './mobile-ui.js';

const $ = selector => document.querySelector(selector);
const stage=$('#scene'),labelLayer=$('#labels');
const coarsePointer=matchMedia('(any-pointer: coarse)');
let mobile=isMobileLayout(innerWidth,innerHeight,coarsePointer.matches);
let viewport={width:innerWidth,height:innerHeight},frame=null,area=null,focusScale=1;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#070a10');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.18;
stage.appendChild(renderer.domElement);
stage.appendChild(labelLayer);
const camera=new THREE.PerspectiveCamera(42,1,.04,2000);
// Labels and canvas share one input surface, so drags starting on a label work.
const controls=new OrbitControls(camera,stage);
controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
controls.enableDamping=true;controls.dampingFactor=.065;
controls.minDistance=4.5;controls.maxDistance=400;
controls.maxPolarAngle=Math.PI-.05;controls.minPolarAngle=.05;
controls.zoomSpeed=.85;controls.rotateSpeed=.65;
const simulation=createSimulation();
const bodies=new Map();
const orbitLines=[];
const clickable=[];
let savedLanguage='ja';
try { savedLanguage=localStorage.getItem('solar-atlas-language')==='en'?'en':'ja'; } catch {}
const state={selectedId:null,orbitsVisible:true,labelsVisible:true,language:savedLanguage};
let cameraTransition=null;
const followPosition=new THREE.Vector3(),lastFollowPosition=new THREE.Vector3(),followDelta=new THREE.Vector3();
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const world=new THREE.Vector3(),projected=new THREE.Vector3();
const sunLight=new THREE.PointLight('#ffedd3',2.8,0,0);
scene.add(sunLight,new THREE.AmbientLight('#a9bdd8',.65));

// One draw call for the stars. The shell stays outside the navigable solar system.
const random=randomGenerator(9196),starCount=3400;
const starPositions=new Float32Array(starCount*3),starColors=new Float32Array(starCount*3);
for (let i=0;i<starCount;i++) {
  const y=random()*2-1,angle=random()*Math.PI*2,radius=430+random()*450;
  const radial=Math.sqrt(1-y*y);
  starPositions.set([Math.cos(angle)*radial*radius,y*radius,Math.sin(angle)*radial*radius],i*3);
  const value=.4+Math.pow(random(),3)*.6;
  starColors.set([value*(.86+random()*.14),value*(.88+random()*.12),value],i*3);
}
const starsGeometry=new THREE.BufferGeometry();
starsGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
starsGeometry.setAttribute('color',new THREE.BufferAttribute(starColors,3));
const stars=new THREE.Points(starsGeometry,new THREE.PointsMaterial({size:2.3,sizeAttenuation:false,map:starTexture(),transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,toneMapped:false}));
stars.frustumCulled=false;scene.add(stars);

function makeOrbit(body) {
  const positions=[];
  for (let i=0;i<256;i++) {const a=i/256*Math.PI*2;positions.push(Math.cos(a)*body.orbitRadius,0,-Math.sin(a)*body.orbitRadius);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const line=new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color:body.id==='moon'?'#8c9aaa':'#738097',transparent:true,opacity:body.id==='moon'?.21:.2,depthWrite:false}));
  orbitLines.push(line);return line;
}

for (const [index,body] of BODIES.entries()) {
  // A body's origin only translates. Tilt and spin never rotate a child's orbit.
  const root=new THREE.Group(),axis=new THREE.Group();
  root.add(axis);axis.rotation.z=THREE.MathUtils.degToRad(body.tilt);
  const material=body.id==='sun'
    ? new THREE.MeshBasicMaterial({map:planetTexture(body),color:'#fff1cd',toneMapped:false})
    : new THREE.MeshStandardMaterial({map:planetTexture(body),roughness:body.id==='earth'?.76:.95,metalness:0});
  if (['rock','moon','mars'].includes(body.texture)) {material.bumpMap=material.map;material.bumpScale=.04;}
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(body.radius,mobile?48:64,mobile?32:40),material);
  mesh.userData.bodyId=body.id;axis.add(mesh);clickable.push(mesh);
  if (body.ring) {
    const inner=body.radius*1.38,outer=body.radius*2.35;
    const geometry=new THREE.RingGeometry(inner,outer,160);
    const position=geometry.attributes.position,uv=geometry.attributes.uv;
    for (let i=0;i<position.count;i++) uv.setXY(i,(Math.hypot(position.getX(i),position.getY(i))-inner)/(outer-inner),.5);
    const ring=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:ringTexture(),side:THREE.DoubleSide,transparent:true,depthWrite:false,roughness:1}));
    ring.rotation.x=-Math.PI/2;ring.userData.bodyId=body.id;axis.add(ring);clickable.push(ring);
  }
  if (body.id==='earth') {
    const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(body.radius*1.035,48,32),new THREE.ShaderMaterial({
      uniforms:{glowColor:{value:new THREE.Color('#5caafa')}},
      vertexShader:'varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.0); vPosition=p.xyz; gl_Position=projectionMatrix*p;}',
      fragmentShader:'uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vPosition; void main(){float edge=pow(1.0-abs(dot(normalize(vNormal),normalize(-vPosition))),3.5); gl_FragColor=vec4(glowColor,edge*0.42);}',
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    }));axis.add(atmosphere);
  }
  if (body.id==='sun') {
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
    glow.scale.setScalar(body.radius*11);root.add(glow);
  }
  const label=document.createElement('button');label.className=`body-label is-muted${body.id==='moon'?' is-moon':''}`;
  label.textContent=body.name;label.style.setProperty('--planet-color',body.color);label.dataset.body=body.id;
  label.setAttribute('aria-label',`${body.name}に接近する`);label.setAttribute('aria-pressed','false');labelLayer.appendChild(label);
  const nav=document.createElement('button');nav.className='nav-body';nav.dataset.body=body.id;nav.setAttribute('aria-pressed','false');
  nav.style.setProperty('--planet-color',body.color);
  nav.innerHTML=`<span class="planet-dot" aria-hidden="true"></span><span>${body.name}</span><span class="nav-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span>`;
  $('#body-nav').appendChild(nav);
  bodies.set(body.id,{root,axis,mesh,label,nav,data:body,labelVisibility:{initialized:false,visible:false,pendingSeconds:0}});
  const parent=bodies.get(body.parentId)?.root??scene;
  parent.add(root);
  if (body.orbitRadius) parent.add(makeOrbit(body));
  // Paint the loading indicator between the CPU-heavy texture generations.
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
}

const tapTracker=createTapTracker();
const mobileUI=createMobileUI({onModalChange:open=>{
  controls.enabled=!open;tapTracker.clear();stage.classList.remove('is-dragging','is-hovering');
}});
function overviewDistance() {
  if (!mobile) return Math.max(174,90/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(.7,area.width/viewport.height)));
  return Math.max(174,frame.fitDistance(82));
}
function resetCameraImmediate() {
  controls.target.set(0,0,0);
  camera.position.set(.12,.72,1).normalize().multiplyScalar(overviewDistance());
  camera.lookAt(controls.target);controls.update();
}
function resize() {
  const rect=$('#app').getBoundingClientRect();
  viewport={width:rect.width,height:rect.height};
  const nextMobile=isMobileLayout(rect.width,rect.height,coarsePointer.matches);
  if (mobile!==nextMobile) for (const view of bodies.values()) {
    view.mesh.geometry.dispose();view.mesh.geometry=new THREE.SphereGeometry(view.data.radius,nextMobile?48:64,nextMobile?32:40);
  }
  mobile=nextMobile;mobileUI.setMobile(mobile);
  const header=$('.masthead').getBoundingClientRect();
  const dock=$(mobile?'#mobile-dock':'.bottom-ui').getBoundingClientRect();
  area=viewingArea({width:rect.width,height:rect.height,mobile,headerBottom:header.bottom,
    dockTop:dock.top,panelLeft:mobile?rect.width:$('.explorer').getBoundingClientRect().left});
  frame=framing({...viewport,area,fov:camera.fov});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2));
  renderer.setSize(rect.width,rect.height);
  starsGeometry.setDrawRange(0,mobile?1700:3400);
  camera.aspect=rect.width/rect.height;
  camera.setViewOffset(rect.width,rect.height,frame.offsetX,frame.offsetY,rect.width,rect.height);
  camera.updateProjectionMatrix();
  const nextScale=mobile?Math.max(1,frame.fitDistance(1)/5.6):1;
  if (state.selectedId && nextScale!==focusScale) {
    const ratio=nextScale/focusScale;
    camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
    if (cameraTransition) {cameraTransition.offset.multiplyScalar(ratio);cameraTransition.fromPosition.sub(cameraTransition.fromTarget).multiplyScalar(ratio).add(cameraTransition.fromTarget);}
  }
  focusScale=nextScale;controls.maxDistance=Math.max(400,overviewDistance()*1.5);
  if (!state.selectedId) {cameraTransition=null;resetCameraImmediate();}
  updateHints();
}
resize();resetCameraImmediate();
let resizePending=false;
function scheduleResize() {if(!resizePending){resizePending=true;requestAnimationFrame(()=>{resizePending=false;resize();});}}
addEventListener('resize',scheduleResize);
visualViewport?.addEventListener('resize',scheduleResize);
coarsePointer.addEventListener('change',scheduleResize);
new ResizeObserver(scheduleResize).observe($('#app'));

function togglePlayback() {
  simulation.paused=!simulation.paused;
  $('#pause-icon').toggleAttribute('hidden',simulation.paused);$('#play-icon').toggleAttribute('hidden',!simulation.paused);
  const t=textFor(state.language);
  $('#play-toggle').setAttribute('aria-label',simulation.paused?t.play:t.pause);
  $('#live-state').textContent=simulation.paused?'SIMULATION PAUSED':'SIMULATION LIVE';
  $('.live').classList.toggle('is-paused',simulation.paused);
}
function updateTimeScale() { $('#time-scale').textContent=timeScaleText(state.language,simulation.speed,EARTH_YEAR_SECONDS);$('#mobile-speed').value=String(simulation.speed); }
function setSpeed(speed) {
  if (![.25,1,10,100].includes(speed)) return;
  simulation.speed=speed;
  for (const option of $('#speed-options').children) option.setAttribute('aria-pressed',String(Number(option.dataset.speed)===speed));
  updateTimeScale();
}
$('#mobile-speed').addEventListener('change',event=>setSpeed(Number(event.target.value)));
$('#play-toggle').addEventListener('click',togglePlayback);
$('#speed-options').addEventListener('click',event=>{
  const button=event.target.closest('[data-speed]');if (!button) return;
  setSpeed(Number(button.dataset.speed));
});
$('#orbits-toggle').addEventListener('click',()=>{
  state.orbitsVisible=!state.orbitsVisible;
  orbitLines.forEach(line=>line.visible=state.orbitsVisible);
  $('#orbits-toggle').setAttribute('aria-pressed',String(state.orbitsVisible));
});
$('#labels-toggle').addEventListener('click',()=>{
  state.labelsVisible=!state.labelsVisible;labelLayer.hidden=!state.labelsVisible;
  $('#labels-toggle').setAttribute('aria-pressed',String(state.labelsVisible));
});
function updateInfo(body) {
  const t=textFor(state.language),isJapanese=state.language==='ja';
  $('.body-info').classList.toggle('is-selected',Boolean(body));
  $('.scene-heading').hidden=Boolean(body);
  $('#pan-hint').textContent=body?t.tracking:t.pan;
  $('#panel-mode').textContent=body?t.focusMode:t.overviewMode;
  $('#body-category').textContent=body?bodyCategory(body,state.language):t.overviewCategory;
  $('#body-index').textContent=body?`${String(BODIES.indexOf(body)+1).padStart(2,'0')} / 10`:'00 / 10';
  $('#body-name').textContent=body?bodyName(body,state.language):t.overviewName;
  $('#body-english').textContent=body?(isJapanese?body.english:t.profile):t.overviewSecondary;
  $('#body-description').textContent=body?bodyDescription(body,state.language):t.overviewDescription;
  if (!body) {
    $('#stat-label-one').textContent=t.planets;$('#stat-label-two').textContent=t.shownMoon;
    $('#stat-one').innerHTML='08 <small>PLANETS</small>';$('#stat-two').innerHTML='01 <small>MOON</small>';
  } else if (body.id==='sun') {
    $('#stat-label-one').textContent=t.type;$('#stat-label-two').textContent=t.orbitingPlanets;
    $('#stat-one').innerHTML=t.star;$('#stat-two').innerHTML='08 <small>PLANETS</small>';
  } else {
    const periodDays=body.orbitalPeriodYears*EARTH_YEAR_DAYS;
    const shortPeriod=body.orbitalPeriodYears<2;
    $('#stat-label-one').textContent=body.id==='moon'?t.moonPeriod:t.sunPeriod;
    $('#stat-one').innerHTML=shortPeriod?`${Number(periodDays.toFixed(1))} <small>${t.days}</small>`:`${Number(body.orbitalPeriodYears.toFixed(2))} <small>${t.earthYears}</small>`;
    $('#stat-label-two').textContent=body.id==='moon'?t.spinOrbit:t.earthRatio;
    $('#stat-two').innerHTML=body.id==='moon'?`${t.synchronous} <small>1 : 1</small>`:`${Number(body.orbitalPeriodYears.toFixed(2))} <small>${t.times}</small>`;
  }
  for (const view of bodies.values()) {
    const selected=view.data.id===body?.id;
    view.label.setAttribute('aria-pressed',String(selected));view.nav.setAttribute('aria-pressed',String(selected));
  }
  $('.explorer').scrollTop=0;
  mobileUI.localize(t,body?bodyName(body,state.language):t.overviewName);
  updateHints();
}

function updateHints() {
  const t=textFor(state.language),touch=coarsePointer.matches;
  $('#rotate-hint').textContent=touch?t.touchRotate:t.rotate;
  $('#zoom-hint').textContent=touch?t.touchZoom:t.zoom;
  $('#pan-hint').textContent=state.selectedId?t.tracking:(touch?t.touchPan:t.pan);
  $('#mobile-hint').textContent=touch?t.touchHint:`${t.rotate} · ${t.zoom}`;
  stage.setAttribute('aria-label',touch?t.touchHint:t.sceneLabel);
  renderer.domElement.setAttribute('aria-label',t.appLabel);
}

function applyLanguage(language) {
  state.language=language;
  const t=textFor(language),selected=state.selectedId?bodies.get(state.selectedId)?.data:null;
  document.documentElement.lang=language;
  document.title=t.title;
  document.querySelector('meta[name="description"]').content=t.description;
  $('#app').setAttribute('aria-label',t.appLabel);stage.setAttribute('aria-label',t.sceneLabel);
  renderer.domElement.setAttribute('aria-label',t.canvasLabel);labelLayer.setAttribute('aria-label',t.labelsLabel);
  $('.brand').setAttribute('aria-label',t.homeLabel);$('.explorer').setAttribute('aria-label',t.explorerLabel);
  $('.source-link').setAttribute('aria-label',t.sourceLabel);$('.source-link').title=t.sourceTitle;
  $('#body-nav').setAttribute('aria-label',t.navLabel);$('.toolbar').setAttribute('aria-label',t.toolbarLabel);
  $('#speed-options').setAttribute('aria-label',t.speedAria);
  $('#edition').textContent=t.edition;$('#scene-eyebrow').textContent=t.sceneEyebrow;
  $('#scene-title').textContent=t.sceneTitle;$('#scene-caption').textContent=t.sceneCaption;
  $('#nav-title').textContent=t.selectBody;$('#nav-count').textContent=t.bodyCount;
  $('#rotate-hint').textContent=t.rotate;$('#zoom-hint').textContent=t.zoom;
  $('#speed-label').textContent=t.speed;$('#orbits-label').textContent=t.orbits;
  $('#labels-label').textContent=t.labels;$('#reset-label').textContent=t.reset;
  $('#reset-view').title=t.resetTitle;$('#play-toggle').title=t.playTitle;
  $('#play-toggle').setAttribute('aria-label',simulation.paused?t.play:t.pause);
  $('#elapsed-prefix').textContent=t.elapsed;$('#elapsed-unit').textContent=t.earthYears;
  $('#scale-note').textContent=t.scaleNote;$('#footer-note').textContent=t.footer;
  $('#error h2').textContent=t.errorTitle;$('#error button').textContent=t.retry;
  for (const view of bodies.values()) {
    const name=bodyName(view.data,language);
    view.label.textContent=name;view.label.setAttribute('aria-label',t.exploreBody(name));
    view.nav.children[1].textContent=name;
  }
  for (const button of $('#language-switch').querySelectorAll('[data-language]')) button.setAttribute('aria-pressed',String(button.dataset.language===language));
  updateTimeScale();updateInfo(selected);scheduleResize();
  try { localStorage.setItem('solar-atlas-language',language); } catch {}
}
$('#language-switch').addEventListener('click',event=>{
  const button=event.target.closest('[data-language]');
  if (button&&button.dataset.language!==state.language) applyLanguage(button.dataset.language);
});
function beginCameraMove(offset) {
  // Flush residual damping before starting a camera move.
  controls.enableDamping=false;controls.update();controls.enableDamping=true;
  cameraTransition={fromPosition:camera.position.clone(),fromTarget:controls.target.clone(),offset,elapsed:0,duration:reduceMotion.matches?0:1.15};
}
function selectBody(id) {
  const view=bodies.get(id);if (!view) return;
  mobileUI.close();
  state.selectedId=id;controls.enablePan=false;
  controls.minDistance=view.data.radius*1.65;
  view.root.getWorldPosition(followPosition);lastFollowPosition.copy(followPosition);
  // Start on the illuminated side, offset enough to show the day/night boundary.
  const direction=followPosition.clone().negate().normalize().multiplyScalar(1.6).add(new THREE.Vector3(.2,.75,.6)).normalize();
  if (view.data.ring) {
    const normal=new THREE.Vector3(0,1,0).applyQuaternion(view.axis.quaternion);
    const alignment=direction.dot(normal);
    // Approach above the rings so their structure is visible on first selection.
    if (alignment<.45) direction.addScaledVector(normal,.65-alignment).normalize();
  }
  const visibleRadius=view.data.ring?view.data.radius*2.35:view.data.radius;
  const distance=(id==='earth'?8.5:id==='moon'?2.5:visibleRadius*5.6)*focusScale;
  beginCameraMove(direction.multiplyScalar(distance));updateInfo(view.data);
}
function resetView() {
  state.selectedId=null;controls.enablePan=true;controls.minDistance=4.5;
  beginCameraMove(new THREE.Vector3(.12,.72,1).normalize().multiplyScalar(overviewDistance()));
  updateInfo(null);
}
$('#reset-view').addEventListener('click',resetView);
$('#body-nav').addEventListener('click',event=>{
  const button=event.target.closest('[data-body]');if (button) selectBody(button.dataset.body);
});
labelLayer.addEventListener('click',event=>{
  // Pointer selection is handled below; retain native keyboard activation.
  const button=event.target.closest('[data-body]');if (button && event.detail===0) selectBody(button.dataset.body);
});
document.addEventListener('keydown',event=>{
  if ($('#mobile-sheet').open) return;
  if (event.repeat||event.ctrlKey||event.metaKey||event.altKey) return;
  const editing=event.target.closest('input,textarea,select,[contenteditable="true"]');
  if (editing) return;
  if (event.code==='Escape') {event.preventDefault();resetView();}
  if (event.code==='Space'&&!event.target.closest('button,a')) {event.preventDefault();togglePlayback();}
});

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function pickBody(event) {
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  return raycaster.intersectObjects(clickable,false)[0]?.object.userData.bodyId??null;
}
stage.addEventListener('pointerdown',event=>{
  if (controls.enabled) tapTracker.down(event,event.target.closest('[data-body]')?.dataset.body??null);
});
stage.addEventListener('pointermove',event=>{
  tapTracker.move(event);
  if (event.pointerType==='mouse'&&!event.buttons) stage.classList.toggle('is-hovering',Boolean(pickBody(event)));
});
stage.addEventListener('pointerup',event=>{
  const tap=tapTracker.up(event);if(!tap || !controls.enabled) return;
  const id=tap.bodyId??pickBody(event);if (id) selectBody(id);
});
stage.addEventListener('pointercancel',event=>{tapTracker.cancel(event);stage.classList.remove('is-dragging');});
stage.addEventListener('lostpointercapture',event=>tapTracker.cancel(event));
stage.addEventListener('pointerleave',()=>stage.classList.remove('is-hovering'));
controls.addEventListener('start',()=>{
  stage.classList.add('is-dragging');
  if (cameraTransition&&state.selectedId) {
    bodies.get(state.selectedId).root.getWorldPosition(followPosition);
    camera.position.add(followDelta.copy(followPosition).sub(controls.target));
    controls.target.copy(followPosition);lastFollowPosition.copy(followPosition);
  }
  cameraTransition=null;
});
controls.addEventListener('end',()=>stage.classList.remove('is-dragging'));
function updateCamera(delta) {
  if (state.selectedId) bodies.get(state.selectedId).root.getWorldPosition(followPosition);
  else followPosition.set(0,0,0);
  if (cameraTransition) {
    const move=cameraTransition;move.elapsed+=delta;
    const t=move.duration===0?1:Math.min(move.elapsed/move.duration,1);
    const eased=t*t*(3-2*t);
    camera.position.lerpVectors(move.fromPosition,world.copy(followPosition).add(move.offset),eased);
    controls.target.lerpVectors(move.fromTarget,followPosition,eased);
    if (t===1) cameraTransition=null;
  } else if (state.selectedId) {
    camera.position.add(followDelta.copy(followPosition).sub(lastFollowPosition));
    controls.target.copy(followPosition);
  }
  lastFollowPosition.copy(followPosition);
}

let previousTime=null;
document.addEventListener('visibilitychange',()=>{previousTime=null;tapTracker.clear();});
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function updateLabels(delta) {
  if (!state.labelsVisible) return;
  if ($('#mobile-sheet').open) return;
  const headerRect=$('.masthead').getBoundingClientRect(),toolbarRect=$(mobile?'#mobile-dock':'.bottom-ui').getBoundingClientRect();
  const occupied=[headerRect,toolbarRect];
  if (!mobile) occupied.push($('.explorer').getBoundingClientRect());
  const {width:screenWidth,height:screenHeight}=viewport;
  const candidates=[];
  for (const body of bodies.values()) {
    body.root.getWorldPosition(world);
    const distance=camera.position.distanceTo(world);
    projected.copy(world).project(camera);
    const pixelRadius=body.data.radius*screenHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*distance);
    const x=(projected.x*.5+.5)*screenWidth,y=(-projected.y*.5+.5)*screenHeight;
    const onScreen=projected.z>-1&&projected.z<1&&x>=0&&x<=screenWidth&&y>=0&&y<=screenHeight;
    // Measure the rendered text: English names do not have Japanese widths.
    candidates.push({body,x,y,radius:pixelRadius,distance,onScreen,width:body.label.offsetWidth,height:body.label.offsetHeight});
  }
  // Keep data order for collision priority. Camera distance used to reshuffle
  // the priority every frame and make neighboring labels swap places.
  candidates.sort((a,b)=>(b.body.data.id===state.selectedId)-(a.body.data.id===state.selectedId));
  for (const candidate of candidates) {
    const {body,x,y,radius,distance,width,height,onScreen}=candidate;
    if (!onScreen) {
      body.label.classList.add('is-muted');
      body.labelVisibility.visible=false;body.labelVisibility.pendingSeconds=0;
      continue;
    }
    const anchor=labelAnchor({x,y,radius,width,isMoon:body.data.id==='moon'});
    const box={x:anchor.x-width/2,y:anchor.y-height/2,width,height};
    const occluded=candidates.some(other=>other!==candidate&&other.onScreen&&other.distance<distance&&Math.hypot(other.x-x,other.y-y)<other.radius*.86);
    const blocked=box.x<8||box.x+width>screenWidth-8||box.y<headerRect.bottom+8||box.y+height>screenHeight-20
      ||occupied.some(other=>overlaps(box,other))
      ||candidates.some(other=>other!==candidate&&other.onScreen&&Math.hypot(other.x-anchor.x,other.y-anchor.y)<other.radius+10);
    const wantsVisible=!occluded&&!blocked;
    if (wantsVisible) occupied.push(box);
    const visible=updateLabelVisibility(body.labelVisibility,wantsVisible,delta);
    body.label.style.left=`${anchor.x}px`;body.label.style.top=`${anchor.y}px`;
    body.label.classList.toggle('is-muted',!visible);
  }
}
function animate(time) {
  const delta=previousTime===null?0:Math.min((time-previousTime)/1000,.1);previousTime=time;
  if (!document.hidden) advanceSimulation(simulation,delta);
  for (const body of bodies.values()) {
    const position=localPosition(body.data,simulation.elapsedSeconds);
    body.root.position.set(position.x,position.y,position.z);
    body.mesh.rotation.y=spinAngle(body.data,simulation.elapsedSeconds);
  }
  updateCamera(delta);controls.update();
  renderer.render(scene,camera);updateLabels(delta);
  $('#elapsed-years').textContent=(simulation.elapsedSeconds/EARTH_YEAR_SECONDS).toFixed(2);
}
renderer.setAnimationLoop(animate);
applyLanguage(state.language);
$('#loading').hidden=true;

renderer.domElement.addEventListener('webglcontextlost',event=>{
  mobileUI.close();
  event.preventDefault();renderer.setAnimationLoop(null);
  $('#error-message').textContent=state.language==='ja'?'3D描画が中断されました。ページをもう一度読み込んでください。':'3D rendering was interrupted. Please reload the page.';
  $('#error').hidden=false;
});
