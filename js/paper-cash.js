/* Paper Cash: serial-number decoder, stash calculator, and bill lifespan/condition guide.
   Loaded after js/site.js (uses finiteNumber, esc, link, money2, pct, sortByRateDesc, tbillCouponYield).
   Sources are cited on the pages. Series/prefix table: Bureau of Engraving and Printing, "Serial Numbers"
   (https://www.bep.gov/currency/serial-numbers/), copied as published, duplicates removed, checked Nov 25, 2026. */

// [denomination, series, first prefix letter (null = no series prefix letter), signers]
var PC_SERIES_PREFIX = [
  ["$20", "1996", "A", "Rubin/Withrow"],
  ["$50", "1996", "A", "Rubin/Withrow"],
  ["$100", "1996", "A", "Rubin/Withrow"],
  ["$1", "1999", null, "Summers/Withrow"],
  ["$5", "1999", "B", "Summers/Withrow"],
  ["$10", "1999", "B", "Summers/Withrow"],
  ["$20", "1999", "B", "Summers/Withrow"],
  ["$100", "1999", "B", "Summers/Withrow"],
  ["$1", "2001", null, "O'Neil/Marin"],
  ["$5", "2001", "C", "O'Neil/Marin"],
  ["$10", "2001", "C", "O'Neil/Marin"],
  ["$20", "2001", "C", "O'Neil/Marin"],
  ["$50", "2001", "C", "O'Neil/Marin"],
  ["$100", "2001", "C", "O'Neil/Marin"],
  ["$1", "2003", null, "Snow/Marin"],
  ["$2", "2003", null, "Snow/Marin"],
  ["$10", "2003", "D", "Snow/Marin"],
  ["$100", "2003", "D", "Snow/Marin"],
  ["$1", "2003A", null, "Snow/Cabral"],
  ["$2", "2003A", null, "Snow/Cabral"],
  ["$5", "2003A", "F", "Snow/Cabral"],
  ["$100", "2003A", "F", "Snow/Cabral"],
  ["$20", "2004", "E", "Snow/Marin"],
  ["$50", "2004", "E", "Snow/Marin"],
  ["$10", "2004A", "G", "Snow/Cabral"],
  ["$20", "2004A", "G", "Snow/Cabral"],
  ["$50", "2004A", "G", "Snow/Cabral"],
  ["$5", "2006", "H", "Paulson/Cabral"],
  ["$100", "2006", "H", "Paulson/Cabral"],
  ["$100", "2006A", "K", "Paulson/Cabral"],
  ["$20", "2006", "I", "Paulson/Cabral"],
  ["$1", "2006", null, "Paulson/Cabral"],
  ["$5", "2006", "I", "Paulson/Cabral"],
  ["$10", "2006", "I", "Paulson/Cabral"],
  ["$50", "2006", "I", "Paulson/Cabral"],
  ["$1", "2009", null, "Geithner/Rios"],
  ["$2", "2009", null, "Geithner/Rios"],
  ["$10", "2009", "J", "Geithner/Rios"],
  ["$20", "2009", "J", "Geithner/Rios"],
  ["$50", "2009", "J", "Geithner/Rios"],
  ["$100", "2009", "J", "Geithner/Rios"],
  ["$100", "2009A", "L", "Geithner/Rios"],
  ["$1", "2013", null, "Lew/Rios"],
  ["$5", "2013", "M", "Lew/Rios"],
  ["$10", "2013", "M", "Lew/Rios"],
  ["$20", "2013", "M", "Lew/Rios"],
  ["$50", "2013", "M", "Lew/Rios"],
  ["$100", "2013", "M", "Lew/Rios"],
  ["$1", "2017", null, "Mnuchin/Carranza"],
  ["$10", "2017", "N", "Mnuchin/Carranza"],
  ["$20", "2017", "N", "Mnuchin/Carranza"],
  ["$2", "2017A", "P", "Mnuchin/Carranza"],
  ["$5", "2017A", "P", "Mnuchin/Carranza"],
  ["$10", "2017A", "P", "Mnuchin/Carranza"],
  ["$20", "2017A", "P", "Mnuchin/Carranza"],
  ["$50", "2017A", "P", "Mnuchin/Carranza"],
  ["$100", "2017A", "P", "Mnuchin/Carranza"],
  ["$1", "2021", "Q", "Yellen/Malerba"],
  ["$2", "2021", "Q", "Yellen/Malerba"],
  ["$5", "2021", "Q", "Yellen/Malerba"],
  ["$10", "2021", "Q", "Yellen/Malerba"],
  ["$20", "2021", "Q", "Yellen/Malerba"],
  ["$50", "2021", "Q", "Yellen/Malerba"],
  ["$100", "2021", "Q", "Yellen/Malerba"],
  ["$1", "2025", "R", "Trump/Bessent"],
  ["$5", "2025", "R", "Trump/Bessent"],
  ["$10", "2025", "R", "Trump/Bessent"],
  ["$20", "2025", "R", "Trump/Bessent"],
  ["$100", "2025", "R", "Trump/Bessent"]
];

