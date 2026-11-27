<template>
  <div v-if="snapshot" class="nw">
    <div class="nw-hud">
      <span class="nw-chip"><small>夜</small><b>{{ snapshot.level }}</b></span>
      <span class="nw-chip"><small>波次</small><b>{{ snapshot.wave }}/{{ snapshot.waveTotal }}</b></span>
      <span class="nw-chip nw-oil"><small>灯油</small><b>{{ snapshot.oil }}</b></span>
      <span class="nw-chip nw-base" :class="{ 'is-low': snapshot.baseHp <= 30 }">
        <small>门板</small><b>{{ snapshot.baseHp }}/{{ snapshot.baseMax }}</b>
      </span>
      <span
        v-if="snapshot.modifier.name"
        class="nw-chip nw-modifier-chip"
        :class="'tone-' + snapshot.modifier.tone"
        :title="snapshot.modifier.desc"
      ><small>今日</small><b>{{ snapshot.modifier.name }}</b></span>
      <span
        v-if="snapshot.deepFog.active"
        class="nw-chip nw-deep-chip"
        :title="snapshot.deepFog.desc"
      ><small>深雾</small><b>{{ snapshot.deepFog.shortName }} · {{ snapshot.deepFog.layer }} 层</b></span>
      <div class="nw-controls">
        <button class="link-btn" type="button" @click="handlers.onPause">
          {{ snapshot.paused ? "继续" : "暂停" }}
        </button>
        <button class="link-btn" type="button" @click="handlers.onSpeed">{{ snapshot.speed }}×</button>
      </div>
    </div>

    <div
      class="nw-board"
      :class="{ 'is-break': snapshot.phase === 'break', 'is-over': isOver, 'is-deep': snapshot.deepFog.active }"
    >
      <div class="nw-lanes" aria-hidden="true">
        <span v-for="row in laneList" :key="row" class="nw-lane"></span>
      </div>

      <span class="nw-fog" aria-hidden="true"></span>

      <div class="nw-grid">
        <button
          v-for="cell in cells"
          :key="cell.key"
          class="nw-cell"
          :class="{
            'is-spot': cell.spot === 'place',
            'is-fuse': cell.spot === 'fuse'
          }"
          type="button"
          :aria-label="cell.tower ? `${cell.tower.name}，生命 ${cell.tower.hp}` : `第 ${cell.row + 1} 行第 ${cell.col + 1} 格`"
          @click="handlers.onCell(cell.col, cell.row)"
        >
          <span v-if="cell.tower" class="nw-unit" :class="{ 'is-fusion': cell.tower.fusion, 'is-tier2': cell.tower.tier >= 2, 'is-aura': cell.tower.aura }">
            <span class="nw-unit-icon" v-html="icons[cell.tower.icon] || ''"></span>
            <i class="nw-unit-hp"><i :style="{ width: cell.tower.percent + '%' }"></i></i>
          </span>
        </button>
      </div>

      <div class="nw-enemies" aria-hidden="true">
        <span
          v-for="enemy in snapshot.enemies"
          :key="enemy.id"
          class="nw-enemy"
          :class="['nw-enemy-' + enemy.type, { 'is-slowed': enemy.slowed, 'is-boss': enemy.boss, 'is-boosted': enemy.boosted, 'is-poisoned': enemy.poisoned }]"
          :style="enemyStyle(enemy)"
        >
          <span class="nw-enemy-icon" v-html="icons[enemy.icon] || ''"></span>
          <i class="nw-enemy-hp"><i :style="{ width: enemy.percent + '%' }"></i></i>
        </span>
      </div>

      <div class="nw-shots" aria-hidden="true">
        <span
          v-for="(shot, index) in snapshot.effects"
          :key="index"
          class="nw-shot"
          :class="'is-' + shot.kind"
          :style="shotStyle(shot)"
        ></span>
      </div>

      <div v-if="snapshot.phase === 'ready'" class="nw-overlay">
        <p class="nw-overlay-kicker">{{ snapshot.deepFog.active ? "苔藓邮局 · 深雾" : "苔藓邮局 · 守夜" }}</p>
        <h4>第 {{ snapshot.level }} 夜<template v-if="snapshot.deepFog.active"> · 深雾 {{ snapshot.deepFog.layer }} 层</template></h4>
        <p>雾从邮路尽头漫上来。把信封草、邮票花和彩纸藤种在格子里，别让影子摸到门板。</p>
        <p class="nw-overlay-note">相同的两株、或者有配方的两株，种在同一格就能融合。</p>
        <p class="nw-overlay-note">夜蛾飞过墙，夜鼠偷灯油，鼓手会给同伴加速。</p>
        <p v-if="snapshot.level >= 9" class="nw-overlay-note">第 9 夜起，融合体还能再和基础植物融合一次。</p>
        <p v-if="snapshot.deepFog.active" class="nw-overlay-note">
          深雾第 {{ snapshot.deepFog.layer }} 层「{{ snapshot.deepFog.name }}」：{{ snapshot.deepFog.desc }} · {{ snapshot.deepFog.rewardText }}
        </p>
        <p v-if="snapshot.modifier.name" class="nw-overlay-note">
          今日词条「{{ snapshot.modifier.name }}」：{{ snapshot.modifier.desc }}{{ snapshot.modifier.rewardText ? ` · ${snapshot.modifier.rewardText}` : "" }}
        </p>
        <div class="nw-overlay-actions">
          <button class="primary-btn" type="button" @click="handlers.onStart">开始守夜</button>
          <button class="secondary-btn" type="button" @click="handlers.onClose">回守夜</button>
        </div>
      </div>

      <div v-if="snapshot.paused && !isOver && snapshot.phase !== 'ready'" class="nw-overlay">
        <p class="nw-overlay-kicker">暂停</p>
        <h4>先歇一会</h4>
        <p>灯油和雾都停住了。回邮局会放弃这一夜，不扣存档。</p>
        <div class="nw-overlay-actions">
          <button class="primary-btn" type="button" @click="handlers.onPause">继续守夜</button>
          <button class="secondary-btn" type="button" @click="handlers.onClose">回守夜</button>
        </div>
      </div>

      <div v-if="snapshot.phase === 'break'" class="nw-break">
        下一波还有 {{ Math.ceil(snapshot.breakLeft) }} 秒
      </div>

      <div v-if="isOver" class="nw-overlay" :class="snapshot.result.won ? 'is-win' : 'is-lose'">
        <p class="nw-overlay-kicker">{{ snapshot.result.won ? "天亮了" : "雾还没散" }}</p>
        <h4>{{ snapshot.result.won ? `第 ${snapshot.result.level} 夜守住了` : `第 ${snapshot.result.level} 夜失守` }}</h4>
        <p v-if="snapshot.result.won">
          带回 {{ fmt(snapshot.result.rewards.stamps) }} 张邮票 · {{ snapshot.result.rewards.ink }} 墨点 ·
          纸×{{ snapshot.result.rewards.paper }}<template v-if="snapshot.result.rewards.wax"> · 蜡×{{ snapshot.result.rewards.wax }}</template>
        </p>
        <p v-else>门板被撞开了。今晚没有奖励，材料会留在邮局，明天再来。</p>
        <p class="nw-overlay-note">守住 {{ snapshot.result.wave }}/{{ snapshot.result.waves }} 波 · 打散 {{ snapshot.result.kills }} 个影子</p>
        <p v-if="medalNote" class="nw-overlay-note">{{ medalNote }}</p>
        <div class="nw-overlay-actions">
          <button v-if="snapshot.result.won" class="primary-btn" type="button" @click="handlers.onNext">下一夜</button>
          <button v-else class="primary-btn" type="button" @click="handlers.onRetry">再守一次</button>
          <button class="secondary-btn" type="button" @click="handlers.onClose">收工</button>
        </div>
      </div>
    </div>

    <div class="nw-cards">
      <button
        v-for="card in snapshot.cards"
        :key="card.id"
        class="nw-card"
        :class="{
          'is-locked': !card.unlocked,
          'is-selected': card.selected,
          'is-poor': card.unlocked && !card.affordable
        }"
        type="button"
        :disabled="!card.unlocked"
        :title="card.desc"
        @click="handlers.onCard(card.id)"
      >
        <span class="nw-card-icon" v-html="icons[card.icon] || ''"></span>
        <b>{{ card.name }}</b>
        <small>{{ card.unlocked ? `${card.cost} 油` : `第 ${card.unlockNight} 夜` }}</small>
      </button>
    </div>

    <p class="nw-hint">
      {{ hintText }}
    </p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { NW_LANES, NW_COLS } from "../nightwatch.js";
