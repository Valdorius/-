import { clamp } from "../core/math.js";

export function createProgression({ player, hud, weapons, audio=null }){
  let level = 1;
  let xp = 0;
  let xpNext = 50;
  let kills = 0;
  let freezeT = 0;

  // Shared combat stats (modules can read this)
  const stats = {
    damageMul: 1.0,        // all outgoing damage
    arenaDamageMul: 1.0,    // temporary outgoing damage debuffs
    attackSpeedMul: 1.0,   // lower cooldowns
    moveSpeedMul: 1.0,     // player movement
    arenaMoveSpeedMul: 1.0, // temporary debuffs from arena mechanics
    projectileSpeedMul: 1.0,
    projectilePierce: 0,   // extra pierces
    lifesteal: 0.0,        // heal = dealtDamage * lifesteal
    regen: 0.0,            // hp/sec
    maxHpBonus: 0,         // flat
    // weapon-specific fields (initialized lazily)
    spearDamageMul: 1.0,
    spearAttackSpeedMul: 1.0,
    spearReachMul: 1.0,
    spearArcMul: 1.0,
    hammerDamageMul: 1.0,
    hammerAttackSpeedMul: 1.0,
    hammerSlamRadiusMul: 1.0,
    hammerStunBonus: 0.0,
    staffDamageMul: 1.0,
    staffAttackSpeedMul: 1.0,
    staffSplashMul: 1.0,
    bowDamageMul: 1.0,
    bowChargeMul: 1.0,
    bowCritChance: 0.0,
    bowCritMul: 1.7,
    bowPierce: 0,

  };

  // Отдельные "взятые" перки по оружию (чтобы магу не падали улучшения лука и т.п.)
  const takenByWeapon = {
    spear: new Set(),
    hammer: new Set(),
    bow: new Set(),
    staff: new Set(),
  };

// Перки теперь зависят от выбранного оружия и НЕ пересекаются (отдельные ID-пулы).
// Можно добавлять похожие эффекты, но ID остаются уникальными.
const PERKS_BY_WEAPON = {
  spear: [
    { id:"sp_dmg",  title:"Копьё: +Урон", desc:"+18% к урону копья.", apply(){ stats.spearDamageMul = (stats.spearDamageMul||1)*1.18; } },
    { id:"sp_as",   title:"Копьё: Темп", desc:"+15% к скорости атак копья.", apply(){ stats.spearAttackSpeedMul = (stats.spearAttackSpeedMul||1)*1.15; } },
    { id:"sp_reach",title:"Копьё: Дальность", desc:"+12% к дальности/доставанию.", apply(){ stats.spearReachMul = (stats.spearReachMul||1)*1.12; } },
    { id:"sp_arc",  title:"Копьё: Широкий взмах", desc:"+16% к дуге удара.", apply(){ stats.spearArcMul = (stats.spearArcMul||1)*1.16; } },
    { id:"sp_bleed",title:"Копьё: Кровотечение", desc:"Удары с шансом 28% накладывают кровотечение (3 сек).", apply(){ stats.spearBleed = { chance:0.28, dps: 9.0, dur:3.0 }; } },
    { id:"sp_guard",title:"Копьё: Стойкость", desc:"+25 HP и полное лечение.", apply(){ stats.maxHpBonus += 25; player.hpMax += 25; player.hp = player.hpMax; } },
    { id:"sp_ms",   title:"Копьё: Рывок", desc:"+10% скорость передвижения.", apply(){ stats.moveSpeedMul *= 1.10; } },
    { id:"sp_parry",title:"Копьё: Контратака", desc:"Каждый 6-й удар копья наносит +60% урона.", apply(){ stats.spearHeavyEvery = 6; stats.spearHeavyMul = 1.60; } },
  ],
  hammer: [
    { id:"hm_dmg",  title:"Молот: +Урон", desc:"+22% к урону молота.", apply(){ stats.hammerDamageMul = (stats.hammerDamageMul||1)*1.22; } },
    { id:"hm_as",   title:"Молот: Инерция", desc:"+16% к скорости взмахов молота.", apply(){ stats.hammerAttackSpeedMul = (stats.hammerAttackSpeedMul||1)*1.16; } },
    { id:"hm_slam", title:"Молот: Разлом", desc:"+30% к радиусу землетрясения ПКМ.", apply(){ stats.hammerSlamRadiusMul = (stats.hammerSlamRadiusMul||1)*1.30; } },
    { id:"hm_stun", title:"Молот: Контузия", desc:"+0.6 сек к длительности оглушения мобов.", apply(){ stats.hammerStunBonus = (stats.hammerStunBonus||0)+0.6; } },
    { id:"hm_hp",   title:"Молот: Титан", desc:"+35 HP и полное лечение.", apply(){ stats.maxHpBonus += 35; player.hpMax += 35; player.hp = player.hpMax; } },
    { id:"hm_shatter",title:"Молот: Дробитель", desc:"Ударная волна ПКМ мгновенно сбивает щиты и наносит +35% урона.", apply(){ stats.hammerShatterMul = (stats.hammerShatterMul||1)*1.35; } },
    { id:"hm_ms",   title:"Молот: Неудержимый", desc:"+10% скорость передвижения.", apply(){ stats.moveSpeedMul *= 1.10; } },
  ],
  bow: [
    { id:"bw_dmg",  title:"Лук: +Урон", desc:"+16% к урону лука.", apply(){ stats.bowDamageMul = (stats.bowDamageMul||1)*1.16; } },
    { id:"bw_draw", title:"Лук: Быстрый натяг", desc:"-18% время заряда.", apply(){ stats.bowChargeMul = (stats.bowChargeMul||1)*0.82; } },
    { id:"bw_crit", title:"Лук: Криты", desc:"10% шанс крита (x1.7).", apply(){ stats.bowCritChance = (stats.bowCritChance||0)+0.10; stats.bowCritMul = Math.max(stats.bowCritMul||1.7, 1.7); } },
    { id:"bw_pierce",title:"Лук: Пробитие", desc:"Стрелы пробивают +1 цель.", apply(){ stats.bowPierce = (stats.bowPierce||0)+1; } },
    { id:"bw_ps",   title:"Лук: Скорость стрел", desc:"+20% к скорости стрел.", apply(){ stats.projectileSpeedMul *= 1.20; } },
    { id:"bw_ms",   title:"Лук: Лёгкие шаги", desc:"+12% скорость передвижения.", apply(){ stats.moveSpeedMul *= 1.12; } },
    { id:"bw_hp",   title:"Лук: Выносливость", desc:"+18 HP и полное лечение.", apply(){ stats.maxHpBonus += 18; player.hpMax += 18; player.hp = player.hpMax; } },
    { id:"bw_mark", title:"Лук: Метка", desc:"Попадания помечают цель: +20% урона по ней 3 сек.", apply(){ stats.bowMark = { dur:3.0, mul:1.20 }; } },
  ],
  staff: [
    { id:"st_dmg",  title:"Посох: +Урон", desc:"+14% к урону магии.", apply(){ stats.staffDamageMul = (stats.staffDamageMul||1)*1.14; } },
    { id:"st_as",   title:"Посох: Скорость кастов", desc:"+18% к скорости атак посоха.", apply(){ stats.staffAttackSpeedMul = (stats.staffAttackSpeedMul||1)*1.18; } },
    { id:"st_splash",title:"Посох: Радиус", desc:"+22% к радиусу взрыва.", apply(){ stats.staffSplashMul = (stats.staffSplashMul||1)*1.22; } },
    { id:"st_chain",title:"Посох: Цепь", desc:"Попадания с шансом 22% бьют ещё 1 ближайшую цель (35%).", apply(){ stats.chain = Math.max(stats.chain||0, 0.35); stats.chainChance = Math.max(stats.chainChance||0, 0.22); } },
    { id:"st_burn", title:"Посох: Горение", desc:"Магия поджигает: 8 урона/сек 3 сек.", apply(){ stats.staffBurn = { dps:8.0, dur:3.0 }; } },
    { id:"st_regen",title:"Посох: Реген", desc:"+0.8 HP/сек пассивно.", apply(){ stats.regen += 0.8; } },
    { id:"st_hp",   title:"Посох: Барьер", desc:"Раз в 12 сек игнорируешь следующий урон.", apply(){ stats.shieldCd = Math.max(stats.shieldCd||0, 12); stats.shieldT = 0; } },
    { id:"st_ps",   title:"Посох: Скорость снарядов", desc:"+18% скорость магических сфер.", apply(){ stats.projectileSpeedMul *= 1.18; } },
  ],
};

const BOSS_LOOT_BY_WEAPON = {
  spear: [
    { id:"sp_relic_whirl", title:"Реликвия: Вихрь", desc:"После комбо-удара выпускаешь круговой удар (40% урона).", apply(){ stats.spearWhirl = (stats.spearWhirl||0)+0.40; } },
    { id:"sp_relic_impale",title:"Реликвия: Пронзание", desc:"Каждый 4-й удар копья пробивает и наносит +80% урона.", apply(){ stats.spearImpaleEvery = 4; stats.spearImpaleMul = 1.80; } },
    { id:"sp_relic_vamp",  title:"Реликвия: Кровопийца", desc:"Вампиризм 8% от урона копья.", apply(){ stats.spearLifesteal = (stats.spearLifesteal||0)+0.08; } },
    { id:"sp_relic_tough", title:"Реликвия: Железо", desc:"+60 HP и -8% скорость.", apply(){ stats.maxHpBonus += 60; player.hpMax += 60; player.hp = player.hpMax; stats.moveSpeedMul *= 0.92; } },
  ],
  hammer: [
    { id:"hm_relic_quake", title:"Реликвия: Эпицентр", desc:"ПКМ наносит +75% урона в эпицентре и отбрасывает мобов на 4 метра.", apply(){ stats.hammerEpicenter = true; } },
    { id:"hm_relic_vamp",  title:"Реликвия: Пожиратель", desc:"Вампиризм 10% от любого урона молота.", apply(){ stats.hammerLifesteal = (stats.hammerLifesteal||0)+0.10; } },
    { id:"hm_relic_colossus", title:"Реликвия: Колосс", desc:"+70 HP и -6% скорость передвижения.", apply(){ stats.maxHpBonus += 70; player.hpMax += 70; player.hp = player.hpMax; stats.moveSpeedMul *= 0.94; } },
  ],
  bow: [
    { id:"bw_relic_multi", title:"Реликвия: Расщепление", desc:"Иногда выпускаешь 2 стрелы веером.", apply(){ stats.bowMultishot = (stats.bowMultishot||0)+1; } },
    { id:"bw_relic_aim",   title:"Реликвия: Снайпер", desc:"При полном заряде +45% урона.", apply(){ stats.bowFullChargeMul = Math.max(stats.bowFullChargeMul||1, 1.45); } },
    { id:"bw_relic_quiver",title:"Реликвия: Колчан", desc:"-22% КД после выстрела (быстрее след. выстрел).", apply(){ stats.bowAfterShotCdMul = (stats.bowAfterShotCdMul||1)*0.78; } },
    { id:"bw_relic_bleed", title:"Реликвия: Зазубрины", desc:"Стрелы накладывают кровотечение (2 сек).", apply(){ stats.bowBleed = { dps:10.0, dur:2.0 }; } },
  ],
  staff: [
    { id:"st_relic_boom",  title:"Реликвия: Большой взрыв", desc:"+0.9 к радиусу и +12% урона магии.", apply(){ stats.extraSplash = Math.max(stats.extraSplash||0, 2.3); stats.staffDamageMul = (stats.staffDamageMul||1)*1.12; } },
    { id:"st_relic_chain2",title:"Реликвия: Двойная цепь", desc:"Цепная молния может перескочить 2 раза (урон 28%).", apply(){ stats.chain = Math.max(stats.chain||0, 0.28); stats.chainMax = Math.max(stats.chainMax||0, 2); stats.chainChance = Math.max(stats.chainChance||0, 0.25); } },
    { id:"st_relic_nova",  title:"Реликвия: Нова", desc:"Каждые 9 сек вокруг тебя — магический взрыв (урон 40%).", apply(){ stats.novaCd = 9; stats.novaT = 0; stats.novaMul = 0.40; } },
    { id:"st_relic_focus", title:"Реликвия: Фокус", desc:"+28% урона, но -6% скорость.", apply(){ stats.staffDamageMul = (stats.staffDamageMul||1)*1.28; stats.moveSpeedMul *= 0.94; } },
  ],
};

  function rollChoices(pool, n){
    const out = [];
    const w = weapons?.weapon || "spear";
    const taken = takenByWeapon[w] || takenByWeapon.spear;
    const candidates = pool.filter(p => !taken.has(p.id));
    // if exhausted, allow repeats (but avoid UI empty)
    const src = candidates.length ? candidates : pool;
    while (out.length < n && src.length){
      const pick = src[Math.floor(Math.random()*src.length)];
      if (out.some(o=>o.id===pick.id)) continue;
      out.push(pick);
    }
    return out;
  }

  function openPerkChoice(){
    if (!hud?.openChoice) return;
    const wpn = (weapons && weapons.weapon) ? weapons.weapon : "spear";
    const pool = PERKS_BY_WEAPON[wpn] || PERKS_BY_WEAPON.spear;
    const choices = rollChoices(pool, 3);
    hud.openChoice({
      title: "Уровень вверх!",
      subtitle: "Выбери улучшение",
      hint: "Игра на паузе, пока не выберешь.",
      options: choices.map(p => ({ id:p.id, title:p.title, desc:p.desc })),
      onPick: (i, opt)=>{
        audio?.playUIClick?.();
        const wpn2 = (weapons && weapons.weapon) ? weapons.weapon : "spear";
        const pool2 = PERKS_BY_WEAPON[wpn2] || PERKS_BY_WEAPON.spear;
        const perk = (choices[i] || pool2.find(x=>x.id===opt.id));
        if (!perk) return;
        (takenByWeapon[wpn2] || takenByWeapon.spear).add(perk.id);
        perk.apply();
      }
    });
  }

  function openBossLoot(){
    if (!hud?.openChoice) return;
    const wpn = (weapons && weapons.weapon) ? weapons.weapon : "spear";
    const pool = BOSS_LOOT_BY_WEAPON[wpn] || BOSS_LOOT_BY_WEAPON.spear;
    const choices = rollChoices(pool, 3);
    hud.openChoice({
      title: "Добыча босса",
      subtitle: "Уникальные усиления",
      hint: "Выбор необратим.",
      options: choices.map(p => ({ id:p.id, title:p.title, desc:p.desc })),
      onPick: (i,opt)=>{
        audio?.playUIClick?.();
        const wpn2 = (weapons && weapons.weapon) ? weapons.weapon : "spear";
        const pool2 = BOSS_LOOT_BY_WEAPON[wpn2] || BOSS_LOOT_BY_WEAPON.spear;
        const perk = (choices[i] || pool2.find(x=>x.id===opt.id));
        if (!perk) return;
        (takenByWeapon[wpn2] || takenByWeapon.spear).add(perk.id);
        perk.apply();
      }
    });
  }

  
  function grantXp(amount){
    if (!amount) return;
    xp += amount;
    while (xp >= xpNext){
      xp -= xpNext;
      level++;
      audio?.playLevelUp?.();
      xpNext = Math.floor(50 * Math.pow(1.15, level-1));

      // baseline growth (still полезно)
      player.hpMax += 8;
      player.hp = player.hpMax;

      openPerkChoice();
    }
  }

  function onWaveComplete(waveNum){
    // small steady bonus to keep tempo without inflating kills
    const bonus = Math.max(0, Math.floor(waveNum * 2));
    grantXp(bonus);

    // short breather between waves (UI keeps animating)
    freezeT = Math.max(freezeT, 0.9);
    audio?.duckMusic?.(0.6, 0.9);
  }
function onKill(xpGain){
    kills++;
    grantXp(xpGain);
  }

  // Called from combat when you deal damage (for lifesteal etc.)
  function onDealDamage(amount){
    if (stats.lifesteal > 0 && amount > 0){
      player.hp = clamp(player.hp + amount*stats.lifesteal, 0, player.hpMax);
    }
  }

  function tick(dt){
    // regen
    if (stats.regen > 0 && player.hp > 0 && player.hp < player.hpMax){
      player.hp = clamp(player.hp + stats.regen*dt, 0, player.hpMax);
    }
    // shield cooldown timer (optional relic)
    if (stats.shieldCd){
      stats.shieldT = (stats.shieldT || 0) + dt;
    }
  }

  function shouldBlockDamage(){
    if (!stats.shieldCd) return false;
    if ((stats.shieldT||0) >= stats.shieldCd){
      stats.shieldT = 0;
      return true;
    }
    return false;
  }

  return {
    onKill,
    onWaveComplete,
    tick,
    onDealDamage,
    openBossLoot,
    shouldBlockDamage,
    stats,
    get xp(){return xp;},
    get xpNext(){return xpNext;},
    get level(){return level;},
    get kills(){return kills;}
  };
}
