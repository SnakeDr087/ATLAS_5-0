// ============================================================================
// ATLAS — audit-genie.js
// The Audit Guide: a DETERMINISTIC instructional drawer for the Review Audit
// pages. No LLM — answers are fixed text drawn verbatim from the ATLAS Review
// Audit SOP, so every user gets the same answer every time. Searchable;
// questions tagged to the current page surface first.
//
// Usage (audits.html / my-findings.html):
//   import { mountAuditGenie } from './audit-genie.js';
//   mountAuditGenie('dashboard');   // context: dashboard|scoring|reveal|findings|records
//   // optional: window.dispatchEvent(new CustomEvent('audit-genie-context',{detail:'reveal'}))
//   // when the in-page view changes, so contextual ordering follows the user.
// ============================================================================
import { escHtml } from './error-handler.js';

// ---------------------------------------------------------------------------
// The SOP knowledge base. Source of truth: ATLAS-SOP-Review-Audits.docx.
// Edit there first, then mirror here — the doc and the genie must never drift.
// ---------------------------------------------------------------------------
const QA = [
  { id: 'g1', ctx: ['dashboard'], q: 'How are supervisors selected for audit?',
    a: 'By census: every eligible supervisor is audited each cycle, and one of their approved reviews from the last 90 days is drawn uniform-random. Eligible means an active supervisor who is not review-exempt and has at least one approved review in the window. Excluded supervisors are printed on every receipt with the reason. The auditor never hand-picks the review — the receipt proves it.' },
  { id: 'g2', ctx: ['dashboard'], q: 'Why is the receipt written before scoring?',
    a: 'So the record proves selection preceded assessment. A receipt generated after scoring could be accused of justifying a choice already made. The receipt — pool, exclusions, method, timestamp — is written at selection, is immutable, and is never deleted.' },
  { id: 'g3', ctx: ['dashboard'], q: 'How often do audits run, and how many?',
    a: 'On a 90-day cycle (quarterly), auditing at least one review per eligible supervisor drawn from the prior 90 days of approved reviews. The cycle cadence is fixed; the per-supervisor count is the agency\u2019s dial.' },
  { id: 'g4', ctx: ['dashboard'], q: 'What about supervisors who don\u2019t conduct reviews?',
    a: 'Two rules. First, the draw is data-driven: only supervisors with at least one approved review in the window enter the pool — the audit samples reviews, not people. Second, the review-exempt flag marks administrative assignments (admin sergeant, lieutenant, captain) so their zero reads as expected. A supervisor who is NOT exempt and has zero reviews is surfaced to the Chief as a review-performance gap — exclusion never becomes a hiding place.' },
  { id: 'g5', ctx: ['scoring'], q: 'Why can\u2019t I see the supervisor\u2019s marks?',
    a: 'Because an open audit is a proofread — your eye follows the supervisor\u2019s marks and confirms them. A blind audit is an inter-rater reliability test: two trained reviewers, same footage, independent conclusions. ATLAS withholds the supervisor\u2019s marks at the database level until you lock; this is not an honor system, and that is exactly what makes the result defensible.' },
  { id: 'g6', ctx: ['scoring'], q: 'How should I mark each KPI?',
    a: 'In Article 01 order: opportunity first, then evidence, then performance. If the encounter never presented the item, mark N/A. If the recording cannot establish what happened, mark N/A with the undetermined note. Only if the opportunity existed and the footage shows it do you mark Observed or Not Observed. The audit is only as good as your own marking discipline.' },
  { id: 'g7', ctx: ['scoring'], q: 'What happens when I lock?',
    a: 'Locking is one-way and transactional. Your independent assessment becomes part of the permanent audit record, concurrence is computed against the frozen snapshot, the supervisor\u2019s marks are revealed, and one finding is auto-drafted for every discrepancy — all in a single database transaction, so the reveal and the findings can never diverge.' },
  { id: 'g8', ctx: ['scoring', 'reveal'], q: 'What are the timestamp fields for?',
    a: 'Footage citations. Every finding must cite the start and end time on the recording where the evidence sits — a finding without a citation does not issue. Capture timestamps during your watch-through; hunting for them afterward is far slower.' },
  { id: 'g9', ctx: ['reveal'], q: 'Which corrective measures should I select?',
    a: 'At least one per finding, always from the standardized list — marking guidance, directed re-review, outcome-selection counseling, KPI standard clarification, documented coaching session, procedure refresher, referral to Chief, or variance de minimis. The list keeps instruction consistent across supervisors and defensible in aggregate. A free-text comment may add context but never replaces a measure.' },
  { id: 'g10', ctx: ['reveal'], q: 'Does the audit change the original review?',
    a: 'Never. The audit runs against a frozen snapshot taken at selection, and the original review is never altered, re-scored, or replaced. Discrepancies route to supervisor findings and corrective instruction — not record correction. The audit is a parallel record; the two stand side by side permanently.' },
  { id: 'g11', ctx: ['reveal'], q: 'What if we fully agree — no findings?',
    a: 'Close the audit as a concurrence record. A concurrence is not an empty result: it is documented proof the supervisor\u2019s coding held up under independent blind review, it counts in their favor in every future cycle, and it is the strongest exoneration a supervisor with a high No Action rate can hold.' },
  { id: 'g12', ctx: ['findings'], q: 'What does acknowledgment mean?',
    a: 'Receipt of the instruction — nothing more. The supervisor is attesting that they received the finding and the corrective measures; acknowledgment is not a concession that the finding is correct. It is mandatory and timestamped, and the record is complete whether or not the supervisor agrees.' },
  { id: 'g13', ctx: ['findings'], q: 'Can the supervisor respond to a finding?',
    a: 'Once, optionally, at acknowledgment — a single written response per finding, on the permanent record. There is no reply thread: finding, instruction, acknowledgment, one response, closure. If a response has merit, the auditor can close the finding as resolved in the supervisor\u2019s favor. A disagreement worth more than one response belongs in a conversation, and its resolution belongs in the closure note.' },
  { id: 'g14', ctx: ['reveal', 'records'], q: 'Which disposition do I record at closure?',
    a: 'Sustained — the discrepancy stands and the corrective instruction is the agency\u2019s response. Resolved in supervisor\u2019s favor — the response or a footage re-review showed the original coding was correct; record it plainly, because an audit program that can find for the supervisor is one whose sustained findings mean something. Variance de minimis — a real but trivial difference not warranting instruction beyond the record itself.' },
  { id: 'g15', ctx: ['records'], q: 'What must the closed record be able to prove?',
    a: 'Five answers, each with a document behind it. How was the review chosen? The selection receipt. Was the check independent? The database-enforced blind protocol with a one-way lock. What was found? Findings with footage citations. What did the agency do? Standardized corrective measures, issued and dated. Did the supervisor receive it? Timestamped acknowledgment with any response attached. Reviewed, found, instructed, acknowledged, closed — every verb has a record.' },
  { id: 'g16', ctx: ['records'], q: 'Can a closed audit be edited or deleted?',
    a: 'No. Closing finalizes the record: receipt, snapshot, blind assessment, side-by-side, findings, citations, measures, acknowledgment, response, disposition, and the append-only activity log are all read-only and retained permanently. Database triggers reject deletes and post-closure edits for every role, the platform owner included.' },
];

