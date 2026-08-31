renderLayout('owners.html', 'Owners');

const tbody = document.getElementById('ownerTableBody');
const searchBox = document.getElementById('searchBox');

async function loadOwners() {
  tbody.innerHTML = `<tr><td colspan="11" class="empty-state">Loading owners...</td></tr>`;
  const qs = new URLSearchParams();
  if (searchBox.value.trim()) qs.set('search', searchBox.value.trim());
  try {
    const { owners } = await api.get(`/admin/owners?${qs.toString()}`);
    if (!owners.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="empty-state">No owners found.</td></tr>`;
      return;
    }
    tbody.innerHTML = owners
      .map(
        (o) => `
      <tr>
        <td>#${o.id}</td>
        <td>${escapeHtml(o.name)}</td>
        <td>${escapeHtml(o.email)}</td>
        <td>${escapeHtml(o.mobile || '-')}</td>
        <td>${escapeHtml(o.owner_type)}</td>
        <td>${o.total_properties}</td>
        <td>${o.approved_properties}</td>
        <td>${o.pending_properties}</td>
        <td>${badge(o.verification_status)}</td>
        <td>${badge(o.account_status)}</td>
        <td class="actions-cell">
          ${o.verification_status !== 'VERIFIED' ? `<button onclick="verifyOwner(${o.id})">Verify</button>` : ''}
          ${o.account_status === 'ACTIVE' ? `<button class="reject" onclick="suspendOwner(${o.id})">Suspend</button>` : `<button class="approve" onclick="activateOwner(${o.id})">Activate</button>`}
          <button class="reject" onclick="deleteOwner(${o.id})">Delete</button>
        </td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function verifyOwner(id) {
  await api.post(`/admin/owners/${id}/verify`);
  loadOwners();
}
async function suspendOwner(id) {
  if (!confirm('Suspend this owner account?')) return;
  await api.post(`/admin/owners/${id}/suspend`);
  loadOwners();
}
async function activateOwner(id) {
  await api.post(`/admin/owners/${id}/activate`);
  loadOwners();
}
async function deleteOwner(id) {
  if (!confirm('Delete this owner account? This cannot be undone from the UI.')) return;
  await api.del(`/admin/owners/${id}`);
  loadOwners();
}

document.getElementById('searchBtn').addEventListener('click', loadOwners);
searchBox.addEventListener('keydown', (e) => e.key === 'Enter' && loadOwners());

loadOwners();
