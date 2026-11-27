<template>
  <div v-if="snapshot" class="town-composer">
    <p class="town-lead">挑一张明信片。对方会收到你的名字和这句话。</p>
    <div class="town-template-list">
      <button
        v-for="template in snapshot.templates"
        :key="template.id"
        class="town-template"
        type="button"
        :disabled="snapshot.sending"
        @click.stop="$emit('send', template.id)"
      >{{ template.text }}</button>
    </div>
    <p id="postcardStatus" class="account-status">{{ snapshot.status }}</p>
    <button class="link-btn" type="button" @click.stop="$emit('back')">回镇口</button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { postcardComposerStore } from "./postcardComposerStore.js";

defineEmits(["send", "back"]);
const snapshot = computed(() => postcardComposerStore.snapshot);
</script>
