// ════════════════════════════════════════════════════════
//  PingPong — LOD/Culling Research Sandbox
//  game.js — Full modular game logic
// ════════════════════════════════════════════════════════

// ═══════════════════════════════════════════
//  RESEARCH CONFIGURATION
// ═══════════════════════════════════════════
const CFG = {
  useFrustumCulling: false,
  useLOD: false,
  numEnemies: 3,
  numSpecs: 22,
  numParticlesPerHit: 10,
  lodDist1: 5,
  lodDist2: 12,
};

// ─── Greyscale palette (research / neutral) ───
const G = {
  bg:        0x111111,
  floor:     0x1a1a1a,
  grid:      0x222222,
  wall:      0x181818,
  table:     0x2a2a2a,
  tableTop:  0x1a6b2a,
  tableLine: 0xffffff,
  net:       0xffffff,
  leg:       0x3a3a3a,
  ball:      0xffffff,
  trail:     0xaaaaaa,
  lod0:      0xffffff,
  lod1:      0x888888,
  lod2:      0x444444,
  skin:      0x999999,
  hair:      0x444444,
  shirt:     0x555555,
  pants:     0x333333,
  shoe:      0x222222,
  paddle:    0x777777,
};

// ═══════════════════════════════════════════
//  RENDERER + SCENE
// ═══════════════════════════════════════════
const scene    = new THREE.Scene();
scene.background = new THREE.Color(G.bg);
scene.fog        = new THREE.Fog(G.bg, 30, 70);

const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.05, 120);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ─── Lights ───
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(8, 18, 8); sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-25; sun.shadow.camera.right=25;
sun.shadow.camera.top=25; sun.shadow.camera.bottom=-25; sun.shadow.camera.far=60;
scene.add(sun);
scene.add(new THREE.AmbientLight(0x606060, 0.8));
const fillL = new THREE.DirectionalLight(0xffffff, 0.2);
fillL.position.set(-6,4,-8); scene.add(fillL);

// ─── Frustum for manual culling ───
const frustum = new THREE.Frustum();
const frustumMatrix = new THREE.Matrix4();

// ═══════════════════════════════════════════
//  TABLE
// ═══════════════════════════════════════════
const TH_X=1.78, TH_Z=0.99, TY=0.793, NH=0.925;
const ROOM=22;

let tableTopMat = null, tableNetMat = null, tableLineMats = [];

function mkTable(){
  const g = new THREE.Group();
  const TW=TH_X*2, TD=TH_Z*2;
  tableTopMat = new THREE.MeshStandardMaterial({color:G.tableTop, roughness:0.6});
  const top = new THREE.Mesh(new THREE.BoxGeometry(TW,0.06,TD), tableTopMat);
  top.position.y=0.76; top.castShadow=true; top.receiveShadow=true; g.add(top);

  tableLineMats = [];
  function ln(w,d,x,z){
    const mat = new THREE.MeshBasicMaterial({color:G.tableLine});
    tableLineMats.push(mat);
    const l=new THREE.Mesh(new THREE.BoxGeometry(w,0.006,d), mat);
    l.position.set(x,0.796,z); g.add(l);
  }
  ln(TH_X*2,0.02,0,0); ln(0.02,TH_Z*2,0,0);
  ln(0.02,TH_Z*2,-TH_X,0); ln(0.02,TH_Z*2,TH_X,0);
  ln(TH_X*2,0.02,0,-TH_Z); ln(TH_X*2,0.02,0,TH_Z);

  const lm = new THREE.MeshStandardMaterial({color:G.leg, roughness:0.8});
  for(let lx of[-TH_X*0.87,TH_X*0.87])for(let lz of[-TH_Z*0.79,TH_Z*0.79]){
    const l=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.76,8),lm);
    l.position.set(lx,0.38,lz); l.castShadow=true; g.add(l);
  }
  for(let pz of[-TH_Z-0.1,TH_Z+0.1]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.2,8),
      new THREE.MeshStandardMaterial({color:G.leg}));
    p.position.set(0,0.87,pz); g.add(p);
  }
  tableNetMat = new THREE.MeshBasicMaterial({color:G.net,transparent:true,opacity:0.7,side:THREE.DoubleSide});
  const net=new THREE.Mesh(new THREE.PlaneGeometry(0.15,TH_Z*2+0.18), tableNetMat);
  net.rotation.y=Math.PI/2; net.position.set(0,0.865,0); g.add(net);
  return g;
}
scene.add(mkTable());

// ─── Environment ───
const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),
  new THREE.MeshStandardMaterial({color:G.floor,roughness:0.95}));
floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
scene.add(new THREE.GridHelper(60,40,G.grid,G.grid));

function mkWall(w,h,d,x,y,z){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
    new THREE.MeshStandardMaterial({color:G.wall,roughness:0.9}));
  m.position.set(x,y,z); m.receiveShadow=true; scene.add(m);
}
mkWall(ROOM*2,7,0.4,0,3.5,-ROOM); mkWall(ROOM*2,7,0.4,0,3.5,ROOM);
mkWall(0.4,7,ROOM*2,-ROOM,3.5,0); mkWall(0.4,7,ROOM*2,ROOM,3.5,0);

// ═══════════════════════════════════════════
//  SHARED MATERIALS
// ═══════════════════════════════════════════
const MAT_SK  = new THREE.MeshStandardMaterial({color:0xf4c07a, roughness:0.7});
const MAT_SH  = new THREE.MeshStandardMaterial({color:0x1565c0, roughness:0.5});
const MAT_PA  = new THREE.MeshStandardMaterial({color:0x0c3b85, roughness:0.6});
const MAT_SHO = new THREE.MeshStandardMaterial({color:0x111111, roughness:0.3, metalness:0.4});
const MAT_HA  = new THREE.MeshStandardMaterial({color:0x111111, roughness:0.9});
const MAT_NOSE= new THREE.MeshStandardMaterial({color:0xd49060, roughness:0.8});
const MAT_WHT = new THREE.MeshStandardMaterial({color:0xffffff});
const MAT_BLK = new THREE.MeshStandardMaterial({color:0x050505});
const MAT_RF  = new THREE.MeshStandardMaterial({color:0xe53935, roughness:0.25, side:THREE.DoubleSide});
const MAT_RB  = new THREE.MeshStandardMaterial({color:0x111111, roughness:0.4,  side:THREE.DoubleSide});
const MAT_RR  = new THREE.MeshStandardMaterial({color:0x1a1a1a, roughness:0.3,  metalness:0.6});
const MAT_RW  = new THREE.MeshStandardMaterial({color:0x5d4037, roughness:0.7});
const MAT_GRP = new THREE.MeshStandardMaterial({color:0x3e2723, roughness:0.8});
const MAT_STR = new THREE.MeshStandardMaterial({color:0x90caf9, roughness:0.5, transparent:true, opacity:0.6});
const MAT_SH_CPU = new THREE.MeshStandardMaterial({color:0xb71c1c, roughness:0.5});

