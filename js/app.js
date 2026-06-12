const DATA_PATHS = {
  meta: 'data/meta.json',
  sessions: 'data/sessions.csv',
  cover: 'data/cover.csv',
  leadership: 'data/leadership.csv',
  adjustments: 'data/adjustments.csv',
  concurrent: 'data/concurrent.csv',
  changelog: 'data/changelog.csv',
  staff_events: 'data/staff_events.csv'
};
const PERIODS = [1,2,3,'break',4,5,'lunch',7,8,9,10];

function esc(v){return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function norm(s){return String(s||'').trim();}
function periodNum(p){const m=String(p||'').match(/P(\d+)|^(\d+)$/); return m ? Number(m[1]||m[2]) : 0;}
function parseCSV(text){
  const rows=[]; let row=[], cell='', quote=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(quote){ if(ch==='"' && next==='"'){ cell+='"'; i++; } else if(ch==='"'){ quote=false; } else cell+=ch; }
    else { if(ch==='"') quote=true; else if(ch===','){ row.push(cell); cell=''; } else if(ch==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; } else if(ch!=='\r') cell+=ch; }
  }
  if(cell.length || row.length){ row.push(cell); rows.push(row); }
  const headers=(rows.shift()||[]).map(h=>h.trim());
  return rows.filter(r => r.some(c => String(c).trim() !== '')).map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i] ?? ''])));
}
async function loadCSV(path){const res=await fetch(path); if(!res.ok) throw new Error(path); return parseCSV(await res.text());}
async function loadJSON(path){const res=await fetch(path); if(!res.ok) throw new Error(path); return res.json();}
async function loadOptionalCSV(path){try{return await loadCSV(path);}catch(err){return [];}}
function byDatePeriod(a,b){return (a.date_iso||'').localeCompare(b.date_iso||'') || Number(a.start_period||periodNum(a.period))-Number(b.start_period||periodNum(b.period)) || String(a.session_code||a.trigger_session||'').localeCompare(String(b.session_code||b.trigger_session||''));}
function unique(arr){return [...new Set(arr.filter(x => norm(x)))];}
function dateLabel(row){return row.date || row.date_iso || '';}
function rowClass(row){return esc(row.row_class || '');}
function classFromSession(code){const m=String(code||'').match(/\b([0-9][A-Z]{1,2})\b/); return m ? m[1] : '';}
function classTokens(text){return unique((String(text||'').match(/\b[0-9][A-Z]{1,2}\b/g)||[]));}
function splitPeople(text){
  return unique(String(text||'').split(/\s*(?:\/|→|,|;| and )\s*/i).map(x => x.replace(/\b(unavailable|returns|released|cover needed|cover required)\b/ig,'').trim()).filter(x => /[A-Z][a-z]+/.test(x)));
}
function addOptions(select, values, firstLabel){select.innerHTML = `<option value="">${esc(firstLabel)}</option>` + values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');}

let VIEW_CUTOFF_DATE = '';
const FILTER_REFRESHERS = [];
function todayIsoLocal(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}
function computeCutoffDate(data){
  const rows=[...(data.sessions||[]), ...(data.cover||[]), ...(data.leadership||[]), ...(data.concurrent||[]), ...(data.staff_events||[])];
  const dates=unique(rows.map(r=>r.date_iso)).sort();
  const today=todayIsoLocal();
  return dates.find(d=>d>=today) || dates[dates.length-1] || today;
}
function isPastRow(row){return !!(row && row.date_iso && VIEW_CUTOFF_DATE && row.date_iso < VIEW_CUTOFF_DATE);}
function pastClass(row){return isPastRow(row) ? ' past-row' : '';}
function showPast(){return document.body.classList.contains('show-past');}
function visibleByPast(el){return showPast() || !el.classList.contains('past-row');}
function registerFilterRefresh(fn){FILTER_REFRESHERS.push(fn); fn();}
function refreshFilters(){FILTER_REFRESHERS.forEach(fn=>fn());}
function initPastVisibility(data){
  VIEW_CUTOFF_DATE=computeCutoffDate(data);
  document.body.classList.remove('show-past');
  const old=document.getElementById('view-options');
  if(old) old.remove();
  const labelRows=[...(data.sessions||[]), ...(data.cover||[]), ...(data.leadership||[])];
  const cutoffLabel=(labelRows.find(r=>r.date_iso===VIEW_CUTOFF_DATE)||{}).date || VIEW_CUTOFF_DATE;
  const bar=document.createElement('div');
  bar.id='view-options';
  bar.innerHTML=`<span>Showing current / upcoming schedule from <b>${esc(cutoffLabel)}</b>.</span><button id="toggle-past" type="button">Show past days</button>`;
  document.querySelector('header').insertAdjacentElement('afterend', bar);
  const btn=bar.querySelector('#toggle-past');
  function update(){
    const on=showPast();
    btn.textContent=on ? 'Hide past days' : 'Show past days';
    bar.querySelector('span').innerHTML=on ? 'Showing <b>all</b> schedule days.' : `Showing current / upcoming schedule from <b>${esc(cutoffLabel)}</b>.`;
    refreshFilters();
  }
  btn.addEventListener('click',()=>{document.body.classList.toggle('show-past'); update();});
  update();
}

function sortHeader(table, types){
  table.querySelectorAll('thead th').forEach((th,i)=>{
    th.classList.add('sort-th');
    th.addEventListener('click',()=>{
      const tbody=table.querySelector('tbody'); const rows=[...tbody.rows]; const asc=!th.classList.contains('asc');
      table.querySelectorAll('th').forEach(x=>x.classList.remove('asc','desc')); th.classList.add(asc?'asc':'desc');
      const type=types[i]||'text';
      rows.sort((ra,rb)=>{
        let a=ra.cells[i]?.innerText.trim()||'', b=rb.cells[i]?.innerText.trim()||'', d=0;
        if(type==='date') d=(ra.dataset.date||a).localeCompare(rb.dataset.date||b);
        else if(type==='period') d=periodNum(a)-periodNum(b);
        else if(type==='num') d=(parseFloat(a)||0)-(parseFloat(b)||0);
        else d=a.localeCompare(b);
        return asc?d:-d;
      }); rows.forEach(r=>tbody.appendChild(r));
    });
  });
}

function renderSummary(data){
  const sessions=data.sessions;
  const latest=[...sessions].sort((a,b)=>(b.date_iso||'').localeCompare(a.date_iso||'') || Number(b.end_period||0)-Number(a.end_period||0))[0];
  const triples=sessions.filter(s=>/triple|P\d+\s*[–-]\s*P\d+/i.test(s.opportunity_type+' '+s.window) && Number(s.end_period)-Number(s.start_period)>=2).length;
  const teachers=unique([...sessions.map(s=>s.start_leader), ...(data.staff_events||[]).map(e=>e.staff), ...data.cover.flatMap(c=>splitPeople(c.normal_teacher+';'+c.cover_destination)), ...data.leadership.map(l=>l.leader)]);
  const reloc=sessions.filter(s=>norm(s.relocations) && !/^none$/i.test(s.relocations)).length;
  const metrics=[
    [sessions.length,'Scheduled sessions'],
    [latest ? `${latest.date} P${latest.end_period}` : '—','Latest finish'],
    [triples,'Protected / triple-length blocks'],
    [teachers.length,'Teachers with impacts'],
    [reloc,'Room relocations'],
    [data.adjustments.length,'Schedule adjustments']
  ];
  document.getElementById('summary-metrics').innerHTML=metrics.map(([n,l])=>`<div class="metric"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('');
  document.getElementById('summary-notes').innerHTML=`<div class="simple-card"><h3>How to update</h3><p>Edit <code>data/sessions.csv</code>, <code>data/cover.csv</code>, <code>data/leadership.csv</code>, or <code>data/adjustments.csv</code>. Commit the CSV change to GitHub; the viewer rebuilds itself when loaded.</p><p class="small-muted">The GitHub Pages app hydrates from CSV, so routine schedule updates can be made by replacing files in <code>data/</code>.</p></div>`;
}
function renderTable(id, rows, cols, mapper, sortTypes){
  const tbody=document.querySelector(`#${id} tbody`);
  tbody.innerHTML=rows.map(r=>`<tr class="${rowClass(r)}${pastClass(r)}" data-date="${esc(r.date_iso||'')}">${cols.map(c=>`<td>${mapper?mapper(r,c):esc(r[c]||'')}</td>`).join('')}</tr>`).join('');
  sortHeader(document.getElementById(id), sortTypes);
}
function renderFullSchedule(sessions){
  renderTable('full-sched-table', [...sessions].sort(byDatePeriod), ['session_code','start_leader','date','window','test','testing_room','normal_lessons_used','opportunity_type','relocations'], null, ['text','text','date','period','text','text','text','text','text']);
  const dates=unique(sessions.sort(byDatePeriod).map(s=>s.date)); addOptions(document.getElementById('fs-date'), dates, 'All dates');
  const run=()=>{const q=norm(document.getElementById('fs-search').value).toLowerCase(), d=document.getElementById('fs-date').value, ty=document.getElementById('fs-type').value; let n=0; const rows=[...document.querySelectorAll('#full-sched-table tbody tr')]; rows.forEach(r=>{const ok=visibleByPast(r)&&(!q||r.innerText.toLowerCase().includes(q))&&(!d||r.cells[2].innerText===d)&&(!ty||r.classList.contains(ty)||r.innerText.toLowerCase().includes(ty)); r.style.display=ok?'':'none'; if(ok)n++;}); document.getElementById('fs-count').textContent=`${n} of ${rows.length} sessions`;};
  ['fs-search','fs-date','fs-type'].forEach(id=>document.getElementById(id).addEventListener(id==='fs-search'?'input':'change',run)); document.getElementById('fs-reset').onclick=()=>{document.getElementById('fs-search').value='';document.getElementById('fs-date').value='';document.getElementById('fs-type').value='';run();}; registerFilterRefresh(run);
}
function renderCover(cover){
  renderTable('cover-table', [...cover].sort(byDatePeriod), ['date','period','trigger_session','type','affected_class_group','normal_lesson','normal_teacher','cover_destination','instruction'], null, ['date','period','text','text','text','text','text','text','text']);
  addOptions(document.getElementById('cover-date'), unique(cover.sort(byDatePeriod).map(c=>c.date)), 'All dates');
  addOptions(document.getElementById('cover-type'), unique(cover.map(c=>c.type)).sort(), 'All types');
  const run=()=>{const q=norm(document.getElementById('cover-search').value).toLowerCase(), d=document.getElementById('cover-date').value, ty=document.getElementById('cover-type').value; let n=0; const rows=[...document.querySelectorAll('#cover-table tbody tr')]; rows.forEach(r=>{const ok=visibleByPast(r)&&(!q||r.innerText.toLowerCase().includes(q))&&(!d||r.cells[0].innerText===d)&&(!ty||r.cells[3].innerText===ty); r.style.display=ok?'':'none'; if(ok)n++;}); document.getElementById('cover-count').textContent=`${n} of ${rows.length} rows`;};
  ['cover-search','cover-date','cover-type'].forEach(id=>document.getElementById(id).addEventListener(id==='cover-search'?'input':'change',run)); document.getElementById('cover-reset').onclick=()=>{document.getElementById('cover-search').value='';document.getElementById('cover-date').value='';document.getElementById('cover-type').value='';run();}; registerFilterRefresh(run);
}
function renderLeadership(leadership){
  renderTable('leadership-table', [...leadership].sort(byDatePeriod), ['date','period','leader','responsibility','mobile_load'], null, ['date','period','text','text','num']);
  const run=()=>{const q=norm(document.getElementById('ld-search').value).toLowerCase(); let n=0; const rows=[...document.querySelectorAll('#leadership-table tbody tr')]; rows.forEach(r=>{const ok=visibleByPast(r)&&(!q||r.innerText.toLowerCase().includes(q)); r.style.display=ok?'':'none'; if(ok)n++;}); document.getElementById('ld-count').textContent=`${n} of ${rows.length} entries`;};
  document.getElementById('ld-search').addEventListener('input',run); document.getElementById('ld-reset').onclick=()=>{document.getElementById('ld-search').value='';run();}; registerFilterRefresh(run);
}
function renderAdjustments(adjustments){
  renderTable('schedule-adjustments-table', adjustments, ['status','original_session','original_slot','new_slot','room','normal_lesson_staff_affected','operational_note'], null, ['text','text','date','date','text','text','text']);
}
function renderConcurrent(concurrent){
  renderTable('concurrent-table-el', concurrent.sort(byDatePeriod), ['date','period','concurrent_sessions','sessions'], null, ['date','period','num','text']);
  const run=()=>{const min=Number(document.getElementById('cc-min').value||0); let n=0; const rows=[...document.querySelectorAll('#concurrent-table-el tbody tr')]; rows.forEach(r=>{const ok=visibleByPast(r)&&((Number(r.cells[2].innerText)||0)>=min); r.style.display=ok?'':'none'; if(ok)n++;}); document.getElementById('cc-count').textContent=`${n} of ${rows.length} periods`;};
  document.getElementById('cc-min').addEventListener('input',run); document.getElementById('cc-reset').onclick=()=>{document.getElementById('cc-min').value=2;run();}; registerFilterRefresh(run);
}
function blockHTML(s, period, kind='session'){
  const cont=Number(period)>Number(s.start_period);
  const cls = kind==='leader' ? 'leader-block-staff' : `${s.row_class||''} ${cont?'cont':''}`;
  if(kind==='leader') return `<span class="timeline-chip-lite ${cls}"><b>${esc(s.leader)}</b><small>${esc(s.responsibility)}</small></span>`;
  return `<span class="timeline-chip-lite ${cls}"><b>${esc(s.session_code)}</b><small>${esc(s.test)} · ${esc(s.testing_room)}</small>${cont?'<small>continuation</small>':''}</span>`;
}
function staffEventHTML(e){
  const cls = e.row_class || '';
  return `<span class="timeline-chip-lite ${esc(cls)}"><b>${esc(e.event)}</b><small>${esc(e.detail)}${e.room ? ' · '+esc(e.room) : ''}</small>${e.notes ? '<small>'+esc(e.notes)+'</small>' : ''}</span>`;
}
function leaderHeader(dayLeaders, p){
  const leaders=dayLeaders.filter(l=>periodNum(l.period)===p);
  if(!leaders.length) return '';
  return `<span class="period-leaders">${leaders.map(l=>`${esc(l.leader)}: ${esc(l.responsibility)}`).join('<br>')}</span>`;
}
function renderTimeline(data){
  const sessions=[...data.sessions].sort(byDatePeriod);
  const staffEvents=[...(data.staff_events||[])].sort(byDatePeriod);
  const dates=unique([...sessions.map(s=>s.date_iso), ...staffEvents.map(e=>e.date_iso), ...data.leadership.map(l=>l.date_iso)]).sort();
  const dateNames=Object.fromEntries([...sessions.map(s=>[s.date_iso,s.date]), ...staffEvents.map(e=>[e.date_iso,e.date]), ...data.leadership.map(l=>[l.date_iso,l.date])]);
  const activeDate=VIEW_CUTOFF_DATE || dates.find(d=>d>=todayIsoLocal()) || dates[dates.length-1];
  document.getElementById('current-day-note').textContent='Staff rows show who is actually responsible for the class/cover in each period. Session leaders are shown inside the period headings.';
  function dayCard(dateIso){
    const dayEvents=staffEvents.filter(e=>e.date_iso===dateIso);
    const dayLeaders=data.leadership.filter(l=>l.date_iso===dateIso);
    const staff=unique(dayEvents.map(e=>e.staff)).sort();
    const headerCells=PERIODS.map(p=>{
      if(p==='break') return '<th class="break-head">Break</th>';
      if(p==='lunch') return '<th class="lunch-head">P6<small>Lunch</small></th>';
      return `<th>P${p}${leaderHeader(dayLeaders,p)}</th>`;
    }).join('');
    const rows=staff.map(name=>{
      const cells=PERIODS.map(p=>{
        if(p==='break') return '<td class="break-gap"></td>';
        if(p==='lunch') return '<td class="lunch-gap"><span class="small-muted">Lunch</span></td>';
        const html=dayEvents.filter(e=>e.staff===name && periodNum(e.period)===p).map(e=>staffEventHTML(e)).join('');
        return `<td class="staff-period-cell ${html?'staff-busy':''}">${html||''}</td>`;
      }).join('');
      return `<tr class="staff-row"><th class="staff-row-name">${esc(name)}</th>${cells}</tr>`;
    }).join('');
    return `<div class="day-timeline-card ${dateIso===activeDate?'timeline-day-current':''}"><h3>${esc(dateNames[dateIso]||dateIso)} <span class="timeline-day-toggle">${dateIso===activeDate?'Today':'Hide'}</span></h3><table class="staff-row-table day-timeline-table"><thead><tr><th class="staff-head">Staff</th>${headerCells}</tr></thead><tbody>${rows||'<tr><td colspan="12" class="empty-state">No staff rows for this date</td></tr>'}</tbody></table></div>`;
  }
  const currentFuture=dates.filter(d=>d>=activeDate).map(dayCard).join('');
  const past=dates.filter(d=>d<activeDate).map(dayCard).join('');
  document.getElementById('timeline').innerHTML=currentFuture + (past ? `<details class="past-days-details past-card"><summary>Past</summary><div class="past-days-inner">${past}</div></details>` : '');
  document.querySelectorAll('.day-timeline-card h3').forEach(h=>h.addEventListener('click',()=>{const card=h.closest('.day-timeline-card'); card.classList.toggle('timeline-day-collapsed'); const b=h.querySelector('.timeline-day-toggle'); b.textContent=card.classList.contains('timeline-day-collapsed')?'Show':(card.classList.contains('timeline-day-current')?'Today':'Hide');}));
}
function renderClassViews(data){
  const classes=unique(data.sessions.map(s=>s.class_group).concat(data.cover.flatMap(c=>classTokens(c.affected_class_group+' '+c.trigger_session)), data.adjustments.flatMap(a=>classTokens(a.original_session+' '+a.original_slot+' '+a.new_slot)))).sort();
  const sel=document.getElementById('classSelect'); sel.innerHTML=classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  const wrap=document.getElementById('classViews');
  wrap.innerHTML=classes.map(c=>{
    const sess=data.sessions.filter(s=>s.class_group===c).sort(byDatePeriod).map(s=>`<tr class="testevent ${rowClass(s)}${pastClass(s)}"><td>${esc(s.date)}</td><td>${esc(s.window)}</td><td>${esc(s.session_code)}</td><td>${esc(s.test)} · ${esc(s.testing_room)}</td><td>${esc(s.normal_lessons_used)}</td><td>${esc(s.relocations)}</td></tr>`).join('');
    const cov=data.cover.filter(x=>classTokens(x.affected_class_group+' '+x.trigger_session).includes(c)).sort(byDatePeriod).map(x=>`<tr class="relocateevent ${rowClass(x)}${pastClass(x)}"><td>${esc(x.date)}</td><td>${esc(x.period)}</td><td>${esc(x.type)}</td><td>${esc(x.trigger_session)} · ${esc(x.cover_destination)}</td><td>${esc(x.normal_lesson)} · ${esc(x.normal_teacher)}</td><td>${esc(x.instruction)}</td></tr>`).join('');
    const adj=data.adjustments.filter(a=>classTokens(a.original_session+' '+a.original_slot+' '+a.new_slot).includes(c)).map(a=>`<tr class="usedevent ${rowClass(a)}"><td></td><td>${esc(a.original_slot)} → ${esc(a.new_slot)}</td><td>${esc(a.status)}</td><td>${esc(a.original_session)} · ${esc(a.room)}</td><td>${esc(a.normal_lesson_staff_affected)}</td><td>${esc(a.operational_note)}</td></tr>`).join('');
    return `<div class="class-view" data-class="${esc(c)}"><h3>${esc(c)}</h3><div class="tablewrap"><table><thead><tr><th>Date</th><th>Period</th><th>Event</th><th>Detail</th><th>Normal affected lesson</th><th>Instruction</th></tr></thead><tbody>${sess+cov+adj||'<tr><td colspan="6" class="empty-state">No records</td></tr>'}</tbody></table></div></div>`;
  }).join('');
  function show(){document.querySelectorAll('.class-view').forEach(v=>v.classList.toggle('active', v.dataset.class===sel.value));}
  sel.onchange=show; show();
  document.getElementById('exportClassBtn').onclick=()=>printElement(document.querySelector(`.class-view[data-class="${CSS.escape(sel.value)}"]`), `${sel.value} PT class view`);
}
function renderTeacherViews(data){
  const staffEvents=[...(data.staff_events||[])];
  const people=unique([...staffEvents.map(e=>e.staff), ...data.leadership.flatMap(l=>splitPeople(l.leader))]).sort();
  const sel=document.getElementById('teacherSelect'); sel.innerHTML=people.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
  const wrap=document.getElementById('teacherViews');
  wrap.innerHTML=people.map(p=>{
    const dates=unique([
      ...staffEvents.filter(e=>e.staff===p).map(e=>e.date_iso),
      ...data.leadership.filter(l=>splitPeople(l.leader).includes(p) || String(l.leader||'').includes(p)).map(l=>l.date_iso)
    ]).sort();
    const cards=[];
    for(const d of dates){
      const label=(staffEvents.find(e=>e.date_iso===d)||data.leadership.find(l=>l.date_iso===d)||data.sessions.find(s=>s.date_iso===d)||{}).date || d;
      const rows=[];
      staffEvents.filter(e=>e.date_iso===d && e.staff===p).sort(byDatePeriod).forEach(e=>rows.push({p:periodNum(e.period), html:`<tr class="${rowClass(e)}"><td>${esc(e.period)}</td><td>${esc(e.event)}</td><td>${esc(e.detail)}</td><td>${esc(e.room)}</td><td>${esc(e.notes)}</td></tr>`}));
      data.leadership.filter(l=>l.date_iso===d && (splitPeople(l.leader).includes(p) || String(l.leader||'').includes(p))).sort(byDatePeriod).forEach(l=>rows.push({p:periodNum(l.period), html:`<tr class="leader-row ${rowClass(l)}"><td>${esc(l.period)}</td><td>Session leader / mobile</td><td>${esc(l.responsibility)}</td><td></td><td>Mobile load: ${esc(l.mobile_load)}. Leadership is shown in the period heading, not as class supervision.</td></tr>`}));
      rows.sort((a,b)=>a.p-b.p);
      cards.push(`<div class="teacher-day-card ${d < VIEW_CUTOFF_DATE ? 'past-card' : ''}"><h4>${esc(label)}</h4><div class="tablewrap"><table><thead><tr><th>Period</th><th>Event</th><th>Detail</th><th>Room / destination</th><th>Notes</th></tr></thead><tbody>${rows.map(r=>r.html).join('')}</tbody></table></div></div>`);
    }
    return `<div class="teacher-view" data-teacher="${esc(p)}"><h3>${esc(p)}</h3><p class="teacher-summary">Staff rows are generated from <code>staff_events.csv</code>. Session leadership is shown separately and does not imply classroom supervision.</p><div class="teacher-day-timeline-list">${cards.join('')||'<div class="empty-state">No records</div>'}</div></div>`;
  }).join('');
  function show(){document.querySelectorAll('.teacher-view').forEach(v=>v.classList.toggle('active', v.dataset.teacher===sel.value));}
  sel.onchange=show; show();
  document.getElementById('exportTeacherBtn').onclick=()=>printElement(document.querySelector(`.teacher-view[data-teacher="${CSS.escape(sel.value)}"]`), `${sel.value} PT teacher view`);
}
function printElement(el,title){const w=window.open('', '_blank');w.document.write(`<html><head><title>${esc(title)}</title><link rel="stylesheet" href="css/styles.css"></head><body style="font-family:Inter,Arial,sans-serif;padding:20px;background:#f5f7f6">${el?el.outerHTML:'No view'}</body></html>`);w.document.close();setTimeout(()=>w.print(),300);}
function renderChecks(data){
  const checks=[];
  const missing=data.sessions.filter(s=>!norm(s.start_leader));
  checks.push(['Missing start leader', missing.length, missing.length?'check-risk':'check-ok', missing.slice(0,8).map(s=>s.session_code).join(', ') || 'None']);
  const reloc=data.sessions.filter(s=>norm(s.relocations) && !/^none$/i.test(s.relocations));
  checks.push(['Sessions with relocation notes', reloc.length, reloc.length?'check-warn':'check-ok', reloc.slice(0,8).map(s=>s.session_code).join(', ')]);
  const lunch=data.sessions.filter(s=>Number(s.start_period)<=5 && Number(s.end_period)>=7);
  checks.push(['Lunch-spanning sessions', lunch.length, lunch.length?'check-warn':'check-ok', lunch.map(s=>s.session_code).join(', ') || 'None']);
  const byClassDay={}; data.sessions.forEach(s=>{const k=`${s.class_group}|${s.date_iso}`; if(s.class_group) (byClassDay[k]??=[]).push(s.session_code);});
  const multi=Object.entries(byClassDay).filter(([k,v])=>v.length>1);
  checks.push(['Multiple sessions for same class on same date', multi.length, multi.length?'check-warn':'check-ok', multi.slice(0,8).map(([k,v])=>`${k.replace('|',' ')}: ${v.join(', ')}`).join('; ') || 'None']);
  document.getElementById('checks').innerHTML=`<div class="tablewrap"><table><thead><tr><th>Check</th><th>Count</th><th>Status</th><th>Examples / notes</th></tr></thead><tbody>${checks.map(c=>`<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td><td class="${c[2]}">${c[1]?'Review':'OK'}</td><td>${esc(c[3])}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderChangeLog(changelog){
  const tbody=document.querySelector('#changelog-table tbody');
  const latestBox=document.getElementById('changelog-latest');
  if(!tbody || !latestBox) return;
  const rows=[...(changelog||[])].sort((a,b)=>(b.published_date||'').localeCompare(a.published_date||'') || (b.version||'').localeCompare(a.version||''));
  if(!rows.length){
    latestBox.innerHTML='<b>No change log found.</b> Add <code>data/changelog.csv</code> to show published updates here.';
    tbody.innerHTML='<tr><td colspan="7" class="empty-state">No change log rows available.</td></tr>';
    return;
  }
  const latest=rows[0];
  const latestVersion=latest.version||'Unversioned';
  const latestDate=latest.published_date||'No date';
  const latestCount=rows.filter(r=>(r.version||'')===latestVersion).length;
  latestBox.innerHTML=`<b>Latest published version:</b> <span class="changelog-version-pill">${esc(latestVersion)}</span> · <b>Published:</b> ${esc(latestDate)} · <b>Requests addressed:</b> ${latestCount}`;
  tbody.innerHTML=rows.map(r=>`<tr data-date="${esc(r.published_date||'')}">
    <td>${esc(r.published_date)}</td>
    <td><span class="changelog-version-pill">${esc(r.version)}</span></td>
    <td>${esc(r.request)}</td>
    <td>${esc(r.change)}</td>
    <td>${esc(r.area)}</td>
    <td><span class="changelog-status">${esc(r.status||'Done')}</span></td>
    <td>${esc(r.notes)}</td>
  </tr>`).join('');
  sortHeader(document.getElementById('changelog-table'), ['date','text','text','text','text','text','text']);
}
function initTabs(){
  const defaultTab='Timeline';
  const panels=[...document.querySelectorAll('main > section.panel')];
  panels.forEach(p=>p.classList.add('tab-panel'));
  const tabs=unique(panels.map(p=>p.dataset.tab));
  const initialTab=tabs.includes(defaultTab) ? defaultTab : tabs[0];
  const nav=document.createElement('div'); nav.id='tab-nav';
  tabs.forEach(t=>{const btn=document.createElement('button');btn.className='tab-btn'+(t===initialTab?' active':'');btn.textContent=t;btn.onclick=()=>{document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');panels.forEach(p=>p.classList.toggle('active',p.dataset.tab===t));window.scrollTo(0,0);};nav.appendChild(btn);});
  document.querySelector('header').insertAdjacentElement('afterend', nav);
  panels.forEach(p=>p.classList.toggle('active',p.dataset.tab===initialTab));
}
async function init(){
  try{
    const [meta,sessions,cover,leadership,adjustments,concurrent,changelog,staff_events] = await Promise.all([loadJSON(DATA_PATHS.meta), loadCSV(DATA_PATHS.sessions), loadCSV(DATA_PATHS.cover), loadCSV(DATA_PATHS.leadership), loadCSV(DATA_PATHS.adjustments), loadCSV(DATA_PATHS.concurrent), loadOptionalCSV(DATA_PATHS.changelog), loadOptionalCSV(DATA_PATHS.staff_events)]);
    document.getElementById('page-title').textContent=meta.title || 'MYP PT Schedule V2';
    document.getElementById('page-subtitle').textContent=meta.subtitle || 'Data-driven schedule viewer';
    const data={sessions,cover,leadership,adjustments,concurrent,changelog,staff_events};
    initPastVisibility(data);
    renderSummary(data); renderTimeline(data); renderFullSchedule(sessions); renderCover(cover); renderLeadership(leadership); renderAdjustments(adjustments); renderConcurrent(concurrent); renderClassViews(data); renderTeacherViews(data); renderChecks(data); renderChangeLog(changelog); initTabs();
    document.getElementById('load-status').textContent=`Loaded ${sessions.length} sessions`;
  }catch(err){
    document.getElementById('load-status').textContent='Load error';
    document.querySelector('main').innerHTML=`<section class="panel"><h2>Could not load data</h2><div class="warn">The viewer could not fetch the CSV files. Open through GitHub Pages or run a local server such as <code>python -m http.server</code>; do not double-click the HTML file directly.</div><pre>${esc(err.message)}</pre></section>`;
  }
}
init();
