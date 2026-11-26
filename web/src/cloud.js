const ACCOUNT_KEY = "moss-post-office.account.v1";
const TIMEOUT_MS = 8000;

export class CloudError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "CloudError";
    this.status = status;
    this.payload = payload;
  }
}

export function defaultBase() {
  if (typeof window === "undefined") return "http://127.0.0.1:17322";
  if (!window.location.protocol.startsWith("http")) {
    return "http://127.0.0.1:17322";
  }
  // Vite dev server has no /api proxy; production/built pages do.
  if (window.location.port === "5173" || window.location.port === "4173") {
    return "http://127.0.0.1:17322";
  }
  return "/api";
}

function normalizeBase(base) {
  const value = String(base || defaultBase()).trim().replace(/\/+$/, "");
  return value || defaultBase();
}

export function loadAccount() {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      base: normalizeBase(parsed.base),
      token: String(parsed.token || ""),
      userId: String(parsed.userId || ""),
      username: String(parsed.username || ""),
      revision: Math.max(0, Number(parsed.revision) || 0),
      dirty: Boolean(parsed.dirty),
      conflict: Math.max(0, Number(parsed.conflict) || 0)
    };
  } catch (error) {
    return null;
  }
}

export function saveAccount(account) {
  try {
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch (error) {
    /* Private windows can refuse storage. */
  }
}

export function clearAccount() {
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
  } catch (error) {
    /* ignore */
  }
}

async function request(base, path, { method = "GET", token = "", body, allow404 = false } = {}) {
  const url = `${normalizeBase(base)}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      mode: "cors",
      cache: "no-store"
    });
  } catch (error) {
    throw new CloudError("连不上邮局服务器", 0);
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = null;
    }
  }

  if (response.ok) return payload;
  if (allow404 && response.status === 404) return null;
  const message =
    (payload && (payload.message || payload.error)) || `服务器返回 ${response.status}`;
  throw new CloudError(message, response.status, payload);
}

export async function register({ base, username, verifier, save }) {
  return request(base, "/v1/auth/register", {
    method: "POST",
    body: { username, verifier, save }
  });
}

export async function challenge({ base, username }) {
  return request(base, "/v1/auth/challenge", {
    method: "POST",
    body: { username }
  });
}

export async function login({ base, username, nonce, proof }) {
  return request(base, "/v1/auth/login", {
    method: "POST",
    body: { username, nonce, proof }
  });
}

export async function me(account) {
  return request(account.base, "/v1/me", { token: account.token });
}

export async function pull(account) {
  return request(account.base, "/v1/save", {
    token: account.token,
    allow404: true
  });
}

export async function push(account, payload) {
  return request(account.base, "/v1/save", {
    method: "PUT",
    token: account.token,
    body: {
      base_revision: account.revision,
      payload,
      client_ts: Date.now()
    }
  });
}

export async function square(account) {
  return request(account.base, "/v1/square", { token: account.token });
}

export async function postcards(account) {
  return request(account.base, "/v1/postcards", { token: account.token });
}

export async function sendPostcard(account, recipientId, recipientKind, template) {
  return request(account.base, "/v1/postcards", {
    method: "POST",
    token: account.token,
    body: {
      recipient_id: recipientId,
      recipient_kind: recipientKind,
      template
    }
  });
}

export async function friends(account) {
  return request(account.base, "/v1/friends", { token: account.token });
}

export async function requestFriend(account, code) {
  return request(account.base, "/v1/friends/request", {
    method: "POST",
    token: account.token,
    body: { code }
  });
}

export async function acceptFriend(account, id) {
  return request(account.base, "/v1/friends/accept", {
    method: "POST",
    token: account.token,
    body: { id }
  });
}

export async function declineFriend(account, id) {
  return request(account.base, "/v1/friends/decline", {
    method: "POST",
    token: account.token,
    body: { id }
  });
}

export async function removeFriend(account, friendId) {
  return request(account.base, `/v1/friends/${encodeURIComponent(friendId)}`, {
    method: "DELETE",
    token: account.token
  });
}

export async function friendProfile(account, friendId) {
  return request(account.base, `/v1/friends/${encodeURIComponent(friendId)}`, {
    token: account.token
  });
}

export async function claimPostcard(account, postcardId) {
  return request(account.base, `/v1/postcards/${postcardId}/claim`, {
    method: "POST",
    token: account.token,
    body: {}
  });
}

export async function logout(account) {
  return request(account.base, "/v1/auth/logout", {
    method: "POST",
    token: account.token,
    body: {}
  });
}
