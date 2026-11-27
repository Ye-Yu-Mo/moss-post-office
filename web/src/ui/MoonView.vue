<template>
  <div v-if="snapshot" class="moon-view">
    <div class="moon-card" aria-hidden="true">
      <img src="/assets/moon-banner.webp" alt="" width="1200" height="480" loading="lazy" decoding="async">
      <p class="moon-caption">23:00 · 夜班邮车</p>
    </div>
    <p class="prestige-copy">攒够 30,000 张邮票，夜班邮车就会来接走这一程的信。月光邮戳可以点亮月光树：每用掉 1 枚，全局产出 +10%，节点永久保留。柜台来信每完成 4 封，也会留下 1 枚。</p>
    <div class="prestige-stats">
      <div class="prestige-stat">
        <span>已得到的月光邮戳</span>
        <strong>{{ snapshot.moonStamps }} 枚</strong>
      </div>
      <div class="prestige-stat">
        <span>全局产出加成</span>
        <strong>+{{ snapshot.bonusPercent }}%</strong>
      </div>
    </div>

    <section class="moon-tree">
      <div class="tree-head">
        <span>月光树</span>
        <span><b>{{ snapshot.points }}</b> 枚可用</span>
      </div>
      <div class="tree-grid">
        <div v-for="branch in snapshot.branches" :key="branch.id" class="tree-branch">
          <div class="tree-branch-head">{{ branch.name }}</div>
          <button
            v-for="node in branch.nodes"
            :key="node.id"
            class="tree-node"
            :class="{ 'is-owned': node.owned, 'is-fillable': node.fillable }"
            type="button"
            :disabled="node.owned || !node.fillable"
            :aria-label="`${node.name}，${node.desc}，${node.reason}`"
            @click="handlers.onBuyNode(node.id)"
          >
            <span class="node-dot" aria-hidden="true"></span>
            <span class="node-copy"><b>{{ node.name }}</b><small>{{ node.desc }}</small></span>
            <span class="node-cost">{{ node.reason }}</span>
          </button>
        </div>
      </div>
      <p class="tree-note">点亮顺序：每条分支从上往下。节点效果会立刻生效。</p>
    </section>

    <section class="contract-box">
      <div class="tree-head">
        <span>夜班契约</span>
        <span>{{ snapshot.contractStatus }}</span>
      </div>
      <div class="contract-grid">
        <button
          v-for="contract in snapshot.contracts"
          :key="contract.id"
          class="contract-card"
          :class="{ 'is-active': contract.active }"
          type="button"
          :disabled="contract.locked"
          @click="handlers.onSelectContract(contract.id)"
        >
          <b>{{ contract.name }}</b>
          <small>{{ contract.desc }}</small>
          <span>{{ contract.active ? "本局生效中" : contract.locked ? "本局已定" : "选它" }}</span>
        </button>
      </div>
      <p class="tree-note">发车后会清空契约，下一程重新选。</p>
    </section>

    <div class="prestige-progress">
      <div class="prestige-progress-top">
        <span>下一枚月光邮戳</span>
        <b>{{ snapshot.progressText }}</b>
      </div>
      <div class="prestige-bar"><span class="prestige-fill" :style="{ width: snapshot.fillPercent + '%' }"></span></div>
    </div>
    <button
      class="primary-btn"
      type="button"
      :disabled="!snapshot.prestigeReady"
      :aria-label="snapshot.prestigeAria"
      @click="handlers.onPrestige"
    >{{ snapshot.prestigeLabel }}</button>
    <p class="prestige-note">本程邮票、小邮差、风铃、工坊邮戳和手上的来信会重新开始；月光邮戳、月光树、邮路熟练度、远行、墨点与集邮册会留下。</p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { moonStore } from "./moonStore.js";

defineProps({
  handlers: { type: Object, required: true }
});
const snapshot = computed(() => moonStore.snapshot);
</script>
