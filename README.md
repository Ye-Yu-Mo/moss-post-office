# 苔藓邮局 · Moss Post Office

一个 2D 的放置 + 卡牌 roguelike 小游戏：白天在邮局盖戳、送信、经营邮路，夜里带一副邮差牌穿过雾湖。

![苔藓邮局](docs/screenshot.webp)

- 前端：Vite + Vue 3（镇口 / 账号 / 订单 / 邮册 / 月亮 / 工坊 / 远行 / 选种 / 好友后院 / 行前准备 / 事件 / 串门 / 明信片 / 确认弹窗已迁移，盖戳台仍为原生）+ 原生 DOM/CSS + PixiJS 环境粒子（`web/`）
- 后端：Rust + axum + SQLite，只做账号、云存档和事件（`server/`）
- 线上 <http://47.92.150.181:17321/>：`serve.py` 同源反代 `/api` 到本机 17322
- 远行材料（纸 / 蜡 / 布）：路况掉落，行前准备消耗，换牌、护信或加固邮袋
- 材料工坊：用纸 / 蜡 / 布换永久远行强化
- 精英路线：第 3 / 5 段可能出现，胜利后从三张牌里挑一张
- 材料订单：部分柜台来信交付时消耗纸 / 蜡 / 布，部分完成后留下材料
- 镇口：查看邮差榜、互寄预设明信片；8 位 NPC 邮差会回信
- 好友：6 位好友码、申请/接受、好友列表、串门档案、好友明信片
- 明信片收藏：四套明信片（镇口 / 星港 / 雾湖 / 雨夜），服务端编号（#1/200），每套和全收集都有奖励
- 后院菜地：6 种作物（含稀有种子）、选种、浇水、收菜、扩地、每日柜台订单；作物图鉴 + 最近来访；好友可偷菜或帮浇水，都会留下纸条
- 社交日常：NPC 每日来信、好友串门留访客邮戳
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
| `POST /v1/auth/challenge` | 取一次性登录 nonce |
| `POST /v1/auth/login` | 挑战应答登录，返回 30 天会话 token |
| `POST /v1/auth/logout` | 注销当前会话 |
| `GET /v1/me` | 当前用户和存档 revision |
| `GET/PUT /v1/save` | 云存档，`base_revision` 冲突检测 |
| `POST /v1/events` | 批量事件上报（平衡/留存） |

服务端不跑游戏循环，也不认识卡牌/订单/月光树。线上由 `serve.py` 把 `/api/*` 反代到 `127.0.0.1:17322`，所以页面和接口同源，不需要新开公网端口。

当前只能走 HTTP，认证做了妥协：密码不离开浏览器，登录用一次性 nonce + HMAC 挑战应答；但 Bearer token 仍可能被窃听，主动中间人也能改页面。详见 `docs/architecture.md` 的威胁模型。

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
  src/auth/             token、HMAC、用户名归一化
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
