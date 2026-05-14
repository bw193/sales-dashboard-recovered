const TABLE_CANDIDATES = ['sales_records', 'sales'];
const FIELD_PAIRS = [
  ['importId', ['importId', 'import_id']],
  ['year', ['year']],
  ['date', ['date']],
  ['month', ['month']],
  ['salesperson', ['salesperson']],
  ['country', ['country']],
  ['usd', ['usd']],
  ['rmb', ['rmb']],
  ['custType', ['custType', 'cust_type']],
  ['channel', ['channel']],
  ['store', ['store']],
  ['operator', ['operator']],
  ['source', ['source']],
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return json({});

    if (url.pathname === '/api/sales') {
      if (request.method === 'GET') return getSales(env);
      if (request.method === 'POST') return createSale(request, env);
    }

    const match = url.pathname.match(/^\/api\/sales\/(\d+)$/);
    if (match) {
      if (request.method === 'PUT') return updateSale(request, env, Number(match[1]));
      if (request.method === 'DELETE') return deleteSale(request, env, Number(match[1]));
    }

    return env.ASSETS.fetch(request);
  },
};

async function getSales(env) {
  try {
    const { rows } = await readRows(env);
    const records = rows.map(normalizeRecord);

    return json({
      summary: {
        totalOrders: records.length,
        totalUSD: records.reduce((sum, record) => sum + (Number(record.usd) || 0), 0),
        totalRMB: records.reduce((sum, record) => sum + (Number(record.rmb) || 0), 0),
        generatedAt: latestUpdatedAt(records) || new Date().toISOString(),
      },
      records,
    });
  } catch (error) {
    return json({ error: error.message || 'Unable to load sales data' }, { status: 503 });
  }
}

async function createSale(request, env) {
  const auth = authorize(request, env);
  if (auth) return auth;

  try {
    const input = await request.json();
    const { table, columns } = await getWritableTable(env);
    const record = prepareRecord(input);
    const values = valuesForColumns(record, columns, { includeTimestamps: true });

    if (!values.length) return json({ error: 'No writable fields found' }, { status: 400 });

    const names = values.map(([name]) => quoteIdent(name));
    const placeholders = values.map(() => '?');
    const result = await env.DB.prepare(
      `INSERT INTO ${quoteIdent(table)} (${names.join(', ')}) VALUES (${placeholders.join(', ')})`
    ).bind(...values.map(([, value]) => value)).run();

    const id = result.meta?.last_row_id;
    const saved = id ? await findById(env.DB, table, id) : null;
    return json({ record: saved ? normalizeRecord(saved) : { ...record, id } }, { status: 201 });
  } catch (error) {
    return json({ error: error.message || 'Unable to create record' }, { status: 500 });
  }
}

async function updateSale(request, env, id) {
  const auth = authorize(request, env);
  if (auth) return auth;
  if (!id) return json({ error: 'Invalid record id' }, { status: 400 });

  try {
    const input = await request.json();
    const { table, columns } = await getWritableTable(env);
    const record = prepareRecord(input);
    const values = valuesForColumns(record, columns, { updateTimestamp: true });

    if (!values.length) return json({ error: 'No writable fields found' }, { status: 400 });

    const assignments = values.map(([name]) => `${quoteIdent(name)} = ?`);
    await env.DB.prepare(`UPDATE ${quoteIdent(table)} SET ${assignments.join(', ')} WHERE "id" = ?`)
      .bind(...values.map(([, value]) => value), id)
      .run();

    const saved = await findById(env.DB, table, id);
    if (!saved) return json({ error: 'Record not found' }, { status: 404 });
    return json({ record: normalizeRecord(saved) });
  } catch (error) {
    return json({ error: error.message || 'Unable to update record' }, { status: 500 });
  }
}

async function deleteSale(request, env, id) {
  const auth = authorize(request, env);
  if (auth) return auth;
  if (!id) return json({ error: 'Invalid record id' }, { status: 400 });

  try {
    const { table } = await getWritableTable(env);
    await env.DB.prepare(`DELETE FROM ${quoteIdent(table)} WHERE "id" = ?`).bind(id).run();
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || 'Unable to delete record' }, { status: 500 });
  }
}

