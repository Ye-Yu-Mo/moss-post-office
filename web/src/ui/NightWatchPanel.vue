<template>
  <div v-if="snapshot" class="nw-panel">
    <div class="nw-view-switch" role="tablist" aria-label="守夜视图">
      <button
        id="nw-tab-watch"
        class="nw-view-tab"
        :class="{ 'is-active': view === 'watch' }"
        type="button"
        role="tab"
        aria-controls="nw-panel-watch"
        :aria-selected="view === 'watch'"
        :tabindex="view === 'watch' ? 0 : -1"
        @click="view = 'watch'"
        @keydown="onTabKeydown($event, 'watch')"
      >守夜</button>
      <button
        id="nw-tab-archive"
        class="nw-view-tab"
        :class="{ 'is-active': view === 'archive' }"
        type="button"
        role="tab"
        aria-controls="nw-panel-archive"
        :aria-selected="view === 'archive'"
        :tabindex="view === 'archive' ? 0 : -1"
        @click="view = 'archive'"
        @keydown="onTabKeydown($event, 'archive')"
      >档案</button>
    </div>

    <div
      v-if="view === 'watch'"
      id="nw-panel-watch"
      class="nw-panel-view"
      role="tabpanel"
      aria-labelledby="nw-tab-watch"
      tabindex="0"
    >
    <div class="nw-panel-head">
      <div>
        <p class="nw-panel-kicker">夜班 · 守夜防线</p>
        <h2 class="nw-panel-title">第 {{ snapshot.night }} 夜在等你</h2>
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
        <button
          class="link-btn nw-reroll"
          type="button"
          :disabled="!snapshot.modifier.canReroll"
          @click="handlers.onRerollModifier"
        >换一条 · 1 点</button>
      </div>
      <p>{{ snapshot.modifier.desc }}</p>
      <small>每天 0 点自动换一条；也可以花 1 点守夜天赋立刻重摇。</small>
    </div>

    <p class="nw-next">{{ snapshot.nextText }}</p>
    <p v-if="snapshot.blockedCount" class="nw-next nw-fog-note">
      本夜有 {{ snapshot.blockedCount }} 格雾障，开局前就能在棋盘上看见；铲子可以半价收回植物。
    </p>

    <div v-if="snapshot.deepUnlocked" class="nw-deep-note">
      <p>
        深雾已开启：第 16 夜起每晚额外叠一条只加难度的雾层词条<template v-if="snapshot.deepNext">，下一夜是「{{ snapshot.deepNext.name }}」——{{ snapshot.deepNext.desc }}{{ snapshot.deepNext.rewardText }}</template>。
      </p>
      <button
        v-if="snapshot.deepNext"
        class="link-btn"
        type="button"
        :disabled="!snapshot.deepNext.canReroll"
        @click="handlers.onRerollDeep"
      >换一层 · 1 点</button>
    </div>

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
      <div class="tree-head"><span>雾里的影子</span><span>{{ snapshot.enemyCount }} / {{ snapshot.enemies.length }} 种</span></div>
      <div class="nw-enemy-codex">
        <article
          v-for="enemy in snapshot.enemies"
          :key="enemy.id"
          class="nw-enemy-card"
          :class="{ 'is-locked': !enemy.unlocked }"
        >
          <span class="nw-enemy-codex-icon" v-html="icons[enemy.icon] || ''"></span>
          <div>
            <b>{{ enemy.name }}</b>
            <small>{{ enemy.unlocked ? enemy.desc : `第 ${enemy.unlockNight} 夜出现 · ${enemy.desc}` }}</small>
          </div>
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
            <small>{{ recipe.aName }} + {{ recipe.bName }}{{ recipe.tier === 2 ? " · 进阶" : "" }}{{ recipe.unlocked ? "" : ` · 第 ${recipe.unlockNight} 夜` }}</small>
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

    <div
      v-else
      id="nw-panel-archive"
      class="nw-panel-view"
      role="tabpanel"
      aria-labelledby="nw-tab-archive"
      tabindex="0"
    >
      <div class="nw-archive">
        <div class="nw-stats">
          <span><small>最远</small><b>第 {{ snapshot.best }} 夜</b></span>
          <span><small>守住</small><b>{{ snapshot.wins }} 次</b></span>
          <span><small>打散</small><b>{{ snapshot.kills }} 个影子</b></span>
        </div>

        <div class="nw-section">
          <div class="tree-head"><span>纪念戳</span><span>{{ ownedMedals }} / {{ snapshot.medals.length }}</span></div>
          <div class="nw-medal-list">
            <article
              v-for="medal in snapshot.medals"
              :key="medal.level"
              class="nw-medal-row"
              :class="{ 'is-owned': medal.owned, 'is-locked': !medal.owned && !medal.reached }"
            >
              <span class="nw-medal-icon" aria-hidden="true" v-html="medal.icon"></span>
              <div>
                <b>{{ medal.name }}</b>
                <small>
                  {{ medal.owned
                    ? medal.serialText
                    : medal.reached
                      ? "已守住 · 待登录签发"
                      : `守住第 ${medal.level} 夜 · 限 ${medal.edition} 枚` }}
                </small>
              </div>
            </article>
          </div>
          <p class="nw-rules">纪念戳由服务端签发，转生和换设备都会保留。</p>
        </div>

        <div class="nw-section">
          <div class="tree-head"><span>词条图鉴</span><span>{{ snapshot.modifierList.length }} 条</span></div>
          <div class="nw-modifier-codex">
            <article
              v-for="modifier in snapshot.modifierList"
              :key="modifier.id"
              class="nw-modifier-row"
              :class="['tone-' + modifier.tone, { 'is-today': modifier.today }]"
            >
              <div class="nw-modifier-row-head">
                <b>{{ modifier.name }}</b>
                <span v-if="modifier.today" class="nw-today-tag">今日</span>
                <small v-if="modifier.rewardText">{{ modifier.rewardText }}</small>
              </div>
              <p>{{ modifier.desc }}</p>
            </article>
          </div>
          <p class="nw-rules">每天从这 16 条里抽一条；花 1 点天赋可以重摇，同一天重摇会替换掉当前词条。</p>
        </div>

        <div class="nw-section">
          <div class="tree-head"><span>最近的夜</span><span>{{ snapshot.history.length }} 场</span></div>
          <p v-if="!snapshot.history.length" class="nw-empty">还没有守夜记录，先去开第一夜吧。</p>
          <div v-else class="nw-history">
            <div
              v-for="(run, index) in snapshot.history"
              :key="index"
              class="nw-history-row"
              :class="{ 'is-won': run.won }"
            >
              <b>第 {{ run.level }} 夜</b>
              <span>{{ run.won ? "守住" : "失守" }} · 第 {{ run.wave }}/{{ run.waves }} 波 · 打散 {{ run.kills }}<template v-if="run.deep"> · 深雾</template></span>
              <small>{{ run.timeText }}</small>
            </div>
          </div>
          <p class="nw-rules">只记最近 20 场；失败也会留下记录，方便回看哪一夜开始吃力。</p>
        </div>

        <button class="primary-btn nw-archive-start" type="button" @click="view = 'watch'">去守一夜</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from "vue";
import { nightPanelStore } from "./nightPanelStore.js";

defineProps({
  handlers: { type: Object, required: true },
  icons: { type: Object, default: () => ({}) }
});

const snapshot = computed(() => nightPanelStore.snapshot);
const view = ref("watch");
const ownedMedals = computed(
  () => (snapshot.value?.medals || []).filter((medal) => medal.owned).length
);

// Roving tabindex: arrow keys move between 守夜 and 档案 like a real tablist.
function onTabKeydown(event) {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") {
    view.value = "watch";
  } else if (event.key === "End") {
    view.value = "archive";
  } else {
    view.value = view.value === "watch" ? "archive" : "watch";
  }
  nextTick(() => {
    const id = view.value === "watch" ? "nw-tab-watch" : "nw-tab-archive";
    document.getElementById(id)?.focus();
  });
}
</script>
