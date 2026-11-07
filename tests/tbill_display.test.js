const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
const sandbox = {
  document: { addEventListener() {}, getElementById() { return null; } },
  fetch: async () => { throw new Error('network not used'); },
  Number,
  String,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { pct, rateCell, tbillNumber, tbillScoreboardRow, tbillCalculatorOption, tbillDailyCells, rowHTML } = sandbox;

const live = JSON.parse(fs.readFileSync(path.join(root, 'data/rates.json'), 'utf8'));

function rendered(cells) {
  return rowHTML(cells);
}

test('pct never prints NaN or undefined', () => {
  for (const value of [undefined, null, '', 'N/A', NaN, Infinity, -Infinity]) {
    const text = pct(value);
    assert.equal(text, '—');
    assert.equal(text.includes('NaN'), false);
    assert.equal(text.includes('undefined'), false);
  }
  assert.equal(pct(3.9), '3.90%');
  assert.equal(pct(0), '0.00%');
});

test('live daily rows do not render NaN on the scoreboard or T-bill table', () => {
  assert.ok(Array.isArray(live.tbills_daily) && live.tbills_daily.length > 0);
  for (const row of live.tbills_daily) {
    const score = tbillScoreboardRow(row);
    const cells = rendered(tbillDailyCells(row));
    assert.equal(cells.includes('NaN'), false);
    assert.equal(cells.includes('undefined'), false);
    if (row.coupon_equivalent_yield_pct == null) {
      assert.equal(score, null);
      assert.equal(tbillCalculatorOption(row), null);
      assert.match(cells, /—/);
    } else {
      assert.equal(score.metric, 'coupon equiv. yield');
      assert.equal(score.rate, row.coupon_equivalent_yield_pct);
      assert.equal(String(score.metric).toLowerCase().includes('discount'), false);
    }
    const shown = tbillNumber(row);
    if (shown.n != null) {
      assert.equal(Number.isFinite(shown.n), true);
      if (shown.metric === 'bank discount') {
        assert.equal(row.coupon_equivalent_yield_pct == null, true);
      }
    }
  }
});

test('discount-only row is labeled bank discount and is omitted from yield rankings', () => {
  const row = {
    term: '4-Week',
    as_of: '2026-11-05',
    discount_pct: 3.89,
    metric: 'Coupon equivalent yield (bank discount also shown)',
    source_name: 'U.S. Treasury Daily Treasury Bill Rates',
    source_url: 'https://home.treasury.gov/example',
  };
  assert.equal(tbillScoreboardRow(row), null);
  assert.equal(tbillCalculatorOption(row), null);
  const shown = tbillNumber(row);
  assert.equal(shown.n, 3.89);
  assert.equal(shown.metric, 'bank discount');
  const cells = rendered(tbillDailyCells(row));
  assert.match(cells, /3\.89%/);
  assert.equal(cells.includes('NaN'), false);
  assert.equal(cells.includes('undefined'), false);
  assert.equal(cells.includes('coupon equiv'), false);
});

test('missing both yields renders dashes', () => {
  const row = { term: '4-Week', as_of: '2026-11-05', source_url: 'https://example.test', source_name: 'Treasury' };
  const cells = rendered(tbillDailyCells(row));
  assert.equal(cells.includes('NaN'), false);
  assert.equal(cells.includes('%'), false);
  assert.match(cells, /—/);
  assert.equal(rateCell(undefined), '—');
});

test('coupon equivalent is not replaced by the discount', () => {
  const row = {
    term: '4-Week',
    as_of: '2026-11-06',
    coupon_equivalent_yield_pct: 3.95,
    discount_pct: 3.88,
    rate_pct: 3.95,
    maturity: '2026-12-08',
    source_url: 'https://example.test',
    source_name: 'Treasury',
  };
  const score = tbillScoreboardRow(row);
  assert.equal(score.rate, 3.95);
  assert.equal(score.metric, 'coupon equiv. yield');
  const cells = rendered(tbillDailyCells(row));
  assert.match(cells, /3\.95%/);
  assert.match(cells, /3\.88%/);
  assert.match(cells, /2026-12-08/);
});
