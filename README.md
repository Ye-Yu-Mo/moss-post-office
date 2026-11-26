# 苔藓邮局 · Moss Post Office

一个 2D 的放置 + 卡牌 roguelike 小游戏：白天在邮局盖戳、送信、经营邮路，夜里带一副邮差牌穿过雾湖。

- 前端：Vite + 原生 DOM/CSS + PixiJS 环境粒子（`web/`）
- 后端：Rust + axum + SQLite，只做账号、云存档和事件（`server/`）
- 玩法离线优先：断网也能玩，登录后可选云同步
- 架构边界见 [`docs/architecture.md`](docs/architecture.md)

## 前端

```bash
nvm use                 # .nvmrc = 24
npm install
npm run dev             # http://127.0.0.1:5173/
```

生产构建与本地预览：

```bash
npm run build           # 输出 dist/
python3 serve.py 17321  # 只服务 dist/，带 CSP 和 ETag
```

单文件离线版（内联脚本、样式和图片）：

```bash
npm run standalone      # 生成 moss-post-office.html
```

## 后端

```bash
cd server
cargo test
MOSS_BIND=127.0.0.1:17322 MOSS_DB=data/moss.db cargo run
```

| 接口 | 作用 |
| --- | --- |
| `POST /v1/auth/register` | 注册；可带 `save`，首次注册原子写入 revision 1 |
| `POST /v1/auth/login` | 登录，返回 30 天会话 token |
| `POST /v1/auth/logout` | 注销当前会话 |
| `GET /v1/me` | 当前用户和存档 revision |
| `GET/PUT /v1/save` | 云存档，`base_revision` 冲突检测 |
| `POST /v1/events` | 批量事件上报（平衡/留存） |

服务端不跑游戏循环，也不认识卡牌/订单/月光树。实时房间如果以后要做，另起服务，见架构文档。

详见 [`server/README.md`](server/README.md)。

## 目录

```
web/                    Vite 前端
  index.html
  src/main.js           游戏逻辑与 UI
  src/cloud.js          账号/云存档网络层
  src/styles.css
  public/assets/        图片、PixiJS
server/                 Rust 同步服务
  src/api/              路由处理器
  src/auth/             token、Argon2
  src/db/               schema 与查询
  src/config.rs
docs/architecture.md    分层与边界
dist/                   构建产物（git 忽略）
assets_gen/             美术生成清单与产物
serve.py                生产静态服务器
build_standalone.py     单文件打包
```

## 代码同步

GitHub 私有仓库：<https://github.com/Ye-Yu-Mo/moss-post-office>。

```bash
git add -A
git commit -m "describe the change"
git push
```

CI：Rust 测试（`.github/workflows/server-ci.yml`）和前端构建（`.github/workflows/web-ci.yml`）。
