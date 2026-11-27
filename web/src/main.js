import * as cloudApi from "./cloud.js";
import { deriveVerifier, proveVerifier } from "./crypto.js";
import { mountTown, unmountTown } from "./ui/mountTown.js";
import { mountAccount, unmountAccount } from "./ui/mountAccount.js";
import { mountOrders, unmountOrders } from "./ui/mountOrders.js";
import { setOrdersSnapshot } from "./ui/ordersStore.js";
import { mountAlbum, unmountAlbum } from "./ui/mountAlbum.js";
import { setAlbumSnapshot } from "./ui/albumStore.js";
import { mountMoon, unmountMoon } from "./ui/mountMoon.js";
import { setMoonSnapshot } from "./ui/moonStore.js";
import { mountWorkshop, unmountWorkshop } from "./ui/mountWorkshop.js";
import { setWorkshopSnapshot } from "./ui/workshopStore.js";
import { mountExpedition, unmountExpedition } from "./ui/mountExpedition.js";
import { setExpeditionSnapshot } from "./ui/expeditionStore.js";
import { mountSeedModal, unmountSeedModal } from "./ui/mountSeedModal.js";
import { setSeedSnapshot } from "./ui/seedStore.js";
import { mountFriendGarden, unmountFriendGarden } from "./ui/mountFriendGarden.js";
import { setFriendGardenSnapshot } from "./ui/friendGardenStore.js";
import {
  mountExpeditionPrep,
  unmountExpeditionPrep
} from "./ui/mountExpeditionPrep.js";
import { setExpeditionPrepSnapshot } from "./ui/expeditionPrepStore.js";
import { mountInfoModal, unmountInfoModal } from "./ui/mountInfoModal.js";
import { setInfoSnapshot } from "./ui/infoStore.js";
import { mountEventModal, unmountEventModal } from "./ui/mountEventModal.js";
import { setEventSnapshot } from "./ui/eventStore.js";
import { mountFriendProfile, unmountFriendProfile } from "./ui/mountFriendProfile.js";
import { setFriendProfileSnapshot } from "./ui/friendProfileStore.js";
import {
  mountPostcardComposer,
  unmountPostcardComposer
} from "./ui/mountPostcardComposer.js";
import { setPostcardComposerSnapshot } from "./ui/postcardComposerStore.js";
import {
  createNightWatch,
  NW_TOWER_LIST,
  NW_RECIPE_LIST,
  NW_TALENTS,
  NW_MODIFIERS,
  NW_ENEMY_LIST,
  dailyModifier,
  deepFogFor,
  blockedCellsFor,
  NW_DEEP_FOG,
  talentCost,
  talentBonus,
  NW_LANES,
  NW_COLS,
  nightStartOil,
  nightHpScale
} from "./nightwatch.js";
import { mountNightWatch, unmountNightWatch } from "./ui/mountNightWatch.js";
import { setNightWatchSnapshot } from "./ui/nightWatchStore.js";
import {
  mountNightWatchPanel,
  unmountNightWatchPanel
} from "./ui/mountNightWatchPanel.js";
import { setNightPanelSnapshot } from "./ui/nightPanelStore.js";
import { ROOM_NAMES, currentRoom, writeRoomHash, onRoomHashChange } from "./router.js";
import { mountRoomNav } from "./ui/mountRoomNav.js";
import { setRoomNavSnapshot } from "./ui/roomNavStore.js";

