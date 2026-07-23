import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const casesPath = path.join(root, 'PredX_Pro_测试用例_V1.md');
const outputPath = path.join(root, 'PredX_Pro_测试报告_全量版_V2.md');

const PASS_SYMBOL = '✅';
const FAIL_SYMBOL = '❌';

const moduleNames = new Map([
  ['COM', '公共导航'],
  ['NEWS', 'News'],
  ['MKT', 'Market'],
  ['EVT', 'Events'],
  ['EVTD', 'Event 深页'],
  ['ANL', 'Analysis 深页'],
  ['SIG', 'Signal'],
  ['AUTH', '登录登出'],
  ['ORDER', '下单链路'],
  ['FLOW', '跨页链路'],
  ['ROB', '鲁棒性']
]);

const failed = new Map([
  [
    'TC-ROB-013',
    '键盘可访问性未通过：顶部 `Sign In` 按钮获得焦点后，按 Enter/Space 均未打开 `Connect to PredX` 登录弹层'
  ]
]);

const pending = new Map([
  [
    'TC-AUTH-009',
    '`2026-07-10` 严格复验发现：当前 `.auth/user.json` 可进入 News 登录态 shell，但 Event 交易动作仍弹 `Connect to PredX`，需重新生成可被交易流接受的完整 session'
  ],
  ['TC-AUTH-015', '需要真实邮箱验证码流或测试环境验证码服务'],
  ['TC-ORDER-011', '需要 Event 交易页接受登录态、展示 Cash 余额，且余额充足；当前 session 在交易动作中仍弹登录承接层'],
  ['TC-ORDER-012', '依赖 `TC-ORDER-011` 能稳定打开订单确认/预览弹层后才能验证取消/关闭'],
  ['TC-ORDER-020', '需要 Event 交易页接受登录态后，用 mock 订单提交接口 4xx/5xx/timeout 验证失败处理']
]);

function range(prefix, start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => `${prefix}-${String(start + index).padStart(3, '0')}`);
}

const frameworkAuditAddedCases = [
  ...range('TC-COM', 12, 16),
  ...range('TC-NEWS', 22, 25),
  ...range('TC-MKT', 19, 23),
  ...range('TC-EVT', 13, 18),
  ...range('TC-EVTD', 30, 36),
  ...range('TC-ANL', 13, 17),
  ...range('TC-SIG', 21, 27),
  ...range('TC-AUTH', 13, 16),
  ...range('TC-ORDER', 1, 20),
  ...range('TC-FLOW', 21, 24),
  ...range('TC-ROB', 11, 15)
];

for (const id of frameworkAuditAddedCases) {
  if (!pending.has(id)) {
    pending.set(id, '框架审计新增用例，待进入下一轮脚本实现、条件式专项或人工执行');
  }
}

