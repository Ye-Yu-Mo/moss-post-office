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

    <section class="postcard-album">
      <div class="tree-head">
        <span>守夜融合图鉴</span>
        <span>{{ snapshot.nightFusionCount }} / {{ snapshot.nightFusions.length }}</span>
      </div>
      <p class="tree-note">在守夜里把两株有配方的植物种在同一格就会融合。集齐 8 种和 14 种，各会进一枚邮册纪念邮票。</p>
      <div class="night-fusion-grid">
        <article
          v-for="fusion in snapshot.nightFusions"
          :key="fusion.id"
          class="night-fusion"
          :class="{ 'is-found': fusion.discovered, 'is-locked': !fusion.discovered }"
        >
          <span class="night-fusion-icon" aria-hidden="true" v-html="fusion.icon"></span>
          <div class="night-fusion-copy">
            <b>{{ fusion.name }}</b>
            <small>{{ fusion.aName }} + {{ fusion.bName }}{{ fusion.tier === 2 ? " · 进阶" : "" }}</small>
            <span>{{ fusion.discovered ? "已点亮" : fusion.unlocked ? "还没合成" : `第 ${fusion.unlockNight} 夜解锁` }}</span>
          </div>
        </article>
      </div>
    </section>

    <section class="postcard-album">
      <div class="tree-head">
        <span>守夜纪念戳</span>
        <span>{{ ownedMedals }} / {{ snapshot.nightMedals.length }}</span>
      </div>
      <p class="tree-note">
        守住第 5 / 10 / 15 夜，邮局会签发一枚有编号的纪念戳。登录后记进邮册，转生不会清空。
      </p>
      <div class="night-medal-grid">
        <article
          v-for="medal in snapshot.nightMedals"
          :key="medal.level"
          class="night-medal"
          :class="{ 'is-owned': medal.owned, 'is-locked': !medal.owned && !medal.reached }"
        >
          <span class="night-medal-icon" aria-hidden="true" v-html="medal.icon"></span>
          <div class="night-medal-copy">
            <b>{{ medal.name }}</b>
            <small>
              {{ medal.owned
                ? medal.serialText
                : medal.reached
                  ? `已守住 · 待登录签发 · 限 ${medal.edition} 枚`
                  : `守住第 ${medal.level} 夜 · 限 ${medal.edition} 枚` }}
            </small>
            <p>{{ medal.desc }}</p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { albumStore } from "./albumStore.js";

const snapshot = computed(() => albumStore.snapshot);
const ownedMedals = computed(
  () => (snapshot.value?.nightMedals || []).filter((medal) => medal.owned).length
);
</script>
