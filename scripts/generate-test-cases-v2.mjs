import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const sourcePath = path.join(root, 'PredX_Pro_测试用例_V1.md');
const outputPath = path.join(root, 'PredX_Pro_测试用例_V2_2026-07-20.md');
const coveredOnlyOutputPath = path.join(root, 'PredX_Pro_测试用例_V2_已覆盖版_2026-07-20.md');
const promptOutputPath = path.join(root, 'PredX_Pro_AI自动化测试提示词_V2_专业版_2026-07-20.md');

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

const pendingConditions = new Map([
  ['TC-AUTH-009', '需要可被 Event 交易页接受的完整登录态 session；普通已登录 shell 仍可能在交易动作中再次弹登录承接层'],
  ['TC-AUTH-015', '需要真实邮箱验证码流，或测试环境提供固定验证码/验证码读取接口'],
  ['TC-ORDER-011', '需要登录态、可见 Cash 余额、可打开订单确认/预览；验证到预览层即可，避免真实成交'],
  ['TC-ORDER-012', '依赖 TC-ORDER-011 能稳定打开订单确认/预览，再验证取消/关闭不产生订单'],
  ['TC-ORDER-013', '需要沙盒交易环境或 mock 提交接口，避免生产真实下单风险'],
  ['TC-ORDER-014', '需要可提交并可查询的测试 Limit 挂单'],
  ['TC-ORDER-015', '需要可成交或可 mock 成交的 Market 订单，并能查询 Positions'],
  ['TC-ORDER-016', '需要订单历史接口返回稳定测试订单记录'],
  ['TC-ORDER-017', '需要可取消的测试挂单'],
  ['TC-ORDER-019', '需要可控行情变化或 mock 价格变动'],
  ['TC-ORDER-020', '需要 mock 订单提交接口 4xx/5xx/timeout，验证失败提示和恢复状态']
]);

const knownFailed = new Map([
  ['TC-ROB-013', '已知缺陷：顶部 Sign In 获得焦点后按 Enter/Space 未打开登录弹层，键盘可访问性不达标']
]);

const latestDailyFailures = new Map([
  ['TC-ANL-001', '2026-07-17 日常回归中 Analysis 当前样本页结构/Related News 断言待复核'],
  ['TC-ANL-003', '2026-07-17 日常回归中 Analysis 当前样本页结构/Related News 断言待复核'],
  ['TC-ANL-005', '2026-07-17 日常回归中 Analysis 当前样本页结构/Related News 断言待复核'],
  ['TC-ANL-006', '2026-07-17 日常回归中 Analysis 当前样本页结构/Related News 断言待复核'],
  ['TC-ANL-007', '2026-07-17 日常回归中 Analysis 当前样本页结构/Related News 断言待复核'],
  ['TC-ANL-010', '2026-07-17 日常回归未找到 Related News 承接入口，需按当前产品结构复核'],
  ['TC-ANL-011', '2026-07-17 日常回归未找到 Analysis -> News 承接入口，需按当前产品结构复核'],
  ['TC-ANL-012', '2026-07-17 日常回归长页面滚动稳定性失败，疑似受样本页结构变化影响'],
  ['TC-ANL-013', '2026-07-17 日常回归右侧栏展示校验失败，需确认内容缺失还是断言过严'],
  ['TC-ANL-017', '2026-07-17 日常回归语义一致性校验失败，需复核数据映射口径'],
  ['TC-EVTD-005', '2026-07-17 日常回归固定报价选择器过窄，线上价格变化后需改动态断言'],
  ['TC-EVTD-016', '2026-07-17 日常回归 Max 快捷金额未观察到输入变化或受限提示'],
  ['TC-EVTD-032', '2026-07-17 日常回归 Evidence Reload 空态分支与当前样本数据不一致'],
  ['TC-FLOW-011', '2026-07-17 日常回归 Analysis -> News 承接链路未找到，与 Related News 结构变化相关'],
  ['TC-SIG-023', '2026-07-17 日常回归 Signal 推荐价与关联市场价差超过阈值，需复核数据映射或脚本取值']
]);

