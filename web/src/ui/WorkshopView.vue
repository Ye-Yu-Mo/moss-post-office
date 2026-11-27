<template>
  <div v-if="snapshot" class="workshop-view">
    <article
      v-for="upgrade in snapshot.upgrades"
      :key="upgrade.id"
      class="upgrade"
      :class="{ purchased: upgrade.purchased, locked: !upgrade.purchased && !upgrade.unlocked }"
    >
      <div class="up-icon" aria-hidden="true" v-html="upgrade.icon"></div>
      <div class="up-copy">
        <div class="up-name">
          {{ upgrade.name }}
          <span class="up-tag">{{ upgrade.effectLabel }}</span>
        </div>
        <div class="up-desc">{{ upgrade.desc }}</div>
      </div>
      <span v-if="upgrade.purchased" class="owned-mark">已盖戳</span>
      <button
        v-else
        class="buy-btn"
        :class="{ 'can-buy': upgrade.canBuy, 'locked-btn': !upgrade.unlocked }"
        type="button"
        :disabled="!upgrade.canBuy"
        :aria-label="upgrade.ariaLabel"
        :title="upgrade.title"
        @click="handlers.onBuyUpgrade(upgrade.id)"
      >
        <span class="cost">{{ upgrade.costText }}</span>
        <span class="unit">{{ upgrade.unitText }}</span>
      </button>
    </article>

    <section class="material-workshop">
      <div class="tree-head">
        <span>材料工坊</span>
        <span>{{ snapshot.materialsText }}</span>
      </div>
      <p class="tree-note">材料只在远行成功后带回；这里的升级永久生效，转生也会留下。</p>
      <article
        v-for="item in snapshot.materialUpgrades"
        :key="item.id"
        class="upgrade material-upgrade"
        :class="{ purchased: item.purchased }"
      >
        <div class="up-icon" aria-hidden="true" v-html="item.icon"></div>
        <div class="up-copy">
          <div class="up-name">{{ item.name }}<span class="up-tag">远行 · 永久</span></div>
          <div class="up-desc">{{ item.purchased ? "已经建好，永久生效。" : item.desc }}</div>
        </div>
        <span v-if="item.purchased" class="owned-mark">已建成</span>
        <button
          v-else
          class="buy-btn"
          type="button"
          :disabled="!item.affordable"
          @click="handlers.onBuyMaterialUpgrade(item.id)"
        >
          <span class="cost">{{ item.cost }}</span>
          <span class="unit">{{ item.materialName }}</span>
        </button>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { workshopStore } from "./workshopStore.js";

const props = defineProps({
  handlers: { type: Object, required: true }
});
const snapshot = computed(() => workshopStore.snapshot);
</script>