// ─── Mesh helper shortcuts ───
function Bx(w,h,d,mat,cast=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);if(cast)m.castShadow=true;return m;}
function Sp(r,mat,s=16){const m=new THREE.Mesh(new THREE.SphereGeometry(r,s,s),mat);m.castShadow=true;return m;}
function Cy(rt,rb,h,mat,s=10){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s),mat);m.castShadow=true;return m;}

// ═══════════════════════════════════════════
//  RACKET BUILDER
// ═══════════════════════════════════════════
function buildRacket(shirtMat){
  const root=new THREE.Group();
  root.position.y=-0.50;
  root.rotation.x=-Math.PI*0.5;

  const gripM=Cy(0.060,0.060,0.16,MAT_GRP,10); gripM.position.y=-0.08; root.add(gripM);
  const handleM=Cy(0.042,0.050,0.22,MAT_RW,10); handleM.position.y=-0.26; root.add(handleM);
  const neckConn=Cy(0.055,0.042,0.09,MAT_RW,10); neckConn.position.y=-0.42; root.add(neckConn);

  const faceGrp=new THREE.Group(); faceGrp.position.y=-0.55; root.add(faceGrp);
  const rimM=new THREE.Mesh(new THREE.TorusGeometry(0.26,0.028,12,40),MAT_RR);
  rimM.castShadow=true; rimM.scale.set(0.88,1,1); faceGrp.add(rimM);
  const fFront=new THREE.Mesh(new THREE.CircleGeometry(0.245,36),MAT_RF);
  fFront.position.z=0.015; fFront.scale.set(0.88,1,1); faceGrp.add(fFront);
  const fBack=new THREE.Mesh(new THREE.CircleGeometry(0.245,36),MAT_RB);
  fBack.position.z=-0.015; fBack.scale.set(0.88,1,1); faceGrp.add(fBack);
  for(let i=-3;i<=3;i++){
    const sv=Cy(0.005,0.005,0.46,MAT_STR,4); sv.position.set(i*0.065,0,0); faceGrp.add(sv);
    const sh=Cy(0.005,0.005,0.40,MAT_STR,4); sh.rotation.z=Math.PI/2; sh.position.set(0,i*0.060,0); faceGrp.add(sh);
  }
  return root;
}

// ═══════════════════════════════════════════
//  LOD CHARACTER BUILDERS
// ═══════════════════════════════════════════
function buildHumanLOD0(shirtMat){
  shirtMat = shirtMat || MAT_SH;
  const g=new THREE.Group();

  const pelvis=new THREE.Group(); pelvis.position.y=0.55; g.add(pelvis);
  const tP=new THREE.Group(); tP.position.set(0,0.46,0); pelvis.add(tP);
  const torsoMesh=Bx(0.38,0.46,0.22,shirtMat); tP.add(torsoMesh);

  const neckM=Cy(0.055,0.055,0.10,MAT_SK,8); neckM.position.y=0.26; tP.add(neckM);
  const headPiv=new THREE.Group(); headPiv.position.y=0.31; neckM.add(headPiv);
  const headM=Sp(0.17,MAT_SK,14); headPiv.add(headM);
  const hairGeo=new THREE.SphereGeometry(0.177,16,16,0,Math.PI*2,0,Math.PI*0.52);
  headPiv.add(new THREE.Mesh(hairGeo,MAT_HA));
  [[-0.06,0.01,0.15],[0.06,0.01,0.15]].forEach(([x,y,z])=>{
    const ew=Sp(0.030,MAT_WHT,8); ew.position.set(x,y,z); headPiv.add(ew);
    const ep=Sp(0.017,MAT_BLK,6); ep.position.set(x,y,z+0.02); headPiv.add(ep);
  });
  const noseM=Sp(0.023,MAT_NOSE,6); noseM.position.set(0,-0.035,0.165); headPiv.add(noseM);

  const rSh=new THREE.Group(); rSh.position.set(0.225,0.18,0); tP.add(rSh);
  const rUA=Bx(0.10,0.24,0.10,shirtMat); rUA.position.y=-0.12; rSh.add(rUA);
  const rEl=new THREE.Group(); rEl.position.y=-0.24; rSh.add(rEl);
  const rFA=Bx(0.088,0.22,0.088,MAT_SK); rFA.position.y=-0.11; rEl.add(rFA);
  const rHnd=Sp(0.055,MAT_SK,8); rHnd.position.y=-0.23; rEl.add(rHnd);

  const lSh=new THREE.Group(); lSh.position.set(-0.225,0.18,0); tP.add(lSh);
  const lUA=Bx(0.10,0.24,0.10,shirtMat); lUA.position.y=-0.12; lSh.add(lUA);
  const lEl=new THREE.Group(); lEl.position.y=-0.24; lSh.add(lEl);
  const lFA=Bx(0.088,0.22,0.088,MAT_SK); lFA.position.y=-0.11; lEl.add(lFA);
  const lHnd=Sp(0.055,MAT_SK,8); lHnd.position.y=-0.23; lEl.add(lHnd);

  const hipPivots=[], kneePivots=[], anklePivots=[];
  for(let s of[-1,1]){
    const hip=new THREE.Group(); hip.position.set(s*0.10,0,0); pelvis.add(hip);
    const thigh=Bx(0.12,0.32,0.12,MAT_PA); thigh.position.y=-0.16; hip.add(thigh);
    const kn=new THREE.Group(); kn.position.y=-0.32; hip.add(kn);
    const shin=Bx(0.10,0.30,0.10,MAT_PA); shin.position.y=-0.15; kn.add(shin);
    const an=new THREE.Group(); an.position.y=-0.30; kn.add(an);
    const shoe=Bx(0.13,0.06,0.22,MAT_SHO); shoe.position.set(0,-0.03,0.04); an.add(shoe);
    hipPivots.push(hip); kneePivots.push(kn); anklePivots.push(an);
  }

  return{
    group:g, head:headM, headPiv, torsoPivot:tP, pelvis,
    rShoulder:rSh, rElbow:rEl, lShoulder:lSh, lElbow:lEl,
    hipPivots, kneePivots, anklePivots, lodLevel:0
  };
}

