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
        :aria-label="`今日词条：${snapshot.modifier.name}。${snapshot.modifier.desc}`"
      ><small aria-hidden="true">今日</small><b>{{ snapshot.modifier.name }}</b></span>
      <span
        v-if="snapshot.deepFog.active"
        class="nw-chip nw-deep-chip"
        :title="snapshot.deepFog.desc"
        :aria-label="`深雾 ${snapshot.deepFog.layer} 层：${snapshot.deepFog.shortName}。${snapshot.deepFog.desc}`"
      ><small aria-hidden="true">深雾</small><b>{{ snapshot.deepFog.shortName }} · {{ snapshot.deepFog.layer }} 层</b></span>
      <div class="nw-controls">
        <button
          class="link-btn"
          type="button"
          :aria-pressed="snapshot.paused"
          :aria-label="snapshot.paused ? '继续守夜' : '暂停守夜（选补给时也可以暂停）'"
          @click="handlers.onPause"
        >
          {{ snapshot.paused ? "继续" : "暂停" }}
        </button>
        <button class="link-btn" type="button" :aria-label="`切换速度，当前 ${snapshot.speed} 倍`" @click="handlers.onSpeed">{{ snapshot.speed }}×</button>
      </div>
    </div>

    <div v-if="snapshot.boons.length" class="nw-boons" role="group" aria-labelledby="nw-boons-title">
      <div class="nw-boons-head">
        <b id="nw-boons-title">波间补给</b>
        <small>选一项，下一波开始前生效（{{ Math.ceil(snapshot.breakLeft) }} 秒后自动跳过；按“暂停”可以停下来慢慢选）</small>
      </div>
      <p class="sr-only" aria-live="polite">
        波间补给出现：{{ snapshot.boons.map((boon) => boon.name).join("、") }}。倒计时 {{ Math.ceil(snapshot.breakLeft) }} 秒，按暂停可以停下。
      </p>
      <div class="nw-boon-grid">
        <button
          v-for="boon in snapshot.boons"
          :key="boon.id"
          class="nw-boon"
          type="button"
          :aria-label="`${boon.name}：${boon.desc}`"
          @click.stop="handlers.onBoon(boon.id)"
        >
          <span class="nw-boon-icon" aria-hidden="true" v-html="icons[boon.icon] || ''"></span>
          <b>{{ boon.name }}</b>
          <small>{{ boon.desc }}</small>
        </button>
      </div>
    </div>

    <div v-if="snapshot.nextWave.enemies.length" class="nw-wave-preview">
      <span class="nw-wave-label">{{ snapshot.nextWave.label }} · {{ snapshot.nextWave.number }}/{{ snapshot.waveTotal }}</span>
      <span v-for="enemy in snapshot.nextWave.enemies" :key="enemy.type" class="nw-wave-chip" :class="{ 'is-boss': enemy.boss }">
        <span class="nw-wave-icon" v-html="icons[enemy.icon] || ''"></span>
        <small>{{ enemy.name }}</small><b>×{{ enemy.count }}</b>
      </span>
      <span v-if="snapshot.blocked.length" class="nw-wave-fog">雾障 {{ snapshot.blocked.length }} 格</span>
      <span v-if="snapshot.buffs.damage" class="nw-buff-chip">伤害 +{{ snapshot.buffs.damage }}%</span>
      <span v-if="snapshot.buffs.drip" class="nw-buff-chip">灯油 +{{ snapshot.buffs.drip }}/秒</span>
      <span v-if="snapshot.buffs.cooldown" class="nw-buff-chip">冷却 -{{ snapshot.buffs.cooldown }}%</span>
      <span v-if="snapshot.buffs.slow" class="nw-buff-chip">移速 -{{ snapshot.buffs.slow }}%</span>
    </div>

    <div v-if="snapshot.phase === 'ready'" class="nw-ready-bar">
      <div class="nw-ready-copy">
        <p class="nw-overlay-kicker">{{ snapshot.deepFog.active ? "苔藓邮局 · 深雾" : "苔藓邮局 · 守夜" }}</p>
        <b>第 {{ snapshot.level }} 夜<template v-if="snapshot.deepFog.active"> · 深雾 {{ snapshot.deepFog.layer }} 层</template></b>
        <span>选卡先摆位，雾障格不能种；确认后再开始。</span>
      </div>
      <div class="nw-ready-actions">
        <button class="secondary-btn" type="button" @click="handlers.onClose">回守夜</button>
        <button class="primary-btn" type="button" @click="handlers.onStart">开始守夜</button>
      </div>
    </div>

    <div
      class="nw-board"
      role="group"
      aria-label="守夜棋盘，5 行 8 列"
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
            'is-fuse': cell.spot === 'fuse',
            'is-blocked': cell.blocked
          }"
          type="button"
          :disabled="cell.blocked"
          :aria-label="cell.blocked ? `第 ${cell.row + 1} 行第 ${cell.col + 1} 格，雾障，不能种植` : cell.tower ? `第 ${cell.row + 1} 行第 ${cell.col + 1} 格，${cell.tower.name}，生命 ${cell.tower.hp}` : `第 ${cell.row + 1} 行第 ${cell.col + 1} 格`"
          @click="handleCell(cell)"
        >
          <span v-if="cell.blocked" class="nw-blocked" aria-hidden="true" v-html="icons.mist || ''"></span>
          <span v-else-if="cell.tower" class="nw-unit" :class="{ 'is-fusion': cell.tower.fusion, 'is-tier2': cell.tower.tier >= 2, 'is-aura': cell.tower.aura }">
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

      <div v-if="snapshot.phase === 'break'" class="nw-break">
        下一波还有 {{ Math.ceil(snapshot.breakLeft) }} 秒
      </div>
    </div>

    <div
      v-if="isOver"
      ref="resultBox"
      class="nw-overlay nw-overlay-done"
      :class="snapshot.result.won ? 'is-win' : 'is-lose'"
      role="dialog"
      aria-labelledby="nw-result-title"
      tabindex="-1"
    >
      <p class="nw-overlay-kicker">{{ snapshot.result.won ? "天亮了" : "雾还没散" }}</p>
      <h2 id="nw-result-title">{{ snapshot.result.won ? `第 ${snapshot.result.level} 夜守住了` : `第 ${snapshot.result.level} 夜失守` }}</h2>
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

    <div class="nw-tools">
      <button
        class="nw-tool"
        :class="{ 'is-active': shovel }"
        type="button"
        :aria-pressed="shovel"
        @click="toggleShovel"
      >铲子 <small>返还一半</small></button>
      <span class="nw-tool-hint">{{ shovel ? "点一株植物铲掉，返还一半灯油。" : "选一张卡再点格子；融合体和普通植物都能铲。" }}</span>
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
        :aria-pressed="card.selected"
        :aria-label="card.unlocked ? `${card.name}，${card.cost} 灯油。${card.desc}` : `${card.name}，第 ${card.unlockNight} 夜解锁。${card.desc}`"
        @click="selectCard(card.id)"
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
import { computed, nextTick, ref, watch } from "vue";
import { NW_LANES, NW_COLS } from "../nightwatch.js";
import { nightWatchStore } from "./nightWatchStore.js";

