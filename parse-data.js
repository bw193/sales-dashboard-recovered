/**
 * parse-data.js
 * Run: node parse-data.js
 * Reads all Excel sales files and outputs sales-data.json for the dashboard.
 */
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const FILES = [
  { file: '2024年成交信息.xlsx',   year: 2024 },
  { file: '2025年成交信息(5).xlsx', year: 2025 },
  { file: '26年成交数据.xlsx',      year: 2026 },
];

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utc = (serial - 25569) * 86400 * 1000;
  const d   = new Date(utc);
  return d.toISOString().slice(0, 10);
}

function extractMonth(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7); // "YYYY-MM"
}

const records = [];

FILES.forEach(({ file, year }) => {
  if (!fs.existsSync(file)) {
    console.warn(`⚠  File not found, skipping: ${file}`);
    return;
  }
  const wb   = XLSX.readFile(file);
  const sn   = wb.SheetNames[0];
  const ws   = wb.Sheets[sn];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let currentMonth = '';
  // Row 0 = title, Row 1 = header labels, Row 2 = sub-header (USD/RMB), Row 3+ = data
  data.slice(3).forEach((r) => {
    if (!r[1]) return; // no date serial → blank/total row
    if (r[0] && typeof r[0] === 'string') currentMonth = r[0];

    const dateStr  = excelDateToISO(r[1]);
    const month    = extractMonth(dateStr);
    const salesperson = String(r[2] || '').trim();
    const country  = String(r[3] || '').trim();
    const usd      = typeof r[4] === 'number' && r[4] > 0 ? r[4] : 0;
    const rmb      = typeof r[5] === 'number' && r[5] > 0 ? r[5] : 0;
    const custType = String(r[6] || '').trim();  // 新客户 / 老客户
    const channel  = String(r[7] || '').trim();  // 线上 / 线下
    const store    = String(r[8] || '').trim();
    const operator = String(r[9] || '').trim();
    const source   = String(r[10] || '').trim(); // 2026 only

    if (!dateStr || !salesperson) return;

    records.push({
      year,
      date: dateStr,
      month,
      salesperson,
      country,
      usd,
      rmb,
      custType,
      channel,
      store,
      operator,
      source,
    });
  });

  console.log(`✓ Loaded ${file}`);
});

// ── Summary stats ──────────────────────────────────────────────────────────
const summary = {
  totalOrders:   records.length,
  totalUSD:      records.reduce((s, r) => s + r.usd, 0),
  totalRMB:      records.reduce((s, r) => s + r.rmb, 0),
  generatedAt:   new Date().toISOString(),
};

const output = { summary, records };
// Write as a JS file so index.html works directly via file:// without a server
const js = `window.SALES_DATA = ${JSON.stringify(output)};`;
fs.writeFileSync('sales-data.js', js, 'utf8');
console.log(`\n✅ sales-data.js written  (${records.length} records)`);
console.log(`   USD total : $${summary.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`   RMB total : ¥${summary.totalRMB.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
