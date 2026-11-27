<template>
  <div v-if="snapshot" class="album-view">
    <div class="album-summary">
      <div class="album-summary-top">
        <span class="album-summary-title" id="albumCount">已贴 {{ snapshot.collected }} / {{ snapshot.total }} 枚</span>
        <span class="album-summary-bonus" id="albumBonus">全局 +{{ snapshot.bonusPercent }}%</span>
      </div>
      <p>每贴上一枚纪念邮票，所有产出都会更丰厚一点。盖戳、招人、出远门，都会留下小小的邮戳。</p>
      <div class="album-bar"><span class="album-fill" id="albumFill" :style="{ width: snapshot.fillPercent + '%' }"></span></div>
    </div>

    <div class="album-grid">
      <article
        v-for="achievement in snapshot.achievements"
        :key="achievement.id"
        class="album-stamp"
        :class="{ collected: achievement.done }"
        :aria-label="`${achievement.name}，${achievement.desc}，奖励全局产出 +${achievement.rewardPercent}%`"
      >
        <div class="album-stamp-top">
          <span class="album-art" aria-hidden="true" v-html="achievement.icon"></span>
          <span class="album-reward">+{{ achievement.rewardPercent }}%</span>
        </div>
        <div class="album-name">{{ achievement.name }}</div>
        <p class="album-desc">{{ achievement.desc }}</p>
        <div class="album-progress">
          <span>{{ achievement.done ? "已贴进邮册" : `${achievement.valueText} / ${achievement.targetText}` }}</span>
          <span v-if="!achievement.done" class="album-mini-bar">
            <span class="album-mini-fill" :style="{ width: achievement.progress + '%' }"></span>
          </span>
        </div>
      </article>
    </div>

    <section class="postcard-album">
      <div class="tree-head">
        <span>镇口明信片</span>
        <span>{{ snapshot.postcardCount }} / {{ snapshot.postcardTotal }}{{ snapshot.postcardComplete ? " · 已集齐" : "" }}</span>
      </div>
      <p class="tree-note">四套明信片，每套 2 位邮差。集齐一套 +1 墨点 +1 材料；8 张全收集再留 1 枚月光邮戳。</p>
      <div v-for="set in snapshot.postcardSets" :key="set.id" class="postcard-set" :class="{ 'is-complete': set.complete }">
        <div class="postcard-set-head">
          <b>{{ set.name }}</b>
          <span>{{ set.medalText }}{{ set.count }} / {{ set.total }}{{ set.rewarded ? " · 已领" : set.complete ? " · 已集齐" : "" }}</span>
        </div>
        <div class="postcard-grid">
          <article
            v-for="bot in set.bots"
            :key="bot.id"
            class="postcard-slot"
            :class="{ 'is-collected': bot.collected }"
          >
            <span v-if="bot.collected" class="postcard-art postcard-art-icon" aria-hidden="true" v-html="bot.icon"></span>
            <div class="postcard-slot-top">
              <b>{{ bot.name }}</b>
              <span>{{ bot.serialText || bot.title }}</span>
            </div>
            <p>{{ bot.collected ? bot.text : "还没收到这位邮差的明信片。" }}</p>
            <small>{{ bot.collected ? "已收进邮册" : "去镇口寄一张" }}</small>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { albumStore } from "./albumStore.js";

const snapshot = computed(() => albumStore.snapshot);
</script>