const specialRegression = new Map([
  ['TC-FLOW-005', 'Chrome headed 专项：四页顶部搜索输入 iran 后进入 /search?q=iran'],
  ['TC-ROB-002', 'WebKit/Safari 兼容专项'],
  ['TC-AUTH-006', '登录态专项前置：生成并复用已登录 session'],
  ['TC-AUTH-007', '人工专项：钱包登录/MetaMask 授权不纳入日常自动化'],
  ['TC-AUTH-008', '登录态专项：刷新后保持登录态'],
  ['TC-AUTH-009', '登录态专项：鉴权接口与交易页 auth-user 状态一致'],
  ['TC-AUTH-010', '登录态专项：登出返回游客态'],
  ['TC-AUTH-011', '登录态专项：登出后刷新仍为游客态'],
  ['TC-AUTH-012', '登录态专项：登出后交易动作重新打开登录承接'],
  ['TC-AUTH-015', '人工/条件式专项：真实邮箱验证码'],
  ['TC-ORDER-011', '订单安全专项：只验证到确认/预览层'],
  ['TC-ORDER-012', '订单安全专项：取消/关闭确认层'],
  ['TC-ORDER-013', '沙盒或 mock 订单专项'],
  ['TC-ORDER-014', '沙盒或 mock 订单专项'],
  ['TC-ORDER-015', '沙盒或 mock 订单专项'],
  ['TC-ORDER-016', '沙盒或 mock 订单专项'],
  ['TC-ORDER-017', '沙盒或 mock 订单专项'],
  ['TC-ORDER-019', '沙盒或 mock 行情专项'],
  ['TC-ORDER-020', 'mock 失败接口专项']
]);

