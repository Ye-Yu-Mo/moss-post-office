# moss-sync

苔藓邮局的薄同步服务：注册登录、云存档、事件上报。它**不参与游戏模拟**，也不认识卡牌、关卡或经济系统。

技术栈：Rust 2021 · axum 0.8 · rusqlite（bundled SQLite）· tokio · Argon2。

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
    mod.rs         token、SHA-256、用户名归一化
    password.rs    Argon2 哈希/校验
  db/
    mod.rs         Db 封装（每次请求一个连接，WAL）
    schema.rs      建表、v1 匿名表迁移
    users.rs       用户
    sessions.rs    会话
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

## 认证

- 用户名 3–24 字符，大小写不敏感唯一；密码至少 8 位。
- 密码用 Argon2id 哈希；会话 token 32 字节随机数，服务端只存 SHA-256。
- 会话有效期 30 天；注销删除当前会话。
- 除注册/登录/健康检查外，所有请求需要：

```
Authorization: Bearer <token>
```

### 注册（可带本地存档）

```bash
curl -sS -X POST http://127.0.0.1:17322/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"moss_keeper","password":"moss-post-123","save":{"version":6,"stamps":42}}'
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
curl -sS -X POST http://127.0.0.1:17322/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"moss_keeper","password":"moss-post-123"}'
```

失败返回 `401 {"error":"invalid_credentials"}`。

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

- 表：`users`、`sessions`、`saves`、`events`；SQLite WAL。
- v1 的匿名 `players/saves/events` 表会重命名为 `*_v1_legacy`，不会被静默删除。
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
