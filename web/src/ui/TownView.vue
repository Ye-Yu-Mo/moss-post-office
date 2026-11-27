<template>
  <div class="town-box">
    <div class="town-head">
      <p class="town-lead">镇口的邮差会互寄明信片。真人玩家和 NPC 都会回信，每天最多寄 5 张。</p>
      <button class="link-btn" type="button" @click="onRefresh">刷新</button>
    </div>

    <section class="town-section town-friends">
      <div class="tree-head"><span>好友</span><span>{{ friends.friends.length }} 位</span></div>
      <div class="friend-code-row">
        <span>我的好友码</span>
        <b>{{ friends.code || "------" }}</b>
        <button class="link-btn" type="button" @click="onCopyCode">复制</button>
      </div>
      <div class="friend-add-row">
        <input id="friendCodeInput" v-model="friendCode" maxlength="6" autocomplete="off" placeholder="输入 6 位好友码">
        <button class="primary-btn friend-add-btn" type="button" @click="submitFriend">加好友</button>
      </div>
      <div v-if="friends.incoming.length" class="friend-requests">
        <div v-for="request in friends.incoming" :key="request.id" class="friend-request">
          <div>
            <b>{{ request.from_name }}</b>
            <small>想加你为好友 · {{ time(request.created_at) }}</small>
          </div>
          <div class="friend-request-actions">
            <button class="link-btn" type="button" @click="onAcceptFriend(request.id)">接受</button>
            <button class="link-btn" type="button" @click="onDeclineFriend(request.id)">忽略</button>
          </div>
        </div>
      </div>
      <p v-if="friends.outgoing.length" class="friend-note">
        已申请：{{ friends.outgoing.map((request) => request.to_name).join("、") }}，等对方接受。
      </p>
      <div v-if="friends.friends.length" class="friend-list">
        <div v-for="friend in friends.friends" :key="friend.id" class="friend-row">
          <span v-html="avatar(friend.username)"></span>
          <div class="friend-copy">
            <b>{{ friend.username }}</b>
            <small>{{ fmt(friend.total_stamps) }} 邮票 · {{ fmt(friend.expedition_wins) }} 趟远行 · {{ time(friend.last_active) }}</small>
          </div>
          <div class="friend-actions">
            <button class="link-btn" type="button" @click="onSendPostcard(friend.id, 'user', friend.username)">寄明信片</button>
            <button class="link-btn" type="button" @click="onFriendProfile(friend.id)">串门</button>
            <button class="link-btn" type="button" @click="onGardenOpen(friend.id)">后院</button>
            <button class="link-btn" type="button" @click="onVisitFriend(friend.id)">留邮戳</button>
            <button class="link-btn" type="button" @click="onRemoveFriend(friend.id)">删除</button>
          </div>
        </div>
      </div>
      <div v-else class="town-empty">还没有好友。把好友码发给朋友，或者在镇口找一位邮差。</div>
    </section>

    <GardenPanel
      v-if="data.garden"
      :garden="data.garden"
      :icons="helpers.icons"
      :format-number="helpers.formatNumber"
      :time-text="helpers.timeText"
      :avatar-for="helpers.avatarFor"
      @harvest="onHarvest"
      @water="onWater"
      @open-seeds="onOpenSeeds"
      @claim-quest="onClaimQuest"
    />

    <section class="town-section">
      <div class="tree-head"><span>收到的明信片</span><span>{{ cards.length }} 封</span></div>
      <div v-if="cards.length" class="town-mail-list">
        <article
          v-for="card in cards"
          :key="card.id"
          class="town-mail-card"
          :class="{ 'is-bot': card.sender_kind === 'bot' }"
        >
          <div class="town-mail-top">
            <b>{{ card.sender }}</b>
            <span>{{ card.sender_kind === "bot" ? "镇上的邮差" : "路过的邮差" }}</span>
          </div>
          <p>{{ card.text }}</p>
          <div class="town-mail-foot">
            <small>{{ time(card.created_at) }}</small>
            <template v-if="card.gift_kind">
              <button
                v-if="!card.claimed"
                class="link-btn"
                type="button"
                @click="onClaimPostcard(card.id)"
              >收下 {{ giftLabel(card.gift_kind, card.gift_amount) }}</button>
              <span v-else class="town-claimed">已收下 {{ giftLabel(card.gift_kind, card.gift_amount) }}</span>
            </template>
          </div>
        </article>
      </div>
      <div v-else class="town-empty">还没有明信片。去镇口找一位邮差聊聊吧。</div>
    </section>

    <section class="town-section">
      <div class="tree-head"><span>镇上的邮差</span><span>按邮票排序</span></div>
      <div class="town-player-list">
        <article
          v-for="player in data.players"
          :key="player.id"
          class="town-player"
          :class="{ 'is-bot': player.kind === 'bot' }"
        >
          <div class="town-player-copy">
            <div class="town-player-name">
              <span v-html="avatar(player.name)"></span>
              <b>{{ player.name }}</b>
              <span v-if="player.kind === 'bot'" class="town-npc">NPC</span>
              <span v-if="isSelf(player)" class="town-self">我</span>
            </div>
            <small>{{ player.bio || (player.kind === "bot" ? "镇上的老邮差。" : "路过的邮差。") }}</small>
          </div>
          <div class="town-player-stats">
            <span>{{ fmt(player.total_stamps) }} 邮票</span>
            <span>{{ fmt(player.expedition_wins) }} 趟远行</span>
          </div>
          <div class="town-player-actions">
            <small>{{ time(player.last_active) }}</small>
            <template v-if="!isSelf(player)">
              <button class="link-btn" type="button" @click="onSendPostcard(player.id, player.kind, player.name)">寄明信片</button>
              <button v-if="player.kind === 'bot'" class="link-btn" type="button" @click="onGardenOpen(player.id)">后院</button>
            </template>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import GardenPanel from "./GardenPanel.vue";