// Federal Reserve Banks: letter, district number, name (BEP "Serial Numbers" page)
var PC_DISTRICTS = [
  ['A',1,'Boston'],['B',2,'New York'],['C',3,'Philadelphia'],['D',4,'Cleveland'],
  ['E',5,'Richmond'],['F',6,'Atlanta'],['G',7,'Chicago'],['H',8,'St. Louis'],
  ['I',9,'Minneapolis'],['J',10,'Kansas City'],['K',11,'Dallas'],['L',12,'San Francisco']
];

// Average lifespan in years, estimates as of May 2025 (Federal Reserve / U.S. Currency Education Program).
// No lifespan is published for the $2 note.
var PC_LIFESPAN = {'$1':7.2,'$5':5.8,'$10':5.7,'$20':11.1,'$50':14.9,'$100':24.0};

// Notes in circulation, billions, Dec 31, 2025 (Federal Reserve "Currency in Circulation: Volume").
var PC_VOLUME_2025 = {'$1':15.2,'$2':1.8,'$5':3.7,'$10':2.4,'$20':11.0,'$50':2.5,'$100':19.9};
// Value in circulation, $ billions, Dec 31, 2025 (Federal Reserve "Currency in Circulation: Value").
var PC_VALUE_2025 = {'$1':15.2,'$2':3.6,'$5':18.7,'$10':24.4,'$20':220.4,'$50':123.5,'$100':1988.8,'$500 to $10,000':0.3};

function pcDenomValue(d){ var n=Number(String(d||'').replace(/[^0-9.]/g,'')); return Number.isFinite(n) && n>0 ? n : null; }

