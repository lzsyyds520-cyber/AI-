import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const parentRoot = path.resolve(projectRoot, '..');
const sourcePath = path.join(parentRoot, 'PredX_Pro_测试用例_V2_已覆盖版_2026-07-20.md');
const outputDir = path.join(projectRoot, 'workbench');
const outputPath = path.join(outputDir, 'test-cases.html');

const moduleOrder = [
  '公共导航',
  'News',
  'Market',
  'Events',
  'Event 深页',
  'Analysis 深页',
  'Signal',
  '登录登出',
  '下单链路',
  '跨页链路',
  '鲁棒性'
];

const moduleMeta = new Map([
  ['公共导航', { code: 'COM', accent: '#2563eb' }],
  ['News', { code: 'NEWS', accent: '#0891b2' }],
  ['Market', { code: 'MKT', accent: '#16a34a' }],
  ['Events', { code: 'EVT', accent: '#7c3aed' }],
  ['Event 深页', { code: 'EVTD', accent: '#dc2626' }],
  ['Analysis 深页', { code: 'ANL', accent: '#9333ea' }],
  ['Signal', { code: 'SIG', accent: '#ea580c' }],
  ['登录登出', { code: 'AUTH', accent: '#475569' }],
  ['下单链路', { code: 'ORDER', accent: '#0f766e' }],
  ['跨页链路', { code: 'FLOW', accent: '#4f46e5' }],
  ['鲁棒性', { code: 'ROB', accent: '#64748b' }]
]);

const frameworkMeta = [
  ['F01', '入口与导航', /打开|进入|导航|Logo|URL|首页|页面标题|直接访问/],
  ['F02', '首屏结构', /首屏|页面成功加载|核心模块|默认状态|列表|分类|骨架|结构/],
  ['F03', '数据字段', /字段|标题|来源|时间|价格|概率|成交量|流动性|TVL|订单簿|NaN|undefined|格式|数值|百分比/],
  ['F04', '搜索与筛选', /搜索|筛选|query|关键词|空态|分类组合|清空|历史/],
  ['F05', '卡片承接', /卡片|关联|Related|Deep Analysis|小卡片|承接|点击一条|跳转目标/],
  ['F06', '页面内交互', /Tab|展开|收起|More News|Reload|Share|提醒|切换|刷新恢复|快速切换/],
  ['F07', '交易前承接', /Trade|Buy|Sell|YES|NO|Amount|Shares|Limit Price|订单|下单|交易栏|快捷金额|Recent|Positions|Open Orders|History/],
  ['F08', '登录与权限', /登录|Sign In|Email|OAuth|Wallet|权限|游客态|登出|auth|通知铃铛|Deposit/],
  ['F09', '返回与路由', /返回|Back|Forward|浏览器|history|路由|原页|上一页|搜索返回/],
  ['F10', '异常与鲁棒性', /慢网|断网|接口|500|失败|异常|白屏|快速|键盘|兼容|WebKit|性能|长时间|空数组|恢复/]
];

function splitMarkdownRow(line) {
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((part) => part.trim());
}

function cleanMarkdown(value) {
  return value
    .replaceAll('`', '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCoveredCases(markdown) {
  const rows = [];
  let inDetailsTable = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('| 序号 | 用例编号 | 模块 | 优先级 | 自动化分级 | 测试步骤 | 预期结果 | 当前状态 |')) {
      inDetailsTable = true;
      continue;
    }

    if (!inDetailsTable) {
      continue;
    }

    if (!line.startsWith('|')) {
      break;
    }

    if (line.includes('| --- |')) {
      continue;
    }

    const cells = splitMarkdownRow(line);
    if (cells.length < 10 || !cells[1].includes('TC-')) {
      continue;
    }

    const [index, id, module, priority, automationLevel, steps, expected, currentStatus, dailyScope, note] = cells;
    const normalizedSteps = cleanMarkdown(steps);
    const normalizedExpected = cleanMarkdown(expected);
    rows.push({
      index: Number(cleanMarkdown(index)),
      id: cleanMarkdown(id),
      module: cleanMarkdown(module),
      priority: cleanMarkdown(priority),
      automationLevel: cleanMarkdown(automationLevel),
      steps: normalizedSteps,
      expected: normalizedExpected,
      currentStatus: cleanMarkdown(currentStatus),
      dailyScope: cleanMarkdown(dailyScope),
      note: cleanMarkdown(note),
      framework: inferFramework(`${normalizedSteps} ${normalizedExpected}`)
    });
  }

  return rows;
}

