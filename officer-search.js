// ============================================================================
// ATLAS — officer-search.js
// THE officer typeahead. Used everywhere an officer is selected: review form,
// roster attach, filters, in-person scheduling. No page-local officer <select>
// elements exist anywhere in ATLAS 5 — that dead-code pattern caused v4.3's
// worst bug.
//
// Usage:
//   const os = new OfficerSearch(containerEl, {
//     agencyId,                 // required
//     supervisorId,             // optional — restrict to that supervisor's roster
//     placeholder,              // optional
//     activeOnly,               // default true (officer_status = 'active')
//     onSelect(officer) {}      // optional callback
//   });
//   os.getValue()  → selected officer object or null
//   os.clear()
// ============================================================================
import { supabase } from './supabase-client.js';
import { escHtml, escAttr, showError } from './error-handler.js';

export class OfficerSearch {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { activeOnly: true, placeholder: 'Search officer by name or badge…', ...opts };
    this.officers = [];
    this.filtered = [];
    this.selected = null;
    this.highlight = -1;
    this._render();
    this._load();
  }

  async _load() {
    try {
      let officers;
      if (this.opts.supervisorId) {
        // Supervisor scope: only officers on their roster (via supervisor_rosters).
        const { data, error } = await supabase
          .from('supervisor_rosters')
          .select('officer_id, personnel_roster:officer_id (id, first_name, last_name, badge_number, officer_status, performance_score, rank_id, agency_ranks:rank_id (rank_name))')
          .eq('supervisor_id', this.opts.supervisorId);
        if (error) throw error;
        officers = (data || []).map((r) => r.personnel_roster).filter(Boolean);
      } else {
        // Agency-wide scope (IA / Training / admin views).
        const { data, error } = await supabase
          .from('personnel_roster')
          .select('id, first_name, last_name, badge_number, officer_status, performance_score, rank_id, agency_ranks:rank_id (rank_name)')
          .eq('agency_id', this.opts.agencyId)
          .order('last_name');
        if (error) throw error;
        officers = data || [];
      }
      if (this.opts.activeOnly) officers = officers.filter((o) => o.officer_status === 'active');
      this.officers = officers.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
    } catch (e) {
      showError(e, 'Officer search');
    }
  }

  _render() {
    this.container.classList.add('officer-search');
    this.container.innerHTML = `
      <div class="os-selected" hidden></div>
      <input type="text" class="os-input" placeholder="${escAttr(this.opts.placeholder)}"
             autocomplete="off" role="combobox" aria-expanded="false" />
      <div class="os-dropdown" hidden role="listbox"></div>`;
    this.input = this.container.querySelector('.os-input');
    this.dropdown = this.container.querySelector('.os-dropdown');
    this.selectedEl = this.container.querySelector('.os-selected');

    this.input.addEventListener('input', () => this._filter());
    this.input.addEventListener('focus', () => this._filter());
    this.input.addEventListener('keydown', (e) => this._keys(e));
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) this._close();
    });
  }

  _filter() {
    const q = this.input.value.trim().toLowerCase();
    this.filtered = this.officers.filter((o) => {
      const name = `${o.first_name} ${o.last_name}`.toLowerCase();
      const rev = `${o.last_name} ${o.first_name}`.toLowerCase();
      return !q || name.includes(q) || rev.includes(q) || (o.badge_number || '').toLowerCase().includes(q);
    }).slice(0, 12);
    this.highlight = this.filtered.length ? 0 : -1;
    this._paint();
  }

  _paint() {
    if (!this.filtered.length) {
      this.dropdown.innerHTML = `<div class="os-empty">No matching officers</div>`;
    } else {
      this.dropdown.innerHTML = this.filtered.map((o, i) => `
        <button type="button" class="os-option${i === this.highlight ? ' hl' : ''}"
                role="option" data-i="${i}">
          <span class="os-name">${escHtml(o.last_name)}, ${escHtml(o.first_name)}</span>
          <span class="os-sub">#${escHtml(o.badge_number || '—')} · ${escHtml(o.agency_ranks?.rank_name || 'Unranked')}</span>
        </button>`).join('');
      this.dropdown.querySelectorAll('.os-option').forEach((btn) => {
        btn.addEventListener('click', () => this._pick(this.filtered[Number(btn.dataset.i)]));
      });
    }
    this.dropdown.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  _keys(e) {
    if (this.dropdown.hidden && ['ArrowDown', 'ArrowUp'].includes(e.key)) { this._filter(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); this.highlight = Math.min(this.highlight + 1, this.filtered.length - 1); this._paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.highlight = Math.max(this.highlight - 1, 0); this._paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (this.highlight >= 0) this._pick(this.filtered[this.highlight]); }
    else if (e.key === 'Escape') { this._close(); }
  }

  _pick(officer) {
    this.selected = officer;
    this._close();
    this.input.hidden = true;
    this.selectedEl.hidden = false;
    this.selectedEl.innerHTML = `
      <span class="pill pill-accent os-chip">
        ${escHtml(officer.last_name)}, ${escHtml(officer.first_name)} · #${escHtml(officer.badge_number || '—')}
        <button type="button" class="os-clear" title="Clear selection" aria-label="Clear selection">×</button>
      </span>`;
    this.selectedEl.querySelector('.os-clear').addEventListener('click', () => this.clear());
    if (typeof this.opts.onSelect === 'function') this.opts.onSelect(officer);
  }

  _close() {
    this.dropdown.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
  }

  getValue() { return this.selected; }

  clear() {
    this.selected = null;
    this.selectedEl.hidden = true;
    this.selectedEl.innerHTML = '';
    this.input.hidden = false;
    this.input.value = '';
    if (typeof this.opts.onSelect === 'function') this.opts.onSelect(null);
  }
}
