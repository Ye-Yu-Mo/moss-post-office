<template>
  <div v-if="snapshot" class="town-box">
    <div v-if="snapshot.status === 'loading'" class="town-loading">正在推开后门…</div>

    <template v-else-if="snapshot.status === 'error'">
      <p class="town-lead">{{ snapshot.error }}</p>
      <button class="primary-btn" type="button" @click.stop="$emit('back')">回镇口</button>
    </template>

    <template v-else>
      <div class="town-head">
        <div>
          <p class="town-lead">
            {{ snapshot.owner.name }} 的后院{{ snapshot.owner.kind === "bot" ? " · NPC" : "" }}
          </p>
          <p class="town-lead">熟了的可以偷一把，每天每块地一次。主人收菜时会少一份。</p>
        </div>
        <button class="link-btn" type="button" @click.stop="$emit('back')">回镇口</button>
      </div>

      <div class="garden-grid">
        <article
          v-for="plot in snapshot.plots"
          :key="plot.plot"
          class="garden-plot"
          :class="{ 'is-ripe': plot.ripe, 'is-empty': plot.empty }"
        >
          <span class="garden-icon" aria-hidden="true" v-html="plot.icon"></span>

          <template v-if="plot.empty">
            <div class="garden-copy">
              <b>空地</b>
              <small>主人还没种下新的种子</small>
            </div>
          </template>

          <template v-else>
            <div class="garden-copy">
              <b>{{ plot.name }}</b>
              <small>{{ plot.status }}{{ plot.stolen ? ` · 被偷 ${plot.stolen} 份` : "" }}</small>
            </div>
            <div class="garden-bar"><span :style="{ width: plot.percent + '%' }"></span></div>
            <button
              v-if="plot.ripe"
              class="link-btn"
              type="button"
              :data-steal-plot="plot.plot"
              @click.stop="$emit('steal', plot.plot)"
            >偷一把</button>
            <button
              v-else-if="!plot.watered"
              class="link-btn"
              type="button"
              :data-help-plot="plot.plot"
              @click.stop="$emit('help', plot.plot)"
            >帮浇水</button>
            <button v-else class="link-btn" type="button" disabled>已浇水</button>
          </template>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { friendGardenStore } from "./friendGardenStore.js";

defineEmits(["steal", "help", "back"]);
const snapshot = computed(() => friendGardenStore.snapshot);
</script>
