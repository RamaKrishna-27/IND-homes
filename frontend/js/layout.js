const NAV_ITEMS = [
  { href: 'dashboard.html', label: 'Dashboard' },
  { href: 'properties.html', label: 'Property Approval' },
  { href: 'owners.html', label: 'Owners' },
  { href: 'users.html', label: 'Users' },
  { href: 'contacts.html', label: 'Contact Requests' },
  { href: 'activity.html', label: 'Activity Logs' },
  { href: 'settings.html', label: 'Settings' }
];

function renderLayout(activeHref, pageTitle) {
  const current = window.location.pathname.split('/').pop() || 'dashboard.html';

  document.getElementById('sidebar').innerHTML = `
    <div class="brand">IND Homes Admin</div>
    <nav>
      ${NAV_ITEMS.map(
        (item) => `<a href="${item.href}" class="${current === item.href ? 'active' : ''}">${item.label}</a>`
      ).join('')}
      <a href="#" id="logoutLink" style="margin-top:10px;color:#ff9d8a;">Logout</a>
    </nav>
  `;

  document.getElementById('topbar-title').textContent = pageTitle;

  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    logoutAdmin();
  });

  // Guard: verify session; bounce to login if not authenticated
  api.get('/admin/auth/me').catch(() => {
    window.location.href = 'admin-login.html';
  });

  loadNotificationBell();
}

async function loadNotificationBell() {
  const bell = document.getElementById('notifBell');
  if (!bell) return;
  try {
    const { unreadCount } = await api.get('/admin/dashboard/notifications');
    bell.innerHTML = `🔔${unreadCount > 0 ? `<span class="notif-dot">${unreadCount}</span>` : ''}`;
  } catch (e) {
    /* ignore */
  }
}
