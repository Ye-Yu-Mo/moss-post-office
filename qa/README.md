# 房间交互 QA

`npm run qa` 会跑一遍房间式交互的端到端检查（桌面 + 390px 手机，58 项）。
`npm run qa:recovery` 单独验证「本地存档损坏时从云端恢复，且不覆盖云端备份」。
`npm run qa:multitab` 验证同浏览器多标签页的存档同步：新存档会被采纳，被节流的旧标签页不会覆盖新进度，空闲时不会反复重写同一份存档。
`npm run qa:a11y` 在 320px / 390px 下检查帮助弹窗关闭按钮、守夜结算卡不被裁切、结算对话框焦点、守夜标签的键盘方向键。

## 前置

1. 本机装有 Google Chrome（脚本用 `channel: "chrome"`，不额外下载浏览器）。
2. 有一个可用的后端和静态服务。默认：

```bash
python3 serve.py 17331       # 同源代理 /api 到 127.0.0.1:17322
createdb moss_test 2>/dev/null || true
MOSS_BIND=127.0.0.1:17322 MOSS_DATABASE_URL=postgres://localhost/moss_test ./server/target/debug/moss-sync
```

3. 构建最新前端：`npm run build`。

## 运行

```bash
npm run qa
```

完整套件依赖本地 QA 钩子；非 `127.0.0.1/localhost` 构建不暴露 `__moss`，脚本会直接退出。线上只做普通用户流程冒烟，不跑本套件。

脚本会注册一个随机测试账号（`qa_<时间戳>`），验证后会留在后端。

## 覆盖

- 默认房间是邮局；底部/侧边导航四项；切换房间时 URL hash 同步
- 邮局：盖戳、邮差/信件/工坊/邮册/月亮五个抽屉
- 镇口：未登录态 → 注册 → 镇口数据、后院、好友码
- 后院、好友档案、明信片书写是镇口房间内的子视图，不再是弹窗
- 两个账号互加好友、接受申请、进入串门档案
- 邮路：发车、远行准备、进入远行、收起回邮路
- 守夜：面板 → 战斗 → 回面板，全程无弹窗
- 守夜的雾障格、波次预览、铲子回收、真实 tick 推进
- 邮路倒计时递增、信件换批双击只扣一次
- 明信片发送后回到镇口、新账号不继承上一账号存档
- 深链接 `#/town`、浏览器后退
- 房间淡入过渡存在
- 390px：底部导航固定、无横向溢出
- 多标签页：storage 事件采纳、节流标签页写入前先读、空闲时不重复写同一份存档（`qa:multitab`）
- 小屏无障碍：弹窗关闭按钮、结算卡不裁切、焦点、标签键盘操作（`qa:a11y`）
- 全程收集 console / pageerror

## 压测（隔离 release 栈）

```bash
# 1) release 后端 + 独立数据库
createdb moss_stress_pg 2>/dev/null || true
MOSS_BIND=127.0.0.1:17342 MOSS_DATABASE_URL=postgres://localhost/moss_stress_pg ./server/target/release/moss-sync

# 2) 静态服务，代理到压测后端
MOSS_API_PORT=17342 python3 serve.py 17341

# 3) 运行
MOSS_STRESS_ROOT=http://127.0.0.1:17341 npm run qa:stress
```

覆盖：静态资源/ETag、200 注册、100 登录、800 广场、400 存档写、300 明信片并发（每日 5 张）、
60 次纪念戳重复领取、花园收菜/种菜并发、health；输出 p50/p95/p99、状态分布和唯一序号。
压测后建议检查 `collectibles` 的重复序号、各表计数和 PostgreSQL 日志。
