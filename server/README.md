# moss-sync

苔藓邮局的薄同步服务：匿名账号、云存档、恢复码、事件上报。它**不参与游戏模拟**，也不认识卡牌、关卡或经济系统。

技术栈：Rust 2021 · axum 0.8 · rusqlite（bundled SQLite）· tokio。

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

## API

所有请求/响应均为 JSON。除创建和恢复外，都需要：

```
Authorization: Bearer <token>
```

### 创建玩家

```bash
curl -sS -X POST http://127.0.0.1:17322/v1/players
```

```json
{
  "player_id": "ca85128ed784ef12259a385f00c04dbf",
  "token": "SjJYrALJHwld-iq3TgffD25XBDplSm6VJ-PYlJIsSWc",
  "recovery_code": "MPBR-P5YA-HQ7W-ED3K"
}
```

`token` 和 `recovery_code` 只在这里返回一次明文；服务端存的是 SHA-256 哈希。

### 恢复 token

```bash
curl -sS -X POST http://127.0.0.1:17322/v1/players/recover \
  -H 'Content-Type: application/json' \
  -d '{"player_id":"...","recovery_code":"MPBR-P5YA-HQ7W-ED3K"}'
```

成功后旧 token 立即失效，返回 `{"player_id":"...","token":"..."}`。

### 读取存档

```bash
curl -sS http://127.0.0.1:17322/v1/save -H "Authorization: Bearer $TOKEN"
```

- `200`：`{"revision":1,"payload":{...},"updated_at":1795683347}`
- `404`：还没有存档

### 写入存档

```bash
curl -sS -X PUT http://127.0.0.1:17322/v1/save \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"base_revision":0,"payload":{"version":6,"stamps":42},"client_ts":1}'
```

- `200`：`{"revision":1}`
- `409`：`{"error":"conflict","message":"save revision mismatch","revision":3}`

冲突处理由客户端决定：拉取最新 revision，合并或让玩家选择覆盖；服务端不会静默覆盖。首次上传用 `base_revision: 0`。

### 上报事件

```bash
curl -sS -X POST http://127.0.0.1:17322/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"name":"run_start","data":{"stage":1}},{"name":"run_win"}]}'
```

- 每批 1–50 条；`name` 1–64 字节；单条 `data` 序列化后 ≤ 8 KB。
- 响应：`{"accepted":2}`

### 健康检查

```bash
curl -sS http://127.0.0.1:17322/healthz
# {"ok":true,"version":"0.1.0"}
```

## 数据与备份

- 表：`players`、`saves`、`events`；SQLite WAL 模式。
- 备份：`sqlite3 data/moss.db ".backup 'backup.db'"`，或停服务后连同 `-wal/-shm` 一起复制。
- 事件表会持续增长；上线后按周归档或清理（例如保留 90 天）。

## 部署建议

1. `cargo build --release`，把 `target/release/moss-sync` 和 systemd unit 一起放到服务器。
2. 服务只监听 `127.0.0.1:17322`，由 Caddy/Nginx 终止 TLS 并反代。
3. 反向代理追加安全头，限制请求体大小，开启访问日志。
4. 不要直接把端口暴露在公网 HTTP 上：token 会明文经过网络。

示例 unit 见 [`systemd/moss-sync.service`](systemd/moss-sync.service)。

## 已知边界

- CORS 目前允许任意来源（客户端可能来自静态托管或 `file://`）。如果要收紧，改成环境变量白名单。
- 没有内置限流；公开前应在反代或应用层加 IP/玩家维度限流。
- 排行榜/每日挑战还没做：每日种子可以纯前端生成；好友榜需要再加一张表。
- 单机玩法永远不依赖本服务；服务挂了，游戏应继续可玩，只是暂不云同步。
