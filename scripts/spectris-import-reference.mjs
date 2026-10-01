import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// Parse the saved public CSV without modifying its strings, footnotes, or blank cells.
export function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw Error('Unclosed CSV quote');
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
const bytes = readFileSync('reference/brawl-mk-source.csv');
const rows = parseCsv(bytes.toString('utf8'));
const headers = [
  'label',
  'active',
  'intangibility',
  'faf',
  'damage',
  'angles',
  'baseKnockback',
  'weightKnockback',
  'knockbackScaling',
  'landing',
  'autocancel',
  'shieldAdvantage',
  'notes',
];
const moves = {};
let current = null;
for (let i = 5; i < rows.length; i++) {
  const r = rows[i],
    label = r[0]?.trim();
  if (!r.some((v) => v.trim())) {
    current = null;
    continue;
  }
  if (r[1] === 'Hitboxes active' || label?.endsWith(':')) {
    current = null;
    continue;
  }
  if (label && r.slice(1).some((v) => v.trim())) {
    current = label;
    moves[current] = { sourceRow: i + 1, rows: [] };
  }
  if (current) moves[current].rows.push(Object.fromEntries(headers.map((key, j) => [key, r[j] ?? ''])));
}
const attributes = {};
for (const r of rows.slice(1, 3))
  for (const cell of r) {
    const parts = cell.split('\n');
    if (parts.length === 2) attributes[parts[0].trim()] = { value: parts[1].trim() };
  }
for (const key of ['Neutral air', 'Forward air', 'Messed Up air', 'Glide attack'])
  if (!moves[key]) throw Error(`Missing source row: ${key}`);
const out = {
  schemaVersion: 2,
  source: {
    title: 'Super Smash Bros. Brawl frame data directory 2.0',
    sheet: 'Meta Knight**',
    url: 'https://docs.google.com/spreadsheets/d/1_5NFTe3dvxxC6MMlsI49mnC5m7D3_y5UoGZ7mxPje1I/edit?gid=481003737',
    retrieved: '2026-09-30',
    csv: 'reference/brawl-mk-source.csv',
    sha256: createHash('sha256').update(bytes).digest('hex'),
  },
  conventions: {
    frames:
      'Source strings use one-based move frames. FAF means the first actionable frame, not the last recovery frame.',
    blank: 'Unknown or not applicable; never converted to zero.',
    footnotes:
      'Asterisks and question marks retained. CSV excludes cell comments; ambiguous values require the original sheet.',
    scope: 'Community measurements, not independent remeasurement. Full glide physics are not supplied.',
  },
  attributes,
  moves,
};
writeFileSync('reference/brawl-mk.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Imported ${Object.keys(moves).length} source moves and ${Object.keys(attributes).length} attributes.`);
