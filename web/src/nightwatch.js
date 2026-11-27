// 守夜防线：纯逻辑塔防引擎，不碰 DOM、不读全局状态。
// 棋盘：5 条邮路 × 8 格；敌人从右侧雾里走进来，撞到门板就扣血。

export const NW_LANES = 5;
export const NW_COLS = 8;
export const NW_BASE_HP = 100;
export const NW_START_OIL = 60;

const TOWERS = {
  letter: {
    name: "信封草",
    icon: "letter",
    cost: 25,
    hp: 130,
    damage: 14,
    cooldown: 1.25,
    unlockNight: 1,
    desc: "往本行前方投出一枚信纸飞镖。"
  },
  stamp: {
    name: "邮票花",
    icon: "seal",
    cost: 50,
    hp: 110,
    oil: 25,
    interval: 6.5,
    unlockNight: 1,
    desc: "每隔 6.5 秒结出一滴灯油。"
  },
  vine: {
    name: "彩纸藤",
    icon: "fern",
    cost: 50,
    hp: 450,
    unlockNight: 1,
    desc: "一堵纸藤墙，替后面的朋友挡路。"
  },
  inkberry: {
    name: "墨莓",
    icon: "glue",
    cost: 75,
    hp: 130,
    damage: 9,
    cooldown: 1.4,
    slow: 0.45,
    slowFor: 2.2,
    unlockNight: 3,
    desc: "墨汁弹会拖慢敌人的脚步。"
  },
  starchild: {
    name: "星屑花",
    icon: "star",
    cost: 125,
    hp: 120,
    damage: 34,
    cooldown: 2,
    pierce: true,
    unlockNight: 5,
    desc: "星屑穿过整行，打穿路上所有影子。"
  },
  mooncap: {
    name: "月光菇",
    icon: "mushroom",
    cost: 100,
    hp: 110,
    burst: 26,
    interval: 6,
    radius: 1.6,
    unlockNight: 7,
    desc: "每 6 秒在周围炸开一圈月光。"
  },
  windbell: {
    name: "风铃草",
    icon: "wind",
    cost: 75,
    hp: 110,
    damage: 10,
    cooldown: 1.6,
    knockback: 0.35,
    unlockNight: 4,
    desc: "风把影子往回推半格。"
  },
  rainberry: {
    name: "雨莓丛",
    icon: "rain",
    cost: 85,
    hp: 120,
    damage: 8,
    cooldown: 1.5,
    poison: 7,
    poisonFor: 4,
    unlockNight: 6,
    desc: "莓汁会留在影子上，持续掉血 4 秒。"
  },
  sunlamp: {
    name: "灯塔花",
    icon: "sun",
    cost: 100,
    hp: 140,
    aura: 0.25,
    unlockNight: 8,
    desc: "相邻八格的植物伤害 +25%。"
  },
  belltower: {
    name: "钟楼",
    icon: "bell",
    cost: 160,
    hp: 160,
    burst: 20,
    interval: 8,
    global: true,
    unlockNight: 10,
    desc: "每 8 秒响一次，震到场上所有影子。"
  }
};

