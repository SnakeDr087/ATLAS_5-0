// ============================================================================
// ATLAS — scoring.js  (v5.2)
// SINGLE SOURCE OF TRUTH for outcome-based performance scoring + charts.
//
//   Performance Score = round( (no_action + commendation) / total * 100 )
//   Whole numbers. No partial weights. No penalties.
//
// Guardrail: only canonical review_outcome enum values participate. Unknown
// values grow the denominator but can never count as positive.
//
// kpi_score (observed frequency) is a SEPARATE per-review metric.
//
// Acceptance vector: [NA, NA, Comm, Training, Coaching] → 5 / 3 / 60.
// ============================================================================
import { supabase } from './supabase-client.js';
import { OfficerSearch } from './officer-search.js';
import { escHtml, escAttr, showError, toast } from './error-handler.js';

// ---------------------------------------------------------------- canonical
export const OUTCOME_CLASSIFICATION = {
  no_action:        'positive',
  commendation:     'positive',
  coaching:         'corrective',
  training:         'corrective',
  internal_affairs: 'corrective',
  pip:              'corrective',
};
export const POSITIVE_OUTCOMES = ['no_action', 'commendation'];
export const OUTCOME_LABELS = {
  no_action: 'No Action', commendation: 'Commendation', coaching: 'Coaching',
  training: 'Training', internal_affairs: 'Internal Affairs', pip: 'PIP',
};
// Chart palette — grouped: Positive (greens) / Development (ambers) /
// Accountability (red, purple). Fixed hexes for chart legibility.
export const OUTCOME_COLORS = {
  no_action: '#2e9e5b', commendation: '#19b8a6', coaching: '#e0a622',
  training: '#e07b22', internal_affairs: '#d64545', pip: '#8a4fc9',
};

export function classifyOutcome(outcome) {
  return OUTCOME_CLASSIFICATION[outcome] || 'corrective';
}

// ---------------------------------------------------------------- compute
export function computeScorePackage(reviews) {
  const rows = Array.isArray(reviews) ? reviews : [];
  const distribution = { no_action: 0, commendation: 0, coaching: 0, training: 0, internal_affairs: 0, pip: 0 };
  let positive = 0;
  for (const r of rows) {
    const o = r?.follow_up_outcome;
    if (o in distribution) {
      distribution[o] += 1;
      if (classifyOutcome(o) === 'positive') positive += 1;
    }
  }
  const total = rows.length;
  return {
    total_reviews: total,
    positive_reviews: positive,
    positive_percentage: total ? Math.round((positive / total) * 100) : null,
    distribution,
  };
}

// ---------------------------------------------------------------- RPC (RLS-safe)
export async function fetchAgencyScore(agencyId) {
  const { data, error } = await supabase.rpc('agency_score_package', { p_agency_id: agencyId });
  if (error) throw error; return data;
}
export async function fetchOfficerScore(officerId) {
  const { data, error } = await supabase.rpc('officer_score_package', { p_officer_id: officerId });
  if (error) throw error; return data;
}
export async function fetchGroupScore(officerIds) {
  const { data, error } = await supabase.rpc('group_score_package', { p_officer_ids: officerIds });
  if (error) throw error; return data;
}
export async function fetchMonthlySeries(agencyId, months = 8) {
  const { data, error } = await supabase.rpc('monthly_score_series', { p_agency_id: agencyId, p_months: months });
  if (error) throw error; return data || [];
}
export async function fetchOfficerScoreTable(agencyId, officerIds = null) {
  const { data, error } = await supabase.rpc('agency_officer_scores', { p_agency_id: agencyId, p_officer_ids: officerIds });
  if (error) throw error; return data || [];
}

// ---------------------------------------------------------------- tones
export function scoreTone(pct, threshold = 80) {
  if (pct === null || pct === undefined) return '';
  if (pct >= threshold) return 'success';
  if (pct >= 65) return 'warning';
  return 'danger';
}
const TONE_HEX = { success: '#2e9e5b', warning: '#e0a622', danger: '#d64545', '': '#7a869a' };

// ============================================================================
// SVG CHART COMPONENTS — no libraries, all inline.
// ============================================================================