const professionalPrompt = [
  '### 可复制提示词',
  '',
  '```text',
  '你是一名资深 QA 自动化测试工程师 / SDET / Playwright 架构师。请基于 PRD、测试用例、线上页面、已有 Playwright 项目和历史执行报告，推进 PredX Pro 的自动化测试覆盖、执行、报告和缺陷归因。',
  '',
  '一、项目背景',
  '产品名称：PredX Pro',
  '线上站点：https://predx.pro',
  '核心页面：',
  '1. News：https://predx.pro/news',
  '2. Market：https://predx.pro/market',
  '3. Events：https://predx.pro/events',
  '4. Signal：https://predx.pro/signal',
  '5. Event 深页：例如 https://predx.pro/event/world-cup-winner',
  '6. Analysis 深页：例如 https://predx.pro/analysis/story_275631',
  '',
  '二、输入材料',
  '你可能会收到以下材料，请优先读取并相互校验：',
  '1. PRD 或需求说明。',
  '2. 测试用例文档和用例编号 TC-*。',
  '3. 线上页面 URL 和人工复核结论。',
  '4. Playwright 项目：tests、support、fixtures、scripts、playwright.config.ts、package.json。',
  '5. 执行产物：run log、HTML report、截图、video、trace、error-context。',
  '6. 已知 bug 单、待复核项、条件式自动化清单。',
  '',
  '三、核心目标',
  '请完成以下目标，不要只停留在测试用例描述：',
  '1. 建立 TC 编号与自动化脚本的覆盖矩阵。',
  '2. 从易到难补齐可稳定自动化的高价值路径。',
  '3. 对不能直接自动化的场景，明确条件、风险和需要的环境支持。',
  '4. 运行最小必要测试命令验证改动，并保留证据路径。',
  '5. 输出清晰的测试报告、执行结果表、失败归因、bug 单和日常回归工作流。',
  '',
  '四、自动化推进步骤',
  '1. 读取项目结构和测试用例，统计总用例、已覆盖、未覆盖、失败、跳过。',
  '2. 建立覆盖矩阵：TC 编号 -> 模块 -> 脚本文件 -> 测试标题 -> 执行命令 -> 当前状态。',
  '3. 按优先级推进：P0/P1 主链路优先，非登录态和非真实交易优先，稳定数据优先。',
  '4. 编写或修正 Playwright 脚本，测试标题必须包含 TC 编号。',
  '5. 每补一组脚本，执行最小可验证命令，并记录通过、失败、跳过和证据路径。',
  '6. 对失败项先看 trace、截图、video、error-context，再归因为产品 bug、脚本问题、线上数据变化、环境问题或待人工复核。',
  '7. 更新测试报告、执行结果表、条件式自动化清单和 bug 单。',
  '',
  '五、覆盖检查框架',
  '自动化覆盖必须按下面 10 层检查是否遗漏：',
  'F01 入口与导航：URL、顶部导航、Logo、页面标题、错误 URL。',
  'F02 首屏结构：核心模块、卡片、列表、Tab、默认状态。',
  'F03 数据字段：标题、来源、时间、价格、概率、成交量、流动性、订单簿、Recent、Positions、Open Orders、History。',
  'F04 搜索与筛选：顶部搜索、搜索历史、空态、筛选项、组合筛选、URL query、浏览器返回。',
  'F05 卡片承接：News 小卡片、Event 小卡片、Signal 小卡片、Related Market、Deep Analysis、Buy/Trade 入口。',
  'F06 页面内交互：Tab、展开收起、More News、Reload、Share、提醒入口、刷新恢复。',
  'F07 交易前承接：Buy/Sell、Yes/No outcome、Amount/Shares、Limit Price、快捷金额、Trade 按钮、订单确认层。',
  'F08 登录与权限：Sign In、Email 登录、OAuth、Wallet、登出、登录态保持、游客态拦截。',
  'F09 返回与路由：浏览器 Back/Forward、详情返回列表、搜索返回、状态保留、不崩溃。',
  'F10 异常与鲁棒性：慢网、断网、接口 500、空数组、快速点击、长时间停留、键盘可访问性、跨浏览器。',
  '',
  '六、Playwright 脚本设计标准',
  '1. 优先使用稳定选择器：role、label、placeholder、可见文本、URL pattern、API response、data-testid（如存在）。',
  '2. 对动态数据使用字段存在、格式、范围、同页一致性、有数据/无数据双分支断言。',
  '3. 不绑定固定价格、固定标题、固定时间，除非来自 fixture 或稳定样本。',
  '4. 等待策略优先使用 waitForURL、waitForResponse、locator 可见性、骨架屏消失或明确业务状态。',
  '5. 避免用大量固定 timeout 掩盖加载问题。',
  '6. 搜索、筛选、详情承接、返回路径必须同时验证 URL、首屏内容、无客户端异常和上下文可继续操作。',
  '7. API 条件式自动化要记录真实 query 参数、字段名、阈值和响应结构。',
  '8. mock 只用于错误恢复、空态、接口失败等受控场景，并说明 mock 范围。',
  '',
  '七、登录态与下单链路边界',
  '1. 游客态可以自动化：Sign In 弹层、Email 输入、OAuth/Wallet 入口展示、游客点击 Trade 被登录承接拦截。',
  '2. 登录态属于条件式自动化：登录态保持、刷新、登出、登出后权限恢复、auth-user 与 UI shell 一致。',
  '3. Google OAuth、钱包签名、真实验证码默认不做无监督自动化；如必须做，使用真实 Chrome Profile、storageState、测试环境验证码服务或人工协助。',
  '4. 下单链路默认验证到交易栏、输入校验、订单确认/预览、取消、错误提示和恢复状态。',
  '5. 除非明确提供沙盒环境、mock 提交接口或授权测试资金，否则不得执行真实生产下单。',
  '',
  '八、失败归因规则',
  '每个失败项必须归为以下类型之一，并写明证据：',
  '1. 页面是否真的有产品错误、客户端异常、白屏、跳错路由、字段缺失或交互无响应。',
  '2. 是否为脚本选择器过窄、等待不足、未等待加载完成、语言/登录态/浏览器差异。',
  '3. 是否为线上数据变化：价格、标题、新闻、事件状态、空态/有数据分支变化。',
  '4. 是否为环境问题：网络慢、Chrome Profile 未登录、验证码、风控、第三方 OAuth 拦截。',
  '5. 只有确认不是脚本/环境/数据波动后，才输出正式 bug 单。',
  '',
  '九、风险控制与兜底原则',
  '兜底策略需要保留，但不要喧宾夺主。请按以下原则处理不确定性：',
  '1. 需求不明确：列出产品预期、线上实际、脚本判断、待确认问题，不直接判 bug。',
  '2. 数据不稳定：使用动态断言和双分支断言，不写死价格、标题、时间。',
  '3. 选择器不稳定：先用语义定位；必要时建议补 data-testid；nth 和 DOM 层级只作临时兜底。',
  '4. 加载不稳定：通过 trace/video/error-context 验证，不用固定等待掩盖问题。',
  '5. 登录和交易受限：标为条件式自动化或人工专项，不混入日常回归。',
  '6. 脚本失败但人工正常：优先排查脚本路径、等待、浏览器和登录态差异。',
  '7. 脚本通过但人工发现问题：补充自动化场景，特别是返回路径、状态恢复和快速点击。',
  '',
  '十、交付物格式',
  '请输出以下内容：',
  '1. 自动化覆盖总览：总用例、已覆盖、未覆盖、失败、跳过、当前风险。',
  '2. 覆盖矩阵：TC 编号、模块、脚本文件、测试标题、执行命令、状态。',
  '3. 新增或修改脚本清单：文件路径、修改目的、覆盖的 TC 编号。',
  '4. 条件式自动化表：依赖账号、fixture、接口、mock、浏览器、人工协助项。',
  '5. 执行报告：通过、失败、跳过数量，失败原因，证据路径。',
  '6. bug 单：标题、级别、环境、复现步骤、预期结果、实际结果、证据、关联 TC、归因。',
  '7. 日常回归工作流：推荐命令、运行频率、产物路径、失败处理流程。',
  '',
  '十一、状态标记规则',
  '已通过使用绿色勾：✅',
  '未通过使用红叉：❌',
  '待复核使用警告：⚠️',
  '条件式待执行使用沙漏：⏳',
  '已跳过使用：⏭️',
  '',
  '十二、专业自检清单',
  '输出完成后，请自检以下问题，并在结论中说明：',
  '1. 是否覆盖了 PRD 中所有核心页面和主链路。',
  '2. 是否覆盖了返回路径、搜索路径、卡片承接、订单簿、游客态权限拦截、登录态保持、下单前链路。',
  '3. 是否区分了“已自动化”“条件式自动化”“建议人工”“暂不执行”。',
  '4. 是否避免了真实生产下单、泄露账号敏感信息、误判第三方 OAuth 或验证码问题。',
  '5. 是否有稳定选择器策略和等待策略。',
  '6. 是否对动态数据采用了稳健断言，而不是固定价格、固定标题、固定时间。',
  '7. 是否每个失败项都有证据路径和明确归因。',
  '8. 是否能让测试实习生根据命令直接跑日常测试。',
  '9. 是否能让研发根据 bug 单复现问题。',
  '10. 是否能让项目相关人员快速看到覆盖率、风险、未覆盖原因和下一步计划。',
  '',
  '十三、质量要求',
  '1. 不要只停留在计划层面；能写脚本就写脚本，能跑最小命令就跑最小命令。',
  '2. 不要为了通过而降低断言价值；应改成稳定且能发现真实问题的断言。',
  '3. 不要把人工复核正常的路径长期标为产品 bug；如果是脚本路径差异，要修脚本并把状态改为通过。',
  '4. 不要把尚未具备条件的自动化混进日常回归；必须标为条件式或人工专项。',
  '5. 输出必须能让测试实习生照着执行：命令明确、文件明确、判断标准明确、下一步明确。',
  '```'
].join('\n');

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
    const prefix = id.match(/^TC-([A-Z]+)-/)?.[1] ?? '';

    cases.push({
      id,
      module: moduleNames.get(prefix) ?? '其他',
      priority,
      preconditions,
      steps,
      expected,
      automationLevel
    });
  }

  return cases;
}