// 融合：在同一格上再种一株，配方成立就合成。
// 融合的花费取新种下的那株的造价。
const RECIPES = [
  {
    id: "doubleletter",
    a: "letter",
    b: "letter",
    name: "连发草",
    icon: "tote",
    hp: 200,
    damage: 15,
    cooldown: 0.65,
    unlockNight: 2,
    desc: "两张嘴，一封接一封。"
  },
  {
    id: "postcannon",
    a: "letter",
    b: "stamp",
    name: "邮筒炮台",
    icon: "mailbox",
    hp: 230,
    damage: 22,
    cooldown: 1.05,
    oil: 18,
    interval: 8,
    unlockNight: 3,
    desc: "一边结灯油，一边朝整行开炮。"
  },
  {
    id: "goldstamp",
    a: "stamp",
    b: "stamp",
    name: "金邮票",
    icon: "sun",
    hp: 150,
    oil: 42,
    interval: 5.5,
    unlockNight: 4,
    desc: "一次结下更多灯油。"
  },
  {
    id: "inklight",
    a: "inkberry",
    b: "starchild",
    name: "墨光花",
    icon: "cloud",
    hp: 250,
    damage: 30,
    cooldown: 1.3,
    pierce: true,
    slow: 0.5,
    slowFor: 2.4,
    unlockNight: 5,
    desc: "墨光穿过整行，打穿并拖慢。"
  },
  {
    id: "moontide",
    a: "vine",
    b: "mooncap",
    name: "月藤",
    icon: "boat",
    hp: 650,
    burst: 32,
    interval: 5,
    radius: 2,
    unlockNight: 7,
    desc: "缠绕的月藤墙，会周期性震开影子。"
  },
  {
    id: "gust",
    a: "windbell",
    b: "letter",
    name: "风暴信",
    icon: "wind",
    hp: 240,
    damage: 16,
    cooldown: 1.1,
    knockback: 0.5,
    unlockNight: 10,
    desc: "一封信卷着风，把影子推得更远。"
  },
  {
    id: "poisonink",
    a: "rainberry",
    b: "inkberry",
    name: "毒墨水",
    icon: "glue",
    hp: 250,
    damage: 12,
    cooldown: 1.2,
    poison: 12,
    poisonFor: 4,
    slow: 0.4,
    slowFor: 2.2,
    unlockNight: 10,
    desc: "莓汁混着墨，又毒又黏。"
  },
  {
    id: "beacon",
    a: "sunlamp",
    b: "starchild",
    name: "灯塔星",
    icon: "star",
    hp: 300,
    damage: 36,
    cooldown: 1.6,
    pierce: true,
    aura: 0.3,
    unlockNight: 10,
    desc: "整行星光，还给旁边的植物添灯。"
  },
  {
    id: "bellmoon",
    a: "belltower",
    b: "mooncap",
    name: "钟月",
    icon: "sun",
    hp: 360,
    burst: 28,
    interval: 6,
    global: true,
    aura: 0.2,
    unlockNight: 10,
    desc: "钟声和月光一起落下，全场都听得到。"
  },
  {
    id: "nightcannon",
    a: "postcannon",
    b: "letter",
    tier: 2,
    name: "夜班炮台",
    icon: "van",
    hp: 420,
    damage: 40,
    cooldown: 0.85,
    oil: 24,
    interval: 7,
    unlockNight: 9,
    desc: "炮台接上一株信封草，打得更快，也结油。"
  },
  {
    id: "inksea",
    a: "inklight",
    b: "inkberry",
    tier: 2,
    name: "墨海",
    icon: "cloud",
    hp: 360,
    damage: 42,
    cooldown: 1,
    pierce: true,
    slow: 0.6,
    slowFor: 3,
    unlockNight: 9,
    desc: "整行墨光，拖得更狠，穿得更远。"
  },
  {
    id: "moonwall",
    a: "moontide",
    b: "vine",
    tier: 2,
    name: "月墙",
    icon: "boat",
    hp: 1100,
    burst: 45,
    interval: 4.5,
    radius: 2.2,
    unlockNight: 9,
    desc: "一堵会震波的月墙，影子撞不动。"
  },
  {
    id: "goldvault",
    a: "goldstamp",
    b: "stamp",
    tier: 2,
    name: "金库",
    icon: "sun",
    hp: 260,
    oil: 70,
    interval: 4.5,
    unlockNight: 9,
    desc: "金邮票再叠一朵，灯油哗哗地来。"
  },
  {
    id: "starburst",
    a: "doubleletter",
    b: "starchild",
    tier: 2,
    name: "星屑连发",
    icon: "star",
    hp: 280,
    damage: 30,
    cooldown: 0.5,
    pierce: true,
    unlockNight: 9,
    desc: "连发草接上星屑，整行穿个不停。"
  }
];

const ENEMIES = {
  fog: {
    name: "雾团",
    icon: "mist",
    hp: 70,
    speed: 0.3,
    damage: 16,
    unlockNight: 1,
    desc: "最普通的影子，慢慢往门板挪。"
  },
  damp: {
    name: "湿信",
    icon: "letter",
    hp: 46,
    speed: 0.62,
    damage: 11,
    unlockNight: 1,
    desc: "跑得快，血薄，容易漏过去。"
  },
  ink: {
    name: "墨鬼",
    icon: "seal",
    hp: 230,
    speed: 0.2,
    damage: 30,
    unlockNight: 2,
    desc: "又慢又厚，得靠减速和穿行。"
  },
  moth: {
    name: "夜蛾",
    icon: "plane",
    hp: 90,
    speed: 0.52,
    damage: 14,
    flying: true,
    unlockNight: 3,
    desc: "飞过植物，墙挡不住它。"
  },
  split: {
    name: "分裂墨团",
    icon: "cloud",
    hp: 170,
    speed: 0.24,
    damage: 20,
    split: true,
    unlockNight: 4,
    desc: "倒下时裂成两只小墨点。"
  },
  blob: {
    name: "小墨点",
    icon: "glue",
    hp: 55,
    speed: 0.58,
    damage: 8,
    unlockNight: 0,
    desc: "分裂墨团留下的碎片。"
  },
  drum: {
    name: "鼓手",
    icon: "bell",
    hp: 130,
    speed: 0.28,
    damage: 12,
    aura: true,
    unlockNight: 6,
    desc: "给同一行附近的影子加速。"
  },
  rat: {
    name: "夜鼠",
    icon: "snail",
    hp: 80,
    speed: 0.78,
    damage: 8,
    thief: true,
    unlockNight: 8,
    desc: "不撞门板，专偷灯油。"
  },
  bus: {
    name: "夜班车",
    icon: "van",
    hp: 900,
    speed: 0.12,
    damage: 60,
    boss: true,
    unlockNight: 5,
    desc: "每 5 夜的最后一波，很厚。"
  }
};

