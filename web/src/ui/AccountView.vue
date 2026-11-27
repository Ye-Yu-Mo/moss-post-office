<template>
  <div class="account-box">
    <template v-if="!loggedIn">
      <div class="account-tabs" role="tablist" aria-label="登录或注册">
        <button
          class="account-tab"
          :class="{ 'is-active': mode === 'login' }"
          type="button"
          role="tab"
          data-account-mode="login"
          :aria-selected="mode === 'login'"
          @click="mode = 'login'"
        >登录</button>
        <button
          class="account-tab"
          :class="{ 'is-active': mode === 'register' }"
          type="button"
          role="tab"
          data-account-mode="register"
          :aria-selected="mode === 'register'"
          @click="mode = 'register'"
        >注册</button>
      </div>
      <p class="account-copy">
        {{ mode === "register"
          ? "注册时会把浏览器里的本地存档一起上传；之后换设备登录，就能接着这一程送信。"
          : "登录后以服务器上的存档为准，本机进度会被服务器覆盖。" }}
      </p>
      <label class="account-field"><span>用户名</span>
        <input id="accountUser" v-model="username" autocomplete="username" maxlength="24" placeholder="3-24 个字符">
      </label>
      <label class="account-field"><span>密码</span>
        <input
          id="accountPass"
          v-model="password"
          type="password"
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          maxlength="128"
          placeholder="至少 8 位"
        >
      </label>
      <label class="account-field"><span>服务器</span>
        <input id="accountBase" v-model="baseInput" placeholder="http://127.0.0.1:17322">
      </label>
      <p class="account-status" id="accountStatus" role="status" aria-live="polite">{{ message }}</p>
      <button class="primary-btn account-submit" type="button" data-account-submit :disabled="busy" @click="submit">
        {{ busy ? "正在处理…" : mode === "register" ? "注册并上传存档" : "登录" }}
      </button>
      <p class="account-hint">密码不会离开浏览器：登录用一次性挑战，服务器只存派生校验值。HTTP 下仍请勿复用重要密码。</p>
    </template>

    <template v-else>
      <p class="account-user">已登录 <b>{{ account.username }}</b></p>
      <p class="account-status" id="accountStatus" role="status" aria-live="polite">{{ message }}</p>
      <div v-if="account.conflict" class="account-conflict">
        <p>云端存档比本机新（修订 {{ account.conflict }}）。选一份保留：</p>
        <div class="account-actions">
          <button class="primary-btn" type="button" data-account-pull @click="onPull">用云端覆盖本地</button>
          <button class="secondary-btn" type="button" data-account-push @click="onPush">上传本地覆盖云端</button>
        </div>
      </div>
      <div class="account-actions">
        <button class="primary-btn" type="button" data-account-sync :disabled="account.conflict" @click="onSync">立即同步</button>
        <button class="secondary-btn" type="button" data-account-logout @click="onLogout">退出登录</button>
      </div>
      <p class="account-hint">服务器 {{ account.base }} · 修订 {{ account.revision }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  account: { type: Object, default: null },
  status: { type: String, default: "" },
  base: { type: String, default: "" },
  onSubmit: { type: Function, required: true },
  onLogout: { type: Function, default: () => {} },
  onSync: { type: Function, default: () => {} },
  onPull: { type: Function, default: () => {} },
  onPush: { type: Function, default: () => {} }
});

const mode = ref("login");
const username = ref("");
const password = ref("");
const baseInput = ref(props.base || "");
const busy = ref(false);
const message = ref(props.status || "");

watch(
  () => props.status,
  (value) => {
    message.value = value || "";
  }
);

const loggedIn = computed(() => Boolean(props.account && props.account.token));

async function submit() {
  if (busy.value) return;
  const user = username.value.trim();
  const pass = password.value;
  if (user.length < 3 || user.length > 24) {
    message.value = "用户名需要 3-24 个字符。";
    return;
  }
  if (pass.length < 8) {
    message.value = "密码至少 8 位。";
    return;
  }
  busy.value = true;
  message.value = "正在生成登录凭据…";
  try {
    const result = await props.onSubmit({
      mode: mode.value,
      username: user,
      password: pass,
      base: baseInput.value.trim() || props.base
    });
    if (result && result.message) message.value = result.message;
  } catch (error) {
    message.value = "操作失败，请稍后再试。";
  } finally {
    busy.value = false;
  }
}
</script>
