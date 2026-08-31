renderLayout('dashboard.html', 'Dashboard');

const STAT_LABELS = {
  totalUsers: 'Total Users',
  totalOwners: 'Total Owners',
  totalProperties: 'Total Properties',
  pendingProperties: 'Pending Properties',
  approvedProperties: 'Approved Properties',
  rejectedProperties: 'Rejected Properties',
  contactRequests: 'Contact Requests',
  scheduledVisits: 'Scheduled Visits',
  reportedProperties: 'Reported Properties'
};

async function loadStats() {
  try {
    const { stats } = await api.get('/admin/dashboard/stats');
    const grid = document.getElementById('statsGrid');
    grid.innerHTML = Object.entries(STAT_LABELS)
      .map(
        ([key, label]) => `
        <div class="stat-card">
          <div class="label">${label}</div>
          <div class="value">${stats[key] ?? 0}</div>
        </div>`
      )
      .join('');
  } catch (err) {
    document.getElementById('statsGrid').innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadNotifications() {
  try {
    const { notifications } = await api.get('/admin/dashboard/notifications');
    const list = document.getElementById('notifList');
    if (!notifications.length) {
      list.innerHTML = `<div class="empty-state">No notifications yet.</div>`;
      return;
    }
    list.innerHTML = notifications
      .slice(0, 10)
      .map(
        (n) => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border);">
          <strong>${escapeHtml(n.title)}</strong>
          <div style="color:var(--muted);font-size:13px;">${escapeHtml(n.message)}</div>
          <div style="color:var(--muted);font-size:11px;margin-top:2px;">${fmtDate(n.created_at)}</div>
        </div>`
      )
      .join('');
  } catch (err) {
    document.getElementById('notifList').innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

loadStats();
loadNotifications();