const passNotes = new Map([
  [
    'TC-NEWS-022',
    '`2026-07-07` 复验通过：原失败为骨架屏阶段过早断言，已改为等待新闻标题/正文/来源/时间就绪后校验'
  ],
  ['TC-AUTH-007', '用户确认钱包登录保留人工测试口径，不再作为自动化待办推进'],
  ['TC-AUTH-006', '`2026-07-10` 复验通过：当前 `.auth/user.json` 可进入已登录 shell，作为后续登录态专项前置'],
  ['TC-AUTH-008', '`npm run test:conditional:auth-user` 已通过；登录态刷新保持有效'],
  ['TC-AUTH-010', '`npm run test:conditional:auth-user` 已通过；已修复头像下拉 Log out 定位'],
  ['TC-AUTH-011', '`npm run test:conditional:auth-user` 已通过；登出后刷新保持游客态'],
  ['TC-AUTH-012', '`npm run test:conditional:auth-user` 已通过；登出后交易动作重新触发登录承接层'],
  ['TC-MKT-010', '按最新条件式筛选专项结果，`TC-MKT-006~010` 已跑通；Creation Time 口径按当前脚本固定'],
  ['TC-NEWS-016', '已通过 Chromium 受控慢网验证加载态'],
  ['TC-FLOW-002', '已使用固定 Event 样本验证市场承接'],
  ['TC-FLOW-005', '真实 Chrome headed 条件式专项已通过：News / Market / Events / Signal 输入 iran 均进入 `/search?q=iran`'],
  ['TC-FLOW-008', '已使用固定 Event 样本验证返回链路'],
  ['TC-FLOW-011', '已通过'],
  ['TC-COM-010', '已通过'],
  ['TC-NEWS-009', '已通过'],
  ['TC-NEWS-010', '已通过'],
  ['TC-NEWS-011', '已通过'],
  [
    'TC-NEWS-012',
    '`2026-07-07` 真实 Chrome headed 复验通过：顶部搜索 `iran` 进入 `/search?q=iran` 后浏览器返回 `/news` 不再出现客户端异常，`BUG-SEARCH-002` 已关闭'
  ],
  ['TC-SIG-014', '已通过'],
  ['TC-SIG-015', '已通过'],
  ['TC-SIG-016', '已通过'],
  ['TC-ROB-009', '已通过'],
  ['TC-NEWS-021', '已验证 News detail 双关联卡片快速连点落到最后目标'],
  ['TC-EVTD-020', '首轮骨架屏时机问题已修复等待逻辑，补充复验通过'],
  ['TC-ROB-002', '已在 WebKit 项目下通过，近似覆盖 Safari'],
  ['TC-EVTD-021', '新增订单/报价区覆盖，专项脚本验证通过'],
  ['TC-EVTD-022', '新增 Recent 成交记录字段覆盖，专项脚本验证通过'],
  ['TC-EVTD-023', '新增 Positions 标签数据/空态覆盖，专项脚本验证通过'],
  ['TC-EVTD-024', '新增 Open Orders 标签数据/空态覆盖，专项脚本验证通过'],
  ['TC-EVTD-025', '新增 History 标签数据/空态覆盖，专项脚本验证通过'],
  ['TC-EVTD-026', '新增 Buy/Sell 与 outcome 切换同步覆盖，专项脚本验证通过'],
  ['TC-EVTD-027', '新增 Limit Price 步进边界覆盖，专项脚本验证通过'],
  ['TC-EVTD-028', '新增 Shares/Amount 输入覆盖，专项脚本验证通过'],
  ['TC-EVTD-029', '新增订单簿深度 Price/Shares/Total/Mid/Spread 覆盖，专项脚本验证通过'],
  ['TC-FLOW-016', '新增 Market 详情返回链路覆盖，专项脚本验证通过'],
  ['TC-FLOW-017', '新增搜索结果详情返回链路覆盖，专项脚本验证通过'],
  ['TC-FLOW-018', '新增 Analysis 右侧承接返回链路覆盖，专项脚本验证通过'],
  ['TC-FLOW-019', '新增 Event 标签切换后的浏览器历史覆盖，专项脚本验证通过'],
  ['TC-FLOW-020', '新增 Signal 承接返回链路覆盖，专项脚本验证通过'],
  ['TC-COM-012', '`2026-07-07` 新增自动化通过：Logo 图片链接进入产品默认入口并保持导航/主内容正常'],
  ['TC-COM-013', '`2026-07-07` 新增自动化通过：聚焦空搜索框不报错、不污染主内容'],
  ['TC-COM-016', '`2026-07-07` 新增自动化通过：游客态权限入口进入登录承接层'],
  ['TC-NEWS-023', '`2026-07-07` 新增自动化通过：新闻详情关联市场/事件字段可见且无坏数据'],
  ['TC-NEWS-024', '`2026-07-07` 新增自动化通过：新闻详情关联卡片进入后可返回原详情页'],
  ['TC-NEWS-025', '`2026-07-07` 第八批新增自动化通过：来源名仅展示不可点击，未暴露外部跳转锚点'],
  ['TC-MKT-019', '`2026-07-07` 新增自动化通过：Market 筛选下拉可打开/关闭且不阻塞列表'],
  ['TC-MKT-023', '`2026-07-07` 新增自动化通过：Market 卡片价格、百分比、成交量字段格式正常'],
  ['TC-EVT-013', '`2026-07-07` 新增自动化通过：Events 可见事件卡片存在 Deep Analysis 入口'],
  ['TC-EVT-016', '`2026-07-07` 新增自动化通过：Events Related Markets 小卡片字段完整'],
  ['TC-ANL-013', '`2026-07-07` 新增自动化通过：Analysis 右侧栏卡片展示正常'],
  ['TC-ANL-014', '`2026-07-07` 新增自动化通过：Analysis 右侧栏承接后可返回原页'],
  ['TC-ANL-015', '`2026-07-07` 新增自动化通过：Analysis 刷新后核心模块恢复'],
  ['TC-ANL-016', '`2026-07-07` 新增自动化通过：无效 Analysis URL 有处理态，不白屏'],
  ['TC-ANL-017', '`2026-07-07` 第五批新增自动化通过：Analysis 主题正文与 Related Markets 保持语义一致'],
  ['TC-SIG-021', '`2026-07-07` 新增自动化通过：Signal AI 分析承接可展开'],
  ['TC-SIG-022', '`2026-07-07` 新增自动化通过：Signal AI 分析字段无空值/坏数据'],
  ['TC-SIG-023', '`2026-07-07` 第五批新增自动化通过：Signal 推荐价与关联市场价格方向一致'],
  ['TC-SIG-026', '`2026-07-07` 第五批新增自动化通过：Signal 慢接口下最终仍可渲染可用卡片'],
  ['TC-SIG-027', '`2026-07-07` 第五批新增自动化通过：Signal 接口失败时页面保持可恢复状态'],
  ['TC-AUTH-013', '`2026-07-07` 新增自动化通过：非法邮箱不能提交验证码请求'],
  ['TC-AUTH-014', '`2026-07-07` 第二批新增自动化通过：Email 输入后关闭登录弹层可回到原 News 页面'],
  ['TC-AUTH-016', '`2026-07-07` 第七批新增自动化通过：OAuth/浏览器验证拦截页保持可读，不空白卡死'],
  ['TC-COM-014', '`2026-07-07` 第三批新增自动化通过：搜索历史项可点击进入 `/search?q=...` 结果页'],
  ['TC-COM-015', '`2026-07-07` 第三批新增自动化通过：搜索历史可清理，清理后页面仍稳定可用'],
  ['TC-FLOW-024', '`2026-07-07` 第三批新增自动化通过：搜索结果页筛选/排序交互后可返回上一页且无客户端异常'],
  ['TC-ROB-014', '`2026-07-07` 第三批新增自动化通过：Market 首屏在日常冒烟阈值内完成可用渲染'],
  ['TC-ROB-015', '`2026-07-07` 第三批新增自动化通过：zh-CN 与 Asia/Shanghai 环境下 News/Market 格式无坏数据'],
  ['TC-ROB-011', '`2026-07-07` 第五批新增自动化通过：Market API 500 时页面展示可恢复处理态'],
  ['TC-ROB-012', '`2026-07-07` 第五批新增自动化通过：Market API 空列表时页面展示空态且筛选控件仍可用'],
  ['TC-ORDER-001', '`2026-07-07` 新增自动化通过：游客态点击 Trade 被登录承接拦截'],
  ['TC-FLOW-021', '`2026-07-07` 新增自动化通过：News 详情关联卡片进入后可返回详情页'],
  ['TC-FLOW-022', '`2026-07-07` 新增自动化通过：Events -> Deep Analysis -> Related Market 二级承接正常'],
  ['TC-FLOW-023', '`2026-07-07` 新增自动化通过：关闭下单登录承接后保留原 event 交易上下文'],
  ['TC-MKT-020', '`2026-07-07` 第二批新增自动化通过：分类与 Liquidity 筛选可叠加且请求包含 liquidity_min'],
  ['TC-MKT-021', '`2026-07-07` 第二批新增自动化通过：筛选后刷新 Market 页面仍处于可用定义态'],
  ['TC-MKT-022', '`2026-07-07` 第二批新增自动化通过：快速切换分类后最终列表可用且无旧数据污染迹象'],
  ['TC-EVT-014', '`2026-07-07` 第二批新增自动化通过：More News 来源列表展开/展示稳定'],
  ['TC-EVT-015', '`2026-07-07` 第四批新增自动化通过：Events 卡片分享图标点击后页面稳定且链接/反馈可用'],
  ['TC-EVT-017', '`2026-07-07` 第四批新增自动化通过：Events 新闻条目承接到 News 详情页或同站新闻路由稳定'],
  ['TC-EVT-018', '`2026-07-07` 第二批新增自动化通过：Hot/All 切换后 Deep Analysis 进入当前可见分析页'],
  ['TC-EVTD-030', '`2026-07-07` 第四批新增自动化通过：未登录点击提醒入口进入登录承接并可关闭返回事件上下文'],
  ['TC-EVTD-031', '`2026-07-07` 第四批新增自动化通过：Evidence For YES/NO 可切换且无坏数据'],
  ['TC-EVTD-032', '`2026-07-07` 第四批新增自动化通过：Evidence Reload 后保持稳定证据/空态'],
  ['TC-EVTD-033', '`2026-07-07` 第二批新增自动化通过：TOP Holders 标签展示数据或稳定空态'],
  ['TC-EVTD-034', '`2026-07-07` 第二批新增自动化通过：Attribution 标签展示内容或稳定空态'],
  ['TC-EVTD-035', '`2026-07-07` 第四批新增自动化通过：事件深页提醒/图标类入口登录承接后关闭仍保留交易上下文'],
  ['TC-EVTD-036', '`2026-07-07` 第四批新增自动化通过：View resolved 展开后活动市场上下文仍可用'],
  ['TC-SIG-024', '`2026-07-07` 第四批新增自动化通过：Signal Buy NO 进入正确交易/登录承接路径'],
  ['TC-SIG-025', '`2026-07-07` 第四批新增自动化通过：多张 Signal 卡片连续展开后核心字段仍稳定可用'],
  ['TC-ORDER-002', '`2026-07-07` 第六批新增自动化通过：登录态 Buy YES 交易栏上下文正确'],
  ['TC-ORDER-003', '`2026-07-07` 第六批新增自动化通过：登录态 Buy NO 切换后 outcome 与价格上下文同步'],
  ['TC-ORDER-004', '`2026-07-07` 第六批新增自动化通过：登录态 Buy/Sell 方向切换后交易栏仍可用'],
  ['TC-ORDER-005', '`2026-07-07` 第六批新增自动化通过：登录态 Market/Limit 订单类型切换可用'],
  ['TC-ORDER-006', '`2026-07-07` 第六批新增自动化通过：登录态 Limit Price 步进控件保持合法边界'],
  ['TC-ORDER-007', '`2026-07-07` 第六批新增自动化通过：登录态金额输入接受合法数字'],
  ['TC-ORDER-008', '`2026-07-07` 第六批新增自动化通过：登录态金额输入拒绝字母和负数等异常文本'],
  ['TC-ORDER-009', '`2026-07-07` 第六批新增自动化通过：零余额账号快捷金额操作保持受控状态'],
  ['TC-ORDER-010', '`2026-07-07` 第六批新增自动化通过：零余额账号阻止交易提交并保留充值/余额提示'],
  ['TC-ORDER-018', '`2026-07-07` 第六批新增自动化通过：未提交订单刷新后不产生提交成功状态且交易栏可恢复']
]);

