<template>
  <div v-if="snapshot" class="town-box">
    <div v-if="snapshot.status === 'loading'" class="town-loading" role="status" aria-live="polite">正在敲门…</div>

    <template v-else-if="snapshot.status === 'error'">
      <p class="town-lead">{{ snapshot.error }}</p>
      <button class="primary-btn" type="button" @click.stop="$emit('back')">回镇口</button>
    </template>

    <template v-else>
      <div class="friend-profile">
        <p class="friend-profile-kicker">好友的邮局</p>
        <h4>{{ snapshot.friend.name }}</h4>
        <p class="town-lead">好友码 {{ snapshot.friend.code }}</p>
        <div class="friend-profile-stats">
          <span><b>{{ snapshot.friend.stamps }}</b> 邮票</span>
          <span><b>{{ snapshot.friend.wins }}</b> 趟远行</span>
          <span><b>{{ snapshot.friend.postcards }}</b> 张明信片</span>
          <span><b>{{ snapshot.friend.visits }}</b> 枚访客邮戳</span>
        </div>
        <p class="town-lead">最后活跃：{{ snapshot.friend.activeText }}。</p>
      </div>
      <div class="exp-result-actions">
        <button class="exp-primary" type="button" @click.stop="$emit('send')">寄明信片</button>
        <button class="exp-secondary" type="button" @click.stop="$emit('visit')">留一枚访客邮戳</button>
        <button class="exp-secondary" type="button" @click.stop="$emit('back')">回镇口</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { friendProfileStore } from "./friendProfileStore.js";

defineEmits(["send", "visit", "back"]);
const snapshot = computed(() => friendProfileStore.snapshot);
</script>
