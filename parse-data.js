/**
 * Reads the source Excel sales files and writes dashboard fallback data.
 *
 * Run:
 *   node parse-data.js
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const FILES = [
  { file: '2024年成交信息.xlsx', year: 2024 },
  { file: '2025年成交信息(5).xlsx', year: 2025 },
  { file: '26年成交数据.xlsx', year: 2026 },
];

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utc = (serial - 25569) * 86400 * 1000;
  return new Date(utc).toISOString().slice(0, 10);
}

function extractMonth(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : null;
}

const records = [];

FILES.forEach(({ file, year }) => {
  if (!fs.existsSync(file)) {
    console.warn(`File not found, skipping: ${file}`);
    return;
  }

  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  rows.slice(3).forEach((row) => {
    if (!row[1]) return;

    const date = excelDateToISO(row[1]);
    const salesperson = String(row[2] || '').trim();
    if (!date || !salesperson) return;

    records.push({
      year,
      date,
      month: extractMonth(date),
      salesperson,
      country: String(row[3] || '').trim(),
      usd: typeof row[4] === 'number' && row[4] > 0 ? row[4] : 0,
      rmb: typeof row[5] === 'number' && row[5] > 0 ? row[5] : 0,
      custType: String(row[6] || '').trim(),
      channel: String(row[7] || '').trim(),
      store: String(row[8] || '').trim(),
      operator: String(row[9] || '').trim(),
      source: String(row[10] || '').trim(),
    });
  });

  console.log(`Loaded ${file}`);
});

const summary = {
  totalOrders: records.length,
  totalUSD: records.reduce((sum, record) => sum + record.usd, 0),
  totalRMB: records.reduce((sum, record) => sum + record.rmb, 0),
  generatedAt: new Date().toISOString(),
};

const output = { summary, records };
const outDir = path.join(__dirname, 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sales-data.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(outDir, 'sales-data.js'), `window.SALES_DATA = ${JSON.stringify(output)};\n`, 'utf8');

console.log(`sales data written to public/ (${records.length} records)`);