import { nightWatchStore } from "./nightWatchStore.js";

const props = defineProps({
  handlers: { type: Object, required: true },
  icons: { type: Object, default: () => ({}) },
  formatNumber: { type: Function, default: (value) => String(value) }
});

const snapshot = computed(() => nightWatchStore.snapshot);
const laneList = Array.from({ length: NW_LANES }, (_, index) => index);
const isOver = computed(
  () => Boolean(snapshot.value) && ["won", "lost"].includes(snapshot.value.phase)
);
const medalNote = computed(() => {
  const source = snapshot.value;
  if (!source || !source.result || !source.result.won) return "";
  return [5, 10, 15].includes(source.result.level)
    ? "这一夜有纪念戳，会由邮局签发并记进邮册。"
    : "";
});

const cells = computed(() => {
  const source = snapshot.value;
  const list = [];
  if (!source) return list;
  const towers = new Map(
    source.towers.map((tower) => [`${tower.col},${tower.row}`, tower])
  );
  const spots = new Map(
    source.spots.map((spot) => [`${spot.col},${spot.row}`, spot.kind])
  );
  for (let row = 0; row < NW_LANES; row += 1) {
    for (let col = 0; col < NW_COLS; col += 1) {
      const key = `${col},${row}`;
      list.push({
        key,
        col,
        row,
        tower: towers.get(key) || null,
        spot: spots.get(key) || ""
      });
    }
  }
  return list;
});