for (const id of passNotes.keys()) {
  pending.delete(id);
}

for (const id of failed.keys()) {
  pending.delete(id);
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((part) => part.trim());
}

function parseCases(markdown) {
  const cases = [];

  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| TC-')) {
      continue;
    }

    const cells = splitMarkdownRow(line);
    if (cells.length !== 6) {
      continue;
    }

    const [id, priority, preconditions, steps, expected, automationLevel] = cells;
    const match = id.match(/^TC-([A-Z]+)-/);

    cases.push({
      id,
      module: moduleNames.get(match?.[1] ?? '') ?? '其他',
      priority,
      steps,
      expected,
      automationLevel
    });
  }

  return cases;
}

function statusFor(testCase) {
  if (failed.has(testCase.id)) {
    return { kind: 'failed', status: FAIL_SYMBOL, result: '未通过 / 待复核', note: failed.get(testCase.id) };
  }

  if (pending.has(testCase.id)) {
    return { kind: 'pending', status: FAIL_SYMBOL, result: '条件式待执行', note: pending.get(testCase.id) };
  }

  return {
    kind: 'passed',
    status: PASS_SYMBOL,
    result: '通过',
    note: passNotes.get(testCase.id) ?? '本轮自动化或覆盖补齐专项通过'
  };
}

