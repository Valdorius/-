import * as THREE from "three";

/**
 * Sky Titan: Colossal Flaming Skeleton on a Gothic Obsidian Throne.
 * Sits in the northern skybox / horizon (Z ~ -74), towering over the arena walls.
 * Pose: Bored Emperor / Thinker — resting jaw/chin on right fist, watching gladiator battles below.
 * Holds/plants a colossal blazing greatsword beside his throne (offset to X ~ -26).
 *
 * BOSS / CELESTIAL STAGE HAZARD:
 * Periodically (every ~28s), the Titan awakens, roars, rises to full monumental height,
 * draws the colossal flaming greatsword, targets a sector of the arena with an infernal
 * runic telegraph, and slams the blade down — carpeting a 12.5m area in raging fire
 * that scorches enemies and player alike, before returning to his throne.
 */
export function createSkyTitan({ engine, world, audio = null, player = null, enemies = null, fx = null }) {
  const { scene, camera } = engine;

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

  // Magma cracks on throne & plinth
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

  // Stepped Dais (3 massive tiers, widened to support side weapon plinth)
  throneGroup.add(box(54, 3.0, 32, -3, 1.5, 2, throneMat));
  throneGroup.add(box(44, 2.5, 28, -2, 4.25, 2, throneMat));
  throneGroup.add(box(32, 2.0, 24, 0, 6.5, 2, throneTrimMat));

  // Magma fissures on steps
  for (let sx = -14; sx <= 14; sx += 7) {
    const crack = box(0.6, 0.05, 14, sx, 7.52, 2, magmaMat);
    crack.rotation.y = (sx % 14) * 0.08;
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

  // Dedicated Carved Obsidian Weapon Plinth / Altar at X = -25.5 (further away from skeleton)
  const SWORD_REST_X = -25.5;
  const SWORD_REST_Y = 4.8;
  const SWORD_REST_Z = 6.0;

  const swordPlinth = new THREE.Group();
  swordPlinth.position.set(SWORD_REST_X, 0, SWORD_REST_Z);
  swordPlinth.add(box(7.5, 4.0, 7.5, 0, 2.0, 0, throneMat));
  swordPlinth.add(box(6.0, 1.5, 6.0, 0, 4.5, 0, throneTrimMat));
  // Magma cracks on sword plinth
  const plinthCrack = box(0.8, 0.08, 4.8, 0, 5.28, 0, magmaMat);
  plinthCrack.rotation.y = 0.45;
  swordPlinth.add(plinthCrack);
  throneGroup.add(swordPlinth);

  // ===== 2. THE TITAN SKELETON (ARTICULATED FOR STANDING & STRIKING) =====
  const skeletonGroup = new THREE.Group();
  skeletonGroup.name = "TitanSkeleton";
  skeletonGroup.scale.set(1.45, 1.45, 1.45);
  // Seated base coordinates
  const SEAT_POS = new THREE.Vector3(0, -4.5, 2.5);
  const STAND_POS = new THREE.Vector3(-4.0, 3.8, 9.5);
  skeletonGroup.position.copy(SEAT_POS);
  titanRoot.add(skeletonGroup);

  // Pelvis / Hips
  const pelvis = box(10.5, 3.6, 6.0, 0, 14.0, -1.0, boneMat);
  skeletonGroup.add(pelvis);

  // --- ARTICULATED LEGS ---
  // Left Leg
  const legLGroup = new THREE.Group();
  legLGroup.position.set(-5.2, 14.0, -0.5);
  skeletonGroup.add(legLGroup);
  const lFemur = box(3.6, 3.6, 9.5, 0, 0.5, 4.5, boneMat);
  const lKnee = box(4.2, 4.2, 4.2, 0, 0.5, 9.2, boneJointMat);
  const lTibia = box(3.4, 9.5, 3.4, 0, -4.5, 9.2, boneMat);
  const lFoot = box(4.2, 2.4, 6.5, 0, -6.3, 10.7, boneMat);
  legLGroup.add(lFemur, lKnee, lTibia, lFoot);

  // Right Leg
  const legRGroup = new THREE.Group();
  legRGroup.position.set(5.2, 14.0, -0.5);
  skeletonGroup.add(legRGroup);
  const rFemur = box(3.6, 3.6, 9.5, 0, 0.5, 4.5, boneMat);
  const rKnee = box(4.2, 4.2, 4.2, 0, 0.5, 9.2, boneJointMat);
  const rTibia = box(3.4, 9.5, 3.4, 0, -4.5, 9.2, boneMat);
  const rFoot = box(4.2, 2.4, 6.5, 0, -6.3, 10.7, boneMat);
  legRGroup.add(rFemur, rKnee, rTibia, rFoot);

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

  // Clavicle & Shoulders
  const shoulders = box(18.0, 3.2, 4.5, 0, 28.5, -2.0, boneMat);
  skeletonGroup.add(shoulders);

  // Flaming Pauldrons on Shoulders
  const lPauldronFire = box(4.5, 4.5, 4.5, -8.5, 30.5, -2.0, flameMidMat);
  const rPauldronFire = box(4.5, 4.5, 4.5, 8.5, 30.5, -2.0, flameMidMat);
  skeletonGroup.add(lPauldronFire, rPauldronFire);

  // --- ARTICULATED LEFT ARM ---
  const lArmRoot = new THREE.Group();
  lArmRoot.position.set(-9.5, 28.0, -1.5);
  skeletonGroup.add(lArmRoot);
  const lUpperArm = box(3.2, 9.5, 3.2, 0, -4.5, 0, boneMat);
  const lElbow = box(3.6, 3.6, 3.6, 0, -8.5, 2.5, boneJointMat);
  const lForearm = box(2.8, 2.8, 9.0, 0, -8.5, 6.5, boneMat);
  const lHand = box(3.4, 2.2, 3.6, 0, -9.5, 11.5, boneMat);
  lArmRoot.add(lUpperArm, lElbow, lForearm, lHand);

  // --- ARTICULATED RIGHT ARM (THE THINKER / ATTACK ARM) ---
  const rArmRoot = new THREE.Group();
  rArmRoot.position.set(8.5, 28.0, -1.5);
  skeletonGroup.add(rArmRoot);

  const rHumerus = box(3.4, 10.5, 3.4, 0, -5.0, 0, boneMat);
  rArmRoot.add(rHumerus);

  // Right Elbow & Forearm
  const rForearmGroup = new THREE.Group();
  rForearmGroup.position.set(0, -9.5, 0);
  rArmRoot.add(rForearmGroup);
  const rElbow = box(4.0, 4.0, 4.0, 0, 0, 0, boneJointMat);
  const rRadius = box(3.0, 9.5, 3.0, 0, 4.5, 0, boneMat);
  const rFist = box(3.8, 3.6, 4.0, 0, 9.0, 0, boneMat);
  rForearmGroup.add(rElbow, rRadius, rFist);

  // Thinker Seated Default Rotations
  const R_ARM_SEAT_ROT = new THREE.Euler(0.55, 0, -0.15);
  const R_FOREARM_SEAT_ROT = new THREE.Euler(-0.32, 0, 0.65);
  rArmRoot.rotation.copy(R_ARM_SEAT_ROT);
  rForearmGroup.rotation.copy(R_FOREARM_SEAT_ROT);

  // --- 3. THE BURNING TITAN SKULL ---
  const skullGroup = new THREE.Group();
  skullGroup.name = "TitanSkull";
  skullGroup.position.set(1.5, 32.5, 0.5);
  skullGroup.rotation.z = -0.12; // tilted towards fist
  skullGroup.rotation.x = 0.22;  // tilted downward towards arena
  skeletonGroup.add(skullGroup);

  // Main Cranium / Braincase
  const cranium = box(6.8, 7.2, 7.0, 0, 2.0, 0, boneMat);
  const brow = box(6.5, 2.8, 2.5, 0, 1.2, 3.2, boneMat);
  const cheekL = box(1.8, 2.4, 2.0, -2.4, -0.6, 2.8, boneMat);
  const cheekR = box(1.8, 2.4, 2.0, 2.4, -0.6, 2.8, boneMat);
  const maxilla = box(4.8, 2.6, 2.8, 0, -1.8, 2.6, boneJointMat);
  const mandible = box(4.4, 2.0, 3.2, 0.4, -3.8, 2.2, boneMat);

  const eyeSocketL = box(1.6, 1.6, 0.8, -1.6, 1.2, 4.2, new THREE.MeshBasicMaterial({ color: 0x050100 }));
  const eyeSocketR = box(1.6, 1.6, 0.8, 1.6, 1.2, 4.2, new THREE.MeshBasicMaterial({ color: 0x050100 }));
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
  // Planted blade-first into the dedicated altar at X = -25.5
  const swordGroup = new THREE.Group();
  swordGroup.name = "TitanicFlamingGreatsword";
  swordGroup.scale.set(1.45, 1.45, 1.45);
  swordGroup.position.set(SWORD_REST_X, SWORD_REST_Y, SWORD_REST_Z);
  swordGroup.rotation.set(0.08, 0, -0.06);
  titanRoot.add(swordGroup);

  // Giant 22-meter double-edged blade
  const blade = box(1.5, 22.0, 3.4, 0, 11.0, 0, swordSteelMat);
  const bladeCore = box(1.8, 20.0, 1.6, 0, 11.0, 0, flameCoreMat);
  const bladeAura = box(2.4, 21.0, 3.8, 0, 11.0, 0, flameMidMat);
  const bladeEdgeOuter = box(3.0, 22.5, 4.4, 0, 11.0, 0, flameOuterMat);

  // Massive horned Crossguard (9.5m wide)
  const crossguard = box(2.8, 2.4, 9.5, 0, 22.5, 0, swordSteelMat);
  const hornL = box(2.4, 4.5, 1.8, 0, 24.5, -4.8, throneTrimMat);
  hornL.rotation.x = -0.35;
  const hornR = box(2.4, 4.5, 1.8, 0, 24.5, 4.8, throneTrimMat);
  hornR.rotation.x = 0.35;

  const grip = box(1.4, 5.5, 1.4, 0, 26.5, 0, new THREE.MeshStandardMaterial({ color: 0x140e18, roughness: 0.9 }));
  const pommel = box(2.6, 2.6, 2.6, 0, 30.0, 0, flameCoreMat);
  const pommelAura = box(4.0, 4.0, 4.0, 0, 30.0, 0, flameMidMat);

  swordGroup.add(blade, bladeCore, bladeAura, bladeEdgeOuter, crossguard, hornL, hornR, grip, pommel, pommelAura);

  // Sword Fire Light
  const swordLight = new THREE.PointLight(0xff5500, 2.4, 45, 1.5);
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

    const src = Math.random();
    let bx, by, bz;
    if (src < 0.35) {
      // Around skull crown
      bx = (Math.random() - 0.5) * 8.0;
      by = 33.0 + Math.random() * 8.0;
      bz = (Math.random() - 0.5) * 8.0;
    } else if (src < 0.70) {
      // Around flaming greatsword
      bx = SWORD_REST_X + (Math.random() - 0.5) * 6.0;
      by = 8.0 + Math.random() * 24.0;
      bz = SWORD_REST_Z + (Math.random() - 0.5) * 6.0;
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

  // ===== 6. ARENA INFERNAL SMITE HAZARD (CARPET OF FIRE) =====
  // 12.5-meter radius danger zone on the arena ground
  const SMITE_RADIUS = 12.5;
  const smiteCarpetGroup = new THREE.Group();
  smiteCarpetGroup.name = "TitanSmiteCarpet";
  smiteCarpetGroup.visible = false;
  scene.add(smiteCarpetGroup);

  // Scorched magma disc on the arena ground
  const carpetGeo = new THREE.CylinderGeometry(SMITE_RADIUS, SMITE_RADIUS, 0.12, 32);
  const carpetMat = new THREE.MeshStandardMaterial({
    color: 0x240600,
    emissive: 0xff3300,
    emissiveIntensity: 0.0,
    roughness: 0.4,
    transparent: true,
    opacity: 0.0
  });
  const carpetMesh = new THREE.Mesh(carpetGeo, carpetMat);
  carpetMesh.position.set(0, 0.06, 0);
  smiteCarpetGroup.add(carpetMesh);

  // Outer glowing runic ring
  const ringGeo = new THREE.RingGeometry(SMITE_RADIUS - 0.8, SMITE_RADIUS + 0.2, 40);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff5500,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.set(0, 0.14, 0);
  smiteCarpetGroup.add(ringMesh);

  // Roaring flame quads on the carpet
  const groundFlameQuads = [];
  const gFlameGeo = new THREE.BoxGeometry(1.6, 3.2, 1.6);
  for (let i = 0; i < 24; i++) {
    const fQuad = new THREE.Mesh(gFlameGeo, flameMidMat);
    const rAng = Math.random() * Math.PI * 2;
    const rDist = Math.random() * (SMITE_RADIUS - 1.5);
    fQuad.position.set(Math.cos(rAng) * rDist, 1.6, Math.sin(rAng) * rDist);
    fQuad.visible = false;
    smiteCarpetGroup.add(fQuad);
    groundFlameQuads.push({
      mesh: fQuad,
      baseX: fQuad.position.x,
      baseZ: fQuad.position.z,
      phase: Math.random() * Math.PI * 2,
      speed: 8.0 + Math.random() * 8.0
    });
  }

  // Dynamic point light for the burning ground
  const carpetLight = new THREE.PointLight(0xff4400, 0, 32, 1.8);
  carpetLight.position.set(0, 2.5, 0);
  smiteCarpetGroup.add(carpetLight);

  // ===== 7. STATE MACHINE & COMBAT CYCLE =====
  // States: "SEATED", "AWAKEN", "STAND_AND_DRAW", "AIM_TELEGRAPH", "SLAM", "BURN_ACTIVE", "RETURN"
  let attackState = "SEATED";
  let stateTimer = 0;
  let cooldownUntilNextSmite = 18.0; // first strike at 18s, then every ~28s
  const targetPos = new THREE.Vector3(0, 0, 0);
  let totalTime = 0;

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function pickTargetZone() {
    // Lead player position slightly, clamped to arena bounds (-24 to +24)
    if (player?.position) {
      targetPos.x = THREE.MathUtils.clamp(player.position.x * 0.85, -20, 20);
      targetPos.z = THREE.MathUtils.clamp(player.position.z * 0.85, -20, 20);
    } else {
      targetPos.set(0, 0, 0);
    }
    smiteCarpetGroup.position.set(targetPos.x, 0, targetPos.z);
  }

  function tickCombat(dt) {
    stateTimer += dt;

    switch (attackState) {
      case "SEATED": {
        cooldownUntilNextSmite -= dt;
        if (cooldownUntilNextSmite <= 0) {
          attackState = "AWAKEN";
          stateTimer = 0;
          pickTargetZone();
          audio?.playTitanRoar?.();
        }
        break;
      }

      case "AWAKEN": {
        // 1.5 seconds of awakening: eyes flare, skull tilts towards target
        const p = Math.min(1.0, stateTimer / 1.5);
        gazeLight.intensity = 2.4 + 4.5 * p;
        gazeLight.color.setHex(p > 0.5 ? 0xff2200 : 0xff7700);

        // Right arm fist releases from chin
        const armP = easeInOutCubic(p);
        rArmRoot.rotation.x = THREE.MathUtils.lerp(R_ARM_SEAT_ROT.x, 0.15, armP);
        rArmRoot.rotation.z = THREE.MathUtils.lerp(R_ARM_SEAT_ROT.z, -0.45, armP);
        rForearmGroup.rotation.z = THREE.MathUtils.lerp(R_FOREARM_SEAT_ROT.z, 0.10, armP);

        if (stateTimer >= 1.5) {
          attackState = "STAND_AND_DRAW";
          stateTimer = 0;
        }
        break;
      }

      case "STAND_AND_DRAW": {
        // 2.5 seconds: Titan stands up from the throne, strides forward, grips and lifts the sword!
        const p = Math.min(1.0, stateTimer / 2.5);
        const k = easeInOutCubic(p);

        // Skeleton elevates and steps forward to the dais front
        skeletonGroup.position.lerpVectors(SEAT_POS, STAND_POS, k);

        // Legs unbend into tall standing posture
        legLGroup.rotation.x = THREE.MathUtils.lerp(0, 0.85, k);
        legRGroup.rotation.x = THREE.MathUtils.lerp(0, 0.85, k);
        lTibia.position.z = THREE.MathUtils.lerp(9.2, 5.0, k);
        rTibia.position.z = THREE.MathUtils.lerp(9.2, 5.0, k);

        // Arms reach out towards the greatsword at X = -25.5
        rArmRoot.rotation.set(
          THREE.MathUtils.lerp(0.15, -0.65, k),
          THREE.MathUtils.lerp(0, 0.45, k),
          THREE.MathUtils.lerp(-0.45, -0.85, k)
        );
        lArmRoot.rotation.set(
          THREE.MathUtils.lerp(0, -0.55, k),
          THREE.MathUtils.lerp(0, -0.30, k),
          THREE.MathUtils.lerp(0, 0.65, k)
        );

        // Sword lifts from the altar into two-handed grip above head!
        swordGroup.position.set(
          THREE.MathUtils.lerp(SWORD_REST_X, -6.0, k),
          THREE.MathUtils.lerp(SWORD_REST_Y, 26.0, k),
          THREE.MathUtils.lerp(SWORD_REST_Z, 12.0, k)
        );
        swordGroup.rotation.set(
          THREE.MathUtils.lerp(0.08, -0.45, k),
          THREE.MathUtils.lerp(0, 0.15, k),
          THREE.MathUtils.lerp(-0.06, 0.25, k)
        );

        if (stateTimer >= 2.5) {
          attackState = "AIM_TELEGRAPH";
          stateTimer = 0;
          smiteCarpetGroup.visible = true;
        }
        break;
      }

      case "AIM_TELEGRAPH": {
        // 2.2 seconds: Sword raised high above head, raging flames, ground telegraph pulses with infernal danger!
        const p = Math.min(1.0, stateTimer / 2.2);
        const pulse = 0.5 + 0.5 * Math.sin(stateTimer * 10.0);

        // Sword raised to zenith
        swordGroup.position.set(-4.0, 32.0 + Math.sin(stateTimer * 4.0) * 1.5, 14.0);
        swordGroup.rotation.set(-0.85, 0.10, 0.35);

        // Skull glares down directly at the target spot
        skullGroup.rotation.x = 0.45;

        // Telegraph circle glows on arena floor
        carpetMat.opacity = 0.25 + 0.35 * pulse;
        carpetMat.emissiveIntensity = 0.6 + 1.2 * pulse;
        ringMat.opacity = 0.55 + 0.45 * pulse;
        ringMesh.rotation.z += dt * 1.8;
        carpetLight.intensity = 1.8 * pulse;

        if (stateTimer >= 2.2) {
          attackState = "SLAM";
          stateTimer = 0;
        }
        break;
      }

      case "SLAM": {
        // 0.45 seconds: Cataclysmic downward slash down towards the arena!
        const p = Math.min(1.0, stateTimer / 0.45);
        const k = p * p; // rapid acceleration

        // Sword arcs down with titanic velocity!
        swordGroup.position.set(
          THREE.MathUtils.lerp(-4.0, targetPos.x * 0.35, k),
          THREE.MathUtils.lerp(32.0, 6.0, k),
          THREE.MathUtils.lerp(14.0, 36.0, k)
        );
        swordGroup.rotation.set(
          THREE.MathUtils.lerp(-0.85, 1.15, k),
          0,
          THREE.MathUtils.lerp(0.35, -0.10, k)
        );

        // Skeleton lunges forward into the swing
        skeletonGroup.rotation.x = THREE.MathUtils.lerp(0, 0.28, k);

        if (stateTimer >= 0.45) {
          attackState = "BURN_ACTIVE";
          stateTimer = 0;

          // Impact detonation!
          audio?.playTitanSlam?.();
          fx?.addShockwave?.(targetPos, 14.0, 0xff3300);
          fx?.addHit?.(targetPos, "bomb", 4.5);

          // Activate ground fire carpet
          carpetMat.opacity = 0.85;
          carpetMat.emissiveIntensity = 2.4;
          ringMat.opacity = 1.0;
          carpetLight.intensity = 4.5;
          for (const q of groundFlameQuads) q.mesh.visible = true;
        }
        break;
      }

      case "BURN_ACTIVE": {
        // 5.0 seconds of roaring fire carpet covering the arena area
        const p = Math.min(1.0, stateTimer / 5.0);
        audio?.playFireSizzle?.();

        // Animate ground flames
        for (const q of groundFlameQuads) {
          const fw = 1.0 + 0.35 * Math.sin(totalTime * q.speed + q.phase);
          const fh = 1.0 + 0.50 * Math.cos(totalTime * q.speed * 0.8 + q.phase);
          q.mesh.scale.set(fw, fh, fw);
        }
        ringMesh.rotation.z += dt * 2.2;

        // Damage calculation (60 DPS to enemies, 14 DPS to player inside 12.5m)
        const radiusSq = SMITE_RADIUS * SMITE_RADIUS;

        // Burn enemies
        if (enemies && typeof enemies.forEachInRadius === "function") {
          enemies.forEachInRadius(targetPos, SMITE_RADIUS, (e) => {
            const ep = e.pos || e.position || e.root?.position;
            if (!ep) return;
            const d2 = (ep.x - targetPos.x) ** 2 + (ep.z - targetPos.z) ** 2;
            if (d2 <= radiusSq) {
              enemies.damage(e.id, 65 * dt, {
                kind: "fire_smite",
                damageKind: "burn",
                point: ep,
                burn: { dps: 18, dur: 3.0 }
              });
            }
          });
        }

        // Burn player if standing inside fire carpet
        if (player?.position && typeof player.applyDamage === "function") {
          const pp = player.position;
          const pd2 = (pp.x - targetPos.x) ** 2 + (pp.z - targetPos.z) ** 2;
          if (pd2 <= radiusSq) {
            player.applyDamage(14 * dt);
          }
        }

        // Fade out during last second
        if (p > 0.80) {
          const fade = 1.0 - (p - 0.80) / 0.20;
          carpetMat.opacity = 0.85 * fade;
          carpetMat.emissiveIntensity = 2.4 * fade;
          ringMat.opacity = fade;
          carpetLight.intensity = 4.5 * fade;
        }

        if (stateTimer >= 5.0) {
          attackState = "RETURN";
          stateTimer = 0;
          smiteCarpetGroup.visible = false;
          for (const q of groundFlameQuads) q.mesh.visible = false;
        }
        break;
      }

      case "RETURN": {
        // 3.0 seconds: Titan steps back, replants sword in plinth, lowers himself into throne, fist to chin
        const p = Math.min(1.0, stateTimer / 3.0);
        const k = easeInOutCubic(p);

        // Skeleton returns to seated pose
        skeletonGroup.position.lerpVectors(STAND_POS, SEAT_POS, k);
        skeletonGroup.rotation.x = THREE.MathUtils.lerp(0.28, 0, k);

        legLGroup.rotation.x = THREE.MathUtils.lerp(0.85, 0, k);
        legRGroup.rotation.x = THREE.MathUtils.lerp(0.85, 0, k);
        lTibia.position.z = THREE.MathUtils.lerp(5.0, 9.2, k);
        rTibia.position.z = THREE.MathUtils.lerp(5.0, 9.2, k);

        // Sword returns to plinth
        swordGroup.position.set(
          THREE.MathUtils.lerp(targetPos.x * 0.35, SWORD_REST_X, k),
          THREE.MathUtils.lerp(6.0, SWORD_REST_Y, k),
          THREE.MathUtils.lerp(36.0, SWORD_REST_Z, k)
        );
        swordGroup.rotation.set(
          THREE.MathUtils.lerp(1.15, 0.08, k),
          0,
          THREE.MathUtils.lerp(-0.10, -0.06, k)
        );

        // Arms return to Thinker pose
        rArmRoot.rotation.set(
          THREE.MathUtils.lerp(0.15, R_ARM_SEAT_ROT.x, k),
          THREE.MathUtils.lerp(0.45, 0, k),
          THREE.MathUtils.lerp(-0.45, R_ARM_SEAT_ROT.z, k)
        );
        rForearmGroup.rotation.z = THREE.MathUtils.lerp(0.10, R_FOREARM_SEAT_ROT.z, k);
        lArmRoot.rotation.set(
          THREE.MathUtils.lerp(-0.55, 0, k),
          0,
          THREE.MathUtils.lerp(0.65, 0, k)
        );

        // Skull tilts back to resting on fist
        skullGroup.rotation.set(
          THREE.MathUtils.lerp(0.45, 0.22, k),
          0,
          THREE.MathUtils.lerp(0, -0.12, k)
        );
        gazeLight.intensity = THREE.MathUtils.lerp(6.0, 2.4, k);
        gazeLight.color.setHex(0xff7700);

        if (stateTimer >= 3.0) {
          attackState = "SEATED";
          stateTimer = 0;
          cooldownUntilNextSmite = 28.0; // regular interval
        }
        break;
      }
    }
  }

  // ===== ANIMATION / TICK LOOP =====
  function tick(dt) {
    totalTime += dt;

    // Run combat state machine
    tickCombat(dt);

    // 1. Ominous Ribcage Breathing (slow 4.0s respiratory cycle)
    const breath = Math.sin(totalTime * 1.5) * 0.035;
    ribGroup.scale.set(1.0 + breath, 1.0 + breath * 0.5, 1.0 + breath);
    soulCore.scale.set(1.0 + breath * 1.5, 1.0 + breath * 1.5, 1.0 + breath * 1.5);
    soulLight.intensity = 1.8 + 0.6 * Math.sin(totalTime * 2.5);

    // 2. Flickering Eye Fire & Searing Gaze
    const eyeFlicker = 0.90 + 0.25 * Math.sin(totalTime * 14.0) + 0.15 * Math.cos(totalTime * 22.0);
    eyeFireL.scale.set(eyeFlicker, eyeFlicker, eyeFlicker);
    eyeFireR.scale.set(eyeFlicker, eyeFlicker, eyeFlicker);
    if (attackState === "SEATED") {
      gazeLight.intensity = 2.4 * eyeFlicker;
      // Subtle slow head pan (the Bored Tyrant lazily scanning the arena)
      skullGroup.rotation.y = Math.sin(totalTime * 0.35) * 0.04;
    }

    // 3. Roaring Crown & Shoulder Flames Wave
    for (let i = 0; i < crownFlames.length; i++) {
      const f = crownFlames[i];
      const w = 1.0 + 0.18 * Math.sin(totalTime * 6.0 + i * 1.2);
      f.scale.set(w, 1.0 + 0.12 * Math.cos(totalTime * 8.0 + i), w);
    }
    const pauldronW = 1.0 + 0.15 * Math.sin(totalTime * 7.0);
    lPauldronFire.scale.set(pauldronW, pauldronW, pauldronW);
    rPauldronFire.scale.set(pauldronW, pauldronW, pauldronW);

    // 4. Blazing Greatsword Flames Pulsing
    const swordPulse = 1.0 + 0.15 * Math.sin(totalTime * 5.0);
    bladeAura.scale.set(swordPulse, 1.0, swordPulse);
    bladeEdgeOuter.scale.set(swordPulse * 1.08, 1.0, swordPulse * 1.08);
    swordLight.intensity = 2.2 + 0.8 * Math.sin(totalTime * 4.0);

    // 5. Floating Ember Particles Rising into the Sky
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
    carpet: smiteCarpetGroup,
    tick,
    get state() { return attackState; }
  };
}
