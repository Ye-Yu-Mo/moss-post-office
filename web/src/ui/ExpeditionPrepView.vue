<template>
  <div v-if="snapshot" class="exp-prep">
    <p class="exp-lead">行前准备</p>
    <p class="account-hint">材料是远行成功后带回的。每次准备会消耗一份，整趟有效。</p>
    <div class="exp-choices">
      <button
        v-for="item in snapshot.items"
        :key="item.id"
        class="exp-choice"
        :class="{ 'is-selected': item.selected }"
        type="button"
        :disabled="item.disabled"
        @click.stop="$emit('toggle', item.id)"
      >
        <b>{{ item.name }} · {{ item.materialName }} {{ item.cost }}</b>
        <span>{{ item.note }}</span>
      </button>
    </div>
    <p class="exp-hint">现有材料：{{ snapshot.summary }}</p>
    <div class="exp-result-actions">
      <button class="exp-primary" type="button" @click.stop="$emit('start')">
        {{ snapshot.count ? "带着这些出发" : "空手出发" }}
      </button>
      <button class="exp-secondary" type="button" @click.stop="$emit('skip')">不带材料，直接走</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { expeditionPrepStore } from "./expeditionPrepStore.js";

defineEmits(["toggle", "start", "skip"]);
const snapshot = computed(() => expeditionPrepStore.snapshot);
</script>
