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

  // Procedural tapered crescent slash geometry (thick in middle, razor sharp at tips)
  function createTaperedCrescentGeo({ radius = 1.32, arc = Math.PI * 0.72, maxHalfWidth = 0.22, segments = 28 } = {}) {
    const positions = [];
    const colors = [];
    const indices = [];

    const startAngle = -arc * 0.5;
    const angleStep = arc / segments;

    for (let i = 0; i <= segments; i++) {
      const u = i / segments; // 0 (start tip) to 1 (end tip)
      const theta = startAngle + i * angleStep;

      // Envelope: 0 at tips, 1 at center (broad glowing body, needle-sharp ends)
      const envelope = Math.pow(Math.sin(u * Math.PI), 0.72);
      const halfWidth = maxHalfWidth * envelope;

      const rInner = radius - halfWidth * 0.42;
      const rOuter = radius + halfWidth * 0.58;

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Inner vertex
      positions.push(cosT * rInner, sinT * rInner, 0);
      // Outer vertex (cutting edge)
      positions.push(cosT * rOuter, sinT * rOuter, 0);

      // Color gradient:
      // Outer edge is incandescent white-cyan (0.88, 1.0, 1.0)
      // Inner edge is rich ethereal cyan (0.04, 0.62, 0.95)
      // Tips fade cleanly to zero
      const tipFade = Math.sin(u * Math.PI);
      colors.push(0.04 * tipFade, 0.62 * tipFade, 0.95 * tipFade); // inner
      colors.push(0.88 * tipFade, 1.00 * tipFade, 1.00 * tipFade); // outer edge

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }

  const slashGeo0 = createTaperedCrescentGeo({ radius: 1.30, arc: Math.PI * 0.74, maxHalfWidth: 0.20 });
  const slashGeo1 = createTaperedCrescentGeo({ radius: 1.30, arc: Math.PI * 0.70, maxHalfWidth: 0.20 });
  const slashGeo2 = createTaperedCrescentGeo({ radius: 1.36, arc: Math.PI * 0.78, maxHalfWidth: 0.24 });

  // First-person runic slash arc in the air following the blade path
  function addSlashArc({ origin, dir, comboStep=0, color=0x00f5ff }){
    let geo = slashGeo0;
    let sweepDir = -1;
    let tiltZ = 0.08;

    if (comboStep === 0) {
      // Horizontal sweep right-to-left
      geo = slashGeo0;
      sweepDir = -1;
      tiltZ = 0.08;
    } else if (comboStep === 1) {
      // Diagonal upward cut left-to-right
      geo = slashGeo1;
      sweepDir = 1;
      tiltZ = Math.PI * 0.66;
    } else {
      // Vertical overhead execution chop
      geo = slashGeo2;
      sweepDir = -1;
      tiltZ = Math.PI * 0.50;
    }

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const m = new THREE.Mesh(geo, mat);

    // Place 1.25m in front of camera
    m.position.copy(origin).addScaledVector(dir, 1.25);
    m.lookAt(origin); // face player
    m.rotation.z += tiltZ;

    scene.add(m);
    trails.push({ mesh: m, t: 0.14, t0: 0.14, isSlash: true, sweepDir });
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

  // quick ground shockwave (for melee kills / feedback)
  function addShockwave(pos, strength=1){
    const geo = new THREE.RingGeometry(0.15, 0.35, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent:true, opacity:0.55, depthWrite:false, side:THREE.DoubleSide
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.position.copy(pos);
    m.position.y += 0.02;
    scene.add(m);
    particles.push({ mesh:m, vel: new THREE.Vector3(0,0,0), t:0.28, kind:"shock", grow: 3.2*strength, t0:0.28 });
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
        if (tr.isSlash) {
          // Sharp attack, quick smooth fade-out
          tr.mesh.material.opacity = 0.95 * Math.sin(k * Math.PI);
          // Rapidly expands outward as the energy dissipates
          const grow = 0.96 + (1.0 - k) * 0.28;
          tr.mesh.scale.set(grow, grow, grow);
          // Dynamic sweep along the blade path
          if (tr.sweepDir) {
            tr.mesh.rotation.z += tr.sweepDir * dt * 4.2;
          }
        } else {
          tr.mesh.material.opacity = 0.38 * k;
          tr.mesh.scale.setScalar(1.0 + (1.0-k)*0.05);
        }
      }
      if (tr.t<=0){
        if (tr.mesh && tr.mesh.parent) tr.mesh.parent.remove(tr.mesh);
        if (tr.mesh && tr.mesh.material && tr.isSlash) tr.mesh.material.dispose();
        trails.splice(i,1);
      }
    }

    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.t -= dt;
      if (p.mesh){
        p.vel.y -= 12.0*dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        const denom = (p.t0 || 0.26);
        p.mesh.material.opacity = clamp(p.t/denom, 0, 1);
        if (p.kind === "shock"){
          const k = clamp(1 - p.t/(p.t0||0.28), 0, 1);
          const g = (p.grow || 3.0);
          p.mesh.scale.setScalar(1 + k*g);
        }
        p.mesh.rotation.x += dt*8.0;
        p.mesh.rotation.y += dt*10.0;
      }
      if (p.t<=0){
        if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
        particles.splice(i,1);
      }
    }
  }

  return { addImpact, addArcFlash, addSwingArc, addSlashArc, addHit, addShockwave, addShatter, tick, impacts };
}