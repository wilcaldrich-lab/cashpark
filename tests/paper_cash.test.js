const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
  document: {
    addEventListener() {},
    getElementById() { return null; },
    createElement() { return {}; },
    head: { appendChild() {} },
  },
  fetch: async () => { throw new Error('network not used'); },
  Number, String, Date, Math, Array, JSON,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/site.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/paper-cash.js'), 'utf8'), sandbox);

const {
  pcParseSerial, pcDecodeSerial, pcFancyPatterns, pcPickTopRates, pcInterestForMonths,
  pcNoteCount, pcStashSummary, pcLifespanFor, pcConditionAdvice, pcSeriesOptions,
} = sandbox;
const live = JSON.parse(fs.readFileSync(path.join(root, 'data/rates.json'), 'utf8'));
const keys = (arr) => Array.from(arr).map((p) => p.key + ':' + p.label);
const hasFact = (res, kind, re) => res.facts.some((f) => f.kind === kind && re.test(f.text));

test('parses two-letter, one-letter, and star serials, ignoring spaces, hyphens, and the star glyph', () => {
  const a = pcParseSerial('MB 12345678-A');
  assert.equal(a.ok, true); assert.equal(a.format, 'two');
  assert.equal(a.seriesLetter, 'M'); assert.equal(a.districtLetter, 'B');
  assert.equal(a.digits, '12345678'); assert.equal(a.suffix, 'A'); assert.equal(a.star, false);
  const b = pcParseSerial('b12345678\u2605');
  assert.equal(b.ok, true); assert.equal(b.format, 'one'); assert.equal(b.districtLetter, 'B');
  assert.equal(b.star, true); assert.equal(b.suffix, '*');
  const c = pcParseSerial('LL00000001*');
  assert.equal(c.ok, true); assert.equal(c.star, true); assert.equal(c.format, 'two');
});

test('rejects malformed serials with a message and never throws', () => {
  for (const bad of ['', '   ', 'MB1234567A', 'MB123456789A', '12345678', 'MBX12345678A', null, undefined, 'MB12345678**']) {
    const r = pcDecodeSerial(bad, '$20', '2013');
    assert.equal(r.ok, false, String(bad));
    assert.ok(r.error && r.error.length > 10);
  }
});

test('decodes the Federal Reserve Bank for all twelve letters', () => {
  const names = ['Boston','New York','Philadelphia','Cleveland','Richmond','Atlanta','Chicago','St. Louis','Minneapolis','Kansas City','Dallas','San Francisco'];
  'ABCDEFGHIJKL'.split('').forEach((l, i) => {
    const r = pcDecodeSerial('M' + l + '12345678A', '$20', '2013');
    assert.equal(r.district.name, names[i]);
    assert.equal(r.district.number, i + 1);
  });
});

test('flags a bank letter outside A-L, and the letters O and Z', () => {
  assert.ok(hasFact(pcDecodeSerial('AM12345678B', '$20', ''), 'warn', /A through L/));
  assert.ok(hasFact(pcDecodeSerial('MO12345678A', '$20', ''), 'warn', /letter O/));
  assert.ok(hasFact(pcDecodeSerial('MB12345678Z', '$20', ''), 'warn', /letter Z/));
});

test('checks the series letter against the BEP first-prefix table', () => {
  // BEP: $20 Series 2013 = M; $20 Series 2017A = P; $100 Series 2021 = Q
  assert.ok(hasFact(pcDecodeSerial('MB12344321A', '$20', '2013'), 'ok', /matches what BEP lists for a \$20 Series 2013/));
  const bad = pcDecodeSerial('NB12344321A', '$20', '2017A');
  assert.ok(hasFact(bad, 'warn', /BEP lists P as the first prefix for a \$20 Series 2017A, not N/));
  assert.ok(hasFact(pcDecodeSerial('QL12345678A', '$100', '2021'), 'ok', /Series 2021/));
  assert.ok(hasFact(pcDecodeSerial('MB12345678A', '$50', '2017A'), 'warn', /BEP lists P as the first prefix for a \$50 Series 2017A, not M/));
  // a combination with no BEP row says so instead of guessing ($5 2017 has no row in the BEP table)
  assert.ok(hasFact(pcDecodeSerial('NB12345678A', '$5', '2017'), 'warn', /no row for a \$5 Series 2017/));
  // a letter not in the table
  assert.ok(hasFact(pcDecodeSerial('ZB12345678A', '', ''), 'warn', /not in BEP/));
});