const UNITS = { ...TOWERS };
for (const recipe of RECIPES) UNITS[recipe.id] = recipe;

export const NW_MODIFIERS = [
  { id: "calm", name: "平静夜", tone: "easy", desc: "灯油收入 +25%。", oil: 1.25, reward: 1 },
  { id: "steady", name: "顺手", tone: "easy", desc: "植物冷却 -10%。", cooldown: 0.9, reward: 0.9 },
  { id: "fog", name: "浓雾", tone: "hard", desc: "植物的射程缩短到 3 格。", range: 3, reward: 1.3 },
  { id: "dry", name: "油荒", tone: "hard", desc: "灯油收入 -30%。", oil: 0.7, reward: 1.3 },
  { id: "rush", name: "急脚", tone: "hard", desc: "影子移动速度 +20%。", speed: 1.2, reward: 1.25 },
  { id: "swarm", name: "潮涌", tone: "hard", desc: "每一波多来一个影子。", extra: 1, reward: 1.25 },
  { id: "brittle", name: "脆纸", tone: "hard", desc: "植物生命 -20%。", towerHp: 0.8, reward: 1.25 },
  { id: "thick", name: "厚影", tone: "hard", desc: "影子生命 +15%。", hp: 1.15, reward: 1.3 },
  { id: "lantern", name: "灯会", tone: "easy", desc: "灯塔花的光环效果翻倍。", aura: 2, reward: 0.9 },
  { id: "toxic", name: "毒雾", tone: "easy", desc: "中毒伤害 +50%。", poison: 1.5, reward: 0.9 },
  { id: "gale", name: "顺风", tone: "easy", desc: "击退距离翻倍。", knockback: 2, reward: 0.9 },
  { id: "echo", name: "回响", tone: "easy", desc: "震波与爆裂伤害 +40%。", burst: 1.4, reward: 0.9 },
  { id: "fusion", name: "融合夜", tone: "easy", desc: "融合花费 -30%。", fusionCost: 0.7, reward: 0.9 },
  { id: "fogbank", name: "雾堤", tone: "hard", desc: "植物的射程只剩 2 格。", range: 2, reward: 1.4 },
  { id: "greedy", name: "贪夜", tone: "hard", desc: "每波清完不再补灯油。", waveOil: 0, reward: 1.2 },
  { id: "heavy", name: "重影", tone: "hard", desc: "影子生命 +25%。", hp: 1.25, reward: 1.35 }
];

// 第 16 夜起进入深雾：按夜数轮流叠一条只加难度的雾层词条。
export const NW_DEEP_FOG = [
  { id: "thick", name: "厚", desc: "影子生命 +20%。", hp: 1.2, reward: 1.5 },
  { id: "swift", name: "疾", desc: "影子移动速度 +15%。", speed: 1.15, reward: 1.45 },
  { id: "dry", name: "旱", desc: "灯油收入 -20%。", oil: 0.8, reward: 1.45 },
  { id: "rot", name: "蚀", desc: "植物生命 -15%。", towerHp: 0.85, reward: 1.45 },
  { id: "tide", name: "潮", desc: "每一波多来一个影子。", extra: 1, reward: 1.5 },
  { id: "dull", name: "钝", desc: "植物冷却 +15%。", cooldown: 1.15, reward: 1.45 }
];

export function deepFogFor(level) {
  if (level < 16) return null;
  return NW_DEEP_FOG[(level - 16) % NW_DEEP_FOG.length];
}

// 每天（本地时间）一条，按日序号散列；同一天刷新页面不会变。
export function dailyModifier(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  const day = Math.floor(local.getTime() / 86400000);
  let hash = (day * 2654435761) >>> 0;
  hash = (hash ^ (hash >>> 13)) >>> 0;
  return NW_MODIFIERS[hash % NW_MODIFIERS.length];
}

