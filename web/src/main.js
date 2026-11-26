import * as cloudApi from "./cloud.js";
import { deriveVerifier, proveVerifier } from "./crypto.js";

(() => {
  "use strict";

  const SAVE_KEY = "moss-post-office.save.v1";
  const PRESTIGE_BASE = 30000;
  const MOON_BONUS = 0.25;
  const MAX_OFFLINE_SECONDS = 2 * 60 * 60;
  const SAVE_INTERVAL = 5000;
  const BELL_ACTIVE_SECONDS = 20;
  const BELL_COOLDOWN_SECONDS = 90;
  const MAX_SAFE_STATE = 1e15;
  const INK_REROLL_COST = 8;
  const INK_TRIP_COST = 30;

  const GENERATORS = [
    {
      id: "snail",
      name: "小蜗牛邮差",
      desc: "背着小邮袋，慢慢走却从不迷路。",
      icon: "snail",
      rate: 0.5,
      cost: 10,
      growth: 1.15,
      unlock: 0
    },
    {
      id: "mushroom",
      name: "蘑菇邮筒",
      desc: "长在路边的红伞邮筒，会自己吞信。",
      icon: "mushroom",
      rate: 3,
      cost: 100,
      growth: 1.16,
      unlock: 60
    },
    {
      id: "plane",
      name: "纸飞机航线",
      desc: "顺着风送急件，回信也折成飞机。",
      icon: "plane",
      rate: 20,
      cost: 1000,
      growth: 1.17,
      unlock: 700
    },
    {
      id: "van",
      name: "月光邮车",
      desc: "月光下出发，把信送到山的另一边。",
      icon: "van",
      rate: 140,
      cost: 10000,
      growth: 1.18,
      unlock: 7000
    },
    {
      id: "cloud",
      name: "云朵分拣站",
      desc: "云朵做的分拣站，软软地整理每封信。",
      icon: "cloud",
      rate: 1200,
      cost: 120000,
      growth: 1.19,
      unlock: 80000
    },
    {
      id: "star",
      name: "星星邮局",
      desc: "在星星上盖邮戳，收件人是明天。",
      icon: "star",
      rate: 9000,
      cost: 1500000,
      growth: 1.2,
      unlock: 1000000
    }
  ];

  const MILESTONES = [
    { count: 10, mult: 1.5 },
    { count: 25, mult: 2 },
    { count: 50, mult: 2.5 }
  ];

  GENERATORS.forEach((generator) => {
    generator.milestones = MILESTONES;
  });

  const UPGRADES = [
    {
      id: "copper",
      name: "铜制邮戳",
      desc: "黄铜邮戳沉甸甸的，每次盖戳的邮票翻倍。",
      icon: "seal",
      kind: "click",
      mult: 2,
      effectLabel: "盖戳 ×2",
      cost: 60,
      unlock: 25
    },
    {
      id: "glue",
      name: "邮票胶水",
      desc: "让邮票轻轻粘在信封上，所有产出增加 25%。",
      icon: "glue",
      kind: "all",
      mult: 1.25,
      effectLabel: "全部 +25%",
      cost: 320,
      unlock: 120
    },
    {
      id: "handle",
      name: "软木手柄",
      desc: "软木手柄更好握，每次盖戳的邮票再翻倍。",
      icon: "handle",
      kind: "click",
      mult: 2,
      effectLabel: "盖戳 ×2",
      cost: 1200,
      unlock: 700
    },
    {
      id: "bell",
      name: "分拣铜铃",
      desc: "铃一响，大家都快一点，所有产出增加 25%。",
      icon: "bell",
      kind: "all",
      mult: 1.25,
      effectLabel: "全部 +25%",
      cost: 5000,
      unlock: 2500
    },
    {
      id: "tea",
      name: "蘑菇茶",
      desc: "热乎乎的蘑菇茶下肚，所有产出变为 1.5 倍。",
      icon: "tea",
      kind: "all",
      mult: 1.5,
      effectLabel: "全部 ×1.5",
      cost: 30000,
      unlock: 12000
    },
    {
      id: "pouch",
      name: "星尘邮袋",
      desc: "装满星尘的邮袋，所有产出变为 1.6 倍。",
      icon: "pouch",
      kind: "all",
      mult: 1.6,
      effectLabel: "全部 ×1.6",
      cost: 250000,
      unlock: 100000
    },
    {
      id: "ladder",
      name: "月光滑梯",
      desc: "沿着月光滑下来送信，所有产出变为 2 倍。",
      icon: "ladder",
      kind: "all",
      mult: 2,
      effectLabel: "全部 ×2",
      cost: 2000000,
      unlock: 800000
    }
  ];

  const MATERIAL_UPGRADES = [
    {
      id: "scriptorium",
      name: "抄写台",
      material: "paper",
      cost: 10,
      icon: "letter",
      desc: "每趟远行开局多抄 1 张已解锁的牌。"
    },
    {
      id: "seal_press",
      name: "封蜡台",
      material: "wax",
      cost: 8,
      icon: "seal",
      desc: "每趟远行第一次失败不掉信。"
    },
    {
      id: "sewing",
      name: "缝纫台",
      material: "cloth",
      cost: 8,
      icon: "tote",
      desc: "每趟远行开局多带 1 封信。"
    }
  ];

  const POSTCARD_TEMPLATES = [
    { id: "hello", text: "今天邮局门口的苔藓又绿了一点。" },
    { id: "weather", text: "雾湖今天很轻，信都顺利上路了。" },
    { id: "route", text: "替你留意了星港的夜班车，没有晚点。" },
    { id: "star", text: "月亮出来的时候，替你把最后一张邮票盖好了。" }
  ];

  const TOWN_BOTS = [
    { id: "b_moss", name: "苔苔", title: "镇口邮差" },
    { id: "b_snail", name: "慢慢", title: "蜗牛邮差" },
    { id: "b_plane", name: "纸飞机", title: "风里的信使" },
    { id: "b_night", name: "夜班司机", title: "星港夜航" },
    { id: "b_mushroom", name: "蘑菇太太", title: "柜台常客" },
    { id: "b_box", name: "邮筒先生", title: "路边邮筒" },
    { id: "b_star", name: "星港旅人", title: "远方来客" },
    { id: "b_boat", name: "雾湖船夫", title: "摆渡人" }
  ];

  const WEATHER_DURATION = 150000;
  const WEATHERS = [
    {
      id: "sunny",
      name: "晴天",
      label: "晴天 · 盖戳 +80%",
      notice: "晴天把蜡封晒得暖暖的，盖戳产出 +80%。",
      icon: "sun",
      clickMultiplier: 1.8,
      globalRate: 1,
      genBonus: {}
    },
    {
      id: "windy",
      name: "顺风",
      label: "顺风 · 纸飞机与云朵 ×1.6",
      notice: "风从山那边吹来，纸飞机和云朵分拣站的产出 ×1.6。",
      icon: "wind",
      clickMultiplier: 1,
      globalRate: 1,
      genBonus: { plane: 1.6, cloud: 1.6 }
    },
    {
      id: "rainy",
      name: "小雨",
      label: "小雨 · 蜗牛与蘑菇 ×1.6",
      notice: "小雨落在苔藓上，小蜗牛和蘑菇邮筒的产出 ×1.6。",
      icon: "rain",
      clickMultiplier: 1,
      globalRate: 1,
      genBonus: { snail: 1.6, mushroom: 1.6 }
    },
    {
      id: "misty",
      name: "薄雾",
      label: "薄雾 · 自动送信 +20%",
      notice: "薄雾把整座镇子裹得软软的，所有自动送信 +20%。",
      icon: "mist",
      clickMultiplier: 1,
      globalRate: 1.2,
      genBonus: {}
    }
  ];

  const ACHIEVEMENTS = [
    {
      id: "first_reply",
      name: "第一封回信",
      desc: "盖下 1 枚邮戳",
      icon: "seal",
      target: 1,
      reward: 0.01,
      value: () => state.clicks
    },
    {
      id: "ten_footprints",
      name: "十只小脚印",
      desc: "累计招募 10 位邮差",
      icon: "snail",
      target: 10,
      reward: 0.01,
      value: () => GENERATORS.reduce((total, gen) => total + (state.boughtTotal[gen.id] || 0), 0)
    },
    {
      id: "mushroom_path",
      name: "蘑菇小径",
      desc: "拥有 10 个蘑菇邮筒",
      icon: "mushroom",
      target: 10,
      reward: 0.01,
      value: () => state.gens.mushroom
    },
    {
      id: "paper_sky",
      name: "纸飞机满天",
      desc: "拥有 5 条纸飞机航线",
      icon: "plane",
      target: 5,
      reward: 0.01,
      value: () => state.gens.plane
    },
    {
      id: "moon_fleet",
      name: "月光车队",
      desc: "拥有 2 辆月光邮车",
      icon: "van",
      target: 2,
      reward: 0.02,
      value: () => state.gens.van
    },
    {
      id: "cloud_sorting",
      name: "云端分拣",
      desc: "拥有 3 座云朵分拣站",
      icon: "cloud",
      target: 3,
      reward: 0.02,
      value: () => state.gens.cloud
    },
    {
      id: "star_postmark",
      name: "星星落款",
      desc: "拥有 1 座星星邮局",
      icon: "star",
      target: 1,
      reward: 0.03,
      value: () => state.gens.star
    },
    {
      id: "stamp_collector",
      name: "邮戳收藏家",
      desc: "在一程里收下 4 枚工坊邮戳",
      icon: "handle",
      target: 4,
      reward: 0.02,
      value: () => state.upgrades.length
    },
    {
      id: "full_combo",
      name: "满格连击",
      desc: "把连击推到 ×1.60",
      icon: "bell",
      target: 40,
      reward: 0.02,
      value: () => state.bestCombo
    },
    {
      id: "golden_hunter",
      name: "闪光猎手",
      desc: "拆开 5 封闪光信件",
      icon: "glue",
      target: 5,
      reward: 0.02,
      value: () => state.goldenLetters
    },
    {
      id: "moon_regular",
      name: "月亮常客",
      desc: "拥有 2 枚月光邮戳",
      icon: "ladder",
      target: 2,
      reward: 0.03,
      value: () => state.moonStamps
    },
    {
      id: "first_voyage",
      name: "第一封远方信",
      desc: "完成 1 次邮路派遣",
      icon: "plane",
      target: 1,
      reward: 0.01,
      value: () => Object.values(state.routeRuns || {}).reduce((total, count) => total + count, 0)
    },
    {
      id: "ten_voyages",
      name: "走过十条邮路",
      desc: "累计完成 10 次派遣",
      icon: "ladder",
      target: 10,
      reward: 0.02,
      value: () => Object.values(state.routeRuns || {}).reduce((total, count) => total + count, 0)
    },
    {
      id: "star_voyage",
      name: "星港夜航",
      desc: "完成 1 次星港夜航",
      icon: "star",
      target: 1,
      reward: 0.03,
      value: () => (state.routeRuns && state.routeRuns.starport) || 0
    },
    {
      id: "moss_legend",
      name: "苔藓镇传说",
      desc: "累计赚到 500,000 张邮票",
      icon: "pouch",
      target: 500000,
      reward: 0.04,
      value: () => state.totalEarned
    },
    {
      id: "perfect_postmark",
      name: "完美主义",
      desc: "盖出 50 次完美邮戳",
      icon: "seal",
      target: 50,
      reward: 0.02,
      value: () => state.perfects
    },
    {
      id: "counter_regular",
      name: "柜台常客",
      desc: "完成 10 封柜台来信",
      icon: "letter",
      target: 10,
      reward: 0.02,
      value: () => state.ordersDone
    },
    {
      id: "moon_gardener",
      name: "月光园丁",
      desc: "点亮 5 个月光节点",
      icon: "star",
      target: 5,
      reward: 0.03,
      value: () => state.moonTree.length
    },
    {
      id: "first_expedition",
      name: "第一次远行",
      desc: "走完一趟雾湖远行",
      icon: "boat",
      target: 1,
      reward: 0.02,
      value: () => state.expeditionWins
    },
    {
      id: "three_expeditions",
      name: "雾湖常客",
      desc: "走完 3 趟雾湖远行",
      icon: "star",
      target: 3,
      reward: 0.03,
      value: () => state.expeditionWins
    }
  ];

  const GOALS = [
    {
      id: "first",
      title: "盖下第一枚邮戳",
      target: 1,
      value: () => state.clicks
    },
    {
      id: "hundred",
      title: "累计赚到 100 张邮票",
      target: 100,
      value: () => state.totalEarned
    },
    {
      id: "helpers",
      title: "招募 3 位小邮差",
      target: 3,
      value: () => GENERATORS.reduce((total, gen) => total + (state.boughtTotal[gen.id] || 0), 0)
    },
    {
      id: "plane",
      title: "让纸飞机航线起飞",
      target: 1,
      value: () => state.boughtTotal.plane || 0
    },
    {
      id: "bell",
      title: "摇响第一声收班风铃",
      target: 1,
      value: () => state.bellUses
    },
    {
      id: "dispatch",
      title: "送出一趟远方邮路",
      target: 1,
      value: () => Object.values(state.routeRuns || {}).reduce((total, count) => total + count, 0)
    },
    {
      id: "album",
      title: "往邮册里贴 4 枚纪念邮票",
      target: 4,
      value: () => state.achievements.length
    },
    {
      id: "night",
      title: "累计赚到 30,000 张邮票",
      target: 30000,
      value: () => state.totalEarned
    },
    {
      id: "moon",
      title: "寄出第一班月亮邮车",
      target: 1,
      value: () => state.moonStamps
    },
    {
      id: "perfect",
      title: "盖出一次完美邮戳",
      target: 1,
      value: () => state.perfects
    },
    {
      id: "letter",
      title: "送出第一封柜台来信",
      target: 1,
      value: () => state.ordersDone
    },
    {
      id: "seed",
      title: "点亮第一个月光节点",
      target: 1,
      value: () => state.moonTree.length
    },
    {
      id: "expedition",
      title: "走完一趟雾湖远行",
      target: 1,
      value: () => state.expeditionWins
    }
  ];

  const DISPATCH_SLOTS = 2;

  const ROUTES = [
    {
      id: "dewdrop",
      name: "露水小径",
      desc: "绕过蕨叶和蘑菇，把慢信送到山坡那边。",
      icon: "fern",
      accent: "var(--moss-light)",
      duration: 45,
      unlock: 0,
      rewardSeconds: 25,
      flat: 30
    },
    {
      id: "mistlake",
      name: "雾湖航线",
      desc: "纸船划过月牙湖，给湖心的灯塔捎一封回信。",
      icon: "boat",
      accent: "var(--lavender)",
      duration: 180,
      unlock: 2000,
      rewardSeconds: 80,
      flat: 100
    },
    {
      id: "starport",
      name: "星港夜航",
      desc: "搭上夜班星船，把信交给明天的收件人。",
      icon: "star",
      accent: "var(--butter)",
      duration: 600,
      unlock: 30000,
      rewardSeconds: 240,
      flat: 500
    }
  ];


  const ORDER_TEMPLATES = [
    {
      id: "perfects",
      title: "没有错字的信",
      sender: "松鼠太太",
      quote: "想给山那边的孩子寄一封没有错字的信。",
      goalKey: "perfects",
      unit: "完美盖戳",
      targets: [6, 10, 16],
      ink: [8, 12, 18],
      minutes: [10, 12, 14],
      materialReward: { paper: 1 }
    },
    {
      id: "clicks",
      title: "一叠明信片",
      sender: "刺猬先生",
      quote: "在天黑前把这些明信片都盖上戳。",
      goalKey: "clicks",
      unit: "盖戳",
      targets: [25, 40, 60],
      ink: [6, 9, 13],
      minutes: [8, 10, 12]
    },
    {
      id: "trips",
      title: "等一封回信",
      sender: "渡口灯塔",
      quote: "等一封从邮路带回来的回信。",
      goalKey: "trips",
      unit: "完成邮路",
      targets: [1, 1, 2],
      ink: [10, 14, 20],
      minutes: [14, 16, 20]
    },
    {
      id: "golden",
      title: "会发光的信",
      sender: "小星星",
      quote: "听说有一封会发光的信。",
      goalKey: "golden",
      unit: "找到闪光的信",
      targets: [1, 1, 1],
      ink: [14, 18, 24],
      minutes: [14, 16, 18]
    },
    {
      id: "combo",
      title: "连成一串的邮戳",
      sender: "喜鹊",
      quote: "连着的邮戳才好看。",
      goalKey: "bestCombo",
      unit: "最高连击",
      targets: [15, 22, 30],
      ink: [8, 12, 16],
      minutes: [8, 10, 12]
    },
    {
      id: "rain",
      title: "雨天的邮票",
      sender: "青蛙",
      quote: "雨天的邮票最粘。",
      goalKey: "clicks",
      unit: "雨天盖戳",
      targets: [20, 30, 40],
      ink: [9, 13, 18],
      minutes: [10, 12, 14],
      condition: { weather: "rainy" },
      materialReward: { wax: 1 }
    },
    {
      id: "nobell",
      title: "安静的一下午",
      sender: "老獾",
      quote: "今天想安安静静地分信。",
      goalKey: "clicks",
      unit: "盖戳（不摇铃）",
      targets: [20, 35, 50],
      ink: [8, 12, 16],
      minutes: [9, 11, 13],
      condition: { noBell: true }
    },
    {
      id: "mistlake",
      title: "雾湖的邮袋",
      sender: "船夫",
      quote: "帮我把邮袋送到雾湖。",
      goalKey: "route:mistlake",
      unit: "完成雾湖航线",
      targets: [1, 2, 2],
      ink: [10, 14, 18],
      minutes: [16, 18, 20],
      requiresRoute: "mistlake"
    },
    {
      id: "starport",
      title: "星港的明信片",
      sender: "夜班司机",
      quote: "星港的人想收一张苔藓镇的明信片。",
      goalKey: "route:starport",
      unit: "完成星港夜航",
      targets: [1, 1, 2],
      ink: [16, 22, 28],
      minutes: [22, 24, 26],
      requiresRoute: "starport",
      materialReward: { cloth: 1 }
    },
    {
      id: "fragile",
      title: "包一件易碎品",
      sender: "陶匠",
      quote: "把这只小陶罐包好，别让它在路上磕坏。",
      goalKey: "perfects",
      unit: "完美盖戳",
      targets: [3, 5, 7],
      ink: [10, 14, 18],
      minutes: [10, 12, 14],
      materialCost: { paper: 2 },
      materialReward: { wax: 1 },
      requiresExpedition: true
    },
    {
      id: "parcel",
      title: "寄一只布包",
      sender: "织布鸟",
      quote: "布包的线头别松，到了山那边还要用。",
      goalKey: "clicks",
      unit: "盖戳",
      targets: [20, 30, 40],
      ink: [9, 13, 17],
      minutes: [10, 12, 14],
      materialCost: { cloth: 2 },
      materialReward: { paper: 1 },
      requiresExpedition: true
    }
  ];

  const MOON_BRANCHES = { busy: "忙碌", journey: "远行", vigil: "守夜", pack: "行囊" };

  const MOON_NODES = [
    { id: "busy1", branch: "busy", name: "手心的温度", desc: "完美判定范围 +30%", cost: 1 },
    { id: "busy2", branch: "busy", name: "墨水瓶", desc: "每次完美多得 1 墨点", cost: 2, requires: "busy1" },
    { id: "busy3", branch: "busy", name: "自动盖戳", desc: "每秒自动盖一次，不算完美", cost: 3, requires: "busy2" },
    { id: "journey1", branch: "journey", name: "多备一辆车", desc: "邮路派遣位 +1", cost: 1 },
    { id: "journey2", branch: "journey", name: "顺路捎带", desc: "邮路耗时 -20%", cost: 2, requires: "journey1" },
    { id: "journey3", branch: "journey", name: "回车铃", desc: "完成的邮路自动领回", cost: 3, requires: "journey2" },
    { id: "vigil1", branch: "vigil", name: "留一盏灯", desc: "离线收益 50% → 65%", cost: 1 },
    { id: "vigil2", branch: "vigil", name: "信件归档", desc: "柜台订单位 +1", cost: 2, requires: "vigil1" },
    { id: "vigil3", branch: "vigil", name: "长夜", desc: "离线上限 2 → 4 小时，订单时限 +25%", cost: 3, requires: "vigil2" },
    { id: "pack1", branch: "pack", name: "远行背囊", desc: "远行开局干粮 +1", cost: 1 },
    { id: "pack2", branch: "pack", name: "备用信封", desc: "信件上限 +1，开局带 4 封", cost: 2, requires: "pack1" },
    { id: "pack3", branch: "pack", name: "路口的地图", desc: "远行开局多 1 张随机牌", cost: 3, requires: "pack2" }
  ];

  const CONTRACTS = [
    {
      id: "urgent",
      name: "急件夜",
      desc: "订单奖励 +50%，但订单时限 -25%。",
      orderReward: 1.5,
      orderTime: 0.75
    },
    {
      id: "slow",
      name: "慢信夜",
      desc: "离线收益 +50%，但盖戳 -25%。",
      offline: 1.5,
      click: 0.75
    },
    {
      id: "inky",
      name: "墨迹夜",
      desc: "墨点收入 ×2，但邮路回信 -20%。",
      ink: 2,
      dispatch: 0.8
    }
  ];

  const EVENTS = [
    {
      id: "wet_cat",
      title: "门口的小猫",
      weight: 3,
      available: () => state.totalEarned >= 60,
      body: [
        "一只湿透的小猫蹲在邮袋旁边，尾巴卷成一个问号。",
        "它没有叫，只是看着你手里的蜡封。"
      ],
      choices: [
        {
          label: "给它一条毯子",
          note: "-30 邮票 · +6 墨点",
          cost: { stamps: 30 },
          reward: { ink: 6 },
          result: "它蜷在邮袋上睡着了，呼吸把毯子吹得一鼓一鼓。"
        },
        {
          label: "让它进来烤火",
          note: "风铃立刻恢复",
          reward: { ink: 3, bellReset: true },
          result: "火苗跳了一下。风铃自己响了半声，又安静下来。"
        },
        {
          label: "把它放回门口",
          note: "+40 邮票",
          reward: { stamps: 40 },
          result: "它抖了抖毛，留下一张被雨打湿的邮票。"
        }
      ]
    },
    {
      id: "lost_letter",
      title: "迷路的信",
      weight: 2,
      available: () => state.totalEarned >= 400,
      body: [
        "一封没有邮戳的信从门缝里滑进来，地址被水晕开了一半。",
        "信封很轻，里面好像只有一张纸。"
      ],
      choices: [
        {
          label: "拆开看看",
          note: "+10 墨点",
          reward: { ink: 10 },
          result: "里面是一张空白信纸。你把它折成一只纸飞机，放进邮袋。"
        },
        {
          label: "按地址送回去",
          note: "-60 邮票 · +8 墨点 · +300 邮票",
          cost: { stamps: 60 },
          reward: { ink: 8, stamps: 300 },
          result: "地址的尽头是一位等着回信的老人。他塞给你一叠旧邮票。"
        },
        {
          label: "夹回邮袋",
          note: "什么也不发生",
          reward: {},
          result: "你把信夹回邮袋，决定等它自己找到收件人。"
        }
      ]
    },
    {
      id: "night_bus",
      title: "夜班车抛锚",
      weight: 2,
      available: () => state.moonStamps >= 1,
      body: [
        "月光邮车在镇口熄了火，司机蹲在轮子旁边发愁。",
        "离发车还有一会儿，你还有得选。"
      ],
      choices: [
        {
          label: "用墨点修好它",
          note: "-40 墨点 · 约 3 分钟产出",
          cost: { ink: 40 },
          reward: { rateSeconds: 180 },
          result: "引擎咳了两声，亮起一盏小灯。司机朝你挥了挥帽子。"
        },
        {
          label: "陪他走路送信",
          note: "约 1 分钟产出 · +6 墨点",
          reward: { rateSeconds: 60, ink: 6 },
          result: "你们沿着铁轨走了一站路，把信交给了路边的稻草人。"
        },
        {
          label: "让他等天亮",
          note: "+5 墨点",
          reward: { ink: 5 },
          result: "你留下一壶茶。天亮时，车已经自己开走了。"
        }
      ]
    },
    {
      id: "market",
      title: "集市换物",
      weight: 2,
      available: () => state.inkTotal >= 20,
      body: [
        "一个背着布袋的货郎在门口铺开一块布，上面摆着稀奇古怪的小东西。",
        "\"只换不卖。\"他说。"
      ],
      choices: [
        {
          label: "用墨点换一封闪光信",
          note: "-25 墨点 · 掉下一封闪光信",
          cost: { ink: 25 },
          reward: { golden: true },
          result: "货郎把信举到阳光下。信封上的蜡封亮了一下，飘走了。"
        },
        {
          label: "用邮票换一瓶墨",
          note: "-500 邮票 · +8 墨点",
          cost: { stamps: 500 },
          reward: { ink: 8 },
          result: "墨水瓶很沉，瓶底刻着一行小字：写给夜里的邮差。"
        },
        {
          label: "看看就走",
          note: "什么也不发生",
          reward: {},
          result: "货郎点点头，把布收了起来。"
        }
      ]
    },
    {
      id: "old_postman",
      title: "老邮差的旧事",
      weight: 2,
      available: () => state.clicks >= 50,
      body: [
        "一位背着旧邮包的老人在门口坐下，说他年轻时也在这条路上送信。",
        "他问你：现在的蜡封，还暖不暖？"
      ],
      choices: [
        {
          label: "听他讲完旧邮路",
          note: "+4 墨点 · 换一批来信",
          reward: { ink: 4, reroll: true },
          result: "他讲了很久。临走时，柜台上的信被风吹得换了个顺序。"
        },
        {
          label: "请他喝一杯蘑菇茶",
          note: "-40 邮票 · +8 墨点",
          cost: { stamps: 40 },
          reward: { ink: 8 },
          result: "他捧着杯子暖了很久，说这味道像他年轻时的那间邮局。"
        },
        {
          label: "送他到路口",
          note: "+3 墨点",
          reward: { ink: 3 },
          result: "他走得很慢。你回到柜台时，蜡封还是温的。"
        }
      ]
    }
  ];


  const EXP_CARDS = {
    umbrella: { name: "撑伞", tag: "rain", power: 1, desc: "雨天 +3 通行" },
    ride: { name: "搭车", tag: "road", power: 1, desc: "道路 +3，耗 1 干粮", supplyCost: 1 },
    lantern: { name: "夜灯", tag: "night", power: 1, desc: "夜路 +3" },
    breeze: { name: "借风", tag: "wind", power: 1, desc: "逆风 +3" },
    stamp: { name: "邮戳", tag: "any", power: 2, desc: "任何路况 +2" },
    detour: { name: "绕路", tag: "any", power: 0, desc: "跳过路障，耗 1 干粮", supplyCost: 1, skip: true },
    shield: { name: "护信", tag: "any", power: 0, desc: "这次失败不掉信", shield: true },
    oilpaper: { name: "油纸", tag: "rain", power: 3, desc: "雨天 +5 通行", unlockWins: 1 },
    compass: { name: "罗盘", tag: "road", power: 2, desc: "道路 +4 通行", unlockWins: 2 },
    thermos: { name: "热水壶", tag: "any", power: 0, desc: "回复 1 封信", heal: 1, unlockWins: 3 },
    seal: { name: "火漆", tag: "any", power: 3, desc: "任何路况 +3 通行", unlockWins: 5 },
    raincoat: { name: "雨衣", tag: "rain", power: 2, desc: "雨天 +4，失败不掉信", shield: true, unlockWins: 1 },
    kite: { name: "风筝", tag: "wind", power: 2, desc: "逆风 +4 通行", unlockWins: 2 },
    stove: { name: "小火炉", tag: "night", power: 2, desc: "夜路 +4，回复 1 封信", heal: 1, unlockWins: 3 },
    cart: { name: "板车", tag: "road", power: 2, desc: "道路 +4，耗 1 干粮", supplyCost: 1, unlockWins: 4 },
    ration: { name: "干粮袋", tag: "any", power: 0, desc: "补 2 份干粮", supplyGain: 2, unlockWins: 4 },
    map: { name: "手绘地图", tag: "any", power: 1, desc: "任何 +1，下一段需求 -1", scout: true, unlockWins: 6 }
  };

  const EXP_STARTER = [
    "umbrella", "umbrella", "umbrella",
    "ride", "ride", "ride",
    "lantern", "lantern",
    "stamp", "stamp",
    "detour", "detour",
    "shield", "shield"
  ];

  const EXP_RELICS = {
    watch: { name: "旧怀表", desc: "匹配路况的牌额外 +1 通行" },
    spare_bag: { name: "备用邮袋", desc: "每趟开局多 2 份干粮" },
    wax: { name: "蜡封", desc: "每趟第一次失败不掉信" }
  };

  const EXP_MATERIALS = {
    paper: { name: "纸" },
    wax: { name: "蜡" },
    cloth: { name: "布" }
  };

  const EXP_MATERIAL_BY_TAG = {
    rain: "paper",
    wind: "paper",
    night: "wax",
    road: "cloth"
  };

  const EXP_PREP = {
    paper: { name: "多带一张牌", cost: 2, desc: "从已解锁的牌里随机多带 1 张" },
    wax: { name: "蜡封护信", cost: 1, desc: "本趟第一次失败不掉信" },
    cloth: { name: "加固邮袋", cost: 2, desc: "开局多 2 份干粮" }
  };

  const EXP_HAZARDS = [
    { tag: "rain", title: "雨夜", desc: "雨把路泡软了，信纸开始发潮。", need: 3 },
    { tag: "road", title: "断桥", desc: "桥面塌了一半，邮车过不去。", need: 3 },
    { tag: "night", title: "没有灯的路", desc: "月亮被云遮住，路标看不见了。", need: 4 },
    { tag: "wind", title: "逆风", desc: "风从湖面卷过来，纸飞机飞不动。", need: 3 }
  ];

  const EXP_ELITES = [
    { id: "watchtower", tag: "night", title: "雾里的旧哨站", desc: "哨站里还有一盏没灭的灯，邮袋被锁在铁柜里。", need: 5, material: "wax" },
    { id: "wreck", tag: "rain", title: "沉船的邮包", desc: "半沉的邮船卡在芦苇里，邮包还系在桅杆上。", need: 5, material: "paper" },
    { id: "ferry_ruin", tag: "road", title: "废弃的驿站", desc: "驿站的门被风顶住，里面堆着没人取走的布包。", need: 5, material: "cloth" }
  ];

  const EXP_BOSSES = [
    { id: "starport", tag: "night", title: "星港关门", desc: "最后一班星船要开了，信必须在关门前送进去。", need: 4 },
    { id: "flood", tag: "rain", title: "雾湖涨潮", desc: "湖水漫过了栈桥，最后一段路只剩半截。", need: 4 },
    { id: "last_bus", tag: "road", title: "最后一班车", desc: "邮车已经发动，轮子陷在泥里，只差最后一推。", need: 3 },
    { id: "wind_gate", tag: "wind", title: "风口上的星船", desc: "星船停在风口，信要顺着风递上去。", need: 4 }
  ];

  const EXP_EVENTS = [
    {
      id: "ferry",
      title: "摆渡人",
      text: "湖边停着一条小船，摆渡人说可以捎你过湖，但要拿干粮换。",
      choices: [
        { label: "用 1 份干粮换船", cost: { supplies: 1 }, result: "船桨划开雾，你省下了一大段路。", effect: { lootStamps: 90, ink: 2 } },
        { label: "沿湖走过去", cost: {}, result: "湖岸的石头很滑，你走得很慢，但没花干粮。", effect: {} }
      ]
    },
    {
      id: "old_box",
      title: "路边的旧邮筒",
      text: "一只生锈的邮筒立在岔路口，里面好像还塞着什么东西。",
      choices: [
        { label: "伸手掏一掏", cost: { supplies: 1 }, result: "你摸出一张旧邮差牌，牌角还带着蜡。", effect: { addCard: true } },
        { label: "把邮筒擦干净", cost: {}, result: "你把邮筒擦亮，继续赶路。", effect: { lootStamps: 40 } }
      ]
    },
    {
      id: "recipient",
      title: "收件人不在家",
      text: "门敲了很久，只有一只猫从窗台跳下来。信要放在哪里？",
      choices: [
        { label: "塞进门缝，留一张便条", cost: {}, result: "你留了一张便条。猫在窗台上看着你。", effect: { lootStamps: 70 } },
        { label: "在门口等一会儿", cost: { supplies: 1 }, result: "收件人回来了，塞给你一小袋邮票。", effect: { lootStamps: 160, ink: 3 } }
      ]
    }
  ];

  // AI-painted sprite sheet, one 4x6 grid: [row, column]
  const SPRITE = {
    snail: [0, 0], mushroom: [0, 1], plane: [0, 2], van: [0, 3],
    cloud: [1, 0], star: [1, 1], seal: [1, 2], glue: [1, 3],
    handle: [2, 0], bell: [2, 1], tea: [2, 2], pouch: [2, 3],
    ladder: [3, 0], fern: [3, 1], boat: [3, 2], sun: [3, 3],
    wind: [4, 0], rain: [4, 1], mist: [4, 2], mailbox: [4, 3],
    letter: [5, 0], tote: [5, 1], "sound-on": [5, 2], "sound-off": [5, 3]
  };
  const ICONS = Object.fromEntries(
    Object.entries(SPRITE).map(([name, [row, col]]) => [
      name,
      `<span class="s-icon" style="--r:${row};--c:${col}" aria-hidden="true"></span>`
    ])
  );

  const els = {
    stampBtn: document.getElementById("stampBtn"),
    stampCount: document.getElementById("stampCount"),
    rateText: document.getElementById("rateText"),
    clickValue: document.getElementById("clickValue"),
    sealGain: document.getElementById("sealGain"),
    floaters: document.getElementById("floaters"),
    comboLabel: document.getElementById("comboLabel"),
    comboFill: document.getElementById("comboFill"),
    comboTip: document.getElementById("comboTip"),
    inkCount: document.getElementById("inkCount"),
    inkTip: document.getElementById("inkTip"),
    stampQuality: document.getElementById("stampQuality"),
    stampRing: document.getElementById("stampRing"),
    stampOrbit: document.getElementById("stampOrbit"),
    scene: document.getElementById("scene"),
    sceneFx: document.getElementById("sceneFx"),
    stageCard: document.getElementById("stageCard"),
    weatherChip: document.getElementById("weatherChip"),
    weatherIcon: document.getElementById("weatherIcon"),
    weatherLabel: document.getElementById("weatherLabel"),
    sceneSparks: document.getElementById("sceneSparks"),
    goldenLetter: document.getElementById("goldenLetter"),
    goalStrip: document.getElementById("goalStrip"),
    goalTitle: document.getElementById("goalTitle"),
    goalCount: document.getElementById("goalCount"),
    goalFill: document.getElementById("goalFill"),
    bellBtn: document.getElementById("bellBtn"),
    bellLabel: document.getElementById("bellLabel"),
    bellSub: document.getElementById("bellSub"),
    panelEyebrow: document.getElementById("panelEyebrow"),
    panelTitle: document.getElementById("panelTitle"),
    panelBody: document.getElementById("panelBody"),
    buySwitch: document.getElementById("buySwitch"),
    tabs: Array.from(document.querySelectorAll(".tab")),
    upgradeDot: document.getElementById("upgradeDot"),
    orderDot: document.getElementById("orderDot"),
    dispatchDot: document.getElementById("dispatchDot"),
    albumDot: document.getElementById("albumDot"),
    moonDot: document.getElementById("moonDot"),
    collectionText: document.getElementById("collectionText"),
    soundBtn: document.getElementById("soundBtn"),
    soundIconOn: document.getElementById("soundIconOn"),
    soundIconOff: document.getElementById("soundIconOff"),
    soundLabel: document.getElementById("soundLabel"),
    helpBtn: document.getElementById("helpBtn"),
    resetBtn: document.getElementById("resetBtn"),
    accountBtn: document.getElementById("accountBtn"),
    accountLabel: document.getElementById("accountLabel"),
    townBtn: document.getElementById("townBtn"),
    townLabel: document.getElementById("townLabel"),
    townDot: document.getElementById("townDot"),
    saveNote: document.getElementById("saveNote"),
    dayLabel: document.getElementById("dayLabel"),
    toast: document.getElementById("toast"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    modalConfirm: document.getElementById("modalConfirm"),
    modalCancel: document.getElementById("modalCancel"),
    quickStamps: document.getElementById("quickStamps"),
    quickRate: document.getElementById("quickRate"),
    quickGain: document.getElementById("quickGain"),
    quickStampBtn: document.getElementById("quickStampBtn"),
    quickShopBtn: document.getElementById("quickShopBtn"),
    mobileDock: document.getElementById("mobileDock")
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = null;
  let booted = false;
  let activeTab = "posties";
  let combo = 0;
  let comboTimer = 0;
  let stampAnchor = 0;
  let lastAutoStampAt = 0;
  let lastOrderAt = 0;
  let lastEventCheckAt = 0;
  let nextEventAt = 0;
  let eventOpen = false;
  let activeEvent = null;
  let lastEventId = "";
  let expSelection = [];
  let expConfirmAbandon = false;
  let expeditionPrep = new Set();
  let account = null;
  let accountMode = "login";
  let accountBaseDraft = cloudApi.defaultBase();
  let cloudPushTimer = 0;
  let cloudPushing = false;
  let suppressSaves = false;
  let townData = null;
  let townLoading = false;
  let townError = "";
  let townUnread = 0;
  let postcardTarget = null;
  let lastFrame = performance.now();
  let lastUiAt = 0;
  let lastGoalAt = 0;
  let lastAchievementAt = 0;
  let lastWeatherAt = 0;
  let lastDispatchAt = 0;
  let lastSaveAt = 0;
  let lastToastTimeout = 0;
  let goldenHideTimeout = 0;
  let goldenScheduleTimeout = 0;
  let goldenVisible = false;
  let audioCtx = null;
  let modalAction = null;
  let modalReturnFocus = null;
  let ownedUpgradeSet = new Set();
  let achievementSet = new Set();
  let unseenAchievements = 0;
  let shopBuilt = false;
  let upgradesBuilt = false;
  let albumBuilt = false;
  let moonBuilt = false;
  let dispatchBuilt = false;
  let dispatchUi = null;

  const shopUi = new Map();
  const upgradeUi = new Map();
  const albumUi = new Map();

  function createInitialState(sound = true) {
    return {
      version: 8,
      stamps: 0,
      runEarned: 0,
      totalEarned: 0,
      clicks: 0,
      bestCombo: 0,
      goldenLetters: 0,
      bellUses: 0,
      moonStamps: 0,
      legacyMoonBonus: 0,
      moonTree: [],
      contract: "",
      ink: 0,
      inkTotal: 0,
      perfects: 0,
      ordersDone: 0,
      nextOrderId: 1,
      offers: [],
      accepted: [],
      expedition: null,
      expeditionWins: 0,
      expeditionDeck: [...EXP_STARTER],
      expeditionRelics: [],
      materials: { paper: 0, wax: 0, cloth: 0 },
      materialUpgrades: [],
      postcardAlbum: [],
      postcardAlbumReward: false,
      gens: Object.fromEntries(GENERATORS.map((gen) => [gen.id, 0])),
      boughtTotal: Object.fromEntries(GENERATORS.map((gen) => [gen.id, 0])),
      upgrades: [],
      achievements: [],
      goalsDone: [],
      weatherId: "sunny",
      weatherUntil: Date.now() + WEATHER_DURATION,
      bellActiveUntil: 0,
      bellReadyAt: 0,
      routeRuns: Object.fromEntries(ROUTES.map((route) => [route.id, 0])),
      activeTrips: [],
      readyTrips: [],
      nextTripId: 1,
      sound,
      buyAmount: 1,
      startedAt: Date.now(),
      lastSeen: Date.now()
    };
  }

  function numberOr(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0
      ? Math.min(number, MAX_SAFE_STATE)
      : fallback;
  }

  function normalizeState(raw) {
    const clean = createInitialState(true);
    if (!raw || typeof raw !== "object") return clean;

    clean.stamps = numberOr(raw.stamps);
    clean.runEarned = numberOr(raw.runEarned);
    clean.totalEarned = Math.max(numberOr(raw.totalEarned), clean.runEarned, clean.stamps);
    clean.clicks = Math.floor(numberOr(raw.clicks));
    clean.bestCombo = Math.floor(numberOr(raw.bestCombo));
    clean.goldenLetters = Math.floor(numberOr(raw.goldenLetters));
    clean.bellUses = Math.floor(numberOr(raw.bellUses));
    clean.moonStamps = Math.floor(numberOr(raw.moonStamps));
    clean.legacyMoonBonus = raw.version < 4 && raw.legacyMoonBonus === undefined
      ? moonBonusPercentFor(clean.moonStamps)
      : Math.floor(numberOr(raw.legacyMoonBonus));
    clean.ink = Math.floor(numberOr(raw.ink));
    clean.inkTotal = Math.max(clean.ink, Math.floor(numberOr(raw.inkTotal)));
    clean.perfects = Math.floor(numberOr(raw.perfects));
    clean.ordersDone = Math.floor(numberOr(raw.ordersDone));
    clean.contract = CONTRACTS.some((contract) => contract.id === raw.contract) ? raw.contract : "";
    if (Array.isArray(raw.moonTree)) {
      clean.moonTree = [...new Set(raw.moonTree)]
        .filter((id) => MOON_NODES.some((node) => node.id === id));
    }
    if (Array.isArray(raw.offers)) {
      clean.offers = raw.offers.map(normalizeOffer).filter(Boolean).slice(0, 4);
    }
    if (Array.isArray(raw.accepted)) {
      clean.accepted = raw.accepted.map(normalizeAcceptedOrder).filter(Boolean).slice(0, 5);
    }
    const maxOrderId = [...clean.offers, ...clean.accepted]
      .reduce((max, order) => Math.max(max, order.id), 0);
    clean.nextOrderId = Math.max(Math.floor(numberOr(raw.nextOrderId, maxOrderId + 1)), maxOrderId + 1);
    clean.expeditionWins = Math.floor(numberOr(raw.expeditionWins));
    const deck = Array.isArray(raw.expeditionDeck) ? raw.expeditionDeck : EXP_STARTER;
    clean.expeditionDeck = deck
      .filter((id) => EXP_CARDS[id] && expeditionCardUnlocked(id, clean.expeditionWins))
      .slice(0, 30);
    if (!clean.expeditionDeck.length) clean.expeditionDeck = [...EXP_STARTER];
    clean.expeditionRelics = Array.isArray(raw.expeditionRelics)
      ? [...new Set(raw.expeditionRelics)]
          .filter((id) => EXP_RELICS[id])
          .slice(0, 3)
      : [];
    const materials = raw.materials && typeof raw.materials === "object" ? raw.materials : {};
    clean.materials = {
      paper: Math.min(99, Math.floor(numberOr(materials.paper))),
      wax: Math.min(99, Math.floor(numberOr(materials.wax))),
      cloth: Math.min(99, Math.floor(numberOr(materials.cloth)))
    };
    clean.materialUpgrades = Array.isArray(raw.materialUpgrades)
      ? [...new Set(raw.materialUpgrades)].filter((id) => MATERIAL_UPGRADES.some((item) => item.id === id))
      : [];
    const seenPostcards = new Set();
    clean.postcardAlbum = Array.isArray(raw.postcardAlbum)
      ? raw.postcardAlbum.filter((entry) => {
          if (!entry || typeof entry.senderId !== "string") return false;
          if (!TOWN_BOTS.some((bot) => bot.id === entry.senderId)) return false;
          if (seenPostcards.has(entry.senderId)) return false;
          seenPostcards.add(entry.senderId);
          return true;
        }).slice(0, TOWN_BOTS.length)
      : [];
    clean.postcardAlbumReward = Boolean(raw.postcardAlbumReward);
    clean.expedition = normalizeExpedition(raw.expedition);
    clean.bellActiveUntil = numberOr(raw.bellActiveUntil);
    clean.bellReadyAt = numberOr(raw.bellReadyAt);
    clean.weatherUntil = numberOr(raw.weatherUntil);
    clean.weatherId = WEATHERS.some((weather) => weather.id === raw.weatherId)
      ? raw.weatherId
      : "sunny";
    clean.sound = raw.sound !== false;
    clean.buyAmount = Number(raw.buyAmount) === 10 ? 10 : 1;
    clean.startedAt = numberOr(raw.startedAt, Date.now()) || Date.now();
    clean.lastSeen = numberOr(raw.lastSeen, Date.now()) || Date.now();

    if (raw.gens && typeof raw.gens === "object") {
      GENERATORS.forEach((gen) => {
        clean.gens[gen.id] = Math.floor(numberOr(raw.gens[gen.id]));
      });
    }

    if (raw.boughtTotal && typeof raw.boughtTotal === "object") {
      GENERATORS.forEach((gen) => {
        clean.boughtTotal[gen.id] = Math.floor(
          numberOr(raw.boughtTotal[gen.id], clean.gens[gen.id])
        );
      });
    } else {
      GENERATORS.forEach((gen) => {
        clean.boughtTotal[gen.id] = clean.gens[gen.id];
      });
    }

    if (Array.isArray(raw.upgrades)) {
      const known = new Set(UPGRADES.map((upgrade) => upgrade.id));
      clean.upgrades = [...new Set(raw.upgrades.filter((id) => known.has(id)))];
    }

    if (Array.isArray(raw.achievements)) {
      const known = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
      clean.achievements = [...new Set(raw.achievements.filter((id) => known.has(id)))];
    }

    if (Array.isArray(raw.goalsDone)) {
      const known = new Set(GOALS.map((goal) => goal.id));
      clean.goalsDone = [...new Set(raw.goalsDone.filter((id) => known.has(id)))];
    }

    if (raw.routeRuns && typeof raw.routeRuns === "object") {
      ROUTES.forEach((route) => {
        clean.routeRuns[route.id] = Math.floor(numberOr(raw.routeRuns[route.id]));
      });
    }

    const knownRoutes = new Set(ROUTES.map((route) => route.id));
    if (Array.isArray(raw.activeTrips)) {
      clean.activeTrips = raw.activeTrips
        .filter((trip) => trip && knownRoutes.has(trip.routeId))
        .map((trip) => ({
          id: Math.floor(numberOr(trip.id)),
          routeId: trip.routeId,
          startedAt: numberOr(trip.startedAt),
          endsAt: numberOr(trip.endsAt),
          reward: numberOr(trip.reward)
        }))
        .filter((trip) => trip.id > 0 && trip.endsAt > trip.startedAt && trip.reward > 0)
        .slice(0, DISPATCH_SLOTS + 1);
    }

    if (Array.isArray(raw.readyTrips)) {
      clean.readyTrips = raw.readyTrips
        .filter((trip) => trip && knownRoutes.has(trip.routeId))
        .map((trip) => ({
          id: Math.floor(numberOr(trip.id)),
          routeId: trip.routeId,
          reward: numberOr(trip.reward)
        }))
        .filter((trip) => trip.id > 0 && trip.reward > 0)
        .slice(-20);
    }

    const maxTripId = [...clean.activeTrips, ...clean.readyTrips]
      .reduce((max, trip) => Math.max(max, trip.id), 0);
    clean.nextTripId = Math.max(Math.floor(numberOr(raw.nextTripId, maxTripId + 1)), maxTripId + 1);

    return clean;
  }

  function readSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeSave(payload) {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (error) {
      /* A private window can refuse storage. The game still runs. */
    }
  }

  function addStamps(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    state.stamps = Math.min(MAX_SAFE_STATE, state.stamps + amount);
    state.runEarned = Math.min(MAX_SAFE_STATE, state.runEarned + amount);
    state.totalEarned = Math.min(MAX_SAFE_STATE, state.totalEarned + amount);
  }

  function ownedAllMultiplier() {
    let multiplier = 1;
    UPGRADES.forEach((upgrade) => {
      if (upgrade.kind === "all" && ownedUpgradeSet.has(upgrade.id)) {
        multiplier *= upgrade.mult;
      }
    });
    return multiplier;
  }

  function ownedClickMultiplier() {
    let multiplier = 1;
    UPGRADES.forEach((upgrade) => {
      if (upgrade.kind === "click" && ownedUpgradeSet.has(upgrade.id)) {
        multiplier *= upgrade.mult;
      }
    });
    return multiplier;
  }

  function moonBonusPercentFor(stamps) {
    return Math.round(MOON_BONUS * Math.log2(1 + Math.max(0, stamps)) * 100);
  }

  function hasNode(id) {
    return Boolean(state && state.moonTree.includes(id));
  }

  function moonSpent() {
    if (!state) return 0;
    return state.moonTree.reduce((total, id) => {
      const node = MOON_NODES.find((candidate) => candidate.id === id);
      return total + (node ? node.cost : 0);
    }, 0);
  }

  function moonPoints() {
    if (!state) return 0;
    return Math.max(0, state.moonStamps - moonSpent());
  }

  function moonBonusPercent() {
    if (!state) return 0;
    return Math.max(0, state.legacyMoonBonus || 0) + moonSpent() * 10;
  }

  function moonMultiplier() {
    return 1 + moonBonusPercent() / 100;
  }

  function currentContract() {
    return state ? CONTRACTS.find((contract) => contract.id === state.contract) || null : null;
  }

  function contractMods() {
    return currentContract() || {};
  }

  function offlineRate() {
    return (hasNode("vigil1") ? 0.65 : 0.5) * (contractMods().offline || 1);
  }

  function offlineCap() {
    return (hasNode("vigil3") ? 4 : 2) * 60 * 60;
  }

  function dispatchSlots() {
    return DISPATCH_SLOTS + (hasNode("journey1") ? 1 : 0);
  }

  function inkMultiplier() {
    return contractMods().ink || 1;
  }

  function addInk(amount) {
    if (!state || !Number.isFinite(amount) || amount <= 0) return;
    const gain = Math.floor(amount);
    if (gain <= 0) return;
    state.ink = Math.min(MAX_SAFE_STATE, state.ink + gain);
    state.inkTotal = Math.min(MAX_SAFE_STATE, state.inkTotal + gain);
  }

  function spendInk(cost) {
    if (!state || state.ink < cost) return false;
    state.ink -= cost;
    return true;
  }

  function perfectWindow() {
    return 0.14 * (hasNode("busy1") ? 1.3 : 1);
  }

  function stampPeriod() {
    return 1150 - Math.min(combo, 40) * 4;
  }

  function stampPhase(now) {
    const period = stampPeriod();
    return ((now - stampAnchor) % period) / period;
  }

  function stampQualityFor(now, forced) {
    if (forced) return forced;
    if (prefersReducedMotion) return "perfect";
    const distance = Math.abs(stampPhase(now) - 0.5);
    if (distance <= perfectWindow() / 2) return "perfect";
    if (distance <= 0.32 / 2) return "good";
    return "miss";
  }

  function qualityMultiplier(quality) {
    if (quality === "perfect") return prefersReducedMotion ? 1.5 : 3;
    if (quality === "good") return 1.5;
    return 1;
  }

  function orderTpl(tplId) {
    return ORDER_TEMPLATES.find((template) => template.id === tplId) || null;
  }

  function orderTier() {
    if (!state) return 0;
    return Math.min(2, Math.floor(state.ordersDone / 6));
  }

  function orderSlots() {
    return 2 + (hasNode("vigil2") ? 1 : 0);
  }

  function orderRewardScale() {
    return contractMods().orderReward || 1;
  }

  function orderDeadlineScale() {
    return (hasNode("vigil3") ? 1.25 : 1) * (contractMods().orderTime || 1);
  }

  function orderStampsFor(tier) {
    return Math.max(150, Math.round(baseRate() * (90 + tier * 30)));
  }

  function routeUnlockedForOrders(routeId) {
    const route = ROUTES.find((candidate) => candidate.id === routeId);
    return Boolean(route) && state.totalEarned >= route.unlock;
  }

  function orderTemplateEligible(template) {
    return (
      (!template.requiresRoute || routeUnlockedForOrders(template.requiresRoute)) &&
      (!template.requiresExpedition || expeditionUnlocked())
    );
  }

  function normalizeOffer(raw) {
    if (!raw || typeof raw !== "object") return null;
    const template = orderTpl(raw.tpl);
    if (!template) return null;
    const tier = Math.min(2, Math.max(0, Math.floor(numberOr(raw.tier))));
    return {
      id: Math.floor(numberOr(raw.id)),
      tpl: template.id,
      tier,
      target: Math.max(1, Math.floor(numberOr(raw.target, template.targets[tier]))),
      ink: Math.max(1, Math.floor(numberOr(raw.ink, template.ink[tier]))),
      stamps: Math.max(1, Math.floor(numberOr(raw.stamps, 150))),
      minutes: Math.max(1, Math.floor(numberOr(raw.minutes, template.minutes[tier])))
    };
  }

  function normalizeAcceptedOrder(raw) {
    if (!raw || typeof raw !== "object") return null;
    const template = orderTpl(raw.tpl);
    if (!template) return null;
    const progress = {};
    if (raw.progress && typeof raw.progress === "object") {
      Object.entries(raw.progress).forEach(([key, value]) => {
        if (typeof key === "string" && key.length < 40) {
          progress[key] = Math.floor(numberOr(value));
        }
      });
    }
    return {
      id: Math.floor(numberOr(raw.id)),
      tpl: template.id,
      tier: Math.min(2, Math.max(0, Math.floor(numberOr(raw.tier)))),
      target: Math.max(1, Math.floor(numberOr(raw.target, template.targets[0]))),
      ink: Math.max(1, Math.floor(numberOr(raw.ink, template.ink[0]))),
      stamps: Math.max(1, Math.floor(numberOr(raw.stamps, 150))),
      acceptedAt: numberOr(raw.acceptedAt),
      expiresAt: numberOr(raw.expiresAt),
      progress,
      bellUsed: Boolean(raw.bellUsed)
    };
  }

  function offerTemplatesInUse() {
    return new Set(state.offers.map((offer) => offer.tpl));
  }

  function makeOrderOffer(tier = orderTier()) {
    const inUse = offerTemplatesInUse();
    const eligible = ORDER_TEMPLATES.filter(
      (template) => orderTemplateEligible(template) && !inUse.has(template.id)
    );
    const pool = eligible.length ? eligible : ORDER_TEMPLATES.filter(orderTemplateEligible);
    if (!pool.length) return null;
    const template = pool[Math.floor(Math.random() * pool.length)];
    const level = Math.min(2, Math.max(0, tier));
    return {
      id: state.nextOrderId,
      tpl: template.id,
      tier: level,
      target: template.targets[level],
      ink: template.ink[level],
      stamps: orderStampsFor(level),
      minutes: template.minutes[level]
    };
  }

  function ensureOffers() {
    if (!state) return;
    state.offers = state.offers.filter((offer) => offer && orderTpl(offer.tpl));
    let guard = 0;
    while (state.offers.length < 3 && guard < 12) {
      guard += 1;
      const offer = makeOrderOffer();
      if (!offer) break;
      state.nextOrderId += 1;
      state.offers.push(offer);
    }
  }

  function orderProgressValue(order) {
    const template = orderTpl(order.tpl);
    if (!template) return 0;
    return Math.floor(order.progress[template.goalKey] || 0);
  }

  function orderConditionMet(order) {
    const template = orderTpl(order.tpl);
    if (!template) return false;
    if (template.condition && template.condition.weather) {
      if (currentWeather().id !== template.condition.weather) return false;
    }
    if (template.condition && template.condition.noBell && order.bellUsed) return false;
    return orderProgressValue(order) >= order.target;
  }

  function orderConditionNote(order) {
    const template = orderTpl(order.tpl);
    if (!template) return "";
    if (template.condition && template.condition.weather) {
      const weather = WEATHERS.find((candidate) => candidate.id === template.condition.weather);
      if (currentWeather().id !== template.condition.weather) {
        return `等一场${weather ? weather.name : "合适的天气"}`;
      }
    }
    if (template.condition && template.condition.noBell && order.bellUsed) {
      return "风铃响过了，这单送不成了";
    }
    return "";
  }

  function orderTimeLeft(order) {
    return Math.max(0, order.expiresAt - Date.now());
  }

  function orderRewardInk(order) {
    return Math.max(1, Math.round(order.ink * inkMultiplier()));
  }

  function orderRewardStamps(order) {
    return Math.max(1, Math.round(order.stamps * orderRewardScale()));
  }

  function orderMaterialCost(order) {
    const template = orderTpl(order.tpl);
    return template && template.materialCost ? template.materialCost : {};
  }

  function canPayMaterials(cost) {
    return Object.entries(cost || {}).every(
      ([id, quantity]) => (state.materials[id] || 0) >= quantity
    );
  }

  function payMaterials(cost) {
    Object.entries(cost || {}).forEach(([id, quantity]) => {
      state.materials[id] = Math.max(0, (state.materials[id] || 0) - quantity);
    });
  }

  function materialCostText(cost) {
    return Object.entries(cost || {})
      .filter(([id, quantity]) => EXP_MATERIALS[id] && quantity > 0)
      .map(([id, quantity]) => `${EXP_MATERIALS[id].name}×${quantity}`)
      .join("、");
  }

  function bumpOrders(kind, detail = 1) {
    if (!state) return false;
    let changed = false;
    state.accepted.forEach((order) => {
      const template = orderTpl(order.tpl);
      if (!template) return;
      if (kind === "trip") {
        if (template.goalKey === "trips") {
          order.progress.trips = Math.min(order.target, (order.progress.trips || 0) + 1);
          changed = true;
        }
        if (template.goalKey === `route:${detail}`) {
          const key = `route:${detail}`;
          order.progress[key] = Math.min(order.target, (order.progress[key] || 0) + 1);
          changed = true;
        }
      } else if (kind === "combo") {
        if (template.goalKey === "bestCombo") {
          const next = Math.max(order.progress.bestCombo || 0, detail);
          if (next !== order.progress.bestCombo) {
            order.progress.bestCombo = next;
            changed = true;
          }
        }
      } else if (kind === "bell") {
        if (template.condition && template.condition.noBell && !order.bellUsed) {
          order.bellUsed = true;
          changed = true;
        }
      } else if (template.goalKey === kind) {
        order.progress[kind] = Math.min(order.target, (order.progress[kind] || 0) + detail);
        changed = true;
      }
    });
    if (changed) {
      if (activeTab === "orders") refreshOrdersUi();
      updateTabBadges();
    }
    return changed;
  }

  function syncOrders(options = {}) {
    if (!state || !state.accepted.length) return 0;
    const now = Date.now();
    const survivors = [];
    let expired = 0;
    state.accepted.forEach((order) => {
      if (order.expiresAt <= now) {
        expired += 1;
      } else {
        survivors.push(order);
      }
    });
    if (!expired) return 0;
    state.accepted = survivors;
    ensureOffers();
    if (activeTab === "orders") buildOrdersPanel();
    updateTabBadges();
    saveGame();
    if (!document.hidden && !options.silent) {
      showToast(
        expired === 1
          ? "有一封信错过了邮车，柜台又换上了新的来信。"
          : `${expired} 封信错过了邮车，柜台又换上了新的来信。`,
        4200
      );
    }
    return expired;
  }

  function achievementMultiplier() {
    let bonus = 0;
    ACHIEVEMENTS.forEach((achievement) => {
      if (achievementSet.has(achievement.id)) bonus += achievement.reward;
    });
    return 1 + bonus;
  }

  function currentWeather() {
    return WEATHERS.find((weather) => weather.id === state.weatherId) || WEATHERS[0];
  }

  function generatorMilestoneMultiplier(gen) {
    const owned = state.gens[gen.id] || 0;
    let multiplier = 1;
    for (const milestone of gen.milestones) {
      if (owned >= milestone.count) multiplier = milestone.mult;
    }
    return multiplier;
  }

  function weatherGeneratorMultiplier(genId) {
    const weather = currentWeather();
    return (weather.genBonus[genId] || 1) * (weather.globalRate || 1);
  }

  function weatherClickMultiplier() {
    return currentWeather().clickMultiplier || 1;
  }

  function bellMultiplier() {
    return Date.now() < state.bellActiveUntil ? 3 : 1;
  }

  function baseRate() {
    const perSecond = GENERATORS.reduce((total, gen) => {
      if (!isGeneratorUnlocked(gen)) return total;
      const owned = state.gens[gen.id] || 0;
      return total + owned * gen.rate
        * generatorMilestoneMultiplier(gen)
        * weatherGeneratorMultiplier(gen.id);
    }, 0);
    return perSecond * ownedAllMultiplier() * moonMultiplier()
      * achievementMultiplier() * bellMultiplier();
  }

  function baseClickPower() {
    return ownedClickMultiplier() * moonMultiplier()
      * achievementMultiplier() * weatherClickMultiplier() * bellMultiplier()
      * (contractMods().click || 1);
  }

  function comboMultiplier() {
    return 1 + Math.min(combo, 40) * 0.015;
  }

  function generatorCost(gen, amount) {
    const owned = state.gens[gen.id] || 0;
    const first = gen.cost * Math.pow(gen.growth, owned);
    if (amount === 1) return Math.ceil(first);
    const total = first * (Math.pow(gen.growth, amount) - 1) / (gen.growth - 1);
    return Math.ceil(total);
  }

  function canAfford(cost) {
    return Math.floor(state.stamps) >= cost;
  }

  function isGeneratorUnlocked(gen) {
    return state.totalEarned >= gen.unlock;
  }

  function isUpgradeUnlocked(upgrade) {
    return state.totalEarned >= upgrade.unlock;
  }

  function trimZero(value) {
    return String(Number.parseFloat(value));
  }

  function fixedFloor(value, digits) {
    const factor = Math.pow(10, digits);
    return (Math.floor(value * factor + 1e-9) / factor).toFixed(digits);
  }

  function compact(value) {
    const absolute = Math.abs(value);
    if (absolute >= 1e12) {
      const scaled = value / 1e12;
      return `${trimZero(fixedFloor(scaled, scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2))}万亿`;
    }
    if (absolute >= 1e8) {
      const scaled = value / 1e8;
      return `${trimZero(fixedFloor(scaled, scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2))}亿`;
    }
    if (absolute >= 1e4) {
      const scaled = value / 1e4;
      return `${trimZero(fixedFloor(scaled, scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2))}万`;
    }
    if (absolute >= 1000) {
      return Math.floor(value).toLocaleString("zh-CN");
    }
    return null;
  }

  function completionPercent(value, target) {
    if (!Number.isFinite(target) || target <= 0) return 0;
    const raw = (value / target) * 100;
    if (value < target) return Math.min(99.9, Math.max(0, raw));
    return Math.min(100, Math.max(0, raw));
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "∞";
    if (value < 0) value = 0;
    if (value < 10 && value % 1 > 0.05) {
      return trimZero(value.toFixed(1));
    }
    if (value < 1000) {
      return Math.floor(value).toLocaleString("zh-CN");
    }
    return compact(value) || Math.floor(value).toLocaleString("zh-CN");
  }

  function formatRate(value) {
    if (!Number.isFinite(value)) return "∞";
    if (value <= 0) return "0";
    if (value < 100) {
      return trimZero(value.toFixed(value < 10 ? 1 : 0));
    }
    return formatNumber(value);
  }

  function formatGain(value) {
    if (!Number.isFinite(value)) return "∞";
    if (value < 10) return trimZero(value.toFixed(1));
    return formatNumber(value);
  }

  function formatDuration(seconds) {
    if (seconds < 90) return "一分钟";
    if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} 分钟`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
  }

  function setText(element, text) {
    if (element && element.textContent !== text) {
      element.textContent = text;
    }
  }

  function setHidden(element, hidden) {
    if (element && element.hidden !== hidden) {
      element.hidden = hidden;
    }
  }

  function showToast(message, duration = 4600) {
    window.clearTimeout(lastToastTimeout);
    els.toast.textContent = message;
    els.toast.hidden = false;
    lastToastTimeout = window.setTimeout(() => {
      els.toast.hidden = true;
    }, duration);
  }

  function getAudioContext() {
    if (!state || !state.sound) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioCtx) {
      try {
        audioCtx = new AudioCtor();
      } catch (error) {
        return null;
      }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(frequency, options = {}) {
    const context = getAudioContext();
    if (!context) return;
    const start = options.start || 0;
    const duration = options.duration || 0.09;
    const volume = options.volume || 0.028;
    const type = options.type || "sine";
    const attack = options.attack || 0.012;
    const when = context.currentTime + start;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    if (options.slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(options.slideTo, when + duration);
    }
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.03);
  }

  function playClickSound() {
    if (!state || !state.sound) return;
    const pitch = 390 + Math.min(combo, 20) * 13;
    playTone(pitch, { duration: 0.065, volume: 0.018, type: "triangle" });
    playTone(pitch * 1.5, { start: 0.025, duration: 0.045, volume: 0.011, type: "sine" });
  }

  function playPerfectSound() {
    if (!state || !state.sound) return;
    const pitch = 523.25 + Math.min(combo, 20) * 9;
    playTone(pitch, { duration: 0.07, volume: 0.019, type: "triangle" });
    playTone(pitch * 1.5, { start: 0.035, duration: 0.07, volume: 0.014, type: "sine" });
    playTone(pitch * 2, { start: 0.08, duration: 0.1, volume: 0.01, type: "sine" });
  }

  function playBuySound() {
    playTone(440, { duration: 0.08, volume: 0.022, type: "triangle" });
    playTone(660, { start: 0.065, duration: 0.09, volume: 0.019, type: "triangle" });
  }

  function playUpgradeSound() {
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      playTone(frequency, {
        start: index * 0.06,
        duration: 0.12,
        volume: 0.019,
        type: "triangle"
      });
    });
  }

  function playDenySound() {
    playTone(170, { duration: 0.1, volume: 0.016, type: "sine" });
  }

  function playGoldenSound() {
    [659.25, 783.99, 987.77, 1318.51].forEach((frequency, index) => {
      playTone(frequency, {
        start: index * 0.075,
        duration: 0.17,
        volume: 0.018,
        type: "triangle"
      });
    });
  }

  function playBellSound() {
    [659.25, 987.77, 1318.51].forEach((frequency, index) => {
      playTone(frequency, {
        start: index * 0.07,
        duration: 0.32,
        volume: 0.016 - index * 0.002,
        type: "sine"
      });
    });
  }

  function playDispatchSound() {
    playTone(392, { duration: 0.1, volume: 0.017, type: "triangle" });
    playTone(523.25, { start: 0.08, duration: 0.12, volume: 0.015, type: "triangle" });
  }

  function playReturnSound() {
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      playTone(frequency, {
        start: index * 0.065,
        duration: 0.15,
        volume: 0.017,
        type: "sine"
      });
    });
  }

  function playPrestigeSound() {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      playTone(frequency, {
        start: index * 0.12,
        duration: 0.28,
        volume: 0.022,
        type: "sine"
      });
    });
  }

  function setDayLabel() {
    const now = new Date();
    const forecasts = ["宜寄一封慢信", "云朵在排队", "蜗牛也准时", "适合在邮票上画花"];
    const forecast = forecasts[now.getDate() % forecasts.length];
    els.dayLabel.textContent = `${now.getMonth() + 1}月${now.getDate()}日 · ${forecast}`;
  }

  function refreshSoundButton() {
    if (!state) return;
    const enabled = state.sound;
    els.soundIconOn.hidden = !enabled;
    els.soundIconOff.hidden = enabled;
    els.soundLabel.textContent = enabled ? "音效 开" : "音效 关";
    els.soundBtn.setAttribute("aria-pressed", String(enabled));
    els.soundBtn.setAttribute("aria-label", enabled ? "关闭音效" : "开启音效");
  }

  let goalsDoneSet = new Set();
  let moonUi = null;

  const TAB_TITLES = {
    posties: "把信交给谁？",
    orders: "柜台上的来信",
    dispatch: "让信去更远的地方",
    upgrades: "把邮戳磨得亮一点",
    album: "把日子贴成邮票",
    moon: "开往月亮的夜班车"
  };

  const TAB_EYEBROWS = {
    posties: "苔藓镇 · 邮局小店",
    orders: "苔藓镇 · 来信柜台",
    dispatch: "苔藓镇 · 邮路柜台",
    upgrades: "苔藓镇 · 邮戳工坊",
    album: "苔藓镇 · 集邮册",
    moon: "苔藓镇 · 月亮夜班"
  };

  const TAB_NAMES = ["posties", "orders", "dispatch", "upgrades", "album", "moon"];

  function buildShopPanel() {
    shopUi.clear();
    els.panelBody.innerHTML = GENERATORS.map((gen) => {
      const locked = !isGeneratorUnlocked(gen);
      return `
        <article class="item${locked ? " locked" : ""}" data-gen="${gen.id}">
          <div class="item-icon" aria-hidden="true">${ICONS[gen.icon]}</div>
          <div class="item-copy">
            <div class="item-name">
              ${gen.name}
              <span class="owned-badge" data-owned>×0</span>
              <span class="boost-badge" data-boost hidden></span>
            </div>
            <div class="item-desc">${gen.desc}</div>
            <div class="item-meta">
              <span data-out>每只 +0/秒</span>
              <span class="meta-sep" data-sep>·</span>
              <span data-total>共 +0/秒</span>
              <span data-lock hidden>累计赚到 ${formatNumber(gen.unlock)}张邮票后开张</span>
            </div>
            <div class="item-mile" data-mile>再买 10 只，线路升到 ×1.5</div>
          </div>
          <button class="buy-btn" type="button" data-buy="${gen.id}">
            <span class="cost" data-cost>—</span>
            <span class="unit" data-unit>邮票</span>
          </button>
        </article>`;
    }).join("");

    GENERATORS.forEach((gen) => {
      const row = els.panelBody.querySelector(`[data-gen="${gen.id}"]`);
      if (!row) return;
      shopUi.set(gen.id, {
        row,
        owned: row.querySelector("[data-owned]"),
        boost: row.querySelector("[data-boost]"),
        out: row.querySelector("[data-out]"),
        sep: row.querySelector("[data-sep]"),
        total: row.querySelector("[data-total]"),
        lock: row.querySelector("[data-lock]"),
        mile: row.querySelector("[data-mile]"),
        button: row.querySelector("[data-buy]"),
        cost: row.querySelector("[data-cost]"),
        unit: row.querySelector("[data-unit]")
      });
    });
  }

  function refreshShopUi() {
    if (!shopUi.size) return;
    const allMultiplier = ownedAllMultiplier();
    const moonBoost = moonMultiplier();
    const achievementBoost = achievementMultiplier();
    const bellBoost = bellMultiplier();
    const buyAmount = state.buyAmount;
    const weather = currentWeather();

    GENERATORS.forEach((gen) => {
      const ui = shopUi.get(gen.id);
      if (!ui) return;
      const unlocked = isGeneratorUnlocked(gen);
      const owned = state.gens[gen.id] || 0;
      const cost = generatorCost(gen, buyAmount);
      const affordable = canAfford(cost);
      const specificWeatherBoost = weather.genBonus[gen.id] || 1;
      const effectiveRate = gen.rate
        * generatorMilestoneMultiplier(gen)
        * weatherGeneratorMultiplier(gen.id)
        * allMultiplier
        * moonBoost
        * achievementBoost
        * bellBoost;
      const nextMilestone = gen.milestones.find((milestone) => owned < milestone.count);
      const mileText = nextMilestone
        ? `再买 ${nextMilestone.count - owned} 只，线路升到 ×${nextMilestone.mult}`
        : `线路里程碑全开 · ×${gen.milestones[gen.milestones.length - 1].mult}`;

      ui.row.classList.toggle("locked", !unlocked);
      setText(ui.owned, `×${owned}`);
      setText(ui.out, `每只 +${formatRate(effectiveRate)}/秒`);
      setText(ui.total, `共 +${formatRate(effectiveRate * owned)}/秒`);
      setText(ui.lock, `累计赚到 ${formatNumber(gen.unlock)}张邮票后开张`);
      setText(ui.mile, mileText);

      if (specificWeatherBoost > 1) {
        setText(ui.boost, `${weather.name} ×${specificWeatherBoost}`);
        setHidden(ui.boost, false);
      } else {
        setHidden(ui.boost, true);
      }

      setHidden(ui.out, !unlocked);
      setHidden(ui.sep, !unlocked || owned === 0);
      setHidden(ui.total, !unlocked || owned === 0);
      setHidden(ui.lock, unlocked);

      ui.button.disabled = !unlocked || !affordable;
      ui.button.classList.toggle("can-buy", unlocked && affordable);
      ui.button.classList.toggle("locked-btn", !unlocked);

      if (!unlocked) {
        setText(ui.cost, "未开张");
        setText(ui.unit, "再等等");
        ui.button.setAttribute("aria-label", `${gen.name}尚未开张，累计赚到 ${formatNumber(gen.unlock)}张邮票后解锁`);
        ui.button.title = "这间小铺还在等第一阵邮风。";
      } else {
        setText(ui.cost, formatNumber(cost));
        setText(ui.unit, buyAmount === 10 ? "邮票 ×10" : "邮票");
        ui.button.setAttribute(
          "aria-label",
          `购买 ${buyAmount} 个${gen.name}，花费 ${formatNumber(cost)}张邮票`
        );
        ui.button.title = affordable
          ? `买下 ${buyAmount} 个${gen.name}`
          : `还差 ${formatNumber(Math.max(0, cost - Math.floor(state.stamps)))}张邮票`;
      }
    });
  }

  function buildUpgradePanel() {
    upgradeUi.clear();
    const materialWorkshop = `
      <section class="material-workshop">
        <div class="tree-head">
          <span>材料工坊</span>
          <span>${materialSummary()}</span>
        </div>
        <p class="tree-note">材料只在远行成功后带回；这里的升级永久生效，转生也会留下。</p>
        ${MATERIAL_UPGRADES.map((item) => {
          const purchased = hasMaterialUpgrade(item.id);
          const affordable = (state.materials[item.material] || 0) >= item.cost;
          return `
            <article class="upgrade material-upgrade${purchased ? " purchased" : ""}">
              <div class="up-icon" aria-hidden="true">${ICONS[item.icon]}</div>
              <div class="up-copy">
                <div class="up-name">${item.name}<span class="up-tag">远行 · 永久</span></div>
                <div class="up-desc">${purchased ? "已经建好，永久生效。" : item.desc}</div>
              </div>
              ${purchased
                ? `<span class="owned-mark">已建成</span>`
                : `<button class="buy-btn" type="button" data-buy-mat-up="${item.id}" ${affordable ? "" : "disabled"}>
                     <span class="cost">${item.cost}</span>
                     <span class="unit">${EXP_MATERIALS[item.material].name}</span>
                   </button>`}
            </article>`;
        }).join("")}
      </section>`;
    els.panelBody.innerHTML = UPGRADES.map((upgrade) => {
      const purchased = ownedUpgradeSet.has(upgrade.id);
      const unlocked = isUpgradeUnlocked(upgrade);
      return `
        <article class="upgrade${purchased ? " purchased" : ""}${!purchased && !unlocked ? " locked" : ""}" data-up="${upgrade.id}">
          <div class="up-icon" aria-hidden="true">${ICONS[upgrade.icon]}</div>
          <div class="up-copy">
            <div class="up-name">
              ${upgrade.name}
              <span class="up-tag">${upgrade.effectLabel}</span>
            </div>
            <div class="up-desc" data-up-desc>${upgrade.desc}</div>
          </div>
          ${purchased
            ? `<span class="owned-mark">已盖戳</span>`
            : `<button class="buy-btn" type="button" data-buy-up="${upgrade.id}">
                 <span class="cost" data-up-cost>—</span>
                 <span class="unit" data-up-unit>邮票</span>
               </button>`}
        </article>`;
    }).join("") + materialWorkshop;

    UPGRADES.forEach((upgrade) => {
      const row = els.panelBody.querySelector(`[data-up="${upgrade.id}"]`);
      if (!row) return;
      upgradeUi.set(upgrade.id, {
        row,
        desc: row.querySelector("[data-up-desc]"),
        button: row.querySelector("[data-buy-up]"),
        cost: row.querySelector("[data-up-cost]"),
        unit: row.querySelector("[data-up-unit]")
      });
    });
  }

  function refreshUpgradeUi() {
    if (!upgradeUi.size) return;
    UPGRADES.forEach((upgrade) => {
      const ui = upgradeUi.get(upgrade.id);
      if (!ui) return;
      const purchased = ownedUpgradeSet.has(upgrade.id);
      const unlocked = isUpgradeUnlocked(upgrade);
      const affordable = canAfford(upgrade.cost);

      ui.row.classList.toggle("purchased", purchased);
      ui.row.classList.toggle("locked", !purchased && !unlocked);

      if (purchased) {
        setText(ui.desc, "已经收进邮册，永久生效。");
        return;
      }

      setText(
        ui.desc,
        unlocked
          ? upgrade.desc
          : `累计赚到 ${formatNumber(upgrade.unlock)}张邮票后解锁。`
      );

      if (!ui.button) return;
      ui.button.disabled = !unlocked || !affordable;
      ui.button.classList.toggle("can-buy", unlocked && affordable);
      ui.button.classList.toggle("locked-btn", !unlocked);
      if (!unlocked) {
        setText(ui.cost, "未解锁");
        setText(ui.unit, "再等等");
        ui.button.setAttribute(
          "aria-label",
          `${upgrade.name}尚未解锁，累计赚到 ${formatNumber(upgrade.unlock)}张邮票后可用`
        );
        ui.button.title = "等邮册翻到这一页。";
      } else {
        setText(ui.cost, formatNumber(upgrade.cost));
        setText(ui.unit, "邮票");
        ui.button.setAttribute(
          "aria-label",
          `购买${upgrade.name}，花费 ${formatNumber(upgrade.cost)}张邮票`
        );
        ui.button.title = affordable
          ? `收下${upgrade.name}`
          : `还差 ${formatNumber(Math.max(0, upgrade.cost - Math.floor(state.stamps)))}张邮票`;
      }
    });
  }

  function achievementBonusPercent() {
    return Math.round((achievementMultiplier() - 1) * 100);
  }

  function buildAlbumPanel() {
    albumBuilt = true;
    albumUi.clear();
    const collected = state.achievements.length;
    els.panelBody.innerHTML = `
      <div class="album-summary">
        <div class="album-summary-top">
          <span class="album-summary-title" id="albumCount">已贴 ${collected} / ${ACHIEVEMENTS.length} 枚</span>
          <span class="album-summary-bonus" id="albumBonus">全局 +${achievementBonusPercent()}%</span>
        </div>
        <p>每贴上一枚纪念邮票，所有产出都会更丰厚一点。盖戳、招人、出远门，都会留下小小的邮戳。</p>
        <div class="album-bar"><span class="album-fill" id="albumFill"></span></div>
      </div>
      <div class="album-grid">
        ${ACHIEVEMENTS.map((achievement) => {
          const done = achievementSet.has(achievement.id);
          const value = Math.min(achievement.target, achievement.value());
          const progress = completionPercent(value, achievement.target);
          return `
            <article class="album-stamp${done ? " collected" : ""}" data-achievement="${achievement.id}" aria-label="${achievement.name}，${achievement.desc}，奖励全局产出 +${Math.round(achievement.reward * 100)}%">
              <div class="album-stamp-top">
                <span class="album-art" aria-hidden="true">${ICONS[achievement.icon]}</span>
                <span class="album-reward">+${Math.round(achievement.reward * 100)}%</span>
              </div>
              <div class="album-name">${achievement.name}</div>
              <p class="album-desc">${achievement.desc}</p>
              <div class="album-progress">
                <span data-album-progress>${done ? "已贴进邮册" : `${formatNumber(value)} / ${formatNumber(achievement.target)}`}</span>
                <span class="album-mini-bar" data-album-bar${done ? " hidden" : ""}><span class="album-mini-fill" style="width:${progress}%"></span></span>
              </div>
            </article>`;
        }).join("")}
      </div>
      <section class="postcard-album">
        <div class="tree-head">
          <span>镇口明信片</span>
          <span>${state.postcardAlbum.length} / ${TOWN_BOTS.length}${state.postcardAlbumReward ? " · 已集齐" : ""}</span>
        </div>
        <p class="tree-note">给镇上的 8 位邮差各寄一张。收齐后会留下 1 枚月光邮戳和一小包材料。</p>
        <div class="postcard-grid">
          ${TOWN_BOTS.map((bot) => {
            const entry = state.postcardAlbum.find((item) => item.senderId === bot.id);
            return `
              <article class="postcard-slot${entry ? " is-collected" : ""}">
                <div class="postcard-slot-top">
                  <b>${bot.name}</b>
                  <span>${bot.title}</span>
                </div>
                <p>${entry ? escapeHtml(entry.text || "已经收进邮册。") : "还没收到这位邮差的明信片。"}</p>
                <small>${entry ? "已收进邮册" : "去镇口寄一张"}</small>
              </article>`;
          }).join("")}
        </div>
      </section>
    `;

    albumUi.summary = els.panelBody.querySelector(".album-summary");
    albumUi.count = document.getElementById("albumCount");
    albumUi.bonus = document.getElementById("albumBonus");
    albumUi.fill = document.getElementById("albumFill");
    albumUi.cards = new Map();
    ACHIEVEMENTS.forEach((achievement) => {
      const card = els.panelBody.querySelector(`[data-achievement="${achievement.id}"]`);
      if (!card) return;
      albumUi.cards.set(achievement.id, {
        card,
        progress: card.querySelector("[data-album-progress]"),
        bar: card.querySelector("[data-album-bar]"),
        fill: card.querySelector(".album-mini-fill")
      });
    });
    refreshAlbumUi();
  }

  function refreshAlbumUi() {
    if (!albumBuilt || !albumUi.cards) return;
    const collected = state.achievements.length;
    setText(albumUi.count, `已贴 ${collected} / ${ACHIEVEMENTS.length} 枚`);
    setText(albumUi.bonus, `全局 +${achievementBonusPercent()}%`);
    albumUi.fill.style.width = `${Math.round(completionPercent(collected, ACHIEVEMENTS.length) * 10) / 10}%`;

    ACHIEVEMENTS.forEach((achievement) => {
      const ui = albumUi.cards.get(achievement.id);
      if (!ui) return;
      const done = achievementSet.has(achievement.id);
      const value = Math.min(achievement.target, achievement.value());
      const progress = completionPercent(value, achievement.target);
      ui.card.classList.toggle("collected", done);
      if (done) {
        setText(ui.progress, "已贴进邮册");
        setHidden(ui.bar, true);
      } else {
        setText(ui.progress, `${formatNumber(value)} / ${formatNumber(achievement.target)}`);
        setHidden(ui.bar, false);
        ui.fill.style.width = `${Math.round(progress * 10) / 10}%`;
      }
    });
  }

  function checkAchievements(options = {}) {
    if (!state) return [];
    const announce = options.announce !== false;
    const newly = [];

    ACHIEVEMENTS.forEach((achievement) => {
      if (achievementSet.has(achievement.id)) return;
      if (achievement.value() >= achievement.target) {
        achievementSet.add(achievement.id);
        if (!state.achievements.includes(achievement.id)) {
          state.achievements.push(achievement.id);
        }
        newly.push(achievement);
      }
    });

    if (!newly.length) return newly;

    if (activeTab === "album") {
      refreshAlbumUi();
    } else {
      unseenAchievements += newly.length;
    }
    updateTabBadges();

    if (announce) {
      const reward = Math.round(newly.reduce((total, item) => total + item.reward, 0) * 100);
      playUpgradeSound();
      if (newly.length === 1) {
        showToast(`邮册新添「${newly[0].name}」，全局产出 +${reward}%。`, 4200);
      } else {
        showToast(`邮册新添 ${newly.length} 枚纪念邮票，全局产出 +${reward}%。`, 4600);
      }
    }

    saveGame();
    return newly;
  }

  function routeMasteryLevel(route) {
    const runs = (state && state.routeRuns && state.routeRuns[route.id]) || 0;
    return Math.min(3, Math.floor(runs / 3));
  }

  function totalRouteRuns() {
    if (!state || !state.routeRuns) return 0;
    return Object.values(state.routeRuns).reduce((total, count) => total + count, 0);
  }

  function isRouteUnlocked(route) {
    return state.totalEarned >= route.unlock;
  }

  function freeDispatchSlots() {
    return Math.max(0, dispatchSlots() - state.activeTrips.length);
  }

  function dispatchReward(route) {
    const base = Math.max(
      route.flat,
      baseRate() * route.rewardSeconds + baseClickPower() * 20
    );
    return Math.max(1, Math.round(
      base * (1 + routeMasteryLevel(route) * 0.2) * (contractMods().dispatch || 1)
    ));
  }

  function formatTripDuration(seconds) {
    if (seconds < 60) return `${Math.ceil(seconds)} 秒`;
    return `${Math.round(seconds / 60)} 分钟`;
  }

  function formatTripClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function syncCompletedTrips(now = Date.now()) {
    const stillActive = [];
    let completed = 0;
    state.activeTrips.forEach((trip) => {
      if (trip.endsAt <= now) {
        state.readyTrips.push({
          id: trip.id,
          routeId: trip.routeId,
          reward: trip.reward
        });
        bumpOrders("trip", trip.routeId);
        completed += 1;
      } else {
        stillActive.push(trip);
      }
    });
    state.activeTrips = stillActive;
    return completed;
  }

  function completeTrips(announce = true) {
    const completed = syncCompletedTrips(Date.now());
    if (!completed) return 0;
    if (hasNode("journey3") && state.readyTrips.length) {
      collectDispatches(state.readyTrips.map((trip) => trip.id), false, { silent: true });
      if (announce && !document.hidden) {
        showToast("回车铃响了，邮袋自己回到了柜台上。", 3800);
      }
      return completed;
    }
    updateTabBadges();
    if (activeTab === "dispatch") {
      buildDispatchPanel();
    }
    if (announce && !document.hidden) {
      playReturnSound();
      showToast(
        completed === 1
          ? "有个邮袋从远方回来了，去邮路柜台取回吧。"
          : `${completed} 个邮袋一起回到了屋檐下，去邮路柜台看看。`,
        4400
      );
    }
    saveGame();
    return completed;
  }

  function buildDispatchPanel() {
    dispatchBuilt = true;
    const free = freeDispatchSlots();
    const active = state.activeTrips;
    const ready = state.readyTrips;

    const pips = Array.from({ length: dispatchSlots() }, (_, index) =>
      `<span class="slot-pip ${index < free ? "is-free" : "is-busy"}"></span>`
    ).join("");

    const readyHtml = ready.length
      ? `
        <div class="dispatch-ready">
          <div class="dispatch-ready-head">
            <span>屋檐下多了几个邮袋</span>
            <span>${ready.length} 个待拆</span>
          </div>
          <div class="ready-list">
            ${ready.map((trip) => {
              const route = ROUTES.find((candidate) => candidate.id === trip.routeId);
              return `
                <button class="ready-card" type="button" data-collect-dispatch="${trip.id}" aria-label="取回${route.name}的邮袋，获得${formatNumber(trip.reward)}张邮票">
                  <span>
                    <span class="ready-route">${route.name}</span>
                    <span class="ready-reward">回信 ${formatNumber(trip.reward)} 张邮票</span>
                  </span>
                  <span class="ready-claim">取回</span>
                </button>`;
            }).join("")}
          </div>
          ${ready.length > 1 ? `<button class="link-btn dispatch-collect-all" id="collectAllDispatch" type="button">一起取回</button>` : ""}
        </div>`
      : "";

    const activeHtml = active.length
      ? active.map((trip) => {
          const route = ROUTES.find((candidate) => candidate.id === trip.routeId);
          return `
            <div class="trip-card" data-trip-id="${trip.id}">
              <div class="trip-head">
                <span class="trip-name">${route.name}</span>
                <span class="trip-countdown" data-trip-time>0:00</span>
              </div>
              <div class="trip-bar"><span class="trip-fill" data-trip-fill></span></div>
              <div class="trip-foot">
                <span>正在路上 · 熟练度 ${routeMasteryLevel(route)}/3</span>
                <span>回信 <b>${formatNumber(trip.reward)}</b> 邮票</span>
              </div>
              <button class="trip-rush" type="button" data-rush-trip="${trip.id}" aria-label="花 ${INK_TRIP_COST} 墨点让这趟邮路立刻回来">
                墨点加速 · ${INK_TRIP_COST}
              </button>
            </div>`;
        }).join("")
      : `<div class="dispatch-empty">两位邮差正在屋檐下等信。挑一条邮路，让它们出门吧。</div>`;

    const routeHtml = ROUTES.map((route) => {
      const unlocked = isRouteUnlocked(route);
      const level = routeMasteryLevel(route);
      const stars = Array.from({ length: 3 }, (_, index) =>
        `<span class="route-star${index < level ? " is-on" : ""}"></span>`
      ).join("");
      const canGo = unlocked && free > 0;
      const buttonLabel = !unlocked ? "未开通" : canGo ? "发车" : "邮差忙";
      const reward = dispatchReward(route);
      return `
        <article class="route-card${unlocked ? "" : " locked"}" data-route-card="${route.id}" style="--route-accent:${route.accent}">
          <div class="route-art" aria-hidden="true">${ICONS[route.icon]}</div>
          <div class="route-copy">
            <div class="route-name-row">
              <span class="route-name">${route.name}</span>
              <span class="route-stars" aria-label="熟练度 ${level} / 3">
                ${stars}
              </span>
            </div>
            <p class="route-desc">${route.desc}</p>
            <div class="route-meta">
              ${unlocked
                ? `<span>${formatTripDuration(route.duration)}</span><span>回信约 <b data-route-reward="${route.id}">${formatNumber(reward)}</b> 张</span><span>熟练 ${level}/3</span>`
                : `<span>${formatTripDuration(route.duration)}</span><span>累计 ${formatNumber(route.unlock)} 张邮票后开通</span>`}
            </div>
          </div>
          <button class="route-btn${canGo ? " can-go" : ""}" type="button" data-route-start="${route.id}" ${canGo ? "" : "disabled"} aria-label="${buttonLabel}，${route.name}，${formatTripDuration(route.duration)}后回信">
            ${buttonLabel}
          </button>
        </article>`;
    }).join("");

    els.panelBody.innerHTML = `
      ${expeditionEntryMarkup()}
      <div class="dispatch-summary">
        <span class="dispatch-kicker">邮差调度</span>
        <strong class="dispatch-free" id="dispatchFree">${free} / ${dispatchSlots()} 位空闲</strong>
        <p>挑一条邮路发车。回信会带上邮票，也会把旅途记进邮册。</p>
        <div class="dispatch-slots" aria-hidden="true">${pips}<span class="dispatch-slot-note">熟练度会保留</span></div>
      </div>
      ${readyHtml}
      <div class="dispatch-section">
        <div class="dispatch-section-head"><span>在路上</span><span id="dispatchActiveCount">${active.length} / ${dispatchSlots()}</span></div>
        <div class="trip-list">${activeHtml}</div>
      </div>
      <div class="dispatch-section">
        <div class="dispatch-section-head"><span>远方邮路</span><span>每 3 趟 +20% 回信</span></div>
        <div class="route-list">${routeHtml}</div>
      </div>
    `;

    dispatchUi = {
      freeNote: document.getElementById("dispatchFree"),
      pips: Array.from(els.panelBody.querySelectorAll(".slot-pip")),
      activeCount: document.getElementById("dispatchActiveCount"),
      routeButtons: new Map(),
      routeRewards: new Map(),
      tripRefs: new Map(),
      unlockKey: ROUTES.map((route) => (isRouteUnlocked(route) ? "1" : "0")).join("")
    };

    ROUTES.forEach((route) => {
      const button = els.panelBody.querySelector(`[data-route-start="${route.id}"]`);
      if (button) dispatchUi.routeButtons.set(route.id, button);
      const reward = els.panelBody.querySelector(`[data-route-reward="${route.id}"]`);
      if (reward) dispatchUi.routeRewards.set(route.id, reward);
    });

    state.activeTrips.forEach((trip) => {
      const card = els.panelBody.querySelector(`[data-trip-id="${trip.id}"]`);
      if (!card) return;
      dispatchUi.tripRefs.set(trip.id, {
        time: card.querySelector("[data-trip-time]"),
        fill: card.querySelector("[data-trip-fill]"),
        rush: card.querySelector("[data-rush-trip]")
      });
    });

    refreshDispatchUi();
  }

  function refreshDispatchUi() {
    if (!dispatchBuilt || !dispatchUi || activeTab !== "dispatch") return;
    const free = freeDispatchSlots();
    setText(dispatchUi.freeNote, `${free} / ${dispatchSlots()} 位空闲`);
    dispatchUi.pips.forEach((pip, index) => {
      pip.classList.toggle("is-free", index < free);
      pip.classList.toggle("is-busy", index >= free);
    });
    setText(dispatchUi.activeCount, `${state.activeTrips.length} / ${dispatchSlots()}`);

    const unlockKey = ROUTES.map((route) => (isRouteUnlocked(route) ? "1" : "0")).join("");
    if (unlockKey !== dispatchUi.unlockKey) {
      buildDispatchPanel();
      return;
    }

    ROUTES.forEach((route) => {
      const button = dispatchUi.routeButtons.get(route.id);
      if (!button) return;
      const unlocked = isRouteUnlocked(route);
      const canGo = unlocked && free > 0;
      button.disabled = !canGo;
      button.classList.toggle("can-go", canGo);
      setText(button, !unlocked ? "未开通" : canGo ? "发车" : "邮差忙");
      const reward = dispatchUi.routeRewards.get(route.id);
      if (reward) setText(reward, formatNumber(dispatchReward(route)));
    });

    const now = Date.now();
    dispatchUi.tripRefs.forEach((ref, id) => {
      const trip = state.activeTrips.find((candidate) => candidate.id === id);
      if (!trip || !ref) return;
      const remaining = trip.endsAt - now;
      setText(ref.time, formatTripClock(remaining));
      const progress = Math.max(0, Math.min(100, ((now - trip.startedAt) / (trip.endsAt - trip.startedAt)) * 100));
      ref.fill.style.width = `${Math.round(progress * 10) / 10}%`;
      if (ref.rush) {
        ref.rush.disabled = state.ink < INK_TRIP_COST;
        ref.rush.setAttribute(
          "aria-label",
          `花 ${INK_TRIP_COST} 墨点让这趟邮路立刻回来，当前有 ${state.ink} 墨点`
        );
      }
    });
  }

  function startDispatch(routeId, restoreFocus = false) {
    if (!state) return;
    const route = ROUTES.find((candidate) => candidate.id === routeId);
    if (!route) return;
    if (!isRouteUnlocked(route)) {
      playDenySound();
      return;
    }
    if (freeDispatchSlots() <= 0) {
      playDenySound();
      showToast("两位邮差都还在路上，等一个邮袋回来吧。", 2600);
      return;
    }

    const now = Date.now();
    const duration = route.duration * (hasNode("journey2") ? 0.8 : 1);
    const reward = dispatchReward(route);
    state.activeTrips.push({
      id: state.nextTripId,
      routeId: route.id,
      startedAt: now,
      endsAt: now + duration * 1000,
      reward
    });
    state.nextTripId += 1;

    playDispatchSound();
    saveGame();
    buildDispatchPanel();
    showToast(`邮差沿着${route.name}出发了，约 ${formatTripDuration(duration)}后回来。`, 3200);

    if (restoreFocus) {
      const button = els.panelBody.querySelector(`[data-route-start="${route.id}"]`);
      if (button && !button.disabled) {
        button.focus({ preventScroll: true });
      } else {
        const nextButton = els.panelBody.querySelector(".route-btn:not(:disabled)");
        if (nextButton) nextButton.focus({ preventScroll: true });
        else els.tabs.find((tab) => tab.dataset.tab === "dispatch")?.focus({ preventScroll: true });
      }
    }
  }

  function collectDispatches(ids, restoreFocus = false, options = {}) {
    if (!state || !ids.length) return;
    const silent = options.silent === true;
    const selected = state.readyTrips.filter((trip) => ids.includes(trip.id));
    if (!selected.length) return;
    const total = selected.reduce((sum, trip) => sum + trip.reward, 0);

    selected.forEach((trip) => {
      state.routeRuns[trip.routeId] = (state.routeRuns[trip.routeId] || 0) + 1;
    });
    state.readyTrips = state.readyTrips.filter((trip) => !ids.includes(trip.id));
    addStamps(total);
    updateGoals();
    const newly = checkAchievements({ announce: !silent });
    if (!silent) playReturnSound();
    updateTabBadges();
    saveGame();
    if (activeTab === "dispatch") buildDispatchPanel();

    if (!silent && !newly.length) {
      showToast(
        selected.length === 1
          ? `取回了${ROUTES.find((route) => route.id === selected[0].routeId).name}的回信：${formatNumber(total)} 张邮票。`
          : `一起取回了 ${selected.length} 个邮袋：${formatNumber(total)} 张邮票。`,
        4000
      );
    }

    if (restoreFocus) {
      const nextReady = els.panelBody.querySelector("[data-collect-dispatch]");
      if (nextReady) {
        nextReady.focus({ preventScroll: true });
      } else {
        const nextButton = els.panelBody.querySelector(".route-btn:not(:disabled)");
        if (nextButton) nextButton.focus({ preventScroll: true });
        else els.tabs.find((tab) => tab.dataset.tab === "dispatch")?.focus({ preventScroll: true });
      }
    }
  }


  // ---------- orders desk ----------

  function orderTagFor(order) {
    const template = orderTpl(order.tpl);
    if (!template) return "慢信";
    if (template.condition && template.condition.weather) return "雨天";
    if (template.condition && template.condition.noBell) return "安静";
    if (template.materialCost) return "包裹";
    if (template.requiresRoute) return "远方";
    return ["慢信", "挂号", "急件"][order.tier] || "慢信";
  }

  function orderGoalLabel(order) {
    const template = orderTpl(order.tpl);
    if (!template) return "把信送出去";
    return template.unit;
  }

  function orderProgressText(order) {
    return `${formatNumber(orderProgressValue(order))} / ${formatNumber(order.target)}`;
  }

  function acceptedOrderCard(order) {
    const template = orderTpl(order.tpl);
    if (!template) return "";
    const cost = orderMaterialCost(order);
    const costText = materialCostText(cost);
    const canPay = canPayMaterials(cost);
    const ready = orderConditionMet(order) && canPay;
    const note = orderConditionNote(order) || (!canPay ? `还差材料：${costText}` : "");
    const rewardMaterial = materialGainText(template.materialReward);
    const progress = completionPercent(orderProgressValue(order), order.target);
    return `
      <article class="order-card is-accepted${ready ? " is-ready" : ""}" data-order="${order.id}" aria-label="${template.title}，${template.unit} ${orderProgressValue(order)} / ${order.target}">
        <div class="order-top">
          <span class="order-sender">${template.sender}</span>
          <span class="order-tag">${orderTagFor(order)}</span>
        </div>
        <h4 class="order-title">${template.title}</h4>
        <p class="order-quote">“${template.quote}”</p>
        <div class="order-goal">
          <span>${template.unit}</span>
          <b data-order-progress>${orderProgressText(order)}</b>
        </div>
        <div class="order-bar"><span data-order-fill style="width:${progress}%"></span></div>
        ${costText ? `<div class="order-material-cost">交付需 ${costText}</div>` : ""}
        <div class="order-reward">
          <span>+${formatNumber(orderRewardStamps(order))} 邮票</span>
          <span>+${formatNumber(orderRewardInk(order))} 墨点</span>
          ${rewardMaterial ? `<span>+${rewardMaterial}</span>` : ""}
        </div>
        <p class="order-note" data-order-note${note ? "" : " hidden"}>${note}</p>
        <div class="order-actions">
          <span class="order-timer" data-order-time>剩 ${formatTripClock(orderTimeLeft(order))}</span>
          <button class="order-deliver" type="button" data-deliver-order="${order.id}" ${ready ? "" : "disabled"}>交付</button>
          <button class="link-btn order-drop" type="button" data-drop-order="${order.id}">放下</button>
        </div>
      </article>`;
  }

  function offerOrderCard(offer) {
    const template = orderTpl(offer.tpl);
    if (!template) return "";
    const full = state.accepted.length >= orderSlots();
    const costText = materialCostText(template.materialCost);
    const rewardMaterial = materialGainText(template.materialReward);
    return `
      <article class="order-card is-offer" data-offer="${offer.id}">
        <div class="order-top">
          <span class="order-sender">${template.sender}</span>
          <span class="order-tag">${orderTagFor(offer)}</span>
        </div>
        <h4 class="order-title">${template.title}</h4>
        <p class="order-quote">“${template.quote}”</p>
        <div class="order-goal">
          <span>${template.unit}</span>
          <b>${formatNumber(offer.target)}</b>
        </div>
        ${costText ? `<div class="order-material-cost">交付需 ${costText}</div>` : ""}
        <div class="order-reward">
          <span>+${formatNumber(Math.round(offer.stamps * orderRewardScale()))} 邮票</span>
          <span>+${formatNumber(Math.round(offer.ink * inkMultiplier()))} 墨点</span>
          ${rewardMaterial ? `<span>+${rewardMaterial}</span>` : ""}
        </div>
        <div class="order-actions">
          <span class="order-timer">约 ${Math.round(offer.minutes * orderDeadlineScale())} 分钟</span>
          <button class="order-accept" type="button" data-accept-order="${offer.id}" ${full ? "disabled" : ""}>${full ? "柜台满了" : "接下"}</button>
        </div>
      </article>`;
  }

  function buildOrdersPanel() {
    ensureOffers();
    const accepted = state.accepted;
    const offers = state.offers;
    const slots = orderSlots();
    const contract = currentContract();
    els.panelBody.innerHTML = `
      <div class="order-summary">
        <div class="order-summary-copy">
          <span class="order-kicker">来信柜台</span>
          <p>柜台一次留得下 ${slots} 封。挑一封接下，在时限内送出去；送不到也不扣东西，只是信会被邮车带走。</p>
        </div>
        <div class="order-ink-box">
          <span class="ink-line-mini"><span class="ink-mark" aria-hidden="true"></span>墨点 <b id="orderInk">${formatNumber(state.ink)}</b></span>
          <span class="order-materials">材料 ${materialSummary()}</span>
          <button class="order-reroll" type="button" data-reroll-orders ${state.ink < INK_REROLL_COST ? "disabled" : ""}>换一批 · ${INK_REROLL_COST}</button>
        </div>
      </div>
      ${contract ? `<div class="order-contract"><span>${contract.name}</span>${contract.desc}</div>` : ""}
      <div class="order-section">
        <div class="order-section-head"><span>手上的信</span><span>${accepted.length} / ${slots}</span></div>
        ${accepted.length
          ? `<div class="order-list">${accepted.map(acceptedOrderCard).join("")}</div>`
          : `<div class="order-empty">手上还没有信。柜台上的来信可以接下，时限内完成就能拿到邮票、墨点，有些信还会留下材料。</div>`}
      </div>
      <div class="order-section">
        <div class="order-section-head"><span>柜台上的信</span><span>每完成 4 封，得 1 枚月光邮戳</span></div>
        <div class="order-list order-offers">${offers.map(offerOrderCard).join("")}</div>
      </div>
      <p class="order-foot">完美盖戳能攒墨点；墨点可以换一批来信，也能让在途的邮路立刻回来。</p>
    `;
    refreshOrdersUi();
    if (activeTab === "orders") {
      const first = els.panelBody.querySelector("[data-accept-order]");
      if (first && activeTab === "orders") {
        /* keep default focus on tab; cards are reached by tabbing */
      }
    }
  }

  function refreshOrdersUi() {
    if (!state || activeTab !== "orders") return;
    const inkLabel = document.getElementById("orderInk");
    if (inkLabel) setText(inkLabel, formatNumber(state.ink));

    els.panelBody.querySelectorAll("[data-order]").forEach((card) => {
      const id = Number(card.dataset.order);
      const order = state.accepted.find((candidate) => candidate.id === id);
      if (!order) return;
      const value = orderProgressValue(order);
      const progress = completionPercent(value, order.target);
      const cost = orderMaterialCost(order);
      const canPay = canPayMaterials(cost);
      const ready = orderConditionMet(order) && canPay;
      const note = orderConditionNote(order) || (!canPay ? `还差材料：${materialCostText(cost)}` : "");
      const progressEl = card.querySelector("[data-order-progress]");
      if (progressEl) setText(progressEl, orderProgressText(order));
      const fill = card.querySelector("[data-order-fill]");
      if (fill) fill.style.width = `${Math.round(progress * 10) / 10}%`;
      const time = card.querySelector("[data-order-time]");
      if (time) setText(time, `剩 ${formatTripClock(orderTimeLeft(order))}`);
      card.classList.toggle("is-ready", ready);
      const button = card.querySelector("[data-deliver-order]");
      if (button) button.disabled = !ready;
      const noteEl = card.querySelector("[data-order-note]");
      if (noteEl) {
        noteEl.textContent = note;
        noteEl.hidden = !note;
      }
    });

    const full = state.accepted.length >= orderSlots();
    els.panelBody.querySelectorAll("[data-accept-order]").forEach((button) => {
      button.disabled = full;
      button.textContent = full ? "柜台满了" : "接下";
    });
    const reroll = els.panelBody.querySelector("[data-reroll-orders]");
    if (reroll) reroll.disabled = state.ink < INK_REROLL_COST;
  }

  function acceptOrder(id, restoreFocus = false) {
    const offer = state.offers.find((candidate) => candidate.id === id);
    if (!offer) return;
    if (state.accepted.length >= orderSlots()) {
      playDenySound();
      showToast("手上的信还没送完，柜台一次只能接这么多。", 2800);
      return;
    }
    const now = Date.now();
    state.accepted.push({
      id: offer.id,
      tpl: offer.tpl,
      tier: offer.tier,
      target: offer.target,
      ink: offer.ink,
      stamps: offer.stamps,
      acceptedAt: now,
      expiresAt: now + offer.minutes * 60 * 1000 * orderDeadlineScale(),
      progress: {},
      bellUsed: false
    });
    state.offers = state.offers.filter((candidate) => candidate.id !== id);
    ensureOffers();
    saveGame();
    buildOrdersPanel();
    playDispatchSound();
    const template = orderTpl(offer.tpl);
    showToast(`接下了${template.sender}的信：${template.title}。`, 3000);
    if (restoreFocus) {
      const next = els.panelBody.querySelector("[data-deliver-order], [data-accept-order]:not(:disabled)");
      if (next) next.focus({ preventScroll: true });
    }
  }

  function deliverOrder(id, restoreFocus = false) {
    const order = state.accepted.find((candidate) => candidate.id === id);
    if (!order) return;
    if (!orderConditionMet(order)) {
      playDenySound();
      showToast(orderConditionNote(order) || "这封信还差一点。", 2800);
      return;
    }
    const template = orderTpl(order.tpl);
    const cost = orderMaterialCost(order);
    if (!canPayMaterials(cost)) {
      playDenySound();
      showToast(`还差材料：${materialCostText(cost)}`, 2800);
      return;
    }
    payMaterials(cost);
    const stamps = orderRewardStamps(order);
    const ink = orderRewardInk(order);
    addStamps(stamps);
    addInk(ink);
    const rewardMaterial = template.materialReward || {};
    Object.entries(rewardMaterial).forEach(([materialId, quantity]) => {
      if (!EXP_MATERIALS[materialId] || quantity <= 0) return;
      state.materials[materialId] = Math.min(99, (state.materials[materialId] || 0) + quantity);
    });
    const rewardMaterialText = materialGainText(rewardMaterial);
    state.accepted = state.accepted.filter((candidate) => candidate.id !== id);
    state.ordersDone += 1;

    let moon = 0;
    if (state.ordersDone % 4 === 0) {
      state.moonStamps += 1;
      moon = 1;
    }
    ensureOffers();
    updateGoals();
    const newly = checkAchievements({ announce: true });
    refreshLive();
    saveGame();
    buildOrdersPanel();
    playUpgradeSound();
    if (!newly.length) {
      showToast(
        `${template.sender}收到了信：+${formatNumber(stamps)} 邮票，+${formatNumber(ink)} 墨点${rewardMaterialText ? `，${rewardMaterialText}` : ""}。${moon ? "柜台凑满 4 封，夜班邮车留下 1 枚月光邮戳。" : ""}`,
        4600
      );
    }
    if (restoreFocus) {
      const next = els.panelBody.querySelector("[data-deliver-order]:not(:disabled), [data-accept-order]:not(:disabled)");
      if (next) next.focus({ preventScroll: true });
      else els.tabs.find((tab) => tab.dataset.tab === "orders")?.focus({ preventScroll: true });
    }
  }

  function openDropOrderModal(id) {
    const order = state.accepted.find((candidate) => candidate.id === id);
    if (!order) return;
    const template = orderTpl(order.tpl);
    openModal({
      title: "把这封信放回柜台？",
      confirmLabel: "放下",
      body: `<p>${template.sender}的「${template.title}」还没送出去。放下后这封信会回到柜台外，不会扣邮票。</p>`,
      action: () => {
        state.accepted = state.accepted.filter((candidate) => candidate.id !== id);
        ensureOffers();
        saveGame();
        buildOrdersPanel();
        showToast("你把信放下，柜台又换上了一封新的来信。", 2800);
      }
    });
  }

  function rerollOffers(restoreFocus = false) {
    if (!spendInk(INK_REROLL_COST)) {
      playDenySound();
      showToast(`换一批要 ${INK_REROLL_COST} 墨点，先去盖几个完美邮戳吧。`, 3000);
      return;
    }
    state.offers = [];
    ensureOffers();
    saveGame();
    buildOrdersPanel();
    playDispatchSound();
    showToast("柜台上的信换了一批。", 2200);
    if (restoreFocus) {
      const next = els.panelBody.querySelector("[data-reroll-orders], [data-accept-order]");
      if (next) next.focus({ preventScroll: true });
    }
  }

  function rushTrip(id, restoreFocus = false) {
    const trip = state.activeTrips.find((candidate) => candidate.id === id);
    if (!trip) return;
    if (!spendInk(INK_TRIP_COST)) {
      playDenySound();
      showToast(`加速要 ${INK_TRIP_COST} 墨点，先去盖几个完美邮戳吧。`, 3000);
      return;
    }
    trip.endsAt = Date.now();
    saveGame();
    completeTrips(true);
    refreshLive();
    showToast(
      hasNode("journey3")
        ? "墨点把邮差催了回来，回车铃已经把邮袋收好了。"
        : "墨点把邮差催了回来，去邮路柜台取回邮袋吧。",
      3400
    );
    if (restoreFocus) {
      const next = els.panelBody.querySelector("[data-collect-dispatch]");
      if (next) next.focus({ preventScroll: true });
    }
  }

  // ---------- small events (A Dark Room style scenes) ----------

  function canPayChoice(choice) {
    if (!choice || !choice.cost) return true;
    if (choice.cost.stamps && state.stamps < choice.cost.stamps) return false;
    if (choice.cost.ink && state.ink < choice.cost.ink) return false;
    return true;
  }

  function maybeTriggerEvent() {
    if (!state || eventOpen || !els.modal.hidden || document.hidden) return;
    const now = Date.now();
    if (now < nextEventAt) return;
    if (state.totalEarned < 60) {
      nextEventAt = now + 60 * 1000;
      return;
    }
    let eligible = [];
    try {
      eligible = EVENTS.filter((event) => event.available());
    } catch (error) {
      eligible = [];
    }
    if (!eligible.length) {
      nextEventAt = now + 120 * 1000;
      return;
    }
    const pool = eligible.filter((event) => event.id !== lastEventId);
    const chosen = (pool.length ? pool : eligible)[Math.floor(Math.random() * (pool.length || eligible.length))];
    lastEventId = chosen.id;
    nextEventAt = now + 150 * 1000 + Math.random() * 150 * 1000;
    activeEvent = chosen;
    openEvent(chosen);
  }

  function openEvent(event) {
    eventOpen = true;
    const choices = event.choices.map((choice, index) => {
      const affordable = canPayChoice(choice);
      return `
        <button class="event-choice" type="button" data-event-choice="${index}" ${affordable ? "" : "disabled"}>
          <b>${choice.label}</b>
          <span>${choice.note || ""}</span>
        </button>`;
    }).join("");
    openModal({
      title: event.title,
      body: `${event.body.map((line) => `<p>${line}</p>`).join("")}<div class="event-choices">${choices}</div>`,
      footer: false
    });
  }

  function applyEventChoice(index) {
    const event = activeEvent;
    if (!event) return;
    const choice = event.choices[index];
    if (!choice) return;
    if (!canPayChoice(choice)) {
      playDenySound();
      return;
    }
    if (choice.cost && choice.cost.stamps) {
      state.stamps = Math.max(0, state.stamps - choice.cost.stamps);
    }
    if (choice.cost && choice.cost.ink) {
      state.ink = Math.max(0, state.ink - choice.cost.ink);
    }
    const reward = choice.reward || {};
    if (reward.stamps) addStamps(reward.stamps);
    if (reward.ink) addInk(reward.ink);
    if (reward.rateSeconds) addStamps(baseRate() * reward.rateSeconds);
    if (reward.golden) showGoldenLetter();
    if (reward.bellReset) {
      state.bellReadyAt = 0;
      updateBellUi();
    }
    if (reward.reroll) {
      state.offers = [];
      ensureOffers();
      if (activeTab === "orders") buildOrdersPanel();
    }
    nextEventAt = Date.now() + 150 * 1000 + Math.random() * 150 * 1000;
    updateGoals();
    checkAchievements({ announce: true });
    refreshLive();
    saveGame();
    closeModal();
    showToast(choice.result, 6200);
  }

  function nodeOwned(node) {
    return hasNode(node.id);
  }

  function nodeUnlocked(node) {
    return !node.requires || hasNode(node.requires);
  }

  function nodeReason(node) {
    if (nodeOwned(node)) return "已点亮";
    if (!nodeUnlocked(node)) return "先点亮上一格";
    if (moonPoints() < node.cost) return "邮戳不够";
    return `点亮 · ${node.cost} 枚`;
  }

  function buyMoonNode(id) {
    const node = MOON_NODES.find((candidate) => candidate.id === id);
    if (!node || nodeOwned(node) || !nodeUnlocked(node)) {
      playDenySound();
      return;
    }
    if (moonPoints() < node.cost) {
      playDenySound();
      showToast("月光邮戳还不够，再送几封信或发一班夜车吧。", 3200);
      return;
    }
    state.moonTree.push(node.id);
    updateGoals();
    checkAchievements({ announce: true });
    refreshLive();
    saveGame();
    buildMoonPanel();
    playUpgradeSound();
    showToast(`点亮了「${node.name}」：${node.desc}。`, 3600);
  }

  function selectContract(id) {
    const contract = CONTRACTS.find((candidate) => candidate.id === id);
    if (!contract) return;
    if (state.contract) {
      playDenySound();
      showToast("这一程的契约已经定下了，等夜班邮车发车后再选。", 3000);
      return;
    }
    openModal({
      title: `这一程走「${contract.name}」？`,
      confirmLabel: "定下契约",
      body: `<p>${contract.desc}</p><p>契约会一直生效到下一次夜班邮车发车。发车后可以重新选择。</p>`,
      action: () => {
        state.contract = contract.id;
        saveGame();
        refreshLive();
        buildMoonPanel();
        showToast(`夜班契约：${contract.name}。${contract.desc}`, 4200);
      }
    });
  }


  // ---------- 雾湖远行：roguelike card expedition ----------

  function expeditionUnlocked() {
    return state.totalEarned >= 700 || state.expeditionWins > 0;
  }

  function expeditionRandom() {
    const exp = state && state.expedition;
    if (!exp) return Math.random();
    let value = (Number(exp.rngState) || Number(exp.seed) || 1) >>> 0;
    value = (value + 0x6d2b79f5) >>> 0;
    exp.rngState = value;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  function expeditionMaterialGain(option) {
    if (!option) return {};
    if (option.kind === "boss") {
      return { paper: 2, wax: 2, cloth: 2 };
    }
    if (option.material && EXP_MATERIALS[option.material]) {
      return { [option.material]: Math.max(1, Math.floor(option.materialQty || 1)) };
    }
    return {};
  }

  function materialSummary() {
    return Object.entries(EXP_MATERIALS)
      .map(([id, material]) => `${material.name} ${state.materials[id] || 0}`)
      .join(" · ");
  }

  function materialGainText(materials) {
    return Object.entries(materials || {})
      .filter(([id, quantity]) => EXP_MATERIALS[id] && quantity > 0)
      .map(([id, quantity]) => `${EXP_MATERIALS[id].name}×${quantity}`)
      .join("、");
  }

  function expeditionCardUnlocked(id, wins) {
    const card = EXP_CARDS[id];
    const threshold = wins === undefined ? (state ? state.expeditionWins : 0) : wins;
    return Boolean(card) && (card.unlockWins || 0) <= threshold;
  }

  function expeditionUnlockedCardPool(wins) {
    const threshold = wins === undefined ? (state ? state.expeditionWins : 0) : wins;
    return Object.keys(EXP_CARDS).filter((id) => expeditionCardUnlocked(id, threshold));
  }

  function expeditionRandomUnlockedCard() {
    const pool = expeditionUnlockedCardPool();
    return pool[Math.floor(expeditionRandom() * pool.length)] || "stamp";
  }

  function hasRelic(id) {
    return Boolean(
      state && Array.isArray(state.expeditionRelics) && state.expeditionRelics.includes(id)
    );
  }

  function hasMaterialUpgrade(id) {
    return Boolean(
      state && Array.isArray(state.materialUpgrades) && state.materialUpgrades.includes(id)
    );
  }

  function expeditionMaxLetters() {
    return 3 + (hasNode("pack2") ? 1 : 0);
  }

  function nextExpeditionUnlock() {
    const wins = state ? state.expeditionWins : 0;
    return (
      Object.entries(EXP_CARDS)
        .map(([id, card]) => ({ id, ...card }))
        .filter((card) => (card.unlockWins || 0) > wins)
        .sort((a, b) => (a.unlockWins || 0) - (b.unlockWins || 0))[0] || null
    );
  }

  function expeditionSpendLetter(reason) {
    const exp = state.expedition;
    if (!exp) return;
    if (exp.prepShield) {
      exp.prepShield = false;
      expeditionLog("行前多封的蜡替你保住了一封信。");
      return;
    }
    if (hasRelic("wax") && !exp.waxUsed) {
      exp.waxUsed = true;
      expeditionLog("蜡封裂开一点，替你保住了一封信。");
      return;
    }
    exp.letters -= 1;
    expeditionLog(reason);
  }

  function expeditionShuffle(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(expeditionRandom() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function normalizeExpedition(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!raw.result && !raw.options && !raw.current && !raw.deck) return null;
    const cards = (list) => Array.isArray(list) ? list.filter((id) => EXP_CARDS[id]) : [];
    const exp = {
      active: !raw.result,
      stage: Math.min(6, Math.max(1, Math.floor(numberOr(raw.stage, 1)))),
      letters: Math.min(4, Math.max(1, Math.floor(numberOr(raw.letters, 3)))),
      supplies: Math.min(9, Math.floor(numberOr(raw.supplies, 5))),
      deck: cards(raw.deck),
      discard: cards(raw.discard),
      hand: cards(raw.hand),
      loot: {
        stamps: Math.floor(numberOr(raw.loot && raw.loot.stamps)),
        ink: Math.floor(numberOr(raw.loot && raw.loot.ink)),
        materials: {
          paper: Math.min(99, Math.floor(numberOr(raw.loot && raw.loot.materials && raw.loot.materials.paper))),
          wax: Math.min(99, Math.floor(numberOr(raw.loot && raw.loot.materials && raw.loot.materials.wax))),
          cloth: Math.min(99, Math.floor(numberOr(raw.loot && raw.loot.materials && raw.loot.materials.cloth)))
        }
      },
      rate: Math.max(1, numberOr(raw.rate, 1)),
      log: Array.isArray(raw.log) ? raw.log.filter((line) => typeof line === "string").slice(0, 8) : [],
      options: Array.isArray(raw.options) ? raw.options.filter((option) => option && option.kind).slice(0, 3) : [],
      current: raw.current && typeof raw.current === "object" ? raw.current : null,
      result: raw.result && typeof raw.result === "object" ? raw.result : null,
      needBonus: raw.needBonus === -1 ? -1 : 0,
      cardChoice: raw.cardChoice && Array.isArray(raw.cardChoice.options) && cards(raw.cardChoice.options).length
        ? {
            source: raw.cardChoice.source === "trade" || raw.cardChoice.source === "elite" ? raw.cardChoice.source : "camp",
            options: cards(raw.cardChoice.options).slice(0, 3)
          }
        : null,
      waxUsed: Boolean(raw.waxUsed),
      prepShield: Boolean(raw.prepShield),
      seed: Math.floor(numberOr(raw.seed)),
      rngState: Math.floor(numberOr(raw.rngState)),
      startedAt: numberOr(raw.startedAt)
    };
    if (!exp.result && exp.letters <= 0) exp.letters = 1;
    if (!exp.result && !exp.options.length && !exp.current) {
      exp.options = expeditionOptions(exp.stage);
    }
    if (!exp.result && exp.current && (exp.current.kind === "hazard" || exp.current.kind === "boss" || exp.current.kind === "elite") && !exp.hand.length) {
      /* hand is drawn lazily in markup */
    }
    return exp;
  }

  function expeditionOptions(stage) {
    if (stage >= 6) {
      const rate = state.expedition ? state.expedition.rate : 1;
      const boss = EXP_BOSSES[Math.floor(expeditionRandom() * EXP_BOSSES.length)];
      return [{
        kind: "boss",
        bossId: boss.id,
        tag: boss.tag,
        title: boss.title,
        desc: boss.desc,
        need: boss.need,
        stamps: Math.round(rate * 90 + 1500),
        ink: 10
      }];
    }
    const tables = {
      1: ["hazard", "hazard"],
      2: ["hazard", "camp"],
      3: ["trade", "event", "elite"],
      4: ["hazard", "hazard"],
      5: ["camp", "hazard", "elite"]
    };
    const usedHazards = new Set();
    return (tables[stage] || ["hazard", "hazard"]).map((kind) => {
      if (kind === "elite") {
        const elite = EXP_ELITES[Math.floor(expeditionRandom() * EXP_ELITES.length)];
        const rate = state.expedition ? state.expedition.rate : 1;
        return {
          kind: "elite",
          eliteId: elite.id,
          tag: elite.tag,
          title: elite.title,
          desc: elite.desc,
          need: elite.need,
          stamps: Math.round(rate * 60 + 500),
          ink: 5,
          material: elite.material,
          materialQty: 2
        };
      }
      if (kind === "camp") {
        return { kind: "camp", tag: "camp", title: "路边营地", desc: "一盏灯，一壶热水。可以歇一脚。" };
      }
      if (kind === "trade") {
        return { kind: "trade", tag: "trade", title: "湖边集市", desc: "货郎铺开一块布，愿意用邮票和墨点换东西。" };
      }
      if (kind === "event") {
        const event = EXP_EVENTS[Math.floor(expeditionRandom() * EXP_EVENTS.length)];
        return { kind: "event", tag: "event", eventId: event.id, title: event.title, desc: event.text };
      }
      let pool = EXP_HAZARDS.filter((hazard) => !usedHazards.has(hazard.tag));
      if (!pool.length) pool = EXP_HAZARDS;
      const hazard = pool[Math.floor(expeditionRandom() * pool.length)];
      usedHazards.add(hazard.tag);
      const rate = state.expedition ? state.expedition.rate : 1;
      return {
        kind: "hazard",
        tag: hazard.tag,
        title: hazard.title,
        desc: hazard.desc,
        need: hazard.need + (stage >= 4 ? 1 : 0),
        stamps: Math.round(rate * (12 + stage * 4) + 40 * stage),
        ink: 1 + Math.floor(stage / 2),
        material: EXP_MATERIAL_BY_TAG[hazard.tag] || "paper",
        materialQty: 1 + (stage >= 4 ? 1 : 0)
      };
    });
  }

  function startExpedition(prep = []) {
    if (!expeditionUnlocked()) {
      playDenySound();
      return false;
    }
    if (state.expedition && !state.expedition.result) return false;

    const chosenPrep = prep.filter((id) => EXP_PREP[id]);
    for (const id of chosenPrep) {
      if ((state.materials[id] || 0) < EXP_PREP[id].cost) {
        playDenySound();
        showToast("材料不够，先轻装出发吧。", 3200);
        return false;
      }
    }
    chosenPrep.forEach((id) => {
      state.materials[id] = Math.max(0, (state.materials[id] || 0) - EXP_PREP[id].cost);
    });

    const startingDeck = state.expeditionDeck.length
      ? [...state.expeditionDeck]
      : [...EXP_STARTER];
    const startingSupplies =
      5 + (hasNode("pack1") ? 1 : 0) + (hasRelic("spare_bag") ? 2 : 0) +
      (chosenPrep.includes("cloth") ? 2 : 0);
    const seed = ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;

    const exp = {
      active: true,
      stage: 1,
      letters: expeditionMaxLetters() + (hasMaterialUpgrade("sewing") ? 1 : 0),
      supplies: Math.min(9, startingSupplies),
      deck: [],
      discard: [],
      hand: [],
      loot: { stamps: 0, ink: 0, materials: { paper: 0, wax: 0, cloth: 0 } },
      rate: Math.max(1, baseRate()),
      log: ["你背起邮袋，走出苔藓镇。"],
      options: [],
      current: null,
      result: null,
      needBonus: 0,
      cardChoice: null,
      waxUsed: false,
      prepShield: chosenPrep.includes("wax") || hasMaterialUpgrade("seal_press"),
      seed,
      rngState: seed,
      startedAt: Date.now()
    };
    state.expedition = exp;
    if (hasNode("pack3")) startingDeck.push(expeditionRandomUnlockedCard());
    if (chosenPrep.includes("paper")) {
      startingDeck.push(expeditionRandomUnlockedCard());
      expeditionLog("多带的一张牌塞进了背囊。");
    }
    if (hasMaterialUpgrade("scriptorium")) {
      startingDeck.push(expeditionRandomUnlockedCard());
      expeditionLog("抄写台多抄了一张牌。");
    }
    if (chosenPrep.includes("wax")) expeditionLog("蜡封多封了一道。");
    if (chosenPrep.includes("cloth")) expeditionLog("邮袋加固过，干粮多带了 2 份。");
    exp.deck = expeditionShuffle(startingDeck);
    exp.options = expeditionOptions(1);
    expSelection = [];
    expConfirmAbandon = false;
    saveGame();
    return true;
  }

  function expeditionDrawHand() {
    const exp = state.expedition;
    if (!exp || exp.hand.length) return;
    let guard = 0;
    while (exp.hand.length < 4 && guard < 12) {
      guard += 1;
      if (!exp.deck.length) {
        exp.deck = expeditionShuffle(exp.discard);
        exp.discard = [];
      }
      if (!exp.deck.length) break;
      exp.hand.push(exp.deck.pop());
    }
    if (exp.current && exp.current.kind === "boss") {
      const matching = exp.hand.findIndex((id) => EXP_CARDS[id] && EXP_CARDS[id].tag === exp.current.tag);
      if (matching < 0) {
        let source = exp.deck.findIndex((id) => EXP_CARDS[id] && EXP_CARDS[id].tag === exp.current.tag);
        let card = null;
        if (source >= 0) card = exp.deck.splice(source, 1)[0];
        if (!card) {
          source = exp.discard.findIndex((id) => EXP_CARDS[id] && EXP_CARDS[id].tag === exp.current.tag);
          if (source >= 0) card = exp.discard.splice(source, 1)[0];
        }
        if (card && exp.hand.length) {
          exp.deck.push(exp.hand[0]);
          exp.hand[0] = card;
          expeditionLog("你在终点前捡到一张还没湿的牌。");
        }
      }
    }
  }

  function expeditionCardPower(cardId, current) {
    const card = EXP_CARDS[cardId];
    if (!card) return 0;
    const match = current && card.tag !== "any" && card.tag === current.tag;
    return card.power + (match ? 2 + (hasRelic("watch") ? 1 : 0) : 0);
  }

  function expeditionSelectedPower() {
    const exp = state.expedition;
    if (!exp || !exp.current) return 0;
    return [...new Set(expSelection)].reduce(
      (total, index) => total + expeditionCardPower(exp.hand[index], exp.current),
      0
    );
  }

  function expeditionOptionTag(option) {
    if (option.kind === "boss") return "终点";
    if (option.kind === "elite") return "精英";
    if (option.kind === "camp") return "营地";
    if (option.kind === "trade") return "集市";
    if (option.kind === "event") return "路遇";
    return { rain: "雨天", road: "道路", night: "夜路", wind: "逆风" }[option.tag] || "路况";
  }

  function expeditionEntryMarkup() {
    const unlocked = expeditionUnlocked();
    const exp = state.expedition;
    const active = exp && !exp.result;
    const result = exp && exp.result;
    const label = result ? "查看结算" : active ? "继续远行" : "出发";
    const nextUnlock = nextExpeditionUnlock();
    const relicNames = state.expeditionRelics
      .map((id) => EXP_RELICS[id] && EXP_RELICS[id].name)
      .filter(Boolean);
    const note = !unlocked
      ? `累计 ${formatNumber(700)} 张邮票后，邮路会延伸到雾湖之外。`
      : active
        ? `第 ${exp.stage} 段 · 信件 ${exp.letters} · 干粮 ${exp.supplies}`
        : result
          ? "上一趟已经回来，看看带回了什么。"
          : `带 ${expeditionMaxLetters()} 封信和一副邮差牌，走一条会变的远路。${state.expeditionWins ? `已走完 ${state.expeditionWins} 趟。` : ""}`;
    return `
      <div class="expedition-entry${unlocked ? "" : " is-locked"}">
        <div>
          <span class="expedition-kicker">远行 · 随机邮路</span>
          <b>雾湖之外</b>
          <p>${note}</p>
          <p class="expedition-meta">背囊 ${state.expeditionDeck.length} 张${relicNames.length ? ` · 遗物 ${relicNames.join("、")}` : ""}</p>
          <p class="expedition-meta">材料 ${materialSummary()}</p>
          ${unlocked && !active && !result
            ? `<p class="expedition-next">${nextUnlock ? `再赢 ${nextUnlock.unlockWins - state.expeditionWins} 趟解锁「${nextUnlock.name}」` : "邮差牌已全部解锁"}</p>`
            : ""}
        </div>
        <button class="expedition-open" type="button" data-expedition-open ${unlocked ? "" : "disabled"}>${unlocked ? label : "未开通"}</button>
      </div>`;
  }

  function expeditionProgressMarkup() {
    return Array.from({ length: 6 }, (_, index) => {
      const stage = index + 1;
      const current = state.expedition.stage;
      const cls = stage < current ? "is-done" : stage === current ? "is-current" : "";
      return `<span class="exp-pip ${cls}" aria-hidden="true">${stage}</span>`;
    }).join("");
  }

  function expeditionOptionsMarkup() {
    const exp = state.expedition;
    if (!exp.options.length) exp.options = expeditionOptions(exp.stage);
    return `
      <p class="exp-lead">第 ${exp.stage} 段 · 选一条路</p>
      <div class="exp-options">
        ${exp.options.map((option, index) => `
          <button class="exp-option" type="button" data-exp-option="${index}">
            <span class="exp-tag">${expeditionOptionTag(option)}</span>
            <b>${option.title}</b>
            <p>${option.desc}</p>
            <small>${option.kind === "hazard" || option.kind === "boss" || option.kind === "elite"
              ? `需要 ${option.need} 通行 · 回信 +${formatNumber(option.stamps)} 邮票 · +${option.ink} 墨点${option.kind === "elite" ? " · 胜后挑一张牌" : ""}`
              : option.kind === "camp"
                ? "补信件 / 补干粮 / 加一张牌"
                : option.kind === "trade"
                  ? "用邮票或墨点换补给"
                  : "会遇到一个人，做一次选择"}</small>
          </button>`).join("")}
      </div>`;
  }

  function expeditionHazardMarkup() {
    const exp = state.expedition;
    const current = exp.current;
    const tag = expeditionOptionTag(current);
    const selected = [...new Set(expSelection)];
    const power = expeditionSelectedPower();
    const hasDetour = selected.some((index) => EXP_CARDS[exp.hand[index]] && EXP_CARDS[exp.hand[index]].skip);
    const hasShield = selected.some((index) => EXP_CARDS[exp.hand[index]] && EXP_CARDS[exp.hand[index]].shield);
    const cards = exp.hand.map((cardId, index) => {
      const card = EXP_CARDS[cardId];
      const disabled = (card.supplyCost || 0) > exp.supplies;
      const isSelected = selected.includes(index);
      const match = card.tag !== "any" && card.tag === current.tag;
      return `
        <button class="exp-card${isSelected ? " is-selected" : ""}${match ? " is-match" : ""}" type="button" data-exp-card="${index}" ${disabled ? "disabled" : ""}>
          <span class="exp-card-name">${card.name}</span>
          <small>${card.desc}</small>
          <b>+${expeditionCardPower(cardId, current)}</b>
        </button>`;
    }).join("");
    return `
      <div class="exp-encounter">
        <span class="exp-tag">${tag} · 需要 ${current.need}</span>
        <h4>${current.title}</h4>
        <p>${current.desc}</p>
        ${exp.hand.length
          ? `<div class="exp-hand">${cards}</div>`
          : `<p class="exp-empty">背囊空了，只能硬着头皮往前走。</p>`}
        <div class="exp-total">${hasDetour
          ? "绕路：跳过这处路障，耗 1 份干粮"
          : `已选 ${selected.length} / 2 · 通行 <b>${power}</b> / ${current.need}${hasShield ? " · 护信生效" : ""}`}</div>
        <button class="exp-primary" type="button" data-exp-resolve ${exp.hand.length && selected.length ? "" : "disabled"}>${hasDetour ? "绕路前进" : "投递这封信"}</button>
        ${exp.hand.length
          ? `<p class="exp-hint">同类牌有额外加成；“护信”失败时保住一封信；“绕路”直接跳过路障，但耗 1 干粮。</p>`
          : `<button class="exp-primary exp-danger" type="button" data-exp-resolve-empty>硬着头皮走</button>`}
      </div>`;
  }

  function expeditionCardChoiceMarkup() {
    const exp = state.expedition;
    const choice = exp.cardChoice;
    if (!choice) return "";
    const trade = choice.source === "trade";
    const elite = choice.source === "elite";
    return `
      <div class="exp-encounter">
        <span class="exp-tag">${elite ? "精英" : trade ? "集市" : "营地"}</span>
        <h4>${elite ? "旧哨站的战利品" : trade ? "货郎摊开三张牌" : "挑一张带走的牌"}</h4>
        <p>${elite ? "旧哨站里翻出三张还能用的牌。你只能带走一张。" : trade ? "“只换不卖。选一张，付 20 墨点。”" : "火还亮着，你可以从邮袋里挑一张牌塞进背囊。"}</p>
        <div class="exp-hand exp-card-choice">
          ${choice.options.map((cardId, index) => {
            const card = EXP_CARDS[cardId];
            return `
              <button class="exp-card" type="button" data-exp-pick-card="${index}">
                <span class="exp-card-name">${card.name}</span>
                <small>${card.desc}</small>
                <b>+${card.power}</b>
              </button>`;
          }).join("")}
        </div>
        <p class="exp-hint">${trade ? "选好后付 20 墨点；现有 " + formatNumber(state.ink) + " 墨点。" : elite ? "胜者先挑，牌会留在这一趟的背囊里。" : "免费带走一张，牌会留在这一趟的背囊里。"}</p>
      </div>`;
  }

  function expeditionCampMarkup() {
    const exp = state.expedition;
    if (exp.cardChoice) return expeditionCardChoiceMarkup();
    return `
      <div class="exp-encounter">
        <span class="exp-tag">营地</span>
        <h4>路边营地</h4>
        <p>火升起来了。你可以在天亮前做一件事。</p>
        <div class="exp-choices">
          <button class="exp-choice" type="button" data-exp-camp="heal" ${exp.letters >= expeditionMaxLetters() ? "disabled" : ""}>
            <b>补 1 封信</b><span>信件 ${exp.letters} / ${expeditionMaxLetters()}${exp.letters >= expeditionMaxLetters() ? " · 已经满了" : ""}</span>
          </button>
          <button class="exp-choice" type="button" data-exp-camp="supply" ${exp.supplies >= 9 ? "disabled" : ""}>
            <b>补 2 份干粮</b><span>干粮 ${exp.supplies}${exp.supplies >= 9 ? " · 背不动了" : ""}</span>
          </button>
          <button class="exp-choice" type="button" data-exp-camp="card">
            <b>往背囊里塞 1 张牌</b><span>从三张里挑一张</span>
          </button>
        </div>
      </div>`;
  }

  function expeditionTradeMarkup() {
    const exp = state.expedition;
    if (exp.cardChoice) return expeditionCardChoiceMarkup();
    return `
      <div class="exp-encounter">
        <span class="exp-tag">集市</span>
        <h4>湖边集市</h4>
        <p>货郎把布摊开：“只换不卖。换完你就得赶路了。”</p>
        <div class="exp-choices">
          <button class="exp-choice" type="button" data-exp-trade="supply" ${state.stamps < 80 ? "disabled" : ""}>
            <b>80 邮票 → 2 份干粮</b><span>${state.stamps < 80 ? "邮票不够" : `干粮 ${exp.supplies} / 9`}</span>
          </button>
          <button class="exp-choice" type="button" data-exp-trade="card" ${state.ink < 20 ? "disabled" : ""}>
            <b>20 墨点 → 三选一</b><span>${state.ink < 20 ? "墨点不够" : `现有 ${state.ink} 墨点`}</span>
          </button>
          <button class="exp-choice" type="button" data-exp-trade="leave">
            <b>不换了</b><span>继续赶路</span>
          </button>
        </div>
      </div>`;
  }

  function expeditionEventMarkup() {
    const exp = state.expedition;
    const event = EXP_EVENTS.find((candidate) => candidate.id === exp.current.eventId) || EXP_EVENTS[0];
    return `
      <div class="exp-encounter">
        <span class="exp-tag">路遇</span>
        <h4>${event.title}</h4>
        <p>${event.text}</p>
        <div class="exp-choices">
          ${event.choices.map((choice, index) => {
            const cost = choice.cost && choice.cost.supplies ? choice.cost.supplies : 0;
            return `
              <button class="exp-choice" type="button" data-exp-event="${index}" ${cost > exp.supplies ? "disabled" : ""}>
                <b>${choice.label}</b>
                <span>${cost ? `耗 ${cost} 干粮` : "不耗干粮"}${cost > exp.supplies ? " · 干粮不够" : ""}</span>
              </button>`;
          }).join("")}
        </div>
      </div>`;
  }

  function expeditionRewardCardId() {
    const unlocked = expeditionUnlockedCardPool();
    const advanced = unlocked.filter((id) => !EXP_STARTER.includes(id));
    const pool = advanced.length ? advanced : unlocked;
    if (!pool.length) return null;
    const counts = {};
    state.expeditionDeck.forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
    const min = Math.min(...pool.map((id) => counts[id] || 0));
    const best = pool.filter((id) => (counts[id] || 0) === min);
    return best[Math.floor(expeditionRandom() * best.length)];
  }

  function expeditionCardChoiceOptions(count = 3) {
    const exp = state.expedition;
    const pool = expeditionUnlockedCardPool();
    const counts = {};
    [...exp.deck, ...exp.hand, ...exp.discard].forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
    const shuffled = expeditionShuffle(pool);
    shuffled.sort((left, right) => (counts[left] || 0) - (counts[right] || 0));
    return shuffled.slice(0, count);
  }

  function expeditionRewardChoices(success) {
    const rewards = [];
    const rate = Math.max(1, (state.expedition && state.expedition.rate) || baseRate());
    if (state.expeditionDeck.length < 30) {
      const cardId = expeditionRewardCardId();
      if (cardId) {
        const card = EXP_CARDS[cardId];
        rewards.push({ type: "card", id: cardId, name: card.name, desc: card.desc });
      }
    }
    if (success) {
      const relicId = Object.keys(EXP_RELICS).find(
        (id) => !state.expeditionRelics.includes(id)
      );
      if (relicId) {
        const relic = EXP_RELICS[relicId];
        rewards.push({ type: "relic", id: relicId, name: relic.name, desc: relic.desc });
      }
      rewards.push({
        type: "materials",
        id: "materials",
        name: "材料包",
        desc: "纸×2 · 蜡×1 · 布×1 · +300 邮票",
        materials: { paper: 2, wax: 1, cloth: 1 },
        stamps: 300
      });
    } else {
      const stamps = Math.round(rate * 8 + 200);
      rewards.push({
        type: "supply",
        id: "bundle",
        name: "剩下的邮袋",
        desc: `+${formatNumber(stamps)} 邮票 · +3 墨点`,
        stamps,
        ink: 3
      });
    }
    return rewards.slice(0, 3);
  }

  function claimExpeditionReward(index) {
    const exp = state.expedition;
    const result = exp && exp.result;
    if (!result || !Array.isArray(result.rewards)) return;
    if (result.rewardPicked !== undefined && result.rewardPicked !== null) return;
    const reward = result.rewards[index];
    if (!reward) return;

    if (reward.type === "card" && EXP_CARDS[reward.id]) {
      if (state.expeditionDeck.length < 30) {
        state.expeditionDeck.push(reward.id);
      } else {
        addStamps(1000);
      }
    } else if (reward.type === "relic" && EXP_RELICS[reward.id]) {
      if (!state.expeditionRelics.includes(reward.id) && state.expeditionRelics.length < 3) {
        state.expeditionRelics.push(reward.id);
      }
    } else if (reward.type === "materials") {
      Object.entries(reward.materials || {}).forEach(([id, quantity]) => {
        if (!EXP_MATERIALS[id] || quantity <= 0) return;
        state.materials[id] = Math.min(99, (state.materials[id] || 0) + quantity);
      });
      addStamps(reward.stamps || 0);
    } else if (reward.type === "supply") {
      addStamps(reward.stamps || 0);
      addInk(reward.ink || 0);
    }

    result.rewardPicked = index;
    result.rewardName = reward.name;
    saveGame();
    refreshLive();
    renderExpedition();
  }

  function expeditionResultMarkup() {
    const result = state.expedition.result;
    const rewards = Array.isArray(result.rewards) ? result.rewards : [];
    const picked = result.rewardPicked !== undefined && result.rewardPicked !== null;
    const unlocked = Array.isArray(result.unlocked) ? result.unlocked : [];
    const gainedMaterials = materialGainText(result.materials);
    const relics = state.expeditionRelics
      .map((id) => EXP_RELICS[id] && EXP_RELICS[id].name)
      .filter(Boolean);
    const rewardMarkup = rewards.length && !picked
      ? `
        <div class="exp-rewards">
          <p class="exp-lead">选一样带回邮局</p>
          <div class="exp-choices">
            ${rewards.map((reward, index) => `
              <button class="exp-choice exp-reward" type="button" data-exp-reward="${index}">
                <b>${reward.name}</b>
                <span>${reward.desc}</span>
              </button>`).join("")}
          </div>
        </div>`
      : "";
    return `
      <div class="exp-result ${result.success ? "is-win" : "is-lose"}">
        <span class="exp-tag">${result.success ? "抵达星港" : "信留在了路上"}</span>
        <h4>${result.success ? "最后一班星船赶上了" : "这一趟只能到这里"}</h4>
        <p>带回 ${formatNumber(result.stamps)} 张邮票、${formatNumber(result.ink)} 墨点${result.moon ? `、${result.moon} 枚月光邮戳` : ""}${gainedMaterials ? `、${gainedMaterials}` : ""}。</p>
        <p>${result.success ? "远行成功次数 +1。材料可以下次行前使用。下一趟会遇到新的路。" : "失败只带回 30% 的邮袋，材料留在了路上；下一次会更好。"}</p>
        ${unlocked.length ? `<p class="exp-unlock">新牌解锁：${unlocked.join("、")}</p>` : ""}
        <p class="exp-meta">背囊 ${state.expeditionDeck.length} 张${relics.length ? ` · 遗物 ${relics.join("、")}` : ""}</p>
        ${rewardMarkup}
        ${picked ? `<p class="exp-reward-picked">已收下「${result.rewardName || "奖励"}」。</p>` : ""}
        ${rewards.length && !picked
          ? `<p class="exp-hint">先选一样，再决定下一趟。</p>`
          : `<div class="exp-result-actions">
              <button class="exp-primary" type="button" data-exp-restart>再来一趟</button>
              <button class="exp-secondary" type="button" data-exp-finish>回到邮局</button>
            </div>`}
      </div>`;
  }

  function expeditionMarkup() {
    const exp = state.expedition;
    if (!exp) return "";
    if (!exp.result && exp.current && (exp.current.kind === "hazard" || exp.current.kind === "boss" || exp.current.kind === "elite") && !exp.hand.length) {
      expeditionDrawHand();
    }
    const maxLetters = Math.max(expeditionMaxLetters(), exp.letters);
    const hearts = "♥".repeat(Math.max(0, exp.letters)) + "♡".repeat(Math.max(0, maxLetters - exp.letters));
    let body = "";
    if (exp.result) body = expeditionResultMarkup();
    else if (exp.cardChoice) body = expeditionCardChoiceMarkup();
    else if (!exp.current) body = expeditionOptionsMarkup();
    else if (exp.current.kind === "camp") body = expeditionCampMarkup();
    else if (exp.current.kind === "trade") body = expeditionTradeMarkup();
    else if (exp.current.kind === "event") body = expeditionEventMarkup();
    else body = expeditionHazardMarkup();
    const log = exp.log.slice(0, 5).map((line) => `<li>${line}</li>`).join("");
    const lootStamps = exp.result ? exp.result.stamps : exp.loot.stamps;
    const lootInk = exp.result ? exp.result.ink : exp.loot.ink;
    return `
      <div class="exp-shell">
        <div class="exp-head">
          <span class="exp-stat"><small>信件</small><b class="exp-hearts">${hearts}</b></span>
          <span class="exp-stat"><small>干粮</small><b>${exp.supplies}</b></span>
          <span class="exp-stat"><small>背囊</small><b>${exp.deck.length + exp.hand.length + exp.discard.length} 张</b></span>
          <span class="exp-stat exp-loot"><small>路上的邮袋</small><b>+${formatNumber(lootStamps)} 邮票 · +${formatNumber(lootInk)} 墨点</b></span>
        </div>
        <div class="exp-progress" aria-label="第 ${exp.stage} 段，共 6 段">${expeditionProgressMarkup()}</div>
        <div class="exp-stage">${body}</div>
        <div class="exp-log"><span>手记</span><ul>${log || "<li>路还很长。</li>"}</ul></div>
        <div class="exp-foot">
          <button class="link-btn" type="button" data-exp-close>收起</button>
          ${!exp.result ? `<button class="link-btn exp-warn" type="button" data-exp-abandon>放弃这趟</button>` : ""}
        </div>
        ${expConfirmAbandon ? `
          <div class="exp-confirm">
            <p>放弃这趟会把邮袋留在路上，什么也带不回来。确定吗？</p>
            <div>
              <button class="link-btn exp-warn" type="button" data-exp-abandon-confirm>确认放弃</button>
              <button class="link-btn" type="button" data-exp-abandon-cancel>再想想</button>
            </div>
          </div>` : ""}
      </div>`;
  }

  function renderExpedition() {
    if (!state || !state.expedition || els.modal.hidden) return;
    els.modalTitle.textContent = state.expedition.result ? "远行结算" : "雾湖远行";
    els.modalBody.innerHTML = expeditionMarkup();
    const focusTarget = els.modalBody.querySelector("[data-exp-focus], .exp-primary, .exp-option, .exp-result-actions button");
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function expeditionPrepMarkup() {
    const selected = expeditionPrep;
    return `
      <div class="exp-prep">
        <p class="exp-lead">行前准备</p>
        <p class="account-hint">材料是远行成功后带回的。每次准备会消耗一份，整趟有效。</p>
        <div class="exp-choices">
          ${Object.entries(EXP_PREP).map(([id, item]) => {
            const isSelected = selected.has(id);
            const permanent = id === "wax" && hasMaterialUpgrade("seal_press");
            const affordable = (state.materials[id] || 0) >= item.cost;
            return `
              <button class="exp-choice${isSelected ? " is-selected" : ""}" type="button" data-prep-toggle="${id}" ${permanent || (!isSelected && !affordable) ? "disabled" : ""}>
                <b>${item.name} · ${EXP_MATERIALS[id].name} ${item.cost}</b>
                <span>${permanent ? "封蜡台已永久生效" : item.desc + (!isSelected && !affordable ? " · 材料不够" : "")}</span>
              </button>`;
          }).join("")}
        </div>
        <p class="exp-hint">现有材料：${materialSummary()}</p>
        <div class="exp-result-actions">
          <button class="exp-primary" type="button" data-prep-start>${selected.size ? "带着这些出发" : "空手出发"}</button>
          <button class="exp-secondary" type="button" data-prep-skip>不带材料，直接走</button>
        </div>
      </div>`;
  }

  function openExpeditionPrep() {
    if (!state) return;
    if (!expeditionUnlocked()) {
      playDenySound();
      showToast(`累计 ${formatNumber(700)} 张邮票后，邮路会延伸到雾湖之外。`, 3200);
      return;
    }
    expeditionPrep = new Set();
    openModal({
      title: "收拾邮袋",
      body: expeditionPrepMarkup(),
      footer: false,
      wide: true,
      kicker: "苔藓邮局 · 远行准备"
    });
  }

  function toggleExpeditionPrep(id) {
    if (!EXP_PREP[id]) return;
    if (id === "wax" && hasMaterialUpgrade("seal_press")) {
      playDenySound();
      return;
    }
    if (expeditionPrep.has(id)) {
      expeditionPrep.delete(id);
    } else if ((state.materials[id] || 0) >= EXP_PREP[id].cost) {
      expeditionPrep.add(id);
    } else {
      playDenySound();
      return;
    }
    if (els.modalBody.querySelector(".exp-prep")) {
      els.modalBody.innerHTML = expeditionPrepMarkup();
    }
  }

  function startExpeditionWithPrep(skip = false) {
    const prep = skip ? [] : [...expeditionPrep];
    if (!startExpedition(prep)) return;
    expeditionPrep = new Set();
    openExpeditionModal();
  }

  function openExpeditionModal() {
    if (!state || !state.expedition) return;
    expSelection = [];
    expConfirmAbandon = false;
    if (!state.expedition.result) state.expedition.active = true;
    openModal({
      title: state.expedition.result ? "远行结算" : "雾湖远行",
      body: expeditionMarkup(),
      footer: false,
      wide: true,
      kicker: "苔藓邮局 · 远行"
    });
    if (!state.expedition.result) saveGame();
    const focusTarget = els.modalBody.querySelector(".exp-option, .exp-primary, .exp-result-actions button");
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function openExpedition() {
    if (!state) return;
    if (!expeditionUnlocked()) {
      playDenySound();
      showToast(`累计 ${formatNumber(700)} 张邮票后，邮路会延伸到雾湖之外。`, 3200);
      return;
    }
    if (!state.expedition) {
      openExpeditionPrep();
      return;
    }
    openExpeditionModal();
  }

  function expeditionLog(line) {
    if (!state.expedition) return;
    state.expedition.log.unshift(line);
    state.expedition.log = state.expedition.log.slice(0, 8);
  }

  function advanceExpedition() {
    const exp = state.expedition;
    exp.current = null;
    exp.options = [];
    exp.hand = [];
    exp.discard = exp.discard;
    exp.cardChoice = null;
    expSelection = [];
    if (exp.stage >= 6) {
      finishExpedition(true);
      return;
    }
    exp.stage += 1;
    exp.options = expeditionOptions(exp.stage);
    saveGame();
    renderExpedition();
  }

  function chooseExpeditionOption(index) {
    const exp = state.expedition;
    if (!exp || exp.current) return;
    const option = exp.options[index];
    if (!option) return;
    if (exp.supplies > 0) {
      exp.supplies -= 1;
      expeditionLog(`往${option.title}走，路上吃掉 1 份干粮。`);
    } else {
      expeditionSpendLetter("干粮袋空了，你饿着走了一段路，丢了一封信。");
    }
    if (exp.letters <= 0) {
      finishExpedition(false);
      return;
    }
    exp.current = option;
    exp.options = [];
    exp.hand = [];
    expSelection = [];
    if ((option.kind === "hazard" || option.kind === "boss" || option.kind === "elite") && exp.needBonus) {
      option.need = Math.max(1, option.need + exp.needBonus);
      exp.needBonus = 0;
    }
    if (option.kind === "hazard" || option.kind === "boss" || option.kind === "elite") expeditionDrawHand();
    saveGame();
    renderExpedition();
  }

  function toggleExpeditionCard(index) {
    const exp = state.expedition;
    if (!exp || !exp.current) return;
    const card = EXP_CARDS[exp.hand[index]];
    if (!card) return;
    if ((card.supplyCost || 0) > exp.supplies) {
      playDenySound();
      return;
    }
    const existing = expSelection.indexOf(index);
    if (existing >= 0) {
      expSelection.splice(existing, 1);
    } else {
      if (expSelection.length >= 2) expSelection.shift();
      expSelection.push(index);
    }
    renderExpedition();
  }

  function resolveExpedition() {
    const exp = state.expedition;
    if (!exp || !exp.current || !exp.hand.length) {
      if (exp && exp.current) {
        expeditionSpendLetter("背囊空了，你硬着头皮走，丢了一封信。");
        if (exp.letters <= 0 || exp.current.kind === "boss") finishExpedition(false);
        else advanceExpedition();
      }
      return;
    }
    const current = exp.current;
    const selected = [...new Set(expSelection)].map((index) => exp.hand[index]).filter(Boolean);
    if (!selected.length) return;
    const cards = selected.map((id) => EXP_CARDS[id]);
    const supplyCost = cards.reduce((total, card) => total + (card.supplyCost || 0), 0);
    if (supplyCost > exp.supplies) {
      playDenySound();
      showToast("干粮不够，换一张牌吧。", 2600);
      return;
    }
    exp.supplies -= supplyCost;
    exp.discard.push(...exp.hand);
    exp.hand = [];
    expSelection = [];

    const heal = cards.reduce((total, card) => total + (card.heal || 0), 0);
    if (heal > 0) {
      const before = exp.letters;
      exp.letters = Math.min(expeditionMaxLetters(), exp.letters + heal);
      if (exp.letters > before) {
        expeditionLog(`热水壶暖了暖手，补回 ${exp.letters - before} 封信。`);
      }
    }

    const supplyGain = cards.reduce((total, card) => total + (card.supplyGain || 0), 0);
    if (supplyGain > 0) {
      const before = exp.supplies;
      exp.supplies = Math.min(9, exp.supplies + supplyGain);
      if (exp.supplies > before) {
        expeditionLog(`你补了 ${exp.supplies - before} 份干粮。`);
      }
    }

    if (cards.some((card) => card.scout)) {
      exp.needBonus = -1;
      expeditionLog("你在地图上标出一条近路：下一段需求 -1。");
    }

    const detour = cards.some((card) => card.skip);
    if (detour) {
      expeditionLog(`你绕开了${current.title}，多走了几里路。`);
      if (current.kind === "boss") {
        finishExpedition(false);
      } else {
        advanceExpedition();
      }
      return;
    }

    const shield = cards.some((card) => card.shield);
    const power = selected.reduce(
      (total, id) => total + expeditionCardPower(id, current),
      0
    );

    if (power >= current.need) {
      exp.loot.stamps += current.stamps || 0;
      exp.loot.ink += current.ink || 0;
      const gainedMaterials = expeditionMaterialGain(current);
      Object.entries(gainedMaterials).forEach(([id, quantity]) => {
        exp.loot.materials[id] = Math.min(99, (exp.loot.materials[id] || 0) + quantity);
      });
      const materialText = materialGainText(gainedMaterials);
      expeditionLog(`投递成功：${current.title}，+${formatNumber(current.stamps || 0)} 邮票、+${current.ink || 0} 墨点${materialText ? `、${materialText}` : ""}。`);
      if (current.kind === "elite") {
        exp.cardChoice = { source: "elite", options: expeditionCardChoiceOptions() };
        expeditionLog("旧路尽头有一只没人认领的邮袋。");
        saveGame();
        renderExpedition();
        return;
      }
      if (current.kind === "boss") {
        finishExpedition(true);
      } else {
        advanceExpedition();
      }
      return;
    }

    if (!shield) {
      expeditionSpendLetter(`${current.title}没过去，丢了一封信。`);
    } else {
      expeditionLog(`${current.title}没过去，护信保住了信袋。`);
    }
    if (exp.letters <= 0) {
      finishExpedition(false);
    } else if (current.kind === "boss") {
      expeditionLog("终点的灯还亮着，你还有一次机会。");
      exp.hand = [];
      expSelection = [];
      expeditionDrawHand();
      saveGame();
      renderExpedition();
    } else {
      advanceExpedition();
    }
  }

  function expeditionCamp(choice) {
    const exp = state.expedition;
    if (!exp || !exp.current) return;
    if (choice === "heal") {
      exp.letters = Math.min(expeditionMaxLetters(), exp.letters + 1);
      expeditionLog("你在营地睡了一会儿，补回 1 封信。");
    } else if (choice === "supply") {
      exp.supplies = Math.min(9, exp.supplies + 2);
      expeditionLog("你在营地补了 2 份干粮。");
    } else if (choice === "card") {
      exp.cardChoice = { source: "camp", options: expeditionCardChoiceOptions() };
      saveGame();
      renderExpedition();
      return;
    }
    advanceExpedition();
  }

  function expeditionTrade(choice) {
    const exp = state.expedition;
    if (!exp || !exp.current) return;
    if (choice === "supply") {
      if (state.stamps < 80) {
        playDenySound();
        return;
      }
      state.stamps -= 80;
      exp.supplies = Math.min(9, exp.supplies + 2);
      expeditionLog("你换了 2 份干粮。");
    } else if (choice === "card") {
      if (state.ink < 20) {
        playDenySound();
        return;
      }
      exp.cardChoice = { source: "trade", options: expeditionCardChoiceOptions() };
      saveGame();
      renderExpedition();
      return;
    } else {
      expeditionLog("你谢过货郎，继续赶路。");
    }
    advanceExpedition();
  }

  function chooseExpeditionCard(index) {
    const exp = state.expedition;
    const choice = exp && exp.cardChoice;
    if (!choice) return;
    const cardId = choice.options[index];
    if (!cardId || !EXP_CARDS[cardId]) return;
    if (choice.source === "trade" && !spendInk(20)) {
      playDenySound();
      showToast("墨点不够，先挑别的路吧。", 2600);
      return;
    }
    exp.deck.push(cardId);
    exp.cardChoice = null;
    expeditionLog(`你把「${EXP_CARDS[cardId].name}」放进背囊。`);
    advanceExpedition();
  }

  function expeditionEventChoice(index) {
    const exp = state.expedition;
    if (!exp || !exp.current) return;
    const event = EXP_EVENTS.find((candidate) => candidate.id === exp.current.eventId) || EXP_EVENTS[0];
    const choice = event.choices[index];
    if (!choice) return;
    const supplyCost = choice.cost && choice.cost.supplies ? choice.cost.supplies : 0;
    if (supplyCost > exp.supplies) {
      playDenySound();
      return;
    }
    exp.supplies -= supplyCost;
    const effect = choice.effect || {};
    if (effect.lootStamps) exp.loot.stamps += effect.lootStamps;
    if (effect.ink) exp.loot.ink += effect.ink;
    if (effect.addCard) {
      const id = expeditionRandomUnlockedCard();
      exp.deck.push(id);
      expeditionLog(`你得到一张「${EXP_CARDS[id].name}」。`);
    }
    expeditionLog(choice.result);
    advanceExpedition();
  }

  function finishExpedition(success) {
    const exp = state.expedition;
    if (!exp || exp.result) return;
    const ratio = success ? 1 : 0.3;
    const stamps = Math.floor(exp.loot.stamps * ratio);
    const ink = Math.floor(exp.loot.ink * ratio);
    const moon = success ? 1 : 0;
    const materials = success ? { ...exp.loot.materials } : {};
    if (success) {
      Object.entries(materials).forEach(([id, quantity]) => {
        if (!EXP_MATERIALS[id] || quantity <= 0) return;
        state.materials[id] = Math.min(99, (state.materials[id] || 0) + quantity);
      });
    }
    const beforeWins = state.expeditionWins;
    addStamps(stamps);
    addInk(ink);
    if (moon) state.moonStamps += moon;
    if (success) state.expeditionWins += 1;
    const unlocked = success
      ? Object.values(EXP_CARDS)
          .filter(
            (card) =>
              (card.unlockWins || 0) > beforeWins &&
              (card.unlockWins || 0) <= state.expeditionWins
          )
          .map((card) => card.name)
      : [];
    exp.result = {
      success,
      stamps,
      ink,
      moon,
      materials,
      rewards: expeditionRewardChoices(success),
      rewardPicked: null,
      rewardName: "",
      unlocked
    };
    exp.active = false;
    updateGoals();
    checkAchievements({ announce: true });
    refreshLive();
    saveGame();
    renderExpedition();
  }

  function closeExpeditionResult() {
    state.expedition = null;
    saveGame();
    closeModal();
    refreshLive();
    if (activeTab === "dispatch") buildDispatchPanel();
  }

  function restartExpedition() {
    openExpeditionPrep();
  }

  function abandonExpedition() {
    state.expedition = null;
    expConfirmAbandon = false;
    saveGame();
    closeModal();
    refreshLive();
    if (activeTab === "dispatch") buildDispatchPanel();
    showToast("你把邮袋留在了路边，空手回到了邮局。", 3600);
  }

  function buildMoonPanel() {
    const branches = Object.entries(MOON_BRANCHES);
    els.panelBody.innerHTML = `
      <div class="moon-card" aria-hidden="true">
        <img src="/assets/moon-banner.webp" alt="" width="1200" height="480" loading="lazy" decoding="async">
        <p class="moon-caption">23:00 · 夜班邮车</p>
      </div>
      <p class="prestige-copy">攒够 30,000 张邮票，夜班邮车就会来接走这一程的信。月光邮戳可以点亮月光树：每用掉 1 枚，全局产出 +10%，节点永久保留。柜台来信每完成 4 封，也会留下 1 枚。</p>
      <div class="prestige-stats">
        <div class="prestige-stat">
          <span>已得到的月光邮戳</span>
          <strong id="moonOwned">0 枚</strong>
        </div>
        <div class="prestige-stat">
          <span>全局产出加成</span>
          <strong id="moonBonus">+0%</strong>
        </div>
      </div>
      <section class="moon-tree">
        <div class="tree-head">
          <span>月光树</span>
          <span><b id="moonPoints">0</b> 枚可用</span>
        </div>
        <div class="tree-grid">
          ${branches.map(([branchId, branchName]) => `
            <div class="tree-branch">
              <div class="tree-branch-head">${branchName}</div>
              ${MOON_NODES.filter((node) => node.branch === branchId).map((node) => {
                const owned = nodeOwned(node);
                const fillable = !owned && nodeUnlocked(node) && moonPoints() >= node.cost;
                return `
                  <button class="tree-node${owned ? " is-owned" : ""}${fillable ? " is-fillable" : ""}" type="button" data-moon-node="${node.id}" ${owned || !fillable ? "disabled" : ""} aria-label="${node.name}，${node.desc}，${nodeReason(node)}">
                    <span class="node-dot" aria-hidden="true"></span>
                    <span class="node-copy"><b>${node.name}</b><small>${node.desc}</small></span>
                    <span class="node-cost">${nodeReason(node)}</span>
                  </button>`;
              }).join("")}
            </div>`).join("")}
        </div>
        <p class="tree-note">点亮顺序：每条分支从上往下。节点效果会立刻生效。</p>
      </section>
      <section class="contract-box">
        <div class="tree-head">
          <span>夜班契约</span>
          <span id="contractStatus">本局未选择</span>
        </div>
        <div class="contract-grid">
          ${CONTRACTS.map((contract) => {
            const active = state.contract === contract.id;
            const locked = Boolean(state.contract) && !active;
            return `
              <button class="contract-card${active ? " is-active" : ""}" type="button" data-contract="${contract.id}" ${locked ? "disabled" : ""}>
                <b>${contract.name}</b>
                <small>${contract.desc}</small>
                <span>${active ? "本局生效中" : locked ? "本局已定" : "选它"}</span>
              </button>`;
          }).join("")}
        </div>
        <p class="tree-note">发车后会清空契约，下一程重新选。</p>
      </section>
      <div class="prestige-progress">
        <div class="prestige-progress-top">
          <span id="moonNextLabel">下一枚月光邮戳</span>
          <b id="moonProgressText">0 / 30,000</b>
        </div>
        <div class="prestige-bar"><span class="prestige-fill" id="moonFill"></span></div>
      </div>
      <button class="primary-btn" id="prestigeBtn" type="button" disabled>还差 30,000 张邮票</button>
      <p class="prestige-note">本程邮票、小邮差、风铃、工坊邮戳和手上的来信会重新开始；月光邮戳、月光树、邮路熟练度、远行、墨点与集邮册会留下。</p>
    `;

    moonUi = {
      owned: document.getElementById("moonOwned"),
      points: document.getElementById("moonPoints"),
      bonus: document.getElementById("moonBonus"),
      progress: document.getElementById("moonProgressText"),
      nextLabel: document.getElementById("moonNextLabel"),
      fill: document.getElementById("moonFill"),
      button: document.getElementById("prestigeBtn"),
      contractStatus: document.getElementById("contractStatus")
    };
    refreshMoonUi();
  }

  function refreshMoonUi() {
    if (!moonUi) return;
    const gain = currentMoonGain();
    const nextThreshold = PRESTIGE_BASE * Math.pow(gain + 1, 2);
    const progress = completionPercent(state.runEarned, nextThreshold);

    setText(moonUi.owned, `${formatNumber(state.moonStamps)} 枚`);
    if (moonUi.points) setText(moonUi.points, formatNumber(moonPoints()));
    setText(moonUi.bonus, `+${moonBonusPercent()}%`);
    setText(moonUi.progress, `${formatNumber(state.runEarned)} / ${formatNumber(nextThreshold)}`);
    setText(moonUi.nextLabel, "下一枚月光邮戳");
    moonUi.fill.style.width = `${Math.round(progress * 10) / 10}%`;
    if (moonUi.contractStatus) {
      const contract = currentContract();
      setText(moonUi.contractStatus, contract ? contract.name : "本局未选择");
    }

    MOON_NODES.forEach((node) => {
      const button = els.panelBody.querySelector(`[data-moon-node="${node.id}"]`);
      if (!button) return;
      const owned = nodeOwned(node);
      const fillable = !owned && nodeUnlocked(node) && moonPoints() >= node.cost;
      button.disabled = owned || !fillable;
      button.classList.toggle("is-owned", owned);
      button.classList.toggle("is-fillable", fillable);
      const cost = button.querySelector(".node-cost");
      if (cost) setText(cost, nodeReason(node));
    });

    if (gain >= 1) {
      moonUi.button.disabled = false;
      setText(moonUi.button, `让夜班邮车发车 · +${gain} 枚`);
      moonUi.button.setAttribute("aria-label", `让夜班邮车发车，获得 ${gain} 枚月光邮戳`);
    } else {
      moonUi.button.disabled = true;
      setText(
        moonUi.button,
        `还差 ${formatNumber(Math.max(0, PRESTIGE_BASE - state.runEarned))}张邮票`
      );
      moonUi.button.setAttribute("aria-label", "邮票还不够，夜班邮车尚未发车");
    }
  }

  function currentMoonGain() {
    if (!state) return 0;
    return Math.floor(Math.sqrt(Math.max(0, state.runEarned) / PRESTIGE_BASE) + 1e-9);
  }

  function switchTab(name, options = {}) {
    if (!TAB_NAMES.includes(name)) name = "posties";
    activeTab = name;

    els.tabs.forEach((tab) => {
      const selected = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && options.focus) tab.focus();
    });

    const selectedTab = els.tabs.find((tab) => tab.dataset.tab === name);
    if (selectedTab) {
      els.panelBody.setAttribute("aria-labelledby", selectedTab.id);
    }
    els.panelTitle.textContent = TAB_TITLES[name];
    if (els.panelEyebrow) els.panelEyebrow.textContent = TAB_EYEBROWS[name];
    els.buySwitch.hidden = name !== "posties";

    if (name === "posties") {
      buildShopPanel();
      refreshShopUi();
    } else if (name === "orders") {
      syncOrders();
      buildOrdersPanel();
      refreshOrdersUi();
    } else if (name === "dispatch") {
      syncCompletedTrips();
      buildDispatchPanel();
      refreshDispatchUi();
    } else if (name === "upgrades") {
      buildUpgradePanel();
      refreshUpgradeUi();
    } else if (name === "album") {
      buildAlbumPanel();
      unseenAchievements = 0;
      updateTabBadges();
    } else {
      buildMoonPanel();
      refreshMoonUi();
    }
  }

  function updateTabBadges() {
    if (!state) return;
    const readyUpgrades = UPGRADES.filter(
      (upgrade) =>
        !ownedUpgradeSet.has(upgrade.id) &&
        isUpgradeUnlocked(upgrade) &&
        canAfford(upgrade.cost)
    ).length;
    setText(els.upgradeDot, String(Math.min(readyUpgrades, 9)));
    setHidden(els.upgradeDot, readyUpgrades === 0);

    const moonReady = currentMoonGain() >= 1;
    setHidden(els.moonDot, !moonReady);

    setText(els.dispatchDot, String(Math.min(state.readyTrips.length, 9)));
    setHidden(els.dispatchDot, state.readyTrips.length === 0);

    const readyOrders = state.accepted.filter(orderConditionMet).length;
    setText(els.orderDot, String(Math.min(readyOrders, 9)));
    setHidden(els.orderDot, readyOrders === 0);

    setText(els.albumDot, String(unseenAchievements));
    setHidden(els.albumDot, unseenAchievements === 0);

    setText(els.collectionText, `邮戳收藏 ${ownedUpgradeSet.size} / ${UPGRADES.length}`);
  }

  function updateGoals() {
    let changed = false;
    GOALS.forEach((goal) => {
      if (!goalsDoneSet.has(goal.id) && goal.value() >= goal.target) {
        goalsDoneSet.add(goal.id);
        if (!state.goalsDone.includes(goal.id)) state.goalsDone.push(goal.id);
        changed = true;
      }
    });

    const nextGoal = GOALS.find((goal) => !goalsDoneSet.has(goal.id));
    setText(els.goalCount, `${goalsDoneSet.size} / ${GOALS.length}`);
    if (!nextGoal) {
      setText(els.goalTitle, "今天的信都送完啦，去月亮那边看看。");
      els.goalFill.style.width = "100%";
      els.goalStrip.classList.add("is-done");
      return changed;
    }

    const value = Math.max(0, Math.min(nextGoal.target, nextGoal.value()));
    const progress = completionPercent(value, nextGoal.target);
    setText(els.goalTitle, nextGoal.title);
    els.goalFill.style.width = `${Math.round(progress * 10) / 10}%`;
    els.goalStrip.classList.toggle("is-done", goalsDoneSet.size === GOALS.length);
    return changed;
  }

  const sceneEffects = (() => {
    let app = null;
    let started = false;
    let observer = null;
    let currentMode = "sunny";
    const fireflies = [];
    const dust = [];
    const rain = [];
    const leaves = [];
    const mist = [];
    let layers = null;
    let glowTexture = null;
    let leafTexture = null;
    let rainTexture = null;
    let fogTexture = null;

    function makeGlowTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.18, "rgba(255,245,210,.95)");
      gradient.addColorStop(0.5, "rgba(255,220,130,.36)");
      gradient.addColorStop(1, "rgba(255,210,100,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      return PIXI.Texture.from(canvas);
    }

    function makeLeafTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      ctx.translate(16, 16);
      ctx.rotate(-0.45);
      const gradient = ctx.createLinearGradient(-9, 0, 9, 0);
      gradient.addColorStop(0, "rgba(255,255,255,.95)");
      gradient.addColorStop(1, "rgba(255,255,255,.42)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.5)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      return PIXI.Texture.from(canvas);
    }

    function makeRainTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 6;
      canvas.height = 38;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, 0, 38);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.4, "rgba(231,247,241,.6)");
      gradient.addColorStop(1, "rgba(231,247,241,0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(3, 3);
      ctx.lineTo(3, 35);
      ctx.stroke();
      return PIXI.Texture.from(canvas);
    }

    function makeFogTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createRadialGradient(128, 64, 6, 128, 64, 124);
      gradient.addColorStop(0, "rgba(255,255,255,.52)");
      gradient.addColorStop(0.55, "rgba(255,255,255,.16)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 128);
      return PIXI.Texture.from(canvas);
    }

    function random(min, max) {
      return min + Math.random() * (max - min);
    }

    function createParticles() {
      const isSmall = window.innerWidth < 640;
      const fireflyCount = isSmall ? 11 : 19;
      const dustCount = isSmall ? 10 : 18;
      const rainCount = isSmall ? 38 : 65;
      const leafCount = isSmall ? 9 : 16;

      glowTexture = makeGlowTexture();
      leafTexture = makeLeafTexture();
      rainTexture = makeRainTexture();
      fogTexture = makeFogTexture();

      layers = {
        fireflies: new PIXI.Container(),
        dust: new PIXI.Container(),
        rain: new PIXI.Container(),
        leaves: new PIXI.Container(),
        mist: new PIXI.Container()
      };
      Object.values(layers).forEach((layer) => app.stage.addChild(layer));

      for (let index = 0; index < fireflyCount; index += 1) {
        const sprite = new PIXI.Sprite(glowTexture);
        sprite.anchor.set(0.5);
        sprite.blendMode = PIXI.BLEND_MODES.ADD;
        sprite.tint = index % 5 === 0 ? 0xffd889 : 0xffefb0;
        const scale = random(0.12, 0.3);
        sprite.scale.set(scale);
        layers.fireflies.addChild(sprite);
        fireflies.push({
          sprite,
          x: Math.random(),
          y: random(0.16, 0.82),
          ampX: random(5, 17),
          ampY: random(3, 12),
          phase: random(0, Math.PI * 2),
          speed: random(0.35, 0.9),
          baseAlpha: random(0.5, 0.95),
          scale
        });
      }

      for (let index = 0; index < dustCount; index += 1) {
        const sprite = new PIXI.Sprite(glowTexture);
        sprite.anchor.set(0.5);
        sprite.blendMode = PIXI.BLEND_MODES.ADD;
        sprite.tint = index % 3 === 0 ? 0xf7d7a0 : 0xfff0cf;
        sprite.scale.set(random(0.05, 0.14));
        layers.dust.addChild(sprite);
        dust.push({
          sprite,
          x: Math.random(),
          y: Math.random(),
          drift: random(-0.003, 0.007),
          speed: random(0.004, 0.012),
          phase: random(0, Math.PI * 2),
          alpha: random(0.22, 0.56)
        });
      }

      for (let index = 0; index < rainCount; index += 1) {
        const sprite = new PIXI.Sprite(rainTexture);
        sprite.anchor.set(0.5);
        sprite.tint = 0xdcefe8;
        sprite.alpha = random(0.18, 0.48);
        sprite.scale.set(random(0.55, 1.1), random(0.7, 1.5));
        sprite.rotation = 0.17;
        layers.rain.addChild(sprite);
        rain.push({
          sprite,
          x: Math.random(),
          y: Math.random(),
          speed: random(0.28, 0.65)
        });
      }

      for (let index = 0; index < leafCount; index += 1) {
        const sprite = new PIXI.Sprite(leafTexture);
        sprite.anchor.set(0.5);
        sprite.tint = [0x8fad72, 0xd4937f, 0xe0b867][index % 3];
        sprite.alpha = random(0.35, 0.78);
        sprite.scale.set(random(0.5, 1.15));
        layers.leaves.addChild(sprite);
        leaves.push({
          sprite,
          x: Math.random(),
          y: random(0.15, 0.86),
          speed: random(0.012, 0.035),
          phase: random(0, Math.PI * 2),
          amp: random(0.01, 0.04),
          spin: random(-0.8, 0.8)
        });
      }

      for (let index = 0; index < (isSmall ? 4 : 7); index += 1) {
        const sprite = new PIXI.Sprite(fogTexture);
        sprite.anchor.set(0.5);
        sprite.alpha = random(0.08, 0.17);
        sprite.tint = 0xe6e3d0;
        layers.mist.addChild(sprite);
        mist.push({
          sprite,
          x: Math.random(),
          y: random(0.35, 0.8),
          scale: random(0.8, 1.8),
          speed: random(0.0015, 0.005),
          phase: random(0, Math.PI * 2)
        });
      }

      setWeather(currentMode);
    }

    function layoutParticles() {
      if (!app) return;
      const width = app.screen.width;
      const height = app.screen.height;
      fireflies.forEach((particle) => {
        particle.sprite.x = particle.x * width;
        particle.sprite.y = particle.y * height;
      });
      dust.forEach((particle) => {
        particle.sprite.x = particle.x * width;
        particle.sprite.y = particle.y * height;
      });
      rain.forEach((particle) => {
        particle.sprite.x = particle.x * width;
        particle.sprite.y = particle.y * height;
      });
      leaves.forEach((particle) => {
        particle.sprite.x = particle.x * width;
        particle.sprite.y = particle.y * height;
      });
      mist.forEach((particle) => {
        particle.sprite.x = particle.x * width;
        particle.sprite.y = particle.y * height;
        particle.sprite.width = 256 * particle.scale;
        particle.sprite.height = 128 * particle.scale;
      });
    }

    function setWeather(mode) {
      currentMode = mode;
      if (!layers) return;
      layers.rain.visible = mode === "rainy";
      layers.leaves.visible = mode === "windy";
      layers.mist.visible = mode === "misty";
      const fireflyAlpha = mode === "rainy" ? 0.35 : mode === "misty" ? 0.55 : 1;
      layers.fireflies.alpha = fireflyAlpha;
      layers.dust.alpha = mode === "rainy" ? 0.35 : 1;
    }

    function tick() {
      if (!app) return;
      const width = app.screen.width;
      const height = app.screen.height;
      const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
      const time = performance.now() / 1000;

      fireflies.forEach((particle) => {
        particle.sprite.x = particle.x * width + Math.sin(time * particle.speed + particle.phase) * particle.ampX;
        particle.sprite.y = particle.y * height + Math.cos(time * particle.speed * 0.75 + particle.phase) * particle.ampY;
        particle.sprite.alpha = particle.baseAlpha * (0.55 + 0.45 * Math.sin(time * 1.3 + particle.phase));
        const pulse = 1 + 0.09 * Math.sin(time * 1.7 + particle.phase);
        particle.sprite.scale.set(particle.scale * pulse);
      });

      dust.forEach((particle) => {
        particle.x += particle.drift * dt;
        particle.y -= particle.speed * dt;
        if (particle.y < -0.05) {
          particle.y = 1.05;
          particle.x = Math.random();
        }
        if (particle.x < -0.05) particle.x = 1.05;
        if (particle.x > 1.05) particle.x = -0.05;
        particle.sprite.x = particle.x * width + Math.sin(time + particle.phase) * 4;
        particle.sprite.y = particle.y * height;
        particle.sprite.alpha = particle.alpha * (0.7 + 0.3 * Math.sin(time * 0.9 + particle.phase));
      });

      if (currentMode === "rainy") {
        rain.forEach((particle) => {
          particle.y += particle.speed * dt;
          particle.x += 0.02 * dt;
          if (particle.y > 1.08) {
            particle.y = -0.08;
            particle.x = Math.random();
          }
          if (particle.x > 1.08) particle.x = -0.08;
          particle.sprite.x = particle.x * width;
          particle.sprite.y = particle.y * height;
        });
      }

      if (currentMode === "windy") {
        leaves.forEach((particle) => {
          particle.x += particle.speed * dt;
          if (particle.x > 1.08) {
            particle.x = -0.08;
            particle.y = random(0.12, 0.85);
          }
          particle.sprite.x = particle.x * width;
          particle.sprite.y = particle.y * height + Math.sin(time * 1.4 + particle.phase) * particle.amp * height;
          particle.sprite.rotation += particle.spin * dt;
        });
      }

      if (currentMode === "misty") {
        mist.forEach((particle) => {
          particle.x += particle.speed * dt;
          if (particle.x > 1.3) particle.x = -0.3;
          particle.sprite.x = particle.x * width;
          particle.sprite.y = particle.y * height + Math.sin(time * 0.22 + particle.phase) * 10;
          particle.sprite.alpha = 0.1 + 0.05 * Math.sin(time * 0.3 + particle.phase);
        });
      }
    }

    function init() {
      if (started) return;
      started = true;
      if (!window.PIXI || !els.sceneFx || prefersReducedMotion) {
        started = false;
        return;
      }
      try {
        app = new PIXI.Application({
          resizeTo: els.scene,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(2, window.devicePixelRatio || 1),
          powerPreference: "low-power"
        });
        app.view.setAttribute("aria-hidden", "true");
        els.sceneFx.appendChild(app.view);
        createParticles();
        layoutParticles();
        app.ticker.add(tick);
        observer = new ResizeObserver(() => {
          if (!app) return;
          const width = Math.max(1, els.scene.clientWidth);
          const height = Math.max(1, els.scene.clientHeight);
          app.renderer.resize(width, height);
          layoutParticles();
        });
        observer.observe(els.scene);
        document.addEventListener("visibilitychange", () => {
          if (!app) return;
          if (document.hidden) app.ticker.stop();
          else app.ticker.start();
        });
      } catch (error) {
        try {
          if (app) app.destroy(true, { children: true });
        } catch (destroyError) {
          /* ignore */
        }
        app = null;
        started = false;
      }
    }

    return { init, setWeather };
  })();

  function applyWeatherUi() {
    const weather = currentWeather();
    els.scene.dataset.weather = weather.id;
    els.weatherIcon.innerHTML = ICONS[weather.icon] || "";
    setText(els.weatherLabel, weather.label);
    els.weatherChip.title = `${weather.name}：${weather.label}。天气会不时换一换。`;
    sceneEffects.setWeather(weather.id);
  }

  function refreshWeather(announce = false, options = {}) {
    if (!state) return false;
    const now = Date.now();
    if (state.weatherUntil && state.weatherUntil > now) {
      if (els.scene.dataset.weather !== state.weatherId) applyWeatherUi();
      return false;
    }

    const previous = state.weatherId;
    const choices = WEATHERS.filter((weather) => weather.id !== previous);
    const next = (choices.length ? choices : WEATHERS)[Math.floor(Math.random() * (choices.length || WEATHERS.length))];
    state.weatherId = next.id;
    state.weatherUntil = now + WEATHER_DURATION;
    applyWeatherUi();
    if (announce) {
      showToast(next.notice, 5000);
      playTone(587.33, { duration: 0.08, volume: 0.012, type: "sine" });
      playTone(783.99, { start: 0.06, duration: 0.09, volume: 0.01, type: "sine" });
    }
    if (options.persist !== false) saveGame();
    return true;
  }

  function updateBellUi(now = Date.now()) {
    if (!state) return;
    const active = now < state.bellActiveUntil;
    const ready = state.bellReadyAt <= now;
    const activeLeft = Math.ceil(Math.max(0, state.bellActiveUntil - now) / 1000);
    const cooldownLeft = Math.ceil(Math.max(0, state.bellReadyAt - now) / 1000);
    const recharge = ready
      ? 100
      : Math.max(0, Math.min(100, Math.round((1 - (state.bellReadyAt - now) / (BELL_COOLDOWN_SECONDS * 1000)) * 100)));

    els.bellBtn.style.setProperty("--bell-progress", String(recharge));
    els.bellBtn.classList.toggle("is-active", active);
    els.bellBtn.classList.toggle("is-ready", ready);
    els.bellBtn.classList.toggle("is-cooling", !active && !ready);
    els.stageCard.classList.toggle("is-belled", active);

    if (active) {
      setText(els.bellLabel, "风铃");
      setText(els.bellSub, `×3 ${activeLeft}s`);
      els.bellBtn.setAttribute("aria-label", `风铃生效中，剩余 ${activeLeft} 秒，全邮局产出 3 倍`);
    } else if (!ready) {
      setText(els.bellLabel, "风铃");
      setText(els.bellSub, `${cooldownLeft}s`);
      els.bellBtn.setAttribute("aria-label", `风铃冷却中，还需 ${cooldownLeft} 秒`);
    } else {
      setText(els.bellLabel, "摇铃");
      setText(els.bellSub, "就绪");
      els.bellBtn.setAttribute("aria-label", `摇响风铃，${BELL_ACTIVE_SECONDS} 秒内让全邮局产出变为 3 倍`);
    }
  }

  function refreshLive() {
    if (!state) return;
    const rate = baseRate();
    const currentClick = baseClickPower() * comboMultiplier();
    const multiplier = comboMultiplier();

    setText(els.stampCount, formatNumber(Math.floor(state.stamps)));
    setText(els.rateText, `+${formatRate(rate)}/秒`);
    setText(els.clickValue, `+${formatGain(baseClickPower())}`);
    setText(els.sealGain, `+${formatGain(currentClick)}`);
    setText(els.comboLabel, `连击 ×${multiplier.toFixed(2)}`);
    els.comboFill.style.width = `${Math.round((Math.min(combo, 40) / 40) * 100)}%`;
    setText(
      els.comboTip,
      combo >= 40
        ? "满格啦，继续送信"
        : prefersReducedMotion ? "每次盖戳 ×1.5" : "金圈内盖戳 ×3"
    );
    setText(els.inkCount, formatNumber(state.ink));
    setText(els.inkTip, hasNode("busy2") ? "完美盖戳 +2" : "完美盖戳 +1");
    if (els.stampRing) {
      const zoneWindow = perfectWindow();
      els.stampRing.style.setProperty("--zone-start", `${(0.5 - zoneWindow / 2).toFixed(4)}turn`);
      els.stampRing.style.setProperty("--zone-size", `${zoneWindow.toFixed(4)}turn`);
    }
    els.stampBtn.setAttribute(
      "aria-label",
      `盖戳寄信。等小圆点转进底部的金色弧线再盖是完美三倍；当前每戳 ${formatGain(currentClick)}张邮票`
    );
    const quickClick = baseClickPower() * comboMultiplier() * 1.5;
    els.quickStampBtn.setAttribute(
      "aria-label",
      `快捷盖戳，固定不错 ×1.5，获得 ${formatGain(quickClick)}张邮票`
    );

    setText(els.quickStamps, formatNumber(Math.floor(state.stamps)));
    setText(els.quickRate, `+${formatRate(rate)}/秒`);
    setText(els.quickGain, `+${formatGain(quickClick)}`);

    updateBellUi();
    updateTabBadges();
    if (activeTab === "posties") refreshShopUi();
    else if (activeTab === "orders") refreshOrdersUi();
    else if (activeTab === "dispatch") refreshDispatchUi();
    else if (activeTab === "upgrades") refreshUpgradeUi();
    else if (activeTab === "album") refreshAlbumUi();
    else refreshMoonUi();
  }

  function syncBuySwitch() {
    els.buySwitch.querySelectorAll("[data-amount]").forEach((button) => {
      const selected = Number(button.dataset.amount) === state.buyAmount;
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  let hiddenAt = 0;

  function spawnFloatText(container, leftPercent, topPercent, text, extraClass = "") {
    if (!container) return;
    const node = document.createElement("span");
    node.className = `floater${extraClass ? ` ${extraClass}` : ""}`;
    node.textContent = text;
    node.style.left = `${leftPercent}%`;
    node.style.top = `${topPercent}%`;
    node.style.setProperty("--dx", `${Math.round(Math.random() * 46 - 23)}px`);
    container.appendChild(node);
    window.setTimeout(() => node.remove(), 900);
  }

  function spawnBurst(container, leftPercent, topPercent, count = 6) {
    if (!container || prefersReducedMotion) return;
    const colors = [
      "var(--butter)",
      "var(--berry-light)",
      "var(--paper)",
      "var(--moss-light)"
    ];
    for (let index = 0; index < count; index += 1) {
      const node = document.createElement("span");
      node.className = `spark${index % 4 === 0 ? " leaf" : ""}`;
      node.style.left = `${leftPercent + (Math.random() * 12 - 6)}%`;
      node.style.top = `${topPercent + (Math.random() * 12 - 6)}%`;
      node.style.setProperty("--sx", `${Math.round(Math.random() * 110 - 55)}px`);
      node.style.setProperty("--sy", `${Math.round(-30 - Math.random() * 72)}px`);
      node.style.setProperty("--size", `${Math.round(4 + Math.random() * 5)}px`);
      node.style.setProperty("--spark-color", colors[index % colors.length]);
      container.appendChild(node);
      window.setTimeout(() => node.remove(), 700);
    }
  }

  function handleStampClick(forcedQuality) {
    if (!state) return;
    const now = performance.now();
    let quality = stampQualityFor(now, forcedQuality);
    if (quality === "miss" && state.clicks < 3 && !forcedQuality) quality = "good";
    const rewardMultiplier = qualityMultiplier(quality);
    stampAnchor = now;

    const gain = baseClickPower() * comboMultiplier() * rewardMultiplier;
    addStamps(gain);
    state.clicks += 1;

    if (quality === "miss") {
      combo = 0;
      comboTimer = 0;
    } else {
      const step = quality === "perfect" ? 2 : 1;
      combo = Math.min(40, combo + step);
      state.bestCombo = Math.max(state.bestCombo, combo);
      comboTimer = quality === "perfect" ? 2.1 : 1.55;
    }

    if (quality === "perfect") {
      state.perfects += 1;
      state.perfects = Math.min(MAX_SAFE_STATE, state.perfects);
      addInk((1 + (hasNode("busy2") ? 1 : 0)) * inkMultiplier());
      bumpOrders("perfects", 1);
    }

    bumpOrders("clicks", 1);
    if (quality !== "miss") bumpOrders("combo", combo);

    const label = quality === "perfect"
      ? (prefersReducedMotion ? "完美 ×1.5" : "完美 ×3")
      : quality === "good" ? "不错 ×1.5" : "差一点";
    if (els.stampQuality) {
      els.stampQuality.textContent = `${label} · +${formatGain(gain)} 邮票`;
      els.stampQuality.dataset.quality = quality;
    }
    els.stampBtn.parentElement?.classList.toggle("is-perfect", quality === "perfect");
    if (quality === "perfect") {
      window.setTimeout(() => els.stampBtn.parentElement?.classList.remove("is-perfect"), 360);
    }

    spawnFloatText(
      els.floaters,
      35 + Math.random() * 30,
      22 + Math.random() * 18,
      quality === "miss" ? `+${formatGain(gain)}` : `${quality === "perfect" ? "完美 +" : "+"}${formatGain(gain)}`
    );
    spawnBurst(els.floaters, 50, 44, 4 + Math.min(4, Math.floor(combo / 10)));
    if (quality === "perfect") {
      playPerfectSound();
    } else {
      playClickSound();
    }
    updateGoals();
    refreshLive();
    lastUiAt = performance.now();
  }

  function buyGenerator(id) {
    if (!state) return;
    const gen = GENERATORS.find((candidate) => candidate.id === id);
    if (!gen) return;
    const amount = state.buyAmount;
    const cost = generatorCost(gen, amount);

    if (!isGeneratorUnlocked(gen) || !canAfford(cost)) {
      playDenySound();
      return;
    }

    const beforeOwned = state.gens[id] || 0;
    state.stamps -= cost;
    state.gens[id] = (state.gens[id] || 0) + amount;
    state.boughtTotal[id] = (state.boughtTotal[id] || 0) + amount;
    const afterOwned = state.gens[id];
    const reachedMilestones = gen.milestones.filter(
      (milestone) => beforeOwned < milestone.count && afterOwned >= milestone.count
    );
    const reachedMilestone = reachedMilestones[reachedMilestones.length - 1];

    const ui = shopUi.get(id);
    if (ui) {
      ui.row.classList.remove("is-bought");
      void ui.row.offsetWidth;
      ui.row.classList.add("is-bought");
      window.setTimeout(() => ui.row.classList.remove("is-bought"), 380);
    }

    playBuySound();
    updateGoals();
    saveGame();
    refreshLive();
    lastUiAt = performance.now();

    if (reachedMilestone) {
      playTone(659.25, { start: 0.08, duration: 0.16, volume: 0.018, type: "sine" });
      playTone(987.77, { start: 0.17, duration: 0.2, volume: 0.016, type: "sine" });
      showToast(
        `「${gen.name}」达到 ${reachedMilestone.count} 位，线路产出升到 ×${reachedMilestone.mult}。`,
        4200
      );
    }
  }

  function buyUpgrade(id, restoreFocus = false) {
    if (!state) return;
    const upgrade = UPGRADES.find((candidate) => candidate.id === id);
    if (!upgrade || ownedUpgradeSet.has(id)) return;
    if (!isUpgradeUnlocked(upgrade) || !canAfford(upgrade.cost)) {
      playDenySound();
      return;
    }

    state.stamps -= upgrade.cost;
    state.upgrades.push(id);
    ownedUpgradeSet.add(id);

    playUpgradeSound();
    updateGoals();
    saveGame();
    buildUpgradePanel();
    refreshUpgradeUi();
    refreshLive();
    lastUiAt = performance.now();
    if (restoreFocus) {
      const nextButton = els.panelBody.querySelector(".buy-btn:not(:disabled)");
      if (nextButton) {
        nextButton.focus({ preventScroll: true });
      } else {
        const tab = els.tabs.find((candidate) => candidate.dataset.tab === "upgrades");
        if (tab) tab.focus({ preventScroll: true });
      }
    }
    showToast(`「${upgrade.name}」已经盖进邮册，永久生效。`, 3200);
  }

  function buyMaterialUpgrade(id) {
    if (!state) return;
    const item = MATERIAL_UPGRADES.find((candidate) => candidate.id === id);
    if (!item || hasMaterialUpgrade(id)) return;
    if ((state.materials[item.material] || 0) < item.cost) {
      playDenySound();
      return;
    }
    state.materials[item.material] -= item.cost;
    state.materialUpgrades.push(id);
    playUpgradeSound();
    saveGame();
    buildUpgradePanel();
    refreshLive();
    showToast(`「${item.name}」建好了，下一趟远行就会生效。`, 3400);
  }

  function scheduleGolden(minSeconds = 55, maxSeconds = 105) {
    window.clearTimeout(goldenScheduleTimeout);
    const wait = (minSeconds + Math.random() * Math.max(0, maxSeconds - minSeconds)) * 1000;
    goldenScheduleTimeout = window.setTimeout(showGoldenLetter, wait);
  }

  function showGoldenLetter() {
    if (!state) return;
    if (document.hidden) {
      scheduleGolden(15, 25);
      return;
    }
    if (goldenVisible) return;

    goldenVisible = true;
    const left = 9 + Math.random() * 60;
    const top = 18 + Math.random() * 38;
    els.goldenLetter.style.left = `${left.toFixed(1)}%`;
    els.goldenLetter.style.top = `${top.toFixed(1)}%`;
    els.goldenLetter.style.setProperty("--tilt", `${(Math.random() * 16 - 8).toFixed(1)}deg`);
    els.goldenLetter.hidden = false;

    window.clearTimeout(goldenHideTimeout);
    goldenHideTimeout = window.setTimeout(() => {
      if (!goldenVisible) return;
      hideGoldenLetter();
      scheduleGolden(80, 150);
    }, 12000);
  }

  function hideGoldenLetter() {
    window.clearTimeout(goldenHideTimeout);
    goldenVisible = false;
    els.goldenLetter.hidden = true;
  }

  function collectGoldenLetter() {
    if (!state || !goldenVisible) return;
    const bonus = Math.max(
      20,
      Math.round(baseRate() * 25 + baseClickPower() * 12)
    );
    const left = parseFloat(els.goldenLetter.style.left) || 50;
    const top = parseFloat(els.goldenLetter.style.top) || 35;

    addStamps(bonus);
    state.goldenLetters += 1;
    bumpOrders("golden", 1);
    hideGoldenLetter();
    spawnFloatText(els.sceneSparks, left + 5, top + 4, `+${formatNumber(bonus)} 邮票`, "scene-floater");
    spawnBurst(els.sceneSparks, left + 6, top + 6, 10);
    playGoldenSound();
    updateGoals();
    refreshLive();
    saveGame();
    scheduleGolden(80, 150);
    showToast(`拆开闪光的信，找到 ${formatNumber(bonus)}张邮票。`, 3800);
  }

  function useBell() {
    if (!state) return;
    const now = Date.now();
    if (now < state.bellActiveUntil) {
      playDenySound();
      return;
    }
    if (now < state.bellReadyAt) {
      playDenySound();
      const wait = Math.ceil((state.bellReadyAt - now) / 1000);
      showToast(`风铃还在休息，再过 ${wait} 秒。`, 2200);
      return;
    }

    state.bellActiveUntil = now + BELL_ACTIVE_SECONDS * 1000;
    state.bellReadyAt = now + BELL_COOLDOWN_SECONDS * 1000;
    state.bellUses += 1;
    bumpOrders("bell", 1);

    updateGoals();
    updateBellUi(now);
    refreshLive();
    saveGame();
    playBellSound();
    els.bellBtn.classList.remove("is-ringing");
    void els.bellBtn.offsetWidth;
    els.bellBtn.classList.add("is-ringing");
    window.setTimeout(() => els.bellBtn.classList.remove("is-ringing"), 800);
    showToast(`风铃响了：${BELL_ACTIVE_SECONDS} 秒内全邮局产出 ×3。`, 3400);
  }

  function openModal(options) {
    modalAction = typeof options.action === "function" ? options.action : null;
    modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    els.modalTitle.textContent = options.title;
    const kicker = els.modal.querySelector(".modal-kicker");
    if (kicker) kicker.textContent = options.kicker || "苔藓邮局 · 通知";
    els.modalBody.innerHTML = options.body;
    els.modalConfirm.textContent = options.confirmLabel || "确定";
    els.modalConfirm.className = `primary-btn${options.tone === "danger" ? " danger-btn" : ""}`;
    els.modalConfirm.disabled = false;
    els.modalCancel.textContent = options.cancelLabel || "再想想";
    els.modalCancel.hidden = options.showCancel === false;
    const actions = els.modal.querySelector(".modal-actions");
    if (actions) actions.hidden = options.footer === false;
    const card = els.modal.querySelector(".modal-card");
    if (card) card.classList.toggle("is-wide", options.wide === true);
    els.modal.hidden = false;
    document.body.style.overflow = "hidden";

    const dialog = els.modal.querySelector(".modal-card");
    window.setTimeout(() => {
      if (!dialog) return;
      dialog.scrollTop = 0;
      dialog.focus({ preventScroll: true });
    }, 30);
  }

  function closeModal() {
    if (els.modal.hidden) return;
    els.modal.hidden = true;
    document.body.style.overflow = "";
    modalAction = null;
    eventOpen = false;
    activeEvent = null;
    const actions = els.modal.querySelector(".modal-actions");
    if (actions) actions.hidden = false;
    const card = els.modal.querySelector(".modal-card");
    if (card) card.classList.remove("is-wide");
    if (state && activeTab === "dispatch") buildDispatchPanel();
    if (modalReturnFocus && document.contains(modalReturnFocus)) {
      modalReturnFocus.focus();
    }
    modalReturnFocus = null;
  }

  function handleModalKeydown(event) {
    if (els.modal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      els.modal.querySelectorAll("button:not([disabled])")
    ).filter((element) => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const dialog = els.modal.querySelector(".modal-card");

    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openHelpModal() {
    openModal({
      title: "怎么经营一间苔藓邮局",
      showCancel: false,
      confirmLabel: "知道啦",
      body: `
        <p>点击大蜡封寄出一封信，邮票就是这间邮局的心跳。</p>
        <ol class="modal-list">
          <li><b>1</b><span>盖戳时，等小圆点转进底部的金色弧线内再点：完美 ×3，并得到 1 枚墨点。连击越高，圆点转得越快。</span></li>
          <li><b>2</b><span>同一线路的小邮差达到 10、25、50 位时，会触发线路里程碑，产出变为 ×1.5、×2、×2.5。</span></li>
          <li><b>3</b><span>苔藓镇每两分半换一次天气，会给不同线路或蜡封盖戳带来额外倍率。</span></li>
          <li><b>4</b><span>手边的风铃每 90 秒能摇一次，摇响后 20 秒内全邮局产出 ×3；有些来信要求整单不摇铃。</span></li>
          <li><b>5</b><span>邮路柜台能同时派两位邮差出门，月光树还能再加一位。短程回信快，远程带回来的邮票更多；每完成 3 趟，熟练度升一级。</span></li>
          <li><b>6</b><span>柜台来信有条件和时限，完成给邮票和墨点；每完成 4 封，夜班邮车会留下 1 枚月光邮戳。</span></li>
          <li><b>7</b><span>墨点可以换一批来信，也能让在途的邮路立刻回来。它来自完美盖戳和柜台来信。</span></li>
          <li><b>8</b><span>攒够 30,000 张邮票，夜班邮车会带来月光邮戳。用邮戳点亮月光树：每 1 点全局 +10%，节点永久保留；每程还能选一个夜班契约。</span></li>
          <li><b>9</b><span>集邮册会记录特别的小事。每贴上一枚纪念邮票，所有产出永久再多一点。</span></li>
          <li><b>10</b><span>偶尔会飘来闪光的信。离开时小邮差仍会送信，收益默认按一半计算，最多两小时；月光树能延长它。</span></li>
          <li><b>11</b><span>邮册会自动合上并保存。手机端底部的快捷蜡封固定算“不错 ×1.5”，不参与完美判定。</span></li>
          <li><b>12</b><span>邮路还能延伸到雾湖之外：随机地图、邮差牌、信件与干粮。失败只丢这一趟，奖励和月光邮戳会回流邮局。</span></li>
        </ol>`
    });
  }

  function openResetModal() {
    openModal({
      title: "重新开张？",
      tone: "danger",
      confirmLabel: "全部重置",
      body: `
        <p>这一程的邮票、小邮差、工坊邮戳、风铃、邮路、柜台来信、远行、月光树、墨点和集邮册都会一起被收走，在途的邮差也会回来。</p>
        <p>苔藓镇会回到第一天。确定要重新开张吗？</p>`,
      action: resetGame
    });
  }

  function openPrestigeModal() {
    if (!state) return;
    const gain = currentMoonGain();
    if (gain < 1) return;
    openModal({
      title: "让夜班邮车出发？",
      confirmLabel: "发车",
      body: `
        <p>夜班邮车会收走这一程的 <b>${formatNumber(state.stamps)}</b>张邮票、所有小邮差、工坊邮戳和手上的来信。</p>
        <p>你会留下 <b>${gain} 枚月光邮戳</b>，可以去月光树点一盏灯。集邮册、邮路熟练度、墨点和在途的邮差都会留到下一程；夜班契约会清空，下程重新选。</p>`,
      action: performPrestige
    });
  }

  function performPrestige() {
    if (!state) return;
    const gained = currentMoonGain();
    if (gained < 1) return;

    state.moonStamps += gained;
    state.stamps = 0;
    state.runEarned = 0;
    state.gens = Object.fromEntries(GENERATORS.map((gen) => [gen.id, 0]));
    state.upgrades = [];
    state.bellActiveUntil = 0;
    state.bellReadyAt = 0;
    state.contract = "";
    state.accepted = [];
    ownedUpgradeSet = new Set();
    combo = 0;
    comboTimer = 0;
    stampAnchor = performance.now();
    ensureOffers();

    updateGoals();
    saveGame();
    switchTab("posties");
    refreshLive();
    hideGoldenLetter();
    scheduleGolden(55, 110);
    playPrestigeSound();
    showToast(
      `夜班邮车带回了 ${gained} 枚月光邮戳。月光明亮了一点。`,
      6200
    );
  }

  function resetGame() {
    if (!state) return;
    const keepSound = state.sound;
    state = createInitialState(keepSound);
    ownedUpgradeSet = new Set();
    achievementSet = new Set();
    goalsDoneSet = new Set();
    unseenAchievements = 0;
    combo = 0;
    comboTimer = 0;
    stampAnchor = performance.now();
    nextEventAt = Date.now() + 90_000 + Math.random() * 90_000;
    ensureOffers();
    applyWeatherUi();
    syncBuySwitch();
    refreshSoundButton();
    updateGoals();
    switchTab("posties");
    refreshLive();
    hideGoldenLetter();
    scheduleGolden(55, 110);
    saveGame();
    lastUiAt = performance.now();
    showToast("邮局重新开张了。今天的风也是新的。", 4200);
  }

  function toggleSound() {
    if (!state) return;
    state.sound = !state.sound;
    refreshSoundButton();
    if (state.sound) {
      playTone(659.25, { duration: 0.1, volume: 0.02, type: "triangle" });
      playTone(880, { start: 0.07, duration: 0.12, volume: 0.018, type: "triangle" });
    }
    saveGame();
  }

  // ---------- account + cloud save ----------

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function cloudBase() {
    return account ? account.base : accountBaseDraft;
  }

  function applyRemoteSave(payload) {
    suppressSaves = true;
    writeSave(payload);
    window.location.reload();
  }

  function cloudErrorMessage(error) {
    const code = error && error.payload && error.payload.error;
    if (code === "username_taken") return "这个用户名已经被用掉了。";
    if (code === "invalid_credentials") return "用户名或密码不对。";
    if (code === "unauthorized") return "登录已过期，请重新登录。";
    if (error && error.status === 0) return "连不上邮局服务器，检查地址或网络。";
    if (error && /postcard limit/i.test(error.message || "")) {
      return "今天已经寄了 5 张明信片，明天再来。";
    }
    if (error && /already friends/i.test(error.message || "")) {
      return "你们已经是好友了。";
    }
    if (error && /request already pending/i.test(error.message || "")) {
      return "已经发过申请了，等对方接受。";
    }
    if (error && /invalid friend code/i.test(error.message || "")) {
      return "好友码是 6 位。";
    }
    if (error && /friend code/i.test(error.message || "")) {
      return "没有找到这个好友码，再核对一下。";
    }
    return (error && error.message) || "操作失败，请稍后再试。";
  }

  function cloudStatusText() {
    if (!account || !account.token) return "未登录。";
    if (account.conflict) return `云端有更新（修订 ${account.conflict}），请选择保留哪一份。`;
    if (cloudPushing) return "正在同步…";
    if (account.dirty) return "有未同步的改动，稍后自动上传。";
    return `已同步，服务器修订 ${account.revision}。`;
  }

  function refreshAccountButton() {
    if (!els.accountBtn || !els.accountLabel) return;
    const loggedIn = Boolean(account && account.token);
    setText(els.accountLabel, loggedIn ? account.username : "登录");
    els.accountBtn.classList.toggle("has-account", loggedIn);
    els.accountBtn.classList.toggle("has-conflict", Boolean(account && account.conflict));
    els.accountBtn.setAttribute(
      "aria-label",
      loggedIn ? `账号 ${account.username}，${cloudStatusText()}` : "登录或注册"
    );
    updateTownButton();
  }

  function accountModalMarkup() {
    if (!account || !account.token) {
      const localNote = state ? `本机累计 ${formatNumber(state.totalEarned)} 张邮票` : "";
      return `
        <div class="account-box">
          <div class="account-tabs" role="tablist" aria-label="登录或注册">
            <button class="account-tab${accountMode === "login" ? " is-active" : ""}" type="button" role="tab" aria-selected="${accountMode === "login"}" data-account-mode="login">登录</button>
            <button class="account-tab${accountMode === "register" ? " is-active" : ""}" type="button" role="tab" aria-selected="${accountMode === "register"}" data-account-mode="register">注册</button>
          </div>
          <p class="account-copy">${accountMode === "register"
            ? "注册时会把浏览器里的本地存档一起上传；之后换设备登录，就能接着这一程送信。"
            : "登录后以服务器上的存档为准，本机进度会被服务器覆盖。"}</p>
          <label class="account-field"><span>用户名</span>
            <input id="accountUser" autocomplete="username" maxlength="24" placeholder="3-24 个字符">
          </label>
          <label class="account-field"><span>密码</span>
            <input id="accountPass" type="password" autocomplete="${accountMode === "register" ? "new-password" : "current-password"}" maxlength="128" placeholder="至少 8 位">
          </label>
          <label class="account-field"><span>服务器</span>
            <input id="accountBase" value="${escapeHtml(cloudBase())}" placeholder="http://127.0.0.1:17322">
          </label>
          <p class="account-status" id="accountStatus">${escapeHtml(localNote)}</p>
          <button class="primary-btn account-submit" type="button" data-account-submit>${accountMode === "register" ? "注册并上传存档" : "登录"}</button>
          <p class="account-hint">密码不会离开浏览器：登录用一次性挑战，服务器只存派生校验值。HTTP 下仍请勿复用重要密码。</p>
        </div>`;
    }

    return `
      <div class="account-box">
        <p class="account-user">已登录 <b>${escapeHtml(account.username)}</b></p>
        <p class="account-status" id="accountStatus">${escapeHtml(cloudStatusText())}</p>
        ${account.conflict ? `
          <div class="account-conflict">
            <p>云端存档比本机新（修订 ${account.conflict}）。选一份保留：</p>
            <div class="account-actions">
              <button class="primary-btn" type="button" data-account-pull>用云端覆盖本地</button>
              <button class="secondary-btn" type="button" data-account-push>上传本地覆盖云端</button>
            </div>
          </div>` : ""}
        <div class="account-actions">
          <button class="primary-btn" type="button" data-account-sync ${account.conflict ? "disabled" : ""}>立即同步</button>
          <button class="secondary-btn" type="button" data-account-logout>退出登录</button>
        </div>
        <p class="account-hint">服务器 ${escapeHtml(account.base)} · 修订 ${account.revision}</p>
      </div>`;
  }

  function setAccountStatus(text) {
    const element = document.getElementById("accountStatus");
    if (element) setText(element, text);
  }

  function renderAccountModal() {
    if (!els.modal || els.modal.hidden) return;
    if (!els.modalBody.querySelector(".account-box")) return;
    els.modalBody.innerHTML = accountModalMarkup();
  }

  function openAccountModal() {
    accountMode = "login";
    openModal({
      title: "账号与云存档",
      body: accountModalMarkup(),
      footer: false,
      kicker: "苔藓邮局 · 云端"
    });
  }

  function scheduleCloudPush(delay = 2500) {
    if (!account || !account.token || account.conflict) return;
    account.dirty = true;
    cloudApi.saveAccount(account);
    refreshAccountButton();
    clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(() => {
      cloudPushNow();
    }, delay);
  }

  async function cloudPushNow() {
    if (!account || !account.token || cloudPushing || !state) return;
    if (account.conflict) {
      showToast("云端有更新，先在账号里选一份保留。", 4200);
      return;
    }
    cloudPushing = true;
    refreshAccountButton();
    if (els.modalBody.querySelector(".account-box")) renderAccountModal();
    try {
      const result = await cloudApi.push(account, state);
      account.revision = Number(result && result.revision) || account.revision + 1;
      account.dirty = false;
      account.conflict = 0;
      cloudApi.saveAccount(account);
    } catch (error) {
      if (error.status === 401) {
        account.token = "";
        cloudApi.saveAccount(account);
        showToast("登录已过期，请重新登录。", 5000);
      } else if (error.status === 409) {
        account.conflict =
          Number(error.payload && error.payload.revision) || account.revision + 1;
        account.dirty = true;
        cloudApi.saveAccount(account);
        showToast("云端也有新进度，打开账号选择保留哪一份。", 5200);
      } else {
        showToast("云同步失败，稍后会再试。", 3600);
      }
    } finally {
      cloudPushing = false;
      refreshAccountButton();
      if (els.modalBody.querySelector(".account-box")) renderAccountModal();
    }
  }

  function initCloud() {
    account = cloudApi.loadAccount();
    if (account) accountBaseDraft = account.base;
    refreshAccountButton();
    if (account && account.token) {
      setTimeout(() => {
        cloudBootstrap();
      }, 800);
    }
  }

  async function cloudBootstrap() {
    if (!account || !account.token || !state) return;
    try {
      const info = await cloudApi.me(account);
      if (info && info.username) account.username = info.username;
      const remote = await cloudApi.pull(account);
      if (!remote) {
        account.revision = 0;
        account.dirty = true;
        cloudApi.saveAccount(account);
        scheduleCloudPush(500);
        return;
      }
      if (remote.revision > account.revision) {
        if (account.dirty) {
          account.conflict = remote.revision;
          cloudApi.saveAccount(account);
          refreshAccountButton();
          showToast("云端有更新的存档，打开账号选择保留哪一份。", 6000);
          return;
        }
        account.revision = remote.revision;
        account.dirty = false;
        account.conflict = 0;
        cloudApi.saveAccount(account);
        applyRemoteSave(remote.payload);
        return;
      }
      if (remote.revision < account.revision) {
        account.revision = remote.revision;
        account.dirty = true;
        cloudApi.saveAccount(account);
        scheduleCloudPush(500);
        return;
      }
      if (account.dirty) scheduleCloudPush(500);
    } catch (error) {
      if (error.status === 401) {
        account.token = "";
        cloudApi.saveAccount(account);
        refreshAccountButton();
        showToast("登录已过期，请重新登录。", 5000);
      }
    }
  }

  async function submitAccount() {
    const userInput = document.getElementById("accountUser");
    const passInput = document.getElementById("accountPass");
    const baseInput = document.getElementById("accountBase");
    if (!userInput || !passInput) return;

    const username = userInput.value.trim();
    const password = passInput.value;
    const base = (baseInput && baseInput.value.trim()) || accountBaseDraft;
    accountBaseDraft = base;

    if (username.length < 3 || username.length > 24) {
      setAccountStatus("用户名需要 3-24 个字符。");
      return;
    }
    if (password.length < 8) {
      setAccountStatus("密码至少 8 位。");
      return;
    }

    const submit = document.querySelector("[data-account-submit]");
    if (submit) submit.disabled = true;
    setAccountStatus("正在生成登录凭据…");

    try {
      const verifier = await deriveVerifier(username, password);
      setAccountStatus(
        accountMode === "register" ? "正在注册并上传本地存档…" : "正在获取登录挑战…"
      );

      if (accountMode === "register") {
        const result = await cloudApi.register({
          base,
          username,
          verifier,
          save: state
        });
        account = {
          base,
          token: result.token,
          userId: result.user_id,
          username: result.username,
          revision: Number(result.save_revision) || 0,
          dirty: false,
          conflict: 0
        };
        cloudApi.saveAccount(account);
        refreshAccountButton();
        renderAccountModal();
        showToast("账号建好了，本地存档已经一起寄上去。", 4600);
        return;
      }

      const loginChallenge = await cloudApi.challenge({ base, username });
      setAccountStatus("正在登录…");
      const result = await cloudApi.login({
        base,
        username,
        nonce: loginChallenge.nonce,
        proof: proveVerifier(verifier, loginChallenge.nonce)
      });
      const pending = {
        base,
        token: result.token,
        userId: result.user_id,
        username: result.username,
        revision: Number(result.save_revision) || 0,
        dirty: false,
        conflict: 0
      };
      const remote = await cloudApi.pull(pending);
      if (remote) {
        pending.revision = remote.revision;
        cloudApi.saveAccount(pending);
        applyRemoteSave(remote.payload);
        return;
      }

      account = pending;
      account.revision = 0;
      account.dirty = true;
      cloudApi.saveAccount(account);
      const pushed = await cloudApi.push(account, state);
      account.revision = Number(pushed && pushed.revision) || 1;
      account.dirty = false;
      cloudApi.saveAccount(account);
      refreshAccountButton();
      renderAccountModal();
      showToast("服务器上还没有存档，已把本地存档传上去。", 4600);
    } catch (error) {
      setAccountStatus(cloudErrorMessage(error));
      if (submit && submit.isConnected) submit.disabled = false;
    }
  }

  async function accountLogout() {
    const current = account;
    account = null;
    townData = null;
    townUnread = 0;
    cloudApi.clearAccount();
    refreshAccountButton();
    closeModal();
    if (current && current.token) {
      cloudApi.logout(current).catch(() => {});
    }
    showToast("已退出账号，本机存档还在。", 3600);
  }

  async function accountPullOverride() {
    if (!account || !account.token) return;
    setAccountStatus("正在读取云端存档…");
    try {
      const remote = await cloudApi.pull(account);
      if (!remote) {
        setAccountStatus("云端没有存档。");
        return;
      }
      account.revision = remote.revision;
      account.dirty = false;
      account.conflict = 0;
      cloudApi.saveAccount(account);
      applyRemoteSave(remote.payload);
    } catch (error) {
      setAccountStatus(cloudErrorMessage(error));
    }
  }

  async function accountPushOverride() {
    if (!account || !account.token) return;
    account.revision = account.conflict || account.revision;
    account.conflict = 0;
    account.dirty = true;
    cloudApi.saveAccount(account);
    await cloudPushNow();
  }

  // ---------- town square + postcards ----------

  function townTime(seconds) {
    if (!seconds) return "刚刚";
    const diff = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
    if (diff < 60) return "刚刚";
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86_400) return `${Math.floor(diff / 3600)} 小时前`;
    return `${Math.floor(diff / 86_400)} 天前`;
  }

  function giftLabel(kind, amount) {
    if (kind === "ink") return `墨点×${amount}`;
    if (kind === "stamps") return `邮票×${formatNumber(amount)}`;
    if (EXP_MATERIALS[kind]) return `${EXP_MATERIALS[kind].name}×${amount}`;
    return `${kind}×${amount}`;
  }

  function updateTownButton() {
    if (els.townDot) els.townDot.hidden = townUnread <= 0;
    if (els.townBtn) {
      els.townBtn.classList.toggle("has-mail", townUnread > 0);
      els.townBtn.setAttribute(
        "aria-label",
        townUnread > 0 ? `镇口，有 ${townUnread} 封没拆的明信片` : "镇口"
      );
    }
  }

  function townLoggedOutMarkup() {
    return `
      <div class="town-box">
        <p class="town-lead">镇口今天也有邮差路过。登录之后，可以看到镇上的邮差，也能互寄明信片。</p>
        <div class="town-empty">
          <p>还没有登录。</p>
          <button class="primary-btn" type="button" data-town-login>去登录</button>
        </div>
      </div>`;
  }

  function townLoadingMarkup() {
    return `
      <div class="town-box">
        <div class="town-loading">正在打开镇口…</div>
      </div>`;
  }

  function townMarkup() {
    if (!account || !account.token) return townLoggedOutMarkup();
    if (townLoading) return townLoadingMarkup();
    if (townError) {
      return `
        <div class="town-box">
          <p class="town-lead">${escapeHtml(townError)}</p>
          <button class="primary-btn" type="button" data-town-refresh>再试一次</button>
        </div>`;
    }
    if (!townData) return townLoadingMarkup();

    const cards = townData.cards || [];
    const players = townData.players || [];
    const friendData = townData.friends || {
      code: "",
      friends: [],
      incoming: [],
      outgoing: []
    };
    const friendCode = friendData.code || "------";
    const friendList = friendData.friends || [];
    const incoming = friendData.incoming || [];
    const outgoing = friendData.outgoing || [];
    const friendSection = `
      <section class="town-section town-friends">
        <div class="tree-head"><span>好友</span><span>${friendList.length} 位</span></div>
        <div class="friend-code-row">
          <span>我的好友码</span>
          <b>${escapeHtml(friendCode)}</b>
          <button class="link-btn" type="button" data-copy-friend-code>复制</button>
        </div>
        <div class="friend-add-row">
          <input id="friendCodeInput" maxlength="6" autocomplete="off" placeholder="输入 6 位好友码">
          <button class="primary-btn friend-add-btn" type="button" data-friend-add>加好友</button>
        </div>
        <p class="account-status" id="friendStatus"></p>
        ${incoming.length
          ? `<div class="friend-requests">${incoming.map((request) => `
              <div class="friend-request">
                <div><b>${escapeHtml(request.from_name)}</b><small>想加你为好友 · ${townTime(request.created_at)}</small></div>
                <div class="friend-request-actions">
                  <button class="link-btn" type="button" data-accept-friend="${request.id}">接受</button>
                  <button class="link-btn" type="button" data-decline-friend="${request.id}">忽略</button>
                </div>
              </div>`).join("")}</div>`
          : ""}
        ${outgoing.length
          ? `<p class="friend-note">已申请：${outgoing.map((request) => escapeHtml(request.to_name)).join("、")}，等对方接受。</p>`
          : ""}
        ${friendList.length
          ? `<div class="friend-list">${friendList.map((friend) => `
              <div class="friend-row">
                <div class="friend-copy">
                  <b>${escapeHtml(friend.username)}</b>
                  <small>${formatNumber(friend.total_stamps)} 邮票 · ${formatNumber(friend.expedition_wins)} 趟远行 · ${townTime(friend.last_active)}</small>
                </div>
                <div class="friend-actions">
                  <button class="link-btn" type="button" data-send-postcard="${escapeHtml(friend.id)}" data-send-kind="user" data-send-name="${escapeHtml(friend.username)}">寄明信片</button>
                  <button class="link-btn" type="button" data-friend-profile="${escapeHtml(friend.id)}">串门</button>
                  <button class="link-btn" type="button" data-remove-friend="${escapeHtml(friend.id)}">删除</button>
                </div>
              </div>`).join("")}</div>`
          : `<div class="town-empty">还没有好友。把好友码发给朋友，或者在镇口找一位邮差。</div>`}
      </section>`;
    const mailbox = cards.length
      ? cards.map((card) => {
          const unclaimed = card.gift_kind && !card.claimed;
          return `
            <article class="town-mail-card${card.sender_kind === "bot" ? " is-bot" : ""}">
              <div class="town-mail-top">
                <b>${escapeHtml(card.sender)}</b>
                <span>${card.sender_kind === "bot" ? "镇上的邮差" : "路过的邮差"}</span>
              </div>
              <p>${escapeHtml(card.text)}</p>
              <div class="town-mail-foot">
                <small>${townTime(card.created_at)}</small>
                ${card.gift_kind
                  ? unclaimed
                    ? `<button class="link-btn" type="button" data-claim-postcard="${card.id}">收下 ${giftLabel(card.gift_kind, card.gift_amount)}</button>`
                    : `<span class="town-claimed">已收下 ${giftLabel(card.gift_kind, card.gift_amount)}</span>`
                  : ""}
              </div>
            </article>`;
        }).join("")
      : `<div class="town-empty">还没有明信片。去镇口找一位邮差聊聊吧。</div>`;

    const square = players.map((player) => {
      const self = account && player.id === account.userId;
      return `
        <article class="town-player${player.kind === "bot" ? " is-bot" : ""}">
          <div class="town-player-copy">
            <div class="town-player-name">
              <b>${escapeHtml(player.name)}</b>
              ${player.kind === "bot" ? `<span class="town-npc">NPC</span>` : ""}
              ${self ? `<span class="town-self">我</span>` : ""}
            </div>
            <small>${escapeHtml(player.bio || (player.kind === "bot" ? "镇上的老邮差。" : "路过的邮差。"))}</small>
          </div>
          <div class="town-player-stats">
            <span>${formatNumber(player.total_stamps)} 邮票</span>
            <span>${formatNumber(player.expedition_wins)} 趟远行</span>
          </div>
          <div class="town-player-actions">
            <small>${townTime(player.last_active)}</small>
            ${self ? "" : `<button class="link-btn" type="button" data-send-postcard="${escapeHtml(player.id)}" data-send-kind="${player.kind}" data-send-name="${escapeHtml(player.name)}">寄明信片</button>`}
          </div>
        </article>`;
    }).join("");

    return `
      <div class="town-box">
        <div class="town-head">
          <p class="town-lead">镇口的邮差会互寄明信片。真人玩家和 NPC 都会回信，每天最多寄 5 张。</p>
          <button class="link-btn" type="button" data-town-refresh>刷新</button>
        </div>
        ${friendSection}
        <section class="town-section">
          <div class="tree-head"><span>收到的明信片</span><span>${cards.length} 封</span></div>
          <div class="town-mail-list">${mailbox}</div>
        </section>
        <section class="town-section">
          <div class="tree-head"><span>镇上的邮差</span><span>按邮票排序</span></div>
          <div class="town-player-list">${square}</div>
        </section>
      </div>`;
  }

  function renderTownModal() {
    if (!els.modal || els.modal.hidden) return;
    if (!els.modalBody.querySelector(".town-box")) return;
    els.modalBody.innerHTML = townMarkup();
    updateTownButton();
  }

  async function loadTown() {
    if (!account || !account.token) {
      renderTownModal();
      return;
    }
    townLoading = true;
    townError = "";
    renderTownModal();
    try {
      const [square, mailbox, friendData] = await Promise.all([
        cloudApi.square(account),
        cloudApi.postcards(account),
        cloudApi.friends(account)
      ]);
      townData = {
        players: Array.isArray(square && square.players) ? square.players : [],
        cards: Array.isArray(mailbox && mailbox.cards) ? mailbox.cards : [],
        friends: friendData || { code: "", friends: [], incoming: [], outgoing: [] }
      };
      townUnread =
        townData.cards.filter((card) => card.gift_kind && !card.claimed).length +
        (townData.friends.incoming || []).length;
      townLoading = false;
      renderTownModal();
    } catch (error) {
      townLoading = false;
      if (error.status === 401) {
        account.token = "";
        cloudApi.saveAccount(account);
        refreshAccountButton();
      }
      townError = cloudErrorMessage(error);
      renderTownModal();
    }
  }

  function openTown() {
    if (!account || !account.token) {
      openModal({
        title: "镇口",
        body: townLoggedOutMarkup(),
        footer: false,
        kicker: "苔藓邮局 · 镇口"
      });
      return;
    }
    townData = null;
    townError = "";
    openModal({
      title: "镇口",
      body: townLoadingMarkup(),
      footer: false,
      kicker: "苔藓邮局 · 镇口"
    });
    loadTown();
  }

  function setFriendStatus(text) {
    const element = document.getElementById("friendStatus");
    if (element) setText(element, text);
  }

  async function copyFriendCode() {
    const code = townData && townData.friends && townData.friends.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showToast(`好友码 ${code} 已复制。`, 2800);
    } catch (error) {
      try {
        const area = document.createElement("textarea");
        area.value = code;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        showToast(`好友码 ${code} 已复制。`, 2800);
      } catch (fallbackError) {
        showToast(`好友码：${code}`, 4200);
      }
    }
  }

  async function addFriendByCode() {
    if (!account || !account.token) return;
    const input = document.getElementById("friendCodeInput");
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    if (code.length !== 6) {
      setFriendStatus("好友码是 6 位，字母和数字都可以。");
      return;
    }
    const button = document.querySelector("[data-friend-add]");
    if (button) button.disabled = true;
    setFriendStatus("正在送好友申请…");
    try {
      const result = await cloudApi.requestFriend(account, code);
      if (result && result.status === "friends") {
        showToast("你们已经是好友了。", 3200);
      } else {
        showToast("好友申请已经送出。", 3200);
      }
      await loadTown();
    } catch (error) {
      setFriendStatus(cloudErrorMessage(error));
      if (button && button.isConnected) button.disabled = false;
    }
  }

  async function acceptFriendRequest(id) {
    if (!account || !account.token) return;
    try {
      await cloudApi.acceptFriend(account, id);
      showToast("好友申请接受了。", 2800);
      await loadTown();
    } catch (error) {
      showToast(cloudErrorMessage(error), 3600);
    }
  }

  async function declineFriendRequest(id) {
    if (!account || !account.token) return;
    try {
      await cloudApi.declineFriend(account, id);
      await loadTown();
    } catch (error) {
      showToast(cloudErrorMessage(error), 3600);
    }
  }

  async function removeFriendById(id) {
    if (!account || !account.token) return;
    try {
      await cloudApi.removeFriend(account, id);
      showToast("已经从好友列表里移除了。", 2800);
      await loadTown();
    } catch (error) {
      showToast(cloudErrorMessage(error), 3600);
    }
  }

  async function openFriendProfile(id) {
    if (!account || !account.token) return;
    openModal({
      title: "串门",
      body: `<div class="town-box"><div class="town-loading">正在敲门…</div></div>`,
      footer: false,
      kicker: "镇口 · 好友"
    });
    try {
      const profile = await cloudApi.friendProfile(account, id);
      const friend = profile.friend || {};
      els.modalBody.innerHTML = `
        <div class="town-box">
          <div class="friend-profile">
            <p class="friend-profile-kicker">好友的邮局</p>
            <h4>${escapeHtml(friend.username || "一位邮差")}</h4>
            <p class="town-lead">好友码 ${escapeHtml(friend.friend_code || "------")}</p>
            <div class="friend-profile-stats">
              <span><b>${formatNumber(friend.total_stamps || 0)}</b> 邮票</span>
              <span><b>${formatNumber(friend.expedition_wins || 0)}</b> 趟远行</span>
              <span><b>${formatNumber(profile.postcards_received || 0)}</b> 张明信片</span>
            </div>
            <p class="town-lead">最后活跃：${townTime(friend.last_active || 0)}。</p>
          </div>
          <div class="exp-result-actions">
            <button class="exp-primary" type="button" data-send-postcard="${escapeHtml(friend.id || id)}" data-send-kind="user" data-send-name="${escapeHtml(friend.username || "好友")}">寄明信片</button>
            <button class="exp-secondary" type="button" data-friend-back>回镇口</button>
          </div>
        </div>`;
    } catch (error) {
      els.modalBody.innerHTML = `
        <div class="town-box">
          <p class="town-lead">${escapeHtml(cloudErrorMessage(error))}</p>
          <button class="primary-btn" type="button" data-friend-back>回镇口</button>
        </div>`;
    }
  }

  function openPostcardComposer(id, kind, name) {
    postcardTarget = { id, kind, name };
    openModal({
      title: `给 ${name} 寄明信片`,
      body: `
        <div class="town-composer">
          <p class="town-lead">挑一张明信片。对方会收到你的名字和这句话。</p>
          <div class="town-template-list">
            ${POSTCARD_TEMPLATES.map((template) => `
              <button class="town-template" type="button" data-postcard-template="${template.id}">
                ${template.text}
              </button>`).join("")}
          </div>
          <p class="account-status" id="postcardStatus"></p>
          <button class="link-btn" type="button" data-town-refresh>回镇口</button>
        </div>`,
      footer: false,
      kicker: "镇口 · 明信片"
    });
  }

  async function sendTownPostcard(templateId) {
    if (!postcardTarget || !account || !account.token) return;
    const status = document.getElementById("postcardStatus");
    document.querySelectorAll("[data-postcard-template]").forEach((button) => {
      button.disabled = true;
    });
    if (status) setText(status, "正在把明信片送出去…");
    try {
      const result = await cloudApi.sendPostcard(
        account,
        postcardTarget.id,
        postcardTarget.kind,
        templateId
      );
      const replied = Boolean(result && result.reply);
      showToast(replied ? "明信片寄到了，对方回了一张。" : "明信片已经寄到镇口。", 3600);
      postcardTarget = null;
      openTown();
    } catch (error) {
      if (status) setText(status, cloudErrorMessage(error));
      document.querySelectorAll("[data-postcard-template]").forEach((button) => {
        button.disabled = false;
      });
    }
  }

  function addPostcardToAlbum(card) {
    if (!card || card.sender_kind !== "bot") return { added: false, completed: false };
    if (!TOWN_BOTS.some((bot) => bot.id === card.sender_id)) {
      return { added: false, completed: false };
    }
    if (state.postcardAlbum.some((entry) => entry.senderId === card.sender_id)) {
      return { added: false, completed: false };
    }
    state.postcardAlbum.push({
      senderId: card.sender_id,
      senderName: card.sender,
      template: card.template,
      text: card.text,
      at: Date.now()
    });
    const complete = TOWN_BOTS.every((bot) =>
      state.postcardAlbum.some((entry) => entry.senderId === bot.id)
    );
    if (complete && !state.postcardAlbumReward) {
      state.postcardAlbumReward = true;
      state.moonStamps += 1;
      Object.keys(EXP_MATERIALS).forEach((id) => {
        state.materials[id] = Math.min(99, (state.materials[id] || 0) + 2);
      });
      return { added: true, completed: true };
    }
    return { added: true, completed: false };
  }

  async function claimTownPostcard(id) {

    if (!account || !account.token) return;
    try {
      const result = await cloudApi.claimPostcard(account, id);
      const kind = result && result.gift_kind;
      const amount = Number(result && result.gift_amount) || 0;
      if (kind === "ink") addInk(amount);
      else if (kind === "stamps") addStamps(amount);
      else if (EXP_MATERIALS[kind]) {
        state.materials[kind] = Math.min(99, (state.materials[kind] || 0) + amount);
      }
      const card = townData && townData.cards.find((candidate) => candidate.id === id);
      const album = addPostcardToAlbum(card);
      saveGame();
      refreshLive();
      if (album.completed) {
        showToast("集齐 8 位邮差的明信片：+1 月光邮戳，纸 / 蜡 / 布各 +2。", 6200);
      } else {
        showToast(
          `收下了 ${giftLabel(kind, amount)}${album.added ? "，明信片收进了邮册" : ""}。`,
          3600
        );
      }
      townUnread = Math.max(0, townUnread - 1);
      loadTown();
    } catch (error) {
      if (error.status === 404) {
        showToast("这张明信片已经收过了。", 2800);
        loadTown();
      } else {
        showToast(cloudErrorMessage(error), 3600);
      }
    }
  }

  function saveGame(options = {}) {
    if (!state) return;
    if (suppressSaves) return;
    if (options.markSeen !== false) state.lastSeen = Date.now();
    writeSave(state);
    scheduleCloudPush();
    try {
      if (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === "function") {
        window.claude.hot.snapshot({ game: state });
      }
    } catch (error) {
      /* The viewer hook is optional. */
    }

    if (els.saveNote) {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setText(els.saveNote, `已夹进邮册 · ${time}`);
    }
  }

  function grantAwayEarnings(seconds, options = {}) {
    if (!state || !Number.isFinite(seconds) || seconds <= 0) return;
    const cap = offlineCap();
    const capped = Math.min(seconds, cap);
    const gain = baseRate() * capped * offlineRate();
    if (gain < 1) return;

    addStamps(gain);
    updateGoals();
    refreshLive();
    if (options.announce === false) return;

    const when = options.source === "stall"
      ? `刚才的 ${formatDuration(seconds)}`
      : seconds > cap
        ? `你不在的 ${Math.round(cap / 3600)} 小时里`
        : `你离开的 ${formatDuration(seconds)}里`;
    showToast(`${when}，小邮差送出了 ${formatNumber(gain)}张邮票。`, 6600);
  }

  function handleTabKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = TAB_NAMES.indexOf(activeTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TAB_NAMES.length) % TAB_NAMES.length;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % TAB_NAMES.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TAB_NAMES.length - 1;

    switchTab(TAB_NAMES[nextIndex], { focus: true });
  }

  function setupMobileDock() {
    if (!els.mobileDock) return;
    const sealWrap = document.querySelector(".seal-wrap");
    if (!sealWrap || !("IntersectionObserver" in window)) {
      els.mobileDock.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const sealVisible = entries.some((entry) => entry.isIntersecting);
      els.mobileDock.classList.toggle("is-visible", !sealVisible);
    }, { threshold: 0.55 });
    observer.observe(sealWrap);

    document.addEventListener("focusin", (event) => {
      if (!els.modal.hidden) return;
      if (!els.mobileDock.classList.contains("is-visible")) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (els.mobileDock.contains(target)) return;
      const rect = target.getBoundingClientRect();
      const dockRect = els.mobileDock.getBoundingClientRect();
      if (rect.bottom > dockRect.top - 8) {
        window.scrollBy(0, rect.bottom - dockRect.top + 18);
      }
    });
  }

  function wireEvents() {
    els.stampBtn.addEventListener("click", () => handleStampClick());
    els.quickStampBtn.addEventListener("click", () => handleStampClick("good"));
    els.goldenLetter.addEventListener("click", collectGoldenLetter);
    els.bellBtn.addEventListener("click", useBell);

    els.quickShopBtn.addEventListener("click", () => {
      const shop = document.querySelector(".shop-card");
      if (!shop) return;
      shop.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
    });

    els.soundBtn.addEventListener("click", toggleSound);

    els.buySwitch.addEventListener("click", (event) => {
      const button = event.target.closest("[data-amount]");
      if (!button || !state) return;
      const amount = Number(button.dataset.amount);
      if (amount !== 1 && amount !== 10) return;
      state.buyAmount = amount;
      syncBuySwitch();
      saveGame();
      if (activeTab === "posties") refreshShopUi();
    });

    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
      tab.addEventListener("keydown", handleTabKeydown);
    });

    els.panelBody.addEventListener("click", (event) => {
      const generatorButton = event.target.closest("[data-buy]");
      if (generatorButton) {
        buyGenerator(generatorButton.dataset.buy);
        return;
      }
      const upgradeButton = event.target.closest("[data-buy-up]");
      if (upgradeButton) {
        buyUpgrade(upgradeButton.dataset.buyUp, event.detail === 0);
        return;
      }
      const materialButton = event.target.closest("[data-buy-mat-up]");
      if (materialButton) {
        buyMaterialUpgrade(materialButton.dataset.buyMatUp);
        return;
      }
      if (event.target.closest("[data-expedition-open]")) {
        openExpedition();
        return;
      }
      const acceptButton = event.target.closest("[data-accept-order]");
      if (acceptButton) {
        acceptOrder(Number(acceptButton.dataset.acceptOrder), event.detail === 0);
        return;
      }
      const deliverButton = event.target.closest("[data-deliver-order]");
      if (deliverButton) {
        deliverOrder(Number(deliverButton.dataset.deliverOrder), event.detail === 0);
        return;
      }
      const dropButton = event.target.closest("[data-drop-order]");
      if (dropButton) {
        openDropOrderModal(Number(dropButton.dataset.dropOrder));
        return;
      }
      if (event.target.closest("[data-reroll-orders]")) {
        rerollOffers(event.detail === 0);
        return;
      }
      const rushButton = event.target.closest("[data-rush-trip]");
      if (rushButton) {
        rushTrip(Number(rushButton.dataset.rushTrip), event.detail === 0);
        return;
      }
      const routeButton = event.target.closest("[data-route-start]");
      if (routeButton) {
        startDispatch(routeButton.dataset.routeStart, event.detail === 0);
        return;
      }
      const collectButton = event.target.closest("[data-collect-dispatch]");
      if (collectButton) {
        collectDispatches([Number(collectButton.dataset.collectDispatch)], event.detail === 0);
        return;
      }
      if (event.target.closest("#collectAllDispatch")) {
        collectDispatches(state.readyTrips.map((trip) => trip.id), event.detail === 0);
        return;
      }
      const nodeButton = event.target.closest("[data-moon-node]");
      if (nodeButton) {
        buyMoonNode(nodeButton.dataset.moonNode);
        return;
      }
      const contractButton = event.target.closest("[data-contract]");
      if (contractButton) {
        selectContract(contractButton.dataset.contract);
        return;
      }
      if (event.target.closest("#prestigeBtn")) {
        openPrestigeModal();
      }
    });

    els.helpBtn.addEventListener("click", openHelpModal);
    els.resetBtn.addEventListener("click", openResetModal);
    if (els.accountBtn) els.accountBtn.addEventListener("click", openAccountModal);
    if (els.townBtn) els.townBtn.addEventListener("click", openTown);

    els.modalCancel.addEventListener("click", closeModal);
    els.modalConfirm.addEventListener("click", () => {
      const action = modalAction;
      closeModal();
      if (action) action();
    });
    els.modal.addEventListener("click", (event) => {
      if (event.target === els.modal) closeModal();
    });
    els.modalBody.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-event-choice]");
      if (!choice) return;
      applyEventChoice(Number(choice.dataset.eventChoice));
    });
    els.modalBody.addEventListener("click", (event) => {
      if (event.target.closest("[data-town-refresh]")) {
        if (els.modalBody.querySelector(".town-composer")) openTown();
        else loadTown();
        return;
      }
      if (event.target.closest("[data-town-login]")) {
        closeModal();
        openAccountModal();
        return;
      }
      if (event.target.closest("[data-copy-friend-code]")) {
        copyFriendCode();
        return;
      }
      if (event.target.closest("[data-friend-add]")) {
        addFriendByCode();
        return;
      }
      const acceptFriend = event.target.closest("[data-accept-friend]");
      if (acceptFriend) {
        acceptFriendRequest(Number(acceptFriend.dataset.acceptFriend));
        return;
      }
      const declineFriend = event.target.closest("[data-decline-friend]");
      if (declineFriend) {
        declineFriendRequest(Number(declineFriend.dataset.declineFriend));
        return;
      }
      const removeFriend = event.target.closest("[data-remove-friend]");
      if (removeFriend) {
        removeFriendById(removeFriend.dataset.removeFriend);
        return;
      }
      const friendProfile = event.target.closest("[data-friend-profile]");
      if (friendProfile) {
        openFriendProfile(friendProfile.dataset.friendProfile);
        return;
      }
      if (event.target.closest("[data-friend-back]")) {
        openTown();
        return;
      }
      const claim = event.target.closest("[data-claim-postcard]");
      if (claim) {
        claimTownPostcard(Number(claim.dataset.claimPostcard));
        return;
      }
      const send = event.target.closest("[data-send-postcard]");
      if (send) {
        openPostcardComposer(
          send.dataset.sendPostcard,
          send.dataset.sendKind,
          send.dataset.sendName
        );
        return;
      }
      const template = event.target.closest("[data-postcard-template]");
      if (template) {
        sendTownPostcard(template.dataset.postcardTemplate);
        return;
      }
      const mode = event.target.closest("[data-account-mode]");
      if (mode) {
        accountMode = mode.dataset.accountMode === "register" ? "register" : "login";
        renderAccountModal();
        return;
      }
      if (event.target.closest("[data-account-submit]")) {
        submitAccount();
        return;
      }
      if (event.target.closest("[data-account-sync]")) {
        cloudPushNow();
        return;
      }
      if (event.target.closest("[data-account-logout]")) {
        accountLogout();
        return;
      }
      if (event.target.closest("[data-account-pull]")) {
        accountPullOverride();
        return;
      }
      if (event.target.closest("[data-account-push]")) {
        accountPushOverride();
        return;
      }
    });
    els.modalBody.addEventListener("click", (event) => {
      const option = event.target.closest("[data-exp-option]");
      if (option) { chooseExpeditionOption(Number(option.dataset.expOption)); return; }
      const card = event.target.closest("[data-exp-card]");
      if (card) { toggleExpeditionCard(Number(card.dataset.expCard)); return; }
      const pick = event.target.closest("[data-exp-pick-card]");
      if (pick) { chooseExpeditionCard(Number(pick.dataset.expPickCard)); return; }
      const prepToggle = event.target.closest("[data-prep-toggle]");
      if (prepToggle) { toggleExpeditionPrep(prepToggle.dataset.prepToggle); return; }
      if (event.target.closest("[data-prep-start]")) { startExpeditionWithPrep(false); return; }
      if (event.target.closest("[data-prep-skip]")) { startExpeditionWithPrep(true); return; }
      if (event.target.closest("[data-exp-resolve]") || event.target.closest("[data-exp-resolve-empty]")) {
        resolveExpedition();
        return;
      }
      const camp = event.target.closest("[data-exp-camp]");
      if (camp) { expeditionCamp(camp.dataset.expCamp); return; }
      const trade = event.target.closest("[data-exp-trade]");
      if (trade) { expeditionTrade(trade.dataset.expTrade); return; }
      const choice = event.target.closest("[data-exp-event]");
      if (choice) { expeditionEventChoice(Number(choice.dataset.expEvent)); return; }
      const reward = event.target.closest("[data-exp-reward]");
      if (reward) { claimExpeditionReward(Number(reward.dataset.expReward)); return; }
      if (event.target.closest("[data-exp-close]")) { closeModal(); return; }
      if (event.target.closest("[data-exp-abandon]")) { expConfirmAbandon = true; renderExpedition(); return; }
      if (event.target.closest("[data-exp-abandon-confirm]")) { abandonExpedition(); return; }
      if (event.target.closest("[data-exp-abandon-cancel]")) { expConfirmAbandon = false; renderExpedition(); return; }
      if (event.target.closest("[data-exp-restart]")) { restartExpedition(); return; }
      if (event.target.closest("[data-exp-finish]")) { closeExpeditionResult(); return; }
    });
    document.addEventListener("keydown", handleModalKeydown);

    document.addEventListener("visibilitychange", () => {
      if (!state) return;
      if (document.hidden) {
        hiddenAt = Date.now();
        saveGame();
        return;
      }

      const awayStart = hiddenAt || state.lastSeen;
      const away = awayStart ? (Date.now() - awayStart) / 1000 : 0;
      hiddenAt = 0;
      combo = 0;
      comboTimer = 0;
      lastFrame = performance.now();
      lastUiAt = 0;
      refreshWeather(false);
      if (goldenVisible && away > 20) hideGoldenLetter();
      if (away > 60) {
        grantAwayEarnings(away);
        if (!goldenVisible) scheduleGolden(35, 70);
      }
      completeTrips(false);
      updateTabBadges();
      saveGame();
      refreshLive();
    });

    window.addEventListener("pagehide", () => {
      saveGame({ markSeen: !document.hidden });
    });
  }

  function gameLoop(now) {
    requestAnimationFrame(gameLoop);
    if (!state || document.hidden) return;

    const rawDelta = Math.max(now - lastFrame, 0) / 1000;
    lastFrame = now;
    let delta = Math.min(rawDelta, 0.5);

    if (rawDelta > 5) {
      delta = 0;
      grantAwayEarnings(rawDelta, {
        announce: rawDelta >= 60,
        source: "stall"
      });
    }

    const earned = baseRate() * delta;
    if (earned > 0) addStamps(earned);

    if (comboTimer > 0) {
      comboTimer -= delta;
      if (comboTimer <= 0) {
        comboTimer = 0;
        combo = 0;
      }
    } else if (combo !== 0) {
      combo = 0;
    }

    if (els.stampOrbit) {
      els.stampOrbit.style.transform = `rotate(${(stampPhase(now) * 360).toFixed(1)}deg)`;
    }

    if (hasNode("busy3") && now - lastAutoStampAt >= 1000) {
      lastAutoStampAt = now;
      addStamps(baseClickPower());
    }

    if (now - lastOrderAt >= 1000) {
      syncOrders();
      if (activeTab === "orders") refreshOrdersUi();
      lastOrderAt = now;
    }

    if (now - lastEventCheckAt >= 1000) {
      maybeTriggerEvent();
      lastEventCheckAt = now;
    }

    if (now - lastUiAt >= 85) {
      refreshLive();
      lastUiAt = now;
    }
    if (now - lastGoalAt >= 450) {
      updateGoals();
      lastGoalAt = now;
    }
    if (now - lastAchievementAt >= 600) {
      checkAchievements({ announce: true });
      lastAchievementAt = now;
    }
    if (now - lastDispatchAt >= 500) {
      completeTrips(true);
      lastDispatchAt = now;
    }
    if (now - lastWeatherAt >= 1000) {
      refreshWeather(true);
      lastWeatherAt = now;
    }
    if (now - lastSaveAt >= SAVE_INTERVAL) {
      saveGame();
      lastSaveAt = now;
    }
  }

  function boot(data) {
    if (booted) return;
    booted = true;

    const fromHot = data && typeof data === "object" && data.game && typeof data.game === "object"
      ? data.game
      : data && typeof data === "object" && "stamps" in data
        ? data
        : null;
    const raw = fromHot || readSave();

    state = normalizeState(raw);
    const bootAway = raw ? Math.max(0, (Date.now() - state.lastSeen) / 1000) : 0;
    ownedUpgradeSet = new Set(state.upgrades);
    achievementSet = new Set(state.achievements);
    goalsDoneSet = new Set(state.goalsDone);
    combo = 0;
    comboTimer = 0;
    stampAnchor = performance.now();
    nextEventAt = Date.now() + 90_000 + Math.random() * 90_000;
    if (prefersReducedMotion && els.stampQuality) {
      els.stampQuality.textContent = "减少动态效果已开启：每次盖戳算完美 ×1.5";
    }
    ensureOffers();
    syncOrders({ silent: true });

    syncBuySwitch();
    refreshSoundButton();
    setDayLabel();
    syncCompletedTrips();
    switchTab("posties");
    refreshWeather(false, { persist: false });

    if (bootAway > 60) grantAwayEarnings(bootAway);

    state.lastSeen = Date.now();
    updateGoals();
    checkAchievements({ announce: false });
    updateBellUi();
    refreshLive();
    saveGame();
    initCloud();

    if (document.hidden) hiddenAt = Date.now();

    lastFrame = performance.now();
    lastUiAt = lastFrame;
    lastGoalAt = lastFrame;
    lastAchievementAt = lastFrame;
    lastWeatherAt = lastFrame;
    lastDispatchAt = lastFrame;
    lastSaveAt = lastFrame;
    sceneEffects.init();
    sceneEffects.setWeather(state.weatherId);
    scheduleGolden(48, 95);
    if (window.location.hash === "#qa") {
      window.__moss = {
        state: () => state,
        triggerEvent: () => { nextEventAt = 0; maybeTriggerEvent(); },
        triggerOrders: () => { ensureOffers(); buildOrdersPanel(); },
        stamp: (quality) => handleStampClick(quality)
      };
    }
    requestAnimationFrame(gameLoop);
  }

  function startApp() {
    setDayLabel();
    wireEvents();
    setupMobileDock();

    const hot = window.claude && window.claude.hot;
    if (hot && typeof hot.ready === "function") {
      try {
        hot.ready((data) => boot(data));
      } catch (error) {
        boot((hot && hot.data) || {});
      }
    } else {
      boot((hot && hot.data) || {});
    }
  }

  startApp();
})();
