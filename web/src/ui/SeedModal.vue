<template>
  <div v-if="snapshot" class="seed-box">
    <p class="town-lead">种下的作物会占一块地。收完再选下一轮；稀有种子按累计收菜次数解锁。</p>
    <div class="seed-grid">
      <button
        v-for="card in snapshot.crops"
        :key="card.id"
        class="seed-card"
        :class="{ 'is-locked': !card.unlocked }"
        type="button"
        :disabled="!card.unlocked"
        :data-crop="card.id"
        @click.stop="$emit('pick', card.id)"
      >
        <span class="seed-icon" aria-hidden="true" v-html="card.icon"></span>
        <b>{{ card.name }}</b>
        <small>{{ card.minutes }} 分钟 · {{ card.reward }}</small>
        <span class="seed-lock">{{ card.unlocked ? "可以种" : `收 ${card.unlockAt} 次解锁` }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { seedStore } from "./seedStore.js";

defineEmits(["pick"]);
const snapshot = computed(() => seedStore.snapshot);
</script>
