// ============================================================================
// ATLAS — auth.js
// Session management, the single client-side permission source, and the ONE
// shared page boot sequence used by every page (no copy-paste drift).
// RLS mirrors everything here server-side — this gate is UX, RLS is security.
// ============================================================================
import { supabase, logActivity } from './supabase-client.js';
import { renderNav, renderTopbar } from './nav.js';
import { showError } from './error-handler.js';

export const ROLES = ['super_admin', 'chief', 'internal_affairs', 'training_bureau', 'agency_admin', 'supervisor'];
const ALL = ROLES;

// ---------------------------------------------------------------------------
// PERMISSION TRUTH — the only client-side role/page matrix. nav.js derives its
// menu from this; nothing else maintains a role list.
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS = {
  dashboard:           ALL,
  reviews:             ['super_admin', 'chief', 'internal_affairs', 'training_bureau', 'supervisor'],
  'review-new':        ['internal_affairs', 'training_bureau', 'supervisor'],
  'review-detail':     ['super_admin', 'chief', 'internal_affairs', 'training_bureau', 'supervisor'],
  'auto-select':       ['supervisor'],
  'delta-t':           ['super_admin', 'chief', 'internal_affairs', 'training_bureau', 'supervisor'],
  reports:             ['super_admin', 'chief', 'internal_affairs', 'training_bureau', 'supervisor'],
  'officer-profile':   ['super_admin', 'chief', 'internal_affairs', 'training_bureau', 'supervisor'],
  'ia-cases':          ['super_admin', 'chief', 'internal_affairs'],
  pips:                ['super_admin', 'chief', 'internal_affairs', 'training_bureau', 'supervisor'],
  'in-person-reviews': ['super_admin', 'chief', 'internal_affairs', 'training_bureau', 'supervisor'],
  admin:               ['super_admin', 'agency_admin'],
  roster:              ['super_admin', 'agency_admin', 'supervisor'],
  'agency-settings':   ['super_admin', 'agency_admin'],
  tickets:             ['super_admin', 'agency_admin'],
  content:             ['super_admin', 'agency_admin'],
};

export function can(role, pageKey) {
  const allowed = ROLE_PERMISSIONS[pageKey];
  return Array.isArray(allowed) && allowed.includes(role);
}

// ---------------------------------------------------------------------------
// Session — split queries: profile first, THEN agency. Never a fragile joined
// single query that fails on super_admin's NULL agency.
// ---------------------------------------------------------------------------
let _cached = null;

export async function initAuth() {
  if (_cached) return _cached;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, profile: null };

  const { data: profile, error } = await supabase
    .from('profiles').select('*').eq('id', session.user.id).maybeSingle();

  if (error) throw error;
  if (!profile) return { session, profile: null }; // "profile not found" — pages handle

  if (profile.agency_id) {
    const { data: agency } = await supabase
      .from('agencies').select('id, name, state, min_performance_threshold, patch_url')
      .eq('id', profile.agency_id).maybeSingle();
    profile.agency = agency || null;
  } else {
    profile.agency = null; // super_admin by design
  }
  _cached = { session, profile };
  return _cached;
}

export async function signOut() {
  const { profile } = _cached || {};
  if (profile) await logActivity(profile, 'sign_out');
  await supabase.auth.signOut();
  location.href = 'login.html';
}

// ---------------------------------------------------------------------------
// THE shared page shell. Every page calls exactly this:
//   const { session, profile } = await bootPage('page-key', 'Page Title');
// Handles: unauthenticated redirect, deactivated account, missing profile,
// role-denied redirect, nav + topbar rendering.
// ---------------------------------------------------------------------------
export async function bootPage(pageKey, title) {
  let auth;
  try {
    auth = await initAuth();
  } catch (e) {
    showError(e, 'Session error');
    throw e;
  }
  const { session, profile } = auth;

  if (!session) {
    const redirect = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    location.replace(`login.html?redirect=${redirect}`);
    throw new Error('redirecting to login');
  }
  if (!profile) {
    location.replace('login.html?err=no_profile');
    throw new Error('profile not found');
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    location.replace('login.html?err=deactivated');
    throw new Error('account deactivated');
  }
  if (!can(profile.role, pageKey)) {
    location.replace('dashboard.html?err=denied');
    throw new Error('role denied');
  }

  renderNav(profile, pageKey);
  renderTopbar(title, profile);
  document.title = `${title} · ATLAS`;
  return { session, profile };
}
