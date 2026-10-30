import * as THREE from "three";

/**
 * Sky Titan: Colossal Flaming Skeleton on a Gothic Obsidian Throne.
 * Sits in the northern skybox / horizon (Z ~ -82), towering over the arena walls.
 * Pose: Bored Emperor / Thinker — resting jaw/chin on right fist, watching gladiator battles below.
 * Holds/plants a colossal blazing greatsword beside his throne.
 */
export function createSkyTitan({ engine, world }) {
  const { scene } = engine;

  const titanRoot = new THREE.Group();
  titanRoot.name = "SkyTitanRoot";
  // Positioned in the northern horizon, facing south towards arena center (0, 0, 0)
  titanRoot.position.set(0, 0, -74);
  scene.add(titanRoot);

  // Helper for voxel box primitives
  function box(w, h, d, x, y, z, mat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  }

  // ===== MATERIALS =====
  // 1. Dark Chiseled Obsidian Throne
  const throneMat = new THREE.MeshStandardMaterial({
    color: 0x221a2b,
    roughness: 0.82,
    metalness: 0.28,
    emissive: new THREE.Color(0x1a0e24),
    emissiveIntensity: 0.55,
    fog: false
  });

  const throneTrimMat = new THREE.MeshStandardMaterial({
    color: 0x362544,
    roughness: 0.70,
    metalness: 0.45,
    emissive: new THREE.Color(0x221230),
    emissiveIntensity: 0.50,
    fog: false
  });

  // Magma cracks on throne
  const magmaMat = new THREE.MeshBasicMaterial({
    color: 0xff3300,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });

  // 2. Giant Ancient Titan Bones (Warm glowing ivory-amber, fog: false for cinematic clarity)
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xffe6c8,
    roughness: 0.50,
    metalness: 0.15,
    emissive: new THREE.Color(0xb86c28),
    emissiveIntensity: 0.55,
    fog: false
  });

  const boneJointMat = new THREE.MeshStandardMaterial({
    color: 0xdeb888,
    roughness: 0.60,
    metalness: 0.20,
    emissive: new THREE.Color(0x8a4c18),
    emissiveIntensity: 0.55,
    fog: false
  });

  // 3. Blazing Fire & Flame Materials (Additive Blending, no fog to pierce through night mist)
  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });

  const flameMidMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });

  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: 0xff1a00,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });

  // Greatsword dark metal
  const swordSteelMat = new THREE.MeshStandardMaterial({
    color: 0x362c42,
    roughness: 0.38,
    metalness: 0.75,
    emissive: new THREE.Color(0x281432),
    emissiveIntensity: 0.45,
    fog: false
  });

  // ===== 1. THE COLOSSAL GOTHIC THRONE =====
  const throneGroup = new THREE.Group();
  throneGroup.name = "ObsidianThrone";
  titanRoot.add(throneGroup);

  // Stepped Dais (3 massive tiers)
  throneGroup.add(box(42, 3.0, 32, 0, 1.5, 2, throneMat));
  throneGroup.add(box(35, 2.5, 28, 0, 4.25, 2, throneMat));
  throneGroup.add(box(28, 2.0, 24, 0, 6.5, 2, throneTrimMat));

  // Magma fissures on steps
  for (let sx = -12; sx <= 12; sx += 6) {
    const crack = box(0.6, 0.05, 14, sx, 7.52, 2, magmaMat);
    crack.rotation.y = (sx % 12) * 0.08;
    throneGroup.add(crack);
  }

  // Seat Base
  throneGroup.add(box(21, 5.0, 14, 0, 10.0, 0, throneMat));

  // Massive Armrests with Gargoyle Horns
  for (const ax of [-12.0, 12.0]) {
    // Armrest pillar
    throneGroup.add(box(3.8, 11.0, 16.0, ax, 13.0, 1.0, throneMat));
    throneGroup.add(box(4.2, 1.2, 16.5, ax, 19.0, 1.0, throneTrimMat));

    // Front brazier bowl
    const bBase = box(3.4, 2.4, 3.4, ax, 20.2, 8.5, throneTrimMat);
    const bFireCore = box(2.2, 1.8, 2.2, ax, 21.8, 8.5, flameCoreMat);
    const bFireMid = box(3.2, 3.6, 3.2, ax, 22.8, 8.5, flameMidMat);
    throneGroup.add(bBase, bFireCore, bFireMid);

    // Warm brazier point lights
    const brazierLight = new THREE.PointLight(0xff5500, 1.4, 38, 1.8);
    brazierLight.position.set(ax, 22.5, 8.5);
    throneGroup.add(brazierLight);
  }

  // Towering Gothic Backrest (soars behind shoulders)
  throneGroup.add(box(28, 32.0, 4.5, 0, 28.5, -6.5, throneMat));
  throneGroup.add(box(24, 10.0, 4.8, 0, 45.0, -6.5, throneTrimMat));

  // Gothic spires and jagged crowns atop backrest
  for (let spx = -12; spx <= 12; spx += 4) {
    const h = 8.0 + (4 - Math.abs(spx * 0.3)) * 2.2;
    const spire = box(1.9, h, 1.9, spx, 49.0 + h * 0.5, -6.5, throneTrimMat);
    throneGroup.add(spire);
  }

  // Carved Demonic Crest atop throne with burning eyes
  const crest = box(7.0, 5.5, 2.6, 0, 48.5, -4.2, throneTrimMat);
  const crestEyeL = box(1.0, 1.0, 0.6, -1.8, 49.0, -2.8, magmaMat);
  const crestEyeR = box(1.0, 1.0, 0.6, 1.8, 49.0, -2.8, magmaMat);
  throneGroup.add(crest, crestEyeL, crestEyeR);

  // ===== 2. THE TITAN SKELETON (THE THINKER / BORED TYRANT) =====
  const skeletonGroup = new THREE.Group();
  skeletonGroup.name = "TitanSkeleton";
  skeletonGroup.scale.set(1.45, 1.45, 1.45);
  skeletonGroup.position.set(0, -4.5, 2.5);
  titanRoot.add(skeletonGroup);

  // Pelvis / Hips (resting on throne seat at Y = 12.5)
  skeletonGroup.add(box(10.5, 3.6, 6.0, 0, 14.0, -1.0, boneMat));

  // --- LEGS ---
  // Left Leg: Thigh forward, knee bent 90° down over throne, shin to step
  const lFemur = box(3.6, 3.6, 9.5, -5.2, 14.5, 4.0, boneMat);
  const lKnee = box(4.2, 4.2, 4.2, -5.2, 14.5, 9.0, boneJointMat);
  const lTibia = box(3.4, 9.5, 3.4, -5.2, 9.5, 9.0, boneMat);
  const lFoot = box(4.2, 2.4, 6.5, -5.2, 7.7, 10.5, boneMat);
  skeletonGroup.add(lFemur, lKnee, lTibia, lFoot);

  // Right Leg: Thigh forward, knee bent 90° down, provides resting base
  const rFemur = box(3.6, 3.6, 9.5, 5.2, 14.5, 4.0, boneMat);
  const rKnee = box(4.2, 4.2, 4.2, 5.2, 14.5, 9.0, boneJointMat);
  const rTibia = box(3.4, 9.5, 3.4, 5.2, 9.5, 9.0, boneMat);
  const rFoot = box(4.2, 2.4, 6.5, 5.2, 7.7, 10.5, boneMat);
  skeletonGroup.add(rFemur, rKnee, rTibia, rFoot);

  // --- SPINE & SEGMENTED VERTEBRAE ---
  const spineGroup = new THREE.Group();
  for (let sy = 16.5; sy <= 26.5; sy += 2.2) {
    spineGroup.add(box(3.2, 1.8, 3.2, 0, sy, -2.0, boneJointMat));
  }
  skeletonGroup.add(spineGroup);

  // --- MASSIVE RIBCAGE & SOUL FIRE ---
  const ribGroup = new THREE.Group();
  ribGroup.name = "TitanRibcage";
  const ribMeshes = [];
  for (let ry = 19.0; ry <= 27.0; ry += 2.2) {
    const rw = 8.5 + (ry - 19.0) * 0.8;
    const rmesh = box(rw, 1.5, 7.5, 0, ry, -1.0, boneMat);
    ribGroup.add(rmesh);
    ribMeshes.push(rmesh);
  }
  skeletonGroup.add(ribGroup);

  // Pulsing Soul Core inside Ribcage
  const soulCore = box(4.0, 6.0, 4.0, 0, 23.0, -1.0, flameMidMat);
  const soulInner = box(2.0, 4.0, 2.0, 0, 23.0, -1.0, flameCoreMat);
  skeletonGroup.add(soulCore, soulInner);

  const soulLight = new THREE.PointLight(0xff4400, 2.0, 42, 1.6);
  soulLight.position.set(0, 23.0, 0);
  skeletonGroup.add(soulLight);

  // Clavicle & Shoulders (broad 18-meter span)
  const shoulders = box(18.0, 3.2, 4.5, 0, 28.5, -2.0, boneMat);
  skeletonGroup.add(shoulders);

  // Flaming Pauldrons on Shoulders
  const lPauldronFire = box(4.5, 4.5, 4.5, -8.5, 30.5, -2.0, flameMidMat);
  const rPauldronFire = box(4.5, 4.5, 4.5, 8.5, 30.5, -2.0, flameMidMat);
  skeletonGroup.add(lPauldronFire, rPauldronFire);

  // --- LEFT ARM (Draped casually over left armrest) ---
  const lUpperArm = box(3.2, 9.5, 3.2, -9.5, 23.5, -1.5, boneMat);
  const lElbow = box(3.6, 3.6, 3.6, -9.5, 19.5, 1.0, boneJointMat);
  const lForearm = box(2.8, 2.8, 9.0, -9.5, 19.5, 5.0, boneMat);
  // Hand draped forward
  const lHand = box(3.4, 2.2, 3.6, -9.5, 18.5, 10.0, boneMat);
  skeletonGroup.add(lUpperArm, lElbow, lForearm, lHand);

  // --- RIGHT ARM: THE THINKER POSE (Fist propping chin/jaw) ---
  // Upper arm descends forward-down towards armrest/knee
  const rUpperArm = new THREE.Group();
  rUpperArm.position.set(8.5, 28.0, -1.5);
  const rHumerus = box(3.4, 10.5, 3.4, 0, -5.0, 0, boneMat);
  rUpperArm.add(rHumerus);
  rUpperArm.rotation.x = 0.55;  // angled forward
  rUpperArm.rotation.z = -0.15; // angled inward
  skeletonGroup.add(rUpperArm);

  // Right Elbow resting near armrest top
  const rElbow = box(4.0, 4.0, 4.0, 7.5, 20.0, 3.5, boneJointMat);
  skeletonGroup.add(rElbow);

  // Forearm angling sharply UPWARD and INWARD directly to the chin
  const rForearmGroup = new THREE.Group();
  rForearmGroup.position.set(7.5, 20.0, 3.5);
  const rRadius = box(3.0, 9.5, 3.0, 0, 4.5, 0, boneMat);
  rForearmGroup.add(rRadius);
  rForearmGroup.rotation.z = 0.65;  // angle inward to center
  rForearmGroup.rotation.x = -0.32; // angle slightly back towards skull
  skeletonGroup.add(rForearmGroup);

  // Giant Skeletal Fist directly under right jaw
  const rFist = box(3.8, 3.6, 4.0, 2.4, 27.5, 2.2, boneMat);
  skeletonGroup.add(rFist);

  // --- 3. THE BURNING TITAN SKULL ---
  const skullGroup = new THREE.Group();
  skullGroup.name = "TitanSkull";
  // Positioned atop neck, tilted to rest against right fist and looking down at arena
  skullGroup.position.set(1.5, 32.5, 0.5);
  skullGroup.rotation.z = -0.12; // tilted towards fist
  skullGroup.rotation.x = 0.22;  // tilted downward towards arena
  skeletonGroup.add(skullGroup);

  // Main Cranium / Braincase
  const cranium = box(6.8, 7.2, 7.0, 0, 2.0, 0, boneMat);
  // Brow / Eye Ridge
  const brow = box(6.5, 2.8, 2.5, 0, 1.2, 3.2, boneMat);
  // Cheekbones
  const cheekL = box(1.8, 2.4, 2.0, -2.4, -0.6, 2.8, boneMat);
  const cheekR = box(1.8, 2.4, 2.0, 2.4, -0.6, 2.8, boneMat);
  // Maxilla (Upper jaw with teeth)
  const maxilla = box(4.8, 2.6, 2.8, 0, -1.8, 2.6, boneJointMat);

  // Mandible (Lower jaw resting solidly upon the fist below!)
  const mandible = box(4.4, 2.0, 3.2, 0.4, -3.8, 2.2, boneMat);

  // Hollow Eye Sockets
  const eyeSocketL = box(1.6, 1.6, 0.8, -1.6, 1.2, 4.2, new THREE.MeshBasicMaterial({ color: 0x050100 }));
  const eyeSocketR = box(1.6, 1.6, 0.8, 1.6, 1.2, 4.2, new THREE.MeshBasicMaterial({ color: 0x050100 }));

  // Blazing Fire Eyes (piercing stare down into the arena)
  const eyeFireL = box(1.0, 1.0, 0.6, -1.6, 1.2, 4.4, flameCoreMat);
  const eyeFireR = box(1.0, 1.0, 0.6, 1.6, 1.2, 4.4, flameCoreMat);
  const eyeAuraL = box(1.8, 1.8, 0.8, -1.6, 1.2, 4.4, flameMidMat);
  const eyeAuraR = box(1.8, 1.8, 0.8, 1.6, 1.2, 4.4, flameMidMat);

  // Skull Point Light casting infernal gaze down into arena
  const gazeLight = new THREE.PointLight(0xff7700, 2.8, 65, 1.5);
  gazeLight.position.set(0, 1.2, 5.0);
  skullGroup.add(gazeLight);

  // Roaring Crown of Fire atop Skull
  const fireCrownGroup = new THREE.Group();
  const crownFlames = [];
  for (let fy = 5.5; fy <= 12.0; fy += 2.0) {
    const fs = 5.5 - (fy - 5.5) * 0.45;
    const fMid = box(fs, 2.4, fs, 0, fy, 0, flameMidMat);
    const fCore = box(fs * 0.55, 2.2, fs * 0.55, 0, fy, 0, flameCoreMat);
    fireCrownGroup.add(fMid, fCore);
    crownFlames.push(fMid);
  }
  skullGroup.add(cranium, brow, cheekL, cheekR, maxilla, mandible, eyeSocketL, eyeSocketR, eyeFireL, eyeFireR, eyeAuraL, eyeAuraR, fireCrownGroup);

  // ===== 4. THE TITANIC FLAMING GREATSWORD =====
  // Planted blade-first into the stone dais beside throne on the left (X ~ -17.5, Z ~ 5.5)
  const swordGroup = new THREE.Group();
  swordGroup.name = "TitanicFlamingGreatsword";
  swordGroup.scale.set(1.45, 1.45, 1.45);
  swordGroup.position.set(-17.5, 5.0, 5.5);
  // Slight menacing tilt towards the throne
  swordGroup.rotation.z = -0.06;
  swordGroup.rotation.x = 0.08;
  titanRoot.add(swordGroup);

  // Giant 22-meter double-edged blade
  const blade = box(1.5, 22.0, 3.4, 0, 11.0, 0, swordSteelMat);
  // Central fuller with blazing fire
  const bladeCore = box(1.8, 20.0, 1.6, 0, 11.0, 0, flameCoreMat);
  const bladeAura = box(2.4, 21.0, 3.8, 0, 11.0, 0, flameMidMat);
  const bladeEdgeOuter = box(3.0, 22.5, 4.4, 0, 11.0, 0, flameOuterMat);

  // Massive horned Crossguard (9m wide)
  const crossguard = box(2.8, 2.4, 9.5, 0, 22.5, 0, swordSteelMat);
  // Demon horns at quillon tips
  const hornL = box(2.4, 4.5, 1.8, 0, 24.5, -4.8, throneTrimMat);
  hornL.rotation.x = -0.35;
  const hornR = box(2.4, 4.5, 1.8, 0, 24.5, 4.8, throneTrimMat);
  hornR.rotation.x = 0.35;

  // Grip (5.5m tall)
  const grip = box(1.4, 5.5, 1.4, 0, 26.5, 0, new THREE.MeshStandardMaterial({ color: 0x140e18, roughness: 0.9 }));

  // Pommel (blazing demonic skull)
  const pommel = box(2.6, 2.6, 2.6, 0, 30.0, 0, flameCoreMat);
  const pommelAura = box(4.0, 4.0, 4.0, 0, 30.0, 0, flameMidMat);

  swordGroup.add(blade, bladeCore, bladeAura, bladeEdgeOuter, crossguard, hornL, hornR, grip, pommel, pommelAura);

  // Sword Fire Light
  const swordLight = new THREE.PointLight(0xff5500, 2.2, 45, 1.5);
  swordLight.position.set(0, 16.0, 0);
  swordGroup.add(swordLight);

  // Dedicated illumination light to sculpt the skeleton features from front
  const titanIllum = new THREE.DirectionalLight(0xffcaa0, 1.35);
  titanIllum.position.set(0, 25, 35);
  titanIllum.target = skeletonGroup;
  titanRoot.add(titanIllum, titanIllum.target);

  // ===== 5. FLOATING INFERNAL EMBERS & ASH PARTICLES =====
  const emberCount = 55;
  const emberGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const emberMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });

  const embers = [];
  const emberGroup = new THREE.Group();
  emberGroup.name = "TitanEmbers";
  titanRoot.add(emberGroup);

  for (let i = 0; i < emberCount; i++) {
    const mesh = new THREE.Mesh(emberGeo, emberMat);
    emberGroup.add(mesh);

    // Randomize initial position around throne, skull and sword
    const src = Math.random();
    let bx, by, bz;
    if (src < 0.40) {
      // Around skull crown
      bx = (Math.random() - 0.5) * 8.0;
      by = 33.0 + Math.random() * 8.0;
      bz = (Math.random() - 0.5) * 8.0;
    } else if (src < 0.75) {
      // Around flaming greatsword
      bx = -17.5 + (Math.random() - 0.5) * 6.0;
      by = 8.0 + Math.random() * 24.0;
      bz = 5.5 + (Math.random() - 0.5) * 6.0;
    } else {
      // Around braziers & shoulders
      bx = (Math.random() < 0.5 ? -12.0 : 12.0) + (Math.random() - 0.5) * 4.0;
      by = 20.0 + Math.random() * 12.0;
      bz = (Math.random() - 0.5) * 6.0;
    }

    mesh.position.set(bx, by, bz);
    embers.push({
      mesh,
      baseX: bx,
      baseZ: bz,
      vy: 2.5 + Math.random() * 3.5,
      driftSpeed: 0.8 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      maxHeight: by + 18.0 + Math.random() * 15.0,
      startY: by
    });
  }

  // ===== ANIMATION / TICK LOOP =====
  let totalTime = 0;

  function tick(dt) {
    totalTime += dt;

    // 1. Ominous Ribcage Breathing (slow 4.0s respiratory cycle)
    const breath = Math.sin(totalTime * 1.5) * 0.035;
    ribGroup.scale.set(1.0 + breath, 1.0 + breath * 0.5, 1.0 + breath);
    soulCore.scale.set(1.0 + breath * 1.5, 1.0 + breath * 1.5, 1.0 + breath * 1.5);
    soulLight.intensity = 1.8 + 0.6 * Math.sin(totalTime * 2.5);

    // 2. Flickering Eye Fire & Searing Gaze
    const eyeFlicker = 0.90 + 0.25 * Math.sin(totalTime * 14.0) + 0.15 * Math.cos(totalTime * 22.0);
    eyeFireL.scale.set(eyeFlicker, eyeFlicker, eyeFlicker);
    eyeFireR.scale.set(eyeFlicker, eyeFlicker, eyeFlicker);
    gazeLight.intensity = 2.4 * eyeFlicker;

    // 3. Subtle slow head pan (the Bored Tyrant lazily scanning the arena)
    const headPan = Math.sin(totalTime * 0.35) * 0.04;
    skullGroup.rotation.y = headPan;

    // 4. Roaring Crown & Shoulder Flames Wave
    for (let i = 0; i < crownFlames.length; i++) {
      const f = crownFlames[i];
      const w = 1.0 + 0.18 * Math.sin(totalTime * 6.0 + i * 1.2);
      f.scale.set(w, 1.0 + 0.12 * Math.cos(totalTime * 8.0 + i), w);
    }
    const pauldronW = 1.0 + 0.15 * Math.sin(totalTime * 7.0);
    lPauldronFire.scale.set(pauldronW, pauldronW, pauldronW);
    rPauldronFire.scale.set(pauldronW, pauldronW, pauldronW);

    // 5. Blazing Greatsword Flames Pulsing
    const swordPulse = 1.0 + 0.12 * Math.sin(totalTime * 5.0);
    bladeAura.scale.set(swordPulse, 1.0, swordPulse);
    bladeEdgeOuter.scale.set(swordPulse * 1.05, 1.0, swordPulse * 1.05);
    swordLight.intensity = 2.0 + 0.6 * Math.sin(totalTime * 4.0);

    // 6. Floating Ember Particles Rising into the Sky
    for (let i = 0; i < embers.length; i++) {
      const p = embers[i];
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x = p.baseX + Math.sin(totalTime * p.driftSpeed + p.phase) * 1.5;
      p.mesh.position.z = p.baseZ + Math.cos(totalTime * p.driftSpeed + p.phase) * 1.5;

      const progress = (p.mesh.position.y - p.startY) / (p.maxHeight - p.startY);
      const s = Math.max(0.1, 1.0 - progress);
      p.mesh.scale.set(s, s, s);

      if (p.mesh.position.y >= p.maxHeight) {
        p.mesh.position.y = p.startY;
      }
    }
  }

  return {
    root: titanRoot,
    tick
  };
}
