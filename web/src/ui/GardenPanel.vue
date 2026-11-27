<template>
  <section class="town-section garden-section">
    <div class="tree-head">
      <span>后院</span>
      <span>{{ ripeCount }} 块可收</span>
    </div>
    <p class="town-lead">种着信封草、邮票花和墨莓。熟了就收，朋友也可以来偷一把或帮你浇水。</p>

    <div
      v-if="quest"
      class="garden-quest"
      :class="{ 'is-ready': questReady, 'is-claimed': quest.claimed }"
    >
      <span class="garden-icon" aria-hidden="true" v-html="icon(quest.crop)"></span>
      <div class="garden-copy">
        <b>今日柜台：收 1 份{{ quest.name }}</b>
        <small>{{ quest.progress }} / {{ quest.amount }} · 奖励 {{ questReward }}</small>
      </div>
      <button
        class="link-btn"
        type="button"
        data-claim-quest
        :disabled="quest.claimed || !questReady"
        @click.stop="$emit('claim-quest')"
      >
        {{ quest.claimed ? "今日已交" : questReady ? "交菜" : "还差一份" }}
      </button>
    </div>

    <p class="garden-next">{{ nextPlotText }}</p>

    <div class="garden-grid">
      <article
        v-for="plot in garden.plots || []"
        :key="plot.plot"
        class="garden-plot"
        :class="{ 'is-ripe': plot.ripe, 'is-empty': plot.empty }"
      >
        <span class="garden-icon" aria-hidden="true" v-html="icon(plot.crop)"></span>
        <template v-if="plot.empty">
          <div class="garden-copy"><b>空地</b><small>种点什么？</small></div>
          <button class="garden-seed-open" type="button" :data-open-seeds="plot.plot" @click.stop="$emit('open-seeds', plot.plot)">选种</button>
        </template>
        <template v-else>
          <div class="garden-copy">
            <b>{{ plot.name }}</b>
            <small>{{ plotStatus(plot) }}{{ plot.stolen ? ` · 被偷 ${plot.stolen} 份` : "" }}</small>
          </div>
          <div class="garden-bar"><span :style="{ width: plotPercent(plot) + '%' }"></span></div>
          <button
            v-if="plot.ripe"
            class="link-btn"
            type="button"
            :data-harvest-plot="plot.plot"
            @click.stop="$emit('harvest', plot.plot)"
          >收菜</button>
          <button
            v-else
            class="link-btn"
            type="button"
            :data-water-plot="plot.plot"
            :disabled="plot.watered"
            @click.stop="$emit('water', plot.plot)"
          >{{ plot.watered ? "已浇水" : "浇水" }}</button>
        </template>
      </article>
    </div>

    <div class="garden-journal">
      <div class="tree-head"><span>作物图鉴</span><span>收成 / 被偷</span></div>
      <div class="crop-stat-grid">
        <div v-for="stat in garden.crop_stats || []" :key="stat.crop" class="crop-stat">
          <span class="crop-stat-icon" aria-hidden="true" v-html="icon(stat.crop)"></span>
          <b>{{ stat.name }}</b>
          <small>收 {{ fmt(stat.harvests) }} · 被偷 {{ fmt(stat.stolen) }}</small>
        </div>
      </div>
      <div class="tree-head"><span>最近来访</span><span>{{ (garden.visitors || []).length }} 条</span></div>
      <div v-if="(garden.visitors || []).length" class="visitor-list">
        <div v-for="(visitor, index) in garden.visitors" :key="index" class="visitor-row">
          <span v-html="avatarFor(visitor.actor_name)"></span>
          <div>
            <b>{{ visitor.actor_name }}</b>
            <small>{{ visitor.action === "steal" ? "偷了" : "浇了" }}一次{{ visitor.name }} · {{ timeText(visitor.created_at) }}</small>
          </div>
        </div>
      </div>
      <p v-else class="garden-journal-empty">还没有人来过后院。</p>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  garden: { type: Object, required: true },
  icons: { type: Object, default: () => ({}) },
  formatNumber: { type: Function, default: (value) => String(value) },
  timeText: { type: Function, default: () => "" },
  avatarFor: { type: Function, default: () => "" }
});
defineEmits(["harvest", "water", "open-seeds", "claim-quest"]);

const quest = computed(() => props.garden.quest || null);
const questReady = computed(
  () => Boolean(quest.value) && quest.value.progress >= quest.value.amount && !quest.value.claimed
);
const ripeCount = computed(
  () => (props.garden.plots || []).filter((plot) => plot.ripe).length
);
const questReward = computed(() => {
  if (!quest.value) return "";
  if (quest.value.reward_kind === "stamps") {
    return `邮票×${props.formatNumber(quest.value.reward_amount)}`;
  }
  if (quest.value.reward_kind === "paper") return `纸×${quest.value.reward_amount}`;
  return `墨点×${quest.value.reward_amount}`;
});
const nextPlotText = computed(() => {
  const harvests = props.garden.harvests || 0;
  if (harvests < 20) {
    return `已收 ${harvests} 次 · 再收 ${20 - harvests} 次解锁第 4 块地`;
  }
  if (harvests < 45) {
    return `已收 ${harvests} 次 · 再收 ${45 - harvests} 次解锁第 5 块地`;
  }
  return `已收 ${harvests} 次 · 菜地已扩到 5 块`;
});

function fmt(value) {
  return props.formatNumber(value);
}

function icon(crop) {
  return props.icons[crop] || props.icons.letter || "";
}

function plotPercent(plot) {
  const total = Math.max(1, plot.ripe_at - plot.planted_at);
  if (plot.ripe) return 100;
  return Math.min(100, Math.max(0, ((Date.now() / 1000 - plot.planted_at) / total) * 100));
}

function plotStatus(plot) {
  const prefix = plot.watered ? "已浇水 · " : "";
  if (plot.ripe) return `${prefix}可以收了`;
  const remaining = Math.max(0, plot.ripe_at - Date.now() / 1000);
  if (remaining < 90) return `${prefix}还差一分钟`;
  if (remaining < 3600) return `${prefix}还差 ${Math.max(1, Math.floor(remaining / 60))} 分钟`;
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  return `${prefix}还差 ${hours} 小时${minutes ? ` ${minutes} 分钟` : ""}`;
}
</script>
