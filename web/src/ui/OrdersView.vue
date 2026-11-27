<template>
  <div v-if="snapshot" class="orders-view">
    <div class="order-summary">
      <div class="order-summary-copy">
        <span class="order-kicker">来信柜台</span>
        <p>柜台一次留得下 {{ snapshot.slots }} 封。挑一封接下，在时限内送出去；送不到也不扣东西，只是信会被邮车带走。</p>
      </div>
      <div class="order-ink-box">
        <span class="ink-line-mini"><span class="ink-mark" aria-hidden="true"></span>墨点 <b>{{ fmt(snapshot.ink) }}</b></span>
        <span class="order-materials">材料 {{ snapshot.materialsText }}</span>
        <button class="order-reroll" type="button" :disabled="!snapshot.canReroll" @click="handlers.onReroll">
          换一批 · {{ snapshot.rerollCost }}
        </button>
      </div>
    </div>
    <div v-if="snapshot.contract" class="order-contract">
      <span>{{ snapshot.contract.name }}</span>{{ snapshot.contract.desc }}
    </div>

    <div class="order-section">
      <div class="order-section-head">
        <span>手上的信</span>
        <span>{{ snapshot.accepted.length }} / {{ snapshot.slots }}</span>
      </div>
      <div v-if="snapshot.accepted.length" class="order-list">
        <article
          v-for="order in snapshot.accepted"
          :key="order.id"
          class="order-card is-accepted"
          :class="{ 'is-ready': order.ready && !expired(order) }"
        >
          <div class="order-top">
            <span class="order-sender">{{ order.sender }}</span>
            <span class="order-tag">{{ order.tag }}</span>
          </div>
          <h4 class="order-title">{{ order.title }}</h4>
          <p class="order-quote">“{{ order.quote }}”</p>
          <div class="order-goal">
            <span>{{ order.unit }}</span>
            <b>{{ fmt(order.progress) }} / {{ fmt(order.target) }}</b>
          </div>
          <div class="order-bar"><span :style="{ width: order.percent + '%' }"></span></div>
          <div v-if="order.costText" class="order-material-cost">交付需 {{ order.costText }}</div>
          <div class="order-reward">
            <span>+{{ fmt(order.stamps) }} 邮票</span>
            <span>+{{ fmt(order.ink) }} 墨点</span>
            <span v-if="order.rewardText">+{{ order.rewardText }}</span>
          </div>
          <p v-if="order.note" class="order-note">{{ order.note }}</p>
          <div class="order-actions">
            <span class="order-timer">剩 {{ clock(order.expiresAt - now) }}</span>
            <button
              class="order-deliver"
              type="button"
              :disabled="!order.ready || expired(order)"
              @click="handlers.onDeliver(order.id)"
            >交付</button>
            <button class="link-btn order-drop" type="button" @click="handlers.onDrop(order.id)">放下</button>
          </div>
        </article>
      </div>
      <div v-else class="order-empty">手上还没有信。柜台上的来信可以接下，时限内完成就能拿到邮票、墨点，有些信还会留下材料。</div>
    </div>

    <div class="order-section">
      <div class="order-section-head">
        <span>柜台上的信</span>
        <span>每完成 4 封，得 1 枚月光邮戳</span>
      </div>
      <div class="order-list order-offers">
        <article v-for="offer in snapshot.offers" :key="offer.id" class="order-card is-offer">
          <div class="order-top">
            <span class="order-sender">{{ offer.sender }}</span>
            <span class="order-tag">{{ offer.tag }}</span>
          </div>
          <h4 class="order-title">{{ offer.title }}</h4>
          <p class="order-quote">“{{ offer.quote }}”</p>
          <div class="order-goal">
            <span>{{ offer.unit }}</span>
            <b>{{ fmt(offer.target) }}</b>
          </div>
          <div v-if="offer.costText" class="order-material-cost">交付需 {{ offer.costText }}</div>
          <div class="order-reward">
            <span>+{{ fmt(offer.stamps) }} 邮票</span>
            <span>+{{ fmt(offer.ink) }} 墨点</span>
            <span v-if="offer.rewardText">+{{ offer.rewardText }}</span>
          </div>
          <div class="order-actions">
            <span class="order-timer">约 {{ offer.minutes }} 分钟</span>
            <button
              class="order-accept"
              type="button"
              :disabled="snapshot.accepted.length >= snapshot.slots"
              @click="handlers.onAccept(offer.id)"
            >{{ snapshot.accepted.length >= snapshot.slots ? "柜台满了" : "接下" }}</button>
          </div>
        </article>
      </div>
    </div>
    <p class="order-foot">完美盖戳能攒墨点；墨点可以换一批来信，也能让在途的邮路立刻回来。</p>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ordersStore } from "./ordersStore.js";

const props = defineProps({
  handlers: { type: Object, required: true }
});

const snapshot = computed(() => ordersStore.snapshot);
const now = ref(Date.now());
let timer = 0;

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  window.clearInterval(timer);
});

function fmt(value) {
  return props.handlers.formatNumber(value);
}
function expired(order) {
  return order.expiresAt <= now.value;
}
function clock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
</script>