async function readRows(env) {
  if (!env.DB) throw new Error('D1 binding DB is not configured');

  for (const table of await getTableCandidates(env.DB)) {
    try {
      const columns = await getColumns(env.DB, table);
      if (!looksLikeSalesTable(columns)) continue;
      const order = preferredOrder(table, columns);
      const result = await env.DB.prepare(`SELECT * FROM ${quoteIdent(table)} ${order}`).all();
      return { table, rows: result.results || [] };
    } catch (error) {
      // Try the next likely table.
    }
  }

  throw new Error('No supported sales table found');
}

async function getWritableTable(env) {
  if (!env.DB) throw new Error('D1 binding DB is not configured');

  for (const table of await getTableCandidates(env.DB)) {
    try {
      const columns = await getColumns(env.DB, table);
      if (looksLikeSalesTable(columns)) return { table, columns };
    } catch (error) {
      // Try the next likely table.
    }
  }

  throw new Error('No supported sales table found');
}

async function getTableCandidates(db) {
  const tables = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  ).all();
  const names = (tables.results || []).map((row) => row.name).filter(Boolean);
  return [...new Set([...TABLE_CANDIDATES, ...names])];
}

async function getColumns(db, table) {
  const result = await db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  return new Set((result.results || []).map((column) => column.name));
}

async function findById(db, table, id) {
  return db.prepare(`SELECT * FROM ${quoteIdent(table)} WHERE "id" = ? LIMIT 1`).bind(id).first();
}

function looksLikeSalesTable(columns) {
  return columns.has('date') && columns.has('salesperson') && (columns.has('usd') || columns.has('rmb'));
}

function preferredOrder(table, columns) {
  if (columns.has('date') && columns.has('id')) return 'ORDER BY "date" DESC, "id" DESC';
  if (columns.has('id')) return 'ORDER BY "id" DESC';
  return '';
}

function normalizeRecord(row) {
  return {
    id: row.id ?? null,
    importId: row.importId ?? row.import_id ?? null,
    year: Number(row.year) || yearFromDate(row.date),
    date: row.date || '',
    month: row.month || monthFromDate(row.date),
    salesperson: row.salesperson || '',
    country: row.country || '',
    usd: Number(row.usd) || 0,
    rmb: Number(row.rmb) || 0,
    custType: row.custType ?? row.cust_type ?? '',
    channel: row.channel || '',
    store: row.store || '',
    operator: row.operator || '',
    source: row.source || '',
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
  };
}

function prepareRecord(input) {
  const date = String(input.date || '').slice(0, 10);
  return {
    importId: input.importId || null,
    year: Number(input.year) || yearFromDate(date),
    date,
    month: input.month || monthFromDate(date),
    salesperson: String(input.salesperson || '').trim(),
    country: String(input.country || '').trim(),
    usd: Number(input.usd) || 0,
    rmb: Number(input.rmb) || 0,
    custType: String(input.custType || '').trim(),
    channel: String(input.channel || '').trim(),
    store: String(input.store || '').trim(),
    operator: String(input.operator || '').trim(),
    source: String(input.source || '').trim(),
  };
}

function valuesForColumns(record, columns, options = {}) {
  const values = [];

  for (const [field, names] of FIELD_PAIRS) {
    const name = names.find((candidate) => columns.has(candidate));
    if (name) values.push([name, record[field] ?? null]);
  }

  if (options.includeTimestamps) {
    const now = nowSql();
    if (columns.has('createdAt')) values.push(['createdAt', now]);
    if (columns.has('created_at')) values.push(['created_at', now]);
    if (columns.has('updatedAt')) values.push(['updatedAt', now]);
    if (columns.has('updated_at')) values.push(['updated_at', now]);
  }

  if (options.updateTimestamp) {
    const now = nowSql();
    if (columns.has('updatedAt')) values.push(['updatedAt', now]);
    if (columns.has('updated_at')) values.push(['updated_at', now]);
  }

  return values;
}

function authorize(request, env) {
  if (!env.SALES_ADMIN_TOKEN) return json({ error: 'SALES_ADMIN_TOKEN is not configured' }, { status: 503 });

  const expected = `Bearer ${env.SALES_ADMIN_TOKEN}`;
  if (request.headers.get('authorization') !== expected) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function latestUpdatedAt(records) {
  return records.map((record) => record.updatedAt || record.createdAt).filter(Boolean).sort().at(-1);
}

function yearFromDate(date) {
  return Number(String(date || '').slice(0, 4)) || new Date().getUTCFullYear();
}

function monthFromDate(date) {
  return String(date || '').slice(0, 7);
}

function nowSql() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function quoteIdent(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
      ...(init.headers || {}),
    },
  });
}