// ---------------------------------------------------------------------------
// Styles — injected once, from the design tokens. Nothing in styles.css moves.
// ---------------------------------------------------------------------------
const CSS = `
#audit-genie-btn{position:fixed;bottom:22px;left:calc(var(--sidebar-w, 240px) + 22px);z-index:80;
  background:var(--navy-1);color:#fff;border:1px solid var(--navy-line);border-radius:999px;
  padding:10px 17px;font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;
  box-shadow:0 10px 30px rgba(13,23,38,.35);display:inline-flex;align-items:center;gap:8px}
#audit-genie-btn:hover{background:var(--navy-2)}
#audit-genie{position:fixed;top:0;right:-420px;width:400px;max-width:92vw;height:100vh;
  background:var(--bg-elevated);border-left:1px solid var(--border);
  box-shadow:-12px 0 32px rgba(13,23,38,.18);z-index:95;transition:right .28s ease;
  display:flex;flex-direction:column}
#audit-genie.open{right:0}
.ag-head{background:var(--navy-1);color:#fff;padding:16px 18px;position:relative}
.ag-title{font-family:var(--font-heading);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:14px}
.ag-sub{font-size:12px;color:#8aa0c4;margin-top:3px}
.ag-close{position:absolute;top:10px;right:12px;background:none;border:none;color:#c8d4e8;font-size:20px;cursor:pointer;padding:4px}
.ag-search{padding:12px 14px;border-bottom:1px solid var(--border)}
.ag-body{flex:1;overflow-y:auto;padding:10px 14px}
.ag-q{border:1px solid var(--border);border-radius:9px;margin-bottom:8px;overflow:hidden;background:var(--bg-elevated)}
.ag-q>button{width:100%;text-align:left;background:none;border:none;padding:11px 13px;
  font-family:var(--font-body);font-size:13.5px;font-weight:600;color:var(--text);cursor:pointer;
  display:flex;gap:8px;align-items:flex-start}
.ag-q>button:hover{background:var(--accent-dim)}
.ag-a{display:none;padding:10px 13px 12px;font-size:13px;line-height:1.65;color:var(--text-secondary);border-top:1px solid var(--border)}
.ag-q.open .ag-a{display:block}
.ag-note{font-size:11.5px;color:var(--text-muted);padding:10px 14px;border-top:1px solid var(--border)}
@media (max-width:860px){#audit-genie-btn{left:auto;right:22px;bottom:74px}}
@media print{#audit-genie-btn,#audit-genie{display:none!important}}
`;

