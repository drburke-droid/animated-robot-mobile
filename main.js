import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MUSCLES = ["LR", "MR", "SR", "IR", "SO", "IO"]; [cite: 2]
const APP_STATE = { ready: false, hasPointer: false, target: new THREE.Vector3() }; [cite: 2]
const uiCache = { left: {}, right: {} }; [cite: 3]
const gazeDot = document.getElementById('gaze-dot');
const startPrompt = document.getElementById('start-prompt');

const SYSTEM_STATE = { [cite: 3]
  nerves: { "R-CN3": 1, "R-CN4": 1, "R-CN6": 1, "L-CN3": 1, "L-CN4": 1, "L-CN6": 1 },
  muscles: { 
    right: { LR: 1, MR: 1, SR: 1, IR: 1, SO: 1, IO: 1 },
    left: { LR: 1, MR: 1, SR: 1, IR: 1, SO: 1, IO: 1 }
  }
};

const PATHOLOGIES = { [cite: 4, 18]
  "CN III Palsy": { s: ['R', 'L', 'B'], f: (side) => setNerve(side, 3, 0) },
  "CN IV Palsy": { s: ['R', 'L', 'B'], f: (side) => setNerve(side, 4, 0) },
  "CN VI Palsy": { s: ['R', 'L', 'B'], f: (side) => setNerve(side, 6, 0) },
  "INO (MLF)": { s: ['R', 'L', 'B'], f: (side) => {
    if(side==='right'||side==='both') SYSTEM_STATE.muscles.right.MR = 0;
    if(side==='left'||side==='both') SYSTEM_STATE.muscles.left.MR = 0;
  }},
  "Graves (TED)": { s: ['R', 'L', 'B'], f: (side) => {
    const t = side==='both'?['right','left']:[side];
    t.forEach(s=>{ SYSTEM_STATE.muscles[s].IR=0.3; SYSTEM_STATE.muscles[s].MR=0.5; });
  }},
  "Blowout Fx": { s: ['R', 'L'], f: (side) => { SYSTEM_STATE.muscles[side].IR = 0; }},
  "Brown Syn.": { s: ['R', 'L'], f: (side) => { SYSTEM_STATE.muscles[side].IO = 0; }},
  "Miller Fisher": { s: ['B'], f: () => { Object.keys(SYSTEM_STATE.nerves).forEach(k=>SYSTEM_STATE.nerves[k]=0.1); }},
  "Wallenberg": { s: ['R', 'L'], f: (side) => { 
    const isR = side === 'right'; SYSTEM_STATE.muscles[isR?'right':'left'].IR=0.5; SYSTEM_STATE.muscles[isR?'left':'right'].SR=0.5; 
  }}
};

let activePathName = null;

function setNerve(side, num, val) { [cite: 20, 21]
  if(side === 'both') { SYSTEM_STATE.nerves['R-CN'+num] = val; SYSTEM_STATE.nerves['L-CN'+num] = val; }
  else { SYSTEM_STATE.nerves[(side==='right'?'R':'L')+'-CN'+num] = val; }
}

window.resetSystem = () => { [cite: 22]
  Object.keys(SYSTEM_STATE.nerves).forEach(k => SYSTEM_STATE.nerves[k] = 1);
  ['right','left'].forEach(s => MUSCLES.forEach(m => SYSTEM_STATE.muscles[s][m] = 1));
  document.querySelectorAll('.path-btn').forEach(b => b.classList.remove('active-path'));
  updateUIStyles();
};

window.toggleState = (id, side = null, m = null) => { [cite: 23, 24]
  let cur = m ? SYSTEM_STATE.muscles[side][m] : SYSTEM_STATE.nerves[id];
  let next = cur === 1 ? 0.5 : (cur === 0.5 ? 0 : 1);
  if (m) SYSTEM_STATE.muscles[side][m] = next; else SYSTEM_STATE.nerves[id] = next;
  updateUIStyles();
};

window.applyPathology = (side) => { [cite: 25]
  resetSystem();
  PATHOLOGIES[activePathName].f(side);
  
  document.querySelectorAll('.path-btn').forEach(b => {
    if(b.innerText === activePathName) b.classList.add('active-path');
  });

  updateUIStyles();
  document.getElementById('side-modal').style.display = 'none';
  if(window.collapseAllMenus) window.collapseAllMenus();
};

