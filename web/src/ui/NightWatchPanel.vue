<template>
  <div v-if="snapshot" class="nw-panel">
    <div class="nw-panel-head">
      <div>
        <p class="nw-panel-kicker">夜班 · 守夜防线</p>
        <h4>第 {{ snapshot.night }} 夜在等你</h4>
        <p class="town-lead">雾里的影子会沿五条邮路摸到门板。种下邮局的植物，守住到天亮。</p>
      </div>
      <button class="primary-btn nw-start" type="button" @click="handlers.onOpen">开始守夜</button>
    </div>

    <div class="nw-stats">
      <span><small>最远</small><b>第 {{ snapshot.best }} 夜</b></span>
      <span><small>守住</small><b>{{ snapshot.wins }} 次</b></span>
      <span><small>打散</small><b>{{ snapshot.kills }} 个影子</b></span>
    </div>

    <div class="nw-modifier" :class="'tone-' + snapshot.modifier.tone">
      <div class="nw-modifier-head">
        <span class="nw-modifier-kicker">今日词条</span>
        <b>{{ snapshot.modifier.name }}</b>
        <span v-if="snapshot.modifier.rewardText" class="nw-modifier-reward">{{ snapshot.modifier.rewardText }}</span>
      </div>
      <p>{{ snapshot.modifier.desc }}</p>
      <small>每天 0 点换一条，失败可以原地重试。</small>
    </div>

    <p class="nw-next">{{ snapshot.nextText }}</p>

    <div class="nw-section">
      <div class="tree-head"><span>守夜天赋</span><span>{{ snapshot.points }} 点可用</span></div>
      <div class="nw-talent-grid">
        <button
          v-for="talent in snapshot.talents"
          :key="talent.id"
          class="nw-talent"
          :class="{ 'is-maxed': talent.maxed, 'is-poor': !talent.maxed && !talent.affordable }"
          type="button"
          :disabled="talent.maxed || !talent.affordable"
          @click="handlers.onBuyTalent(talent.id)"
        >
          <span class="nw-talent-icon" v-html="icons[talent.icon] || ''"></span>
          <span class="nw-talent-copy">
            <b>{{ talent.name }} <small>Lv {{ talent.level }}/{{ talent.max }}</small></b>
            <p>{{ talent.desc }}</p>
          </span>
          <span class="nw-talent-cost">{{ talent.maxed ? "已满" : `${talent.cost} 点` }}</span>
        </button>
      </div>
      <p class="nw-rules">{{ snapshot.talentSummary }}。每守住一夜得 1 点，尾数是 5 的夜（夜班车）再额外 1 点；天赋是永久成长，转生不会清空。</p>
    </div>

    <div class="nw-section">
      <div class="tree-head"><span>守夜植物</span><span>{{ snapshot.towerCount }} 种</span></div>
      <div class="nw-tower-grid">
        <article
          v-for="tower in snapshot.towers"
          :key="tower.id"
          class="nw-tower-card"
          :class="{ 'is-locked': !tower.unlocked }"
        >
          <span class="nw-tower-icon" v-html="icons[tower.icon] || ''"></span>
          <b>{{ tower.name }}</b>
          <small>{{ tower.unlocked ? `${tower.cost} 灯油` : `第 ${tower.unlockNight} 夜解锁` }}</small>
          <p>{{ tower.desc }}</p>
        </article>
      </div>
    </div>

    <div class="nw-section">
      <div class="tree-head"><span>融合配方</span><span>{{ snapshot.recipeCount }} 种</span></div>
      <div class="nw-recipe-list">
        <article
          v-for="recipe in snapshot.recipes"
          :key="recipe.id"
          class="nw-recipe"
          :class="{ 'is-locked': !recipe.unlocked }"
        >
          <span class="nw-recipe-icon" v-html="icons[recipe.icon] || ''"></span>
          <div>
            <b>{{ recipe.name }}</b>
            <small>{{ recipe.aName }} + {{ recipe.bName }}{{ recipe.unlocked ? "" : ` · 第 ${recipe.unlockNight} 夜` }}</small>
            <p>{{ recipe.desc }}</p>
          </div>
        </article>
      </div>
    </div>

    <p class="nw-rules">
      灯油自己会慢慢攒，邮票花每 6.5 秒结一滴。门板 100 点，影子摸到就扣；守住全部波次才算天亮。
      失败不扣存档，只是这一夜没有奖励。
    </p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { nightPanelStore } from "./nightPanelStore.js";

defineProps({
  handlers: { type: Object, required: true },
  icons: { type: Object, default: () => ({}) }
});

const snapshot = computed(() => nightPanelStore.snapshot);
</script>
