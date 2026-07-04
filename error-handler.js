// ============================================================================
// ATLAS — error-handler.js
// Toasts, escaping, formatting, and loading/empty/error state helpers.
// Security hygiene: escHtml() for ALL interpolated text, escAttr() for anything
// inside attributes. Never interpolate raw user data.
// ============================================================================

export function escHtml(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function escAttr(v) {
  // Superset of escHtml — also neutralizes backticks/newlines for attributes.
  return escHtml(v).replace(/`/g, '&#96;').replace(/\r?\n/g, ' ');
}

// ----------------------------------------------------------------------------
// Toasts
// ----------------------------------------------------------------------------
function toastRoot() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  return root;
}

export function toast(message, kind = 'success', ms = 4200) {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="toast-dot"></span><span>${escHtml(message)}</span>`;
  toastRoot().appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

export function showError(err, context = '') {
  console.error(context, err);
  const msg = err?.message || (typeof err === 'string' ? err : 'Something went wrong.');
  toast(context ? `${context}: ${msg}` : msg, 'error', 6500);
}

// ----------------------------------------------------------------------------
// Loading / empty / error states — the consistent list pattern.
// ----------------------------------------------------------------------------
export function renderLoading(el, label = 'Loading…') {
  el.innerHTML = `<div class="state-block"><div class="spinner"></div><p>${escHtml(label)}</p></div>`;
}

export function renderEmpty(el, title = 'Nothing here yet', hint = '') {
  el.innerHTML = `
    <div class="state-block empty">
      <div class="empty-glyph">▢</div>
      <p class="empty-title">${escHtml(title)}</p>
      ${hint ? `<p class="empty-hint">${escHtml(hint)}</p>` : ''}
    </div>`;
}

export function renderErrorState(el, message = 'Could not load this data.') {
  el.innerHTML = `
    <div class="state-block error">
      <p class="empty-title">${escHtml(message)}</p>
      <button class="btn btn-secondary" onclick="location.reload()">Reload page</button>
    </div>`;
}

// ----------------------------------------------------------------------------
// Formatters
// ----------------------------------------------------------------------------
export function fmtDate(d) {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d;
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function daysBetween(a, b) {
  if (!a || !b) return null;
  const d1 = new Date(a.length === 10 ? a + 'T00:00:00' : a);
  const d2 = new Date(b.length === 10 ? b + 'T00:00:00' : b);
  return Math.round((d2 - d1) / 86400000);
}

// Score color class per the design system (threshold configurable per agency).
export function scoreClass(score, threshold = 80) {
  if (score === null || score === undefined) return 'score-none';
  const s = Number(score);
  if (s >= threshold) return 'score-good';
  if (s >= 65) return 'score-warn';
  return 'score-bad';
}

export function outcomeLabel(code) {
  return ({
    no_action: 'No Action', commendation: 'Commendation', coaching: 'Coaching',
    training: 'Training', internal_affairs: 'Internal Affairs', pip: 'PIP',
  })[code] || code || '—';
}

export function outcomeBadge(code) {
  const cls = ({
    no_action: 'pill', commendation: 'pill pill-success', coaching: 'pill pill-accent',
    training: 'pill pill-warning', internal_affairs: 'pill pill-danger', pip: 'pill pill-danger',
  })[code] || 'pill';
  return `<span class="${cls}">${escHtml(outcomeLabel(code))}</span>`;
}
