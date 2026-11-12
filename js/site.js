(function () {
  var id = 'G-Y2R28WTX2X';
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
function money(n){return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0})}
function money2(n){return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2})}
function finiteNumber(n){
  if(n==null || n==='') return null;
  const x=Number(n);
  return Number.isFinite(x) ? x : null;
}
function pct(n){
  const x=finiteNumber(n);
  return x==null ? '—' : x.toFixed(2)+'%';
}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function link(url,label){return `<a href="${url}" rel="noopener noreferrer" target="_blank">${esc(label)||'source'}</a>`}
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
  el.innerHTML = rows.length ? rows.map(rowHTML).join('') : '<tr><td colspan="5" class="empty">No verified rows in the rates file.</td></tr>';
}
function setActiveNav(){
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.links a').forEach(a=>{
    const href=(a.getAttribute('href')||'').split('/').pop();
    if(href===path) a.classList.add('active');
  });
}
document.addEventListener('DOMContentLoaded', setActiveNav);

async function refreshTBillsLive(data){
  // TreasuryDirect JSON often lacks browser CORS; keep baked daily rates and stamp attempt.
  const el=document.getElementById('tbill-live-status');
  if(!el) return data;
  try{
    const url='https://www.treasurydirect.gov/TA_WS/securities/auctioned?format=json&type=Bill&days=30';
    const res=await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const auction=await res.json();
    const best={};
    for(const r of auction){
      const term=r.securityTerm; if(!term) continue;
      const ad=r.auctionDate||'';
      if(!best[term] || ad>(best[term].auctionDate||'')) best[term]=r;
    }
    data.tbills_auctions=Object.values(best).filter(r=>finiteNumber(r.investmentRate)!=null).map(r=>({
      term:r.securityTerm,
      investment_rate_pct:finiteNumber(r.investmentRate),
      high_discount_rate_pct:finiteNumber(r.highRate),
      auction_date:(r.auctionDate||'').slice(0,10)||null,
      maturity:(r.maturityDate||'').slice(0,10),
      cusip:r.cusip,
      source_name:'TreasuryDirect auctioned securities API (live browser fetch)',
      source_url:url,
    }));
    el.textContent='Auction table refreshed live from TreasuryDirect in this browser session.';
    el.className='small muted';
  }catch(e){
    el.textContent='Live auction refresh blocked or failed in-browser (likely CORS). Showing Treasury daily yields baked at build from the official XML feed.';
    el.className='small muted';
  }
  return data;
}
