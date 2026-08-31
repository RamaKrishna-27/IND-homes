renderLayout('users.html', 'Users');

const tbody = document.getElementById('userTableBody');
const searchBox = document.getElementById('searchBox');

async function loadUsers() {
  tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Loading users...</td></tr>`;
  const qs = new URLSearchParams();
  if (searchBox.value.trim()) qs.set('search', searchBox.value.trim());
  try {
    const { users } = await api.get(`/admin/users?${qs.toString()}`);
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No users found.</td></tr>`;
      return;
    }
    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>#${u.id}</td>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.mobile || '-')}</td>
        <td>${escapeHtml(u.city || '-')}</td>
        <td>${u.enquiry_count}</td>
        <td>${badge(u.account_status)}</td>
        <td>${fmtDate(u.created_at)}</td>
        <td class="actions-cell">
          ${u.account_status === 'ACTIVE' ? `<button class="reject" onclick="suspendUser(${u.id})">Suspend</button>` : `<button class="approve" onclick="activateUser(${u.id})">Activate</button>`}
          <button class="reject" onclick="deleteUser(${u.id})">Delete</button>
        </td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function suspendUser(id) {
  if (!confirm('Suspend this user account?')) return;
  await api.post(`/admin/users/${id}/suspend`);
  loadUsers();
}
async function activateUser(id) {
  await api.post(`/admin/users/${id}/activate`);
  loadUsers();
}
async function deleteUser(id) {
  if (!confirm('Delete this user account? This cannot be undone from the UI.')) return;
  await api.del(`/admin/users/${id}`);
  loadUsers();
}

document.getElementById('searchBtn').addEventListener('click', loadUsers);
searchBox.addEventListener('keydown', (e) => e.key === 'Enter' && loadUsers());

loadUsers();