// Donut — agency headline score
export function renderDonut(pkg, { threshold = 80, size = 150 } = {}) {
  const pct = pkg.positive_percentage;
  const hex = TONE_HEX[scoreTone(pct, threshold)];
  const r = 56, c = 2 * Math.PI * r;
  const filled = pct === null ? 0 : (pct / 100) * c;
  return `
    <svg viewBox="0 0 140 140" width="${size}" height="${size}" role="img" aria-label="Performance score donut">
      <defs><filter id="sp-donut-shadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
      </filter></defs>
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--bg-elevated)" stroke-width="16"/>
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="${hex}" stroke-width="16" filter="url(#sp-donut-shadow)"
              stroke-dasharray="${filled.toFixed(1)} ${c.toFixed(1)}" stroke-linecap="round"
              transform="rotate(-90 70 70)"/>
      <text x="70" y="66" text-anchor="middle" font-size="26" font-weight="700" fill="currentColor">
        ${pct === null ? '—' : pct + '%'}</text>
      <text x="70" y="86" text-anchor="middle" font-size="10" fill="var(--text-muted)">
        ${pkg.positive_reviews} / ${pkg.total_reviews} reviews</text>
    </svg>`;
}

// Vertical outcome columns
const OUTCOME_ABBR = {
  no_action: 'No Act.', commendation: 'Comm.', coaching: 'Coach.',
  training: 'Train.', internal_affairs: 'IA', pip: 'PIP',
};
export function renderOutcomeColumns(pkg, { width = 340, height = 175 } = {}) {
  const codes = Object.keys(OUTCOME_LABELS);
  const max = Math.max(1, ...codes.map((c) => pkg.distribution?.[c] || 0));
  const pad = 24, bw = (width - pad * 2) / codes.length;
  const bars = codes.map((code, i) => {
    const n = pkg.distribution?.[code] || 0;
    const h = Math.round((n / max) * (height - 55));
    const x = pad + i * bw;
    return `
      <rect x="${(x + bw * 0.18).toFixed(1)}" y="${height - 35 - h}" width="${(bw * 0.64).toFixed(1)}" height="${h}"
            rx="3" fill="${OUTCOME_COLORS[code]}" filter="url(#sp-shadow)">
        <title>${escHtml(OUTCOME_LABELS[code])}: ${n}</title></rect>
      <text x="${(x + bw / 2).toFixed(1)}" y="${height - 40 - h}" text-anchor="middle" font-size="10" fill="currentColor">${n || ''}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${height - 20}" text-anchor="middle" font-size="8.5" fill="var(--text-muted)">
        ${escHtml(OUTCOME_ABBR[code])}</text>`;
  }).join('');
  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%; max-width:${width + 60}px;" role="img" aria-label="Outcome distribution">
      <defs><filter id="sp-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.28"/>
      </filter></defs>
      ${bars}
      <line x1="${pad - 6}" y1="${height - 35}" x2="${width - pad + 6}" y2="${height - 35}" stroke="var(--border)"/>
    </svg>
    <div style="display:flex; gap:14px; flex-wrap:wrap; font-size:11px; margin-top:4px;">
      <span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#2e9e5b;"></i> Positive: No Action &amp; Commendation</span>
      <span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#e0a622;"></i> Development: Coaching &amp; Training</span>
      <span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#d64545;"></i> Accountability: IA &amp; PIP</span>
    </div>`;
}

// Monthly positive-ratio line chart
export function renderMonthlyLine(series, { width = 560, height = 150, threshold = 80 } = {}) {
  const pad = 30;
  const pts = (series || []).filter((m) => m.total > 0);
  if (pts.length < 2) {
    return `<p class="text-muted" style="font-size:12px;">Not enough monthly data yet — the trend line appears once reviews span two or more months.</p>`;
  }
  const x = (i) => pad + (i * (width - pad * 2)) / (pts.length - 1);
  const y = (p) => height - 24 - (p / 100) * (height - 44);
  const line = pts.map((m, i) => `${x(i).toFixed(1)},${y(m.pct).toFixed(1)}`).join(' ');
  const ty = y(threshold).toFixed(1);
  const labels = pts.map((m, i) => `
    <text x="${x(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="8.5" fill="var(--text-muted)">${escHtml(m.month.slice(5))}/${escHtml(m.month.slice(2, 4))}</text>`).join('');
  const dots = pts.map((m, i) => `
    <circle cx="${x(i).toFixed(1)}" cy="${y(m.pct).toFixed(1)}" r="3" fill="var(--accent)"/>
    <text x="${x(i).toFixed(1)}" y="${(y(m.pct) - 7).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="currentColor">${m.pct}%</text>`).join('');
  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;" role="img" aria-label="Monthly performance ratio">
      <line x1="${pad}" y1="${ty}" x2="${width - pad}" y2="${ty}" stroke="var(--warning)" stroke-dasharray="4 4" opacity="0.6"/>
      <text x="${width - pad + 2}" y="${ty}" font-size="8" fill="var(--warning)">${threshold}%</text>
      <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" style="filter: drop-shadow(0 2px 2px rgba(0,0,0,0.25));"/>
      ${dots}${labels}
    </svg>`;
}

// Tiny per-officer distribution bars for the ranking table
export function renderMiniBars(distribution, { width = 120, height = 26 } = {}) {
  const codes = Object.keys(OUTCOME_LABELS);
  const max = Math.max(1, ...codes.map((c) => distribution?.[c] || 0));
  const bw = width / codes.length;
  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Officer outcome mix" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));">
      ${codes.map((code, i) => {
        const n = distribution?.[code] || 0;
        const h = Math.max(n ? 3 : 0, Math.round((n / max) * (height - 4)));
        return `<rect x="${(i * bw + 2).toFixed(1)}" y="${height - h}" width="${(bw - 4).toFixed(1)}" height="${h}" rx="1.5" fill="${OUTCOME_COLORS[code]}"><title>${escHtml(OUTCOME_LABELS[code])}: ${n}</title></rect>`;
      }).join('')}
    </svg>`;
}

