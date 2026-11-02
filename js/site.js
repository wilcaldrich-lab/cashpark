async function loadRates(){
  const res = await fetch('data/rates.json', {cache:'no-store'});
  if(!res.ok) throw new Error('Could not load rates.json');
  return res.json();
}
function money(n){return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0})}
function money2(n){return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2})}
function pct(n){return (Number(n)).toFixed(2)+'%'}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function link(url,label){return `<a href="${url}" rel="noopener noreferrer" target="_blank">${esc(label)||'source'}</a>`}
function rowHTML(cells){return `<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`}
function rateCell(n, metric){
  if(n==null || n==='') return '—';
  return '<span class="rate">'+pct(n)+'</span><span class="badge">'+esc(metric||'')+'</span>';
}
function tbillNumber(r){
  if(r.coupon_equivalent_yield_pct!=null) return {n:r.coupon_equivalent_yield_pct, metric:'coupon equiv. yield'};
  if(r.rate_pct!=null) return {n:r.rate_pct, metric:r.metric||''};
  if(r.discount_pct!=null) return {n:r.discount_pct, metric:'bank discount'};
  return {n:null, metric:''};
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
    data.tbills_auctions=Object.values(best).filter(r=>r.investmentRate!=null).map(r=>({
      term:r.securityTerm,
      investment_rate_pct:Number(r.investmentRate),
      high_discount_rate_pct:r.highRate!=null && r.highRate!==''?Number(r.highRate):null,
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
