# moss-sync

苔藓邮局的薄同步服务：注册登录、云存档、事件上报。它**不参与游戏模拟**，也不认识卡牌、关卡或经济系统。

技术栈：Rust 2021 · axum 0.8 · sqlx + PostgreSQL 16 · tokio · HMAC-SHA256。

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
    social.rs      镇口、明信片、NPC 回信
    friends.rs     好友码、申请、好友列表、串门
    garden.rs      后院菜地、收菜、偷菜
    health.rs
  auth/
    mod.rs         token、SHA-256、HMAC 校验、用户名归一化
  db/
    mod.rs         Db 连接池 + 启动迁移 + NPC 种子
  migrations/      PostgreSQL 迁移（编译期内嵌）
    users.rs       用户 + verifier
    sessions.rs    会话
    challenges.rs  一次性登录 nonce
    social.rs      排行榜、明信片、NPC 种子
    friends.rs     好友关系与申请
    garden.rs      菜地计时、收菜、偷菜
    collectibles.rs 限量编号收藏品
    saves.rs       存档 + revision
    events.rs      批量写入
```

实时游戏循环、房间和帧同步**不在这个服务里**。如果以后要做联机，另起一个 colyseus-rs 或 WebSocket 服务，只复用这里的身份校验，见仓库根目录的 `docs/architecture.md`。

## 运行

```bash
createdb moss_dev
createdb moss_test
MOSS_TEST_DATABASE_URL=postgres://localhost/moss_test cargo test
MOSS_BIND=127.0.0.1:17322 \
MOSS_DATABASE_URL=postgres://localhost/moss_dev \
RUST_LOG=moss_sync=info,tower_http=warn \
cargo run
```

环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `MOSS_BIND` | `127.0.0.1:17322` | 监听地址；对外请走反向代理 |
| `MOSS_DATABASE_URL` | `postgres://127.0.0.1:5432/moss` | PostgreSQL 连接串；生产用独立容器 |
| `RUST_LOG` | `moss_sync=info,tower_http=warn` | 日志过滤 |

## 认证（HTTP 下的挑战应答）

为了不在明文 HTTP 上传密码，登录改成：

1. 浏览器用 PBKDF2-SHA256（100k 轮）从 `密码 + 用户名` 派生 32 字节 `verifier`，**密码本身不离开浏览器**。
2. 注册只发送 `verifier`（64 位 hex）；服务端原样保存，用于后续校验。
3. 登录先取一次性 `nonce`（120 秒有效、单次使用），浏览器发送 `HMAC-SHA256(verifier, nonce)` 作为 `proof`。
4. 服务端用保存的 `verifier` 重算并做常量时间比较；成功后发 30 天会话 token。

- 用户名 3–24 字符，注册前做 NFKC 归一化并拒绝控制/零宽/双向格式字符；大小写不敏感唯一。
- 好友码大小写不敏感唯一与查找（`upper(friend_code)` 唯一索引）；存量小写码也能被找到。
- PostgreSQL 拒收的 NUL 等非法编码统一映射为 400，不返回 500。
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

## 镇口与明信片

- `GET /v1/square` 返回按邮票排序的真人玩家和 8 位 NPC；NPC 带 `kind: "bot"` 和 `NPC` 标签，不伪装成真人。
- `GET /v1/postcards` 返回收到的明信片；第一次访问会自动收到一封 NPC 欢迎信。
- `POST /v1/postcards` 的正文只允许 4 个预设模板，没有自由文本，避免审核问题。
  - 寄给真人：对方收件箱出现一张明信片。
  - 寄给 NPC：NPC 立刻回一张，并附带 1–2 个墨点/材料。
- 每位玩家 24 小时内最多寄 5 张；`postcard_sends` 记录发送次数。
- `POST /v1/postcards/{id}/claim` 标记已领取并返回礼物。礼物由客户端写入本地存档（服务端不改存档），属于小额的客户端权威设计。
- 排行榜只公开用户名、邮票、远行胜场和最后活跃时间，不公开存档。

## 好友