function buildHumanLOD1(shirtMat){
  shirtMat = shirtMat || MAT_SH;
  const g=new THREE.Group();
  function mk(geo,mat){const m=new THREE.Mesh(geo,mat);m.castShadow=false;return m;}
  const head=mk(new THREE.SphereGeometry(0.15,5,5),MAT_SK); head.position.set(0,1.73,0); g.add(head);
  const body=mk(new THREE.CylinderGeometry(0.13,0.15,0.85,5),shirtMat); body.position.set(0,1.12,0); g.add(body);
  const rArm=mk(new THREE.CylinderGeometry(0.05,0.04,0.55,5),MAT_SK); rArm.position.set(0.22,1.2,0); rArm.rotation.z=0.3; g.add(rArm);
  const lArm=mk(new THREE.CylinderGeometry(0.05,0.04,0.55,5),MAT_SK); lArm.position.set(-0.22,1.2,0); lArm.rotation.z=-0.3; g.add(lArm);
  const rLeg=mk(new THREE.CylinderGeometry(0.07,0.05,0.82,5),MAT_PA); rLeg.position.set(0.10,0.41,0); g.add(rLeg);
  const lLeg=mk(new THREE.CylinderGeometry(0.07,0.05,0.82,5),MAT_PA); lLeg.position.set(-0.10,0.41,0); g.add(lLeg);
  return{group:g, head, torsoPivot:g, rShoulder:null,rElbow:null,lShoulder:null,lElbow:null, hipPivots:[],kneePivots:[],anklePivots:[], lodLevel:1};
}

function buildHumanLOD2(shirtMat){
  shirtMat = shirtMat || MAT_SH;
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,1.8,4),shirtMat); body.position.set(0,0.9,0); g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.15,4,4),MAT_SK); head.position.set(0,1.8,0); g.add(head);
  return{group:g, head, torsoPivot:g, rShoulder:null,rElbow:null,lShoulder:null,lElbow:null, hipPivots:[],kneePivots:[],anklePivots:[], lodLevel:2};
}

// ═══════════════════════════════════════════
//  PLAYER (LOD0, blue shirt)
// ═══════════════════════════════════════════
const pRig = buildHumanLOD0(MAT_SH);
const playerBody = pRig.group;
playerBody.position.set(-3,0,0);
scene.add(playerBody);

const camPivot=new THREE.Object3D(); playerBody.add(camPivot);
camPivot.position.set(0,1.35,0);
const camYaw=new THREE.Object3D(), camPitch=new THREE.Object3D();
camPivot.add(camYaw); camYaw.add(camPitch); camPitch.add(camera);
camera.position.set(0,0.05,0.01);

const pRacket = buildRacket(MAT_SH);
if(pRig.rElbow) pRig.rElbow.add(pRacket);
pRacket.userData.baseRotX = -Math.PI * 0.5;

// ═══════════════════════════════════════════
//  MULTI-ENEMY SYSTEM
// ═══════════════════════════════════════════
const ENEMY_NAMES=['ROOKIE','SAM','VINCE','TINA','LEO','KAI','ZOE','REX',
  'ACE','NOVA','BOLT','GRIT','HAZE','FLUX','DRIFT','ECHO',
  'RIFT','SORA','IVAN','MIKA','ZARA','PIKE','DUKE','LENA','CASS'];

let cpuAgents = [];

function buildCpuAgent(idx, totalCpus){
  const zOff = (idx - (totalCpus-1)/2) * 1.1;
  const xPos = TH_X + 0.8;

  const rig0 = buildHumanLOD0(MAT_SH_CPU);
  const rig1 = buildHumanLOD1(MAT_SH_CPU);
  const rig2 = buildHumanLOD2(MAT_SH_CPU);

  rig0.group.rotation.y = 0;
  rig1.group.rotation.y = 0;
  rig2.group.rotation.y = 0;

  rig0.group.position.set(xPos, 0, zOff);
  rig1.group.position.set(xPos, 0, zOff);
  rig2.group.position.set(xPos, 0, zOff);

  scene.add(rig0.group);
  rig1.group.visible = false; scene.add(rig1.group);
  rig2.group.visible = false; scene.add(rig2.group);

  const cpuRacket = buildRacket(MAT_SH_CPU);
  cpuRacket.userData.baseRotX = -Math.PI * 0.5;
  if(rig0.rElbow) rig0.rElbow.add(cpuRacket);

  return {
    idx, name: ENEMY_NAMES[idx % ENEMY_NAMES.length],
    rig0, rig1, rig2,
    currentRig: rig0, currentLod: 0, racket: cpuRacket,
    xPos, zOff, paddleZ: zOff,
    speed: 2.5 + Math.random()*2.0,
    reactionDelay: 0.05 + Math.random()*0.2,
    missChance: 0.05 + Math.random()*0.2,
    hitSpeedX: 2.0 + Math.random()*1.5,
    swingTimer: 0, hitAnimTimer: 0, reachAnim: 0,
    pendingZ: 0, delayTimer: 0,
    idlePhase: Math.random()*Math.PI*2,
    isCulled: false, lodLevel: 0,
  };
}

function rebuildScene(){
  for(const a of cpuAgents){
    scene.remove(a.rig0.group);
    scene.remove(a.rig1.group);
    scene.remove(a.rig2.group);
  }
  cpuAgents = [];
  for(let i=0; i<CFG.numEnemies; i++) cpuAgents.push(buildCpuAgent(i, CFG.numEnemies));
  rebuildSpectators();
  document.getElementById('m-en').textContent = CFG.numEnemies;
  document.getElementById('enemy-name').textContent = `${CFG.numEnemies} enemies`;
}

// ═══════════════════════════════════════════
//  SPECTATORS
// ═══════════════════════════════════════════
let spectatorGroups = [];

function buildSpec(){
  const g=new THREE.Group();
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.2,6,6),MAT_SK); head.position.set(0,1.45,0); g.add(head);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2,0.55,6),MAT_SH); body.position.set(0,1.0,0); g.add(body);
  const la=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.045,0.4,5),MAT_SK); la.position.set(-0.22,1.15,0); g.add(la);
  const ra=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.045,0.4,5),MAT_SK); ra.position.set( 0.22,1.15,0); g.add(ra);
  return{g,la,ra};
}

function rebuildSpectators(){
  for(const s of spectatorGroups) scene.remove(s.g);
  spectatorGroups = [];
  const n = CFG.numSpecs;
  const leftCount  = Math.ceil(n / 2);
  const rightCount = Math.floor(n / 2);
  for(let side of [-1, 1]){
    const count = side === -1 ? leftCount : rightCount;
    const gap = 1.2;
    const totalSpread = (count - 1) * gap;
    for(let i = 0; i < count; i++){
      const {g,la,ra}=buildSpec();
      const z = count > 1 ? -totalSpread/2 + i * gap : 0;
      const depthOff = (i % 2 === 0) ? 0 : 0.6;
      g.position.set(side*(ROOM-1.5 - depthOff), 0, z);
      g.rotation.y = side < 0 ? Math.PI/2 : -Math.PI/2;
      g.userData = {bob: Math.random()*Math.PI*2, la, ra, isCulled:false, cheerTimer:0, cheerPhase: Math.random()*Math.PI*2};
      scene.add(g);
      spectatorGroups.push({g,la,ra,isCulled:false});
    }
  }
  document.getElementById('m-sp').textContent = spectatorGroups.length;
}

