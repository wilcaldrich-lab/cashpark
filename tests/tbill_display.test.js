const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
const sandbox = {
  document: {
    addEventListener() {},
    getElementById() { return null; },
    createElement() { return {}; },
    head: { appendChild() {} },
  },
  fetch: async () => { throw new Error('network not used'); },
  Number,
  String,
  Date,
};
sandbox.window = sandbox;
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

test('pct keeps a real third decimal and still pads two-decimal quotes', () => {
  assert.equal(pct(4.149), '4.149%');
  assert.equal(pct(3.976), '3.976%');
  assert.equal(pct(4.496), '4.496%');
  assert.equal(pct(3.955), '3.955%');
  assert.equal(pct(4.05), '4.05%');
  assert.equal(pct(4.3), '4.30%');
  assert.equal(pct(4.64), '4.64%');
  assert.equal(rateCell(4.149, 'investment rate').includes('4.149%'), true);
  assert.equal(rateCell(4.149).includes('4.15%'), false);
});

test('calculator simple interest matches a known $25,000 comparison', () => {
  const { annualSimpleInterest, money2, sortByRateDesc } = sandbox;
  assert.equal(annualSimpleInterest(25000, 0.01), 2.5);
  assert.equal(annualSimpleInterest(25000, 3.77), 942.5);
  assert.equal(Math.round((annualSimpleInterest(25000, 3.77) - annualSimpleInterest(25000, 0.01)) * 100) / 100, 940);
  assert.equal(annualSimpleInterest(100000, 4.05), 4050);
  assert.equal(annualSimpleInterest(25000, 3.3), 825);
  assert.equal(annualSimpleInterest(null, 3), null);
  assert.equal(annualSimpleInterest(100, 'nope'), null);
  assert.equal(money2(annualSimpleInterest(25000, 0.01)).includes('NaN'), false);
  assert.equal(money2(undefined), '—');
  const ranked = sortByRateDesc([
    {rate: null, name: 'missing'},
    {rate: 0.01, name: 'sweep'},
    {rate: 4.64, name: 'bill'},
  ], row => row.rate);
  assert.deepEqual(ranked.map(row => row.name), ['bill', 'sweep', 'missing']);
});

test('live auction investment rates are not rounded away', () => {
  for (const row of live.tbills_auctions) {
    assert.match(row.auction_date, /^\d{4}-\d{2}-\d{2}$/);
    const shown = rateCell(row.investment_rate_pct, 'investment rate');
    assert.equal(shown.includes('NaN'), false);
    assert.match(shown, new RegExp(Number(row.investment_rate_pct).toFixed(3).replace(/0$/, '').replace('.', '\\.')));
  }
});

test('MailerLite signup reads JSON and does not use JSONP', async () => {
  const { mailerLiteSubscribeUrl, mailerLiteResult, bindWeeklySignup } = sandbox;
  const url = mailerLiteSubscribeUrl('https://assets.mailerlite.com/jsonp/2706336/forms/1/subscribe', 'person@example.com');
  assert.equal(url.includes('callback='), false);
  assert.equal(url.includes('fields%5Bemail%5D=person%40example.com'), true);
  assert.equal(mailerLiteResult({success:false, errors:{fields:{email:['The email field must be a valid email address.']}}}).text,
    'The email field must be a valid email address.');
  assert.equal(mailerLiteResult({success:true}).ok, true);

  const messages = [];
  const form = {
    action: 'https://assets.mailerlite.com/jsonp/2706336/forms/1/subscribe',
    _fetch: async (requestUrl) => {
      assert.equal(String(requestUrl).includes('callback='), false);
      return {ok:true, json: async () => ({success:false, errors:{fields:{email:['The email field must be a valid email address.']}}})};
    },
    querySelector(sel){
      if (sel.includes('email')) return {value:'a@b'};
      if (sel.includes('button')) return {disabled:false};
      return null;
    },
    addEventListener(type, fn){ this._submit = fn; },
    reset(){ this.resetCalled = true; },
  };
  const msg = {hidden:true, className:'', textContent:''};
  const prev = sandbox.document.getElementById;
  sandbox.document.getElementById = (id) => id === 'cashpark-ml-msg' ? msg : null;
  bindWeeklySignup(form);
  await form._submit({preventDefault(){}});
  sandbox.document.getElementById = prev;
  assert.equal(msg.textContent, 'The email field must be a valid email address.');
  assert.equal(msg.className.includes('err'), true);
  assert.equal(messages.length, 0);
});

test('gtag snippet is injected once', () => {
  const scripts = [];
  const local = {
    document: {
      addEventListener() {},
      getElementById() { return null; },
      createElement() { return {}; },
      head: { appendChild(node){ scripts.push(node); } },
    },
    fetch: async () => { throw new Error('network not used'); },
    Number, String, Date,
  };
  local.window = local;
  vm.createContext(local);
  vm.runInContext(code, local);
  vm.runInContext(code, local);
  const gtag = scripts.filter(node => String(node.src || '').includes('googletagmanager.com/gtag/js?id=G-Y2R28WTX2X'));
  assert.equal(gtag.length, 1);
});
