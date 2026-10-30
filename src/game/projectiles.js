import { clamp } from "../core/math.js";
import * as THREE from "three";

export function createProjectiles({ engine, world, fx }){
  const { scene } = engine;
  const list = [];

  // Player projectiles: Monolithic Vanguard Arrow (Concept 4)
  const shaftGeo = new THREE.BoxGeometry(0.018, 0.018, 0.60);
  const collarGeo = new THREE.BoxGeometry(0.024, 0.024, 0.040);
  const fletchGeo= new THREE.BoxGeometry(0.006, 0.042, 0.10);
  const fletchSideGeo= new THREE.BoxGeometry(0.038, 0.020, 0.10);
  const boltGeo  = new THREE.BoxGeometry(0.10,0.10,0.24);

  // 3D граненый стальной наконечник летящей стрелы (острие направлено вперед по -Z)
  const bhTip    = [0, 0, -0.45];
  const bhRidgeT = [0, 0.016, -0.34];
  const bhRidgeB = [0, -0.016, -0.34];
  const bhWingR  = [0.048, 0, -0.28];
  const bhWingL  = [-0.048, 0, -0.28];
  const bhColT   = [0, 0.012, -0.24];
  const bhColB   = [0, -0.012, -0.24];
  const bhColR   = [0.012, 0, -0.24];
  const bhColL   = [-0.012, 0, -0.24];

  const bhTris = [
    // Верхние и нижние передние лезвия, сходящиеся в колющую иглу (-Z)
    bhTip, bhWingR, bhRidgeT,
    bhTip, bhRidgeT, bhWingL,
    bhTip, bhRidgeB, bhWingR,
    bhTip, bhWingL, bhRidgeB,

    // Задние зазубренные скосы (barbs) к посадочной втулке
    bhRidgeT, bhWingR, bhColT,
    bhWingR, bhColR, bhColT,
    bhRidgeT, bhColT, bhWingL,
    bhWingL, bhColT, bhColL,

    bhRidgeB, bhColB, bhWingR,
    bhWingR, bhColB, bhColR,
    bhRidgeB, bhWingL, bhColB,
    bhWingL, bhColL, bhColB,
  ];
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bhTris.flat()), 3));
  headGeo.computeVertexNormals();

  // Светящийся рунный хребет наконечника
  const bhCTip    = [0, 0, -0.435];
  const bhCRidgeT = [0, 0.009, -0.345];
  const bhCRidgeB = [0, -0.009, -0.345];
  const bhCWingR  = [0.018, 0, -0.29];
  const bhCWingL  = [-0.018, 0, -0.29];
  const bhCColT   = [0, 0.007, -0.25];
  const bhCColB   = [0, -0.007, -0.25];

  const bhCoreTris = [
    bhCTip, bhCWingR, bhCRidgeT,
    bhCTip, bhCRidgeT, bhCWingL,
    bhCTip, bhRidgeB, bhCWingR,
    bhCTip, bhCWingL, bhRidgeB,

    bhCRidgeT, bhCWingR, bhCColT,
    bhCRidgeT, bhCColT, bhCWingL,
    bhCRidgeB, bhColB, bhCWingR,
    bhCRidgeB, bhCWingL, bhColB,
  ];
  const headGlowGeo = new THREE.BufferGeometry();
  headGlowGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bhCoreTris.flat()), 3));
  headGlowGeo.computeVertexNormals();

  const matArrowShaft = new THREE.MeshStandardMaterial({ color: 0x181e2a, roughness:0.45, metalness:0.35 });
  const matArrowCollar= new THREE.MeshStandardMaterial({ color: 0x364052, roughness:0.30, metalness:0.70 });
  const matArrowHead  = new THREE.MeshStandardMaterial({ color: 0xa4bddc, roughness:0.20, metalness:0.85, emissive: 0x00d8ff, emissiveIntensity: 0.60 });
  const matArrowGlow  = new THREE.MeshBasicMaterial({ color: 0x80f8ff });
  const matFletch     = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const matBolt       = new THREE.MeshStandardMaterial({ color: 0xbda7ff, roughness:0.45, metalness:0.05, emissive:0x5533aa, emissiveIntensity:0.65 });

  // Dagger mesh (Следопыт: вращающийся теневой серповидный клинок с рунами)
  const matDaggerObsidian = new THREE.MeshStandardMaterial({ color: 0x181e2a, roughness: 0.40, metalness: 0.45 });
  const matDaggerSteel    = new THREE.MeshStandardMaterial({ color: 0xa4bddc, roughness: 0.22, metalness: 0.85 });
  const matDaggerRune     = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const matDaggerGrip     = new THREE.MeshStandardMaterial({ color: 0x3d2719, roughness: 0.85, metalness: 0.10 });

  function createDaggerMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 6), matDaggerGrip));
    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.038), matDaggerSteel);
    pommel.position.set(0, -0.07, -0.01);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.014, 0.028), matDaggerSteel);
    guard.position.set(0, 0.06, 0);
    g.add(pommel, guard);

    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.10, 0.012), matDaggerObsidian);
    b1.position.set(0, 0.11, 0);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.10, 0.010), matDaggerObsidian);
    b2.position.set(0.008, 0.19, 0.010);
    b2.rotation.z = 0.12;
    const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.09, 0.008), matDaggerSteel);
    b3.position.set(0.022, 0.27, 0.020);
    b3.rotation.z = 0.24;
    const runeLine = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.22, 0.014), matDaggerRune);
    runeLine.position.set(0.008, 0.18, 0.008);
    runeLine.rotation.z = 0.12;
    g.add(b1, b2, b3, runeLine);

    g.rotation.x = -Math.PI / 2;
    g.scale.set(0.85, 0.85, 0.85);

    const rootG = new THREE.Group();
    rootG.add(g);
    return rootG;
  }

  // Bomb mesh (Следопыт: чугунная осадная бомба с рунным поясом и фитилем)
  const matBombIron = new THREE.MeshStandardMaterial({ color: 0x1e242e, roughness: 0.65, metalness: 0.75 });
  const matBombRune = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const matBombFuse = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
  const bombGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const bombBandGeo = new THREE.TorusGeometry(0.142, 0.014, 6, 14);
  const bombFuseGeo = new THREE.CylinderGeometry(0.015, 0.020, 0.08, 6);

  function createBombMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bombGeo, matBombIron));
    const band = new THREE.Mesh(bombBandGeo, matBombRune);
    band.rotation.x = Math.PI / 2;
    const fuse = new THREE.Mesh(bombFuseGeo, matBombFuse);
    fuse.position.set(0, 0.15, 0);
    g.add(band, fuse);
    return g;
  }

  // Shrapnel mesh (Следопыт: раскаленная картечь мортиры)
  const matShrapnel = new THREE.MeshBasicMaterial({ color: 0xffb844 });
  const shrapnelGeo = new THREE.TetrahedronGeometry(0.065, 0);

  // Red spell (player staff)
  // Player staff spell: big slow explosive sphere
  const spellCoreGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const spellGlowGeo = new THREE.SphereGeometry(0.30, 14, 12);
  const matSpellCore = new THREE.MeshStandardMaterial({ color: 0xff3344, roughness:0.2, metalness:0.0, emissive:0xff1122, emissiveIntensity:1.2 });
  const matSpellGlow = new THREE.MeshStandardMaterial({ color: 0xff7788, roughness:1.0, metalness:0.0, transparent:true, opacity:0.35, emissive:0xff2244, emissiveIntensity:0.8 });

  // Enemy orb (slow blue sphere)
  const orbCoreGeo = new THREE.SphereGeometry(0.13, 12, 10);
  const orbGlowGeo = new THREE.SphereGeometry(0.22, 14, 12);
  const matOrbCore = new THREE.MeshStandardMaterial({ color: 0x57c8ff, roughness:0.15, metalness:0.05, emissive:0x2db7ff, emissiveIntensity:1.6 });
  const matOrbGlow = new THREE.MeshStandardMaterial({ color: 0x8fe2ff, roughness:1.0, metalness:0.0, transparent:true, opacity:0.30, emissive:0x45c8ff, emissiveIntensity:1.1 });

  function makeMesh(kind){
    if (kind === "arrow"){
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(shaftGeo, matArrowShaft);
      const collar = new THREE.Mesh(collarGeo, matArrowCollar);
      collar.position.z = -0.24;
      const head  = new THREE.Mesh(headGeo, matArrowHead);
      const headGlow = new THREE.Mesh(headGlowGeo, matArrowGlow);
      const f1    = new THREE.Mesh(fletchGeo, matFletch);
      f1.position.set(0, 0.016, 0.22);
      const f2    = new THREE.Mesh(fletchSideGeo, matFletch);
      f2.position.set(0.016, -0.008, 0.22);
      f2.rotation.z = -Math.PI / 6;
      const f3    = new THREE.Mesh(fletchSideGeo, matFletch);
      f3.position.set(-0.016, -0.008, 0.22);
      f3.rotation.z = Math.PI / 6;
      g.add(shaft, collar, head, headGlow, f1, f2, f3);
      return g;
    }
    if (kind === "dagger"){
      return createDaggerMesh();
    }
    if (kind === "bomb"){
      return createBombMesh();
    }
    if (kind === "shrapnel"){
      return new THREE.Mesh(shrapnelGeo, matShrapnel);
    }
    if (kind === "bolt"){
      return new THREE.Mesh(boltGeo, matBolt);
    }
    if (kind === "spell"){
      const g = new THREE.Group();
      const core = new THREE.Mesh(spellCoreGeo, matSpellCore);
      const glow = new THREE.Mesh(spellGlowGeo, matSpellGlow);
      g.add(core, glow);
      return g;
    }
    if (kind === "enemyOrb"){
      const g = new THREE.Group();
      const core = new THREE.Mesh(orbCoreGeo, matOrbCore);
      const glow = new THREE.Mesh(orbGlowGeo, matOrbGlow);
      g.add(core, glow);
      return g;
    }
    // fallback
    return new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 10), matBolt);
  }

  function spawn({ kind="bolt", origin, dir, speed=18, life=1.4, damage=10, radius=0.18, splash=0, pierce=0, team="player", mark=null, bleed=null, burn=null, srcPos=null }){
    const mesh = makeMesh(kind);
    mesh.position.copy(origin);
    // face direction
    if (dir){
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1), dir.clone().normalize());
      mesh.quaternion.copy(q);
    }
    scene.add(mesh);

    list.push({
      kind, team,
      origin: (srcPos ? (srcPos.clone ? srcPos.clone() : new THREE.Vector3(srcPos.x,0,srcPos.z)) : origin.clone()),
      mark, bleed, burn,
      pos: origin.clone(),
      dir: dir.clone().normalize(),
      speed, life,
      damage, radius,
      splash,
      pierce: pierce|0,
      hitSet: new Set(),
      mesh,
      velY: (kind === "bomb" ? ((dir.y * speed) + 2.5) : 0),
      gravity: (kind === "bomb" ? 14.0 : 0)
    });
  }

  function tick(dt, enemies = null, onHit = null){
    for (let i=list.length-1;i>=0;i--){
      const p = list[i];
      p.life -= dt;

      const oldPos = p.pos.clone();
      if (p.kind === "bomb") {
        p.velY -= p.gravity * dt;
        p.pos.x += p.dir.x * p.speed * dt;
        p.pos.z += p.dir.z * p.speed * dt;
        p.pos.y += p.velY * dt;
      } else {
        p.pos.addScaledVector(p.dir, p.speed*dt);
      }

      // Bomb floor impact detonation
      if (p.kind === "bomb" && p.pos.y <= 0.14) {
        p.pos.y = 0.14;
        fx?.addHit?.(p.pos, "bomb", 2.2);
        if (enemies && typeof enemies.forEachInRadius === "function") {
          enemies.forEachInRadius(p.pos, p.splash || 3.4, (e) => {
            onHit?.({
              enemyId: e.id,
              damage: p.damage * 0.85,
              point: p.pos,
              dir: new THREE.Vector3(e.position.x - p.pos.x, 0.2, e.position.z - p.pos.z).normalize(),
              kind: "bomb",
              splash: true,
              mark: p.mark || null,
              bleed: p.bleed || null,
              burn: p.burn || null,
              srcPos: p.origin || null
            });
          });
        }
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        list.splice(i, 1);
        continue;
      }

      // Environment collision: columns (pillars), bastions and outer walls
      if (world && typeof world.checkRay === "function") {
        const envHit = world.checkRay(oldPos, p.pos, p.radius || 0.12);
        if (envHit) {
          p.pos.copy(envHit.point);
          // Stone impact spark & debris VFX
          fx?.addHit?.(p.pos, p.kind, 1.15);

          // If explosive spell (splash), detonate against pillar surface
          if (p.splash > 0 && enemies && typeof enemies.forEachInRadius === "function") {
            enemies.forEachInRadius(p.pos, p.splash, (e) => {
              onHit?.({
                enemyId: e.id,
                damage: p.damage * 0.85,
                point: p.pos,
                dir: p.dir,
                kind: p.kind,
                splash: true,
                mark: p.mark || null,
                bleed: p.bleed || null,
                burn: p.burn || null,
                srcPos: p.origin || null
              });
            });
          }

          if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
          list.splice(i, 1);
          continue;
        }
      }

      p.mesh.position.copy(p.pos);

      if (p.kind === "dagger") {
        p.mesh.rotateX(dt * 28.0);
      } else if (p.kind === "bomb") {
        p.mesh.rotateX(dt * 7.0);
      } else if (p.kind === "shrapnel") {
        p.mesh.rotateX(dt * 18.0);
        p.mesh.rotateY(dt * 22.0);
      } else if (p.kind === "spell" || p.kind === "enemyOrb"){
        p.mesh.rotation.y += dt*10.0;
        p.mesh.rotation.x += dt*6.0;
        const s = 1.0 + 0.14*Math.sin((p.life*10.0));
        p.mesh.scale.setScalar(s);
      }

      if (p.life<=0){
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        list.splice(i,1);
      }
    }
  }

  // Collisions: player projectiles -> enemies
  function resolveHits(enemies, onHit){
    for (let i=list.length-1;i>=0;i--){
      const p = list[i];
      if (p.team !== "player") continue;

      const hit = enemies.firstHit(p.pos, p.radius);
      if (!hit) continue;

      // prevent double-hit same enemy when staying inside radius
      if (p.hitSet && p.hitSet.has(hit.id)) continue;
      p.hitSet.add(hit.id);

      if (p.splash>0){
        enemies.forEachInRadius(hit.position, p.splash, (e)=>{
          onHit({ enemyId:e.id, damage:p.damage*0.85, point:hit.position, dir:p.dir, kind:p.kind, splash:true, mark:p.mark||null, bleed:p.bleed||null, burn:p.burn||null, srcPos: p.origin || null });
        });
        // Enemy hit VFX is spawned centrally in enemies.applyDamage.
      } else {
        onHit({ enemyId:hit.id, damage:p.damage, point:hit.position, dir:p.dir, kind:p.kind, mark:p.mark||null, bleed:p.bleed||null, burn:p.burn||null, srcPos: p.origin || null });
        // Enemy hit VFX is spawned centrally in enemies.applyDamage.
      }

      if (p.pierce > 0){
        p.pierce -= 1;
        // nudge forward so we don't instantly re-hit
        p.pos.addScaledVector(p.dir, (p.radius + 0.05));
        continue;
      }

      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
      list.splice(i,1);
    }
  }

  // Collisions: enemy projectiles -> player
  function resolveHitsPlayer(player, onHitPlayer){
    const pr = player?.radius ?? 0.55;
    const pp = player?.position;
    if (!pp) return;

    for (let i=list.length-1;i>=0;i--){
      const p = list[i];
      if (p.team !== "enemy") continue;

      const dx = p.pos.x - pp.x;
      const dz = p.pos.z - pp.z;
      const d2 = dx*dx + dz*dz;
      const rr = (p.radius + pr);
      if (d2 <= rr*rr){
        onHitPlayer?.({ damage:p.damage, point:p.pos, dir:p.dir, kind:p.kind });
        // Player hit VFX stays here (player doesn't go through enemies.applyDamage).
        fx?.addHit?.(p.pos, p.kind, 1.15);

        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        list.splice(i,1);
      }
    }
  }

  return { spawn, tick, resolveHits, resolveHitsPlayer, list };
}
