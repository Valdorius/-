import { clamp } from "../core/math.js";
import * as THREE from "three";

export function createProjectiles({ engine, world, fx }){
  const { scene } = engine;
  const list = [];

  // Player projectiles: Heavy Runic Broadhead Arrow
  const shaftGeo = new THREE.BoxGeometry(0.022, 0.022, 0.54);
  const headGeo  = new THREE.BoxGeometry(0.065, 0.020, 0.12);
  const fletchGeo= new THREE.BoxGeometry(0.075, 0.016, 0.14);
  const boltGeo  = new THREE.BoxGeometry(0.10,0.10,0.24);

  const matArrowShaft = new THREE.MeshStandardMaterial({ color: 0x241812, roughness:0.85 });
  const matArrowHead  = new THREE.MeshStandardMaterial({ color: 0xd2dcfa, roughness:0.35, metalness:0.65, emissive: 0x00d8ff, emissiveIntensity: 0.85 });
  const matFletch     = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const matBolt       = new THREE.MeshStandardMaterial({ color: 0xbda7ff, roughness:0.45, metalness:0.05, emissive:0x5533aa, emissiveIntensity:0.65 });

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
      const head  = new THREE.Mesh(headGeo, matArrowHead);
      const f1    = new THREE.Mesh(fletchGeo, matFletch);
      head.position.z = -0.22;
      f1.position.z   =  0.18;
      g.add(shaft, head, f1);
      return g;
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
      mesh
    });
  }

  function tick(dt, enemies = null, onHit = null){
    for (let i=list.length-1;i>=0;i--){
      const p = list[i];
      p.life -= dt;

      const oldPos = p.pos.clone();
      p.pos.addScaledVector(p.dir, p.speed*dt);

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

      if (p.kind === "spell" || p.kind === "enemyOrb"){
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
