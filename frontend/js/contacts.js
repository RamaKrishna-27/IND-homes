renderLayout('contacts.html', 'Contact Requests');

const tbody = document.getElementById('reqTableBody');
const statusFilter = document.getElementById('statusFilter');
const typeFilter = document.getElementById('typeFilter');

const STATUS_OPTIONS = ['PENDING', 'CONTACTED', 'RESPONDED', 'CLOSED', 'CANCELLED'];

async function loadRequests() {
  tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Loading...</td></tr>`;
  const qs = new URLSearchParams();
  if (statusFilter.value !== 'All') qs.set('status', statusFilter.value);
  if (typeFilter.value !== 'All') qs.set('type', typeFilter.value);

  try {
    const { requests } = await api.get(`/admin/contact-requests?${qs.toString()}`);
    if (!requests.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No contact requests found.</td></tr>`;
      return;
    }
    tbody.innerHTML = requests
      .map(
        (r) => `
      <tr>
        <td>#${r.id}</td>
        <td>${escapeHtml(r.user_name)}</td>
        <td>${escapeHtml(r.property_title)}</td>
        <td>${escapeHtml(r.owner_name)}</td>
        <td>${escapeHtml(r.request_type)}</td>
        <td>${fmtDate(r.created_at)}</td>
        <td>${badge(r.status)}</td>
        <td class="actions-cell">
          <select onchange="updateStatus(${r.id}, this.value)">
            <option value="">Update status…</option>
            ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function updateStatus(id, status) {
  if (!status) return;
  try {
    await api.post(`/admin/contact-requests/${id}/status`, { status });
    loadRequests();
  } catch (err) {
    alert(err.message);
  }
}

statusFilter.addEventListener('change', loadRequests);
typeFilter.addEventListener('change', loadRequests);

loadRequests();