function updateUIStyles() { [cite: 26, 27]
  Object.entries(SYSTEM_STATE.nerves).forEach(([id, v]) => {
    const el = document.getElementById(id); if(!el) return;
    el.className = 'pill' + (v === 0.5 ? ' paresis' : (v === 0 ? ' paralysis' : ''));
  });
  ['left','right'].forEach(s => {
    const sideKey = s === 'left' ? 'L' : 'R';
    MUSCLES.forEach(m => {
      const v = SYSTEM_STATE.muscles[s][m];
      const el = document.querySelector(`#muscles${sideKey} .m-label-${m}`);
      if(el) el.className = `m-label m-label-${m}` + (v===0.5?' paresis':(v===0?' paralysis':''));
    });
  });
}

function initUI() { [cite: 28, 29, 31]
  const sides = [{ id: "musclesR", key: "right", label: "Right Eye (OD)" }, { id: "musclesL", key: "left", label: "Left Eye (OS)" }];
  sides.forEach(s => {
    const el = document.getElementById(s.id); if(!el) return;
    el.innerHTML = `<div style="color:#4cc9f0; font-weight:bold; margin-bottom:5px;">${s.label}</div>`;
    MUSCLES.forEach(m => {
      const row = document.createElement("div"); row.className = "row";
      row.innerHTML = `<div class="m-label m-label-${m}" onclick="toggleState(null, '${s.key}', '${m}')">${m}</div><div class="barWrap"><div class="bar"></div></div><div class="pct">0%</div>`;
      el.appendChild(row);
      uiCache[s.key][m] = { bar: row.querySelector(".bar"), pct: row.querySelector(".pct") };
    });
  });

  const grid = document.getElementById('pathology-grid'); if(!grid) return;
  Object.keys(PATHOLOGIES).forEach(name => {
    const btn = document.createElement('div'); btn.className = 'pill path-btn'; btn.innerText = name;
    btn.onclick = () => { 
        activePathName = name; 
        document.getElementById('side-modal').style.display = 'flex'; 
    };
    grid.appendChild(btn);
  });
}

function getRecruitment(isRight, targetYaw, targetPitch) { [cite: 33, 34, 45]
  const side = isRight ? 'right' : 'left';
  const prefix = isRight ? 'R-' : 'L-';
  const h = {
    LR: SYSTEM_STATE.nerves[prefix+'CN6'] * SYSTEM_STATE.muscles[side].LR,
    MR: SYSTEM_STATE.nerves[prefix+'CN3'] * SYSTEM_STATE.muscles[side].MR,
    SR: SYSTEM_STATE.nerves[prefix+'CN3'] * SYSTEM_STATE.muscles[side].SR,
    IR: SYSTEM_STATE.nerves[prefix+'CN3'] * SYSTEM_STATE.muscles[side].IR,
    IO: SYSTEM_STATE.nerves[prefix+'CN3'] * SYSTEM_STATE.muscles[side].IO,
    SO: SYSTEM_STATE.nerves[prefix+'CN4'] * SYSTEM_STATE.muscles[side].SO
  };

  const driftX = (1 - h.LR) * -0.4 + (1 - h.MR) * 0.4; [cite: 35]
  const driftY = (1 - h.SR) * -0.1 + (1 - h.IR) * 0.1 + (h.SR === 0 && h.IR === 0 ? -0.25 : 0); [cite: 36]

  // BOOSTED LATERAL RESPONSIVENESS (1.5x Yaw)
  let allowedYaw = isRight ? 
    (targetYaw < 0 ? targetYaw * h.LR * 1.5 : targetYaw * h.MR * 1.5) : 
    (targetYaw > 0 ? targetYaw * h.LR * 1.5 : targetYaw * h.MR * 1.5); [cite: 37, 38, 39]

  const nasalYaw = isRight ? targetYaw : -targetYaw; [cite: 39]
  const blend = 1 / (1 + Math.exp(-(nasalYaw + 0.15) * 7)); 

  let mY;
  if (targetPitch > 0) { 
    mY = THREE.MathUtils.lerp(targetPitch * h.SR * 1.4, targetPitch * h.IO * 1.4, blend); [cite: 41]
  } else { 
    // BOOSTED INFERIOR RESPONSIVENESS (2.8x Pitch)
    mY = THREE.MathUtils.lerp(targetPitch * h.IR * 2.8, targetPitch * h.SO * 2.8, blend); [cite: 42]
  }

  const fYaw = allowedYaw + (isRight ? -driftX : driftX); [cite: 42]
  const fPit = mY + driftY; [cite: 43]

  return {
    rotation: { y: fYaw, x: fPit }, [cite: 44]
    acts: {
      LR: (0.2 + Math.max(0, isRight ? -fYaw : fYaw) * 1.8) * h.LR,
      MR: (0.2 + Math.max(0, isRight ? fYaw : -fYaw) * 1.8) * h.MR,
      SR: (0.2 + Math.max(0, fPit) * 2.2 * (1 - blend)) * h.SR,
      IR: (0.2 + Math.max(0, -fPit) * 1.8 * (1 - blend)) * h.IR,
      IO: (0.2 + Math.max(0, fPit) * 2.0 * blend) * h.IO,
      SO: (0.2 + Math.max(0, -fPit) * 1.8 * blend + (h.IR === 0 ? 0.3 : 0)) * h.SO [cite: 45]
    }
  };
}