/* ---------- Serial number decoder ---------- */
function pcNormalizeSerial(raw){
  return String(raw==null ? '' : raw).toUpperCase().replace(/[\s\-_.]/g,'').replace(/[\u2605\u2606\u2217\u2731]/g,'*');
}
function pcParseSerial(raw){
  var s=pcNormalizeSerial(raw);
  if(!s) return {ok:false, error:'Type the serial number exactly as printed on the front of the note.'};
  var m=/^([A-Z]{2})(\d{8})([A-Z*])$/.exec(s);
  if(m) return {ok:true, normalized:s, format:'two', seriesLetter:m[1].charAt(0), districtLetter:m[1].charAt(1), digits:m[2], suffix:m[3], star:m[3]==='*'};
  m=/^([A-Z])(\d{8})([A-Z*])$/.exec(s);
  if(m) return {ok:true, normalized:s, format:'one', seriesLetter:null, districtLetter:m[1], digits:m[2], suffix:m[3], star:m[3]==='*'};
  return {ok:false, error:'That does not look like a Federal Reserve note serial. Expected one or two letters, eight digits, then a letter or a star (for example MB12345678A or B12345678*).'};
}
function pcDistrict(letter){
  for(var i=0;i<PC_DISTRICTS.length;i++){ if(PC_DISTRICTS[i][0]===letter) return {letter:PC_DISTRICTS[i][0], number:PC_DISTRICTS[i][1], name:PC_DISTRICTS[i][2]}; }
  return null;
}
// Collector-convention patterns on the eight digits. Not official BEP or Federal Reserve classifications.
function pcFancyPatterns(digits){
  var out=[];
  if(!/^\d{8}$/.test(digits||'')) return out;
  var rev=digits.split('').reverse().join('');
  var allSame=/^(\d)\1{7}$/.test(digits);
  if(allSame) out.push({key:'solid', label:'Solid', note:'All eight digits are the same.'});
  if(digits===rev) out.push({key:'radar', label:'Radar', note:'The digits read the same forward and backward.'});
  if(digits.slice(0,4)===digits.slice(4)) out.push({key:'repeater', label:'Repeater', note:'The first four digits repeat as the last four.'});
  var asc=true, desc=true;
  for(var i=1;i<8;i++){
    if(Number(digits[i])!==Number(digits[i-1])+1) asc=false;
    if(Number(digits[i])!==Number(digits[i-1])-1) desc=false;
  }
  if(asc) out.push({key:'ladder', label:'Ladder (ascending)', note:'Eight digits climbing by one each step.'});
  if(desc) out.push({key:'ladder', label:'Ladder (descending)', note:'Eight digits falling by one each step.'});
  if(/^[01]{8}$/.test(digits)) out.push({key:'binary', label:'Binary', note:'Only the digits 0 and 1.'});
  var n=Number(digits);
  if(n<=100) out.push({key:'low', label:'Low serial', note:'The number is 100 or less. Collectors use different cutoffs, from the first few notes up to about 1,000.'});
  return out;
}
function pcSeriesOptions(){
  var seen={}, list=[];
  PC_SERIES_PREFIX.forEach(function(r){ if(!seen[r[1]]){ seen[r[1]]=true; list.push(r[1]); } });
  return list;
}
function pcPrefixRowsForLetter(letter, denom){
  return PC_SERIES_PREFIX.filter(function(r){ return r[2]===letter && (!denom || r[0]===denom); });
}
function pcPrefixRowsForSeries(denom, series){
  return PC_SERIES_PREFIX.filter(function(r){ return r[0]===denom && r[1]===series; });
}
// Returns {ok, error?, parsed?, facts:[{kind,text}], patterns:[...]}.
// kind: 'info' | 'ok' | 'warn' | 'flag'
function pcDecodeSerial(raw, denom, series){
  var p=pcParseSerial(raw);
  if(!p.ok) return {ok:false, error:p.error, facts:[], patterns:[]};
  var facts=[], dnum=pcDenomValue(denom);
  var letters=(p.seriesLetter||'')+p.districtLetter+(p.suffix==='*'?'':p.suffix);
  if(/O/.test(letters)) facts.push({kind:'warn', text:'BEP does not use the letter O in serial numbers because it looks like zero. Check whether the character is really a zero.'});
  if(/Z/.test(letters)) facts.push({kind:'warn', text:'BEP says the letter Z is not used on regular notes because it is reserved for test printings. Check the letter.'});
  var dist=pcDistrict(p.districtLetter);
  if(!dist){
    facts.push({kind:'warn', text:'The Federal Reserve Bank letter should be A through L. "'+p.districtLetter+'" is not one of the 12 bank letters, so recheck the serial.'});
  } else {
    facts.push({kind:'info', text:'Issuing Federal Reserve Bank: '+dist.name+' (letter '+dist.letter+', district '+dist.number+'). The seal on the front should show the same letter and the number '+dist.number+'.'});
  }
  if(p.format==='two'){
    facts.push({kind:'info', text:'Two-letter prefix (Series 1996 and later style): the first letter ('+p.seriesLetter+') marks the series and the second ('+p.districtLetter+') marks the issuing bank.'});
    var rows=pcPrefixRowsForLetter(p.seriesLetter, dnum?('$'+dnum):null);
    var allRows=pcPrefixRowsForLetter(p.seriesLetter, null);
    if(allRows.length){
      var txt=allRows.map(function(r){ return r[0]+' Series '+r[1]; }).join(', ');
      facts.push({kind:'info', text:'BEP\u2019s table lists series letter '+p.seriesLetter+' as the first prefix for: '+txt+'.'});
    } else {
      facts.push({kind:'warn', text:'Series letter '+p.seriesLetter+' is not in BEP\u2019s first-prefix table, so this tool cannot tie it to a series year.'});
    }
    if(dnum && series){
      var want=pcPrefixRowsForSeries('$'+dnum, series);
      if(!want.length){
        facts.push({kind:'warn', text:'BEP\u2019s table has no row for a $'+dnum+' Series '+series+'. The combination may not exist, or the table may not list it yet, so check the series year printed on the note.'});
      } else {
        var letters2=want.map(function(r){ return r[2]; }).filter(function(x){ return x; });
        var uniq=letters2.filter(function(x,i){ return letters2.indexOf(x)===i; });
        if(uniq.indexOf(p.seriesLetter)>=0) facts.push({kind:'ok', text:'The series letter '+p.seriesLetter+' matches what BEP lists for a $'+dnum+' Series '+series+'.'});
        else facts.push({kind:'warn', text:'BEP lists '+uniq.join(' or ')+' as the first prefix for a $'+dnum+' Series '+series+', not '+p.seriesLetter+'. Recheck the series year and the serial. (BEP\u2019s table shows first prefixes only.)'});
      }
    }
    if(dnum===1 || dnum===2) facts.push({kind:'flag', text:'BEP\u2019s text says only the $1 and $2 notes still use the one-letter form, yet its series table lists a prefix letter for Series 2021 $1 and $2 notes. cashscoreboard.com decodes what you type and does not settle that difference. Check BEP\u2019s page if it matters.'});
  } else {
    facts.push({kind:'info', text:'One-letter prefix: the letter ('+p.districtLetter+') marks the issuing bank. BEP says all Federal Reserve notes used this form through Series 1995, and that now only the $1 and $2 notes do.'});
    if(dnum && dnum>=5) facts.push({kind:'info', text:'On a $'+dnum+' note this is the pre-Series 1996 style. This tool\u2019s series table starts at Series 1996, so it will not match a series year for older notes.'});
  }
  if(p.star){
    facts.push({kind:'ok', text:'Star note. A star takes the place of the suffix letter on a replacement note. BEP says a sheet found imperfect after the serial numbers were printed is replaced with a star sheet, and a star note has its own special serial number.'});
    facts.push({kind:'info', text:'A star on its own does not set a value. Collectors look at how many notes were in that star run, which BEP\u2019s monthly production reports list by denomination, series, and bank. This tool does not look up print runs yet.'});
  } else {
    facts.push({kind:'info', text:'Suffix letter '+p.suffix+'. BEP says the suffix moves through the alphabet once all eight-digit numbers are used for a bank in a series, then returns to A at a series change.'});
  }
  var pats=pcFancyPatterns(p.digits);
  return {ok:true, parsed:p, facts:facts, patterns:pats, district:dist};
}