const props = defineProps({
  data: { type: Object, required: true },
  account: { type: Object, default: null },
  helpers: { type: Object, required: true },
  onRefresh: { type: Function, default: () => {} },
  onCopyCode: { type: Function, default: () => {} },
  onFriendAdd: { type: Function, default: () => {} },
  onAcceptFriend: { type: Function, default: () => {} },
  onDeclineFriend: { type: Function, default: () => {} },
  onRemoveFriend: { type: Function, default: () => {} },
  onFriendProfile: { type: Function, default: () => {} },
  onVisitFriend: { type: Function, default: () => {} },
  onGardenOpen: { type: Function, default: () => {} },
  onSendPostcard: { type: Function, default: () => {} },
  onClaimPostcard: { type: Function, default: () => {} },
  onHarvest: { type: Function, default: () => {} },
  onWater: { type: Function, default: () => {} },
  onOpenSeeds: { type: Function, default: () => {} },
  onClaimQuest: { type: Function, default: () => {} }
});

const friendCode = ref("");
const friends = computed(() => props.data.friends || { code: "", friends: [], incoming: [], outgoing: [] });
const cards = computed(() => props.data.cards || []);

function fmt(value) {
  return props.helpers.formatNumber(value);
}
function time(value) {
  return props.helpers.timeText(value);
}
function avatar(name) {
  return props.helpers.avatarFor(name);
}
function giftLabel(kind, amount) {
  if (kind === "ink") return `墨点×${amount}`;
  if (kind === "stamps") return `邮票×${props.helpers.formatNumber(amount)}`;
  if (props.helpers.materials && props.helpers.materials[kind]) {
    return `${props.helpers.materials[kind].name}×${amount}`;
  }
  return `${kind}×${amount}`;
}
function isSelf(player) {
  return Boolean(props.account && player.id === props.account.userId);
}
function submitFriend() {
  props.onFriendAdd(friendCode.value.trim().toUpperCase());
  friendCode.value = "";
}
</script>