export const NW_TALENTS = [
  { id: "wick", name: "灯芯", icon: "sun", max: 3, desc: "开局多 8 点灯油 / 级" },
  { id: "powder", name: "火漆", icon: "seal", max: 3, desc: "所有植物伤害 +8% / 级" },
  { id: "paper", name: "纸甲", icon: "letter", max: 3, desc: "植物生命 +10% / 级" },
  { id: "bulkhead", name: "门闩", icon: "mailbox", max: 3, desc: "门板 +12 点 / 级" },
  { id: "drip", name: "油壶", icon: "tea", max: 3, desc: "灯油自然增长 +0.35/秒 / 级" },
  { id: "quick", name: "快笔", icon: "wind", max: 3, desc: "植物冷却 -6% / 级" }
];

// 天赋第 1/2/3 级分别要 1/2/3 点，一棵点满 6 点。
export function talentCost(level) {
  return Math.max(1, Math.floor(level) + 1);
}

export function talentBonus(talents = {}) {
  const level = (id) => {
    const value = Number(talents && talents[id]);
    return Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 0;
  };
  return {
    startOil: 8 * level("wick"),
    damage: 1 + 0.08 * level("powder"),
    hp: 1 + 0.1 * level("paper"),
    baseHp: 12 * level("bulkhead"),
    drip: 0.35 * level("drip"),
    cooldown: 1 - 0.06 * level("quick")
  };
}

export const NW_TOWER_LIST = Object.entries(TOWERS).map(([id, def]) => ({
  id,
  ...def
}));
export const NW_RECIPE_LIST = RECIPES.map((recipe) => ({
  ...recipe,
  tier: recipe.tier || 1,
  aName: UNITS[recipe.a]?.name || recipe.a,
  bName: UNITS[recipe.b]?.name || recipe.b
}));
export const NW_ENEMY_LIST = Object.entries(ENEMIES)
  .filter(([id]) => id !== "blob")
  .map(([id, def]) => ({ id, ...def }))
  .sort((a, b) => a.unlockNight - b.unlockNight || a.hp - b.hp);

export function nightWaveCount(level) {
  return Math.min(6, 4 + Math.floor((Math.max(1, level) - 1) / 3));
}

export function nightHpScale(level) {
  const step = Math.max(0, level - 1);
  return 1 + 0.2 * step + 0.006 * step * step;
}

export function nightStartOil(level) {
  return Math.min(240, NW_START_OIL + (Math.max(1, level) - 1) * 22);
}

export function nightRewards(level) {
  return {
    stamps: Math.round(90 * Math.pow(Math.max(1, level), 1.45)),
    ink: 2 + Math.floor(level / 2),
    paper: 1 + Math.floor(level / 4),
    wax: level % 3 === 0 ? 1 : 0
  };
}