test('letter H lists both $5 and $100 Series 2006, as BEP publishes it', () => {
  const r = pcDecodeSerial('HB12345678A', '', '');
  assert.ok(hasFact(r, 'info', /\$5 Series 2006/));
  assert.ok(hasFact(r, 'info', /\$100 Series 2006/));
});

test('star notes are called out and no value is claimed', () => {
  const r = pcDecodeSerial('LL00000001*', '$1', '');
  assert.equal(r.parsed.star, true);
  assert.ok(hasFact(r, 'ok', /Star note/));
  assert.ok(hasFact(r, 'info', /does not set a value/));
  assert.equal(r.facts.some((f) => /\$\s?\d[\d,]*\s*(value|worth)|worth \$/.test(f.text)), false);
  const plain = pcDecodeSerial('MB12345678A', '$20', '2013');
  assert.equal(plain.facts.some((f) => /Star note/.test(f.text)), false);
});

test('one-letter serials are described as the older form', () => {
  const r = pcDecodeSerial('B12345678A', '$20', '');
  assert.equal(r.parsed.format, 'one');
  assert.ok(hasFact(r, 'info', /pre-Series 1996/));
  const one = pcDecodeSerial('B12345678A', '$1', '');
  assert.equal(one.facts.some((f) => /pre-Series 1996/.test(f.text)), false);
});

test('flags the BEP $1/$2 inconsistency instead of resolving it', () => {
  assert.ok(hasFact(pcDecodeSerial('QB12345678A', '$1', '2021'), 'flag', /does not settle/));
});

test('fancy patterns: sample serial digits', () => {
  assert.deepEqual(keys(pcFancyPatterns('12344321')), ['radar:Radar']);
  assert.deepEqual(keys(pcFancyPatterns('12341234')), ['repeater:Repeater']);
  assert.deepEqual(keys(pcFancyPatterns('12345678')), ['ladder:Ladder (ascending)']);
  assert.deepEqual(keys(pcFancyPatterns('87654321')), ['ladder:Ladder (descending)']);
  assert.deepEqual(keys(pcFancyPatterns('01234567')), ['ladder:Ladder (ascending)']);
  assert.deepEqual(keys(pcFancyPatterns('33333333')), ['solid:Solid', 'radar:Radar', 'repeater:Repeater']);
  assert.deepEqual(keys(pcFancyPatterns('11111111')), ['solid:Solid', 'radar:Radar', 'repeater:Repeater', 'binary:Binary']);
  assert.deepEqual(keys(pcFancyPatterns('10011001')), ['radar:Radar', 'repeater:Repeater', 'binary:Binary']);
  assert.deepEqual(keys(pcFancyPatterns('00000001')), ['binary:Binary', 'low:Low serial']);
  assert.deepEqual(keys(pcFancyPatterns('00000100')), ['binary:Binary', 'low:Low serial']);
  assert.deepEqual(keys(pcFancyPatterns('00000050')), ['low:Low serial']);
  assert.deepEqual(keys(pcFancyPatterns('00000101')), ['binary:Binary']);
  assert.deepEqual(keys(pcFancyPatterns('48271936')), []);
  assert.deepEqual(keys(pcFancyPatterns('1234')), []);
  assert.deepEqual(keys(pcFancyPatterns(undefined)), []);
});

test('series options come from the BEP table (Series 1996 through 2025)', () => {
  const o = pcSeriesOptions();
  assert.equal(o[0], '1996'); assert.equal(o[o.length - 1], '2025');
  assert.ok(o.includes('2017A') && o.includes('2003A') && o.includes('2009A'));
});