/* ---------- Cash stash calculator ---------- */
function pcPickTopRates(data){
  var rows=[];
  var hy=(data.hysa||[]).filter(function(r){ return finiteNumber(r.rate_pct)!=null && !/national/i.test((r.metric||'')+' '+(r.name||'')); });
  var topHy=sortByRateDesc(hy, function(r){ return r.rate_pct; })[0];
  if(topHy) rows.push({key:'hysa', label:'Top savings rate in the cashscoreboard.com file', name:topHy.name, rate:finiteNumber(topHy.rate_pct), metric:topHy.metric, as_of:topHy.as_of, url:topHy.source_url, src:topHy.source_name, cover:'Bank deposit account (FDIC flag in the rates file: '+(topHy.fdic?'yes':'no')+')'});
  var mm=(data.money_market_funds||[]).filter(function(r){ return finiteNumber(r.rate_pct)!=null; });
  var topMm=sortByRateDesc(mm, function(r){ return r.rate_pct; })[0];
  if(topMm) rows.push({key:'mmf', label:'Top money market fund', name:topMm.ticker+' \u2014 '+topMm.name, rate:finiteNumber(topMm.rate_pct), metric:topMm.metric, as_of:topMm.as_of, url:topMm.source_url, src:topMm.source_name, cover:'Not a bank deposit, so not FDIC-insured'});
  var tb=(data.tbills_daily||[]).map(function(r){ var c=tbillCouponYield(r); return c ? {n:c.n, metric:c.metric, r:r} : null; }).filter(Boolean);
  tb.sort(function(a,b){ return b.n-a.n; });
  if(tb[0]) rows.push({key:'tbill', label:'Top Treasury bill yield', name:'T-bill '+(tb[0].r.term||''), rate:tb[0].n, metric:tb[0].metric, as_of:tb[0].r.as_of, url:tb[0].r.source_url, src:tb[0].r.source_name, cover:'U.S. Treasury security, not an FDIC product'});
  var nat=(data.hysa||[]).filter(function(r){ return /national/i.test((r.metric||'')+' '+(r.name||'')) && finiteNumber(r.rate_pct)!=null; })[0];
  if(nat) rows.push({key:'national', label:'FDIC national average savings rate', name:nat.name, rate:finiteNumber(nat.rate_pct), metric:nat.metric, as_of:nat.as_of, url:nat.source_url, src:nat.source_name, cover:'A benchmark, not a product you can open'});
  return rows;
}
// Simple (non-compounded) interest over a number of months, rounded to cents.
function pcInterestForMonths(amount, ratePct, months){
  var a=finiteNumber(amount), r=finiteNumber(ratePct), m=finiteNumber(months);
  if(a==null || r==null || m==null || a<0 || m<0) return null;
  var cents=a*r*m/12; // dollars*pct*months/12 = cents (simple interest); strip float noise, then round half up
  return Math.round(Math.round(cents*1e6)/1e6)/100;
}
// How many notes of one denomination it takes, and what they weigh (one note is about 1 gram; 454 grams per pound).
function pcNoteCount(amount, denom){
  var a=finiteNumber(amount), d=pcDenomValue(denom);
  if(a==null || d==null || a<0) return null;
  var n=Math.ceil(a/d);
  return {notes:n, grams:n, pounds:Math.round((n/454)*100)/100};
}
function pcStashSummary(amount, months, denom, rates){
  var a=finiteNumber(amount), m=finiteNumber(months);
  if(a==null || m==null || a<0 || m<=0) return null;
  var rows=[{key:'cash', label:'Cash at home or in a safe deposit box', name:'Paper cash', rate:0, interest:0, perMonth:0, cover:'Not FDIC-insured, per the FDIC', as_of:'', url:'https://www.fdic.gov/consumer-resource-center/five-things-know-about-safe-deposit-boxes-home-safes-and-your-valuables', src:'FDIC'}];
  rates.forEach(function(r){
    var i=pcInterestForMonths(a, r.rate, m);
    rows.push({key:r.key, label:r.label, name:r.name, rate:r.rate, metric:r.metric, interest:i, perMonth:i==null?null:Math.round((i/m)*100)/100, cover:r.cover, as_of:r.as_of, url:r.url, src:r.src});
  });
  return {amount:a, months:m, rows:rows, notes:pcNoteCount(a, denom), large:a>=10000};
}

