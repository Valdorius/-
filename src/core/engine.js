import { clamp } from "./math.js";
import * as THREE from "three";

export function createEngine(canvas){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, powerPreference:"high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = (function(){
    // Procedural sky gradient with subtle stars (no external assets)
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0,0,0,c.height);
    grad.addColorStop(0, "#05070e");
    grad.addColorStop(0.55, "#071027");
    grad.addColorStop(1, "#02030a");
    g.fillStyle = grad;
    g.fillRect(0,0,c.width,c.height);

    // Stars
    g.globalAlpha = 0.85;
    for(let i=0;i<900;i++){
      const x = Math.random()*c.width;
      const y = Math.random()*c.height*0.85;
      const r = Math.random()*1.4;
      const a = 0.15 + Math.random()*0.55;
      g.fillStyle = `rgba(220,240,255,${a})`;
      g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
    }
    // faint nebula smudges
    g.globalAlpha = 0.22;
    for(let i=0;i<14;i++){
      const x = Math.random()*c.width;
      const y = Math.random()*c.height;
      const w = 180 + Math.random()*420;
      const h = 90 + Math.random()*220;
      const hue = (190 + Math.random()*120)|0;
      g.fillStyle = `hsla(${hue},80%,60%,0.10)`;
      g.beginPath();
      g.ellipse(x,y,w,h,Math.random()*Math.PI,0,Math.PI*2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.needsUpdate = true;
    return tex;
  })();
  scene.fog = new THREE.FogExp2(0x05070c, 0.020);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 220);
  camera.position.set(0, 1.65, 6);

  // Lights (simple but nice for voxel)
  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xffffff, 1.25);
  dir.position.set(16, 28, 12);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 90;
  const shadowD = 45;
  dir.shadow.camera.left = -shadowD;
  dir.shadow.camera.right = shadowD;
  dir.shadow.camera.top = shadowD;
  dir.shadow.camera.bottom = -shadowD;
  dir.shadow.bias = -0.0006;
  // Enable shadow casting for all layers including layer 2 (avatar)
  dir.shadow.camera.layers.enableAll();
  scene.add(dir);

  const rim = new THREE.DirectionalLight(0x88aaff, 0.6);
  rim.position.set(-8, 5, -9);
  scene.add(rim);

  const clock = new THREE.Clock();

  let resizeCb = null;
  window.addEventListener("resize", ()=>{
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    resizeCb && resizeCb();
  });

  function onResize(cb){ resizeCb = cb; }

  function render(){
    renderer.render(scene, camera);
  }

  function start(loop){
    function tick(){
      const dt = Math.min(0.05, clock.getDelta());
      loop(dt, performance.now());
      requestAnimationFrame(tick);
    }
    tick();
  }

  return { renderer, scene, camera, onResize, start, render };
}