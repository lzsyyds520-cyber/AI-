# PredX UI QA

Playwright 自动化骨架，默认只跑游客态和安全链路。

## 目标

- 先覆盖 `News / Market / Events / Signal`
- 再覆盖 `event` 深页、`analysis` 深页和跨页承接
- 登录、钱包、交易只在受控条件下启用

## 安全约束

- 默认 `SAFE_MODE=true`
- 默认 `ALLOW_REAL_TRADE=false`
- 在未明确授权前，脚本只验证登录承接或交易前拦截，不会尝试真实下单

## 安装

```bash
npm install
npx playwright install
```

## 执行

```bash
cp .env.example .env
npm run test:smoke
npm run test:guest
npm run test:conditional
npm run test:daily
npm run run:daily
```

### 第二批条件式自动化

- `tests/market/market-conditional.spec.ts`
  - 覆盖 `TC-MKT-006~010`
  - 依赖 `MARKET_FILTER_AUTOMATION_READY=true`
  - 依赖 `MARKET_FILTER_FIXTURE`
  - 核心思路：前端点筛选 -> 捕获 `/api/v1/polymarket` 请求 -> 校验返回字段
- `tests/event-detail/event-detail-conditional.spec.ts`
  - 覆盖 `TC-EVTD-002~003`
  - 依赖 `EVENT_CHART_AUTOMATION_READY=true`
  - 默认读取 `fixtures/conditional/event-chart.example.json`
  - 核心思路：检查图表区域 -> 点击时间维度 -> 校验 `prices-history` 请求

## 目录

```text
support/   公共环境变量、路径和通用方法
tests/     按页面域与链路域拆分的测试脚本
codex-skills/predx-qa-agent/
           PredX 自动化测试 Agent skill 草案
```

## GitHub 同步注意

- `.auth/`、`node_modules/`、`test-results/`、`playwright-report/`、`artifacts/` 默认不提交
- 真实账号、验证码、钱包、浏览器 profile 只能放在本机环境变量或 `.auth/`
- 公开或私有仓库都不要提交 `.env`，只提交 `.env.example`

## 当前范围

- 已建游客态 smoke 与页面级 suite 骨架
- 未接测试账号
- 未接钱包
- 第二批条件式自动化核心高价值场景已可执行：
  - `TC-MKT-006~010` 已在用户本机真实图形终端整组通过，结果为 `5 passed`
  - `TC-EVTD-002~003` 已在条件开关启用后通过，结果为 `2 passed`
- 日常自动化基线可通过 `npm run test:daily` 执行，覆盖游客态回归和第二批已落地条件式自动化

## 下一步

1. 补充登录白名单环境或可信浏览器 session，单独推进 `auth-user`
2. 补 News 排序、慢网 / 断网、长驻留、多浏览器矩阵
3. 结合 `scripts/run-daily-regression.sh` 接入定时调度
