// ============================================================================
// ATLAS — agency-context.js
// The NULL-agency bug class from v4.3, designed out. super_admin has
// agency_id = NULL; agency-scoped pages resolve context from the URL or a
// picker. Every agency-scoped page uses this identically — never
// profile.agency_id directly.
// ============================================================================
import { supabase } from './supabase-client.js';
import { escHtml, escAttr, renderLoading } from './error-handler.js';

// The core helper from the spec. Works for every role:
//  - normal roles → their profile agency
//  - super_admin  → ?agency_id= URL param (or null if none picked yet)
export function resolveAgencyId(profile) {
  return profile.agency_id || new URLSearchParams(location.search).get('agency_id');
}

// Agency-scoped pages call this once after bootPage. For super_admin without a
// chosen agency it renders a picker into #content and returns null — the page
// simply stops; picking an agency reloads with ?agency_id= set.
// Returns { agencyId, agency } when context exists.
export async function requireAgencyContext(profile, contentEl) {
  const agencyId = resolveAgencyId(profile);

  if (!agencyId) {
    // Only super_admin can legitimately land here.
    await renderAgencyPicker(contentEl);
    return { agencyId: null, agency: null };
  }

  // Load the agency record for threshold/name (super_admin won't have profile.agency).
  if (profile.agency && profile.agency.id === agencyId) {
    return { agencyId, agency: profile.agency };
  }
  const { data: agency, error } = await supabase
    .from('agencies')
    .select('id, name, state, min_performance_threshold, patch_url')
    .eq('id', agencyId).maybeSingle();
  if (error) throw error;
  return { agencyId, agency };
}

async function renderAgencyPicker(contentEl) {
  renderLoading(contentEl, 'Loading agencies…');
  const { data: agencies, error } = await supabase
    .from('agencies').select('id, name, state, is_active').order('name');
  if (error) {
    contentEl.innerHTML = `<div class="state-block error"><p class="empty-title">Could not load agencies.</p></div>`;
    return;
  }
  contentEl.innerHTML = `
    <div class="card" style="max-width:560px;margin:48px auto;">
      <h2 class="card-title">Select an agency context</h2>
      <p class="text-secondary">You are signed in as the platform owner. Choose which agency's data to view on this page.</p>
      <div class="agency-picker-list">
        ${(agencies || []).map((a) => `
          <button class="agency-pick-row" data-id="${escAttr(a.id)}">
            <span>${escHtml(a.name)}</span>
            <span class="pill">${escHtml(a.state || '')}${a.is_active ? '' : ' · inactive'}</span>
          </button>`).join('') || '<p class="text-muted">No agencies exist yet. Create one in the Admin Panel.</p>'}
      </div>
    </div>`;
  contentEl.querySelectorAll('.agency-pick-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const params = new URLSearchParams(location.search);
      params.set('agency_id', btn.dataset.id);
      location.search = params.toString();
    });
  });
}

// Small badge for the topbar so super_admin always sees which context is live.
export function agencyContextBadge(profile, agency) {
  if (profile.role !== 'super_admin' || !agency) return '';
  return `<span class="pill pill-accent" title="Agency context">${escHtml(agency.name)}</span>`;
}
