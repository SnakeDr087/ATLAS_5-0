// ============================================================================
// ATLAS — scoring.js
// SINGLE SOURCE OF TRUTH for outcome-based performance scoring.
//
// The Performance Score is a positive-outcome ratio:
//     score = round( (no_action + commendation) / total_reviews * 100 )
// Whole numbers. No partial weights. No penalties — corrective outcomes
// simply grow the denominator.
//
// Guardrail: only canonical review_outcome enum values participate. The DB
// enum physically prevents non-canonical values; anything unexpected that
// reaches this module is counted as non-positive (never as positive).
//
// The per-review kpi_score (observed / (observed + not_observed)) is a
// SEPARATE metric — an observation-frequency score shown on review rows and
// in searches. It does not feed this module.
//
// Acceptance test vector (see verifyAcceptanceVector below):
//   input : [No Action, No Action, Commendation, Training, Coaching]
//   output: { total_reviews: 5, positive_reviews: 3, positive_percentage: 60 }
// ============================================================================

// Canonical classification — keys are the review_outcome enum values.
export const OUTCOME_CLASSIFICATION = {
  no_action:        'positive',
  commendation:     'positive',
  coaching:         'corrective',
  training:         'corrective',
  internal_affairs: 'corrective',
  pip:              'corrective',
};

export const POSITIVE_OUTCOMES = Object.keys(OUTCOME_CLASSIFICATION)
  .filter((k) => OUTCOME_CLASSIFICATION[k] === 'positive');

export function classifyOutcome(outcome) {
  return OUTCOME_CLASSIFICATION[outcome] || 'corrective'; // unknown → never positive
}

// ---------------------------------------------------------------------------
// computeScorePackage — the "fully baked" distribution package.
// Accepts an array of reviews (each with .follow_up_outcome) already loaded
// on the client. For RLS-safe aggregates over data the caller can't read
// row-by-row, use the fetch* RPC wrappers below instead.
// ---------------------------------------------------------------------------
export function computeScorePackage(reviews) {
  const rows = Array.isArray(reviews) ? reviews : [];
  const distribution = {
    no_action: 0, commendation: 0, coaching: 0,
    training: 0, internal_affairs: 0, pip: 0,
  };
  let positive = 0;
  for (const r of rows) {
    const o = r?.follow_up_outcome;
    if (o in distribution) distribution[o] += 1;
    if (classifyOutcome(o) === 'positive' && (o in distribution)) positive += 1;
  }
  const total = rows.length;
  return {
    total_reviews: total,
    positive_reviews: positive,
    positive_percentage: total ? Math.round((positive / total) * 100) : null,
    distribution,
  };
}

// ---------------------------------------------------------------------------
// RLS-safe aggregate fetchers.
// These call SECURITY DEFINER functions (migration-outcome-score.sql) that
// return ONLY aggregate packages — no confidential row data — so every
// agency role (including supervisors, who can't read other reviewers' rows)
// gets the same correct number.
// ---------------------------------------------------------------------------
import { supabase } from './supabase-client.js';

export async function fetchAgencyScore(agencyId) {
  const { data, error } = await supabase.rpc('agency_score_package', { p_agency_id: agencyId });
  if (error) throw error;
  return data;
}

export async function fetchOfficerScore(officerId) {
  const { data, error } = await supabase.rpc('officer_score_package', { p_officer_id: officerId });
  if (error) throw error;
  return data;
}