const props = defineProps({
  handlers: { type: Object, required: true },
  icons: { type: Object, default: () => ({}) },
  formatNumber: { type: Function, default: (value) => String(value) }
});

const handlers = props.handlers;
const snapshot = computed(() => nightWatchStore.snapshot);
const laneList = Array.from({ length: NW_LANES }, (_, index) => index);
const isOver = computed(
  () => Boolean(snapshot.value) && ["won", "lost"].includes(snapshot.value.phase)
);
const shovel = ref(false);
const resultBox = ref(null);

// The result card is a dialog outside the board: move focus so keyboard and
// screen-reader players land on the outcome and its two actions.
watch(isOver, (over) => {
  if (!over) return;
  nextTick(() => {
    if (resultBox.value) resultBox.value.focus({ preventScroll: true });
  });
});

function toggleShovel() {
  shovel.value = !shovel.value;
}

function selectCard(id) {
  shovel.value = false;
  handlers.onCard(id);
}

function handleCell(cell) {
  if (cell.blocked) return;
  if (shovel.value) {
    if (cell.tower) handlers.onSell(cell.col, cell.row);
    return;
  }
  handlers.onCell(cell.col, cell.row);
}

const medalNote = computed(() => {
  const source = snapshot.value;
  if (!source || !source.result || !source.result.won) return "";
  return [5, 10, 15, 20, 25, 30].includes(source.result.level)
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
  const blocked = new Set(
    (source.blocked || []).map((cell) => `${cell.col},${cell.row}`)
  );
  for (let row = 0; row < NW_LANES; row += 1) {
    for (let col = 0; col < NW_COLS; col += 1) {
      const key = `${col},${row}`;
      list.push({
        key,
        col,
        row,
        tower: towers.get(key) || null,
        spot: spots.get(key) || "",
        blocked: blocked.has(key)
      });
    }
  }
  return list;
});

const hintText = computed(() => {
  const source = snapshot.value;
  if (!source) return "";
  if (source.phase === "ready") return "选卡再点格子；雾障格不能种，铲子能把植物换回一半灯油。";
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
