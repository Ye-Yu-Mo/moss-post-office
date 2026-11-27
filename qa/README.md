# 房间交互 QA

`npm run qa` 会跑一遍房间式交互的端到端检查（桌面 + 390px 手机）。

## 前置

1. 本机装有 Google Chrome（脚本用 `channel: "chrome"`，不额外下载浏览器）。
2. 有一个可用的后端和静态服务。默认：

```bash
python3 serve.py 17331       # 同源代理 /api 到 127.0.0.1:17322
MOSS_BIND=127.0.0.1:17322 MOSS_DB=/tmp/moss-sync-test.db ./server/target/debug/moss-sync
```

3. 构建最新前端：`npm run build`。

## 运行

```bash
npm run qa
# 或指到线上（会在目标库创建测试账号）
MOSS_QA_BASE=http://47.92.150.181:17321 npm run qa
```

脚本会注册一个随机测试账号（`qa_<时间戳>`），验证后会留在后端。

## 覆盖

- 默认房间是邮局；底部/侧边导航四项；切换房间时 URL hash 同步
- 邮局：盖戳、邮差/信件/工坊/邮册/月亮五个抽屉
- 镇口：未登录态 → 注册 → 镇口数据、后院、好友码
- 后院、明信片书写是镇口房间内的子视图，不再是弹窗
- 邮路：发车、远行准备、进入远行、收起回邮路
- 守夜：面板 → 战斗 → 回面板，全程无弹窗
- 深链接 `#/town`、浏览器后退
- 390px：底部导航固定、无横向溢出
- 全程收集 console / pageerror
