// 隔离压测：先用 release server + 独立 DB 起在 17342，再 MOSS_API_PORT=17342 serve.py 17341。
// 运行：MOSS_STRESS_ROOT=http://127.0.0.1:17341 npm run qa:stress
import { createHmac } from "node:crypto";

const ROOT = process.env.MOSS_STRESS_ROOT || "http://127.0.0.1:17341";
const API = `${ROOT}/api`;
const VERIFIER = "11".repeat(32);
const RUN = Date.now().toString().slice(-7);
const stats = new Map();

function record(name, r) {
  if (!stats.has(name)) stats.set(name, []);
  stats.get(name).push({ ms: r.ms, status: r.status });
}

function summary(name) {
  const rows = stats.get(name) || [];
  if (!rows.length) return console.log(`${name}: no data`);
  const lat = rows.map((r) => r.ms).sort((a, b) => a - b);
  const pick = (p) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))].toFixed(1);
  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log(`${name.padEnd(24)} n=${String(rows.length).padEnd(4)} p50=${pick(0.5)}ms p95=${pick(0.95)}ms p99=${pick(0.99)}ms max=${lat[lat.length - 1].toFixed(1)}ms status=${JSON.stringify(counts)}`);
}

async function http(path, { method = "GET", token, body, headers = {}, root = false } = {}) {
  const url = path.startsWith("http") ? path : `${root ? ROOT : API}${path}`;
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, ms: performance.now() - started, headers: response.headers };
  } catch (error) {
    return { status: 0, error: String(error), ms: performance.now() - started };
  }
}

async function pool(total, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (true) {
      const current = index++;
      if (current >= total) break;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function proof(nonce) {
  return createHmac("sha256", Buffer.from(VERIFIER, "hex")).update(nonce).digest("hex");
}

async function register(name) {
  return http("/v1/auth/register", {
    method: "POST",
    body: { username: name, verifier: VERIFIER }
  });
}

async function savePut(token, baseRevision, payload) {
  return http("/v1/save", {
    method: "PUT",
    token,
    body: { base_revision: baseRevision, payload, client_ts: Date.now() }
  });
}

const USERS = 200;
const users = [];

async function main() {
  // Static assets
  let index = await http("/", { root: true });
  record("static.index", index);
  const asset = /assets\/index-[^"]+\.js/.exec(String(index.data))?.[0];
  const css = /assets\/index-[^"]+\.css/.exec(String(index.data))?.[0];
  await pool(200, 25, async () => record("static.index.load", await http("/", { root: true })));
  if (asset) {
    await pool(300, 30, async () => record("static.js", await http(`/${asset}`, { root: true })));
  }
  if (css) {
    await pool(200, 30, async () => record("static.css", await http(`/${css}`, { root: true })));
  }
  if (asset) {
    const first = await http(`/${asset}`, { root: true });
    const etag = first.headers.get("etag");
    if (etag) {
      await pool(100, 20, async () =>
        record("static.etag", await http(`/${asset}`, { root: true, headers: { "If-None-Match": etag } }))
      );
    }
  }

  // Register 200 users
  await pool(USERS, 20, async (i) => {
    const name = `st${RUN}${i}`;
    const result = await register(name);
    record("auth.register", result);
    if (result.status === 200) users.push(result.data);
  });
  console.log(`registered ${users.length}/${USERS}`);

  // Login 100 users
  await pool(100, 10, async (i) => {
    const user = users[i % users.length];
    if (!user) return;
    const challenge = await http("/v1/auth/challenge", {
      method: "POST",
      body: { username: user.username }
    });
    record("auth.challenge", challenge);
    if (challenge.status !== 200) return;
    const login = await http("/v1/auth/login", {
      method: "POST",
      body: { username: user.username, nonce: challenge.data.nonce, proof: proof(challenge.data.nonce) }
    });
    record("auth.login", login);
  });

  // Square load
  const token = users[0]?.token;
  await pool(800, 40, async () => record("api.square", await http("/v1/square", { token })));

  // Save read/write for 50 users
  await pool(50, 10, async (i) => {
    const user = users[i];
    if (!user) return;
    let revision = 0;
    for (let n = 0; n < 8; n += 1) {
      const put = await savePut(user.token, revision, {
        version: 15,
        stamps: 1000 + n,
        totalEarned: 5000 + n,
        nightWatch: { best: 0 }
      });
      record("api.save.put", put);
      if (put.status === 200) revision = put.data.revision;
    }
    for (let n = 0; n < 4; n += 1) {
      record("api.save.get", await http("/v1/save", { token: user.token }));
    }
  });

  // Postcards: 30 users x 10 concurrent
  let postcardDistribution = {};
  await pool(30, 10, async (i) => {
    const user = users[i];
    if (!user) return;
    const codes = [];
    await Promise.all(
      Array.from({ length: 10 }, async () => {
        const result = await http("/v1/postcards", {
          method: "POST",
          token: user.token,
          body: { recipient_id: "b_moss", recipient_kind: "bot", template: "hello" }
        });
        codes.push(result.status);
        record("api.postcard.send", result);
      })
    );
    postcardDistribution[codes.filter((c) => c === 200).length] =
      (postcardDistribution[codes.filter((c) => c === 200).length] || 0) + 1;
  });
  console.log("postcard accepted-count distribution:", JSON.stringify(postcardDistribution));

  // Night medals: 20 users upload best20, fire duplicate claims
  const medalSerials = [];
  await pool(20, 10, async (i) => {
    const user = users[USERS - 1 - i];
    if (!user) return;
    const put = await savePut(user.token, 0, {
      version: 15,
      stamps: 100,
      totalEarned: 100,
      nightWatch: { best: 20 }
    });
    record("api.save.putMedal", put);
    if (put.status !== 200) return;
    const levels = [5, 5, 10, 10, 20, 20];
    const results = await Promise.all(
      levels.map((level) =>
        http("/v1/nightwatch/claim", {
          method: "POST",
          token: user.token,
          body: { level }
        })
      )
    );
    results.forEach((result) => {
      record("api.medal.claim", result);
      if (result.status === 200 && result.data.collectible) {
        medalSerials.push(`${result.data.collectible.template}:${result.data.collectible.serial}`);
      }
    });
  });
  console.log(`medal serials minted=${medalSerials.length}, unique=${new Set(medalSerials).size}`);

  // Garden: 10 users race harvest/plant
  await pool(10, 5, async (i) => {
    const user = users[i + 60];
    if (!user) return;
    const garden = await http("/v1/garden", { token: user.token });
    record("api.garden.get", garden);
    if (garden.status !== 200) return;
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        record(
          "api.garden.harvestRace",
          await http("/v1/garden/harvest", { method: "POST", token: user.token, body: { plot: 0 } })
        );
      })
    );
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        record(
          "api.garden.plantRace",
          await http("/v1/garden/plant", { method: "POST", token: user.token, body: { plot: 0, crop: "letter" } })
        );
      })
    );
  });

  // Health
  await pool(200, 20, async () => record("api.health", await http("/healthz")));

  for (const name of [...stats.keys()].sort()) summary(name);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