/* ---------- Lifespan and condition guide ---------- */
var PC_CONDITIONS = [
  {key:'crisp', label:'Crisp or lightly folded, all there'},
  {key:'worn', label:'Worn, soft, dirty, or defaced, but the whole note'},
  {key:'torn', label:'Torn or taped, but more than half is there and the value is clear'},
  {key:'mutilated', label:'Half or less is left, or fire, water, chemical, animal, or burial damage'}
];
function pcLifespanFor(denom){
  if(denom==='$2') return {years:null, text:'The Federal Reserve does not publish a lifespan for the $2 note because it does not widely circulate.'};
  var y=PC_LIFESPAN[denom];
  if(y==null) return {years:null, text:'No lifespan estimate for that denomination.'};
  return {years:y, text:'The Federal Reserve\u2019s estimate for the average $'+pcDenomValue(denom)+' note is '+y.toFixed(1)+' years in circulation (estimate as of May 2025).'};
}
function pcConditionAdvice(cond){
  switch(cond){
    case 'crisp': return {tone:'ok', title:'Nothing to fix', text:'A whole note in this shape is ordinary spendable cash. Store it flat and dry if you want to keep it that way. Condition only matters beyond this if you are a collector.'};
    case 'worn': return {tone:'ok', title:'Still money, and a bank can swap it', text:'BEP calls notes that are dirty, defaced, limp, torn, or worn \u201cunfit,\u201d not mutilated. The Fed says dirty or worn currency may be exchanged at a commercial financial institution. Do not mail it to BEP or the Fed.'};
    case 'torn': return {tone:'ok', title:'Try your bank first', text:'BEP says unfit currency, including torn notes, should not be sent to BEP and may be exchanged at a commercial financial institution. The line that matters is whether more than half of the note is present and clearly identifiable, so check that before you go. Ask your bank how it handles taped or torn notes.'};
    case 'mutilated': return {tone:'warn', title:'This is the BEP\u2019s job', text:'BEP defines mutilated currency as a note with one-half or less remaining, or one whose condition makes its value questionable. Its Mutilated Currency Division examines these for free, but standard cases can take 6 to 36 months. The Fed says to send mutilated currency to BEP, not to the Federal Reserve.'};
  }
  return null;
}

