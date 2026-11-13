(function () {
  var id = 'G-Y2R28WTX2X';
  if (window.__cashparkGtagLoaded) return;
  window.__cashparkGtagLoaded = true;
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', id);
})();

async function loadRates(){
  const res = await fetch('data/rates.json', {cache:'no-store'});
  if(!res.ok) throw new Error('Could not load rates.json');
  return res.json();
}
function finiteNumber(n){
  if(n==null || n==='') return null;
  const x=Number(n);
  return Number.isFinite(x) ? x : null;
}
function money(n){
  const x=finiteNumber(n);
  return x==null ? '—' : x.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
}
function money2(n){
  const x=finiteNumber(n);
  return x==null ? '—' : x.toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
}
// Simple annual interest: principal times the published percent.
// Rounded to cents so binary fractions do not show up as junk.
function annualSimpleInterest(amount, ratePct){
  const a=finiteNumber(amount);
  const r=finiteNumber(ratePct);
  if(a==null || r==null) return null;
  return Math.round((a * r / 100) * 100) / 100;
}
function sortByRateDesc(rows, pick){
  const get=typeof pick==='function' ? pick : function(row){ return row[pick||'rate']; };
  return rows.slice().sort(function(a,b){
    const av=finiteNumber(get(a));
    const bv=finiteNumber(get(b));
    return (bv==null ? -Infinity : bv) - (av==null ? -Infinity : av);
  });
}
function pct(n){
  const x=finiteNumber(n);
  if(x==null) return '—';
  // Keep a third decimal when the source has one (auction investment rates).
  // Two-decimal quotes stay two decimals: 3.9 -> 3.90, 4.64 -> 4.64.
  let s=(Math.round((x + Number.EPSILON) * 1000) / 1000).toFixed(3);
  if(s.endsWith('0')) s=s.slice(0, -1);
  return s+'%';
}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function link(url,label){
  if(!url) return '—';
  return `<a href="${esc(url)}" rel="noopener noreferrer" target="_blank">${esc(label)||'source'}</a>`;
}
function rowHTML(cells){
  return `<tr>${cells.map(c=>{
    if(c==null || c==='') return '<td>—</td>';
    return `<td>${c}</td>`;
  }).join('')}</tr>`;
}
function rateCell(n, metric){
  const shown=pct(n);
  if(shown==='—') return '—';
  return '<span class="rate">'+shown+'</span>'+(metric ? '<span class="badge">'+esc(metric)+'</span>' : '');
}
// Rank and compare T-bills on the coupon-equivalent yield only.
// A bank discount is a different number and is not presented as that yield.
function tbillCouponYield(r){
  const n=finiteNumber(r && r.coupon_equivalent_yield_pct);
  return n==null ? null : {n, metric:'coupon equiv. yield'};
}
function tbillNumber(r){
  const coupon=tbillCouponYield(r);
  if(coupon) return coupon;
  const discount=finiteNumber(r && r.discount_pct);
  if(discount!=null) return {n:discount, metric:'bank discount'};
  return {n:null, metric:''};
}
function tbillScoreboardRow(r){
  const coupon=tbillCouponYield(r);
  if(!coupon) return null;
  return {cat:'T-bill (daily)', name:r.term||'—', rate:coupon.n, metric:coupon.metric, as_of:r.as_of||'—', url:r.source_url, src:r.source_name};
}
function tbillCalculatorOption(r){
  const coupon=tbillCouponYield(r);
  if(!coupon) return null;
  return {label:'T-bill '+(r.term||''), rate:coupon.n, metric:coupon.metric, as_of:r.as_of||'—', url:r.source_url};
}
function tbillDailyCells(r){
  return [
    esc((r && r.term) || '—'),
    rateCell(r && r.coupon_equivalent_yield_pct),
    rateCell(r && r.discount_pct),
    esc((r && r.maturity) || '—'),
    esc((r && r.as_of) || '—'),
    link(r && r.source_url, r && r.source_name)
  ];
}
function fillTable(id, rows){
  const el=document.getElementById(id);
  if(!el) return;
  const table=el.closest ? el.closest('table') : null;
  const span=(table && table.querySelectorAll('thead th').length) || (rows[0] ? rows[0].length : 5) || 5;
  el.innerHTML = rows.length ? rows.map(rowHTML).join('') : '<tr><td colspan="'+span+'" class="empty">No verified rows in the rates file.</td></tr>';
}
function setActiveNav(){
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.links a').forEach(a=>{
    const href=(a.getAttribute('href')||'').split('/').pop();
    if(href===path) a.classList.add('active');
  });
  document.querySelectorAll('th:not([scope])').forEach(th=>th.setAttribute('scope','col'));
}
function mailerLiteSubscribeUrl(action, email){
  return action
    + '?fields%5Bemail%5D=' + encodeURIComponent(email)
    + '&ml-submit=1&anticsrf=true&ajax=1';
}
function mailerLiteResult(res){
  if(res && res.success){
    return {ok:true, text:'Thanks — check your inbox if confirmation is required. You’re on CashPark Weekly.'};
  }
  const err=(res && res.errors && res.errors.fields && res.errors.fields.email && res.errors.fields.email[0])
    || (res && res.message)
    || 'Could not subscribe. Try again.';
  return {ok:false, text:String(err)};
}
function bindWeeklySignup(form){
  form = form || document.getElementById('cashpark-ml-form');
  if(!form || form._cashparkBound) return;
  form._cashparkBound = true;
  const msg=document.getElementById('cashpark-ml-msg');
  form.addEventListener('submit', function(e){
    if(e && e.preventDefault) e.preventDefault();
    const emailInput=form.querySelector('input[name="fields[email]"]');
    const email=(emailInput && emailInput.value || '').trim();
    const btn=form.querySelector('button[type=submit]');
    if(msg){ msg.hidden=true; msg.className='msg'; }
    if(!email || email.indexOf('@')<1){
      if(msg){ msg.textContent='Please enter a valid email.'; msg.className='msg err'; msg.hidden=false; }
      return;
    }
    if(btn) btn.disabled=true;
    const doFetch=form._fetch || fetch;
    return doFetch(mailerLiteSubscribeUrl(form.action, email), {method:'GET', headers:{'Accept':'application/json'}})
      .then(function(res){
        if(!res.ok) throw new Error('HTTP '+res.status);
        return res.json();
      })
      .then(function(payload){
        const result=mailerLiteResult(payload);
        if(msg){ msg.textContent=result.text; msg.className='msg '+(result.ok?'ok':'err'); msg.hidden=false; }
        if(result.ok) form.reset();
      })
      .catch(function(){
        if(msg){ msg.textContent='Network error. Try again.'; msg.className='msg err'; msg.hidden=false; }
      })
      .then(function(){ if(btn) btn.disabled=false; });
  });
}
function boot(){
  setActiveNav();
  bindWeeklySignup();
}
document.addEventListener('DOMContentLoaded', boot);

async function refreshTBillsLive(data){
  // TreasuryDirect does not send Access-Control-Allow-Origin, and its records
  // use competitiveAuctionCloseDate rather than auctionDate. A browser fetch
  // fails and would also stamp a null date, so the page keeps the file.
  const el=document.getElementById('tbill-live-status');
  if(!el) return data;
  const daily=data && data.tbills_refreshed_at_et;
  el.textContent = daily
    ? 'Daily yields were refreshed from the Treasury XML feed at '+daily+'. Auction dates are the competitive close dates stored with those rows. This page does not re-fetch TreasuryDirect in the browser.'
    : 'Daily yields and auction rows are the Treasury snapshots stored in the rates file.';
  el.className='small muted';
  return data;
}
