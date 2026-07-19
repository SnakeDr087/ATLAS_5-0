// ============================================================================
// ATLAS — nav.js
// Sidebar + topbar renderer. The menu is DERIVED from ROLE_PERMISSIONS in
// auth.js — there is no second hand-maintained role list to drift.
// ============================================================================
import { ROLE_PERMISSIONS, signOut } from './auth.js';
import { supabase } from './supabase-client.js';
import { escHtml, escAttr } from './error-handler.js';

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>',
  reviews: '<svg viewBox="0 0 24 24"><path d="M4 4h16v2H4zm0 5h16v2H4zm0 5h10v2H4zm0 5h10v2H4zm13 0l5-5-1.4-1.4L17 16.2l-1.6-1.6L14 16z"/></svg>',
  'review-new': '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  'auto-select': '<svg viewBox="0 0 24 24"><path d="M12 2l2.4 4.9L20 8l-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5L4 8l5.6-1.1z"/></svg>',
  'delta-t': '<svg viewBox="0 0 24 24"><path d="M12 3L2 21h20L12 3zm0 4.4L18.5 19h-13L12 7.4z"/></svg>',
  'in-person-reviews': '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z"/></svg>',
  'ia-cases': '<svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4zm0 2.2L6 6.9v5.1c0 4 2.5 7.4 6 8 3.5-.6 6-4 6-8V6.9l-6-2.7z"/></svg>',
  pips: '<svg viewBox="0 0 24 24"><path d="M5 3h14v18l-7-4-7 4V3zm2 2v12.6l5-2.9 5 2.9V5H7z"/></svg>',
  reports: '<svg viewBox="0 0 24 24"><path d="M4 20h16v2H4zM6 10h3v8H6zm5-6h3v14h-3zm5 3h3v11h-3z"/></svg>',
  roster: '<svg viewBox="0 0 24 24"><path d="M16 11a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.7 0-6 1.3-6 4v2h12v-2c0-2.7-3.3-4-6-4zm8 0c-.4 0-.8 0-1.2.1 1.3.9 2.2 2.2 2.2 3.9v2h5v-2c0-2.7-3.3-4-6-4z"/></svg>',
  admin: '<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 110 8 4 4 0 010-8zm9.4 4a7.5 7.5 0 00-.1-1.2l2.1-1.6-2-3.4-2.5 1a7.6 7.6 0 00-2-1.2L16.5 3h-4l-.4 2.6a7.6 7.6 0 00-2 1.2l-2.5-1-2 3.4 2.1 1.6a7.5 7.5 0 000 2.4L5.6 14.8l2 3.4 2.5-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 002-1.2l2.5 1 2-3.4-2.1-1.6c.1-.4.1-.8.1-1.2z"/></svg>',
  'agency-settings': '<svg viewBox="0 0 24 24"><path d="M3 21V8l9-5 9 5v13h-7v-6h-4v6H3zm2-2h2v-6h10v6h2V9.2l-7-3.9-7 3.9V19z"/></svg>',
  tickets: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 012 2v3a2 2 0 000 6v3a2 2 0 01-2 2H4a2 2 0 01-2-2v-3a2 2 0 000-6V6a2 2 0 012-2zm9 3h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>',
  content: '<svg viewBox="0 0 24 24"><path d="M4 5h16v2H4zm0 4h16v2H4zm0 4h10v2H4zm12 1l1.4 2.9L20 17l-2 2 .5 3-2.5-1.4L13.5 22l.5-3-2-2 2.6-.1z"/></svg>',
};