/* ---------- Page wiring (browser only) ---------- */
var PC_DENOMS = ['$1','$2','$5','$10','$20','$50','$100'];
var PC_EXAMPLES = [
  {label:'Radar serial', serial:'MB12344321A', denom:'$20', series:'2013'},
  {label:'Low-number star', serial:'LL00000001*', denom:'$1', series:''},
  {label:'Ladder', serial:'PF12345678C', denom:'$20', series:'2017A'},
  {label:'Older one-letter style', serial:'B87654321A', denom:'$20', series:''},
  {label:'Plain note', serial:'QG48271936B', denom:'$100', series:'2021'}
];
function pcEl(id){ return document.getElementById(id); }
function pcOptions(list, placeholder){
  return (placeholder ? '<option value="">'+esc(placeholder)+'</option>' : '') + list.map(function(x){ return '<option value="'+esc(x)+'">'+esc(x)+'</option>'; }).join('');
}
function pcRenderDecode(res){
  if(!res.ok) return '<p class="note" role="alert" style="margin:.6rem 0">'+esc(res.error)+'</p>';
  var p=res.parsed;
  var shown=(p.seriesLetter||'')+p.districtLetter+' '+p.digits+' '+p.suffix;
  var h='<p class="muted small" style="margin:.8rem 0 .2rem">Decoded</p><div class="serial">'+esc(shown)+'</div>';
  h+='<ul class="facts">'+res.facts.map(function(f){ return '<li class="'+esc(f.kind)+'">'+esc(f.text)+'</li>'; }).join('')+'</ul>';
  h+='<h3 style="margin:.9rem 0 .3rem;font-size:1rem">Collector patterns <span class="badge">convention, not official</span></h3>';
  if(res.patterns.length){
    h+='<div class="tags">'+res.patterns.map(function(x){ return '<span class="tag" title="'+esc(x.note)+'">'+esc(x.label)+'</span>'; }).join('')+'</div>';
    h+='<ul class="clean small muted">'+res.patterns.map(function(x){ return '<li><strong>'+esc(x.label)+':</strong> '+esc(x.note)+'</li>'; }).join('')+'</ul>';
  } else {
    h+='<p class="small muted">None of the six patterns cashscoreboard.com checks (solid, radar, repeater, ladder, binary, low serial). Other patterns exist, and this is not a statement about value.</p>';
  }
  return h;
}
function pcInitDecoder(){
  var form=pcEl('pc-decoder'); if(!form) return;
  pcEl('pc-denom').innerHTML=pcOptions(PC_DENOMS,'Not sure');
  pcEl('pc-series').innerHTML=pcOptions(pcSeriesOptions(),'Not sure');
  var out=pcEl('pc-decode-out');
  function run(e){
    if(e && e.preventDefault) e.preventDefault();
    out.innerHTML=pcRenderDecode(pcDecodeSerial(pcEl('pc-serial').value, pcEl('pc-denom').value, pcEl('pc-series').value));
  }
  form.addEventListener('submit', run);
  var ex=pcEl('pc-examples');
  if(ex){
    ex.innerHTML=PC_EXAMPLES.map(function(x,i){ return '<button type="button" class="ghost" data-i="'+i+'">'+esc(x.label)+'</button>'; }).join('');
    ex.addEventListener('click', function(e){
      var b=e.target.closest ? e.target.closest('button[data-i]') : null; if(!b) return;
      var x=PC_EXAMPLES[Number(b.getAttribute('data-i'))];
      pcEl('pc-serial').value=x.serial; pcEl('pc-denom').value=x.denom; pcEl('pc-series').value=x.series; run();
    });
  }
}
function pcInitStash(){
  var form=pcEl('pc-stash'); if(!form) return;
  var out=pcEl('pc-stash-out'), rates=[];
  function render(){
    var s=pcStashSummary(pcEl('pc-amount').value, pcEl('pc-months').value, pcEl('pc-mix').value, rates);
    if(!s){ out.innerHTML='<p class="note" role="alert">Enter an amount of $0 or more and a time of at least 1 month.</p>'; return; }
    var best=null; s.rows.forEach(function(r){ if(r.key!=='national' && r.key!=='cash' && r.interest!=null && (best==null || r.interest>best.interest)) best=r; });
    var h='<div class="grid grid-2" style="margin:1rem 0"><div><div class="muted small">Interest paper cash earns over '+s.months+' month'+(s.months===1?'':'s')+'</div><div class="stat">'+money2(0)+'</div></div>';
    h+='<div><div class="muted small">Interest you give up vs the best rate below</div><div class="stat warn">'+(best?money2(best.interest):'\u2014')+'</div></div></div>';
    h+='<div style="overflow:auto"><table><thead><tr><th>Where the money sits</th><th>Rate</th><th>Interest, '+s.months+' mo.</th><th>Per month</th><th>Coverage</th><th>As of / source</th></tr></thead><tbody>';
    s.rows.forEach(function(r){
      h+=rowHTML([
        esc(r.label)+(r.name && r.key!=='cash' ? '<div class="small muted">'+esc(r.name)+'</div>' : ''),
        r.key==='cash' ? '<span class="rate">0.00%</span>' : rateCell(r.rate, r.metric),
        '<strong>'+money2(r.interest)+'</strong>',
        money2(r.perMonth),
        esc(r.cover),
        (r.as_of ? esc(r.as_of)+' \u00b7 ' : '')+link(r.url, r.src)
      ]);
    });
    h+='</tbody></table></div>';
    if(s.notes){
      h+='<p class="small muted">Weight and bulk: '+s.notes.notes.toLocaleString()+' note'+(s.notes.notes===1?'':'s')+' of '+esc(pcEl('pc-mix').value)+' to make '+money2(s.amount)+'. One note weighs about 1 gram, so that is about '+s.notes.grams.toLocaleString()+' g ('+s.notes.pounds+' lb). Source: <a href="https://www.uscurrency.gov/about-us/currency-facts" rel="noopener noreferrer" target="_blank">U.S. Currency Education Program</a>.</p>';
    }
    if(s.large){
      h+='<p class="note">That is a lot of paper to hold. Cash at home or in a box is not FDIC-insured, and large cash deposits, cash received by a business, and cash carried across the border can trigger federal reports. See the rules section below and the linked agency pages.</p>';
    }
    out.innerHTML=h;
  }
  ['pc-amount','pc-months','pc-mix'].forEach(function(id){ pcEl(id).addEventListener('input', render); pcEl(id).addEventListener('change', render); });
  form.addEventListener('submit', function(e){ if(e && e.preventDefault) e.preventDefault(); render(); });
  var presets=pcEl('pc-presets');
  if(presets) presets.addEventListener('click', function(e){
    var b=e.target.closest ? e.target.closest('button[data-amt]') : null; if(!b) return;
    pcEl('pc-amount').value=b.getAttribute('data-amt'); render();
  });
  pcEl('pc-mix').innerHTML=PC_DENOMS.map(function(d){ return '<option value="'+d+'"'+(d==='$20'?' selected':'')+'>'+d+'</option>'; }).join('');
  loadRates().then(function(data){ rates=pcPickTopRates(data); render(); })
    .catch(function(){ out.innerHTML='<p class="note">Could not load the rates file. Open the <a href="index.html">scoreboard</a> for current rates.</p>'; });
}
function pcInitLifespan(){
  var form=pcEl('pc-life'); if(!form) return;
  pcEl('pc-ldenom').innerHTML=PC_DENOMS.map(function(d){ return '<option value="'+d+'"'+(d==='$20'?' selected':'')+'>'+d+'</option>'; }).join('');
  pcEl('pc-lcond').innerHTML=PC_CONDITIONS.map(function(c){ return '<option value="'+c.key+'">'+esc(c.label)+'</option>'; }).join('');
  var out=pcEl('pc-life-out');
  function render(){
    var d=pcEl('pc-ldenom').value, cnd=pcEl('pc-lcond').value;
    var life=pcLifespanFor(d), adv=pcConditionAdvice(cnd);
    var h='<div class="grid grid-2" style="margin:1rem 0"><div><div class="muted small">Average lifespan, '+esc(d)+'</div><div class="stat good">'+(life.years==null?'\u2014':life.years.toFixed(1)+' yrs')+'</div></div>';
    h+='<div><div class="muted small">Notes in circulation, end of 2025</div><div class="stat">'+(PC_VOLUME_2025[d]!=null?PC_VOLUME_2025[d].toFixed(1)+' billion':'\u2014')+'</div></div></div>';
    h+='<p class="small">'+esc(life.text)+'</p>';
    h+='<div class="'+(adv.tone==='warn'?'note':'callout')+'"><strong>'+esc(adv.title)+'.</strong> '+esc(adv.text)+'</div>';
    if(cnd==='mutilated') h+='<p class="small">Official steps: <a href="https://www.bep.gov/services/mutilated-currency-redemption/" rel="noopener noreferrer" target="_blank">BEP Mutilated Currency Redemption</a> and the <a href="https://www.bep.gov/services/mutilated-currency-redemption/mutilated-currency-faqs/" rel="noopener noreferrer" target="_blank">FAQs</a>.</p>';
    out.innerHTML=h;
  }
  ['pc-ldenom','pc-lcond'].forEach(function(id){ pcEl(id).addEventListener('change', render); });
  render();
}