// Horizontal comparison bars (Custom Group vs Agency vs Squad)
export function renderComparisonBars(rows) {
  const items = rows.filter((r) => r && r.pct !== null && r.pct !== undefined);
  if (!items.length) return '';
  return `
    <div style="margin-top:12px;">
      ${items.map((r) => `
        <div style="display:grid; grid-template-columns:130px 1fr 46px; gap:8px; align-items:center; margin-bottom:8px;">
          <span class="text-secondary" style="font-size:12px;">${escHtml(r.label)}</span>
          <div style="background:var(--bg-elevated); border-radius:5px; height:14px; overflow:hidden;">
            <div style="width:${Math.max(0, Math.min(100, r.pct))}%; height:100%; background:${r.color}; border-radius:5px; box-shadow:0 2px 3px rgba(0,0,0,0.25);"></div>
          </div>
          <strong style="font-size:12px; text-align:right;">${r.pct}%</strong>
        </div>`).join('')}
    </div>`;
}

// ============================================================================
// mountScoringPanel — top-of-dashboard scoring section (mock layout):
//   Row 1: donut + legend | outcome columns | ranked officer table w/ search
//   Row 2: monthly trend line | ad-hoc group builder + comparison bars
// ============================================================================
export async function mountScoringPanel(container, { profile, agencyId, threshold = 80 }) {
  const isSupervisor = profile.role === 'supervisor';
  container.innerHTML = `
    <div class="card" style="max-width:1240px; margin:0 auto; box-shadow:0 4px 14px rgba(13,23,38,0.10);">
      <h2 class="card-title">Performance Scoring</h2>
      <p class="card-sub" style="margin:4px 0 14px;">
        Positive-outcome ratio: (No Action + Commendation) ÷ total reviews. Whole-number percentage.
      </p>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:28px; align-items:start; justify-items:center;">
        <div style="text-align:center; width:100%; max-width:420px;">
          <div id="sp-donut"><div class="state-block"><div class="spinner"></div></div></div>
          <div style="font-weight:700; font-size:13px; letter-spacing:0.04em;">AGENCY PERFORMANCE SCORE</div>
          <div id="sp-donut-sub" class="text-muted" style="font-size:12px;"></div>
          <div id="sp-squad-line" class="text-secondary" style="font-size:12px; margin-top:4px;"></div>
        </div>
        <div style="width:100%; max-width:440px;">
          <h3 class="card-title" style="font-size:13px;">Outcome Distribution</h3>
          <div id="sp-columns"></div>
        </div>
        <div style="width:100%; max-width:440px;">
          <h3 class="card-title" style="font-size:13px;">Individual Officer Score</h3>
          <input id="sp-officer-filter" placeholder="Search officer…" style="width:100%; margin-bottom:8px;"/>
          <div id="sp-officer-table" style="max-height:260px; overflow-y:auto;">
            <div class="state-block"><div class="spinner"></div></div>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:28px; margin-top:24px; justify-items:center;">
        <div style="width:100%; max-width:560px;">
          <h3 class="card-title" style="font-size:13px;">Monthly Performance Ratio</h3>
          <div id="sp-monthly"><div class="state-block"><div class="spinner"></div></div></div>
        </div>
        <div style="width:100%; max-width:440px;">
          <h3 class="card-title" style="font-size:13px;">Group Score (ad-hoc)</h3>
          <div id="sp-group-search"></div>
          <div id="sp-group-tags" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
          <button class="btn btn-primary btn-sm" type="button" id="sp-group-run" style="margin-top:10px;">Compute Group Score</button>
          <div id="sp-group-result" style="margin-top:6px;"></div>
        </div>
      </div>
    </div>`;

  let agencyPkg = null, squadPkg = null, squadIds = null;

  // --- squad ids (supervisor) ------------------------------------------------
  if (isSupervisor) {
    const { data: rosterRows } = await supabase.from('supervisor_rosters')
      .select('officer_id').eq('supervisor_id', profile.id);
    squadIds = (rosterRows || []).map((r) => r.officer_id);
  }

  // --- headline: donut + columns ----------------------------------------------
  (async () => {
    try {
      agencyPkg = await fetchAgencyScore(agencyId);
      container.querySelector('#sp-donut').innerHTML = renderDonut(agencyPkg, { threshold });
      container.querySelector('#sp-donut-sub').textContent =
        `${agencyPkg.positive_percentage ?? '—'}% · ${agencyPkg.positive_reviews} positive / ${agencyPkg.total_reviews} total reviews`;
      container.querySelector('#sp-columns').innerHTML = renderOutcomeColumns(agencyPkg);
      if (isSupervisor && squadIds?.length) {
        squadPkg = await fetchGroupScore(squadIds);
        container.querySelector('#sp-squad-line').textContent =
          `My Squad: ${squadPkg.positive_percentage ?? '—'}% (${squadPkg.positive_reviews}/${squadPkg.total_reviews})`;
      }
    } catch (e) {
      container.querySelector('#sp-donut').innerHTML = '';
      showError(e, 'Agency score');
    }
  })();

  // --- ranked officer table ----------------------------------------------------
  let officerRows = [];
  function paintOfficerTable() {
    const el = container.querySelector('#sp-officer-table');
    const q = container.querySelector('#sp-officer-filter').value.trim().toLowerCase();
    const rows = officerRows.filter((o) =>
      !q || `${o.first_name} ${o.last_name} ${o.badge_number}`.toLowerCase().includes(q));
    if (!rows.length) {
      el.innerHTML = '<p class="text-muted" style="font-size:12px;">No officers match.</p>';
      return;
    }
    el.innerHTML = `
      <table class="data" style="font-size:12px;">
        <thead><tr><th>#</th><th>Name</th><th>Outcome Mix</th><th>Score</th></tr></thead>
        <tbody>
          ${rows.map((o, i) => {
            const tone = scoreTone(o.pct, threshold);
            const suffixParam = profile.role === 'super_admin'
              ? `&agency_id=${encodeURIComponent(agencyId)}` : '';
            return `
              <tr>
                <td>${i + 1}</td>
                <td><a href="officer-profile.html?officer_id=${encodeURIComponent(o.officer_id)}${suffixParam}">
                  ${escHtml(`${o.last_name}, ${o.first_name}`)}</a>
                  <span class="text-muted">#${escHtml(o.badge_number || '')}</span></td>
                <td>${renderMiniBars(o.distribution)}</td>
                <td><span class="pill pill-${tone || 'accent'}">${o.pct === null ? '—' : o.pct + '%'}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }
  (async () => {
    try {
      officerRows = await fetchOfficerScoreTable(agencyId, isSupervisor ? squadIds : null);
      paintOfficerTable();
    } catch (e) {
      container.querySelector('#sp-officer-table').innerHTML = '';
      showError(e, 'Officer scores');
    }
  })();
  container.querySelector('#sp-officer-filter').addEventListener('input', paintOfficerTable);

  // --- monthly trend -------------------------------------------------------------
  (async () => {
    try {
      const series = await fetchMonthlySeries(agencyId, 8);
      container.querySelector('#sp-monthly').innerHTML = renderMonthlyLine(series, { threshold });
    } catch (e) {
      container.querySelector('#sp-monthly').innerHTML = '';
      showError(e, 'Monthly trend');
    }
  })();

  // --- ad-hoc group builder --------------------------------------------------------
  const group = new Map();
  const tagsEl = container.querySelector('#sp-group-tags');

  function renderTags() {
    tagsEl.innerHTML = [...group.values()].map((o) => `
      <span class="pill pill-accent" style="display:inline-flex; align-items:center; gap:4px;">
        ${escHtml(`${o.last_name}, ${o.first_name}`)}
        <button type="button" data-rm="${escAttr(o.id)}" aria-label="Remove"
          style="background:none;border:none;color:inherit;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;">×</button>
      </span>`).join('') || '<span class="text-muted" style="font-size:12px;">Add two or more officers…</span>';
  }
  // Event delegation — ONE persistent listener; survives every re-render.
  // (v5.1 bound per-button listeners that could be lost, making tags undeletable.)
  tagsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rm]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    group.delete(btn.dataset.rm);
    renderTags();
  });
  renderTags();

  let groupSearch;
  groupSearch = new OfficerSearch(container.querySelector('#sp-group-search'), {
    agencyId,
    supervisorId: isSupervisor ? profile.id : null,
    activeOnly: false,
    placeholder: 'Add officer to group…',
    onSelect: (officer) => {
      if (!officer) return; // clear() fires onSelect(null) — ignore
      group.set(officer.id, officer);
      renderTags();
      // Reset the component immediately so the input returns and the next
      // officer can be added — without this the search box disappears after
      // the first pick and the group can never grow or be edited.
      groupSearch.clear();
    },
  });

  container.querySelector('#sp-group-run').addEventListener('click', async () => {
    const out = container.querySelector('#sp-group-result');
    if (!group.size) { toast('Add at least one officer to the group.', 'error'); return; }
    out.innerHTML = '<div class="state-block"><div class="spinner"></div></div>';
    try {
      const pkg = await fetchGroupScore([...group.keys()]);
      out.innerHTML = renderComparisonBars([
        { label: `Custom Group (${group.size})`, pct: pkg.positive_percentage, color: '#2e9e5b' },
        agencyPkg ? { label: 'Agency', pct: agencyPkg.positive_percentage, color: '#2f6bd8' } : null,
        squadPkg ? { label: 'My Squad', pct: squadPkg.positive_percentage, color: '#8a4fc9' } : null,
      ]) + `<div class="text-muted" style="font-size:11px;">${pkg.positive_reviews} positive / ${pkg.total_reviews} reviews in group</div>`;
    } catch (e) { out.innerHTML = ''; showError(e, 'Group score'); }
  });
}

// ---------------------------------------------------------------- acceptance
export function verifyAcceptanceVector() {
  const input = [
    { follow_up_outcome: 'no_action' }, { follow_up_outcome: 'no_action' },
    { follow_up_outcome: 'commendation' }, { follow_up_outcome: 'training' },
    { follow_up_outcome: 'coaching' },
  ];
  const out = computeScorePackage(input);
  const pass = out.total_reviews === 5 && out.positive_reviews === 3 && out.positive_percentage === 60;
  return { pass, out };
}
