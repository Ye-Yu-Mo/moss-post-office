<template>
  <div v-if="snapshot" class="room-nav-inner">
    <button
      v-for="item in snapshot.items"
      :key="item.id"
      class="room-btn"
      :class="{ 'is-active': item.id === snapshot.active }"
      type="button"
      :aria-label="item.label"
      :aria-current="item.id === snapshot.active ? 'page' : undefined"
      @click="handlers.onNavigate(item.id)"
    >
      <span class="room-icon" aria-hidden="true" v-html="item.icon"></span>
      <span class="room-label">{{ item.label }}</span>
      <span v-if="item.badge" class="room-badge">{{ item.badge }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { roomNavStore } from "./roomNavStore.js";

const props = defineProps({
  handlers: { type: Object, required: true }
});
const snapshot = computed(() => roomNavStore.snapshot);
</script>
