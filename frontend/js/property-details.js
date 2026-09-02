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

    const images = (p.images && p.images.length) ? p.images : ['images/properties/placeholder.jpg'];
    const mainImg = images[0];
    const thumbsHtml = images.length > 1 ? `
      <div class="prop-gallery-thumbs">
        ${images.map((img, idx) => `<img src="${escapeHtml(img)}" class="${idx === 0 ? 'active' : ''}" onclick="changeMainImage('${escapeHtml(img)}', this)" alt="Thumbnail ${idx + 1}" onerror="this.src='images/properties/placeholder.jpg'" />`).join('')}
      </div>
    ` : '';

    propertyContainer.innerHTML = `
      <div class="prop-gallery-main">
        <img id="mainPropertyImg" src="${escapeHtml(mainImg)}" alt="${escapeHtml(p.title)}" onerror="this.src='images/properties/placeholder.jpg'" />
      </div>
      ${thumbsHtml}

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
          <div><span class="k">Price:</span> ₹${Number(p.price || 0).toLocaleString('en-IN')} / month</div>
          <div><span class="k">Deposit:</span> ₹${Number(p.deposit || 0).toLocaleString('en-IN')}</div>
          <div><span class="k">Maintenance:</span> ₹${Number(p.maintenance || 0).toLocaleString('en-IN')}</div>
          <div><span class="k">Furnishing:</span> ${escapeHtml(p.furnishing || '-')}</div>
          <div><span class="k">Floor:</span> ${escapeHtml(p.floor || '-')} / ${p.total_floors ?? '-'}</div>
          <div><span class="k">Age:</span> ${escapeHtml(p.property_age || '-')}</div>
        </div>
        <p style="margin-top:14px;line-height:1.5;">${escapeHtml(p.description || '')}</p>
      </div>

      ${p.amenities && p.amenities.length ? `
      <div class="modal-section">
        <h4>Amenities</h4>
        <div class="pill-list">
          ${p.amenities.map(a => `<span class="pill">${escapeHtml(a)}</span>`).join('')}
        </div>
      </div>
      ` : ''}

      <div class="modal-section">
        <h4>Owner Information</h4>
        <div class="kv">
          <div><span class="k">Name:</span> ${escapeHtml(p.owner.name)}</div>
          ${ownerContact}
        </div>
        ${!authenticated ? '<p style="color:var(--muted);font-size:13px;margin-top:10px;">Owner contact details are available after user login.</p>' : ''}
      </div>
    `;
  } catch (err) {
    propertyContainer.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function changeMainImage(src, el) {
  const main = document.getElementById('mainPropertyImg');
  if (main) main.src = src;
  document.querySelectorAll('.prop-gallery-thumbs img').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
}

loadProperty();
