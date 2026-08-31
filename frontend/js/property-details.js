const propertyContainer = document.getElementById('property');
const loginLink = document.getElementById('loginLink');

function loginToViewContact() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.href = `user-login.html?returnTo=${encodeURIComponent(returnTo)}`;
}

function getPropertyId() {
  return new URLSearchParams(window.location.search).get('id');
}

async function loadProperty() {
  const id = getPropertyId();
  if (!id) {
    propertyContainer.innerHTML = '<div class="empty-state">Property ID is missing.</div>';
    return;
  }

  try {
    const { property: p, authenticated } = await api.get(`/properties/${encodeURIComponent(id)}`);

    if (authenticated) loginLink.textContent = 'My Account';

    const ownerContact = authenticated
      ? `
        <div><span class="k">Mobile:</span> ${escapeHtml(p.owner.mobile || '-')}</div>
        <div><span class="k">Email:</span> ${escapeHtml(p.owner.email || '-')}</div>
      `
      : `
        <div><span class="k">Mobile:</span> <button class="btn secondary" type="button" onclick="loginToViewContact()">Login to view</button></div>
        <div><span class="k">Email:</span> <button class="btn secondary" type="button" onclick="loginToViewContact()">Login to view</button></div>
      `;

    propertyContainer.innerHTML = `
      <h2>${escapeHtml(p.title)}</h2>
      <p style="color:var(--muted);">${escapeHtml(p.city || '')}${p.area ? ', ' + escapeHtml(p.area) : ''}</p>

      <div class="modal-section">
        <h4>Property Information</h4>
        <div class="kv">
          <div><span class="k">Type:</span> ${escapeHtml(p.property_type || '-')}</div>
          <div><span class="k">BHK:</span> ${escapeHtml(p.bhk || '-')}</div>
          <div><span class="k">Bedrooms:</span> ${p.bedrooms ?? '-'}</div>
          <div><span class="k">Bathrooms:</span> ${p.bathrooms ?? '-'}</div>
          <div><span class="k">Area:</span> ${p.area_sqft ?? '-'} sqft</div>
          <div><span class="k">Price:</span> ₹${Number(p.price || 0).toLocaleString('en-IN')}</div>
          <div><span class="k">Furnishing:</span> ${escapeHtml(p.furnishing || '-')}</div>
        </div>
        <p>${escapeHtml(p.description || '')}</p>
      </div>

      <div class="modal-section">
        <h4>Owner Information</h4>
        <div class="kv">
          <div><span class="k">Name:</span> ${escapeHtml(p.owner.name)}</div>
          ${ownerContact}
        </div>
        ${!authenticated ? '<p style="color:var(--muted);font-size:13px;">Owner contact details are available after user login.</p>' : ''}
      </div>
    `;
  } catch (err) {
    propertyContainer.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

loadProperty();
