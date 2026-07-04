// ============================================================================
// ATLAS — supabase-client.js
// The ONLY module that touches the Supabase SDK. Every page imports from here.
// ============================================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// ----------------------------------------------------------------------------
// Activity log — every insert/update of consequence writes through here.
// Never throws: an audit failure must not break the user's action.
// ----------------------------------------------------------------------------
export async function logActivity(profile, action, targetType = null, targetId = null, metadata = {}) {
  try {
    await supabase.from('activity_log').insert({
      agency_id: profile?.agency_id ?? metadata.agency_id ?? null,
      actor_id: profile?.id ?? null,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
    });
  } catch (e) {
    console.warn('activity_log write failed', e);
  }
}

// ----------------------------------------------------------------------------
// Content resolution — the shared-baseline + suppression model.
// Effective list = agency's own items + baseline items NOT suppressed.
// Used identically for incident types, KPIs, safety items, dispositions.
// ----------------------------------------------------------------------------
const CONTENT_TABLES = {
  incident_type: 'incident_types',
  kpi: 'kpi_definitions',
  safety_item: 'safety_checklist_items',
  disposition: 'disposition_types',
};

export async function getEffectiveContent(contentType, agencyId, extraFilter = null) {
  const table = CONTENT_TABLES[contentType];
  let q = supabase.from(table).select('*').eq('is_active', true).order('sort_order');
  if (extraFilter) q = extraFilter(q);
  const { data: rows, error } = await q;
  if (error) throw error;

  let suppressedIds = new Set();
  if (agencyId) {
    const { data: sup, error: e2 } = await supabase
      .from('content_suppressions')
      .select('content_id')
      .eq('agency_id', agencyId)
      .eq('content_type', contentType);
    if (e2) throw e2;
    suppressedIds = new Set((sup || []).map((s) => s.content_id));
  }
  return (rows || []).filter((r) => {
    if (r.agency_id === null) return !suppressedIds.has(r.id); // baseline, unless suppressed
    return r.agency_id === agencyId; // agency layer
  });
}
