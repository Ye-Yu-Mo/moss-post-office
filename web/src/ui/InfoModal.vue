<template>
  <template v-if="snapshot">
    <template v-for="(block, index) in snapshot.blocks" :key="index">
      <ol v-if="block.type === 'list'" class="modal-list">
        <li v-for="item in block.items" :key="item.n">
          <b>{{ item.n }}</b><span>{{ item.text }}</span>
        </li>
      </ol>
      <p v-else>
        <template v-for="(run, runIndex) in block.runs" :key="runIndex">
          <b v-if="run.strong">{{ run.t }}</b>
          <template v-else>{{ run.t }}</template>
        </template>
      </p>
    </template>
  </template>
</template>

<script setup>
import { computed } from "vue";
import { infoStore } from "./infoStore.js";

const snapshot = computed(() => infoStore.snapshot);
</script>
