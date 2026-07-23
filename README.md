# PredX UI QA

PredX Pro 自动化测试项目，用 Playwright 对线上站点 `https://predx.pro` 做功能回归、条件式自动化、失败归因、测试报告生成和测试用例工作台展示。

这个仓库不是单纯的录屏点击脚本，而是一套面向日常回归的 QA 工程：

- 测试用例按 `TC-*` 编号管理
- Playwright 脚本按页面、链路、登录态、下单安全流拆分
- 日常回归可以一条命令运行
- 失败需要按产品 bug、脚本问题、数据漂移、环境问题、人工项分类
- 测试用例可通过左侧分类工作台查看
- `predx-qa-agent` skill 用来规范 AI 协助测试时的判断和工作流

## 项目阶段

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 阶段 1：测试用例设计 | 已完成 | 已从 PRD 和线上页面拆出用例池，覆盖 News、Market、Events、Signal、Event 深页、Analysis 深页、登录、下单、跨页链路和鲁棒性 |
| 阶段 2：非登录态自动化 | 已完成主体 | 游客态页面、搜索、筛选、卡片承接、返回路径、异常恢复等已进入 Playwright |
| 阶段 3：条件式自动化 | 已完成核心部分 | Market 筛选、Event 图表、搜索返回、慢网、接口异常、订单安全前置等已落地；真实邮箱、钱包、真实交易仍保留条件式或人工口径 |
| 阶段 4：测试 Agent 规则 | 已完成 V1 | 已生成 `predx-qa-agent` skill，规范执行顺序、失败归因、覆盖率口径、报告口径和安全边界 |
| 阶段 5：测试工作台 UI | 已完成 V1 | 已生成 `workbench/test-cases.html`，左侧按模块、状态、F01-F10 流程层级分类，右侧展示用例列表和详情 |
| 阶段 6：自动执行平台 | 未完成 | 当前工作台是静态页面，还没有在 UI 内直接触发 Playwright、保存历史趋势或管理后端任务 |

## 当前测试用例覆盖

当前口径来自 `PredX_Pro_测试用例_V2_已覆盖版_2026-07-20.md`。

| 指标 | 数量 |
| --- | ---: |
| 原始用例池 | 237 |
| 已剔除未覆盖条件式自动化 | 11 |
| 当前工作台用例总数 | 226 |
| 已覆盖且当前无未关闭阻断 | 210 |
| 最近日常失败待复核 | 15 |
| 已知未通过 | 1 |

模块分布：

| 模块 | 用例数 |
| --- | ---: |
| 公共导航 | 16 |
| News | 25 |
| Market | 23 |
| Events | 18 |
| Event 深页 | 36 |
| Analysis 深页 | 17 |
| Signal | 27 |
| 登录登出 | 14 |
| 下单链路 | 11 |
| 跨页链路 | 24 |
| 鲁棒性 | 15 |

说明：

- `已覆盖` 不等于“永久无风险”，只表示当前用例已经有自动化、专项验证或明确人工口径，且没有未关闭阻断。
- `待复核` 多数来自最新日常回归中的线上数据变化、样本页结构变化或断言口径待调整。
- `未通过` 当前主要指明确保留的已知缺陷，例如键盘可访问性问题。
- 被剔除的 11 条条件式自动化不代表不重要，只是当前缺少稳定登录态、验证码服务、沙盒交易、mock 订单接口或可控行情条件。

## 测试范围

已覆盖的产品范围：

