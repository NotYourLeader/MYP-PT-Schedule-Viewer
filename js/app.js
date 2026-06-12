/* MYP PT Schedule — app.js
 * Data-driven static site for GitHub Pages.
 * Edit CSV files in /data to update the schedule. No rebuild required.
 */

// ─── CSV Parser ──────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = (values[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Data Loader ─────────────────────────────────────────────────────────────
const DATA = {};

async function loadAll() {
  const files = ['sessions', 'cover', 'leadership', 'adjustments', 'concurrent', 'changelog'];
  const errors = [];

  await Promise.all(files.map(async name => {
    try {
      const res = await fetch(`data/${name}.csv`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      DATA[name] = parseCSV(text);
    } catch (e) {
      errors.push(`data/${name}.csv — ${e.message}`);
      DATA[name] = [];
    }
  }));

  try {
    const res = await fetch('data/meta.json');
    DATA.meta = await res.json();
  } catch (e) {
    DATA.meta = { title: 'MYP PT Schedule', version: '—', published_date: '—', description: '' };
  }

  if (errors.length) {
    const el = document.getElementById('load-errors');
    if (el) {
      el.innerHTML = '<b>⚠ Failed to load:</b> ' + errors.map(e => `<code>${e}</code>`).join(', ') +
        '<br>Run via a local HTTP server (e.g. VS Code Live Server) or deploy to GitHub Pages.';
      el.style.display = 'block';
    }
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────
const DATE_ORDER = [
  '2026-06-08','2026-06-09','2026-06-10','2026-06-11',
  '2026-06-15','2026-06-16','2026-06-17','2026-06-18',
  '2026-06-19','2026-06-22','2026-06-23','2026-06-24','2026-06-25'
];

const DAY_LABEL = {
  '2026-06-08': 'Mon 08 Jun','2026-06-09': 'Tue 09 Jun','2026-06-10': 'Wed 10 Jun',
  '2026-06-11': 'Thu 11 Jun','2026-06-15': 'Mon 15 Jun','2026-06-16': 'Tue 16 Jun',
  '2026-06-17': 'Wed 17 Jun','2026-06-18': 'Thu 18 Jun','2026-06-19': 'Fri 19 Jun',
  '2026-06-22': 'Mon 22 Jun','2026-06-23': 'Tue 23 Jun','2026-06-24': 'Wed 24 Jun',
  '2026-06-25': 'Thu 25 Jun'
};

const PERIODS = ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10'];
const PERIOD_TIMES = {
  P1:'08:00–08:40', P2:'08:40–09:20', P3:'09:20–10:00',
  P4:'10:20–11:00', P5:'11:00–11:40', P6:'11:40–12:20 (Lunch)',
  P7:'12:20–13:00', P8:'13:00–13:40', P9:'13:40–14:20', P10:'14:20–15:00'
};

const TODAY_ISO = '2026-06-12'; // Friday 12 June 2026

function pNum(p) {
  const m = (p || '').match(/(\d+)/);
  return m ? +m[1] : 0;
}

function rowClass(s) {
  const st = (s.status || '').toLowerCase();
  if (st === 'cancelled') return 'cancelled-pt';
  if (st === 'rescheduled') return 'rescheduled-pt';
  return '';
}

function statusBadge(status) {
  const s = (status || '').toUpperCase();
  const ok = ['MOVED','ACTIVE','RESCHEDULED','UNCHANGED','CHECKED'].includes(s);
  return `<span class="update-status${ok ? ' moved' : ''}">${s || 'CANCELLED / NOT TAKEN'}</span>`;
}

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function badge(text, cls) {
  return `<span class="badge ${cls || ''}">${esc(text)}</span>`;
}

function coverTypePill(t) {
  const cls = (t || '').toLowerCase().includes('handover') ? ' handover' : '';
  return `<span class="cover-type-pill${cls}">${esc(t)}</span>`;
}

function riskClass(risk) {
  if ((risk || '').toLowerCase() === 'red') return 'red-risk';
  if ((risk || '').toLowerCase() === 'cancelled') return 'cancelled-pt';
  return '';
}

function periodsBetween(start, end) {
  const s = pNum(start), e = pNum(end);
  const result = [];
  for (let p = s; p <= e; p++) {
    if (p === 6) continue; // lunch
    result.push('P' + p);
  }
  return result;
}

// ─── Tab System ──────────────────────────────────────────────────────────────
function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
  // Default: Timeline tab
  const defaultBtn = document.querySelector('.tab-btn[data-tab="tab-timeline"]');
  if (defaultBtn) defaultBtn.click();
}

// ─── Sort / Filter Helpers ───────────────────────────────────────────────────
function makeSortableTable(tableId, colTypes) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  tbl.querySelectorAll('thead th').forEach((th, i) => {
    th.classList.add('sort-th');
    th.addEventListener('click', () => {
      const asc = th.classList.contains('asc');
      tbl.querySelectorAll('thead th').forEach(h => h.classList.remove('asc', 'desc'));
      th.classList.add(asc ? 'desc' : 'asc');
      const tb = tbl.querySelector('tbody');
      const rows = Array.from(tb.querySelectorAll('tr'));
      const type = colTypes[i] || 'text';
      rows.sort((a, b) => {
        const av = (a.cells[i] ? a.cells[i].innerText : '').trim();
        const bv = (b.cells[i] ? b.cells[i].innerText : '').trim();
        let d = 0;
        if (type === 'date') d = (DATE_ORDER.indexOf(av) || 0) - (DATE_ORDER.indexOf(bv) || 0);
        else if (type === 'period') d = pNum(av) - pNum(bv);
        else if (type === 'num') d = (parseFloat(av) || 0) - (parseFloat(bv) || 0);
        else d = av.localeCompare(bv);
        return asc ? -d : d;
      });
      rows.forEach(r => tb.appendChild(r));
    });
  });
}

function makeFilterableTable(searchId, resetId, countId, tableId) {
  const search = document.getElementById(searchId);
  const reset = document.getElementById(resetId);
  const count = document.getElementById(countId);
  const tbl = document.getElementById(tableId);
  if (!search || !tbl) return;

  function updateFilter() {
    const q = search.value.toLowerCase().trim();
    const rows = tbl.querySelectorAll('tbody tr');
    let shown = 0;
    rows.forEach(r => {
      const text = r.innerText.toLowerCase();
      const vis = !q || text.includes(q);
      r.style.display = vis ? '' : 'none';
      if (vis) shown++;
    });
    if (count) count.textContent = q ? `${shown} match${shown !== 1 ? 'es' : ''}` : `${shown} rows`;
  }

  search.addEventListener('input', updateFilter);
  if (reset) reset.addEventListener('click', () => { search.value = ''; updateFilter(); });
  updateFilter();
}

// ─── Render: Summary ─────────────────────────────────────────────────────────
function renderSummary() {
  const sessions = DATA.sessions || [];
  const activeSessions = sessions.filter(s => s.status !== 'cancelled');
  const latestDate = activeSessions.reduce((acc, s) => {
    return (s.date_iso || '') > acc ? (s.date_iso || '') : acc;
  }, '');
  const reprintCount = sessions.filter(s => s.reprint_codes === 'YES').length;
  const teacherCount = new Set(sessions.flatMap(s => [s.supervisor, s.start_leader].filter(Boolean))).size;

  const el = document.getElementById('summary-metrics');
  if (!el) return;
  el.innerHTML = `
    <div class="metric"><b>${activeSessions.length}</b><span>Active sessions</span></div>
    <div class="metric"><b>${sessions.length}</b><span>Total session records</span></div>
    <div class="metric"><b>${DAY_LABEL[latestDate] || latestDate}</b><span>Latest session</span></div>
    <div class="metric"><b>${reprintCount}</b><span>Reprint codes required</span></div>
    <div class="metric"><b>31</b><span>Protected triples</span></div>
    <div class="metric"><b>18</b><span>Room relocations</span></div>
  `;
}

// ─── Render: Full Schedule Table ─────────────────────────────────────────────
function renderFullSchedule() {
  const sessions = DATA.sessions || [];
  const el = document.getElementById('schedule-tbody');
  if (!el) return;

  const rows = sessions.map(s => {
    const rc = rowClass(s);
    return `<tr class="${rc}">
      <td>${esc(s.date)}</td>
      <td>${esc(s.session_code)}</td>
      <td>${esc(s.class)}</td>
      <td>${esc(s.grade)}</td>
      <td>${esc(s.test)}</td>
      <td>${esc(s.window)}</td>
      <td>${esc(s.testing_room)}</td>
      <td>${esc(s.start_leader)}</td>
      <td>${esc(s.supervisor)}</td>
      <td>${esc(s.normal_lessons_used)}</td>
      <td>${esc(s.relocations)}</td>
      <td>${esc(s.notes)}</td>
      <td>${s.reprint_codes === 'YES' ? '<span class="codes-note">REPRINT</span>' : ''}</td>
    </tr>`;
  }).join('');

  el.innerHTML = rows || '<tr><td colspan="13" style="text-align:center;color:var(--muted)">No sessions loaded</td></tr>';

  makeSortableTable('schedule-table', ['text','text','text','num','text','text','text','text','text','text','text','text','text']);
  makeFilterableTable('sched-search', 'sched-reset', 'sched-count', 'schedule-table');
}

// ─── Render: Cover / Subs ────────────────────────────────────────────────────
function renderCover() {
  const cover = DATA.cover || [];
  const el = document.getElementById('cover-tbody');
  if (!el) return;

  const rows = cover.map(c => {
    const rc = riskClass(c.risk) || (c.type.toLowerCase().includes('room move') ? 'roommoveevent' :
      c.type.toLowerCase().includes('manual') || c.type.toLowerCase().includes('handover') || c.type.toLowerCase().includes('affected') ? 'manualcoverevent' :
      c.type.toLowerCase().includes('start') || c.type.toLowerCase().includes('cover') ? 'coverevent' : '');
    return `<tr class="${rc}">
      <td>${esc(c.date)}</td>
      <td>${esc(c.period)}</td>
      <td><b>${esc(c.trigger_session)}</b></td>
      <td>${coverTypePill(c.type)}</td>
      <td>${esc(c.affected_class)}</td>
      <td>${esc(c.normal_lesson)}</td>
      <td>${esc(c.normal_teacher)}</td>
      <td>${esc(c.cover_destination)}</td>
      <td>${esc(c.instruction)}</td>
    </tr>`;
  }).join('');

  el.innerHTML = rows || '<tr><td colspan="9" style="text-align:center;color:var(--muted)">No cover records loaded</td></tr>';

  makeSortableTable('cover-table', ['text','text','text','text','text','text','text','text','text']);
  makeFilterableTable('cover-search', 'cover-reset', 'cover-count', 'cover-table');
}

// ─── Render: Leadership ───────────────────────────────────────────────────────
function renderLeadership() {
  const leadership = DATA.leadership || [];
  const el = document.getElementById('leadership-tbody');
  if (!el) return;

  const rows = leadership.map(l => {
    const rc = l.status === 'cancelled' ? 'cancelled-pt' :
               l.status === 'rescheduled' ? 'rescheduled-pt' :
               l.status === 'red' ? 'red-risk' : '';
    const loadBadge = l.mobile_load === 'RED' ? '<span class="flag-badge auth">RED</span>' :
                      l.mobile_load === 'Release' ? '<span class="flag-badge cover">Release</span>' :
                      l.mobile_load === 'Cover' ? '<span class="flag-badge cover">Cover</span>' :
                      l.mobile_load === 'Self' ? '<span class="flag-badge cover">Self</span>' :
                      esc(l.mobile_load);
    return `<tr class="${rc}">
      <td>${esc(l.date)}</td>
      <td>${esc(l.period)}</td>
      <td>${esc(l.leader)}</td>
      <td>${esc(l.responsibility)}</td>
      <td>${loadBadge}</td>
    </tr>`;
  }).join('');

  el.innerHTML = rows || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No leadership data loaded</td></tr>';

  makeSortableTable('leadership-table', ['text','text','text','text','text']);
  makeFilterableTable('ld-search', 'ld-reset', 'ld-count', 'leadership-table');
}

// ─── Render: Schedule Adjustments ────────────────────────────────────────────
function renderAdjustments() {
  const adj = DATA.adjustments || [];
  const el = document.getElementById('adjustments-tbody');
  if (!el) return;

  const rows = adj.map(a => {
    const rc = a.row_class || '';
    return `<tr class="${rc}">
      <td>${statusBadge(a.status)}</td>
      <td>${esc(a.original_session)}</td>
      <td>${esc(a.original_slot)}</td>
      <td>${esc(a.new_slot)}</td>
      <td>${esc(a.room)}</td>
      <td>${esc(a.affected_lesson)}</td>
      <td>${esc(a.operational_note)}${a.operational_note && a.operational_note.toLowerCase().includes('reprint') ? ' <span class="codes-note">REPRINT CODES</span>' : ''}</td>
    </tr>`;
  }).join('');

  el.innerHTML = rows || '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No adjustment records loaded</td></tr>';
}

// ─── Render: Concurrent Sessions ──────────────────────────────────────────────
function renderConcurrent() {
  const conc = DATA.concurrent || [];
  const el = document.getElementById('concurrent-tbody');
  if (!el) return;

  const sorted = [...conc].sort((a, b) => {
    const di = DATE_ORDER.indexOf(a.date_iso) - DATE_ORDER.indexOf(b.date_iso);
    if (di !== 0) return di;
    return pNum(a.period) - pNum(b.period);
  });

  const rows = sorted.map(c => {
    const cnt = parseInt(c.count) || 0;
    const highlight = cnt >= 3 ? ' style="font-weight:700;color:var(--red)"' : cnt >= 2 ? ' style="font-weight:700;color:#8a6100"' : '';
    return `<tr>
      <td>${esc(c.date)}</td>
      <td>${esc(c.period)}</td>
      <td${highlight}>${cnt}</td>
      <td>${esc(c.sessions)}</td>
    </tr>`;
  }).join('');

  el.innerHTML = rows || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No concurrent data loaded</td></tr>';
}

// ─── Render: Change Log ───────────────────────────────────────────────────────
function renderChangelog() {
  const changelog = DATA.changelog || [];
  const el = document.getElementById('changelog-tbody');
  if (!el) return;

  const rows = changelog.map(c => {
    const statusClass = c.status === 'Applied' ? 'review-status ok' : c.status === 'Partial' ? 'review-status partial' : 'review-status';
    return `<tr>
      <td>${esc(c.published_date)}</td>
      <td>${esc(c.version)}</td>
      <td>${esc(c.request)}</td>
      <td>${esc(c.change)}</td>
      <td>${esc(c.area)}</td>
      <td><span class="${statusClass}">${esc(c.status)}</span></td>
      <td>${esc(c.notes)}</td>
    </tr>`;
  }).join('');

  el.innerHTML = rows || '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No changelog records loaded</td></tr>';
}

// ─── Render: Timeline (day-separated staff-row view) ─────────────────────────
function renderTimeline() {
  const sessions = DATA.sessions || [];
  const leadership = DATA.leadership || [];
  const cover = DATA.cover || [];
  const el = document.getElementById('timeline-list');
  if (!el) return;

  // Group sessions by date
  const byDate = {};
  DATE_ORDER.forEach(d => { byDate[d] = []; });
  sessions.forEach(s => {
    if (s.date_iso && byDate[s.date_iso]) byDate[s.date_iso].push(s);
  });

  // Get leadership by date+period
  function getLeaders(dateIso, period) {
    return leadership.filter(l => l.date_iso === dateIso && l.period === period && l.status !== 'cancelled');
  }

  // Get all supervisors for a date
  function getSupervisors(dateIso) {
    const sups = new Set();
    byDate[dateIso].forEach(s => {
      if (s.supervisor && s.status !== 'cancelled') {
        s.supervisor.split(/[,/→]/).forEach(t => sups.add(t.trim()));
      }
    });
    return Array.from(sups).filter(Boolean);
  }

  // Get session type class
  function sessionClass(s) {
    const code = (s.session_code || '').toUpperCase();
    if (code.includes('PTEBOTH') || code.includes('PTE')) return 'cohort';
    if (code.includes('PTMBOTH')) return 'triple';
    if (code.includes('PTM')) return 'same';
    if (code.includes('PTS')) return 'ins';
    return 'other';
  }

  // Current day detection
  const todayIdx = DATE_ORDER.findIndex(d => d > TODAY_ISO);
  const currentDateIso = todayIdx > 0 ? DATE_ORDER[todayIdx - 1] : DATE_ORDER[DATE_ORDER.length - 1];

  // Past dates
  const pastDates = DATE_ORDER.filter(d => d < TODAY_ISO);
  const futureDates = DATE_ORDER.filter(d => d >= TODAY_ISO);

  function renderDayCard(dateIso, altClass, isCurrent, isCollapsed) {
    const daySessions = byDate[dateIso] || [];
    const activeSessions = daySessions.filter(s => s.status !== 'cancelled');
    const supervisors = getSupervisors(dateIso);
    const dayLabel = DAY_LABEL[dateIso] || dateIso;

    // Build period headers with leaders
    const periodHeaders = PERIODS.filter(p => p !== 'P6').map(p => {
      const leaders = getLeaders(dateIso, p);
      const leaderText = leaders.length
        ? leaders.map(l => l.leader + (l.mobile_load === 'Self' ? ' (Self)' : l.mobile_load === 'Release' ? ' (Release)' : l.mobile_load === 'RED' ? ' ⚠' : '')).join(', ')
        : '';
      return `<th><b>${p}</b>${leaderText ? `<span class="period-leaders">${esc(leaderText)}</span>` : ''}</th>`;
    }).join('');

    // Column layout: Name | P1 P2 P3 | BRK | P4 P5 | LUNCH | P7 P8 P9 P10  (12 cols)
    const colgroup = `<colgroup>
      <col class="staff-name-col"/>
      <col/><col/><col/>
      <col class="break-col"/>
      <col/><col/>
      <col class="lunch-col"/>
      <col/><col/><col/><col/>
    </colgroup>`;

    const thead = `<thead><tr>
      <th class="staff-head">Staff / Session</th>
      ${['P1','P2','P3'].map(p => {
        const leaders = getLeaders(dateIso, p);
        return `<th><b>${p}</b>${leaders.length ? `<span class="period-leaders">${esc(leaders.map(l=>l.leader).join(', '))}</span>` : ''}</th>`;
      }).join('')}
      <th class="break-head"><small>BRK</small></th>
      ${['P4','P5'].map(p => {
        const leaders = getLeaders(dateIso, p);
        return `<th><b>${p}</b>${leaders.length ? `<span class="period-leaders">${esc(leaders.map(l=>l.leader).join(', '))}</span>` : ''}</th>`;
      }).join('')}
      <th class="lunch-head"><small>LUNCH</small></th>
      ${['P7','P8','P9','P10'].map(p => {
        const leaders = getLeaders(dateIso, p);
        return `<th><b>${p}</b>${leaders.length ? `<span class="period-leaders">${esc(leaders.map(l=>l.leader).join(', '))}</span>` : ''}</th>`;
      }).join('')}
    </tr></thead>`;

    // Build session rows (one row per session for compact view)
    const sessionRows = activeSessions.map(s => {
      const sp = pNum(s.start_period), ep = pNum(s.end_period);
      const cls = sessionClass(s);
      const rowCls = s.status === 'rescheduled' ? 'rescheduled-pt' : '';

      const cells = ['P1','P2','P3','P4','P5','P7','P8','P9','P10'].map(p => {
        const pp = pNum(p);
        const inRange = pp >= sp && pp <= ep;
        const isStart = pp === sp;
        if (!inRange) return `<td class="staff-period-cell"></td>`;
        return `<td class="staff-period-cell staff-busy session-span">
          <span class="span-chip ${cls}${!isStart ? ' staff-continuation' : ''}">
            <span class="span-chip-top"><b>${isStart ? esc(s.session_code) : '↳ ' + esc(s.session_code)}</b><span>${esc(s.window)}</span></span>
            ${isStart ? `<small>${esc(s.testing_room)}${s.notes ? ' · ' + esc(s.notes.substring(0, 60)) : ''}</small>` : `<small>${esc(s.testing_room)}</small>`}
          </span>
        </td>`;
      });

      // Insert break and lunch cols
      const p3Idx = 2, p5Idx = 4;
      cells.splice(p5Idx + 1, 0, `<td class="lunch-gap"></td>`);
      cells.splice(p3Idx + 1, 0, `<td class="break-gap"></td>`);

      return `<tr class="${rowCls}">
        <th class="staff-row-name">${esc(s.session_code)}<small style="display:block;font-size:10px;font-weight:500;color:var(--muted)">${esc(s.class)} · G${esc(s.grade)}</small></th>
        ${cells.join('')}
      </tr>`;
    }).join('');

    const noSessions = activeSessions.length === 0
      ? `<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:16px">No active sessions this day</td></tr>`
      : '';

    const currentClass = isCurrent ? ' timeline-day-current' : isCollapsed ? ' timeline-day-collapsed' : '';
    const toggleLabel = isCurrent ? 'Today' : isCollapsed ? 'Expand' : 'Collapse';

    return `<div class="day-timeline-card ${altClass}${currentClass}" data-date="${dateIso}">
      <h3>
        ${dayLabel}
        ${activeSessions.length ? `<span style="font-size:11px;font-weight:500;color:var(--muted);margin-left:4px">${activeSessions.length} session${activeSessions.length !== 1 ? 's' : ''}</span>` : ''}
        <span class="timeline-day-toggle">${toggleLabel}</span>
      </h3>
      <table class="span-timeline day-timeline-table staff-row-table">
        ${colgroup}
        ${thead}
        <tbody>
          ${sessionRows}
          ${noSessions}
        </tbody>
      </table>
    </div>`;
  }

  let html = '';

  // Past days (collapsed in <details>)
  if (pastDates.length) {
    const pastHtml = pastDates.map((d, i) => renderDayCard(d, i % 2 === 0 ? 'day-alt-a' : 'day-alt-b', false, true)).join('');
    html += `<details class="past-days-details">
      <summary>Past days (${pastDates.length})</summary>
      <div class="past-days-inner">${pastHtml}</div>
    </details>`;
  }

  // Current and future days
  futureDates.forEach((d, i) => {
    const isCurrent = d === currentDateIso;
    html += renderDayCard(d, i % 2 === 0 ? 'day-alt-a' : 'day-alt-b', isCurrent, false);
  });

  el.innerHTML = html;

  // Toggle collapse on day header click
  document.querySelectorAll('#timeline-list .day-timeline-card h3').forEach(h3 => {
    h3.addEventListener('click', () => {
      const card = h3.closest('.day-timeline-card');
      card.classList.toggle('timeline-day-collapsed');
      const toggle = h3.querySelector('.timeline-day-toggle');
      if (toggle) toggle.textContent = card.classList.contains('timeline-day-collapsed') ? 'Expand' : 'Collapse';
    });
  });
}

// ─── Render: By Class ─────────────────────────────────────────────────────────
function renderByClass() {
  const sessions = DATA.sessions || [];
  const classes = [...new Set(sessions.map(s => s.class))].sort();
  const select = document.getElementById('classSelect');
  if (!select) return;

  select.innerHTML = '<option value="">— Select class —</option>' +
    classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  const container = document.getElementById('class-views-container');
  if (!container) return;

  container.innerHTML = classes.map(cls => {
    const clsSessions = sessions.filter(s => s.class === cls);
    const rows = clsSessions.map(s => {
      const rc = rowClass(s);
      return `<tr class="${rc}">
        <td>${esc(s.date)}</td>
        <td>${esc(s.session_code)}</td>
        <td>${esc(s.test)}</td>
        <td>${esc(s.window)}</td>
        <td>${esc(s.testing_room)}</td>
        <td>${esc(s.start_leader)}</td>
        <td>${esc(s.normal_lessons_used)}</td>
        <td>${esc(s.notes)}</td>
      </tr>`;
    }).join('');

    return `<div class="class-view" data-class="${esc(cls)}">
      <h3>Class ${esc(cls)} — PT sessions</h3>
      <div class="tablewrap">
        <table>
          <thead><tr>
            <th>Date</th><th>Session</th><th>Test</th><th>Window</th>
            <th>Room</th><th>Start Leader</th><th>Normal lessons affected</th><th>Notes</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  select.addEventListener('change', () => {
    const val = select.value;
    document.querySelectorAll('.class-view').forEach(el => {
      el.classList.toggle('active', el.dataset.class === val);
    });
  });
}

// ─── Render: By Teacher ───────────────────────────────────────────────────────
function normalizeName(raw) {
  // Strip parenthetical qualifiers like "(P8)", "(unavailable Shadow Day)" and trim
  return (raw || '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

function splitNames(field) {
  return (field || '').split(/[,/→]/).map(n => normalizeName(n)).filter(Boolean);
}

function renderByTeacher() {
  const sessions = DATA.sessions || [];
  const cover = DATA.cover || [];
  const leadership = DATA.leadership || [];

  // Collect all teacher names (normalized)
  const teacherSet = new Set();
  sessions.forEach(s => {
    splitNames(s.supervisor).forEach(n => teacherSet.add(n));
    splitNames(s.start_leader).forEach(n => teacherSet.add(n));
  });
  cover.forEach(c => {
    splitNames(c.normal_teacher).forEach(n => teacherSet.add(n));
  });
  leadership.forEach(l => {
    const n = normalizeName(l.leader);
    if (n && !['Cover needed', 'RED cover', 'Self'].some(x => n.includes(x))) {
      teacherSet.add(n);
    }
  });
  // Remove non-name artifacts
  ['unavailable', 'then Sarah', 'etc.', 'Sarah'].forEach(() => {});
  teacherSet.delete('David Barton unavailable');

  const teachers = [...teacherSet].filter(Boolean).sort();
  const select = document.getElementById('teacherSelect');
  if (!select) return;

  select.innerHTML = '<option value="">— Select teacher —</option>' +
    teachers.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');

  const container = document.getElementById('teacher-views-container');
  if (!container) return;

  container.innerHTML = teachers.map(teacher => {
    const tSessions = sessions.filter(s => {
      return splitNames(s.supervisor).includes(teacher) ||
             splitNames(s.start_leader).includes(teacher);
    });

    const tLeadership = leadership.filter(l => normalizeName(l.leader) === teacher || normalizeName(l.leader).includes(teacher));
    const tCover = cover.filter(c => splitNames(c.normal_teacher).includes(teacher));

    const sessionRows = tSessions.map(s => {
      const rc = rowClass(s);
      const role = splitNames(s.supervisor).includes(teacher) ? 'Supervisor' : 'Start Leader';
      return `<tr class="${rc}">
        <td>${esc(s.date)}</td><td>${esc(s.session_code)}</td><td>${esc(s.window)}</td>
        <td>${esc(role)}</td><td>${esc(s.testing_room)}</td><td>${esc(s.notes)}</td>
      </tr>`;
    }).join('');

    const leaderRows = tLeadership.map(l => {
      const rc = l.status === 'cancelled' ? 'cancelled-pt' : l.status === 'red' ? 'red-risk' : '';
      return `<tr class="${rc}">
        <td>${esc(l.date)}</td><td>${esc(l.period)}</td><td>${esc(l.responsibility)}</td><td>${esc(l.mobile_load)}</td>
      </tr>`;
    }).join('');

    const coverRows = tCover.map(c => {
      return `<tr>
        <td>${esc(c.date)}</td><td>${esc(c.period)}</td><td>${esc(c.trigger_session)}</td>
        <td>${esc(c.affected_class)}</td><td>${esc(c.instruction)}</td>
      </tr>`;
    }).join('');

    return `<div class="teacher-view" data-teacher="${esc(teacher)}">
      <h3>${esc(teacher)}</h3>
      <p class="teacher-summary">${tSessions.length} session(s) · ${tLeadership.length} leadership assignment(s) · ${tCover.length} cover note(s)</p>

      ${tSessions.length ? `<h4>Sessions</h4>
      <div class="tablewrap"><table>
        <thead><tr><th>Date</th><th>Session</th><th>Window</th><th>Role</th><th>Room</th><th>Notes</th></tr></thead>
        <tbody>${sessionRows}</tbody>
      </table></div>` : ''}

      ${tLeadership.length ? `<h4>Leadership assignments</h4>
      <div class="tablewrap"><table>
        <thead><tr><th>Date</th><th>Period</th><th>Responsibility</th><th>Load</th></tr></thead>
        <tbody>${leaderRows}</tbody>
      </table></div>` : ''}

      ${tCover.length ? `<h4>Cover / affected lessons</h4>
      <div class="tablewrap"><table>
        <thead><tr><th>Date</th><th>Period</th><th>Trigger</th><th>Affected class</th><th>Instruction</th></tr></thead>
        <tbody>${coverRows}</tbody>
      </table></div>` : ''}
    </div>`;
  }).join('');

  select.addEventListener('change', () => {
    const val = select.value;
    document.querySelectorAll('.teacher-view').forEach(el => {
      el.classList.toggle('active', el.dataset.teacher === val);
    });
  });
}

// ─── Update Header ────────────────────────────────────────────────────────────
function updateHeader() {
  const meta = DATA.meta || {};
  const h1 = document.querySelector('header h1');
  const desc = document.querySelector('header p');
  if (h1 && meta.title) h1.textContent = meta.title;
  if (desc && meta.description) desc.textContent = meta.description;
  const versionEl = document.getElementById('meta-version');
  if (versionEl) versionEl.textContent = `v${meta.version || '—'} · ${meta.published_date || '—'}`;
}

// ─── Export Functions ─────────────────────────────────────────────────────────
function exportClass() {
  const val = document.getElementById('classSelect').value;
  const el = document.querySelector(`.class-view[data-class="${CSS.escape(val)}"]`);
  if (!el) return;
  const w = window.open('', '_blank');
  w.document.write('<html><head><title>' + val + ' PT Class View</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:left}.cancelled-pt td{color:#b42318;text-decoration:line-through}</style></head><body>' + el.outerHTML + '</body></html>');
  w.document.close(); w.print();
}

function exportTeacher() {
  const val = document.getElementById('teacherSelect').value;
  const el = document.querySelector(`.teacher-view[data-teacher="${CSS.escape(val)}"]`);
  if (!el) return;
  const w = window.open('', '_blank');
  w.document.write('<html><head><title>' + val + ' PT Teacher View</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body>' + el.outerHTML + '</body></html>');
  w.document.close(); w.print();
}

// Expose to window for inline onclick handlers
window.exportClass = exportClass;
window.exportTeacher = exportTeacher;

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  await loadAll();
  updateHeader();
  renderSummary();
  renderTimeline();
  renderFullSchedule();
  renderCover();
  renderLeadership();
  renderAdjustments();
  renderConcurrent();
  renderChangelog();
  renderByClass();
  renderByTeacher();
  initTabs();
}

document.addEventListener('DOMContentLoaded', boot);
