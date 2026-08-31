renderLayout('properties.html', 'Property Approval');

const tbody = document.getElementById('propTableBody');
const statusFilter = document.getElementById('statusFilter');
const searchBox = document.getElementById('searchBox');
const overlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');

function closeModal() {
  overlay.style.display = 'none';
  modalContent.innerHTML = '';
}
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

async function loadProperties() {
  tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Loading properties...</td></tr>`;
  const status = statusFilter.value;
  const search = searchBox.value.trim();
  const qs = new URLSearchParams();
  if (status !== 'All') qs.set('status', status);
  if (search) qs.set('search', search);

  try {
    const { properties } = await api.get(`/admin/properties?${qs.toString()}`);
    if (!properties.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No properties found.</td></tr>`;
      return;
    }
    tbody.innerHTML = properties
      .map(
        (p) => `
      <tr>
        <td>#${p.id}</td>
        <td>${escapeHtml(p.title)}</td>
        <td>${escapeHtml(p.owner_name)}</td>
        <td>${escapeHtml(p.city)}${p.area ? ', ' + escapeHtml(p.area) : ''}</td>
        <td>${escapeHtml(p.property_type || '-')}</td>
        <td>₹${Number(p.price || 0).toLocaleString('en-IN')}</td>
        <td>${fmtDate(p.submitted_at || p.created_at)}</td>
        <td>${badge(p.status)}</td>
        <td class="actions-cell">
          <button onclick="openDetail(${p.id})">View</button>
          ${
            p.status === 'PENDING_APPROVAL' || p.status === 'CHANGES_REQUESTED'
              ? `<button class="approve" onclick="quickApprove(${p.id})">Approve</button>
                 <button class="reject" onclick="openReject(${p.id})">Reject</button>
                 <button class="changes" onclick="openRequestChanges(${p.id})">Request Changes</button>`
              : ''
          }
          ${p.status === 'APPROVED' ? `<button class="reject" onclick="suspendProperty(${p.id})">Suspend</button>` : ''}
          ${p.status === 'SUSPENDED' ? `<button class="approve" onclick="restoreProperty(${p.id})">Restore</button>` : ''}
        </td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function openDetail(id) {
  modalContent.innerHTML = `<div class="empty-state">Loading...</div>`;
  overlay.style.display = 'flex';
  try {
    const { property: p } = await api.get(`/admin/properties/${id}`);
    modalContent.innerHTML = `
      <button class="close" onclick="closeModal()">&times;</button>
      <h3>${escapeHtml(p.title)} ${badge(p.status)}</h3>
      <p style="color:var(--muted);margin-top:-8px;">Property #${p.id}</p>

      <div class="modal-section">
        <h4>Property Information</h4>
        <div class="kv">
          <div><span class="k">Type:</span> ${escapeHtml(p.property_type || '-')}</div>
          <div><span class="k">BHK:</span> ${escapeHtml(p.bhk || '-')}</div>
          <div><span class="k">Bedrooms:</span> ${p.bedrooms ?? '-'}</div>
          <div><span class="k">Bathrooms:</span> ${p.bathrooms ?? '-'}</div>
          <div><span class="k">Area:</span> ${p.area_sqft ?? '-'} sqft</div>
          <div><span class="k">Price:</span> ₹${Number(p.price || 0).toLocaleString('en-IN')}</div>
          <div><span class="k">Deposit:</span> ₹${Number(p.deposit || 0).toLocaleString('en-IN')}</div>
          <div><span class="k">Maintenance:</span> ₹${Number(p.maintenance || 0).toLocaleString('en-IN')}</div>
          <div><span class="k">Furnishing:</span> ${escapeHtml(p.furnishing || '-')}</div>
          <div><span class="k">Floor:</span> ${escapeHtml(p.floor || '-')} / ${p.total_floors ?? '-'}</div>
          <div><span class="k">Age:</span> ${escapeHtml(p.property_age || '-')}</div>
        </div>
        <p style="font-size:13px;margin-top:10px;">${escapeHtml(p.description || '')}</p>
      </div>

      <div class="modal-section">
        <h4>Location</h4>
        <div class="kv">
          <div><span class="k">State:</span> ${escapeHtml(p.state || '-')}</div>
          <div><span class="k">City:</span> ${escapeHtml(p.city || '-')}</div>
          <div><span class="k">Area:</span> ${escapeHtml(p.area || '-')}</div>
          <div><span class="k">PIN:</span> ${escapeHtml(p.pincode || '-')}</div>
          <div><span class="k">Landmark:</span> ${escapeHtml(p.landmark || '-')}</div>
          <div><span class="k">Lat/Lng:</span> ${p.latitude ?? '-'}, ${p.longitude ?? '-'}</div>
        </div>
      </div>

      <div class="modal-section">
        <h4>Images</h4>
        <div class="img-strip">
          ${p.images.length ? p.images.map((url) => `<img src="${escapeHtml(url)}" />`).join('') : '<span style="color:var(--muted);font-size:13px;">No images uploaded.</span>'}
        </div>
      </div>

      <div class="modal-section">
        <h4>Amenities</h4>
        <div class="pill-list">
          ${p.amenities.length ? p.amenities.map((a) => `<span class="pill">${escapeHtml(a)}</span>`).join('') : '<span style="color:var(--muted);font-size:13px;">None listed.</span>'}
        </div>
      </div>

      <div class="modal-section">
        <h4>Owner Information (admin only)</h4>
        <div class="kv">
          <div><span class="k">Name:</span> ${escapeHtml(p.owner_name)}</div>
          <div><span class="k">Email:</span> ${escapeHtml(p.owner_email)}</div>
          <div><span class="k">Mobile:</span> ${escapeHtml(p.owner_mobile || '-')}</div>
          <div><span class="k">Type:</span> ${escapeHtml(p.owner_type || '-')}</div>
          <div><span class="k">Verification:</span> ${badge(p.verification_status)}</div>
          <div><span class="k">Previous properties:</span> ${p.owner_previous_properties}</div>
          <div><span class="k">Owner since:</span> ${fmtDate(p.owner_created_at)}</div>
        </div>
      </div>

      ${p.rejection_reason ? `<div class="modal-section"><h4>Rejection Reason</h4><p style="font-size:13px;">${escapeHtml(p.rejection_reason)}</p></div>` : ''}
      ${p.change_request_note ? `<div class="modal-section"><h4>Requested Changes</h4><p style="font-size:13px;">${escapeHtml(p.change_request_note)}</p></div>` : ''}

      ${
        p.status === 'PENDING_APPROVAL' || p.status === 'CHANGES_REQUESTED'
          ? `<div style="display:flex;gap:10px;margin-top:20px;">
               <button class="btn" onclick="quickApprove(${p.id})">Approve Property</button>
               <button class="btn danger" onclick="openReject(${p.id})">Reject</button>
               <button class="btn warning" onclick="openRequestChanges(${p.id})">Request Changes</button>
             </div>`
          : ''
      }
    `;
  } catch (err) {
    modalContent.innerHTML = `<button class="close" onclick="closeModal()">&times;</button><div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function quickApprove(id) {
  modalContent.innerHTML = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h3>Approve Property</h3>
    <p>Are you sure you want to approve this property? It will become publicly visible immediately.</p>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn" id="confirmApproveBtn">Approve</button>
      <button class="btn secondary" onclick="closeModal()">Cancel</button>
    </div>
  `;
  overlay.style.display = 'flex';
  document.getElementById('confirmApproveBtn').onclick = async () => {
    try {
      const { message } = await api.post(`/admin/properties/${id}/approve`);
      closeModal();
      loadProperties();
      toast(message);
    } catch (err) {
      alert(err.message);
    }
  };
}

function openReject(id) {
  const reasons = ['Incorrect information', 'Invalid images', 'Duplicate listing', 'Suspicious property', 'Incorrect location', 'Incomplete information', 'Other'];
  overlay.style.display = 'flex';
  modalContent.innerHTML = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h3>Reject Property</h3>
    <div class="field">
      <label>Rejection Reason</label>
      <select id="reasonSelect">
        ${reasons.map((r) => `<option value="${r}">${r}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Details (sent to owner)</label>
      <textarea id="reasonText" rows="3" placeholder="e.g. Please upload clearer property images and update the property location."></textarea>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn danger" id="confirmRejectBtn">Reject Property</button>
      <button class="btn secondary" onclick="closeModal()">Cancel</button>
    </div>
  `;
  document.getElementById('confirmRejectBtn').onclick = async () => {
    const selected = document.getElementById('reasonSelect').value;
    const details = document.getElementById('reasonText').value.trim();
    const reason = details ? `${selected} — ${details}` : selected;
    try {
      const { message } = await api.post(`/admin/properties/${id}/reject`, { reason });
      closeModal();
      loadProperties();
      toast(message);
    } catch (err) {
      alert(err.message);
    }
  };
}

function openRequestChanges(id) {
  overlay.style.display = 'flex';
  modalContent.innerHTML = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h3>Request Changes</h3>
    <div class="field">
      <label>What needs to be corrected?</label>
      <textarea id="changesText" rows="3" placeholder="e.g. Please update the rent amount and upload additional property images."></textarea>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn warning" id="confirmChangesBtn">Send Request</button>
      <button class="btn secondary" onclick="closeModal()">Cancel</button>
    </div>
  `;
  document.getElementById('confirmChangesBtn').onclick = async () => {
    const note = document.getElementById('changesText').value.trim();
    if (!note) return alert('Please describe the requested changes.');
    try {
      const { message } = await api.post(`/admin/properties/${id}/request-changes`, { note });
      closeModal();
      loadProperties();
      toast(message);
    } catch (err) {
      alert(err.message);
    }
  };
}

async function suspendProperty(id) {
  if (!confirm('Suspend this property? It will no longer be publicly visible.')) return;
  try {
    const { message } = await api.post(`/admin/properties/${id}/suspend`);
    loadProperties();
    toast(message);
  } catch (err) {
    alert(err.message);
  }
}

async function restoreProperty(id) {
  try {
    const { message } = await api.post(`/admin/properties/${id}/restore`);
    loadProperties();
    toast(message);
  } catch (err) {
    alert(err.message);
  }
}

function toast(msg) {
  // Minimal non-blocking confirmation - swap for a nicer toast component if desired.
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#12312a;color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;z-index:200;box-shadow:0 6px 20px rgba(0,0,0,0.2);';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

statusFilter.addEventListener('change', loadProperties);
document.getElementById('searchBtn').addEventListener('click', loadProperties);
searchBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadProperties();
});

loadProperties();