- News 页面：列表、详情、来源展示、关联市场/事件、搜索、慢网、断网、返回路径
- Market 页面：分类、筛选、搜索、卡片字段、API 条件式筛选、刷新和快速切换
- Events 页面：All/Hot、事件卡片、More News、Deep Analysis、分享、关联市场
- Signal 页面：信号卡片、AI 分析展开、Buy/No 承接、关联市场、慢接口和失败恢复
- Event 深页：图表、Evidence、Recent、Positions、Open Orders、History、订单簿、交易栏前置交互
- Analysis 深页：核心模块、右侧栏、关联市场、关联新闻、刷新、异常 URL
- 公共导航：顶部导航、Logo、主题、语言、搜索历史、权限入口
- 登录登出：游客态登录承接、Email 输入、OAuth/Wallet 入口展示、登录态保持和登出专项
- 下单链路：默认只验证到交易栏、输入校验、订单确认/预览、取消、失败恢复，不做无授权真实下单
- 鲁棒性：慢网、接口 500、空列表、长驻留、快速切换、键盘可访问性、Chrome/WebKit

暂不作为日常无监督自动化的范围：

- 真实生产下单
- 钱包签名授权
- Google OAuth 无监督登录
- 真实邮箱验证码全自动读取
- 真实资金划转或订单撮合成功

## 测试流程框架

项目按 F01-F10 检查框架组织测试，避免只测“页面能打开”：

| 层级 | 检查对象 | 覆盖重点 |
| --- | --- | --- |
| F01 | 入口与导航 | URL、顶部导航、Logo、页面标题、错误 URL |
| F02 | 首屏结构 | 核心模块、卡片、列表、Tab、默认状态 |
| F03 | 数据字段 | 标题、来源、时间、价格、概率、成交量、流动性、订单簿 |
| F04 | 搜索与筛选 | 顶部搜索、搜索历史、空态、筛选项、组合条件、URL/query |
| F05 | 卡片承接 | News/Event/Signal 小卡片、Related Market、Deep Analysis、Buy 入口 |
| F06 | 页面内交互 | Tab、展开收起、More News、Reload、Share、Alert、刷新恢复 |
| F07 | 交易前承接 | Buy/Sell、Outcome、Amount/Shares、Limit Price、Order Book、Recent/Positions/Open Orders/History |
| F08 | 登录与权限 | 登录弹层、Email/OAuth/Wallet、登出、登录态保持、游客态拦截 |
| F09 | 返回与路由 | 浏览器 back/forward、详情返回列表、搜索返回、状态保持 |
| F10 | 异常与鲁棒性 | 慢网、断网、接口 500、空数组、快速点击、键盘可访问性、跨浏览器 |

## 目录结构

```text
.
├── tests/                         Playwright 测试脚本
│   ├── smoke/                     公共导航和冒烟
│   ├── news/                      News 页面
│   ├── market/                    Market 页面和条件式筛选
│   ├── events/                    Events 页面
│   ├── event-detail/              Event 深页和图表条件式
│   ├── analysis/                  Analysis 深页
│   ├── signal/                    Signal 页面
│   ├── auth/                      登录、登出、登录态专项
│   ├── order/                     下单安全链路
│   ├── flows/                     跨页链路和返回路径
│   └── rob/                       鲁棒性和兼容性
├── support/                       公共环境、路径、登录、条件式辅助方法
├── fixtures/conditional/          Market/Event 条件式自动化样本
├── scripts/                       报告、工作台、诊断、日常执行脚本
├── workbench/test-cases.html      左侧分类测试用例工作台
├── codex-skills/predx-qa-agent/   PredX QA Agent skill 规则
└── playwright.config.ts           Playwright 配置
```

## 安装

