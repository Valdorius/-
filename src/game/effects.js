import { clamp } from "../core/math.js";
import * as THREE from "three";

export function createEffects(engine){
  const { scene } = engine;
  const impacts = [];
  const trails = [];
  const particles = [];

  // impact flash + tiny shards (helps "read" hits)
  const impactGeo = new THREE.SphereGeometry(0.10, 8, 8);
  const impactMat = new THREE.MeshBasicMaterial({ color: 0xff8890, transparent:true, opacity:0.90, depthWrite:false });

  const shardGeo = new THREE.BoxGeometry(0.04, 0.04, 0.12);
  function shardMat(color){
    return new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.85, depthWrite:false });
  }

  function addImpact(pos, strength=1, color=0xff8890){
    const m = new THREE.Mesh(impactGeo, impactMat.clone());
    m.material.color.setHex(color);
    m.position.copy(pos);
    m.scale.setScalar(0.9 + 0.7*strength);
    scene.add(m);
    impacts.push({ mesh:m, t:0.12 });
  }

  // unified hit effect for any weapon
  function addHit(pos, kind="generic", strength=1){
    // colors per damage type
    let color = 0xffa0a8;
    if (kind === "melee" || kind === "spear") color = 0x00f5ff;
    if (kind === "arrow") color = 0xdfe9ff;
    if (kind === "bolt") color = 0xbda7ff;
    if (kind === "spell") color = 0xff5566;
    if (kind === "chain") color = 0xbda7ff;
    if (kind === "enemyOrb" || kind === "ranged") color = 0x57c8ff;

    // For melee/spear: do NOT spawn giant opaque sphere in front of camera!
    if (kind !== "melee" && kind !== "spear") {
      addImpact(pos, 1.15*strength, color);
      addArcFlash(pos, color, 0.18 + 0.10*strength, 0.55);
    } else {
      // Clean, bright spark flash instead of a giant solid ball
      addArcFlash(pos, 0x00f5ff, 0.07 * strength, 0.85);
    }

    // shards / sparks
    const n = 6 + Math.floor(3*strength);
    for (let i=0;i<n;i++){
      const sh = new THREE.Mesh(shardGeo, shardMat(color));
      sh.position.copy(pos);
      sh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
      sh.scale.setScalar(0.40 + Math.random()*0.40);
      scene.add(sh);
      const ang = Math.random()*Math.PI*2;
      const spd = (2.6 + Math.random()*2.8) * (0.8 + 0.3*strength);
      const vel = new THREE.Vector3(Math.cos(ang)*spd, 1.6 + Math.random()*1.8, Math.sin(ang)*spd);
      particles.push({ mesh: sh, vel, t: 0.20 + Math.random()*0.10 });
    }
  }

  function addArcFlash(pos, color=0xbda7ff, size=0.16, opacity=0.6){
    const g = new THREE.SphereGeometry(size, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity });
    const m = new THREE.Mesh(g, mat);
    m.position.copy(pos);
    scene.add(m);
    impacts.push({ mesh:m, t:0.12 });
  }

  // Optional stub for compatibility
  function addSlashArc(){
    // Replaced by physical dynamic blade ribbon trail in weapons.js
  }

  // Visible melee swing helper (arc sector on the ground) for readability.
  function addSwingArc({ pos, yaw=0, radius=2.6, arc=0.8, color=0xdfe9ff, life=0.14, y=0.03 }){
    const inner = Math.max(0.05, radius * 0.84);
    const outer = Math.max(inner + 0.08, radius * 1.02);
    const thetaStart = (-Math.PI/2 + yaw) - arc * 0.5;
    const thetaLen = Math.max(0.12, arc);

    const geo = new THREE.RingGeometry(inner, outer, 34, 1, thetaStart, thetaLen);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.position.set(pos.x, y, pos.z);
    scene.add(m);
    trails.push({ mesh:m, t:life, t0:life });
  }

  // quick ground shockwave (for melee ground slams / boss shockwaves)
  function addShockwave(pos, strength=1, color=0xffaa33){
    const geo = new THREE.RingGeometry(0.20, 0.48, 28);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent:true, opacity:0.65, depthWrite:false, side:THREE.DoubleSide
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.position.copy(pos);
    m.position.y += 0.03;
    scene.add(m);
    particles.push({ mesh:m, vel: new THREE.Vector3(0,0,0), t:0.35, kind:"shock", grow: 2.6*strength, t0:0.35 });
  }

  // shatter burst (for ranged kills / readability)
  function addShatter(pos, strength=1, color=0xdfe9ff){
    const count = Math.floor(8 + 10*strength);
    for (let i=0;i<count;i++){
      const s = new THREE.Mesh(shardGeo, shardMat(color));
      s.position.copy(pos);
      s.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
      const a = Math.random()*Math.PI*2;
      const sp = 2.2 + Math.random()*2.0;
      const vx = Math.cos(a)*sp;
      const vz = Math.sin(a)*sp;
      const vy = 1.8 + Math.random()*1.8;
      scene.add(s);
      particles.push({ mesh:s, vel: new THREE.Vector3(vx,vy,vz), t: 0.55 + Math.random()*0.15, t0:0.70, kind:"shard" });
    }
    addImpact(pos, 0.8*strength, color);
  }



  function tick(dt){
    for (let i=impacts.length-1;i>=0;i--){
      const it = impacts[i];
      it.t -= dt;
      if (it.mesh){
        it.mesh.material.opacity = clamp(it.t/0.12, 0, 1);
        it.mesh.scale.multiplyScalar(1.0 + dt*6.0);
      }
      if (it.t<=0){
        if (it.mesh && it.mesh.parent) it.mesh.parent.remove(it.mesh);
        impacts.splice(i,1);
      }
    }

    for (let i=trails.length-1;i>=0;i--){
      const tr = trails[i];
      tr.t -= dt;
      if (tr.mesh){
        const k = clamp(tr.t / tr.t0, 0, 1);
        tr.mesh.material.opacity = 0.38 * k;
        tr.mesh.scale.setScalar(1.0 + (1.0-k)*0.05);
      }
      if (tr.t<=0){
        if (tr.mesh && tr.mesh.parent) tr.mesh.parent.remove(tr.mesh);
        trails.splice(i,1);
      }
    }

    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.t -= dt;
      if (p.mesh){
        const denom = (p.t0 || 0.26);
        p.mesh.material.opacity = clamp(p.t/denom, 0, 1);
        if (p.kind === "shock"){
          const k = clamp(1 - p.t/(p.t0||0.28), 0, 1);
          const g = (p.grow || 3.0);
          p.mesh.scale.setScalar(1 + k*g);
          // Ground shockwave: strictly stays flat on the floor plane, no tumbling rotation, no gravity!
        } else {
          p.vel.y -= 12.0*dt;
          p.mesh.position.addScaledVector(p.vel, dt);
          p.mesh.rotation.x += dt*8.0;
          p.mesh.rotation.y += dt*10.0;
        }
      }
      if (p.t<=0){
        if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
        particles.splice(i,1);
      }
    }
  }

  return { addImpact, addArcFlash, addSwingArc, addSlashArc, addHit, addShockwave, addShatter, tick, impacts };
}