let _ctx = 'dashboard';
let _mounted = false;

export function mountAuditGenie(initialContext = 'dashboard') {
  if (_mounted) { setAuditGenieContext(initialContext); return; }
  _mounted = true;
  _ctx = initialContext;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'audit-genie-btn';
  btn.type = 'button';
  btn.innerHTML = '&#9670; Audit Guide';
  document.body.appendChild(btn);

  const drawer = document.createElement('aside');
  drawer.id = 'audit-genie';
  drawer.setAttribute('aria-label', 'Audit Guide');
  drawer.innerHTML = `
    <div class="ag-head">
      <div class="ag-title">Audit Guide</div>
      <div class="ag-sub">Standardized guidance from the Review Audit SOP — same answer every time.</div>
      <button class="ag-close" type="button" aria-label="Close">&times;</button>
    </div>
    <div class="ag-search"><input type="text" id="ag-search" placeholder="Search guidance\u2026 (e.g. blind, acknowledge, disposition)"></div>
    <div class="ag-body" id="ag-body"></div>
    <div class="ag-note">Deterministic guide — answers are drawn verbatim from the ATLAS Review Audit SOP, not generated. Questions for the page you\u2019re on surface first.</div>`;
  document.body.appendChild(drawer);

  const renderList = () => {
    const q = (document.getElementById('ag-search').value || '').toLowerCase().trim();
    const list = QA
      .filter((x) => !q || (x.q + ' ' + x.a).toLowerCase().includes(q))
      .sort((a, b) => (b.ctx.includes(_ctx) ? 1 : 0) - (a.ctx.includes(_ctx) ? 1 : 0));
    const body = document.getElementById('ag-body');
    if (!list.length) {
      body.innerHTML = `<div class="state-block"><p class="empty-title">No guidance matches \u201c${escHtml(q)}\u201d.</p></div>`;
      return;
    }
    body.innerHTML = list.map((x) => `
      <div class="ag-q" data-id="${escHtml(x.id)}">
        <button type="button">
          ${x.ctx.includes(_ctx) ? '<span class="pill pill-accent" style="flex:none;">this page</span>' : ''}
          <span>${escHtml(x.q)}</span>
        </button>
        <div class="ag-a">${escHtml(x.a)}</div>
      </div>`).join('');
    body.querySelectorAll('.ag-q > button').forEach((b) =>
      b.addEventListener('click', () => b.parentElement.classList.toggle('open')));
  };

  btn.addEventListener('click', () => { drawer.classList.toggle('open'); if (drawer.classList.contains('open')) renderList(); });
  drawer.querySelector('.ag-close').addEventListener('click', () => drawer.classList.remove('open'));
  document.getElementById('ag-search').addEventListener('input', renderList);
  window.addEventListener('audit-genie-context', (e) => { _ctx = e.detail || _ctx; renderList(); });

  drawer._renderList = renderList;
}

export function setAuditGenieContext(ctx) {
  _ctx = ctx;
  const drawer = document.getElementById('audit-genie');
  if (drawer && drawer.classList.contains('open') && drawer._renderList) drawer._renderList();
}