(() => {
  "use strict";

  const SAVE_KEY = "moss-post-office.save.v1";
  const SAVE_OWNER_KEY = "moss-post-office.owner.v1";
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

  const GARDEN_ICONS = {
    letter: "letter",
    stamp: "star",
    inkberry: "mushroom",
    starchild: "cloud",
    rainbowvine: "fern",
    mooncap: "star"
  };
  const GARDEN_CROP_NAMES = {
    letter: "信封草",
    stamp: "邮票花",
    inkberry: "墨莓",
    starchild: "星屑花",
    rainbowvine: "彩纸藤",
    mooncap: "月光菇"
  };
  const GARDEN_CROP_UNLOCK = {
    letter: 0,
    stamp: 0,
    inkberry: 0,
    starchild: 3,
    rainbowvine: 6,
    mooncap: 9
  };
  const GARDEN_CROP_MINUTES = {
    letter: 45,
    stamp: 60,
    inkberry: 75,
    starchild: 90,
    rainbowvine: 80,
    mooncap: 120
  };
  const GARDEN_CROP_YIELD = {
    letter: 3,
    stamp: 3,
    inkberry: 3,
    starchild: 6,
    rainbowvine: 5,
    mooncap: 6
  };

  const TOWN_SETS = [
    { id: "town", name: "镇口", bots: ["b_moss", "b_box"], rewardMaterial: "cloth" },
    { id: "starport", name: "星港", bots: ["b_night", "b_star"], rewardMaterial: "paper" },
    { id: "mistlake", name: "雾湖", bots: ["b_boat", "b_snail"], rewardMaterial: "wax" },
    { id: "rain", name: "雨夜", bots: ["b_plane", "b_mushroom"], rewardMaterial: "cloth" }
  ];

  const NIGHT_MEDALS = [
    { level: 5, template: "night_5", name: "守夜铜戳", edition: 100, icon: "bell", desc: "守住第 5 夜的纪念。" },
    { level: 10, template: "night_10", name: "守夜银戳", edition: 50, icon: "star", desc: "守住第 10 夜的纪念。" },
    { level: 15, template: "night_15", name: "守夜金戳", edition: 25, icon: "sun", desc: "守住第 15 夜的纪念。" },
    { level: 20, template: "deep_20", name: "深雾铜灯", edition: 50, icon: "mist", desc: "守住第 20 夜的纪念。" },
    { level: 25, template: "deep_25", name: "深雾银钟", edition: 30, icon: "bell", desc: "守住第 25 夜的纪念。" },
    { level: 30, template: "deep_30", name: "深雾金星", edition: 15, icon: "star", desc: "守住第 30 夜的纪念。" }
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
    },
    {
      id: "night_gardener",
      name: "守夜园丁",
      desc: "在守夜里合成 8 种不同的融合体",
      icon: "fern",
      target: 8,
      reward: 0.02,
      value: () => (state.nightWatch.fusions || []).length
    },
    {
      id: "night_hybrid",
      name: "全部点亮",
      desc: "集齐 14 种融合体",
      icon: "star",
      target: 14,
      reward: 0.03,
      value: () => (state.nightWatch.fusions || []).length
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
    nightDot: document.getElementById("nightDot"),
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
    modalClose: document.getElementById("modalClose"),
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
  let lastRerollAt = 0;
  let activeRoom = "hall";
  let roomView = { routes: "panel", night: "panel" };
  let townView = "main";
  let roomNavSignature = "";
  const roomEls = {
    hall: document.querySelector('[data-room="hall"]'),
    town: document.querySelector('[data-room="town"]'),
    routes: document.querySelector('[data-room="routes"]'),
    night: document.querySelector('[data-room="night"]'),
    townHost: document.querySelector("[data-town-host]"),
    routesHost: document.querySelector("[data-routes-host]"),
    nightHost: document.querySelector("[data-night-host]"),
    nav: document.getElementById("roomNav")
  };
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
  let accountBaseDraft = cloudApi.defaultBase();
  let cloudPushTimer = 0;
  let cloudPushing = false;
  let suppressSaves = false;
  let localSaveProblem = false;
  let cloudRecoveryPending = false;
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
  let lastOrdersSignature = "";
  let lastAlbumSignature = "";
  let lastMoonSignature = "";
  let lastWorkshopSignature = "";

  const shopUi = new Map();
  const upgradeUi = new Map();
  const albumUi = new Map();

  function createInitialState(sound = true) {
    return {
      version: 16,
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
      postcardSetRewards: [],
      postcardAlbumReward: false,
      collectibles: [],
      nightWatch: {
        night: 1,
        best: 0,
        wins: 0,
        kills: 0,
        points: 0,
        talents: {},
        pendingMedals: [],
        modifier: null,
        history: [],
        fusions: [],
        deepChoice: { night: 0, id: "" }
      },
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
    clean.postcardSetRewards = Array.isArray(raw.postcardSetRewards)
      ? [...new Set(raw.postcardSetRewards)].filter((id) => TOWN_SETS.some((set) => set.id === id))
      : [];
    clean.postcardAlbumReward = Boolean(raw.postcardAlbumReward);
    clean.collectibles = Array.isArray(raw.collectibles)
      ? raw.collectibles
          .filter((item) => item && typeof item.kind === "string" && typeof item.template === "string")
          .map((item) => ({
            id: Math.floor(numberOr(item.id)),
            kind: item.kind,
            template: item.template,
            edition: Math.max(1, Math.floor(numberOr(item.edition, 1))),
            serial: Math.max(1, Math.floor(numberOr(item.serial, 1))),
            image_key: typeof item.image_key === "string" ? item.image_key : item.template,
            minted_at: numberOr(item.minted_at)
          }))
          .slice(-80)
      : [];
    clean.expedition = normalizeExpedition(raw.expedition);
    if (raw.nightWatch && typeof raw.nightWatch === "object") {
      clean.nightWatch.night = Math.max(1, Math.floor(numberOr(raw.nightWatch.night, 1)));
      clean.nightWatch.best = Math.max(0, Math.floor(numberOr(raw.nightWatch.best)));
      clean.nightWatch.wins = Math.max(0, Math.floor(numberOr(raw.nightWatch.wins)));
      clean.nightWatch.kills = Math.max(0, Math.floor(numberOr(raw.nightWatch.kills)));
      clean.nightWatch.points = Math.max(0, Math.floor(numberOr(raw.nightWatch.points)));
      clean.nightWatch.best = Math.min(clean.nightWatch.best, clean.nightWatch.night - 1);
      if (Array.isArray(raw.nightWatch.fusions)) {
        const knownFusions = new Set(NW_RECIPE_LIST.map((recipe) => recipe.id));
        clean.nightWatch.fusions = [
          ...new Set(raw.nightWatch.fusions.filter((id) => knownFusions.has(id)))
        ];
      }
      if (Array.isArray(raw.nightWatch.history)) {
        clean.nightWatch.history = raw.nightWatch.history
          .filter((run) => run && typeof run === "object")
          .map((run) => ({
            level: Math.max(1, Math.floor(numberOr(run.level, 1))),
            won: Boolean(run.won),
            wave: Math.max(0, Math.floor(numberOr(run.wave))),
            waves: Math.max(1, Math.floor(numberOr(run.waves, 1))),
            kills: Math.max(0, Math.floor(numberOr(run.kills))),
            deep: Boolean(run.deep),
            at: numberOr(run.at)
          }))
          .slice(0, 20);
      }
      const savedDeep = raw.nightWatch.deepChoice;
      if (
        savedDeep &&
        Number.isFinite(Number(savedDeep.night)) &&
        NW_DEEP_FOG.some((deep) => deep.id === savedDeep.id)
      ) {
        clean.nightWatch.deepChoice = {
          night: Math.max(0, Math.floor(Number(savedDeep.night))),
          id: savedDeep.id
        };
      }
      const savedModifier = raw.nightWatch.modifier;
      if (
        savedModifier &&
        Number.isFinite(Number(savedModifier.day)) &&
        NW_MODIFIERS.some((modifier) => modifier.id === savedModifier.id)
      ) {
        clean.nightWatch.modifier = {
          day: Math.floor(Number(savedModifier.day)),
          id: savedModifier.id
        };
      }
      if (Array.isArray(raw.nightWatch.pendingMedals)) {
        clean.nightWatch.pendingMedals = [
          ...new Set(
            raw.nightWatch.pendingMedals
              .map((level) => Math.floor(numberOr(level)))
              .filter((level) => NIGHT_MEDALS.some((medal) => medal.level === level))
          )
        ];
      }
      const talents = raw.nightWatch.talents;
      if (talents && typeof talents === "object") {
        NW_TALENTS.forEach((talent) => {
          const level = Math.max(
            0,
            Math.min(talent.max, Math.floor(numberOr(talents[talent.id])))
          );
          if (level > 0) clean.nightWatch.talents[talent.id] = level;
        });
      }
    }
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
      if (!raw) {
        localSaveProblem = true;
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        localSaveProblem = true;
        return null;
      }
      return parsed;
    } catch (error) {
      localSaveProblem = true;
      return null;
    }
  }

  function readSaveOwner() {
    try {
      return String(window.localStorage.getItem(SAVE_OWNER_KEY) || "");
    } catch (error) {
      return "";
    }
  }

  function writeSaveOwner(userId) {
    try {
      if (userId) window.localStorage.setItem(SAVE_OWNER_KEY, String(userId));
    } catch (error) {
      /* storage may be unavailable */
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
    upgrades: "把邮戳磨得亮一点",
    album: "把日子贴成邮票",
    moon: "开往月亮的夜班车"
  };

  const TAB_EYEBROWS = {
    posties: "苔藓镇 · 邮局小店",
    orders: "苔藓镇 · 来信柜台",
    upgrades: "苔藓镇 · 邮戳工坊",
    album: "苔藓镇 · 集邮册",
    moon: "苔藓镇 · 月亮夜班"
  };

  const TAB_NAMES = ["posties", "orders", "upgrades", "album", "moon"];

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

  function workshopSnapshot() {
    const upgrades = UPGRADES.map((upgrade) => {
      const purchased = ownedUpgradeSet.has(upgrade.id);
      const unlocked = isUpgradeUnlocked(upgrade);
      const affordable = canAfford(upgrade.cost);
      return {
        id: upgrade.id,
        name: upgrade.name,
        desc: purchased
          ? "已经收进邮册，永久生效。"
          : unlocked
            ? upgrade.desc
            : `累计赚到 ${formatNumber(upgrade.unlock)}张邮票后解锁。`,
        icon: ICONS[upgrade.icon],
        effectLabel: upgrade.effectLabel,
        purchased,
        unlocked,
        canBuy: !purchased && unlocked && affordable,
        costText: unlocked ? formatNumber(upgrade.cost) : "未解锁",
        unitText: unlocked ? "邮票" : "再等等",
        ariaLabel: !unlocked
          ? `${upgrade.name}尚未解锁，累计赚到 ${formatNumber(upgrade.unlock)}张邮票后可用`
          : `购买${upgrade.name}，花费 ${formatNumber(upgrade.cost)}张邮票`,
        title: !unlocked
          ? "等邮册翻到这一页。"
          : affordable
            ? `收下${upgrade.name}`
            : `还差 ${formatNumber(Math.max(0, upgrade.cost - Math.floor(state.stamps)))}张邮票`
      };
    });

    const materialUpgrades = MATERIAL_UPGRADES.map((item) => {
      const purchased = hasMaterialUpgrade(item.id);
      const affordable = (state.materials[item.material] || 0) >= item.cost;
      return {
        id: item.id,
        name: item.name,
        desc: item.desc,
        icon: ICONS[item.icon],
        materialName: EXP_MATERIALS[item.material].name,
        cost: item.cost,
        purchased,
        affordable
      };
    });

    return {
      upgrades,
      materialUpgrades,
      materialsText: materialSummary()
    };
  }

  function buildUpgradePanel() {
    unmountWorkshop();
    els.panelBody.innerHTML = `<div data-workshop-root></div>`;
    mountWorkshop(els.panelBody.querySelector("[data-workshop-root]"), {
      onBuyUpgrade: buyUpgrade,
      onBuyMaterialUpgrade: buyMaterialUpgrade
    });
    const next = workshopSnapshot();
    lastWorkshopSignature = JSON.stringify(next);
    setWorkshopSnapshot(next);
  }

  function refreshUpgradeUi() {
    if (!state || activeTab !== "upgrades") return;
    const next = workshopSnapshot();
    const signature = JSON.stringify(next);
    if (signature === lastWorkshopSignature) return;
    lastWorkshopSignature = signature;
    setWorkshopSnapshot(next);
  }

  function achievementBonusPercent() {
    return Math.round((achievementMultiplier() - 1) * 100);
  }

  function albumSnapshot() {
    const achievements = ACHIEVEMENTS.map((achievement) => {
      const done = achievementSet.has(achievement.id);
      const value = Math.min(achievement.target, achievement.value());
      return {
        id: achievement.id,
        name: achievement.name,
        desc: achievement.desc,
        icon: ICONS[achievement.icon],
        rewardPercent: Math.round(achievement.reward * 100),
        done,
        valueText: formatNumber(value),
        targetText: formatNumber(achievement.target),
        progress: Math.round(completionPercent(value, achievement.target) * 10) / 10
      };
    });

    const postcardSets = TOWN_SETS.map((set) => {
      const entries = set.bots.map((botId) =>
        state.postcardAlbum.find((item) => item.senderId === botId)
      );
      const count = entries.filter(Boolean).length;
      const medal = collectibleFor("medal", set.id);
      return {
        id: set.id,
        name: set.name,
        complete: count === set.bots.length,
        count,
        total: set.bots.length,
        rewarded: state.postcardSetRewards.includes(set.id),
        medalText: medal ? `徽章 #${medal.serial} / ${medal.edition} · ` : "",
        bots: set.bots.map((botId, index) => {
          const bot = TOWN_BOTS.find((candidate) => candidate.id === botId);
          const entry = entries[index];
          const collectible = collectibleFor("postcard", botId);
          const iconName = {
            b_moss: "letter",
            b_snail: "fern",
            b_plane: "plane",
            b_night: "star",
            b_mushroom: "mushroom",
            b_box: "mailbox",
            b_star: "star",
            b_boat: "boat"
          }[botId] || "letter";
          return {
            id: botId,
            name: bot ? bot.name : botId,
            title: bot ? bot.title : "",
            icon: ICONS[iconName],
            collected: Boolean(entry),
            text: entry ? entry.text || "已经收进邮册。" : "",
            serialText: collectible ? `#${collectible.serial} / ${collectible.edition}` : ""
          };
        })
      };
    });

    return {
      collected: state.achievements.length,
      total: ACHIEVEMENTS.length,
      bonusPercent: achievementBonusPercent(),
      fillPercent: Math.round(completionPercent(state.achievements.length, ACHIEVEMENTS.length) * 10) / 10,
      achievements,
      postcardCount: state.postcardAlbum.length,
      postcardTotal: TOWN_BOTS.length,
      postcardComplete: state.postcardAlbumReward,
      postcardSets,
      nightFusionCount: (state.nightWatch.fusions || []).length,
      nightFusions: NW_RECIPE_LIST.map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        icon: ICONS[recipe.icon],
        tier: recipe.tier,
        aName: recipe.aName,
        bName: recipe.bName,
        unlockNight: recipe.unlockNight,
        unlocked: recipe.unlockNight <= Math.max(1, state.nightWatch.night),
        discovered: (state.nightWatch.fusions || []).includes(recipe.id)
      })),
      nightMedals: NIGHT_MEDALS.map((medal) => {
        const owned = collectibleFor("nightwatch", medal.template);
        return {
          level: medal.level,
          name: medal.name,
          desc: medal.desc,
          icon: ICONS[medal.icon],
          edition: medal.edition,
          reached: (state.nightWatch.best || 0) >= medal.level,
          owned: Boolean(owned),
          serialText: owned ? `#${owned.serial} / ${owned.edition}` : ""
        };
      })
    };
  }

  function buildAlbumPanel() {
    albumBuilt = true;
    unmountAlbum();
    els.panelBody.innerHTML = `<div data-album-root></div>`;
    mountAlbum(els.panelBody.querySelector("[data-album-root]"));
    const next = albumSnapshot();
    lastAlbumSignature = JSON.stringify(next);
    setAlbumSnapshot(next);
  }

  function refreshAlbumUi() {
    if (!state || activeTab !== "album") return;
    const next = albumSnapshot();
    const signature = JSON.stringify(next);
    if (signature === lastAlbumSignature) return;
    lastAlbumSignature = signature;
    setAlbumSnapshot(next);
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
    if (activeRoom === "routes" && roomView.routes === "panel") {
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

  function routesHead(title, kicker, backLabel = "回邮局", backTarget = "hall") {
    return `
      <div class="room-head">
        <div>
          <p class="room-kicker">${kicker}</p>
          <h2>${title}</h2>
        </div>
        <button class="link-btn room-back" type="button" data-room-back="${backTarget}">${backLabel}</button>
      </div>`;
  }

  function renderRoutesPanel() {
    if (!roomEls.routesHost) return;
    unmountExpedition();
    unmountExpeditionPrep();
    roomView.routes = "panel";
    roomEls.routesHost.innerHTML = `${routesHead("邮路柜台", "苔藓镇 · 邮路")}<div data-dispatch-root></div>`;
    dispatchBuilt = false;
    buildDispatchPanel();
    refreshDispatchUi();
  }

  function enterRoutesRoom() {
    if (roomView.routes === "expedition" && state && state.expedition) {
      renderExpeditionScreen();
      return;
    }
    if (roomView.routes === "prep") {
      openExpeditionPrep();
      return;
    }
    renderRoutesPanel();
  }

  function closeRoutesRoom() {
    unmountExpedition();
    unmountExpeditionPrep();
    roomView.routes = "panel";
  }

  function dispatchPane() {
    if (!roomEls.routesHost) return null;
    let pane = roomEls.routesHost.querySelector("[data-dispatch-root]");
    if (!pane) {
      roomEls.routesHost.innerHTML = `<div data-dispatch-root></div>`;
      pane = roomEls.routesHost.querySelector("[data-dispatch-root]");
    }
    return pane;
  }

  function buildDispatchPanel() {
    const pane = dispatchPane();
    if (!pane) return;
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

    pane.innerHTML = `
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
      pips: Array.from(pane.querySelectorAll(".slot-pip")),
      activeCount: document.getElementById("dispatchActiveCount"),
      routeButtons: new Map(),
      routeRewards: new Map(),
      tripRefs: new Map(),
      unlockKey: ROUTES.map((route) => (isRouteUnlocked(route) ? "1" : "0")).join("")
    };

    ROUTES.forEach((route) => {
      const button = pane.querySelector(`[data-route-start="${route.id}"]`);
      if (button) dispatchUi.routeButtons.set(route.id, button);
      const reward = pane.querySelector(`[data-route-reward="${route.id}"]`);
      if (reward) dispatchUi.routeRewards.set(route.id, reward);
    });

    state.activeTrips.forEach((trip) => {
      const card = pane.querySelector(`[data-trip-id="${trip.id}"]`);
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
    if (!dispatchBuilt || !dispatchUi) return;
    if (activeRoom !== "routes" || roomView.routes !== "panel") return;
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
      const button = dispatchPane()?.querySelector(`[data-route-start="${route.id}"]`);
      if (button && !button.disabled) {
        button.focus({ preventScroll: true });
      } else {
        const nextButton = dispatchPane()?.querySelector(".route-btn:not(:disabled)");
        if (nextButton) {
          nextButton.focus({ preventScroll: true });
        } else {
          roomEls.routesHost?.querySelector("[data-room-back]")?.focus({ preventScroll: true });
        }
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
    if (activeRoom === "routes" && roomView.routes === "panel") buildDispatchPanel();

    if (!silent && !newly.length) {
      showToast(
        selected.length === 1
          ? `取回了${ROUTES.find((route) => route.id === selected[0].routeId).name}的回信：${formatNumber(total)} 张邮票。`
          : `一起取回了 ${selected.length} 个邮袋：${formatNumber(total)} 张邮票。`,
        4000
      );
    }

    if (restoreFocus) {
      const nextReady = dispatchPane()?.querySelector("[data-collect-dispatch]");
      if (nextReady) {
        nextReady.focus({ preventScroll: true });
      } else {
        const nextButton = dispatchPane()?.querySelector(".route-btn:not(:disabled)");
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

  function ordersSnapshot() {
    const contract = currentContract();
    const accepted = state.accepted
      .map((order) => {
        const template = orderTpl(order.tpl);
        if (!template) return null;
        const cost = orderMaterialCost(order);
        const canPay = canPayMaterials(cost);
        const progress = orderProgressValue(order);
        return {
          id: order.id,
          sender: template.sender,
          title: template.title,
          quote: template.quote,
          tag: orderTagFor(order),
          unit: template.unit,
          progress,
          target: order.target,
          percent: Math.round(completionPercent(progress, order.target) * 10) / 10,
          stamps: orderRewardStamps(order),
          ink: orderRewardInk(order),
          costText: materialCostText(cost),
          rewardText: materialGainText(template.materialReward),
          ready: orderConditionMet(order) && canPay,
          note: orderConditionNote(order) || (!canPay ? `还差材料：${materialCostText(cost)}` : ""),
          expiresAt: order.expiresAt
        };
      })
      .filter(Boolean);

    const offers = state.offers
      .map((offer) => {
        const template = orderTpl(offer.tpl);
        if (!template) return null;
        return {
          id: offer.id,
          sender: template.sender,
          title: template.title,
          quote: template.quote,
          tag: orderTagFor(offer),
          unit: template.unit,
          target: offer.target,
          stamps: Math.round(offer.stamps * orderRewardScale()),
          ink: Math.round(offer.ink * inkMultiplier()),
          minutes: Math.round(offer.minutes * orderDeadlineScale()),
          costText: materialCostText(template.materialCost),
          rewardText: materialGainText(template.materialReward)
        };
      })
      .filter(Boolean);

    return {
      accepted,
      offers,
      slots: orderSlots(),
      ink: state.ink,
      rerollCost: INK_REROLL_COST,
      canReroll: state.ink >= INK_REROLL_COST,
      contract: contract ? { name: contract.name, desc: contract.desc } : null,
      materialsText: materialSummary()
    };
  }

  function buildOrdersPanel() {
    ensureOffers();
    unmountOrders();
    els.panelBody.innerHTML = `<div data-orders-root></div>`;
    const root = els.panelBody.querySelector("[data-orders-root]");
    mountOrders(root, {
      onAccept: acceptOrder,
      onDeliver: deliverOrder,
      onDrop: openDropOrderModal,
      onReroll: () => rerollOffers(),
      formatNumber
    });
    const next = ordersSnapshot();
    lastOrdersSignature = JSON.stringify(next);
    setOrdersSnapshot(next);
  }

  function refreshOrdersUi() {
    if (!state || activeTab !== "orders") return;
    const next = ordersSnapshot();
    const signature = JSON.stringify(next);
    if (signature === lastOrdersSignature) return;
    lastOrdersSignature = signature;
    setOrdersSnapshot(next);
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
    openInfoModal({
      title: "把这封信放回柜台？",
      confirmLabel: "放下",
      blocks: [
        {
          type: "p",
          runs: [
            {
              t: `${template.sender}的「${template.title}」还没送出去。放下后这封信会回到柜台外，不会扣邮票。`
            }
          ]
        }
      ],
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
    const now = Date.now();
    if (now - lastRerollAt < 400) return;
    if (!spendInk(INK_REROLL_COST)) {
      playDenySound();
      showToast(`换一批要 ${INK_REROLL_COST} 墨点，先去盖几个完美邮戳吧。`, 3000);
      return;
    }
    lastRerollAt = now;
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
      const next = dispatchPane()?.querySelector("[data-collect-dispatch]");
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

  function eventSnapshot(event) {
    return {
      lines: event.body.slice(),
      choices: event.choices.map((choice, index) => ({
        index,
        label: choice.label,
        note: choice.note || "",
        disabled: !canPayChoice(choice)
      }))
    };
  }

  function openEvent(event) {
    eventOpen = true;
    openModal({
      title: event.title,
      body: `<div data-event-root></div>`,
      footer: false
    });
    const root = els.modalBody.querySelector("[data-event-root]");
    if (!root) return;
    mountEventModal(root, {
      onChoose: (index) => applyEventChoice(Number(index))
    });
    setEventSnapshot(eventSnapshot(event));
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
    openInfoModal({
      title: `这一程走「${contract.name}」？`,
      confirmLabel: "定下契约",
      blocks: [
        { type: "p", runs: [{ t: contract.desc }] },
        {
          type: "p",
          runs: [{ t: "契约会一直生效到下一次夜班邮车发车。发车后可以重新选择。" }]
        }
      ],
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

  function expeditionSnapshot() {
    const exp = state.expedition;
    if (!exp) return null;
    if (
      !exp.result &&
      exp.current &&
      (exp.current.kind === "hazard" || exp.current.kind === "boss" || exp.current.kind === "elite") &&
      !exp.hand.length
    ) {
      expeditionDrawHand();
    }

    const selected = [...new Set(expSelection)];
    const maxLetters = Math.max(expeditionMaxLetters(), exp.letters);
    const hearts =
      "♥".repeat(Math.max(0, exp.letters)) +
      "♡".repeat(Math.max(0, maxLetters - exp.letters));
    const current = exp.current;
    const cards = exp.hand.map((cardId, index) => {
      const card = EXP_CARDS[cardId];
      return {
        index,
        name: card.name,
        desc: card.desc,
        power: expeditionCardPower(cardId, current),
        match: Boolean(current && card.tag !== "any" && card.tag === current.tag),
        selected: selected.includes(index),
        disabled: (card.supplyCost || 0) > exp.supplies
      };
    });
    const selectedCards = selected.map((index) => EXP_CARDS[exp.hand[index]]).filter(Boolean);
    const hasDetour = selectedCards.some((card) => card.skip);
    const hasShield = selectedCards.some((card) => card.shield);
    const pips = Array.from({ length: 6 }, (_, index) => {
      const stage = index + 1;
      return {
        stage,
        className:
          stage < exp.stage ? "is-done" : stage === exp.stage ? "is-current" : ""
      };
    });

    const options = exp.options.map((option) => {
      let note = "";
      if (option.kind === "hazard" || option.kind === "boss" || option.kind === "elite") {
        note = `需要 ${option.need} 通行 · 回信 +${formatNumber(option.stamps)} 邮票 · +${option.ink} 墨点${option.kind === "elite" ? " · 胜后挑一张牌" : ""}`;
      } else if (option.kind === "camp") {
        note = "补信件 / 补干粮 / 加一张牌";
      } else if (option.kind === "trade") {
        note = "用邮票或墨点换补给";
      } else {
        note = "会遇到一个人，做一次选择";
      }
      return {
        tag: expeditionOptionTag(option),
        title: option.title,
        desc: option.desc,
        note
      };
    });

    let event = null;
    if (current && current.kind === "event") {
      const data = EXP_EVENTS.find((candidate) => candidate.id === current.eventId) || EXP_EVENTS[0];
      event = {
        title: data.title,
        text: data.text,
        choices: data.choices.map((choice) => {
          const cost = choice.cost && choice.cost.supplies ? choice.cost.supplies : 0;
          return {
            label: choice.label,
            note: `${cost ? `耗 ${cost} 干粮` : "不耗干粮"}${cost > exp.supplies ? " · 干粮不够" : ""}`,
            disabled: cost > exp.supplies
          };
        })
      };
    }

    let cardChoice = null;
    if (exp.cardChoice) {
      const trade = exp.cardChoice.source === "trade";
      const elite = exp.cardChoice.source === "elite";
      cardChoice = {
        tag: elite ? "精英" : trade ? "集市" : "营地",
        title: elite ? "旧哨站的战利品" : trade ? "货郎摊开三张牌" : "挑一张带走的牌",
        desc: elite
          ? "旧哨站里翻出三张还能用的牌。你只能带走一张。"
          : trade
            ? "“只换不卖。选一张，付 20 墨点。”"
            : "火还亮着，你可以从邮袋里挑一张牌塞进背囊。",
        hint: trade
          ? `选好后付 20 墨点；现有 ${formatNumber(state.ink)} 墨点。`
          : elite
            ? "胜者先挑，牌会留在这一趟的背囊里。"
            : "免费带走一张，牌会留在这一趟的背囊里。",
        cards: exp.cardChoice.options.map((cardId) => {
          const card = EXP_CARDS[cardId];
          return { name: card.name, desc: card.desc, power: card.power };
        })
      };
    }

    let result = null;
    if (exp.result) {
      const stored = exp.result;
      const materialText = materialGainText(stored.materials);
      const rewards = Array.isArray(stored.rewards) ? stored.rewards : [];
      const picked = stored.rewardPicked !== undefined && stored.rewardPicked !== null;
      const relicNames = state.expeditionRelics
        .map((id) => EXP_RELICS[id] && EXP_RELICS[id].name)
        .filter(Boolean);
      const unlocked = Array.isArray(stored.unlocked) ? stored.unlocked : [];
      result = {
        success: Boolean(stored.success),
        tag: stored.success ? "抵达星港" : "信留在了路上",
        title: stored.success ? "最后一班星船赶上了" : "这一趟只能到这里",
        rewardText: `带回 ${formatNumber(stored.stamps)} 张邮票、${formatNumber(stored.ink)} 墨点${stored.moon ? `、${stored.moon} 枚月光邮戳` : ""}${materialText ? `、${materialText}` : ""}。`,
        summary: stored.success
          ? "远行成功次数 +1。材料可以下次行前使用。下一趟会遇到新的路。"
          : "失败只带回 30% 的邮袋，材料留在了路上；下一次会更好。",
        unlockedText: unlocked.length ? `新牌解锁：${unlocked.join("、")}` : "",
        metaText: `背囊 ${state.expeditionDeck.length} 张${relicNames.length ? ` · 遗物 ${relicNames.join("、")}` : ""}`,
        rewards,
        picked,
        rewardName: stored.rewardName || "奖励"
      };
    }

    return {
      stage: exp.stage,
      pips,
      hearts,
      supplies: exp.supplies,
      deckCount: exp.deck.length + exp.hand.length + exp.discard.length,
      lootStamps: formatNumber(exp.result ? exp.result.stamps : exp.loot.stamps),
      lootInk: formatNumber(exp.result ? exp.result.ink : exp.loot.ink),
      log: exp.log.slice(0, 5),
      options,
      current: current
        ? {
            kind: current.kind,
            tag: expeditionOptionTag(current),
            title: current.title,
            desc: current.desc,
            need: current.need
          }
        : null,
      camp:
        current && current.kind === "camp"
          ? {
              letters: exp.letters,
              maxLetters: expeditionMaxLetters(),
              supplies: exp.supplies,
              healDisabled: exp.letters >= expeditionMaxLetters(),
              supplyDisabled: exp.supplies >= 9
            }
          : null,
      trade:
        current && current.kind === "trade"
          ? {
              stamps: state.stamps,
              ink: state.ink,
              supplies: exp.supplies,
              supplyDisabled: state.stamps < 80,
              cardDisabled: state.ink < 20
            }
          : null,
      event,
      cardChoice,
      hand: cards,
      selectedCount: selected.length,
      selectedPower: expeditionSelectedPower(),
      hasDetour,
      hasShield,
      canResolve: Boolean(cards.length && selected.length),
      result,
      confirmAbandon: expConfirmAbandon
    };
  }

  function expeditionHandlers() {
    return {
      onClose: () => renderRoutesPanel(),
      onAbandon: () => {
        expConfirmAbandon = true;
        renderExpedition();
      },
      onAbandonConfirm: () => abandonExpedition(),
      onAbandonCancel: () => {
        expConfirmAbandon = false;
        renderExpedition();
      },
      onOption: (index) => chooseExpeditionOption(index),
      onCard: (index) => toggleExpeditionCard(index),
      onResolve: () => resolveExpedition(),
      onCamp: (choice) => expeditionCamp(choice),
      onTrade: (choice) => expeditionTrade(choice),
      onEvent: (index) => expeditionEventChoice(index),
      onPickCard: (index) => chooseExpeditionCard(index),
      onClaimReward: (index) => claimExpeditionReward(index),
      onRestart: () => restartExpedition(),
      onFinish: () => closeExpeditionResult()
    };
  }

  function renderExpedition() {
    if (!state || !state.expedition) return;
    if (activeRoom !== "routes" || roomView.routes !== "expedition") return;
    let root = roomEls.routesHost.querySelector("[data-expedition-root]");
    if (!root) {
      renderExpeditionScreen();
      return;
    }
    const title = roomEls.routesHost.querySelector(".room-head h2");
    if (title) title.textContent = state.expedition.result ? "远行结算" : "雾湖远行";
    setExpeditionSnapshot(expeditionSnapshot());
    const focusTarget = roomEls.routesHost.querySelector(
      ".exp-primary, .exp-option, .exp-result-actions button"
    );
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function renderExpeditionScreen() {
    if (!state || !state.expedition || !roomEls.routesHost) {
      renderRoutesPanel();
      return;
    }
    roomView.routes = "expedition";
    unmountExpeditionPrep();
    unmountExpedition();
    roomEls.routesHost.innerHTML = `${routesHead(
      state.expedition.result ? "远行结算" : "雾湖远行",
      "苔藓镇 · 远行",
      "回邮路",
      "routes"
    )}<div data-expedition-root></div>`;
    mountExpedition(
      roomEls.routesHost.querySelector("[data-expedition-root]"),
      expeditionHandlers()
    );
    setExpeditionSnapshot(expeditionSnapshot());
    const focusTarget = roomEls.routesHost.querySelector(
      ".exp-option, .exp-primary, .exp-result-actions button"
    );
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function expeditionPrepSnapshot() {
    return {
      summary: materialSummary(),
      count: expeditionPrep.size,
      items: Object.entries(EXP_PREP).map(([id, item]) => {
        const selected = expeditionPrep.has(id);
        const permanent = id === "wax" && hasMaterialUpgrade("seal_press");
        const affordable = (state.materials[id] || 0) >= item.cost;
        return {
          id,
          name: item.name,
          cost: item.cost,
          materialName: EXP_MATERIALS[id].name,
          selected,
          permanent,
          disabled: permanent || (!selected && !affordable),
          note: permanent
            ? "封蜡台已永久生效"
            : item.desc + (!selected && !affordable ? " · 材料不够" : "")
        };
      })
    };
  }

  function openExpeditionPrep() {
    if (!state) return;
    if (!expeditionUnlocked()) {
      playDenySound();
      showToast(`累计 ${formatNumber(700)} 张邮票后，邮路会延伸到雾湖之外。`, 3200);
      return;
    }
    if (activeRoom !== "routes") navigateRoom("routes");
    expeditionPrep = new Set();
    roomView.routes = "prep";
    unmountExpedition();
    unmountExpeditionPrep();
    roomEls.routesHost.innerHTML = `${routesHead("收拾邮袋", "苔藓镇 · 远行准备", "回邮路", "routes")}<div data-exp-prep-root></div>`;
    const root = roomEls.routesHost.querySelector("[data-exp-prep-root]");
    if (!root) return;
    mountExpeditionPrep(root, {
      onToggle: (id) => toggleExpeditionPrep(id),
      onStart: () => startExpeditionWithPrep(false),
      onSkip: () => startExpeditionWithPrep(true)
    });
    setExpeditionPrepSnapshot(expeditionPrepSnapshot());
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
    setExpeditionPrepSnapshot(expeditionPrepSnapshot());
  }

  function startExpeditionWithPrep(skip = false) {
    const prep = skip ? [] : [...expeditionPrep];
    if (!startExpedition(prep)) return;
    expeditionPrep = new Set();
    openExpeditionModal();
  }

  function openExpeditionModal() {
    if (!state || !state.expedition) return;
    if (activeRoom !== "routes") navigateRoom("routes");
    expSelection = [];
    expConfirmAbandon = false;
    if (!state.expedition.result) state.expedition.active = true;
    renderExpeditionScreen();
    if (!state.expedition.result) saveGame();
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
    refreshLive();
    roomView.routes = "panel";
    navigateRoom("hall");
  }

  function restartExpedition() {
    openExpeditionPrep();
  }

  function abandonExpedition() {
    state.expedition = null;
    expConfirmAbandon = false;
    saveGame();
    refreshLive();
    roomView.routes = "panel";
    renderRoutesPanel();
    showToast("你把邮袋留在了路边，空手回到了邮局。", 3600);
  }

  function moonSnapshot() {
    const gain = currentMoonGain();
    const nextThreshold = PRESTIGE_BASE * Math.pow(gain + 1, 2);
    const contract = currentContract();
    return {
      moonStamps: formatNumber(state.moonStamps),
      points: formatNumber(moonPoints()),
      bonusPercent: moonBonusPercent(),
      branches: Object.entries(MOON_BRANCHES).map(([branchId, branchName]) => ({
        id: branchId,
        name: branchName,
        nodes: MOON_NODES.filter((node) => node.branch === branchId).map((node) => {
          const owned = nodeOwned(node);
          const fillable = !owned && nodeUnlocked(node) && moonPoints() >= node.cost;
          return {
            id: node.id,
            name: node.name,
            desc: node.desc,
            owned,
            fillable,
            reason: nodeReason(node)
          };
        })
      })),
      contracts: CONTRACTS.map((item) => {
        const active = state.contract === item.id;
        return {
          id: item.id,
          name: item.name,
          desc: item.desc,
          active,
          locked: Boolean(state.contract) && !active
        };
      }),
      contractStatus: contract ? contract.name : "本局未选择",
      progressText: `${formatNumber(state.runEarned)} / ${formatNumber(nextThreshold)}`,
      fillPercent: Math.round(completionPercent(state.runEarned, nextThreshold) * 10) / 10,
      prestigeReady: gain >= 1,
      prestigeLabel:
        gain >= 1
          ? `让夜班邮车发车 · +${gain} 枚`
          : `还差 ${formatNumber(Math.max(0, PRESTIGE_BASE - state.runEarned))}张邮票`,
      prestigeAria:
        gain >= 1
          ? `让夜班邮车发车，获得 ${gain} 枚月光邮戳`
          : "邮票还不够，夜班邮车尚未发车"
    };
  }

  const gardenBusy = new Set();

  async function guardGarden(key, action) {
    if (gardenBusy.has(key)) return;
    gardenBusy.add(key);
    try {
      await action();
    } finally {
      gardenBusy.delete(key);
    }
  }

  let nightEngine = null;
  let nightTimer = 0;
  let nightSpeed = 1;
  let nightLevel = 1;
  let nightModifierOverride = "";
  let nightNoticeId = 0;

  function todayIndex() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return Math.floor(local.getTime() / 86400000);
  }

  function currentNightModifier() {
    if (nightModifierOverride) {
      return (
        NW_MODIFIERS.find((modifier) => modifier.id === nightModifierOverride) ||
        dailyModifier()
      );
    }
    const saved = state && state.nightWatch && state.nightWatch.modifier;
    if (saved && saved.day === todayIndex()) {
      const found = NW_MODIFIERS.find((modifier) => modifier.id === saved.id);
      if (found) return found;
    }
    return dailyModifier();
  }

  function effectiveDeepFog(level) {
    if (!state || level < 16) return null;
    const choice = state.nightWatch.deepChoice;
    if (choice && choice.night === level) {
      const found = NW_DEEP_FOG.find((deep) => deep.id === choice.id);
      if (found) return found;
    }
    return deepFogFor(level);
  }

  function rerollNightDeep() {
    if (!state) return;
    const progress = state.nightWatch;
    const level = Math.max(1, progress.night);
    if (level < 16) return;
    if (progress.points < 1) {
      playDenySound();
      showToast("换雾层要 1 点守夜天赋。", 2400);
      return;
    }
    const current = effectiveDeepFog(level);
    const pool = NW_DEEP_FOG.filter((deep) => !current || deep.id !== current.id);
    const next = pool[Math.floor(Math.random() * pool.length)];
    progress.points -= 1;
    progress.deepChoice = { night: level, id: next.id };
    saveGame();
    refreshLive();
    setNightPanelSnapshot(nightPanelSnapshot());
    updateTabBadges();
    showToast(`第 ${level} 夜的雾层换成了「深雾·${next.name}」，扣 1 点守夜天赋。`, 3800);
  }

  function rerollNightModifier() {
    if (!state) return;
    const progress = state.nightWatch;
    if (progress.points < 1) {
      playDenySound();
      showToast("换词条要 1 点守夜天赋，先去守一夜吧。", 2600);
      return;
    }
    const current = currentNightModifier();
    const pool = NW_MODIFIERS.filter((modifier) => modifier.id !== current.id);
    const next = pool[Math.floor(Math.random() * pool.length)];
    progress.points -= 1;
    progress.modifier = { day: todayIndex(), id: next.id };
    saveGame();
    refreshLive();
    setNightPanelSnapshot(nightPanelSnapshot());
    updateTabBadges();
    showToast(`今天的词条换成了「${next.name}」，扣 1 点守夜天赋。`, 3800);
  }

  function nightModifierSnapshot(modifier) {
    return {
      id: modifier.id,
      name: modifier.name,
      desc: modifier.desc,
      tone: modifier.tone,
      rewardText:
        modifier.reward > 1
          ? `奖励 +${Math.round((modifier.reward - 1) * 100)}%`
          : modifier.reward < 1
            ? `奖励 -${Math.round((1 - modifier.reward) * 100)}%`
            : ""
    };
  }

  function nightPanelSnapshot() {
    const progress = state.nightWatch;
    const night = Math.max(1, progress.night);
    const towers = NW_TOWER_LIST.map((tower) => ({
      ...tower,
      unlocked: tower.unlockNight <= night
    }));
    const recipes = NW_RECIPE_LIST.map((recipe) => ({
      ...recipe,
      unlocked: recipe.unlockNight <= night
    }));
    const unlocks = [
      ...towers
        .filter((tower) => tower.unlockNight > night)
        .map((tower) => ({ at: tower.unlockNight, text: `第 ${tower.unlockNight} 夜解锁「${tower.name}」` })),
      ...recipes
        .filter((recipe) => recipe.unlockNight > night)
        .map((recipe) => ({ at: recipe.unlockNight, text: `第 ${recipe.unlockNight} 夜解锁融合「${recipe.name}」` }))
    ].sort((a, b) => a.at - b.at);
    const nextText = unlocks.length
      ? `接下来：${unlocks.slice(0, 2).map((unlock) => unlock.text).join("；")}。`
      : "守夜植物和配方都解锁了，雾只会越来越深。";
    return {
      night,
      best: progress.best,
      wins: progress.wins,
      kills: progress.kills,
      towers,
      recipes,
      towerCount: towers.filter((tower) => tower.unlocked).length,
      recipeCount: recipes.filter((recipe) => recipe.unlocked).length,
      points: progress.points,
      blockedCount: blockedCellsFor(Math.max(1, progress.night || 1)).length,
      deepUnlocked: (progress.best || 0) >= 15 || (progress.night || 1) >= 16,
      deepNext: (() => {
        const deep = effectiveDeepFog(Math.max(1, progress.night || 1));
        return deep
          ? {
              name: `深雾·${deep.name}`,
              desc: deep.desc,
              rewardText: `奖励 ×${deep.reward}`,
              canReroll: progress.points >= 1
            }
          : null;
      })(),
      modifier: {
        ...nightModifierSnapshot(currentNightModifier()),
        canReroll: progress.points >= 1
      },
      modifierList: NW_MODIFIERS.map((modifier) => ({
        id: modifier.id,
        name: modifier.name,
        desc: modifier.desc,
        tone: modifier.tone,
        today: modifier.id === currentNightModifier().id,
        rewardText: nightModifierSnapshot(modifier).rewardText
      })),
      medals: NIGHT_MEDALS.map((medal) => {
        const owned = collectibleFor("nightwatch", medal.template);
        return {
          level: medal.level,
          name: medal.name,
          icon: ICONS[medal.icon],
          edition: medal.edition,
          reached: (progress.best || 0) >= medal.level,
          owned: Boolean(owned),
          serialText: owned ? `#${owned.serial} / ${owned.edition}` : ""
        };
      }),
      history: (progress.history || []).map((run) => ({
        ...run,
        timeText: townTime(run.at)
      })),
      enemies: NW_ENEMY_LIST.map((enemy) => ({
        ...enemy,
        unlocked: enemy.unlockNight <= night
      })),
      enemyCount: NW_ENEMY_LIST.filter((enemy) => enemy.unlockNight <= night).length,
      talentSummary: nightTalentSummary(progress.talents),
      talents: NW_TALENTS.map((talent) => {
        const level = Math.max(
          0,
          Math.min(talent.max, Math.floor(progress.talents[talent.id] || 0))
        );
        const maxed = level >= talent.max;
        const cost = talentCost(level);
        return {
          ...talent,
          level,
          cost,
          maxed,
          affordable: !maxed && progress.points >= cost
        };
      }),
      nextText
    };
  }

  function nightTalentSummary(talents) {
    const bonus = talentBonus(talents);
    const parts = [];
    if (bonus.startOil) parts.push(`开局灯油 +${bonus.startOil}`);
    if (bonus.damage > 1) parts.push(`伤害 +${Math.round((bonus.damage - 1) * 100)}%`);
    if (bonus.hp > 1) parts.push(`植物生命 +${Math.round((bonus.hp - 1) * 100)}%`);
    if (bonus.baseHp) parts.push(`门板 +${bonus.baseHp}`);
    if (bonus.drip) parts.push(`灯油 +${bonus.drip.toFixed(2)}/秒`);
    if (bonus.cooldown < 1) parts.push(`冷却 -${Math.round((1 - bonus.cooldown) * 100)}%`);
    if (bonus.deepOil < 1) parts.push(`深雾油/冷惩罚 -${Math.round((1 - bonus.deepOil) * 100)}%`);
    if (bonus.deepHp < 1) parts.push(`深雾血/速加成 -${Math.round((1 - bonus.deepHp) * 100)}%`);
    return parts.length ? `当前加成：${parts.join(" · ")}` : "还没有点天赋，先攒一点。";
  }

  function renderNightPanel() {
    if (!roomEls.nightHost) return;
    roomView.night = "panel";
    unmountNightWatch();
    stopNightClock();
    nightEngine = null;
    roomEls.nightHost.innerHTML = `${routesHead("守夜防线", "苔藓镇 · 守夜")}<div data-night-panel-root></div>`;
    const root = roomEls.nightHost.querySelector("[data-night-panel-root]");
    if (!root) return;
    mountNightWatchPanel(root, {
      handlers: {
        onOpen: openNightWatch,
        onBuyTalent: buyNightTalent,
        onRerollModifier: rerollNightModifier,
        onRerollDeep: rerollNightDeep
      },
      icons: ICONS
    });
    setNightPanelSnapshot(nightPanelSnapshot());
  }

  function enterNightRoom() {
    renderNightPanel();
  }

  function closeNightRoom() {
    if (
      nightEngine &&
      (nightEngine.phase === "running" || nightEngine.phase === "break")
    ) {
      showToast("离开守夜，这一夜先放下了。", 3000);
    }
    unmountNightWatch();
    unmountNightWatchPanel();
    stopNightClock();
    nightEngine = null;
    roomView.night = "panel";
  }

  function renderNightBattle() {
    if (!roomEls.nightHost) return;
    roomView.night = "battle";
    unmountNightWatchPanel();
    roomEls.nightHost.innerHTML = `${routesHead(
      "守夜防线",
      "苔藓邮局 · 守夜",
      "回守夜",
      "night"
    )}<div data-night-watch-root></div>`;
    mountNightWatch(roomEls.nightHost.querySelector("[data-night-watch-root]"), {
      handlers: nightHandlers(),
      icons: ICONS,
      formatNumber
    });
    pushNightSnapshot();
  }

  function closeNightBattle() {
    if (
      nightEngine &&
      (nightEngine.phase === "running" || nightEngine.phase === "break") &&
      !nightEngine.snapshot().paused
    ) {
      nightEngine.togglePause();
      pushNightSnapshot();
      showToast("先暂停了。再点一次「回守夜」才会放弃这一夜。", 3600);
      return;
    }
    unmountNightWatch();
    stopNightClock();
    nightEngine = null;
    renderNightPanel();
    refreshRoomNav();
  }

  function buildNightPanel() {
    renderNightPanel();
  }

  function buyNightTalent(id) {
    if (!state) return;
    const talent = NW_TALENTS.find((item) => item.id === id);
    if (!talent) return;
    const progress = state.nightWatch;
    const level = Math.max(
      0,
      Math.min(talent.max, Math.floor(progress.talents[id] || 0))
    );
    if (level >= talent.max) {
      showToast("这一项已经点满了。", 2000);
      return;
    }
    const cost = talentCost(level);
    if (progress.points < cost) {
      playDenySound();
      showToast(`天赋点不够，还差 ${cost - progress.points} 点。`, 2200);
      return;
    }
    progress.points -= cost;
    progress.talents[id] = level + 1;
    saveGame();
    refreshLive();
    setNightPanelSnapshot(nightPanelSnapshot());
    updateTabBadges();
    showToast(`${talent.name}升到 ${level + 1} 级。`, 2400);
  }

  function pushNightSnapshot() {
    if (!nightEngine) return;
    const snapshot = nightEngine.snapshot();
    setNightWatchSnapshot(snapshot);
    for (const notice of snapshot.notices || []) {
      if (notice.id <= nightNoticeId) continue;
      nightNoticeId = notice.id;
      showToast(notice.text, 3000);
    }
  }

  function stopNightClock() {
    if (nightTimer) window.clearInterval(nightTimer);
    nightTimer = 0;
  }

  function startNightEngine(level) {
    stopNightClock();
    nightLevel = Math.max(1, Math.floor(level));
    nightSpeed = 1;
    nightNoticeId = 0;
    nightEngine = createNightWatch({
      level: nightLevel,
      talents: state.nightWatch.talents,
      modifier: currentNightModifier(),
      deepFog: effectiveDeepFog(nightLevel),
      onFinish: handleNightFinish
    });
    pushNightSnapshot();
    nightTimer = window.setInterval(() => {
      if (!nightEngine || document.hidden || !els.modal.hidden) return;
      nightEngine.tick(0.07);
      pushNightSnapshot();
    }, 70);
  }

  function handleNightFinish(result) {
    stopNightClock();
    const progress = state.nightWatch;
    progress.history = [
      {
        level: result.level,
        won: result.won,
        wave: result.wave,
        waves: result.waves,
        kills: result.kills,
        deep: Boolean(result.deepFog),
        at: Date.now()
      },
      ...(progress.history || [])
    ].slice(0, 20);
    if (!result.won) {
      saveGame();
      showToast(`第 ${result.level} 夜没守住，门板被撞开了。`, 3600);
      return;
    }
    const rewards = result.rewards;
    addStamps(rewards.stamps);
    addInk(rewards.ink);
    state.materials.paper = Math.min(
      99,
      (state.materials.paper || 0) + rewards.paper
    );
    if (rewards.wax) {
      state.materials.wax = Math.min(99, (state.materials.wax || 0) + rewards.wax);
    }
    progress.night = Math.max(progress.night, result.level + 1);
    progress.best = Math.max(progress.best, result.level);
    progress.wins += 1;
    progress.kills += result.kills;
    const talentPoints = 1 + (result.level % 5 === 0 ? 1 : 0);
    progress.points += talentPoints;
    if (NIGHT_MEDALS.some((medal) => medal.level === result.level)) {
      if (!progress.pendingMedals.includes(result.level)) {
        progress.pendingMedals.push(result.level);
      }
      if (!account || !account.token) {
        showToast(`第 ${result.level} 夜的纪念戳会等你登录后寄进邮册。`, 4600);
      }
    }
    saveGame();
    refreshLive();
    updateTabBadges();
    if (account && account.token && progress.pendingMedals.length) {
      flushNightMedals();
    }
    showToast(
      `第 ${result.level} 夜守住了，带回 ${formatNumber(rewards.stamps)} 张邮票和 ${talentPoints} 点守夜天赋。`,
      4600
    );
  }

  function recordNightFusion(result) {
    if (!result || !result.ok || !result.fused || !result.id) return false;
    const progress = state.nightWatch;
    if (!Array.isArray(progress.fusions)) progress.fusions = [];
    if (progress.fusions.includes(result.id)) return false;
    progress.fusions.push(result.id);
    saveGame();
    showToast(`守夜图鉴记下了「${result.name}」。`, 2600);
    checkAchievements();
    return true;
  }

  function nightToastForPlace(result, options = {}) {
    if (result.ok) {
      if (result.fused && !options.silentFuse) showToast(`融合成了${result.name}。`, 2200);
      return;
    }
    const messages = {
      poor: "灯油不够，再等邮票花结一点。",
      occupied: "这一格已经有植物了，换一株能融合的试试。",
      "already-fused": "这株已经融合过了。",
      "no-select": "先在下面选一张卡。",
      over: "这一夜已经结束了。",
      locked: "这一种还没解锁。",
      outside: "这里种不下。",
      blocked: "这里是雾障，种不下去。"
    };
    playDenySound();
    showToast(messages[result.code] || "这里种不下。", 2200);
  }

  function nightHandlers() {
    return {
      onStart: () => {
        if (!nightEngine) return;
        nightEngine.start();
        pushNightSnapshot();
      },
      onCard: (id) => {
        if (!nightEngine) return;
        nightEngine.select(id);
        pushNightSnapshot();
      },
      onSell: (col, row) => {
        if (!nightEngine) return;
        const result = nightEngine.sell(Number(col), Number(row));
        if (result.ok) {
          showToast(`铲掉了${result.name}，退回 ${result.refund} 灯油。`, 2200);
        } else {
          showToast("这一格没有植物。", 1800);
        }
        pushNightSnapshot();
      },
      onCell: (col, row) => {
        if (!nightEngine) return;
        const result = nightEngine.place(Number(col), Number(row));
        const isNewFusion = recordNightFusion(result);
        nightToastForPlace(result, { silentFuse: isNewFusion });
        pushNightSnapshot();
      },
      onPause: () => {
        if (!nightEngine) return;
        nightEngine.togglePause();
        pushNightSnapshot();
      },
      onSpeed: () => {
        if (!nightEngine) return;
        nightSpeed = nightSpeed === 1 ? 2 : 1;
        nightEngine.setSpeed(nightSpeed);
        pushNightSnapshot();
      },
      onRetry: () => startNightEngine(nightLevel),
      onNext: () => startNightEngine(nightLevel + 1),
      onClose: () => closeNightBattle()
    };
  }

  function openNightWatch() {
    if (!state) return;
    if (activeRoom !== "night") navigateRoom("night");
    renderNightBattle();
    startNightEngine(Math.max(1, state.nightWatch.night));
  }

  function buildMoonPanel() {
    moonBuilt = true;
    unmountMoon();
    els.panelBody.innerHTML = `<div data-moon-root></div>`;
    mountMoon(els.panelBody.querySelector("[data-moon-root]"), {
      onBuyNode: buyMoonNode,
      onSelectContract: selectContract,
      onPrestige: openPrestigeModal
    });
    const next = moonSnapshot();
    lastMoonSignature = JSON.stringify(next);
    setMoonSnapshot(next);
  }

  function refreshMoonUi() {
    if (!state || activeTab !== "moon") return;
    const next = moonSnapshot();
    const signature = JSON.stringify(next);
    if (signature === lastMoonSignature) return;
    lastMoonSignature = signature;
    setMoonSnapshot(next);
  }

  function currentMoonGain() {
    if (!state) return 0;
    return Math.floor(Math.sqrt(Math.max(0, state.runEarned) / PRESTIGE_BASE) + 1e-9);
  }

  function roomNavItems() {
    const townBadge = townUnread ? Math.min(townUnread, 9) : 0;
    const routeBadge =
      state && state.readyTrips.length ? Math.min(state.readyTrips.length, 9) : 0;
    const nightBadge =
      state && state.nightWatch.points ? Math.min(state.nightWatch.points, 9) : 0;
    return [
      { id: "hall", label: "邮局", icon: ICONS.letter, badge: 0, ariaLabel: "邮局" },
      {
        id: "town",
        label: "镇口",
        icon: ICONS.mailbox,
        badge: townBadge,
        ariaLabel: townBadge ? `镇口，${townBadge} 条新消息` : "镇口"
      },
      {
        id: "routes",
        label: "邮路",
        icon: ICONS.plane,
        badge: routeBadge,
        ariaLabel: routeBadge ? `邮路，${routeBadge} 个邮袋待取` : "邮路"
      },
      {
        id: "night",
        label: "守夜",
        icon: ICONS.star,
        badge: nightBadge,
        ariaLabel: nightBadge ? `守夜，${nightBadge} 点天赋待分配` : "守夜"
      }
    ];
  }

  function refreshRoomNav() {
    const items = roomNavItems();
    const signature = JSON.stringify({ active: activeRoom, items });
    if (signature === roomNavSignature) return;
    roomNavSignature = signature;
    setRoomNavSnapshot({ active: activeRoom, items });
  }

  function showRoom(name) {
    ROOM_NAMES.forEach((room) => {
      const element = roomEls[room];
      if (element) element.hidden = room !== name;
    });
    document.body.dataset.room = name;
  }

  function leaveHallRoom() {
    unmountOrders();
    unmountWorkshop();
    unmountAlbum();
    unmountMoon();
  }

  function enterHallRoom() {
    if (!TAB_NAMES.includes(activeTab)) activeTab = "posties";
    switchTab(activeTab);
  }

  function navigateRoom(name, options = {}) {
    const next = ROOM_NAMES.includes(name) ? name : "hall";
    if (!options.force && next === activeRoom) {
      if (!options.fromHash) writeRoomHash(next);
      return;
    }
    if (activeRoom === "town" && next !== "town") {
      unmountTown();
      unmountFriendGarden();
      unmountFriendProfile();
      unmountPostcardComposer();
    }
    if (activeRoom === "routes" && next !== "routes") closeRoutesRoom();
    if (activeRoom === "night" && next !== "night") closeNightRoom();
    if (activeRoom === "hall" && next !== "hall") leaveHallRoom();
    if (!els.modal.hidden) closeModal();

    activeRoom = next;
    showRoom(next);
    if (!options.fromHash) writeRoomHash(next);

    if (next === "town") enterTownRoom();
    else if (next === "routes") enterRoutesRoom();
    else if (next === "night") enterNightRoom();
    else enterHallRoom();

    refreshRoomNav();
    updateTabBadges();
  }

  function prefetchRoom(room) {
    if (room === "town") prefetchTown();
  }

  function initRoomShell() {
    mountRoomNav(roomEls.nav, {
      handlers: {
        onNavigate: (room) => navigateRoom(room),
        onPrefetch: prefetchRoom
      }
    });
    if (roomEls.routesHost) {
      roomEls.routesHost.addEventListener("click", (event) => {
        const back = event.target.closest("[data-room-back]");
        if (back) {
          if (back.dataset.roomBack === "routes") renderRoutesPanel();
          else navigateRoom(back.dataset.roomBack || "hall");
          return;
        }
        if (event.target.closest("[data-expedition-open]")) {
          openExpedition();
          return;
        }
        const scene = event.target.closest("[data-scene]");
        if (scene) return;
        const routeButton = event.target.closest("[data-route-start]");
        if (routeButton) {
          startDispatch(routeButton.dataset.routeStart, event.detail === 0);
          return;
        }
        const collectButton = event.target.closest("[data-collect-dispatch]");
        if (collectButton) {
          collectDispatches(
            [Number(collectButton.dataset.collectDispatch)],
            event.detail === 0
          );
          return;
        }
        if (event.target.closest("#collectAllDispatch")) {
          collectDispatches(
            state.readyTrips.map((trip) => trip.id),
            event.detail === 0
          );
          return;
        }
        const rushButton = event.target.closest("[data-rush-trip]");
        if (rushButton) {
          rushTrip(Number(rushButton.dataset.rushTrip), event.detail === 0);
        }
      });
    }
    if (roomEls.nightHost) {
      roomEls.nightHost.addEventListener("click", (event) => {
        const back = event.target.closest("[data-room-back]");
        if (!back) return;
        if (back.dataset.roomBack === "night") closeNightBattle();
        else navigateRoom(back.dataset.roomBack || "hall");
      });
    }
    if (roomEls.townHost) {
      roomEls.townHost.addEventListener("click", (event) => {
        if (event.target.closest("[data-town-home]")) {
          navigateRoom("hall");
          return;
        }
        if (event.target.closest("[data-town-back]")) {
          renderTownScreen();
          return;
        }
        if (event.target.closest("[data-town-login]")) {
          openAccountModal();
          return;
        }
        if (event.target.closest("[data-town-refresh]")) loadTown();
      });
    }
    refreshRoomNav();
    onRoomHashChange((room) => navigateRoom(room, { fromHash: true }));
    navigateRoom(currentRoom(), { fromHash: true, force: true });
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
    if (name !== "orders") unmountOrders();
    if (name !== "album") unmountAlbum();
    if (name !== "moon") unmountMoon();
    if (name !== "upgrades") unmountWorkshop();
    if (name !== "night") unmountNightWatchPanel();

    if (name === "posties") {
      buildShopPanel();
      refreshShopUi();
    } else if (name === "orders") {
      syncOrders();
      buildOrdersPanel();
      refreshOrdersUi();
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

    const nightPoints = Math.max(0, Math.floor((state.nightWatch && state.nightWatch.points) || 0));
    setText(els.nightDot, String(Math.min(nightPoints, 9)));
    setHidden(els.nightDot, nightPoints === 0);

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
    if (els.quickStampBtn) {
      els.quickStampBtn.setAttribute(
        "aria-label",
        `快捷盖戳，固定不错 ×1.5，获得 ${formatGain(quickClick)}张邮票`
      );
    }

    setText(els.quickStamps, formatNumber(Math.floor(state.stamps)));
    setText(els.quickRate, `+${formatRate(rate)}/秒`);
    setText(els.quickGain, `+${formatGain(quickClick)}`);

    updateBellUi();
    updateTabBadges();
    refreshRoomNav();
    if (activeRoom === "routes") refreshDispatchUi();
    if (activeRoom === "night" && roomView.night === "panel") {
      setNightPanelSnapshot(nightPanelSnapshot());
    }
    if (activeRoom !== "hall") return;
    if (activeTab === "posties") refreshShopUi();
    else if (activeTab === "orders") refreshOrdersUi();
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
    unmountAccount();
    unmountSeedModal();
    unmountInfoModal();
    unmountEventModal();
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
    if (els.modalClose) els.modalClose.hidden = options.footer !== false;
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
    unmountAccount();
    unmountSeedModal();
    unmountInfoModal();
    unmountEventModal();
    els.modal.hidden = true;
    document.body.style.overflow = "";
    modalAction = null;
    eventOpen = false;
    activeEvent = null;
    const actions = els.modal.querySelector(".modal-actions");
    if (actions) actions.hidden = false;
    const card = els.modal.querySelector(".modal-card");
    if (card) card.classList.remove("is-wide");
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

  function openInfoModal(options) {
    openModal({
      title: options.title,
      body: `<div data-info-root></div>`,
      footer: options.footer,
      showCancel: options.showCancel,
      confirmLabel: options.confirmLabel,
      tone: options.tone,
      kicker: options.kicker,
      action: options.action
    });
    const root = els.modalBody.querySelector("[data-info-root]");
    if (!root) return;
    mountInfoModal(root);
    setInfoSnapshot({ blocks: options.blocks });
  }

  function openHelpModal() {
    const tips = [
      "盖戳时，等小圆点转进底部的金色弧线内再点：完美 ×3，并得到 1 枚墨点。连击越高，圆点转得越快。",
      "同一线路的小邮差达到 10、25、50 位时，会触发线路里程碑，产出变为 ×1.5、×2、×2.5。",
      "苔藓镇每两分半换一次天气，会给不同线路或蜡封盖戳带来额外倍率。",
      "手边的风铃每 90 秒能摇一次，摇响后 20 秒内全邮局产出 ×3；有些来信要求整单不摇铃。",
      "邮路柜台能同时派两位邮差出门，月光树还能再加一位。短程回信快，远程带回来的邮票更多；每完成 3 趟，熟练度升一级。",
      "柜台来信有条件和时限，完成给邮票和墨点；每完成 4 封，夜班邮车会留下 1 枚月光邮戳。",
      "墨点可以换一批来信，也能让在途的邮路立刻回来。它来自完美盖戳和柜台来信。",
      "攒够 30,000 张邮票，夜班邮车会带来月光邮戳。用邮戳点亮月光树：每 1 点全局 +10%，节点永久保留；每程还能选一个夜班契约。",
      "集邮册会记录特别的小事。每贴上一枚纪念邮票，所有产出永久再多一点。",
      "偶尔会飘来闪光的信。离开时小邮差仍会送信，收益默认按一半计算，最多两小时；月光树能延长它。",
      "邮册会自动合上并保存。手机端直接点舞台上的大蜡封即可；没有额外的快捷盖戳入口。",
      "邮路还能延伸到雾湖之外：随机地图、邮差牌、信件与干粮。失败只丢这一趟，奖励和月光邮戳会回流邮局。"
    ];
    openInfoModal({
      title: "怎么经营一间苔藓邮局",
      showCancel: false,
      confirmLabel: "知道啦",
      blocks: [
        { type: "p", runs: [{ t: "点击大蜡封寄出一封信，邮票就是这间邮局的心跳。" }] },
        {
          type: "list",
          items: tips.map((text, index) => ({ n: String(index + 1), text }))
        }
      ]
    });
  }

  function openResetModal() {
    openInfoModal({
      title: "重新开张？",
      tone: "danger",
      confirmLabel: "全部重置",
      blocks: [
        {
          type: "p",
          runs: [
            {
              t: "这一程的邮票、小邮差、工坊邮戳、风铃、邮路、柜台来信、远行、月光树、墨点和集邮册都会一起被收走，在途的邮差也会回来。"
            }
          ]
        },
        { type: "p", runs: [{ t: "苔藓镇会回到第一天。确定要重新开张吗？" }] }
      ],
      action: resetGame
    });
  }

  function openPrestigeModal() {
    if (!state) return;
    const gain = currentMoonGain();
    if (gain < 1) return;
    openInfoModal({
      title: "让夜班邮车出发？",
      confirmLabel: "发车",
      blocks: [
        {
          type: "p",
          runs: [
            { t: "夜班邮车会收走这一程的 " },
            { t: formatNumber(state.stamps), strong: true },
            { t: "张邮票、所有小邮差、工坊邮戳和手上的来信。" }
          ]
        },
        {
          type: "p",
          runs: [
            { t: "你会留下 " },
            { t: `${gain} 枚月光邮戳`, strong: true },
            {
              t: "，可以去月光树点一盏灯。集邮册、邮路熟练度、墨点和在途的邮差都会留到下一程；夜班契约会清空，下程重新选。"
            }
          ]
        }
      ],
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

  function resetLocalForNewOwner() {
    const keepSound = state.sound;
    state = createInitialState(keepSound);
    ownedUpgradeSet = new Set();
    achievementSet = new Set();
    goalsDoneSet = new Set();
    unseenAchievements = 0;
    combo = 0;
    comboTimer = 0;
    stampAnchor = performance.now();
    ensureOffers();
    updateGoals();
    refreshLive();
    saveGame();
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
    if (error && /cannot add yourself/i.test(error.message || "")) {
      return "不能加自己。";
    }
    if (error && error.status >= 500) {
      return "邮局服务器有点忙，稍后再试。";
    }
    if (error && /quest is not ready/i.test(error.message || "")) {
      return "还没收到这份菜，先种再收。";
    }
    if (error && /cannot plant here/i.test(error.message || "")) {
      return "这块地已经种上了，先收掉再说。";
    }
    if (error && /cannot water now/i.test(error.message || "")) {
      return "现在不用浇水。";
    }
    if (error && /cannot water this plot/i.test(error.message || "")) {
      return "这块地现在不需要浇水，或者已经浇过了。";
    }
    if (error && /cannot water your own plot/i.test(error.message || "")) {
      return "自己的地自己浇。";
    }
    if (error && /crop is not ripe/i.test(error.message || "")) {
      return "还没熟，再等等。";
    }
    if (error && /nothing to steal/i.test(error.message || "")) {
      return "这块地已经被偷过了，换一块吧。";
    }
    if (error && /cannot steal from yourself/i.test(error.message || "")) {
      return "不能偷自己的菜。";
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

  function mountAccountView() {
    const root = document.querySelector("[data-account-root]");
    if (!root) return;
    mountAccount(root, {
      account,
      status: cloudStatusText(),
      base: account ? account.base : accountBaseDraft,
      onSubmit: submitAccount,
      onLogout: accountLogout,
      onSync: cloudPushNow,
      onPull: accountPullOverride,
      onPush: accountPushOverride
    });
  }

  function renderAccountModal() {
    if (!els.modal || els.modal.hidden) return;
    if (!els.modalBody.querySelector("[data-account-root]")) return;
    mountAccountView();
  }

  function openAccountModal() {
    openModal({
      title: "账号与云存档",
      body: `<div data-account-root></div>`,
      footer: false,
      kicker: "苔藓邮局 · 云端"
    });
    mountAccountView();
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
    if (account && account.token && !readSaveOwner()) writeSaveOwner(account.userId);
    refreshAccountButton();
    if (account && account.token) {
      setTimeout(() => {
        cloudBootstrap();
      }, 800);
      setTimeout(prefetchTown, 1800);
    }
  }

  async function cloudBootstrap() {
    if (!account || !account.token || !state) return;
    try {
      const info = await cloudApi.me(account);
      if (info && info.username) account.username = info.username;
      const remote = await cloudApi.pull(account);
      if (cloudRecoveryPending) {
        if (remote && remote.payload && typeof remote.payload === "object") {
          cloudRecoveryPending = false;
          suppressSaves = false;
          account.revision = remote.revision;
          account.dirty = false;
          account.conflict = 0;
          cloudApi.saveAccount(account);
          showToast("本地存档读不出来，已从云端恢复。", 6000);
          applyRemoteSave(remote.payload);
          return;
        }
        cloudRecoveryPending = false;
        suppressSaves = false;
        showToast("本地存档读不出来，云端也没有备份，只能从新开始。", 7000);
      }
      if (!remote) {
        account.revision = 0;
        account.dirty = true;
        cloudApi.saveAccount(account);
        scheduleCloudPush(500);
        flushNightMedals();
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
      flushNightMedals();
    } catch (error) {
      if (error.status === 401) {
        account.token = "";
        cloudApi.saveAccount(account);
        refreshAccountButton();
        showToast("登录已过期，请重新登录。", 5000);
      }
    }
  }

  async function submitAccount(payload = {}) {
    const mode = payload.mode === "register" ? "register" : "login";
    const username = String(payload.username || "").trim();
    const password = String(payload.password || "");
    const base = String(payload.base || accountBaseDraft).trim() || accountBaseDraft;
    accountBaseDraft = base;

    if (username.length < 3 || username.length > 24) {
      return { ok: false, message: "用户名需要 3-24 个字符。" };
    }
    if (password.length < 8) {
      return { ok: false, message: "密码至少 8 位。" };
    }

    try {
      const verifier = await deriveVerifier(username, password);
      if (mode === "register") {
        const resetForNewOwner = Boolean(readSaveOwner());
        if (resetForNewOwner) resetLocalForNewOwner();
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
        writeSaveOwner(result.user_id);
        refreshAccountButton();
        renderAccountModal();
        flushNightMedals();
        if (activeRoom === "town") loadTown();
        else prefetchTown();
        showToast(
          resetForNewOwner
            ? "账号建好了，换上了一本新的邮册。"
            : "账号建好了，本地存档已经一起寄上去。",
          4600
        );
        return { ok: true };
      }

      const loginChallenge = await cloudApi.challenge({ base, username });
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
      writeSaveOwner(pending.userId);
      const remote = await cloudApi.pull(pending);
      if (remote) {
        pending.revision = remote.revision;
        cloudApi.saveAccount(pending);
        applyRemoteSave(remote.payload);
        return { ok: true };
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
      flushNightMedals();
      if (activeRoom === "town") loadTown();
      else prefetchTown();
      showToast("服务器上还没有存档，已把本地存档传上去。", 4600);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: cloudErrorMessage(error) };
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
    if (activeRoom === "town") renderTownScreen();
    refreshRoomNav();
    showToast("已退出账号，本机存档还在。", 3600);
  }

  async function accountPullOverride() {
    if (!account || !account.token) return;
    showToast("正在读取云端存档…", 1600);
    try {
      const remote = await cloudApi.pull(account);
      if (cloudRecoveryPending) {
        if (remote && remote.payload && typeof remote.payload === "object") {
          cloudRecoveryPending = false;
          suppressSaves = false;
          account.revision = remote.revision;
          account.dirty = false;
          account.conflict = 0;
          cloudApi.saveAccount(account);
          showToast("本地存档读不出来，已从云端恢复。", 6000);
          applyRemoteSave(remote.payload);
          return;
        }
        cloudRecoveryPending = false;
        suppressSaves = false;
        showToast("本地存档读不出来，云端也没有备份，只能从新开始。", 7000);
      }
      if (!remote) {
        showToast("云端没有存档。", 2800);
        return;
      }
      account.revision = remote.revision;
      account.dirty = false;
      account.conflict = 0;
      cloudApi.saveAccount(account);
      applyRemoteSave(remote.payload);
    } catch (error) {
      showToast(cloudErrorMessage(error), 3600);
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

  function updateTownButton() {
    if (els.townDot) els.townDot.hidden = townUnread <= 0;
    if (els.townBtn) {
      els.townBtn.classList.toggle("has-mail", townUnread > 0);
      els.townBtn.setAttribute(
        "aria-label",
        townUnread > 0 ? `镇口，有 ${townUnread} 条新消息` : "镇口"
      );
    }
  }

  function townAvatar(name) {
    const icons = ["snail", "mushroom", "plane", "star", "mailbox", "letter", "tote", "boat", "fern", "wind"];
    let hash = 0;
    for (const character of String(name || "")) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return `<span class="town-avatar" aria-hidden="true">${ICONS[icons[hash % icons.length]]}</span>`;
  }

  function giftLabel(kind, amount) {
    if (kind === "ink") return `墨点×${amount}`;
    if (kind === "stamps") return `邮票×${formatNumber(amount)}`;
    if (EXP_MATERIALS[kind]) return `${EXP_MATERIALS[kind].name}×${amount}`;
    return `${kind}×${amount}`;
  }

  function mergeCollectibles(items) {
    if (!Array.isArray(items) || !items.length) return 0;
    const map = new Map(
      state.collectibles.map((item) => [`${item.kind}:${item.template}`, item])
    );
    let added = 0;
    items.forEach((item) => {
      if (!item || typeof item.kind !== "string" || typeof item.template !== "string") return;
      const key = `${item.kind}:${item.template}`;
      if (map.has(key)) return;
      map.set(key, item);
      added += 1;
    });
    if (added) state.collectibles = [...map.values()].slice(-80);
    return added;
  }

  async function flushNightMedals() {
    if (!state || !account || !account.token) return;
    if (!state.nightWatch.pendingMedals.length) return;
    for (let attempt = 0; attempt < 12 && cloudPushing; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    if (!cloudPushing && !account.conflict) {
      try {
        await cloudPushNow();
      } catch (error) {
        /* keep pending medals and retry later */
      }
    }
    for (const level of [...state.nightWatch.pendingMedals]) {
      try {
        const result = await cloudApi.claimNightWatch(account, level);
        const collectible = result && result.collectible;
        if (collectible) {
          mergeCollectibles([collectible]);
          showToast(
            `第 ${level} 夜的纪念戳寄到了：#${collectible.serial} / ${collectible.edition}。`,
            5000
          );
        } else {
          showToast(`第 ${level} 夜的纪念戳已经领过，或者这一版发完了。`, 3600);
        }
        state.nightWatch.pendingMedals = state.nightWatch.pendingMedals.filter(
          (item) => item !== level
        );
        saveGame();
      } catch (error) {
        break;
      }
    }
    refreshLive();
  }

  function collectibleFor(kind, template) {
    return state.collectibles.find(
      (item) => item.kind === kind && item.template === template
    );
  }

  function gardenPercent(plot) {
    const total = Math.max(1, plot.ripe_at - plot.planted_at);
    if (plot.ripe) return 100;
    return Math.min(100, Math.max(0, ((Date.now() / 1000 - plot.planted_at) / total) * 100));
  }

  function gardenRewardText(reward) {
    if (!reward) return "";
    if (reward.crop === "stamp" || reward.crop === "starchild") {
      return `邮票×${formatNumber(reward.amount * 250)}`;
    }
    if (reward.crop === "inkberry" || reward.crop === "mooncap") {
      return `墨点×${reward.amount}`;
    }
    return `纸×${reward.amount}`;
  }

  function applyGardenReward(reward) {
    if (!reward) return;
    const amount = Math.max(1, Number(reward.amount) || 1);
    if (reward.crop === "stamp" || reward.crop === "starchild") addStamps(amount * 250);
    else if (reward.crop === "inkberry" || reward.crop === "mooncap") addInk(amount);
    else state.materials.paper = Math.min(99, (state.materials.paper || 0) + amount);
    saveGame();
    refreshLive();
  }

  function gardenCropRewardText(crop, amount) {
    if (crop === "stamp" || crop === "starchild") {
      return `邮票×${formatNumber(amount * 250)}`;
    }
    if (crop === "inkberry" || crop === "mooncap") return `墨点×${amount}`;
    return `纸×${amount}`;
  }

  function seedSnapshot(plot) {
    const harvests = (townData && townData.garden && townData.garden.harvests) || 0;
    return {
      plot: Number(plot),
      crops: Object.entries(GARDEN_CROP_NAMES).map(([crop, name]) => {
        const unlockAt = GARDEN_CROP_UNLOCK[crop] || 0;
        return {
          id: crop,
          name,
          minutes: GARDEN_CROP_MINUTES[crop],
          reward: gardenCropRewardText(crop, GARDEN_CROP_YIELD[crop]),
          unlocked: unlockAt <= harvests,
          unlockAt,
          icon: ICONS[GARDEN_ICONS[crop] || "letter"]
        };
      })
    };
  }

  function openSeedModal(plot) {
    openModal({
      title: "选种",
      body: `<div data-seed-root></div>`,
      footer: false,
      kicker: "后院 · 选种"
    });
    const root = els.modalBody.querySelector("[data-seed-root]");
    if (!root) return;
    mountSeedModal(root, {
      onPick: (crop) => plantGardenPlot(Number(plot), crop)
    });
    setSeedSnapshot(seedSnapshot(plot));
  }

  async function claimDailyGardenQuest() {
    return guardGarden("quest", async () => {
      if (!account || !account.token) return;
      try {
        const result = await cloudApi.claimGardenQuest(account);
        const reward = result.reward || {};
        if (reward.kind === "stamps") addStamps(reward.amount);
        else if (reward.kind === "paper") {
          state.materials.paper = Math.min(99, (state.materials.paper || 0) + reward.amount);
        } else if (reward.kind === "ink") addInk(reward.amount);
        saveGame();
        refreshLive();
        showToast(`柜台收下了菜，给你 ${reward.kind === "stamps" ? `邮票×${formatNumber(reward.amount)}` : reward.kind === "paper" ? `纸×${reward.amount}` : `墨点×${reward.amount}`}。`, 3600);
        await loadTown();
      } catch (error) {
        showToast(cloudErrorMessage(error), 3200);
      }
    });
  }

  async function plantGardenPlot(plot, crop) {
    return guardGarden(`plant:${plot}`, async () => {
      if (!account || !account.token) return;
      try {
        await cloudApi.plantPlot(account, plot, crop);
        showToast(`种下了${GARDEN_CROP_NAMES[crop] || "种子"}。`, 2800);
        openTown();
      } catch (error) {
        showToast(cloudErrorMessage(error), 3200);
      }
    });
  }

  async function waterGardenPlot(plot) {
    return guardGarden(`water:${plot}`, async () => {
      if (!account || !account.token) return;
      try {
        await cloudApi.waterPlot(account, plot);
        showToast("浇了水，成熟时间缩短了 25%。", 3000);
        await loadTown();
      } catch (error) {
        showToast(cloudErrorMessage(error), 3200);
      }
    });
  }

  async function harvestGardenPlot(plot) {
    return guardGarden(`harvest:${plot}`, async () => {
      if (!account || !account.token) return;
      try {
        const result = await cloudApi.harvestPlot(account, plot);
        applyGardenReward(result.reward);
        showToast(`收下了 ${gardenRewardText(result.reward)}。`, 3400);
        await loadTown();
      } catch (error) {
        showToast(cloudErrorMessage(error), 3200);
      }
    });
  }

  async function helpGardenPlot(ownerId, plot) {
    return guardGarden(`help:${ownerId}:${plot}`, async () => {
      if (!account || !account.token) return;
      try {
        await cloudApi.helpPlot(account, ownerId, plot);
        showToast("帮对方浇了水，成熟时间缩短了 25%。", 3200);
        await openGardenModal(ownerId);
      } catch (error) {
        showToast(cloudErrorMessage(error), 3200);
      }
    });
  }

  async function stealGardenPlot(ownerId, plot) {
    return guardGarden(`steal:${ownerId}:${plot}`, async () => {
      if (!account || !account.token) return;
      try {
        const result = await cloudApi.stealPlot(account, ownerId, plot);
        applyGardenReward(result.reward);
        showToast(`偷到了 ${gardenRewardText(result.reward)}。`, 3400);
        await openGardenModal(ownerId);
      } catch (error) {
        showToast(cloudErrorMessage(error), 3200);
      }
    });
  }

  function friendGardenSnapshot(garden, ownerId) {
    const owner = garden.owner || {};
    const plots = (garden.plots || []).map((plot) => {
      const ripe = Boolean(plot.ripe);
      const empty = Boolean(plot.empty);
      const iconName = GARDEN_ICONS[plot.crop] || "letter";
      const status = empty
        ? ""
        : `${plot.watered ? "已浇水 · " : ""}${
            ripe
              ? "可以收了"
              : `还差 ${formatDuration(Math.max(0, plot.ripe_at - Date.now() / 1000))}`
          }`;
      return {
        plot: plot.plot,
        empty,
        ripe,
        watered: Boolean(plot.watered),
        stolen: plot.stolen || 0,
        name: plot.name || "空地",
        status,
        percent: empty ? 0 : Math.round(gardenPercent(plot)),
        icon: ICONS[iconName]
      };
    });
    return {
      status: "ready",
      ownerId,
      owner: {
        name: owner.name || "一位邮差",
        kind: owner.kind || "user"
      },
      plots
    };
  }

  async function openGardenModal(ownerId) {
    if (!account || !account.token) return;
    if (activeRoom !== "town") navigateRoom("town");
    townView = "garden";
    unmountTown();
    unmountPostcardComposer();
    roomEls.townHost.innerHTML = `
      <div class="room-head">
        <div>
          <p class="room-kicker">镇口 · 后院</p>
          <h2>后院</h2>
        </div>
        <button class="link-btn room-back" type="button" data-town-back>回镇口</button>
      </div>
      <div data-garden-root></div>`;
    const root = roomEls.townHost.querySelector("[data-garden-root]");
    if (!root) return;
    mountFriendGarden(root, {
      onSteal: (plot) => stealGardenPlot(ownerId, Number(plot)),
      onHelp: (plot) => helpGardenPlot(ownerId, Number(plot)),
      onBack: () => renderTownScreen()
    });
    setFriendGardenSnapshot({ status: "loading" });
    try {
      const garden = await cloudApi.friendGarden(account, ownerId);
      setFriendGardenSnapshot(friendGardenSnapshot(garden, ownerId));
    } catch (error) {
      setFriendGardenSnapshot({
        status: "error",
        error: cloudErrorMessage(error)
      });
    }
  }

  function mountTownView() {
    const root = roomEls.townHost
      ? roomEls.townHost.querySelector("[data-town-root]")
      : null;
    if (!root || !townData) return;
    mountTown(root, {
      data: townData,
      account,
      helpers: {
        icons: Object.fromEntries(
          Object.entries(GARDEN_ICONS).map(([crop, icon]) => [crop, ICONS[icon]])
        ),
        materials: EXP_MATERIALS,
        formatNumber,
        timeText: townTime,
        avatarFor: townAvatar
      },
      onRefresh: loadTown,
      onCopyCode: copyFriendCode,
      onFriendAdd: addFriendByCode,
      onAcceptFriend: acceptFriendRequest,
      onDeclineFriend: declineFriendRequest,
      onRemoveFriend: removeFriendById,
      onFriendProfile: openFriendProfile,
      onVisitFriend: visitFriendById,
      onGardenOpen: openGardenModal,
      onSendPostcard: openPostcardComposer,
      onClaimPostcard: claimTownPostcard,
      onHarvest: harvestGardenPlot,
      onWater: waterGardenPlot,
      onOpenSeeds: openSeedModal,
      onClaimQuest: claimDailyGardenQuest
    });
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
    return `<div data-town-root></div>`;
  }

  async function enterTownRoom() {
    townError = "";
    if (!account || !account.token) {
      townLoading = false;
      renderTownScreen();
      return;
    }
    const wasPrefetching = Boolean(townPrefetching);
    if (wasPrefetching) {
      try {
        await townPrefetching;
      } catch (error) {
        /* loadTown below retries */
      }
    }
    if (townData) {
      townLoading = false;
      renderTownScreen();
      if (!wasPrefetching) loadTown();
      return;
    }
    townLoading = true;
    renderTownScreen();
    loadTown();
  }

  function renderTownScreen() {
    if (!roomEls.townHost) return;
    townView = "main";
    unmountTown();
    unmountFriendGarden();
    unmountFriendProfile();
    unmountPostcardComposer();
    roomEls.townHost.innerHTML = `
      <div class="room-head">
        <div>
          <p class="room-kicker">苔藓镇 · 镇口</p>
          <h2>镇口</h2>
        </div>
        <button class="link-btn room-back" type="button" data-town-home>回邮局</button>
      </div>
      ${townMarkup()}`;
    if (townData) mountTownView();
    updateTownButton();
  }

  let townPrefetching = null;

  async function fetchTownData() {
    const [square, mailbox, friendData, owned, ownGarden] = await Promise.all([
      cloudApi.square(account),
      cloudApi.postcards(account),
      cloudApi.friends(account),
      cloudApi.collectibles(account),
      cloudApi.garden(account)
    ]);
    const addedCollectibles = mergeCollectibles(owned);
    if (addedCollectibles) saveGame();
    townData = {
      players: Array.isArray(square && square.players) ? square.players : [],
      cards: Array.isArray(mailbox && mailbox.cards) ? mailbox.cards : [],
      friends: friendData || { code: "", friends: [], incoming: [], outgoing: [] },
      collectibles: Array.isArray(owned) ? owned : [],
      garden: ownGarden || null
    };
    townUnread =
      townData.cards.filter((card) => card.gift_kind && !card.claimed).length +
      (townData.friends.incoming || []).length +
      ((townData.garden && townData.garden.plots) || []).filter((plot) => plot.ripe).length +
      (townData.garden && townData.garden.quest &&
      townData.garden.quest.progress >= townData.garden.quest.amount &&
      !townData.garden.quest.claimed
        ? 1
        : 0);
    refreshRoomNav();
    return townData;
  }

  function prefetchTown() {
    if (!account || !account.token || townData || townPrefetching) return;
    townPrefetching = fetchTownData()
      .catch(() => {})
      .finally(() => {
        townPrefetching = null;
      });
  }

  async function loadTown() {
    if (!account || !account.token) {
      renderTownScreen();
      return;
    }
    townLoading = true;
    townError = "";
    if (activeRoom === "town" && townView === "main") renderTownScreen();
    try {
      await fetchTownData();
      townLoading = false;
      if (activeRoom === "town" && townView === "main") renderTownScreen();
    } catch (error) {
      townLoading = false;
      if (error.status === 401) {
        account.token = "";
        cloudApi.saveAccount(account);
        refreshAccountButton();
      }
      townError = cloudErrorMessage(error);
      if (activeRoom === "town" && townView === "main") renderTownScreen();
    }
  }

  function openTown() {
    if (els.modal && !els.modal.hidden) closeModal();
    if (activeRoom !== "town") {
      navigateRoom("town");
      return;
    }
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

  async function addFriendByCode(codeOverride) {
    if (!account || !account.token) return;
    const input = document.getElementById("friendCodeInput");
    const code = String(codeOverride || (input && input.value) || "").trim().toUpperCase();
    if (code.length !== 6) {
      showToast("好友码是 6 位，字母和数字都可以。", 3000);
      return;
    }
    try {
      const result = await cloudApi.requestFriend(account, code);
      if (result && result.status === "friends") {
        showToast("你们已经是好友了。", 3200);
      } else {
        showToast("好友申请已经送出。", 3200);
      }
      await loadTown();
    } catch (error) {
      showToast(cloudErrorMessage(error), 3600);
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

  async function visitFriendById(id, options = {}) {
    if (!account || !account.token) return;
    try {
      const result = await cloudApi.visitFriend(account, id);
      if (result && result.first_today) {
        showToast("留了一枚访客邮戳。", 2800);
      } else {
        showToast("今天已经来过这位朋友家了。", 2800);
      }
      if (options.refresh !== false) await loadTown();
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
    if (activeRoom !== "town") navigateRoom("town");
    townView = "profile";
    unmountTown();
    unmountFriendGarden();
    unmountPostcardComposer();
    unmountFriendProfile();
    roomEls.townHost.innerHTML = `
      <div class="room-head">
        <div>
          <p class="room-kicker">镇口 · 好友</p>
          <h2>串门</h2>
        </div>
        <button class="link-btn room-back" type="button" data-town-back>回镇口</button>
      </div>
      <div data-friend-profile-root></div>`;
    const root = roomEls.townHost.querySelector("[data-friend-profile-root]");
    if (!root) return;
    let friendData = {};
    mountFriendProfile(root, {
      onSend: () =>
        openPostcardComposer(
          friendData.id || id,
          "user",
          friendData.username || "好友"
        ),
      onVisit: async () => {
        await visitFriendById(friendData.id || id, { refresh: false });
        openFriendProfile(friendData.id || id);
      },
      onBack: () => renderTownScreen()
    });
    setFriendProfileSnapshot({ status: "loading" });
    try {
      const profile = await cloudApi.friendProfile(account, id);
      friendData = profile.friend || {};
      setFriendProfileSnapshot({
        status: "ready",
        friend: {
          name: friendData.username || "一位邮差",
          code: friendData.friend_code || "------",
          stamps: formatNumber(friendData.total_stamps || 0),
          wins: formatNumber(friendData.expedition_wins || 0),
          postcards: formatNumber(profile.postcards_received || 0),
          visits: formatNumber(profile.visits_received || 0),
          activeText: townTime(friendData.last_active || 0)
        }
      });
    } catch (error) {
      setFriendProfileSnapshot({
        status: "error",
        error: cloudErrorMessage(error)
      });
    }
  }

  function postcardComposerSnapshot(extra = {}) {
    return {
      templates: POSTCARD_TEMPLATES.map((template) => ({
        id: template.id,
        text: template.text
      })),
      status: "",
      sending: false,
      ...extra
    };
  }

  function openPostcardComposer(id, kind, name) {
    postcardTarget = { id, kind, name };
    if (activeRoom !== "town") navigateRoom("town");
    townView = "composer";
    unmountTown();
    unmountFriendGarden();
    roomEls.townHost.innerHTML = `
      <div class="room-head">
        <div>
          <p class="room-kicker">镇口 · 明信片</p>
          <h2>给 ${escapeHtml(name)} 寄明信片</h2>
        </div>
        <button class="link-btn room-back" type="button" data-town-back>回镇口</button>
      </div>
      <div data-postcard-root></div>`;
    const root = roomEls.townHost.querySelector("[data-postcard-root]");
    if (!root) return;
    mountPostcardComposer(root, {
      onSend: (templateId) => sendTownPostcard(templateId),
      onBack: () => renderTownScreen()
    });
    setPostcardComposerSnapshot(postcardComposerSnapshot());
  }

  async function sendTownPostcard(templateId) {
    if (!postcardTarget || !account || !account.token) return;
    setPostcardComposerSnapshot(
      postcardComposerSnapshot({
        sending: true,
        status: "正在把明信片送出去…"
      })
    );
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
      townView = "main";
      loadTown();
    } catch (error) {
      setPostcardComposerSnapshot(
        postcardComposerSnapshot({
          status: cloudErrorMessage(error)
        })
      );
    }
  }

  function addPostcardToAlbum(card) {
    if (!card || card.sender_kind !== "bot") {
      return { added: false, completed: false, sets: [] };
    }
    if (!TOWN_BOTS.some((bot) => bot.id === card.sender_id)) {
      return { added: false, completed: false, sets: [] };
    }
    if (state.postcardAlbum.some((entry) => entry.senderId === card.sender_id)) {
      return { added: false, completed: false, sets: [] };
    }
    state.postcardAlbum.push({
      senderId: card.sender_id,
      senderName: card.sender,
      template: card.template,
      text: card.text,
      at: Date.now()
    });
    const completedSets = [];
    TOWN_SETS.forEach((set) => {
      if (state.postcardSetRewards.includes(set.id)) return;
      const done = set.bots.every((botId) =>
        state.postcardAlbum.some((entry) => entry.senderId === botId)
      );
      if (!done) return;
      state.postcardSetRewards.push(set.id);
      addInk(1);
      state.materials[set.rewardMaterial] = Math.min(
        99,
        (state.materials[set.rewardMaterial] || 0) + 1
      );
      completedSets.push(set);
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
      return { added: true, completed: true, sets: completedSets };
    }
    return { added: true, completed: false, sets: completedSets };
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
      if (result && Array.isArray(result.collectibles)) {
        mergeCollectibles(result.collectibles);
      }
      saveGame();
      refreshLive();
      if (album.completed) {
        showToast("集齐 8 位邮差的明信片：+1 月光邮戳，纸 / 蜡 / 布各 +2。", 6200);
      } else if (album.sets && album.sets.length) {
        const names = album.sets.map((set) => `「${set.name}」`).join("");
        showToast(`${names}明信片集齐：+1 墨点，材料 +1。`, 5200);
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
    if (els.quickStampBtn) {
      els.quickStampBtn.addEventListener("click", () => handleStampClick("good"));
    }
    els.goldenLetter.addEventListener("click", collectGoldenLetter);
    els.bellBtn.addEventListener("click", useBell);

    if (els.quickShopBtn) {
      els.quickShopBtn.addEventListener("click", () => {
        const shop = document.querySelector(".shop-card");
        if (!shop) return;
        shop.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start"
        });
      });
    }

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
    if (els.townBtn) els.townBtn.addEventListener("click", () => navigateRoom("town"));

    els.modalCancel.addEventListener("click", closeModal);
    if (els.modalClose) els.modalClose.addEventListener("click", closeModal);
    els.modalConfirm.addEventListener("click", () => {
      const action = modalAction;
      closeModal();
      if (action) action();
    });
    els.modal.addEventListener("click", (event) => {
      if (event.target === els.modal) closeModal();
    });
    els.modalBody.addEventListener("click", (event) => {
      if (event.target.closest("[data-town-login]")) {
        closeModal();
        openAccountModal();
      }
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
    const earlyAccount = cloudApi.loadAccount();
    if (
      localSaveProblem &&
      !fromHot &&
      earlyAccount &&
      earlyAccount.token
    ) {
      cloudRecoveryPending = true;
      suppressSaves = true;
    }

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
    initRoomShell();

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
        stamp: (quality) => handleStampClick(quality),
        openNightWatch,
        nightwatch: () => (nightEngine ? nightEngine.snapshot() : null),
        nightwatchOil: (amount) => { if (nightEngine) nightEngine.addOil(amount); },
        nightwatchSpawn: (type, row) => { if (nightEngine) nightEngine.spawn(type, row); },
        nightwatchSelect: (type) => {
          if (!nightEngine) return null;
          nightEngine.select(type);
          pushNightSnapshot();
          return nightEngine.snapshot().selected;
        },
        nightwatchPlace: (type, col, row) => {
          if (!nightEngine) return null;
          if (nightEngine.snapshot().selected !== type) nightEngine.select(type);
          const placed = nightEngine.place(Number(col), Number(row));
          const isNewFusion = recordNightFusion(placed);
          nightToastForPlace(placed, { silentFuse: isNewFusion });
          pushNightSnapshot();
          return placed;
        },
        nightwatchWin: () => { if (nightEngine) { nightEngine.forceWin(); pushNightSnapshot(); } },
        nightwatchLose: () => { if (nightEngine) { nightEngine.forceLose(); pushNightSnapshot(); } },
        setNightModifier: (id) => { nightModifierOverride = id || ""; }
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