const scene = new THREE.Scene(); [cite: 45]
const camera = new THREE.PerspectiveCamera(35, window.innerWidth/window.innerHeight, 0.1, 100); [cite: 46]
camera.position.z = 6.5; [cite: 46]
const renderer = new THREE.WebGLRenderer({ antialias: true }); [cite: 46]
renderer.setSize(window.innerWidth, window.innerHeight); [cite: 47]
document.getElementById("app").appendChild(renderer.domElement); [cite: 47]
scene.add(new THREE.HemisphereLight(0xffffff, 0, 0.5)); [cite: 47]
const penlight = new THREE.PointLight(0xffffff, 80, 10); [cite: 47]
scene.add(penlight); [cite: 47]

const handleInput = (x, y) => { [cite: 48]
  if (startPrompt) {
    startPrompt.style.opacity = '0';
    setTimeout(() => startPrompt.style.display = 'none', 500);
  }

  const m = { x: (x / window.innerWidth) * 2 - 1, y: -(y / window.innerHeight) * 2 + 1 };
  const r = new THREE.Raycaster(); r.setFromCamera(m, camera); [cite: 48]
  r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1), -2.5), APP_STATE.target); [cite: 48]
  APP_STATE.hasPointer = true; [cite: 48]
  if (gazeDot) {
    gazeDot.style.display = 'block';
    gazeDot.style.left = x + 'px';
    gazeDot.style.top = y + 'px';
  }
};

window.addEventListener("pointermove", (e) => handleInput(e.clientX, e.clientY)); [cite: 48]
window.addEventListener("touchmove", (e) => { [cite: 48]
    if (e.touches.length > 0) {
      e.preventDefault();
      handleInput(e.touches[0].clientX, e.touches[0].clientY);
    }
}, {passive: false});

new GLTFLoader().load("./head_eyes_v1.glb", (gltf) => { [cite: 49]
  const model = gltf.scene; [cite: 49]
  model.position.y = -0.6; [cite: 49]
  model.scale.setScalar(1.8 / new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y); [cite: 49]
  let eyeL, eyeR; [cite: 49]
  model.traverse(o => { [cite: 49]
    if (o.name === "Eye_L") eyeL = o; if (o.name === "Eye_R") eyeR = o;
    if (o.name.toLowerCase().includes("cornea")) o.material = new THREE.MeshPhysicalMaterial({ transmission: 1, roughness: 0 }); [cite: 49]
  });
  scene.add(model); [cite: 49]
  
  if (document.readyState === 'loading') { [cite: 49]
    document.addEventListener('DOMContentLoaded', initUI); 
  } else { 
    initUI(); 
  }
  
  APP_STATE.ready = true; [cite: 49]

  function animate() { [cite: 50]
    requestAnimationFrame(animate); [cite: 50]
    if (!APP_STATE.ready || !APP_STATE.hasPointer) return; [cite: 50]
    penlight.position.set(APP_STATE.target.x, APP_STATE.target.y, APP_STATE.target.z + 0.6); [cite: 50]
    [ {mesh: eyeL, isR: false, s: "left"}, {mesh: eyeR, isR: true, s: "right"} ].forEach(i => { [cite: 51]
      const eyePos = new THREE.Vector3(); i.mesh.getWorldPosition(eyePos); [cite: 51]
      const res = getRecruitment(i.isR, Math.atan2(APP_STATE.target.x - eyePos.x, APP_STATE.target.z - eyePos.z), Math.atan2(APP_STATE.target.y - eyePos.y, APP_STATE.target.z - eyePos.z)); [cite: 51]
      i.mesh.rotation.set(-res.rotation.x, res.rotation.y, 0, 'YXZ'); [cite: 51]
      MUSCLES.forEach(m => { [cite: 52]
        const cache = uiCache[i.s][m]; [cite: 52]
        const valDisplay = Math.min(100, Math.round((res.acts[m] / 0.7) * 100)); [cite: 52]
        cache.bar.style.width = valDisplay + "%"; cache.pct.innerText = valDisplay + "%"; [cite: 52]
        cache.bar.style.background = res.acts[m] < 0.05 ? "#ff4d6d" : (res.acts[m] < 0.25 ? "#ffb703" : "#4cc9f0"); [cite: 52]
      });
    });
    renderer.render(scene, camera); [cite: 53]
  }
  animate(); [cite: 50]
});