```bash
npm install
npx playwright install
cp .env.example .env
```

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run test:smoke` | 跑公共导航和基础冒烟 |
| `npm run test:guest` | 跑非登录态主回归 |
| `npm run test:daily` | 跑 Chromium 日常回归，包含非登录态和核心条件式自动化 |
| `npm run run:daily` | 推荐日常入口，执行日常回归并生成相关产物 |
| `npm run test:conditional:market` | 跑 Market 筛选条件式自动化 |
| `npm run test:conditional:event` | 跑 Event 图表条件式自动化 |
| `npm run test:flow:search:headed` | 用真实 Chrome headed 方式复核顶部搜索链路 |
| `npm run test:conditional:auth-user` | 跑登录态安全专项，需要 `.auth/user.json` |
| `npm run test:conditional:order-user` | 跑下单安全专项，需要登录态且不做真实提交 |
| `npm run workbench` | 重新生成左侧分类测试用例工作台 |
| `npm run report` | 打开 Playwright HTML report |

推荐日常流程：

```bash
cd "/Users/frankzhang/Documents/New project/predx-ui-qa"
npm run run:daily
npm run workbench
```

然后打开：

```text
workbench/test-cases.html
```

## 测试工作台

`workbench/test-cases.html` 是当前的静态测试用例工作台。

已支持：

- 左侧功能栏：`TC / RUN / BUG / REP / KB`
- 用例库分类：公共导航、News、Market、Events、Event 深页、Analysis、Signal、登录登出、下单链路、跨页链路、鲁棒性
- 执行状态分类：已覆盖、待复核、已知未通过、条件待执行
- F01-F10 测试流程层级分类
- 全局搜索和优先级筛选
- 主列表展示关键字段
- 点击用例查看完整步骤、预期结果、命令、脚本映射和备注

当前限制：

- 工作台是静态 HTML，不会直接启动 Playwright。
- `RUN / BUG / REP / KB` 目前是信息架构入口，还未接后端执行记录。
- 测试结果仍由 Playwright、Markdown 报告和生成脚本更新后再刷新工作台。

## PredX QA Agent

Agent 文件位于：

```text
codex-skills/predx-qa-agent/
```

它的作用不是替代测试脚本，而是规范 AI 协助测试时的判断：

- 先对齐用例编号，再补脚本
- 失败先看证据，再分类
- 区分产品 bug、脚本问题、数据漂移、环境问题和人工项
- 区分用例总数、脚本覆盖数、日常执行数、通过数
- 登录、钱包、真实下单必须遵守安全边界
- 生成报告前必须有执行证据

AI 协作示例：

```text
Use $predx-qa-agent to run the PredX daily regression, triage failures, and update the QA report.
```

```text
Use $predx-qa-agent to add coverage for TC-NEWS-016 and update the workbench.
```

## 失败归因规则

失败不能直接判为产品 bug，必须先分类：

| 类型 | 判断标准 |
| --- | --- |
| 产品 bug | headed 或人工路径复现，或 Playwright 证据明确显示确定性产品错误 |
| 脚本问题 | 选择器过窄、等待不足、headless 差异、断言过死 |
| 数据漂移 | 线上标题、价格、关联内容、样本页结构变化导致断言失效 |
| 环境问题 | 登录态、钱包、验证码、浏览器 profile、网络或权限缺失 |
| 人工项 | 涉及钱包签名、真实下单、第三方 OAuth 或不可逆操作 |

## 安全边界

- 默认 `SAFE_MODE=true`
- 默认 `ALLOW_REAL_TRADE=false`
- `.auth/`、`.env`、`test-results/`、`playwright-report/`、`artifacts/`、`node_modules/` 不提交
- 真实账号、验证码、钱包、浏览器 profile 只能保存在本机环境变量或 `.auth/`
- 未明确授权时，脚本只验证登录承接、交易栏前置、订单预览、取消和错误恢复，不做真实成交

## 当前主要风险

- Analysis 相关用例有 15 条最近回归待复核，主要集中在样本页结构、Related News、右侧栏和语义一致性。
- Event 深页个别报价、Max、Evidence Reload 断言需要更动态的判断策略。
- 登录态和交易页认证存在条件差异，普通登录 shell 不一定等于交易页可下单 session。
- UI 工作台仍是静态页面，还未接入自动执行历史和趋势看板。

## 下一步

1. 把测试用例源从 Markdown 升级成结构化数据，例如 `test-cases.json`。
2. 让工作台读取执行结果，展示最近一次运行的通过、失败、跳过和证据路径。
3. 补齐 `RUN / BUG / REP / KB` 四个面板。
4. 优化 Analysis 与 Event 深页的动态数据断言，降低误判。
5. 为登录态和下单安全链路建立稳定测试 session 或测试环境支持。