export async function fetchGroupScore(officerIds) {
  const { data, error } = await supabase.rpc('group_score_package', { p_officer_ids: officerIds });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Shared render helpers — one visual language for score packages everywhere.
// ---------------------------------------------------------------------------
import { escHtml } from './error-handler.js';

export const OUTCOME_LABELS = {
  no_action: 'No Action', commendation: 'Commendation', coaching: 'Coaching',
  training: 'Training', internal_affairs: 'Internal Affairs', pip: 'PIP',
};

export function scoreTone(pct, threshold = 80) {
  if (pct === null || pct === undefined) return '';
  if (pct >= threshold) return 'success';
  if (pct >= 65) return 'warning';
  return 'danger';
}

// Big score number + supporting counts
export function renderScoreCard(pkg, { title, threshold = 80, sub = '' } = {}) {
  const pct = pkg.positive_percentage;
  return `
    <div class="stat ${scoreTone(pct, threshold)}">
      <div class="stat-value">${pct === null ? '—' : escHtml(String(pct)) + '%'}</div>
      <div class="stat-label">${escHtml(title || 'Performance Score')}</div>
      <div class="text-muted" style="font-size:11px; margin-top:4px;">
        ${escHtml(String(pkg.positive_reviews))} positive / ${escHtml(String(pkg.total_reviews))} reviews${sub ? ' · ' + escHtml(sub) : ''}
      </div>
    </div>`;
}

// Horizontal distribution bars for the full package
export function renderDistribution(pkg) {
  const total = pkg.total_reviews || 0;
  const tone = { no_action: 'var(--success)', commendation: 'var(--success)',
                 coaching: 'var(--warning)', training: 'var(--warning)',
                 internal_affairs: 'var(--danger)', pip: 'var(--danger)' };
  return `
    <div>
      ${Object.entries(OUTCOME_LABELS).map(([code, label]) => {
        const n = pkg.distribution?.[code] || 0;
        const w = total ? Math.round((n / total) * 100) : 0;
        return `
          <div style="display:grid; grid-template-columns:130px 1fr 40px; gap:8px; align-items:center; margin-bottom:6px;">
            <span class="text-secondary" style="font-size:12px;">${escHtml(label)}</span>
            <div style="background:var(--bg-elevated); border-radius:4px; height:10px; overflow:hidden;">
              <div style="width:${w}%; height:100%; background:${tone[code]};"></div>
            </div>
            <span style="font-size:12px; text-align:right;">${n}</span>
          </div>`;
      }).join('')}
    </div>`;
}

// ---------------------------------------------------------------------------
// mountScoringPanel — the dashboard scoring section.
// Agency-wide score + distribution, searchable individual officer score,
// and an ad-hoc group builder (multi-add officers → group score package).
// Works for every agency role; supervisors' officer search is scoped to
// their own roster, and they get a "My Squad" card automatically.
// ---------------------------------------------------------------------------
import { OfficerSearch } from './officer-search.js';
import { escAttr, showError, toast } from './error-handler.js';

export async function mountScoringPanel(container, { profile, agencyId, threshold = 80 }) {
  const isSupervisor = profile.role === 'supervisor';
  container.innerHTML = `
    <div class="card" style="margin-top:20px;">
      <h2 class="card-title">Performance Scoring</h2>
      <p class="card-sub" style="margin:4px 0 14px;">
        Positive-outcome ratio: (No Action + Commendation) ÷ total reviews. Whole-number percentage.
      </p>
      <div class="stat-grid" id="sp-agency-cards"><div class="state-block"><div class="spinner"></div></div></div>
      <div id="sp-agency-dist" style="max-width:520px; margin-top:10px;"></div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:20px; margin-top:20px;">
        <div>
          <h3 class="card-title" style="font-size:14px;">Individual Officer Score</h3>
          <div id="sp-officer-search"></div>
          <div id="sp-officer-result" style="margin-top:12px;"></div>
        </div>
        <div>
          <h3 class="card-title" style="font-size:14px;">Group Score (ad-hoc)</h3>
          <div id="sp-group-search"></div>
          <div id="sp-group-tags" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
          <button class="btn btn-primary btn-sm" id="sp-group-run" style="margin-top:10px;">Compute Group Score</button>
          <div id="sp-group-result" style="margin-top:12px;"></div>
        </div>
      </div>
    </div>`;

  // --- Agency-wide (+ squad for supervisors) --------------------------------
  (async () => {
    const cards = container.querySelector('#sp-agency-cards');
    try {
      const agencyPkg = await fetchAgencyScore(agencyId);
      let squadHtml = '';
      if (isSupervisor) {
        const { data: rosterRows } = await supabase.from('supervisor_rosters')
          .select('officer_id').eq('supervisor_id', profile.id);
        const ids = (rosterRows || []).map((r) => r.officer_id);
        if (ids.length) {
          const squadPkg = await fetchGroupScore(ids);
          squadHtml = renderScoreCard(squadPkg, { title: 'My Squad Score', threshold });
        }
      }
      cards.innerHTML = renderScoreCard(agencyPkg, { title: 'Agency Performance Score', threshold }) + squadHtml;
      container.querySelector('#sp-agency-dist').innerHTML = renderDistribution(agencyPkg);
    } catch (e) {
      cards.innerHTML = '';
      showError(e, 'Agency score');
    }
  })();

  // --- Individual officer lookup ---------------------------------------------
  new OfficerSearch(container.querySelector('#sp-officer-search'), {
    agencyId,
    supervisorId: isSupervisor ? profile.id : null,
    activeOnly: false, // scoring history is valid for inactive officers too
    placeholder: 'Search officer…',
    onSelect: async (officer) => {
      const out = container.querySelector('#sp-officer-result');
      if (!officer) { out.innerHTML = ''; return; }
      out.innerHTML = '<div class="state-block"><div class="spinner"></div></div>';
      try {
        const pkg = await fetchOfficerScore(officer.id);
        out.innerHTML = `
          <div class="stat-grid">${renderScoreCard(pkg, {
            title: `${officer.last_name}, ${officer.first_name}`, threshold,
          })}</div>
          <div style="max-width:480px; margin-top:10px;">${renderDistribution(pkg)}</div>`;
      } catch (e) { out.innerHTML = ''; showError(e, 'Officer score'); }
    },
  });

  // --- Ad-hoc group builder ---------------------------------------------------
  const group = new Map(); // id → officer
  const tagsEl = container.querySelector('#sp-group-tags');

  function renderTags() {
    tagsEl.innerHTML = [...group.values()].map((o) => `
      <span class="pill pill-accent">
        ${escHtml(`${o.last_name}, ${o.first_name}`)}
        <button data-rm="${escAttr(o.id)}" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 0 0 6px;">×</button>
      </span>`).join('') || '<span class="text-muted" style="font-size:12px;">Add two or more officers…</span>';
    tagsEl.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => { group.delete(b.dataset.rm); renderTags(); }));
  }
  renderTags();

  new OfficerSearch(container.querySelector('#sp-group-search'), {
    agencyId,
    supervisorId: isSupervisor ? profile.id : null,
    activeOnly: false,
    placeholder: 'Add officer to group…',
    onSelect: (officer) => { if (officer) { group.set(officer.id, officer); renderTags(); } },
  });

  container.querySelector('#sp-group-run').addEventListener('click', async () => {
    const out = container.querySelector('#sp-group-result');
    if (group.size < 1) { toast('Add at least one officer to the group.', 'error'); return; }
    out.innerHTML = '<div class="state-block"><div class="spinner"></div></div>';
    try {
      const pkg = await fetchGroupScore([...group.keys()]);
      out.innerHTML = `
        <div class="stat-grid">${renderScoreCard(pkg, { title: `Group of ${group.size}`, threshold })}</div>
        <div style="max-width:480px; margin-top:10px;">${renderDistribution(pkg)}</div>`;
    } catch (e) { out.innerHTML = ''; showError(e, 'Group score'); }
  });
}

// ---------------------------------------------------------------------------
// Acceptance test — callable from console or a test harness.
// ---------------------------------------------------------------------------
export function verifyAcceptanceVector() {
  const input = [
    { follow_up_outcome: 'no_action' },
    { follow_up_outcome: 'no_action' },
    { follow_up_outcome: 'commendation' },
    { follow_up_outcome: 'training' },
    { follow_up_outcome: 'coaching' },
  ];
  const out = computeScorePackage(input);
  const pass = out.total_reviews === 5 && out.positive_reviews === 3 && out.positive_percentage === 60;
  return { pass, out };
}