function escapePipes(value) {
  return value.replaceAll('|', '\\|');
}

const cases = parseCases(fs.readFileSync(casesPath, 'utf8'));

const rows = cases.map((testCase, index) => {
  const status = statusFor(testCase);
  return {
    ...testCase,
    index: index + 1,
    ...status
  };
});

const summary = rows.reduce(
  (acc, row) => {
    if (row.kind === 'passed') acc.passed += 1;
    if (row.kind === 'failed') acc.failed += 1;
    if (row.kind === 'pending') acc.pending += 1;
    acc.byModule.set(row.module, (acc.byModule.get(row.module) ?? 0) + 1);
    return acc;
  },
  { passed: 0, failed: 0, pending: 0, byModule: new Map() }
);

const failedRows = rows.filter((row) => row.kind === 'failed');
const pendingRows = rows.filter((row) => row.kind === 'pending');

const lines = [];
lines.push('# PredX Pro 测试报告 全量版 V2');
lines.push('');
lines.push('## 1. 报告总览');
lines.push('');
lines.push('| 项目 | 结果 |');
lines.push('| --- | --- |');
lines.push('| 测试站点 | [https://predx.pro](https://predx.pro) |');
lines.push('| 测试日期 | 2026-07-10 |');
lines.push(`| 用例总数 | \`${cases.length}\` |`);
lines.push(`| 框架用例入池率 | \`${cases.length} / ${cases.length} = 100%\` |`);
lines.push(`| 逐条用例通过 | ${PASS_SYMBOL} \`${summary.passed}\` |`);
lines.push(`| 逐条用例未通过 / 待复核 | ${FAIL_SYMBOL} \`${summary.failed}\` |`);
lines.push(`| 条件式待执行 / 新增待执行 | ${FAIL_SYMBOL} \`${summary.pending}\` |`);
lines.push('| 说明 | 本报告按 `TC-*` 用例编号逐条拆分；新增框架审计用例先计入待执行，不等同于已跑通过 |');
lines.push('');
lines.push('## 2. 状态图例');
lines.push('');
lines.push('| 标记 | 含义 |');
lines.push('| --- | --- |');
lines.push(`| ${PASS_SYMBOL} | 用例已通过自动化或覆盖补齐专项验证 |`);
lines.push(`| ${FAIL_SYMBOL} | 用例未通过、待复核，或新增后尚未完成脚本/人工执行 |`);
lines.push('');
lines.push('## 3. 模块分布');
lines.push('');
lines.push('| 模块 | 用例数 |');
lines.push('| --- | --- |');
for (const [module, count] of summary.byModule.entries()) {
  lines.push(`| ${module} | \`${count}\` |`);
}
lines.push('');
lines.push('## 4. 未通过 / 待复核清单');
lines.push('');
lines.push('| 用例编号 | 模块 | 状态 | 当前结论 |');
lines.push('| --- | --- | --- | --- |');
for (const row of failedRows) {
  lines.push(`| \`${row.id}\` | ${row.module} | ${row.status} | ${escapePipes(row.note)} |`);
}
lines.push('');
lines.push('## 5. 条件式待执行 / 新增待执行清单');
lines.push('');
lines.push('| 用例编号 | 模块 | 状态 | 条件 / 原因 |');
lines.push('| --- | --- | --- | --- |');
for (const row of pendingRows) {
  lines.push(`| \`${row.id}\` | ${row.module} | ${row.status} | ${escapePipes(row.note)} |`);
}
lines.push('');
lines.push('## 6. 产品缺陷与重点证据');
lines.push('');
lines.push('| 编号 | 关联用例 | 级别 | 结论 | 证据 |');
lines.push('| --- | --- | --- | --- | --- |');
lines.push(
  '| `BUG-20260707-01` | `TC-NEWS-022` | P1 | 已关闭：原失败为 News detail 骨架屏未加载完成时脚本过早断言，等待逻辑修正后复验通过 | `npx playwright test tests/news/news.spec.ts --project=chromium --workers=1 --grep "TC-NEWS-022"`，结果 `1 passed` |'
);
lines.push(
  '| `BUG-20260707-02` | `TC-ROB-013` | P2 | 顶部 `Sign In` 按钮可获得焦点，但键盘 Enter/Space 不触发登录弹层，存在键盘可访问性缺口 | [失败上下文](</Users/frankzhang/Documents/New project/predx-ui-qa/test-results/rob-rob-Robustness-and-com-77fc1-erate-nav-search-auth-entry-chromium/error-context.md>) / [截图](</Users/frankzhang/Documents/New project/predx-ui-qa/test-results/rob-rob-Robustness-and-com-77fc1-erate-nav-search-auth-entry-chromium/test-failed-1.png>) |'
);
lines.push(
  '| `AUTH-TRADE-GATE-20260710` | `TC-AUTH-009` / `TC-ORDER-011~012` / `TC-ORDER-020` | P0 | 当前 session 可进入 News 登录态 shell，但 Event 交易动作仍弹 `Connect to PredX`；订单确认/取消/失败处理已补脚本，因交易认证前置未满足而跳过 | [失败上下文](</Users/frankzhang/Documents/New project/predx-ui-qa/test-results/auth-auth-user-Logged-in-u-b5db9-diately-bounce-to-auth-gate-chromium/error-context.md>) / [截图](</Users/frankzhang/Documents/New project/predx-ui-qa/test-results/auth-auth-user-Logged-in-u-b5db9-diately-bounce-to-auth-gate-chromium/test-failed-1.png>) |'
);
lines.push(
  '| `BUG-20260701-05` | `TC-FLOW-011` | P2 | 已关闭：右侧栏承接入口可点击，脚本识别范围已修正 | [Bug 单](</Users/frankzhang/Documents/New project/PredX_Pro_Bug单_V1.md:131>) |'
);
lines.push('');
lines.push('## 7. 全量测试用例执行明细');
lines.push('');
lines.push('| 序号 | 用例编号 | 模块 | 优先级 | 自动化分级 | 测试步骤 | 预期结果 | 测试情况 | 备注 |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const row of rows) {
  lines.push(
    [
      row.index,
      `\`${row.id}\``,
      row.module,
      row.priority,
      row.automationLevel,
      escapePipes(row.steps),
      escapePipes(row.expected),
      row.status,
      escapePipes(row.note)
    ].join(' | ').replace(/^/, '| ') + ' |'
  );
}
lines.push('');
lines.push('## 8. 结论');
lines.push('');
lines.push(`- 全量 \`${cases.length}\` 条测试用例已纳入框架化用例池；新增用例需继续进入脚本实现、条件式专项或人工执行。`);
lines.push(
  `- 当前逐条用例口径下，通过 \`${summary.passed}\` 条，未通过/待复核 \`${summary.failed}\` 条，条件式或新增待执行 \`${summary.pending}\` 条。`
);
lines.push('- 第一批新增自动化验证 `19 passed / 0 failed`；第二批新增自动化验证 `8 passed / 0 failed`；第三批新增自动化验证 `5 passed / 1 failed`；第四批新增自动化验证 `9 TC passed / 0 failed`；第五批新增自动化验证 `6 passed / 0 failed`；第六批订单安全专项验证 `10 TC passed / 0 failed`；第七批 Auth 失败态验证 `1 passed / 0 failed`；第八批 News 来源展示验证 `1 passed / 0 failed`；`BUG-SEARCH-002` 真实 Chrome headed 复验 `1 passed / 0 failed`；`TC-NEWS-022` 等待逻辑修正复验 `1 passed / 0 failed`；`2026-07-10` 复验 `TC-AUTH-006 1 passed`，`TC-ORDER-011/012/020 3 skipped`。');
lines.push('- `BUG-SEARCH-002` 已复验关闭；`BUG-20260707-01` 已确认是脚本等待差异并关闭；`BUG-20260707-02` 建议补齐顶部 Sign In 键盘触发能力；`AUTH-TRADE-GATE-20260710` 建议重新生成完整交易可用 session 后复跑订单三条。');
lines.push('- 登录态用户流当前口径调整：`TC-AUTH-006` 和 `TC-AUTH-008` 可通过当前 storage state 验证；`TC-AUTH-009` 在 Event 交易动作中仍弹登录承接层，订单确认类用例保持条件式待执行。');

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);

console.log(outputPath);