- 注册时生成 6 位好友码（`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`），好友码是唯一、可分享的；不公开在排行榜里。
- 申请 → 接受后写入双向 `friendships`；双方互相可见。
- 如果两个人互相发了申请，第二次申请会自动成为好友，不需要再接受。
- 好友档案只对好友开放：用户名、好友码、邮票、远行胜场、最后活跃、收到的明信片数；非好友返回 404。
- 删除好友会同时删除双向关系；不删除任何存档或明信片。
- 好友明信片复用现有 `/v1/postcards`，每天 5 张上限、预设模板、真人之间不带资源礼物。
- 串门：每位好友每天一次，写入 `friend_visits`，只计数，不掉资源。
- NPC 每日来信：每个账号每天最多一封，按 UTC 日期选择 NPC 和模板。

## 后院与偷菜

- 每位用户 3 块地，6 种作物：
  - 信封草 45 分钟（纸×3）、邮票花 60 分钟（邮票×750）、墨莓 75 分钟（墨点×3）
  - 星屑花 90 分钟（邮票×1,500，累计收 3 次解锁）
  - 彩纸藤 80 分钟（纸×5，累计收 6 次解锁）
  - 月光菇 120 分钟（墨点×6，累计收 9 次解锁）
- 收完变成空地，需要重新选种；每种作物每轮可以浇一次水，成熟时间 -25%；累计收菜次数记录在 `users.garden_harvests`。
- 收菜：信封草给纸、邮票花给邮票、墨莓给墨点；被偷过的地会少一份（最低 1 份）。
- 偷菜：仅好友或 NPC；每块地每天一次，单块最多被偷 2 份；NPC 被偷满 2 份后重新生长。
- 帮浇水：仅好友或 NPC；每块地每天一次，效果和主人浇水一样，并给对方留一张 `water_note`。
- 扩地：累计收菜 20 次解锁第 4 块地，45 次解锁第 5 块地；新地块为空地。
- 图鉴/来访：`garden_crop_stats` 记录每种作物收成/被偷次数，`garden_actions` 记录最近偷菜/浇水，自己的后院接口返回 `crop_stats` 与 `visitors`。
- 今日订单：`garden_quests` 按用户 + UTC 日期生成 1 份作物订单，收够 1 份后可交，奖励墨点/邮票/纸；自己的后院接口返回 `quest`。
- 偷好友的菜会给对方留一张预设纸条（`steal_note`），不进每天 5 张寄信额度。
- 首次创建菜地时三块地都是熟的，方便马上体验。
- 奖励由客户端领取后写入本地存档（和明信片礼物一致）。

## 收藏品

- `collectibles` 表记录 kind/template/edition/serial/image_key；每用户每模板只能有一枚。
- `users.night_best` 由存档上传时的 `nightWatch.best` 更新，`/v1/square` 返回给镇口排行。
- 明信片每日 5 张上限在 PostgreSQL 事务 + 用户级 advisory lock 里 count+insert+记录，并发请求也不会超发。
- 明信片单版 200 枚，套装徽章 50 枚；serial 由服务端单调分配，超发拒绝。
- 守夜纪念戳：`POST /v1/nightwatch/claim { level }`，只接受 5 / 10 / 15 / 20 / 25 / 30；服务端要求 `users.night_best >= level`（由最近一次存档上传写入），否则 400；对应 `nightwatch` 模板 `night_5` / `night_10` / `night_15` / `deep_20` / `deep_25` / `deep_30`，edition 100 / 50 / 25 / 50 / 30 / 15，每用户每模板只能领一次，重复请求返回 `collectible: null`。
- 目前美术使用现有 AI 图标作为占位；完整 AI 插画待图片接口配额恢复后替换。

## 数据与备份

- 表：`users`、`sessions`、`login_challenges`、`saves`、`events`、`bots`、`postcards`、`postcard_sends`、`friend_requests`、`friendships`、`friend_visits`、`collectibles`、`garden_plots`、`garden_steals`、`garden_helps`、`garden_crop_stats`、`garden_actions`、`garden_quests`；PostgreSQL 16。
- 迁移在 `server/migrations/`，用 sqlx 在启动时执行并记录版本；SQLite 时代的历史版本由一次性导入工具处理。
- 历史 SQLite 数据导入：`MOSS_SQLITE_PATH=/path/moss.db MOSS_DATABASE_URL=postgres://... cargo run --bin migrate_sqlite`。清空、导入、序列重置在**同一个事务**里；源库缺表或外键错误时目标库保持原数据。
- `verifier` 是 256 位派生值；它等价于本站的登录密钥，数据库泄露仍会导致账号被冒用，请限制 DB 访问并备份加密。
- 备份：`scripts/backup_postgres.sh` 每天 03:30（`moss-backup.timer`）用 `pg_dump -Fc` 备份到 `/home/jas/games/moss-backups`，保留最近 14 份；写入前用 `pg_restore --list` 校验，文件 600。
- 监控：`scripts/monitor.sh` 每 5 分钟（`moss-monitor.timer`）检查 Postgres 容器/查询、moss-sync、静态服务、首页与 `/api/healthz`、磁盘；结果写 `/home/jas/games/moss-status/status.json` 和 `monitor.log`，失败时 unit 置为 failed。
- 监控也检查最新 dump 的新鲜度（默认 26 小时内）与 `moss-backup.timer` 是否 active；备份静默失败会让 unit 置为 failed。
- 目前没有外部告警通道：可以把 `status.json` 接到 Beszel/健康检查服务，或在反代层加告警。

