<template>
  <template v-if="snapshot">
    <p v-for="(line, index) in snapshot.lines" :key="'line-' + index">{{ line }}</p>
    <div class="event-choices">
      <button
        v-for="choice in snapshot.choices"
        :key="choice.index"
        class="event-choice"
        type="button"
        :disabled="choice.disabled"
        @click.stop="$emit('choose', choice.index)"
      >
        <b>{{ choice.label }}</b>
        <span>{{ choice.note }}</span>
      </button>
    </div>
  </template>
</template>

<script setup>
import { computed } from "vue";
import { eventStore } from "./eventStore.js";

defineEmits(["choose"]);
const snapshot = computed(() => eventStore.snapshot);
</script>