// ═══════════════════════════════════════════
//  BALL + TRAIL + PARTICLES
// ═══════════════════════════════════════════
const BR=0.04;
const ballMesh=new THREE.Mesh(
  new THREE.SphereGeometry(BR,10,10),
  new THREE.MeshStandardMaterial({color:G.ball,roughness:0.3,emissive:0xffffff,emissiveIntensity:0.25})
);
ballMesh.castShadow=true; scene.add(ballMesh);
const ballLight=new THREE.PointLight(0xffffff,0.4,1.5); scene.add(ballLight);

const TRL=14; const trMeshes=[];
const trMat=new THREE.MeshBasicMaterial({color:G.trail,transparent:true,opacity:0});
for(let i=0;i<TRL;i++){
  const t=new THREE.Mesh(new THREE.SphereGeometry(0.013,4,4),trMat.clone());
  scene.add(t); trMeshes.push(t);
}
const trPos=[];

const parts=[];
const PG=new THREE.SphereGeometry(0.02,3,3);
function spark(pos,n=8){
  if(!CFG.numParticlesPerHit) return;
  const realN = Math.round(n * CFG.numParticlesPerHit / 10);
  for(let i=0;i<realN;i++){
    const m=new THREE.Mesh(PG,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1}));
    m.position.copy(pos);
    const a=Math.random()*Math.PI*2, sp=0.5+Math.random();
    scene.add(m);
    parts.push({mesh:m,vel:new THREE.Vector3(Math.cos(a)*sp*0.4,0.2+Math.random()*0.7,Math.sin(a)*sp*0.4),life:1});
  }
}

// ═══════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════
let phase='walk', scores={you:0,cpu:0}, pointTimer=0, T=0;
let serverTurn='player', rallyCount=0;
const ball={
  pos:new THREE.Vector3(0,0.8,0), vel:new THREE.Vector3(0,0,0),
  spin:new THREE.Vector3(), active:false, netHit:false,
};
const PS={
  pos:new THREE.Vector3(-3,0,0), yaw:0, pitch:0, speed:4,
  swingTimer:0, atTable:false, spaceHeld:false,
  walkPhase:0, moving:false,
  chargeTime:0, charging:false,
};