const hintText = computed(() => {
  const source = snapshot.value;
  if (!source) return "";
  if (source.phase === "ready") return "选一张卡，再点格子。第一夜先种两张邮票花，再补信封草。";
  if (isOver.value) return "这一夜结束了，收工不影响已经拿到的奖励。";
  if (!source.selected) {
    return "点一张卡开始种；金色格子和已有植物同格可以融合。";
  }
  const selectedCard = source.cards.find((card) => card.selected);
  if (!selectedCard) return "";
  const fuses = source.spots.filter((spot) => spot.kind === "fuse").length;
  const hints = source.fusionHints || [];
  const fusionText = hints.length
    ? `同格可以融合：${hints.map((hint) => `${hint.partner}→${hint.name}`).join("、")}。`
    : "";
  return fuses
    ? `${selectedCard.name}：${fusionText}金色格子可融合（${fuses} 处）。`
    : `${selectedCard.name}：点一个空格种下。${fusionText}`;
});

function fmt(value) {
  return props.formatNumber(value);
}

function enemyStyle(enemy) {
  return {
    left: `${((enemy.x + 0.5) / NW_COLS) * 100}%`,
    top: `${((enemy.row + 0.5) / NW_LANES) * 100}%`
  };
}

function shotStyle(shot) {
  const from = Math.max(0, Math.min(shot.from, shot.to));
  const to = Math.min(NW_COLS, Math.max(shot.from, shot.to));
  return {
    left: `${(from / NW_COLS) * 100}%`,
    width: `${Math.max(2, ((to - from) / NW_COLS) * 100)}%`,
    top: `${((shot.row + 0.5) / NW_LANES) * 100}%`
  };
}
</script>