function statusFor(testCase) {
  if (knownFailed.has(testCase.id)) {
    return { icon: '❌', label: '已知未通过', note: knownFailed.get(testCase.id) };
  }

  if (pendingConditions.has(testCase.id)) {
    return { icon: '⏳', label: '条件式待执行', note: pendingConditions.get(testCase.id) };
  }

  if (latestDailyFailures.has(testCase.id)) {
    return { icon: '⚠️', label: '最近日常失败待复核', note: latestDailyFailures.get(testCase.id) };
  }

  return { icon: '✅', label: '已覆盖', note: '已纳入自动化、专项验证或人工口径，当前无未关闭阻断' };
}

function regressionLaneFor(testCase) {
  if (specialRegression.has(testCase.id)) {
    return specialRegression.get(testCase.id);
  }

  if (testCase.module === '下单链路') {
    return '订单安全专项：默认不真实提交订单';
  }

  return 'Chromium 日常回归';
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function makeRows(cases) {
  return cases
    .map((testCase, index) => {
      const status = statusFor(testCase);
      return [
        index + 1,
        `\`${testCase.id}\``,
        testCase.module,
        testCase.priority,
        testCase.automationLevel,
        testCase.steps,
        testCase.expected,
        `${status.icon} ${status.label}`,
        regressionLaneFor(testCase),
        status.note
      ]
        .map(escapeCell)
        .join(' | ');
    })
    .map((row) => `| ${row} |`)
    .join('\n');
}

function distribution(cases) {
  const counts = new Map();
  for (const testCase of cases) {
    counts.set(testCase.module, (counts.get(testCase.module) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([module, count]) => `| ${module} | \`${count}\` |`)
    .join('\n');
}

function countByStatus(cases, predicate) {
  return cases.filter((testCase) => predicate(statusFor(testCase), testCase)).length;
}

const source = fs.readFileSync(sourcePath, 'utf8');
const cases = parseCases(source);

if (cases.length !== 237) {
  throw new Error(`Expected 237 test cases, parsed ${cases.length}`);
}

const coveredCount = countByStatus(cases, (status) => status.label === '已覆盖');
const warningCount = countByStatus(cases, (status) => status.label === '最近日常失败待复核');
const failedCount = countByStatus(cases, (status) => status.label === '已知未通过');
const pendingCount = countByStatus(cases, (status) => status.label === '条件式待执行');

const pendingRows = [...pendingConditions.entries()]
  .map(([id, condition], index) => {
    const testCase = cases.find((item) => item.id === id);
    return `| ${index + 1} | \`${id}\` | ${testCase?.module ?? '未知'} | ${testCase?.priority ?? '-'} | ${condition} | ${regressionLaneFor(testCase ?? { id, module: '未知' })} |`;
  })
  .join('\n');

const dailyFailureRows = [...latestDailyFailures.entries()]
  .map(([id, note], index) => {
    const testCase = cases.find((item) => item.id === id);
    return `| ${index + 1} | \`${id}\` | ${testCase?.module ?? '未知'} | ${note} |`;
  })
  .join('\n');

const coveredOnlyCases = cases.filter((testCase) => !pendingConditions.has(testCase.id));
const coveredOnlyCoveredCount = countByStatus(coveredOnlyCases, (status) => status.label === '已覆盖');
const coveredOnlyWarningCount = countByStatus(coveredOnlyCases, (status) => status.label === '最近日常失败待复核');
const coveredOnlyFailedCount = countByStatus(coveredOnlyCases, (status) => status.label === '已知未通过');

const coveredOnlyContent = `# PredX Pro 测试用例 V2（已覆盖版）

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 文档名称 | PredX Pro 测试用例 V2（已覆盖版） |
| 生成日期 | 2026-07-20 |
| 测试站点 | https://predx.pro |
| 编写依据 | \`PredX_Pro_测试用例_V1.md\` + \`PredX_Pro_测试报告_全量版_V2.md\` + 2026-07-17 日常回归报告 |
| 本版口径 | 去除尚未覆盖的条件式自动化，只保留已覆盖、最近失败待复核、已知未通过的用例 |

## 2. 当前用例总览

| 指标 | 数量 |
| --- | --- |
| 原始用例池 | \`${cases.length}\` |
| 本版剔除未覆盖条件式自动化 | ⏳ \`${pendingCount}\` |
| 本版测试用例总数 | \`${coveredOnlyCases.length}\` |
| 已覆盖且当前无未关闭阻断 | ✅ \`${coveredOnlyCoveredCount}\` |
| 最近日常失败待复核 | ⚠️ \`${coveredOnlyWarningCount}\` |
| 已知未通过 | ❌ \`${coveredOnlyFailedCount}\` |

## 3. 模块分布

| 模块 | 用例数 |
| --- | --- |
${distribution(coveredOnlyCases)}

## 4. 测试流程框架

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

## 5. 日常回归口径

| 项目 | 口径 |
| --- | --- |
| 日常入口 | 在 \`/Users/frankzhang/Documents/New project/predx-ui-qa\` 执行 \`npm run run:daily\` |
| 默认范围 | Chromium 非登录态 + 条件式核心筛选 + 主要页面链路 |
| 本版不展示 | 尚未覆盖的登录态交易一致性、真实邮箱验证码、真实/沙盒订单提交等条件式自动化 |
| 失败判定 | 脚本失败先看是否为产品问题、线上数据变化、选择器过窄或环境专项缺失，再决定提 bug 或修脚本 |

## 6. 最近日常失败待复核

| 序号 | 用例编号 | 模块 | 当前判断 |
| --- | --- | --- | --- |
${dailyFailureRows}

## 7. 剔除规则说明

本版已从测试用例明细中去除尚未覆盖的条件式自动化。被剔除项不代表不重要，只代表当前还缺少稳定登录态、邮箱验证码服务、沙盒交易环境、mock 订单接口或可控行情条件，暂不计入本版可执行测试用例。

## 8. 测试用例明细（已覆盖版）

| 序号 | 用例编号 | 模块 | 优先级 | 自动化分级 | 测试步骤 | 预期结果 | 当前状态 | 日常回归归属 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${makeRows(coveredOnlyCases)}

## 9. 专业 AI 自动化测试提示词（专业版）

${professionalPrompt}
`;

const content = `# PredX Pro 测试用例 V2

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 文档名称 | PredX Pro 测试用例 V2 |
| 生成日期 | 2026-07-20 |
| 测试站点 | https://predx.pro |
| 编写依据 | \`PredX_Pro_测试用例_V1.md\` + \`PredX_Pro_测试报告_全量版_V2.md\` + 2026-07-17 日常回归报告 |
| 覆盖范围 | News、Market、Events、Signal、Event 深页、Analysis 深页、登录登出、下单链路、公共导航、跨页链路、鲁棒性 |
| 文档用途 | 作为后续日常自动化、条件式专项、人工复核和 bug 回归的统一用例池 |

## 2. 当前用例总览

| 指标 | 数量 |
| --- | --- |
| 全量测试用例 | \`${cases.length}\` |
| 已覆盖且当前无未关闭阻断 | ✅ \`${coveredCount}\` |
| 最近日常失败待复核 | ⚠️ \`${warningCount}\` |
| 已知未通过 | ❌ \`${failedCount}\` |
| 条件式待执行 | ⏳ \`${pendingCount}\` |

## 3. 模块分布

| 模块 | 用例数 |
| --- | --- |
${distribution(cases)}

## 4. 测试流程框架

| 层级 | 检查对象 | 覆盖重点 |
| --- | --- | --- |
| F01 | 入口与导航 | URL、顶部导航、Logo、页面标题、错误 URL |
| F02 | 首屏结构 | 核心模块、卡片、列表、Tab、默认状态 |
| F03 | 数据字段 | 标题、来源、时间、价格、概率、成交量、流动性、订单簿 |
| F04 | 搜索与筛选 | 顶部搜索、历史、空态、筛选项、组合条件、URL/query |
| F05 | 卡片承接 | News/Event/Signal 小卡片、Related Market、Deep Analysis、Buy 入口 |
| F06 | 页面内交互 | Tab、展开收起、More News、Reload、Share、Alert、刷新恢复 |
| F07 | 交易前承接 | Buy/Sell、Outcome、Amount/Shares、Limit Price、Order Book、Recent/Positions/Open Orders/History |
| F08 | 登录与权限 | 登录弹层、Email/OAuth/Wallet、登出、登录态保持、游客态拦截 |
| F09 | 返回与路由 | 浏览器 back/forward、详情返回列表、搜索返回、状态保持 |
| F10 | 异常与鲁棒性 | 慢网、断网、接口 500、空数组、快速点击、键盘可访问性、跨浏览器 |

## 5. 日常回归口径

| 项目 | 口径 |
| --- | --- |
| 日常入口 | 在 \`/Users/frankzhang/Documents/New project/predx-ui-qa\` 执行 \`npm run run:daily\` |
| 默认范围 | Chromium 非登录态 + 条件式核心筛选 + 主要页面链路 |
| 默认不做 | 真实生产下单、真实钱包授权、真实邮箱验证码、Safari/WebKit 专项 |
| 失败判定 | 脚本失败先看是否为产品问题、线上数据变化、选择器过窄或环境专项缺失，再决定提 bug 或修脚本 |

## 6. 最近日常失败待复核

| 序号 | 用例编号 | 模块 | 当前判断 |
| --- | --- | --- | --- |
${dailyFailureRows}

## 7. 条件式待执行清单

| 序号 | 用例编号 | 模块 | 优先级 | 自动化/执行条件 | 执行归属 |
| --- | --- | --- | --- | --- | --- |
${pendingRows}

## 8. 全量测试用例明细

| 序号 | 用例编号 | 模块 | 优先级 | 自动化分级 | 测试步骤 | 预期结果 | 当前状态 | 日常回归归属 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${makeRows(cases)}

## 9. 后续维护规则

1. 新增 bug 时，必须绑定至少一个 \`TC-*\` 用例；如果没有现成用例，先补用例再提 bug。
2. 产品改版时，优先修改测试用例预期，再同步脚本断言，避免脚本和产品口径分叉。
3. 日常回归失败分三类处理：产品缺陷、脚本选择器/等待问题、线上数据变化。只有确认是产品缺陷时进入正式 bug 单。
4. 下单链路默认只做到安全断言：交易栏、金额、确认层、错误提示、取消恢复；真实提交必须使用沙盒、mock 或明确授权的测试资金环境。

## 10. 专业 AI 自动化测试提示词（专业版）

${professionalPrompt}
`;

fs.writeFileSync(outputPath, content);
fs.writeFileSync(coveredOnlyOutputPath, coveredOnlyContent);
fs.writeFileSync(promptOutputPath, `# PredX Pro AI 自动化测试提示词 V2（专业版）\n\n${professionalPrompt}\n`);

console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${coveredOnlyOutputPath}`);
console.log(`Wrote ${promptOutputPath}`);
console.log(`Cases: ${cases.length}`);
console.log(`Covered: ${coveredCount}, warning: ${warningCount}, failed: ${failedCount}, pending: ${pendingCount}`);
console.log(`Covered-only cases: ${coveredOnlyCases.length}`);
