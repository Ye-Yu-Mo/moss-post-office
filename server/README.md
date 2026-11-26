# moss-sync

苔藓邮局的薄同步服务：注册登录、云存档、事件上报。它**不参与游戏模拟**，也不认识卡牌、关卡或经济系统。

技术栈：Rust 2021 · axum 0.8 · rusqlite（bundled SQLite）· tokio · HMAC-SHA256。

## 代码结构

```
src/
  main.rs          启动、日志、优雅退出
  lib.rs           AppState + build_router
  config.rs        环境变量
  error.rs         ApiError → HTTP JSON
  api/
    mod.rs         路由表、共享常量
    auth.rs        注册/登录/注销/me、Bearer 校验
    save.rs        云存档
    events.rs      事件上报
    health.rs
  auth/
    mod.rs         token、SHA-256、HMAC 校验、用户名归一化
  db/
    mod.rs         Db 封装（每次请求一个连接，WAL）
    schema.rs      建表、v1/v2 旧表迁移
    users.rs       用户 + verifier
    sessions.rs    会话
    challenges.rs  一次性登录 nonce
    saves.rs       存档 + revision
    events.rs      批量写入
```

实时游戏循环、房间和帧同步**不在这个服务里**。如果以后要做联机，另起一个 colyseus-rs 或 WebSocket 服务，只复用这里的身份校验，见仓库根目录的 `docs/architecture.md`。

## 运行

```bash
cargo test
MOSS_BIND=127.0.0.1:17322 \
MOSS_DB=data/moss.db \
RUST_LOG=moss_sync=info,tower_http=warn \
cargo run
```

环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `MOSS_BIND` | `127.0.0.1:17322` | 监听地址；对外请走反向代理 |
| `MOSS_DB` | `data/moss.db` | SQLite 路径，自动建目录和表 |
| `RUST_LOG` | `moss_sync=info,tower_http=warn` | 日志过滤 |

## 认证（HTTP 下的挑战应答）

为了不在明文 HTTP 上传密码，登录改成：

1. 浏览器用 PBKDF2-SHA256（100k 轮）从 `密码 + 用户名` 派生 32 字节 `verifier`，**密码本身不离开浏览器**。
2. 注册只发送 `verifier`（64 位 hex）；服务端原样保存，用于后续校验。
3. 登录先取一次性 `nonce`（120 秒有效、单次使用），浏览器发送 `HMAC-SHA256(verifier, nonce)` 作为 `proof`。
4. 服务端用保存的 `verifier` 重算并做常量时间比较；成功后发 30 天会话 token。

- 用户名 3–24 字符，大小写不敏感唯一。
- 会话 token 32 字节随机数，服务端只存 SHA-256；注销删除当前会话。
- 除注册/挑战/登录/健康检查外，所有请求需要：

```
Authorization: Bearer <token>
```

**HTTP 的边界**：挑战应答能避免明文密码和登录 proof 重放，但阻止不了主动中间人（可以篡改页面/JS），也阻止不了抓到 Bearer token 后直接使用。正式公开请尽量加 TLS（Caddy、Cloudflare Tunnel 或平台自带 HTTPS）。

### 注册（可带本地存档）

```bash
curl -sS -X POST http://127.0.0.1:17322/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"moss_keeper","verifier":"<64 hex>","save":{"version":6,"stamps":42}}'
```

```json
{
  "user_id": "ca85128ed784ef12259a385f00c04dbf",
  "username": "moss_keeper",
  "token": "SjJYrALJHwld-iq3TgffD25XBDplSm6VJ-PYlJIsSWc",
  "save_revision": 1
}
```

没有 `save` 时 `save_revision` 为 `0`。

### 登录

```bash
# 1. 取 nonce
curl -sS -X POST http://127.0.0.1:17322/v1/auth/challenge \
  -H 'Content-Type: application/json' \
  -d '{"username":"moss_keeper"}'
# {"nonce":"...","expires_at":1795683467,"algorithm":"HMAC-SHA256"}

# 2. 用 verifier 对 nonce 做 HMAC-SHA256，发送 proof
curl -sS -X POST http://127.0.0.1:17322/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"moss_keeper","nonce":"...","proof":"<64 hex>"}'
```

失败返回 `401 {"error":"invalid_credentials"}`；nonce 用过一次后立即失效。

### 注销 / 当前用户

```bash
curl -sS -X POST http://127.0.0.1:17322/v1/auth/logout -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:17322/v1/me -H "Authorization: Bearer $TOKEN"
```

## 云存档

```bash
curl -sS http://127.0.0.1:17322/v1/save -H "Authorization: Bearer $TOKEN"
# 200 {"revision":1,"payload":{...},"updated_at":1795683347}
# 404 还没有存档
```

```bash
curl -sS -X PUT http://127.0.0.1:17322/v1/save \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"base_revision":1,"payload":{"version":6,"stamps":43},"client_ts":1}'
```

- `200 {"revision":2}`：成功
- `409 {"error":"conflict","revision":3}`：`base_revision` 不是当前版本；客户端拉取最新后由玩家决定合并/覆盖
- 首次上传用 `base_revision: 0`
- 存档上限 512 KB

## 事件

```bash
curl -sS -X POST http://127.0.0.1:17322/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"name":"run_start","data":{"stage":1}},{"name":"run_win"}]}'
```

每批 1–50 条；`name` 1–64 字节；单条 `data` 序列化后 ≤ 8 KB。

## 数据与备份

- 表：`users`、`sessions`、`login_challenges`、`saves`、`events`；SQLite WAL。
- v1 的匿名表重命名为 `*_v1_legacy`；v2 的 Argon2 密码表重命名为 `*_v2_legacy`，都不会被静默删除。
- `verifier` 是 256 位派生值；它等价于本站的登录密钥，数据库泄露仍会导致账号被冒用，请限制 DB 访问并备份加密。
- 备份：`sqlite3 data/moss.db ".backup 'backup.db'"`，或停服务后连同 `-wal/-shm` 一起复制。
- 事件表会持续增长；上线后按周归档或保留 90 天。

## 部署建议

1. `cargo build --release`，把二进制和 systemd unit 放到服务器。
2. 只监听 `127.0.0.1:17322`，由 Caddy/Nginx 终止 TLS 并反代。
3. 反向代理限制请求体大小、开启访问日志。
4. 不要在公网直接裸跑 HTTP：token 会明文经过网络。
5. CORS 目前允许任意来源（客户端可能来自静态托管或 `file://`）。上线后改成白名单。
6. 还没有内置限流；公开前在反代或应用层加 IP/用户维度限流。

示例 unit 见 [`systemd/moss-sync.service`](systemd/moss-sync.service)。