export function createNightWatch({
  level = 1,
  talents = {},
  modifier = null,
  onFinish = () => {},
  rng = Math.random
} = {}) {
  const mod = {
    id: "plain",
    name: "",
    desc: "",
    tone: "calm",
    oil: 1,
    speed: 1,
    range: Infinity,
    extra: 0,
    towerHp: 1,
    hp: 1,
    cooldown: 1,
    reward: 1,
    aura: 1,
    poison: 1,
    knockback: 1,
    burst: 1,
    fusionCost: 1,
    waveOil: 15,
    ...(modifier || {})
  };
  const nightLevel = Math.max(1, Math.floor(level));
  const deepDef = deepFogFor(nightLevel);
  const deep = {
    hp: 1,
    speed: 1,
    oil: 1,
    towerHp: 1,
    extra: 0,
    cooldown: 1,
    reward: 1,
    ...(deepDef || {})
  };
  const waveTotal = nightWaveCount(nightLevel);
  const hpMul = nightHpScale(nightLevel) * mod.hp * deep.hp;
  const speedMul =
    (1 + Math.min(0.35, 0.03 * (nightLevel - 1))) * mod.speed * deep.speed;
  const bonus = talentBonus(talents);
  const baseMax = NW_BASE_HP + bonus.baseHp;

  let phase = "ready";
  let paused = false;
  let oil = nightStartOil(nightLevel) + bonus.startOil;
  let baseHp = baseMax;
  let wave = 0;
  let waveQueue = [];
  let spawnIndex = 0;
  let waveClock = 0;
  let breakClock = 0;
  let enemies = [];
  let towers = [];
  let effects = [];
  let selected = "";
  let speed = 1;
  let kills = 0;
  let nextId = 1;
  let simTime = 0;
  let result = null;
  let notices = [];

  function waveGap() {
    return Math.max(1.15, 2.5 - nightLevel * 0.06 - wave * 0.05);
  }

  function buildWave(index) {
    const count =
      3 + index + Math.floor((nightLevel - 1) / 3) + mod.extra + deep.extra;
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const roll = rng();
      let type = "fog";
      if (nightLevel >= 8 && roll < 0.08) type = "rat";
      else if (nightLevel >= 6 && roll < 0.18) type = "drum";
      else if (nightLevel >= 4 && roll < 0.3) type = "split";
      else if (nightLevel >= 3 && roll < 0.44) type = "moth";
      else if (nightLevel >= 2 && roll < 0.58) type = "ink";
      else if (index >= 1 && roll < 0.78) type = "damp";
      list.push(type);
    }
    if (nightLevel % 5 === 0 && index === waveTotal - 1) list.push("bus");
    const gap = Math.max(1.15, 2.5 - nightLevel * 0.06 - index * 0.05);
    return list.map((type, i) => ({ type, at: 1.8 + i * gap }));
  }

  function beginWave(index) {
    wave = index;
    waveQueue = buildWave(index);
    spawnIndex = 0;
    waveClock = 0;
    phase = "running";
  }

  function start() {
    if (phase !== "ready") return false;
    beginWave(0);
    return true;
  }

  function notify(text) {
    notices.push({ id: nextId++, text, at: simTime });
    if (notices.length > 8) notices.shift();
  }

  function spawnEnemy(type, rowOverride) {
    const def = ENEMIES[type];
    if (!def) return;
    if (def.boss) notify("夜班车从雾里开出来了。");
    const hp = Math.round(def.hp * hpMul);
    const row = Number.isInteger(rowOverride)
      ? Math.max(0, Math.min(NW_LANES - 1, rowOverride))
      : Math.floor(rng() * NW_LANES);
    enemies.push({
      id: nextId++,
      type,
      row,
      x: NW_COLS - 0.8,
      hp,
      maxHp: hp,
      attack: 0.5,
      slowUntil: 0,
      slowFactor: 1
    });
  }

  function towerAt(col, row) {
    return towers.find((tower) => tower.col === col && tower.row === row) || null;
  }

  function findRecipe(typeA, typeB) {
    return (
      RECIPES.find(
        (recipe) =>
          (recipe.a === typeA && recipe.b === typeB) ||
          (recipe.a === typeB && recipe.b === typeA)
      ) || null
    );
  }

  function makeTower(type, col, row) {
    const def = UNITS[type];
    return {
      id: nextId++,
      type,
      col,
      row,
      hp: Math.round(def.hp * bonus.hp * mod.towerHp * deep.towerHp),
      maxHp: Math.round(def.hp * bonus.hp * mod.towerHp * deep.towerHp),
      cool: 0.2,
      oilTimer: def.interval || 0,
      burstTimer: def.interval || 0,
      fusion: Boolean(TOWERS[type] === undefined),
      tier: TOWERS[type] ? 0 : 1
    };
  }

  function hurt(enemy, damage, def) {
    enemy.hp -= damage * bonus.damage;
    if (def && def.slow) {
      enemy.slowUntil = simTime + (def.slowFor || 2);
      enemy.slowFactor = 1 - def.slow;
    }
    if (def && def.poison) {
      enemy.poisonDps = Math.max(enemy.poisonDps || 0, def.poison * mod.poison);
      enemy.poisonUntil = simTime + (def.poisonFor || 4);
    }
  }

  function auraBonusFor(tower) {
    let bonus = 0;
    for (const other of towers) {
      if (other === tower) continue;
      const otherDef = UNITS[other.type];
      if (!otherDef.aura) continue;
      if (Math.abs(other.row - tower.row) <= 1 && Math.abs(other.col - tower.col) <= 1) {
        bonus += otherDef.aura * mod.aura;
      }
    }
    return 1 + bonus;
  }

  function shoot(tower, def) {
    const candidates = enemies.filter(
      (enemy) =>
        enemy.row === tower.row &&
        enemy.x >= tower.col - 0.1 &&
        enemy.x - tower.col <= mod.range
    );
    if (!candidates.length) return;
    const power = def.damage * auraBonusFor(tower);
    if (def.pierce) {
      let far = tower.col;
      for (const enemy of candidates) {
        hurt(enemy, power, def);
        far = Math.max(far, enemy.x);
      }
      effects.push({ row: tower.row, from: tower.col, to: far, kind: "beam" });
    } else {
      let target = candidates[0];
      for (const enemy of candidates) {
        if (enemy.x < target.x) target = enemy;
      }
      hurt(target, power, def);
      if (def.knockback && !ENEMIES[target.type].boss) {
        target.x = Math.min(NW_COLS - 0.5, target.x + def.knockback * mod.knockback);
      }
      effects.push({
        row: tower.row,
        from: tower.col,
        to: target.x,
        kind: "bolt"
      });
    }
    tower.cool = def.cooldown * bonus.cooldown * mod.cooldown * deep.cooldown;
  }

  function burst(tower, def) {
    let hit = 0;
    const rows = new Set();
    for (const enemy of enemies) {
      if (def.global) {
        hurt(enemy, def.burst * mod.burst, def);
        hit += 1;
        rows.add(enemy.row);
        continue;
      }
      if (enemy.row !== tower.row) continue;
      if (Math.abs(enemy.x - tower.col) <= def.radius) {
        hurt(enemy, def.burst * mod.burst, def);
        hit += 1;
        rows.add(enemy.row);
      }
    }
    if (!hit) return;
    if (def.global) {
      for (const row of rows) {
        effects.push({ row, from: 0, to: NW_COLS, kind: "burst" });
      }
    } else {
      effects.push({
        row: tower.row,
        from: tower.col - def.radius,
        to: tower.col + def.radius,
        kind: "burst"
      });
    }
  }

  function spawnBlob(parent) {
    for (let index = 0; index < 2; index += 1) {
      const hp = Math.max(1, Math.round(ENEMIES.blob.hp * hpMul));
      enemies.push({
        id: nextId++,
        type: "blob",
        row: parent.row,
        x: Math.min(NW_COLS - 0.5, parent.x + (index ? 0.18 : -0.18)),
        hp,
        maxHp: hp,
        attack: 0.5,
        slowUntil: 0,
        slowFactor: 1
      });
    }
  }

  function blockingTower(enemy) {
    let blocker = null;
    for (const tower of towers) {
      if (tower.row !== enemy.row) continue;
      if (enemy.x <= tower.col + 0.6 && enemy.x >= tower.col - 0.4) {
        if (!blocker || tower.col > blocker.col) blocker = tower;
      }
    }
    return blocker;
  }

  function updateTowers(dt) {
    for (const tower of towers) {
      const def = UNITS[tower.type];
      if (def.oil) {
        tower.oilTimer -= dt;
        if (tower.oilTimer <= 0) {
          oil = Math.min(999, oil + def.oil * mod.oil * deep.oil);
          tower.oilTimer = def.interval;
        }
      }
      if (def.burst) {
        tower.burstTimer -= dt;
        if (tower.burstTimer <= 0) {
          burst(tower, def);
          tower.burstTimer = def.interval;
        }
      }
      if (def.damage) {
        tower.cool -= dt;
        if (tower.cool <= 0) shoot(tower, def);
      }
    }
  }

  function scaledRewards(base) {
    return {
      stamps: Math.round(base.stamps * mod.reward * deep.reward),
      ink: Math.max(1, Math.round(base.ink * mod.reward * deep.reward)),
      paper: Math.round(base.paper * mod.reward * deep.reward),
      wax: base.wax ? Math.max(1, Math.round(base.wax * mod.reward * deep.reward)) : 0
    };
  }

  function finish(won) {
    if (phase === "won" || phase === "lost") return;
    phase = won ? "won" : "lost";
    result = {
      won,
      level: nightLevel,
      wave: Math.min(wave + 1, waveTotal),
      waves: waveTotal,
      kills,
      baseHp,
      deepFog: Boolean(deepDef),
      rewards: won ? scaledRewards(nightRewards(nightLevel)) : null
    };
    onFinish(result);
  }

  function tick(rawDt) {
    if (phase !== "running" && phase !== "break") return;
    if (paused) return;
    const dt = Math.min(0.25, Math.max(0, rawDt)) * speed;
    if (!dt) return;
    simTime += dt;
    effects = [];
    oil = Math.min(999, oil + (1.4 + bonus.drip) * mod.oil * deep.oil * dt);

    if (phase === "break") {
      updateTowers(dt);
      breakClock -= dt;
      if (breakClock <= 0) beginWave(wave + 1);
      return;
    }

    waveClock += dt;
    while (
      spawnIndex < waveQueue.length &&
      waveClock >= waveQueue[spawnIndex].at
    ) {
      spawnEnemy(waveQueue[spawnIndex].type);
      spawnIndex += 1;
    }

    updateTowers(dt);

    for (const enemy of enemies) {
      if (enemy.poisonUntil > simTime) {
        enemy.hp -= enemy.poisonDps * dt;
      }
    }

    for (const enemy of enemies) {
      const def = ENEMIES[enemy.type];
      if (!def) continue;
      const blocker = def.flying || def.thief ? null : blockingTower(enemy);
      if (blocker) {
        enemy.attack -= dt;
        if (enemy.attack <= 0) {
          enemy.attack = 0.9;
          blocker.hp -= def.damage;
        }
        continue;
      }
      let boost = 1;
      enemy.boosted = false;
      if (!def.aura) {
        for (const other of enemies) {
          if (
            other !== enemy &&
            other.type === "drum" &&
            other.row === enemy.row &&
            Math.abs(other.x - enemy.x) <= 1.8
          ) {
            boost = 1.25;
            enemy.boosted = true;
            break;
          }
        }
      }
      const slow = enemy.slowUntil > simTime ? enemy.slowFactor : 1;
      enemy.x -= def.speed * speedMul * slow * boost * dt;
      if (enemy.x < -0.35) {
        enemy.hp = 0;
        enemy.leaked = true;
        if (def.thief) {
          const stolen = Math.min(Math.floor(oil), 40);
          oil -= stolen;
          if (stolen > 0) notify(`夜鼠摸到门板，偷走了 ${stolen} 点灯油。`);
        } else {
          baseHp -= def.damage;
          if (baseHp <= 0) baseHp = 0;
        }
      }
    }

    const fallen = enemies.filter((enemy) => enemy.hp <= 0);
    for (const enemy of fallen) {
      kills += 1;
      if (!enemy.leaked && enemy.type === "split") spawnBlob(enemy);
    }
    enemies = enemies.filter((enemy) => enemy.hp > 0);
    towers = towers.filter((tower) => tower.hp > 0);

    if (baseHp <= 0) {
      finish(false);
      return;
    }

    if (
      !enemies.length &&
      spawnIndex >= waveQueue.length &&
      phase === "running"
    ) {
      if (wave >= waveTotal - 1) {
        finish(true);
      } else {
        phase = "break";
        breakClock = 3.2;
        oil = Math.min(999, oil + mod.waveOil);
      }
    }
  }

  function select(type) {
    if (!TOWERS[type]) {
      selected = "";
      return selected;
    }
    selected = selected === type ? "" : type;
    return selected;
  }

  function place(col, row) {
    if (phase === "won" || phase === "lost") {
      return { ok: false, code: "over" };
    }
    const def = TOWERS[selected];
    if (!def) return { ok: false, code: "no-select" };
    if (def.unlockNight > nightLevel) return { ok: false, code: "locked" };
    if (
      !Number.isInteger(col) ||
      !Number.isInteger(row) ||
      col < 0 ||
      col >= NW_COLS ||
      row < 0 ||
      row >= NW_LANES
    ) {
      return { ok: false, code: "outside" };
    }
    const existing = towerAt(col, row);
    if (existing && existing.tier >= 2) {
      return { ok: false, code: "already-fused" };
    }
    if (existing) {
      const recipe = findRecipe(existing.type, selected);
      if (!recipe || recipe.unlockNight > nightLevel) {
        return { ok: false, code: "occupied" };
      }
      const fusionCost = Math.max(1, Math.round(def.cost * mod.fusionCost));
      if (oil < fusionCost) return { ok: false, code: "poor" };
      oil -= fusionCost;
      existing.type = recipe.id;
      existing.fusion = true;
      existing.tier = recipe.tier || 1;
      existing.maxHp = Math.round(recipe.hp * bonus.hp * mod.towerHp * deep.towerHp);
      existing.hp = Math.round(recipe.hp * bonus.hp * mod.towerHp * deep.towerHp);
      existing.cool = 0.3;
      existing.oilTimer = recipe.interval || 0;
      existing.burstTimer = recipe.interval || 0;
      return { ok: true, fused: true, id: recipe.id, name: recipe.name, cost: fusionCost };
    }
    if (oil < def.cost) return { ok: false, code: "poor" };
    oil -= def.cost;
    towers.push(makeTower(selected, col, row));
    return { ok: true, fused: false, name: def.name, cost: def.cost };
  }

  function spots() {
    if (!selected || phase === "won" || phase === "lost") return [];
    const def = TOWERS[selected];
    if (!def) return [];
    const list = [];
    for (let row = 0; row < NW_LANES; row += 1) {
      for (let col = 0; col < NW_COLS; col += 1) {
        const existing = towerAt(col, row);
        if (!existing) {
          list.push({ col, row, kind: "place" });
          continue;
        }
        if (existing.tier >= 2) continue;
        const recipe = findRecipe(existing.type, selected);
        if (recipe && recipe.unlockNight <= nightLevel) {
          list.push({ col, row, kind: "fuse" });
        }
      }
    }
    return list;
  }

  function snapshot() {
    const towerList = towers.map((tower) => {
      const def = UNITS[tower.type];
      return {
        id: tower.id,
        type: tower.type,
        icon: def.icon,
        name: def.name,
        row: tower.row,
        col: tower.col,
        fusion: Boolean(tower.fusion),
        tier: tower.tier || 0,
        aura: Boolean(UNITS[tower.type].aura),
        hp: Math.max(0, Math.round(tower.hp)),
        maxHp: tower.maxHp,
        percent: Math.max(0, Math.round((tower.hp / tower.maxHp) * 100))
      };
    });
    const enemyList = enemies.map((enemy) => {
      const def = ENEMIES[enemy.type];
      return {
        id: enemy.id,
        type: enemy.type,
        icon: def.icon,
        row: enemy.row,
        x: Number(enemy.x.toFixed(2)),
        boss: Boolean(def.boss),
        flying: Boolean(def.flying),
        slowed: enemy.slowUntil > simTime,
        boosted: Boolean(enemy.boosted),
        thief: Boolean(def.thief),
        poisoned: enemy.poisonUntil > simTime,
        poisonDps: enemy.poisonDps || 0,
        hp: Math.max(0, Math.round(enemy.hp)),
        maxHp: enemy.maxHp,
        percent: Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100))
      };
    });
    return {
      phase,
      paused,
      speed,
      level: nightLevel,
      wave: Math.min(wave + 1, waveTotal),
      waveTotal,
      waveCleared: phase === "break" ? wave + 1 : wave,
      breakLeft: Math.max(0, Number(breakClock.toFixed(1))),
      oil: Math.floor(oil),
      baseHp,
      baseMax,
      kills,
      selected,
      cards: NW_TOWER_LIST.map((tower) => ({
        id: tower.id,
        name: tower.name,
        icon: tower.icon,
        cost: tower.cost,
        desc: tower.desc,
        unlockNight: tower.unlockNight,
        unlocked: tower.unlockNight <= nightLevel,
        affordable: oil >= tower.cost,
        selected: selected === tower.id
      })),
      towers: towerList,
      enemies: enemyList,
      effects: effects.map((effect) => ({
        row: effect.row,
        from: effect.from,
        to: effect.to,
        kind: effect.kind
      })),
      deepFog: deepDef
        ? {
            active: true,
            layer: nightLevel - 15,
            id: deepDef.id,
            name: `深雾·${deepDef.name}`,
            shortName: deepDef.name,
            desc: deepDef.desc,
            rewardText: `奖励 ×${deep.reward}`
          }
        : { active: false, layer: 0, id: "", name: "", desc: "", rewardText: "" },
      modifier: {
        id: mod.id,
        name: mod.name,
        desc: mod.desc,
        tone: mod.tone,
        rewardText:
          mod.reward > 1
            ? `奖励 +${Math.round((mod.reward - 1) * 100)}%`
            : mod.reward < 1
              ? `奖励 -${Math.round((1 - mod.reward) * 100)}%`
              : ""
      },
      notices: notices
        .filter((notice) => simTime - notice.at < 2.5)
        .map((notice) => ({ id: notice.id, text: notice.text })),
      spots: spots(),
      fusionHints:
        selected && TOWERS[selected]
          ? RECIPES.filter(
              (recipe) =>
                recipe.unlockNight <= nightLevel &&
                (recipe.a === selected || recipe.b === selected)
            ).map((recipe) => {
              const partnerType = recipe.a === selected ? recipe.b : recipe.a;
              return {
                id: recipe.id,
                name: recipe.name,
                partner: TOWERS[partnerType]?.name || UNITS[partnerType]?.name || partnerType
              };
            })
          : [],
      result
    };
  }

  function setSpeed(value) {
    speed = value >= 2 ? 2 : 1;
    return speed;
  }

  function togglePause() {
    if (phase === "won" || phase === "lost") return paused;
    paused = !paused;
    return paused;
  }

  return {
    start,
    tick,
    select,
    place,
    spots,
    snapshot,
    setSpeed,
    togglePause,
    forceWin: () => finish(true),
    forceLose: () => finish(false),
    addOil: (amount) => {
      oil = Math.min(999, oil + Math.max(0, Number(amount) || 0));
    },
    spawn: (type, row) => spawnEnemy(type, row),
    get phase() {
      return phase;
    },
    get oil() {
      return oil;
    }
  };
}
