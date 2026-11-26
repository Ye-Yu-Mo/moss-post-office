# 苔藓邮局 · Moss Post Office

一个纯前端的放置 + 卡牌 roguelike 小游戏：白天在邮局盖戳、送信、经营邮路，夜里带一副邮差牌穿过雾湖。

- 游戏本体：`index.html` + `game.js` + `assets/`
- 同步服务：`server/`（Rust + axum + SQLite）
- 部署：静态文件可放任意静态托管；同步服务是可选层，关掉也能单机离线玩

## 本地运行游戏

```bash
python3 serve.py 17321
# 打开 http://127.0.0.1:17321/
```

`serve.py` 只是带白名单和 CSP 的静态文件服务器。也可以直接双击 `index.html`（`file://`）离线玩。

生成单文件版本（内联脚本和图片，约 1.7 MB）：

```bash
python3 build_standalone.py
# moss-post-office.html
```

## 同步服务

```bash
cd server
cargo test
MOSS_BIND=127.0.0.1:17322 MOSS_DB=data/moss.db cargo run
```

服务端只做四件事，不跑游戏逻辑：

| 接口 | 作用 |
| --- | --- |
| `POST /v1/players` | 创建匿名玩家，返回 `player_id`、`token`、`recovery_code` |
| `POST /v1/players/recover` | 用恢复码换新 token |
| `GET/PUT /v1/save` | 云存档，带 revision 冲突检测 |
| `POST /v1/events` | 批量上报平衡/留存事件 |

- 存档是**不透明 JSON**，服务端不认识卡牌、订单和月光树；规则永远只有前端一份。
- 游戏必须**离线优先**：网络失败不能影响单机游玩，同步只是可选的备份与多端续档。
- token 只存 SHA-256 哈希，明文只在创建/恢复时返回一次。

详见 [`server/README.md`](server/README.md)。

## 代码同步

仓库使用 GitHub 私有仓库；本地改动：

```bash
git add -A
git commit -m "describe the change"
git push
```

CI 会跑 `cargo test --locked`（见 `.github/workflows/server-ci.yml`）。

## 目录

```
index.html              游戏页面
game.js                 游戏逻辑（状态、UI、远行、月光树）
assets/                 图片、PixiJS
serve.py                本地静态服务器
build_standalone.py     单文件打包
server/                 Rust 同步服务
assets_gen/             美术生成清单与产物
```