function inferFramework(text) {
  for (const [code, label, pattern] of frameworkMeta) {
    if (pattern.test(text)) {
      return { code, label };
    }
  }

  return { code: 'F02', label: '首屏结构' };
}

function collectTestMappings(dir) {
  const mappings = new Map();
  const files = listFiles(dir).filter((file) => file.endsWith('.ts'));

  for (const file of files) {
    const rel = path.relative(projectRoot, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      const titleMatch = line.match(/\btest(?:\.skip|\.fixme|\.only)?\(\s*['"`]([^'"`]*TC-[^'"`]*)['"`]/);
      if (!titleMatch) {
        continue;
      }

      const title = titleMatch[1];
      for (const id of title.match(/TC-[A-Z]+-\d{3}/g) ?? []) {
        if (!mappings.has(id)) {
          mappings.set(id, []);
        }
        mappings.get(id).push({ file: rel, title });
      }
    }
  }

  return mappings;
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function countBy(items, getter) {
  const counts = new Map();
  for (const item of items) {
    const key = getter(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusKind(status) {
  if (status.includes('❌')) return 'failed';
  if (status.includes('⚠️')) return 'review';
  if (status.includes('⏳')) return 'pending';
  if (status.includes('✅')) return 'passed';
  return 'unknown';
}

function commandFor(row) {
  if (row.id.startsWith('TC-MKT-00') || ['TC-MKT-010'].includes(row.id)) return 'npm run test:conditional:market';
  if (row.id.startsWith('TC-EVTD-00')) return 'npm run test:conditional:event';
  if (row.id.startsWith('TC-AUTH')) return 'npm run test:conditional:auth-user';
  if (row.id.startsWith('TC-ORDER')) return 'npm run test:conditional:order-user';
  if (row.id.startsWith('TC-FLOW-005')) return 'npm run test:flow:search:headed';
  return 'npm run run:daily';
}

function buildSidebar(cases) {
  const moduleCounts = countBy(cases, (row) => row.module);
  const frameworkCounts = countBy(cases, (row) => `${row.framework.code} ${row.framework.label}`);
  const statusCounts = countBy(cases, (row) => statusKind(row.currentStatus));

  const moduleItems = moduleOrder
    .filter((name) => moduleCounts.has(name))
    .map((name) => {
      const meta = moduleMeta.get(name) ?? { code: name.slice(0, 3), accent: '#64748b' };
      return navButton({
        group: 'module',
        value: name,
        label: name,
        badge: moduleCounts.get(name),
        prefix: meta.code,
        style: `--accent:${meta.accent}`
      });
    })
    .join('\n');

  const statusItems = [
    ['passed', '已覆盖 / 通过', 'PASS'],
    ['review', '待复核', 'WARN'],
    ['failed', '已知未通过', 'FAIL'],
    ['pending', '条件待执行', 'TODO']
  ]
    .filter(([value]) => statusCounts.has(value))
    .map(([value, label, prefix]) =>
      navButton({
        group: 'status',
        value,
        label,
        badge: statusCounts.get(value),
        prefix
      })
    )
    .join('\n');

  const frameworkItems = frameworkMeta
    .map(([code, label]) => {
      const key = `${code} ${label}`;
      return navButton({
        group: 'framework',
        value: code,
        label: `${code} ${label}`,
        badge: frameworkCounts.get(key) ?? 0,
        prefix: code
      });
    })
    .join('\n');

  return `
    <aside class="rail" aria-label="工作台功能栏">
      <button class="rail-item active" data-panel="cases" title="用例库">TC</button>
      <button class="rail-item" data-panel="runs" title="执行记录">RUN</button>
      <button class="rail-item" data-panel="bugs" title="缺陷分流">BUG</button>
      <button class="rail-item" data-panel="reports" title="报告中心">REP</button>
      <button class="rail-item" data-panel="knowledge" title="知识库">KB</button>
    </aside>
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">PX</div>
        <div>
          <strong>PredX QA</strong>
          <span>测试用例工作台</span>
        </div>
      </div>
      <div class="sidebar-search">
        <input id="sidebarSearch" type="search" placeholder="搜索用例 / 模块 / 关键词">
      </div>
      <nav class="nav-section">
        <button class="nav-all active" data-filter-group="all" data-filter-value="all">
          <span>ALL</span>
          <strong>全部用例</strong>
          <em>${cases.length}</em>
        </button>
      </nav>
      <section class="nav-section">
        <h3>用例库</h3>
        ${moduleItems}
      </section>
      <section class="nav-section">
        <h3>执行状态</h3>
        ${statusItems}
      </section>
      <section class="nav-section">
        <h3>测试流程层级</h3>
        ${frameworkItems}
      </section>
    </aside>
  `;
}

function navButton({ group, value, label, badge, prefix, style = '' }) {
  return `
    <button class="nav-item" data-filter-group="${escapeHtml(group)}" data-filter-value="${escapeHtml(value)}" style="${escapeHtml(style)}">
      <span>${escapeHtml(prefix)}</span>
      <strong>${escapeHtml(label)}</strong>
      <em>${escapeHtml(badge)}</em>
    </button>
  `;
}

function buildRows(cases, mappings) {
  return cases
    .map((row) => {
      const meta = moduleMeta.get(row.module) ?? { code: row.module.slice(0, 3), accent: '#64748b' };
      const scripts = mappings.get(row.id) ?? [];
      const scriptText = scripts.length ? scripts.map((item) => item.file).join(' / ') : '未映射到标题，需复核';
      const titleText = scripts.length ? scripts.map((item) => item.title).join(' / ') : '';
      const kind = statusKind(row.currentStatus);
      const command = commandFor(row);
      return `
        <tr
          data-id="${escapeHtml(row.id)}"
          data-module="${escapeHtml(row.module)}"
          data-status="${escapeHtml(kind)}"
          data-framework="${escapeHtml(row.framework.code)}"
          data-search="${escapeHtml(`${row.id} ${row.module} ${row.priority} ${row.automationLevel} ${row.steps} ${row.expected} ${row.note} ${scriptText}`.toLowerCase())}"
          data-priority="${escapeHtml(row.priority)}"
          data-automation="${escapeHtml(row.automationLevel)}"
          data-steps="${escapeHtml(row.steps)}"
          data-expected="${escapeHtml(row.expected)}"
          data-command="${escapeHtml(command)}"
          data-script="${escapeHtml(scriptText)}"
          data-script-title="${escapeHtml(titleText)}"
          data-note="${escapeHtml(row.note)}"
        >
          <td><span class="case-id">${escapeHtml(row.id)}</span></td>
          <td class="case-meta">
            <span class="module-pill" style="--accent:${escapeHtml(meta.accent)}">${escapeHtml(row.module)}</span>
            <span class="priority-pill">${escapeHtml(row.priority)}</span>
          </td>
          <td><span class="status ${kind}">${escapeHtml(row.currentStatus)}</span></td>
          <td><span class="framework-pill">${escapeHtml(row.framework.code)}</span><span class="framework-label">${escapeHtml(row.framework.label)}</span></td>
          <td class="scenario">
            <strong>${escapeHtml(row.steps)}</strong>
            <span>${escapeHtml(row.expected)}</span>
          </td>
          <td class="row-actions">
            <code>${escapeHtml(command)}</code>
            <button type="button" class="detail-button">详情</button>
          </td>
        </tr>
      `;
    })
    .join('\n');
}

function buildSummary(cases) {
  const total = cases.length;
  const passed = cases.filter((row) => statusKind(row.currentStatus) === 'passed').length;
  const review = cases.filter((row) => statusKind(row.currentStatus) === 'review').length;
  const failed = cases.filter((row) => statusKind(row.currentStatus) === 'failed').length;
  const direct = cases.filter((row) => row.automationLevel === '直接自动化').length;
  const conditional = cases.filter((row) => row.automationLevel === '条件式自动化').length;

  return `
    <section class="summary-grid">
      ${metricCard('总用例', total, '当前已覆盖版用例池')}
      ${metricCard('已覆盖', passed, '无未关闭阻断')}
      ${metricCard('待复核', review, '最近回归需复核')}
      ${metricCard('未通过', failed, '已知未关闭缺陷')}
      ${metricCard('直接自动化', direct, '日常主力覆盖')}
      ${metricCard('条件式', conditional, '依赖 fixture / 环境')}
    </section>
  `;
}

function metricCard(label, value, hint) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(hint)}</em>
    </article>
  `;
}

function buildModuleCards(cases) {
  const moduleCounts = countBy(cases, (row) => row.module);
  return moduleOrder
    .filter((name) => moduleCounts.has(name))
    .map((name) => {
      const meta = moduleMeta.get(name) ?? { code: name.slice(0, 3), accent: '#64748b' };
      const rows = cases.filter((row) => row.module === name);
      const passed = rows.filter((row) => statusKind(row.currentStatus) === 'passed').length;
      const risk = rows.length - passed;
      return `
        <button class="module-card" data-filter-group="module" data-filter-value="${escapeHtml(name)}" style="--accent:${escapeHtml(meta.accent)}">
          <span>${escapeHtml(meta.code)}</span>
          <strong>${escapeHtml(name)}</strong>
          <em>${passed}/${rows.length} 已覆盖</em>
          <small>${risk ? `${risk} 条需关注` : '无未关闭阻断'}</small>
        </button>
      `;
    })
    .join('\n');
}

function buildHtml(cases, mappings) {
  const generatedAt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PredX QA 测试用例工作台</title>
  <style>
    :root {
      --bg: #f5f7fb;
      --panel: #ffffff;
      --line: #e5e7eb;
      --text: #111827;
      --muted: #64748b;
      --brand: #5b5ef7;
      --brand-soft: #ececff;
      --danger: #dc2626;
      --success: #16a34a;
      --warning: #d97706;
      --radius: 8px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background: var(--bg);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      letter-spacing: 0;
    }
    button, input, select {
      font: inherit;
    }
    .app {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 64px 288px minmax(0, 1fr);
    }
    .rail {
      background: #0f172a;
      padding: 14px 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-right: 1px solid #1e293b;
    }
    .rail-item {
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 8px;
      color: #cbd5e1;
      background: transparent;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
    }
    .rail-item:hover,
    .rail-item.active {
      color: #ffffff;
      background: #334155;
    }
    .sidebar {
      background: var(--panel);
      border-right: 1px solid var(--line);
      padding: 18px 16px;
      overflow: auto;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
    }
    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      color: #fff;
      background: #111827;
      font-weight: 800;
    }
    .brand strong,
    .brand span {
      display: block;
    }
    .brand span {
      margin-top: 2px;
      font-size: 12px;
      color: var(--muted);
    }
    .sidebar-search input {
      width: 100%;
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 12px;
      outline: none;
      background: #f8fafc;
    }
    .sidebar-search input:focus {
      border-color: var(--brand);
      background: #fff;
    }
    .nav-section {
      margin-top: 18px;
    }
    .nav-section h3 {
      margin: 0 0 8px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .nav-all,
    .nav-item {
      width: 100%;
      min-height: 40px;
      display: grid;
      grid-template-columns: 46px 1fr auto;
      align-items: center;
      gap: 8px;
      margin: 4px 0;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .nav-all span,
    .nav-item span {
      justify-self: center;
      width: 36px;
      padding: 4px 0;
      border-radius: 6px;
      color: var(--accent, var(--brand));
      background: color-mix(in srgb, var(--accent, var(--brand)) 12%, white);
      font-size: 10px;
      font-weight: 800;
      text-align: center;
    }
    .nav-all strong,
    .nav-item strong {
      font-size: 13px;
      font-weight: 650;
    }
    .nav-all em,
    .nav-item em {
      margin-right: 8px;
      color: var(--muted);
      font-style: normal;
      font-size: 12px;
    }
    .nav-all:hover,
    .nav-item:hover,
    .nav-all.active,
    .nav-item.active {
      border-color: color-mix(in srgb, var(--accent, var(--brand)) 28%, white);
      background: color-mix(in srgb, var(--accent, var(--brand)) 8%, white);
    }
    .main {
      min-width: 0;
      padding: 22px 24px 36px;
      overflow: auto;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 18px;
    }
    .topbar h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.25;
    }
    .topbar p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .top-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .top-actions input,
    .top-actions select {
      height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      background: #fff;
      outline: none;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(120px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .metric-card {
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }
    .metric-card span,
    .metric-card em {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-style: normal;
    }
    .metric-card strong {
      display: block;
      margin: 4px 0;
      font-size: 26px;
      line-height: 1;
    }
    .module-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .module-card {
      min-height: 96px;
      padding: 12px;
      border: 1px solid var(--line);
      border-left: 4px solid var(--accent);
      border-radius: 8px;
      background: var(--panel);
      text-align: left;
      cursor: pointer;
    }
    .module-card:hover {
      border-color: var(--accent);
    }
    .module-card span,
    .module-card em,
    .module-card small {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-style: normal;
    }
    .module-card strong {
      display: block;
      margin: 8px 0 4px;
      font-size: 15px;
    }
    .table-panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      overflow: hidden;
    }
    .table-header {
      min-height: 54px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
    }
    .table-header strong {
      font-size: 15px;
    }
    .table-header span {
      color: var(--muted);
      font-size: 13px;
    }
    .table-wrap {
      overflow-y: auto;
      overflow-x: hidden;
      max-height: calc(100vh - 390px);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th,
    td {
      padding: 11px 12px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      font-size: 13px;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #f8fafc;
      color: #334155;
      text-align: left;
      font-weight: 700;
    }
    th:nth-child(1) { width: 128px; }
    th:nth-child(2) { width: 166px; }
    th:nth-child(3) { width: 116px; }
    th:nth-child(4) { width: 120px; }
    th:nth-child(6) { width: 220px; }
    tbody tr {
      cursor: pointer;
    }
    tbody tr:hover {
      background: #f8fafc;
    }
    .case-id {
      display: inline-block;
      padding: 4px 6px;
      border-radius: 6px;
      background: #eef2ff;
      color: #3730a3;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      font-weight: 700;
    }
    .module-pill {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      color: var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, white);
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .case-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .priority-pill,
    .framework-pill {
      display: inline-block;
      padding: 4px 7px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .framework-label {
      display: block;
      margin-top: 4px;
      color: #334155;
      line-height: 1.35;
    }
    .status {
      display: inline-block;
      white-space: nowrap;
      font-weight: 700;
    }
    .status.passed { color: var(--success); }
    .status.review,
    .status.pending { color: var(--warning); }
    .status.failed { color: var(--danger); }
    code {
      padding: 3px 5px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
    }
    .scenario,
    .note {
      line-height: 1.5;
    }
    .scenario strong,
    .scenario span {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      line-height: 1.45;
    }
    .scenario strong {
      -webkit-line-clamp: 2;
      font-weight: 650;
    }
    .scenario span {
      margin-top: 4px;
      color: var(--muted);
      -webkit-line-clamp: 1;
    }
    .row-actions {
      display: grid;
      gap: 8px;
      align-content: start;
    }
    .row-actions code {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .detail-button {
      width: 64px;
      height: 30px;
      border: 1px solid #c7d2fe;
      border-radius: 8px;
      color: #3730a3;
      background: #eef2ff;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
    }
    .detail-button:hover {
      border-color: #818cf8;
      background: #e0e7ff;
    }
    .detail-drawer {
      position: fixed;
      top: 18px;
      right: 18px;
      bottom: 18px;
      width: min(560px, calc(100vw - 40px));
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 18px 55px rgb(15 23 42 / 18%);
      background: #fff;
      padding: 18px;
      display: none;
      z-index: 10;
    }
    .detail-drawer.open {
      display: block;
    }
    .drawer-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .drawer-head h2 {
      margin: 0;
      font-size: 18px;
    }
    .drawer-head button {
      width: 32px;
      height: 32px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
    }
    .drawer-grid {
      display: grid;
      gap: 10px;
    }
    .drawer-grid div {
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f8fafc;
      line-height: 1.55;
    }
    .drawer-grid span {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .hidden {
      display: none;
    }
    @media (max-width: 1100px) {
      .app {
        grid-template-columns: 56px 240px minmax(0, 1fr);
      }
      .summary-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      th:nth-child(2) { width: 138px; }
      th:nth-child(6) { width: 180px; }
    }
    @media (max-width: 760px) {
      .app {
        grid-template-columns: 1fr;
      }
      .rail {
        display: none;
      }
      .sidebar {
        position: sticky;
        top: 0;
        z-index: 3;
        max-height: 54vh;
      }
      .main {
        padding: 16px;
      }
      .topbar,
      .top-actions {
        display: block;
      }
      .top-actions input,
      .top-actions select {
        width: 100%;
        margin-top: 8px;
      }
      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .table-wrap {
        max-height: none;
      }
      table,
      thead,
      tbody,
      tr,
      th,
      td {
        display: block;
      }
      thead {
        display: none;
      }
      tbody tr {
        padding: 12px;
        border-bottom: 1px solid var(--line);
      }
      td {
        border-bottom: 0;
        padding: 6px 0;
      }
      .row-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    ${buildSidebar(cases)}
    <main class="main">
      <header class="topbar">
        <div>
          <h1>测试用例分类工作台</h1>
          <p>来源：PredX_Pro_测试用例_V2_已覆盖版_2026-07-20.md。生成时间：${escapeHtml(generatedAt)}</p>
        </div>
        <div class="top-actions">
          <input id="globalSearch" type="search" placeholder="全局搜索 TC / 步骤 / 预期 / 脚本">
          <select id="priorityFilter" aria-label="优先级筛选">
            <option value="all">全部优先级</option>
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </div>
      </header>
      ${buildSummary(cases)}
      <section class="module-grid" aria-label="模块卡片">
        ${buildModuleCards(cases)}
      </section>
      <section class="table-panel">
        <div class="table-header">
          <div>
            <strong id="activeTitle">全部用例</strong>
            <span id="activeHint">按左侧分类查看模块、状态和流程层级</span>
          </div>
          <span id="visibleCount">${cases.length} / ${cases.length}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>用例编号</th>
                <th>模块 / 优先级</th>
                <th>状态</th>
                <th>层级</th>
                <th>测试步骤 / 预期结果</th>
                <th>命令 / 详情</th>
              </tr>
            </thead>
            <tbody id="caseRows">
              ${buildRows(cases, mappings)}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
  <aside id="drawer" class="detail-drawer" aria-live="polite">
    <div class="drawer-head">
      <h2 id="drawerTitle">用例详情</h2>
      <button id="drawerClose" type="button" aria-label="关闭详情">X</button>
    </div>
    <div id="drawerBody" class="drawer-grid"></div>
  </aside>
  <script>
    const state = {
      group: 'all',
      value: 'all',
      query: '',
      priority: 'all'
    };
    const rows = Array.from(document.querySelectorAll('#caseRows tr'));
    const buttons = Array.from(document.querySelectorAll('[data-filter-group]'));
    const globalSearch = document.getElementById('globalSearch');
    const sidebarSearch = document.getElementById('sidebarSearch');
    const priorityFilter = document.getElementById('priorityFilter');
    const visibleCount = document.getElementById('visibleCount');
    const activeTitle = document.getElementById('activeTitle');
    const activeHint = document.getElementById('activeHint');
    const drawer = document.getElementById('drawer');
    const drawerTitle = document.getElementById('drawerTitle');
    const drawerBody = document.getElementById('drawerBody');
    const drawerClose = document.getElementById('drawerClose');

    function applyFilter() {
      let visible = 0;
      const query = state.query.trim().toLowerCase();

      for (const row of rows) {
        const matchesGroup =
          state.group === 'all' ||
          row.dataset[state.group] === state.value;
        const matchesPriority =
          state.priority === 'all' ||
          row.children[2].textContent.trim() === state.priority;
        const matchesQuery =
          !query ||
          row.dataset.search.includes(query);
        const show = matchesGroup && matchesPriority && matchesQuery;
        row.classList.toggle('hidden', !show);
        if (show) visible += 1;
      }

      visibleCount.textContent = visible + ' / ' + rows.length;
    }

    function setFilter(group, value, label) {
      state.group = group;
      state.value = value;
      buttons.forEach((button) => {
        button.classList.toggle('active', button.dataset.filterGroup === group && button.dataset.filterValue === value);
      });
      activeTitle.textContent = label || '全部用例';
      activeHint.textContent = group === 'all' ? '按左侧分类查看模块、状态和流程层级' : '当前分类：' + group + ' / ' + value;
      applyFilter();
    }

    for (const button of buttons) {
      button.addEventListener('click', () => {
        setFilter(button.dataset.filterGroup, button.dataset.filterValue, button.querySelector('strong')?.textContent || '全部用例');
      });
    }

    document.querySelectorAll('.module-card').forEach((card) => {
      card.addEventListener('click', () => {
        setFilter(card.dataset.filterGroup, card.dataset.filterValue, card.querySelector('strong').textContent);
      });
    });

    function syncSearch(value) {
      state.query = value;
      globalSearch.value = value;
      sidebarSearch.value = value;
      applyFilter();
    }

    globalSearch.addEventListener('input', (event) => syncSearch(event.target.value));
    sidebarSearch.addEventListener('input', (event) => syncSearch(event.target.value));
    priorityFilter.addEventListener('change', (event) => {
      state.priority = event.target.value;
      applyFilter();
    });

    rows.forEach((row) => {
      row.addEventListener('click', () => {
        drawerTitle.textContent = row.dataset.id;
        const detailItems = [
          ['用例编号', row.dataset.id],
          ['模块', row.dataset.module],
          ['优先级', row.dataset.priority],
          ['自动化分级', row.dataset.automation],
          ['状态', row.children[2].textContent.trim()],
          ['流程层级', row.children[3].textContent.trim()],
          ['测试步骤', row.dataset.steps],
          ['预期结果', row.dataset.expected],
          ['推荐命令', row.dataset.command],
          ['脚本映射', row.dataset.script],
          ['脚本标题', row.dataset.scriptTitle],
          ['备注', row.dataset.note]
        ];
        drawerBody.innerHTML = detailItems.map(([label, value]) => '<div><span>' + label + '</span>' + escapeHtml(value || '-') + '</div>').join('');
        drawer.classList.add('open');
      });
    });

    drawerClose.addEventListener('click', () => drawer.classList.remove('open'));

    function escapeHtml(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }
  </script>
</body>
</html>
`;
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing source test-case document: ${sourcePath}`);
}

const markdown = fs.readFileSync(sourcePath, 'utf8');
const cases = parseCoveredCases(markdown);
const mappings = collectTestMappings(path.join(projectRoot, 'tests'));

if (!cases.length) {
  throw new Error(`No test cases parsed from ${sourcePath}`);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, buildHtml(cases, mappings));

console.log(outputPath);