// Grouped sections; each item points at a page key from ROLE_PERMISSIONS.
const NAV_SECTIONS = [
  { label: 'Main', items: [
    { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
  ]},
  { label: 'Reviews', items: [
    { key: 'reviews', label: 'Reviews', href: 'reviews.html' },
    { key: 'review-new', label: 'New Review', href: 'review-new.html' },
    { key: 'auto-select', label: 'Auto Select', href: 'auto-select.html' },
    { key: 'in-person-reviews', label: 'In-Person Reviews', href: 'in-person-reviews.html' },
  ]},
  { label: 'Operations', items: [
    { key: 'delta-t', label: 'Delta T', href: 'delta-t.html' },
    { key: 'reports', label: 'Reports', href: 'reports.html' },
    { key: 'roster', label: 'Roster', href: 'roster.html' },
  ]},
  { label: 'Cases', items: [
    { key: 'ia-cases', label: 'IA Cases', href: 'ia-cases.html' },
    { key: 'pips', label: 'PIPs', href: 'pips.html' },
  ]},
  { label: 'Administration', items: [
    { key: 'admin', label: 'Admin Panel', href: 'admin.html' },
    { key: 'agency-settings', label: 'Agency Settings', href: 'agency-settings.html' },
    { key: 'tickets', label: 'Trouble Tickets', href: 'tickets.html' },
  ]},
  { label: 'Content', items: [
    { key: 'content', label: 'Content Manager', href: 'content-manager.html' },
  ]},
];

const ROLE_LABELS = {
  super_admin: 'Platform Owner', chief: 'Chief / Executive', internal_affairs: 'Internal Affairs',
  training_bureau: 'Training Bureau', agency_admin: 'Agency Admin', supervisor: 'Supervisor',
};

function initials(name) {
  return (name || '?').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export function renderNav(profile, activeKey) {
  const el = document.getElementById('sidebar');
  if (!el) return;

  // Carry super_admin's agency context across agency-scoped links.
  const agencyParam = !profile.agency_id ? new URLSearchParams(location.search).get('agency_id') : null;
  const withCtx = (href) => (agencyParam ? `${href}?agency_id=${encodeURIComponent(agencyParam)}` : href);

  const sections = NAV_SECTIONS.map((sec) => {
    const items = sec.items.filter((i) => (ROLE_PERMISSIONS[i.key] || []).includes(profile.role));
    if (!items.length) return '';
    return `
      <div class="nav-section">
        <div class="nav-section-label">${escHtml(sec.label)}</div>
        ${items.map((i) => `
          <a class="nav-item${i.key === activeKey ? ' active' : ''}" href="${escAttr(withCtx(i.href))}">
            <span class="nav-icon">${ICONS[i.key] || ''}</span>${escHtml(i.label)}
          </a>`).join('')}
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="brand">
      <div class="brand-mark">A</div>
      <div>
        <div class="brand-name">ATLAS</div>
        <div class="brand-agency">${escHtml(profile.agency?.name || 'Platform Administration')}</div>
      </div>
    </div>
    <nav class="nav-scroll">${sections}</nav>
    <div class="user-card">
      <div class="avatar">${escHtml(initials(profile.full_name))}</div>
      <div class="user-meta">
        <div class="user-name">${escHtml(profile.full_name)}</div>
        <div class="user-role">${escHtml(ROLE_LABELS[profile.role] || profile.role)}</div>
      </div>
      <button class="signout-btn" id="signout-btn" title="Sign out">
        <svg viewBox="0 0 24 24"><path d="M10 3h4v2h-4v14h4v2h-6V3h2zm7.5 4.5L21 11l-3.5 3.5-1.4-1.4L17.2 12H12v-2h5.2l-1.1-1.1 1.4-1.4z"/></svg>
      </button>
    </div>`;
  el.querySelector('#signout-btn').addEventListener('click', () => signOut());
}

export function renderTopbar(title, profile, extraHtml = '') {
  const el = document.getElementById('topbar');
  if (!el) return;
  el.innerHTML = `
    <h1 class="page-title">${escHtml(title)}</h1>
    <div class="topbar-right">
      <span id="agency-selector-slot"></span>
      <span id="topbar-context"></span>
      ${extraHtml}
      <button class="bell-btn" title="Notifications" aria-label="Notifications">
        <svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 002.4-2h-4.8A2.5 2.5 0 0012 22zm7-5v1H5v-1l1.5-1.5V11a5.5 5.5 0 014-5.3V5a1.5 1.5 0 013 0v.7a5.5 5.5 0 014 5.3v4.5L19 17z"/></svg>
      </button>
    </div>`;
  // Platform owner gets a persistent agency selector that scopes every page.
  if (profile.role === 'super_admin') mountAgencySelector(profile);
}

// super_admin-only. "All Agencies" (cumulative) + one entry per agency. The
// choice is carried in ?agency_id= so every agency-scoped page follows it;
// 'all' or absent means cumulative mode (dashboard/reports aggregate).
async function mountAgencySelector(profile) {
  const slot = document.getElementById('agency-selector-slot');
  if (!slot) return;
  const current = new URLSearchParams(location.search).get('agency_id') || 'all';
  const { data: agencies } = await supabase.from('agencies')
    .select('id, name, is_active').order('name');
  slot.innerHTML = `
    <label class="agency-select-wrap" title="Platform agency context">
      <svg viewBox="0 0 24 24" width="15" height="15" style="opacity:.6;"><path d="M3 21h18v-2H3v2zM5 8h2v9H5V8zm4 0h2v9H9V8zm4-5L5 6v1h16V6l-8-3zm2 5h2v9h-2V8z"/></svg>
      <select id="agency-select">
        <option value="all"${current === 'all' ? ' selected' : ''}>All Agencies (cumulative)</option>
        ${(agencies || []).map((a) => `
          <option value="${escAttr(a.id)}"${current === a.id ? ' selected' : ''}>${escHtml(a.name)}${a.is_active ? '' : ' (inactive)'}</option>`).join('')}
      </select>
    </label>`;
  document.getElementById('agency-select').addEventListener('change', (e) => {
    const params = new URLSearchParams(location.search);
    if (e.target.value === 'all') params.delete('agency_id');
    else params.set('agency_id', e.target.value);
    // Land on dashboard when switching to cumulative (only dashboard/reports aggregate),
    // otherwise reload the current page in the new agency context.
    if (e.target.value === 'all' && !/dashboard\.html/.test(location.pathname)) {
      location.href = 'dashboard.html';
    } else {
      location.search = params.toString();
    }
  });
}