test('stash interest math (simple interest, rounded to cents)', () => {
  assert.equal(pcInterestForMonths(10000, 4.25, 12), 425);
  assert.equal(pcInterestForMonths(5000, 4.59, 6), 114.75);
  assert.equal(pcInterestForMonths(137, 3.25, 24), 8.91); // half-cent edge: float math gives 8.90
  assert.equal(pcInterestForMonths(364, 4.25, 6), 7.74);
  assert.equal(pcInterestForMonths(364, 4.25, 12), 15.47);
  assert.equal(pcInterestForMonths(1000, 0.39, 3), 0.98); // 0.975 rounds to 0.98
  assert.equal(pcInterestForMonths(1000, 0, 12), 0);
  assert.equal(pcInterestForMonths('abc', 4, 12), null);
  assert.equal(pcInterestForMonths(1000, 4, -1), null);
  assert.equal(pcInterestForMonths(-5, 4, 12), null);
});

test('note count and weight use 1 gram per note and 454 grams per pound', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(pcNoteCount(5000, '$100'))), { notes: 50, grams: 50, pounds: 0.11 });
  assert.deepEqual(JSON.parse(JSON.stringify(pcNoteCount(364, '$20'))), { notes: 19, grams: 19, pounds: 0.04 });
  assert.deepEqual(JSON.parse(JSON.stringify(pcNoteCount(45400, '$1'))), { notes: 45400, grams: 45400, pounds: 100 });
  assert.equal(pcNoteCount('x', '$20'), null);
  assert.equal(pcNoteCount(100, 'x'), null);
});

test('top rates are picked from the live rates file', () => {
  const rows = pcPickTopRates(live);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  const expectHy = Math.max(...live.hysa.filter((r) => !/national/i.test(r.metric + ' ' + r.name)).map((r) => r.rate_pct));
  const expectMm = Math.max(...live.money_market_funds.map((r) => r.rate_pct));
  const expectTb = Math.max(...live.tbills_daily.map((r) => r.coupon_equivalent_yield_pct));
  assert.equal(by.hysa.rate, expectHy);
  assert.equal(by.mmf.rate, expectMm);
  assert.equal(by.tbill.rate, expectTb);
  assert.match(by.national.name, /FDIC national average/);
  assert.equal(by.national.rate, live.hysa.find((r) => /national/i.test(r.metric)).rate_pct);
  for (const r of rows) { assert.ok(Number.isFinite(r.rate)); assert.ok(r.url && r.src && r.as_of); }
});

test('stash summary: cash earns zero, other rows match the interest function, large piles are flagged', () => {
  const rates = pcPickTopRates(live);
  const s = pcStashSummary(5000, 12, '$20', rates);
  assert.equal(s.rows[0].key, 'cash'); assert.equal(s.rows[0].interest, 0);
  for (const row of s.rows.slice(1)) {
    assert.equal(row.interest, pcInterestForMonths(5000, row.rate, 12));
    assert.equal(row.perMonth, Math.round((row.interest / 12) * 100) / 100);
  }
  assert.equal(s.notes.notes, 250);
  assert.equal(s.large, false);
  assert.equal(pcStashSummary(10000, 12, '$100', rates).large, true);
  assert.equal(pcStashSummary(0, 12, '$20', rates).rows[1].interest, 0);
  assert.equal(pcStashSummary(5000, 0, '$20', rates), null);
  assert.equal(pcStashSummary('x', 12, '$20', rates), null);
  // empty rates file does not throw
  assert.equal(pcStashSummary(100, 12, '$20', pcPickTopRates({})).rows.length, 1);
});

test('lifespans match the Federal Reserve table; $2 has none', () => {
  const want = { '$1': 7.2, '$5': 5.8, '$10': 5.7, '$20': 11.1, '$50': 14.9, '$100': 24.0 };
  for (const [d, y] of Object.entries(want)) assert.equal(pcLifespanFor(d).years, y);
  assert.equal(pcLifespanFor('$2').years, null);
  assert.match(pcLifespanFor('$2').text, /does not publish/);
});

test('condition advice covers every state and keeps BEP and Fed wording straight', () => {
  for (const k of ['crisp', 'worn', 'torn', 'mutilated']) assert.ok(pcConditionAdvice(k).title);
  assert.match(pcConditionAdvice('mutilated').text, /6 to 36 months/);
  assert.match(pcConditionAdvice('mutilated').text, /not to the Federal Reserve/);
  assert.match(pcConditionAdvice('worn').text, /commercial financial institution/);
  assert.equal(pcConditionAdvice('nope'), null);
});