// ═══════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════
let pLocked=false;
renderer.domElement.addEventListener('click',()=>renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange',()=>pLocked=document.pointerLockElement===renderer.domElement);
document.addEventListener('mousemove',e=>{
  if(!pLocked)return;
  PS.yaw  -=e.movementX*0.002;
  PS.pitch-=e.movementY*0.002;
  PS.pitch=Math.max(-0.7,Math.min(0.5,PS.pitch));
});
const keys={};
document.addEventListener('keydown',e=>{if(!keys[e.key])keys[e.key]=true;if(e.key===' ')e.preventDefault();});
document.addEventListener('keyup',  e=>{keys[e.key]=false;});

const statusEl=document.getElementById('status'), hintEl=document.getElementById('hint');
function showStatus(txt,ms=1400){
  statusEl.textContent=txt; statusEl.style.opacity=1;
  clearTimeout(statusEl._t); statusEl._t=setTimeout(()=>statusEl.style.opacity=0,ms);
}

// ═══════════════════════════════════════════
//  SANDBOX CONTROL FUNCTIONS
// ═══════════════════════════════════════════
function toggleFC(){
  CFG.useFrustumCulling = !CFG.useFrustumCulling;
  const btn = document.getElementById('btn-fc');
  btn.textContent = CFG.useFrustumCulling ? 'ON' : 'OFF';
  btn.className = CFG.useFrustumCulling ? 'ctrl-btn active' : 'ctrl-btn';
  document.getElementById('badge-fc').className = CFG.useFrustumCulling ? 'badge on' : 'badge off';
  document.getElementById('badge-fc').textContent = 'Frustum Culling: ' + (CFG.useFrustumCulling?'ON':'OFF');
  updateBaselineBadge();
  showStatus(CFG.useFrustumCulling ? '✓ FRUSTUM CULLING ON' : '✗ FRUSTUM CULLING OFF', 1200);
}

function toggleLOD(){
  CFG.useLOD = !CFG.useLOD;
  const btn = document.getElementById('btn-lod');
  btn.textContent = CFG.useLOD ? 'ON' : 'OFF';
  btn.className = CFG.useLOD ? 'ctrl-btn active' : 'ctrl-btn';
  document.getElementById('badge-lod').className = CFG.useLOD ? 'badge on' : 'badge off';
  document.getElementById('badge-lod').textContent = 'LOD: ' + (CFG.useLOD?'ON':'OFF');
  updateBaselineBadge();
  if(!CFG.useLOD){ for(const a of cpuAgents) switchAgentLOD(a, 0); }
  showStatus(CFG.useLOD ? '✓ LOD SYSTEM ON' : '✗ LOD SYSTEM OFF', 1200);
}

let colorMode = true;
const COLORS_ON = {
  skin:0xf4c07a, hair:0x111111, shirtPlayer:0x1565c0, shirtCpu:0xb71c1c,
  pants:0x0c3b85, shoe:0x111111, racketFront:0xe53935, racketBack:0x111111,
  racketWood:0x5d4037, racketGrip:0x3e2723, specBody:0x1565c0,
  tableTop:0x1a6b2a, tableLine:0xffffff, net:0xffffff,
  floor:0x1a1a1a, bg:0x111111
};
const COLORS_OFF = {
  skin:0x999999, hair:0x444444, shirtPlayer:0x555555, shirtCpu:0x555555,
  pants:0x333333, shoe:0x222222, racketFront:0x888888, racketBack:0x222222,
  racketWood:0x555555, racketGrip:0x333333, specBody:0x555555,
  tableTop:0x333333, tableLine:0x555555, net:0x666666,
  floor:0x1a1a1a, bg:0x111111
};

function toggleColor(){
  colorMode = !colorMode;
  const btn = document.getElementById('btn-color');
  btn.textContent = colorMode ? 'ON' : 'OFF';
  btn.className = colorMode ? 'ctrl-btn active' : 'ctrl-btn';
  const C = colorMode ? COLORS_ON : COLORS_OFF;
  MAT_SK.color.setHex(C.skin);
  MAT_HA.color.setHex(C.hair);
  MAT_SH.color.setHex(C.shirtPlayer);
  MAT_SH_CPU.color.setHex(C.shirtCpu);
  MAT_PA.color.setHex(C.pants);
  MAT_SHO.color.setHex(C.shoe);
  MAT_RF.color.setHex(C.racketFront);
  MAT_RB.color.setHex(C.racketBack);
  MAT_RW.color.setHex(C.racketWood);
  MAT_GRP.color.setHex(C.racketGrip);
  if(tableTopMat) tableTopMat.color.setHex(C.tableTop);
  if(tableNetMat) tableNetMat.color.setHex(C.net);
  tableLineMats.forEach(m=>m.color.setHex(C.tableLine));
  showStatus(colorMode ? '🎨 COLOR ON' : '⬜ GREYSCALE', 1000);
}

function updateSliders(){
  CFG.numEnemies    = parseInt(document.getElementById('sl-enemies').value);
  CFG.numSpecs      = parseInt(document.getElementById('sl-specs').value);
  CFG.numParticlesPerHit = parseInt(document.getElementById('sl-parts').value);
  CFG.lodDist1      = parseInt(document.getElementById('sl-lod1').value);
  CFG.lodDist2      = parseInt(document.getElementById('sl-lod2').value);
  document.getElementById('v-enemies').textContent = CFG.numEnemies;
  document.getElementById('v-specs').textContent   = CFG.numSpecs;
  document.getElementById('v-parts').textContent   = CFG.numParticlesPerHit;
  document.getElementById('v-lod1').textContent    = CFG.lodDist1;
  document.getElementById('v-lod2').textContent    = CFG.lodDist2;
}

function updateBaselineBadge(){
  const none = !CFG.useFrustumCulling && !CFG.useLOD;
  document.getElementById('badge-base').className = none ? 'badge on' : 'badge off';
}

// ═══════════════════════════════════════════
//  LOD SWITCHING
// ═══════════════════════════════════════════
function switchAgentLOD(agent, level){
  if(agent.currentLod === level) return;
  agent.rig0.group.visible = (level === 0);
  agent.rig1.group.visible = (level === 1);
  agent.rig2.group.visible = (level === 2);
  agent.currentRig = level===0 ? agent.rig0 : level===1 ? agent.rig1 : agent.rig2;
  agent.currentLod = level;
}

function syncAgentPositions(agent){
  const p = new THREE.Vector3(agent.xPos, 0, agent.paddleZ);
  agent.rig0.group.position.copy(p);
  agent.rig1.group.position.copy(p);
  agent.rig2.group.position.copy(p);
}

// ═══════════════════════════════════════════
//  FRUSTUM CULLING
// ═══════════════════════════════════════════
const _cullingCenter = new THREE.Vector3();

function isMeshInFrustum(group){
  _cullingCenter.setFromMatrixPosition(group.matrixWorld);
  _cullingCenter.y += 0.9;
  return frustum.containsPoint(_cullingCenter) ||
    frustum.intersectsSphere(new THREE.Sphere(_cullingCenter, 1.2));
}

// ═══════════════════════════════════════════
//  ANIMATION HELPERS
// ═══════════════════════════════════════════
function animPlayer(dt){
  const r=pRig;
  if(PS.moving) PS.walkPhase+=dt*9;
  else PS.walkPhase*=0.88;
  const wp=PS.walkPhase;
  const lv=Math.sin(wp)*0.28, rv=Math.sin(wp+Math.PI)*0.28;
  if(r.hipPivots[0]) r.hipPivots[0].rotation.x=lv;
  if(r.kneePivots[0]) r.kneePivots[0].rotation.x=Math.max(0,-lv)*0.5;
  if(r.anklePivots[0]) r.anklePivots[0].rotation.x=lv*-0.3;
  if(r.hipPivots[1]) r.hipPivots[1].rotation.x=rv;
  if(r.kneePivots[1]) r.kneePivots[1].rotation.x=Math.max(0,-rv)*0.5;
  if(r.anklePivots[1]) r.anklePivots[1].rotation.x=rv*-0.3;
  if(r.pelvis) r.pelvis.position.y=0.55+Math.abs(Math.sin(wp))*-0.015;
  if(r.lShoulder && PS.swingTimer<=0) r.lShoulder.rotation.x=Math.sin(wp)*0.3;

  if(PS.swingTimer>0){
    PS.swingTimer=Math.max(0,PS.swingTimer-dt*5);
    const s=Math.sin(PS.swingTimer*Math.PI);
    if(r.rShoulder){ r.rShoulder.rotation.x=-0.4+s*1.4; r.rShoulder.rotation.z=-0.15; r.rShoulder.rotation.y=s*-0.2; }
    if(r.rElbow) r.rElbow.rotation.x=s<0.5?s*-0.5:0;
    if(r.torsoPivot) r.torsoPivot.rotation.y=s*0.18;
    if(r.headPiv){ r.headPiv.rotation.y=s*-0.12; r.headPiv.rotation.x=0.05; }
    if(pRacket) pRacket.rotation.x=pRacket.userData.baseRotX + s*0.22;
    if(r.lShoulder){ r.lShoulder.rotation.x=0.4-s*0.6; r.lShoulder.rotation.z=0.15; }
    if(r.lElbow) r.lElbow.rotation.x=s>0?s*-0.3:0;
  } else {
    if(r.rShoulder){ r.rShoulder.rotation.x+=(-0.4-r.rShoulder.rotation.x)*0.15; r.rShoulder.rotation.z*=0.85; r.rShoulder.rotation.y*=0.85; }
    if(r.rElbow) r.rElbow.rotation.x*=0.85;
    if(r.torsoPivot) r.torsoPivot.rotation.y*=0.85;
    if(pRacket) pRacket.rotation.x+=(pRacket.userData.baseRotX-pRacket.rotation.x)*0.15;
  }
}

function animCpuAgent(agent, dt){
  const r = agent.rig0;
  if(!r) return;
  const T_=T+agent.idlePhase;
  const moving = Math.abs(agent.reachAnim) > 0.05;
  if(moving) agent.walkPhase = (agent.walkPhase||0) + dt*9;
  else agent.walkPhase = (agent.walkPhase||0) * 0.88;
  const wp = agent.walkPhase||0;
  const lv=Math.sin(wp)*0.28, rv=Math.sin(wp+Math.PI)*0.28;
  if(r.hipPivots[0]) r.hipPivots[0].rotation.x=lv;
  if(r.kneePivots[0]) r.kneePivots[0].rotation.x=Math.max(0,-lv)*0.5;
  if(r.anklePivots[0]) r.anklePivots[0].rotation.x=lv*-0.3;
  if(r.hipPivots[1]) r.hipPivots[1].rotation.x=rv;
  if(r.kneePivots[1]) r.kneePivots[1].rotation.x=Math.max(0,-rv)*0.5;
  if(r.anklePivots[1]) r.anklePivots[1].rotation.x=rv*-0.3;
  if(r.pelvis) r.pelvis.position.y=0.55+Math.abs(Math.sin(wp))*-0.015;
  if(r.headPiv) r.headPiv.rotation.y=Math.sin(T_*1.8)*0.15 + agent.reachAnim*0.3;

  if(r.rShoulder && agent.hitAnimTimer>0){
    agent.hitAnimTimer=Math.max(0,agent.hitAnimTimer-dt*4);
    const s=Math.sin(agent.hitAnimTimer*Math.PI);
    r.rShoulder.rotation.x=-0.4+s*1.4;
    r.rShoulder.rotation.z=-0.15;
    r.rShoulder.rotation.y=s*-0.2;
    if(r.rElbow) r.rElbow.rotation.x=s<0.5?s*-0.5:0;
    if(r.torsoPivot) r.torsoPivot.rotation.y=-s*0.18;
    if(agent.racket) agent.racket.rotation.x=agent.racket.userData.baseRotX+s*0.22;
    if(r.lShoulder){ r.lShoulder.rotation.x=0.4-s*0.6; r.lShoulder.rotation.z=0.15; }
  } else {
    const reachLean = Math.max(-0.5, Math.min(0.5, agent.reachAnim * 0.6));
    if(r.rShoulder){
      r.rShoulder.rotation.x += (-0.4 + reachLean - r.rShoulder.rotation.x)*0.12;
      r.rShoulder.rotation.z *= 0.88; r.rShoulder.rotation.y *= 0.88;
    }
    if(r.rElbow) r.rElbow.rotation.x *= 0.85;
    if(r.torsoPivot) r.torsoPivot.rotation.y += (reachLean * 0.15 - r.torsoPivot.rotation.y)*0.12;
    if(agent.racket) agent.racket.rotation.x+=(agent.racket.userData.baseRotX-agent.racket.rotation.x)*0.15;
    if(r.lShoulder && agent.hitAnimTimer<=0) r.lShoulder.rotation.x=Math.sin(wp)*0.3;
  }
}

// ═══════════════════════════════════════════
//  SPECTATOR CHEER
// ═══════════════════════════════════════════
function triggerSpectatorCheer(){
  for(const spec of spectatorGroups){
    spec.g.userData.cheerTimer = 2.5 + Math.random() * 1.0;
  }
}

// ═══════════════════════════════════════════
//  GAME LOGIC
// ═══════════════════════════════════════════
function serve(fromPlayer){
  ball.pos.set(fromPlayer?-TH_X*0.7:TH_X*0.7, TY+0.25,(Math.random()-0.5)*0.2);
  ball.vel.set(fromPlayer?2.2:-2.2, 1.1,(Math.random()-0.5)*0.35);
  ball.spin.set(0,0,0); ball.netHit=false; ball.active=true;
  trPos.length=0; phase='rally'; rallyCount=0;
}
let cpuServeTimer=0;

function endPoint(who){
  ball.active=false; phase='point'; pointTimer=120;
  serverTurn = (who==='you')?'player':'cpu';
  showStatus(who==='you'?'✦ YOUR POINT ✦':'✧ CPU SCORES ✧', 1400);
  triggerSpectatorCheer();
}

function checkScore(){
  if(scores.you>=7||scores.cpu>=7){
    showStatus(scores.you>=7?'🏆 YOU WIN!':'CPU WINS', 3000);
    ball.active=false; phase='walk';
    scores={you:0,cpu:0};
    document.getElementById('s-you').textContent=0;
    document.getElementById('s-cpu').textContent=0;
  }
}

// ═══════════════════════════════════════════
//  METRICS + FPS CHART
// ═══════════════════════════════════════════
const fpsHistory = [];
const chartCtx = document.getElementById('fps-chart').getContext('2d');
let frames=0, lastFPS=performance.now(), currentFPS=0, frameTime=0;
let lastFrameTime=performance.now();

function drawFPSChart(){
  const W=200, H=50;
  chartCtx.clearRect(0,0,W,H);
  chartCtx.fillStyle='#111'; chartCtx.fillRect(0,0,W,H);
  chartCtx.strokeStyle='#333'; chartCtx.lineWidth=1;
  chartCtx.beginPath(); chartCtx.moveTo(0,H-H*60/120); chartCtx.lineTo(W,H-H*60/120); chartCtx.stroke();
  if(fpsHistory.length<2) return;
  const max=120;
  chartCtx.beginPath(); chartCtx.strokeStyle='#4f4'; chartCtx.lineWidth=1.5;
  for(let i=0;i<fpsHistory.length;i++){
    const x=i/(fpsHistory.length-1)*W;
    const y=H - (fpsHistory[i]/max)*H;
    i===0?chartCtx.moveTo(x,y):chartCtx.lineTo(x,y);
  }
  chartCtx.stroke();
}

function updateMetrics(visCount, culledCount, lodCounts){
  const info = renderer.info;
  const fps = currentFPS;
  const fpsEl = document.getElementById('fps-big');
  fpsEl.textContent = `FPS: ${fps}`;
  fpsEl.style.color = fps>=50?'#4f4':fps>=30?'#ff4':'#f44';
  document.getElementById('m-ft').textContent  = frameTime.toFixed(1)+' ms';
  document.getElementById('m-dc').textContent  = info.render.calls;
  document.getElementById('m-tri').textContent = (info.render.triangles/1000).toFixed(1)+'k';
  document.getElementById('m-vis').textContent = visCount;
  document.getElementById('m-culled').textContent = culledCount;
  document.getElementById('m-lod').textContent   = `${lodCounts[0]}H / ${lodCounts[1]}M / ${lodCounts[2]}L`;
  document.getElementById('m-ll').textContent    = `${lodCounts[0]}H / ${lodCounts[1]}M / ${lodCounts[2]}L`;
  document.getElementById('m-fc').textContent    = CFG.useFrustumCulling ? 'ON' : 'OFF';
  document.getElementById('m-fc').className      = 'mval ' + (CFG.useFrustumCulling?'green':'red');
  document.getElementById('m-la').textContent    = CFG.useLOD ? 'ON' : 'OFF';
  document.getElementById('m-la').className      = 'mval ' + (CFG.useLOD?'green':'red');
  document.getElementById('m-tot').textContent   = scene.children.length;
  const ft = document.getElementById('m-ft');
  ft.className = 'mval ' + (frameTime<16.6?'green':frameTime<33?'yellow':'red');
}

// ═══════════════════════════════════════════
//  MAIN UPDATE LOOP
// ═══════════════════════════════════════════
const clock = new THREE.Clock();
const _d = new THREE.Vector3();

function update(dt){
  T += dt;

  camera.updateMatrixWorld();
  frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(frustumMatrix);

  // ── Player movement ──
  const yaw=PS.yaw;
  _d.set(0,0,0);
  if(keys['w']||keys['W']){_d.x-=Math.sin(yaw);_d.z-=Math.cos(yaw);}
  if(keys['s']||keys['S']){_d.x+=Math.sin(yaw);_d.z+=Math.cos(yaw);}
  if(keys['a']||keys['A']){_d.x-=Math.cos(yaw);_d.z+=Math.sin(yaw);}
  if(keys['d']||keys['D']){_d.x+=Math.cos(yaw);_d.z-=Math.sin(yaw);}
  PS.moving=_d.lengthSq()>0;
  if(PS.moving){
    _d.normalize();
    let nx=PS.pos.x+_d.x*PS.speed*dt, nz=PS.pos.z+_d.z*PS.speed*dt;
    nx=Math.max(-ROOM+0.5,Math.min(ROOM-0.5,nx));
    nz=Math.max(-ROOM+0.5,Math.min(ROOM-0.5,nz));
    const B=0.5,inX=nx>-(TH_X+B)&&nx<TH_X+B,inZ=nz>-(TH_Z+B)&&nz<TH_Z+B;
    if(inX&&inZ){nx=PS.pos.x; nz=PS.pos.z;}
    PS.pos.x=nx; PS.pos.z=nz;
  }
  playerBody.position.x=PS.pos.x; playerBody.position.z=PS.pos.z;
  playerBody.rotation.y=PS.yaw; camYaw.rotation.y=0; camPitch.rotation.x=PS.pitch;

  const distToTable=Math.abs(PS.pos.x-(-TH_X-0.3));
  const inTZ=PS.pos.z>-(TH_Z+1.0)&&PS.pos.z<TH_Z+1.0;
  PS.atTable=distToTable<1.2&&inTZ&&PS.pos.x<0;

  // ── Phase logic ──
  if(phase==='walk'||phase==='serve'){
    if(serverTurn==='player'){
      hintEl.textContent=PS.atTable?'[ SPACE ] Serve!':'Walk to the left of the table';
      if(phase==='walk'&&PS.atTable){phase='serve'; showStatus('Your serve! Press SPACE',1800);}
      if(phase==='serve'&&PS.atTable&&keys[' ']){statusEl.style.opacity=0; serve(true);}
    } else {
      hintEl.textContent='CPU serving...';
      if(phase==='walk'){phase='serve'; cpuServeTimer=1.2;}
      cpuServeTimer-=dt;
      if(cpuServeTimer<=0){statusEl.style.opacity=0; serve(false);}
    }
  } else if(phase==='rally'){
    hintEl.textContent=PS.atTable?'[ SPACE ] Hit! (Hold=Power)':'Get back to the table!';
  }

  animPlayer(dt);

  // ── Charge mechanic ──
  const spNow=!!keys[' '];
  if(phase==='rally'&&PS.atTable&&spNow&&!PS.spaceHeld){PS.chargeTime=0;PS.charging=true;}
  if(PS.charging&&spNow) PS.chargeTime=Math.min(PS.chargeTime+dt,0.6);

  // ── Player hit ──
  if(phase==='rally'&&ball.active&&PS.atTable&&PS.charging&&!spNow){
    const ok=ball.pos.x<0&&Math.abs(ball.pos.z-PS.pos.z)<0.65&&ball.pos.y>TY&&ball.pos.y<TY+0.7&&ball.vel.x<=0.3;
    if(ok){
      const pw=1.0+PS.chargeTime*1.1;
      const rz=ball.pos.z-PS.pos.z;
      ball.vel.set(2.6*pw+Math.random()*0.5, 1.2+Math.random()*0.3*pw, rz*0.5+(Math.random()-0.5)*0.25);
      ball.spin.set(0,0,(Math.random()-0.5)*0.3);
      PS.swingTimer=1; PS.spaceHeld=true;
      spark(ball.pos.clone(), 10);
      showStatus(PS.chargeTime>0.4?'💥 POWER!':'HIT!', 500);
      rallyCount++;
    }
    PS.charging=false; PS.chargeTime=0;
  }
  if(!spNow) PS.spaceHeld=false;

  // ── Multi-CPU AI + LOD + Culling ──
  let visCount=0, culledCount=0;
  const lodCounts=[0,0,0];

  for(const agent of cpuAgents){
    syncAgentPositions(agent);
    const dx = PS.pos.x - agent.xPos;
    const dz = PS.pos.z - agent.paddleZ;
    const faceAngle = Math.atan2(dx, dz);
    agent.rig0.group.rotation.y = faceAngle;
    agent.rig1.group.rotation.y = faceAngle;
    agent.rig2.group.rotation.y = faceAngle;

    if(CFG.useFrustumCulling){
      agent.isCulled = !isMeshInFrustum(agent.rig0.group);
    } else {
      agent.isCulled = false;
    }

    if(CFG.useLOD && !agent.isCulled){
      const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
      const agentPos = new THREE.Vector3(agent.xPos, 0.9, agent.paddleZ);
      const dist = camPos.distanceTo(agentPos);
      const newLod = dist > CFG.lodDist2 ? 2 : dist > CFG.lodDist1 ? 1 : 0;
      switchAgentLOD(agent, newLod);
    } else if(!CFG.useLOD){
      switchAgentLOD(agent, 0);
    }

    if(agent.isCulled){
      agent.rig0.group.visible=false;
      agent.rig1.group.visible=false;
      agent.rig2.group.visible=false;
      culledCount++;
    } else {
      visCount++;
      lodCounts[agent.currentLod]++;
    }

    if(agent.isCulled) continue;

    // ── CPU AI ──
    const isClosestAgent = cpuAgents.every(a => a === agent || Math.abs(a.xPos - ball.pos.x) >= Math.abs(agent.xPos - ball.pos.x));
    if(phase==='rally'&&ball.active&&ball.vel.x>0){
      const cpuX=agent.xPos;
      const ttr=Math.max(0,(cpuX-ball.pos.x))/Math.max(ball.vel.x,0.1);
      const pz=ball.pos.z+ball.vel.z*ttr;
      const cz=Math.max(-TH_Z+0.05,Math.min(TH_Z-0.05,pz));
      agent.delayTimer+=dt;
      if(agent.delayTimer>=agent.reactionDelay){agent.pendingZ=cz;agent.delayTimer=0;}
      const diff=agent.pendingZ-agent.paddleZ;
      agent.paddleZ+=Math.min(Math.abs(diff),agent.speed*dt)*Math.sign(diff);
      agent.paddleZ=Math.max(-TH_Z+0.05,Math.min(TH_Z-0.05,agent.paddleZ));
      agent.reachAnim=diff;

      const near=ball.pos.x>cpuX-0.7&&ball.pos.x<cpuX+0.3;
      const inZ=Math.abs(ball.pos.z-agent.paddleZ)<0.55;
      const atH=ball.pos.y>TY-0.1&&ball.pos.y<TY+0.9;
      if(near&&inZ&&atH&&ball.vel.x>0&&isClosestAgent){
        if(Math.random()>agent.missChance){
          const rz=ball.pos.z-agent.paddleZ;
          ball.vel.set(-(agent.hitSpeedX+Math.random()*0.6),1.2+Math.random()*0.3,rz*0.8+(Math.random()-0.5)*0.4);
          ball.spin.set(0,0,(Math.random()-0.5)*0.3);
          agent.hitAnimTimer=1;
          spark(ball.pos.clone(), 8);
          rallyCount++;
        } else {
          ball.vel.x*=0.05;
          showStatus('MISS!',500);
        }
      }
    }
    if(ball.vel.x<0){
      agent.reachAnim*=0.92;
      agent.paddleZ+=(agent.zOff-agent.paddleZ)*dt*1.2;
    }
    if(agent.currentLod===0) animCpuAgent(agent, dt);
  }

  // ── Spectator culling + cheer ──
  for(const spec of spectatorGroups){
    if(CFG.useFrustumCulling){
      spec.isCulled = !isMeshInFrustum(spec.g);
    } else {
      spec.isCulled = false;
    }
    spec.g.visible = !spec.isCulled;
    if(!spec.isCulled){
      const ud = spec.g.userData;
      ud.bob = ud.bob || 0;
      if(ud.cheerTimer > 0){
        ud.cheerTimer -= dt;
        const ct = ud.cheerTimer;
        const cp = ud.cheerPhase || 0;
        const jumpY = Math.abs(Math.sin(ct * 6.0 + cp)) * 0.22;
        spec.g.position.y = jumpY;
        const clapAngle = Math.sin(ct * 8.0 + cp);
        if(spec.la){ spec.la.rotation.z = 0.6 + clapAngle * 0.5; spec.la.rotation.x = -0.5 + clapAngle * 0.3; }
        if(spec.ra){ spec.ra.rotation.z = -(0.6 + clapAngle * 0.5); spec.ra.rotation.x = -0.5 + clapAngle * 0.3; }
        visCount++;
      } else {
        spec.g.position.y = Math.sin(T*2 + ud.bob) * 0.04;
        if(spec.la){ spec.la.rotation.z += (0 - spec.la.rotation.z)*0.08; spec.la.rotation.x += (0 - spec.la.rotation.x)*0.08; }
        if(spec.ra){ spec.ra.rotation.z += (0 - spec.ra.rotation.z)*0.08; spec.ra.rotation.x += (0 - spec.ra.rotation.x)*0.08; }
        visCount++;
      }
    } else culledCount++;
  }

  // ── Ball physics ──
  if(ball.active){
    const Grav=-9.8*0.28, DR=0.998, SUB=4, sdt=dt/SUB;
    for(let s=0;s<SUB;s++){
      ball.vel.y+=Grav*sdt;
      ball.vel.x*=Math.pow(DR,sdt*60); ball.vel.z*=Math.pow(DR,sdt*60);
      ball.vel.z+=ball.spin.z*sdt*1.5;
      ball.spin.multiplyScalar(Math.pow(0.985,sdt*60));
      ball.pos.addScaledVector(ball.vel,sdt);
      const surf=TY+BR;
      if(ball.pos.y<=surf&&ball.vel.y<0&&Math.abs(ball.pos.x)<TH_X&&Math.abs(ball.pos.z)<TH_Z){
        ball.pos.y=surf; ball.vel.y=Math.abs(ball.vel.y)*0.6;
        ball.vel.x*=0.88; ball.vel.z*=0.88; spark(ball.pos.clone(),3);
      }
      if(ball.pos.y<BR&&ball.vel.y<0){ball.pos.y=BR;ball.vel.y=Math.abs(ball.vel.y)*0.4;}
      const NT=0.045;
      if(Math.abs(ball.pos.x)<NT&&ball.pos.y<NH&&ball.pos.y>TY&&Math.abs(ball.pos.z)<TH_Z&&!ball.netHit){
        ball.vel.x=-ball.vel.x*0.3; ball.vel.y=Math.abs(ball.vel.y)*0.5+0.8;
        ball.pos.x=Math.sign(ball.vel.x||-1)*NT*2; ball.netHit=true;
      }
      if(Math.abs(ball.pos.x)>0.2) ball.netHit=false;
    }
    if(ball.pos.x<-TH_X-0.6){scores.cpu++;document.getElementById('s-cpu').textContent=scores.cpu;endPoint('cpu');checkScore();}
    if(ball.pos.x> TH_X+0.6){scores.you++;document.getElementById('s-you').textContent=scores.you;endPoint('you');checkScore();}
    if(Math.abs(ball.pos.z)>TH_Z+1.8){
      if(ball.pos.x<0){scores.cpu++;document.getElementById('s-cpu').textContent=scores.cpu;endPoint('cpu');}
      else{scores.you++;document.getElementById('s-you').textContent=scores.you;endPoint('you');}
      checkScore();
    }
    trPos.unshift(ball.pos.clone()); if(trPos.length>TRL)trPos.pop();
    trMeshes.forEach((t,i)=>{
      if(i<trPos.length){t.position.copy(trPos[i]);t.material.opacity=(1-i/TRL)*0.45;t.visible=true;}
      else t.visible=false;
    });
    ballMesh.position.copy(ball.pos); ballLight.position.copy(ball.pos);
  } else {
    ballMesh.position.set(0,TY+0.5,0); ballLight.position.set(0,TY+0.5,0);
    trMeshes.forEach(t=>t.visible=false);
  }

  if(phase==='point'){
    pointTimer-=dt*60;
    if(pointTimer<=0){
      phase=(serverTurn==='player')?'walk':'serve';
      if(serverTurn==='cpu') cpuServeTimer=1.4;
    }
  }

  // ── Particles ──
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i]; p.vel.y-=4*dt;
    p.mesh.position.addScaledVector(p.vel,dt);
    p.life-=dt*2; p.mesh.material.opacity=Math.max(0,p.life);
    if(p.life<=0){scene.remove(p.mesh);parts.splice(i,1);}
  }

  updateMetrics(visCount, culledCount, lodCounts);
}

// ═══════════════════════════════════════════
//  RENDER LOOP
// ═══════════════════════════════════════════
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

function loop(){
  requestAnimationFrame(loop);
  const now=performance.now();
  frameTime = now - lastFrameTime;
  lastFrameTime = now;
  const dt=Math.min(clock.getDelta(),0.05);
  update(dt);
  renderer.render(scene,camera);
  frames++;
  if(now-lastFPS>=1000){
    currentFPS=frames; frames=0; lastFPS=now;
    fpsHistory.push(currentFPS);
    if(fpsHistory.length>60) fpsHistory.shift();
    drawFPSChart();
  }
}

// ─── INIT ───
rebuildScene();
loop();