### 恢复备份

```bash
# 恢复到临时库做演练（不碰生产）
docker exec moss-postgres createdb -U moss moss_restore
docker exec -i moss-postgres pg_restore -U moss --no-owner --no-privileges \
  -d moss_restore < /home/jas/games/moss-backups/<dump>
docker exec moss-postgres psql -U moss -d moss_restore -Atc \
  "select count(*) from users; select count(*) from saves;"
docker exec moss-postgres dropdb -U moss moss_restore
```

生产恢复是破坏性操作：先 `systemctl --user stop moss-sync`，确认没有连接后重建 `moss` 库再 restore，最后启动服务并跑一次 `monitor.sh`。
- 事件表会持续增长；上线后按周归档或保留 90 天。

## 当前线上部署（HTTP）

- 主机 `/home/jas/games/moss-sync`，release 二进制 `./moss-sync`，systemd user unit `moss-sync.service`（`enable --now`，linger 已开）。
- 只监听 `127.0.0.1:17322`；`serve.py` 在 17321 上把 `/api/*` 反代过来，因此页面和 API 同源，不需要新开公网端口。
- 数据库：独立 Docker 容器 `moss-postgres`（PostgreSQL 16），只监听 `127.0.0.1:5433`，数据在 `/home/jas/games/moss-postgres/data`；连接串在 `/home/jas/games/moss-sync/database.env`（600）。
- 重新部署：上传源码 → `cargo build --release --locked --bin moss-sync --bin migrate_sqlite` → 备份旧二进制 → `cp target/release/moss-sync ./moss-sync` → `systemctl --user restart moss-sync`。
- HTTP 下按上面的挑战应答运行；真正消除风险仍需 TLS。

### 重置密码

```bash
cd /home/jas/games/moss-sync
python3 scripts/reset_password.py --docker-container moss-postgres \
  --db-user moss --db-name moss --username BDD
```

脚本用 psql 变量传参，替换 verifier 并吊销该用户的全部会话；不会打印密码或 verifier。自动化可用 `--password-stdin`。本地 PG 可用 `--database-url postgres://localhost/moss`。

## 回滚到 SQLite（保留路径）

迁移时保留了时间戳备份：`moss-sync.sqlite-backup-*` 与 `data/moss.db.sqlite-backup-*`。

```bash
systemctl --user stop moss-sync
rm -f ~/.config/systemd/user/moss-sync.service.d/postgres.conf
cp moss-sync moss-sync.pg-backup-$(date +%Y%m%d-%H%M%S)
cp moss-sync.sqlite-backup-<stamp> moss-sync
cp data/moss.db.sqlite-backup-<stamp> data/moss.db
systemctl --user daemon-reload
systemctl --user start moss-sync
```

回滚后 PostgreSQL 里的新数据不会自动回写 SQLite，只用于紧急恢复。要回到 PG：恢复 `moss-sync.pg-backup-*` 与 `postgres.conf` drop-in，daemon-reload 后启动；PG 数据仍在容器 volume 里。
</br>

## 部署建议

1. `cargo build --release`，把二进制和 systemd unit 放到服务器。
2. 只监听 `127.0.0.1:17322`，由 Caddy/Nginx 终止 TLS 并反代。
3. 反向代理限制请求体大小、开启访问日志。
4. 不要在公网直接裸跑 HTTP：token 会明文经过网络。
5. CORS 目前允许任意来源（客户端可能来自静态托管或 `file://`）。上线后改成白名单。
6. 还没有内置限流；公开前在反代或应用层加 IP/用户维度限流。

示例 unit 见 [`systemd/moss-sync.service`](systemd/moss-sync.service)。
