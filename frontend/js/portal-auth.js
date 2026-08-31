// Generic handler for owner/user login & register forms.
// `kind` is 'owner' or 'user' - used to build API paths, cookie/localStorage keys, and redirect targets.

function initAuthForm({ kind, formId, mode }) {
  const form = document.getElementById(formId);
  const alertBox = document.getElementById('alertBox');
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.innerHTML = '';
    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'register' ? 'Creating account...' : 'Signing in...';

    const payload = {};
    form.querySelectorAll('[name]').forEach((input) => {
      payload[input.name] = input.value.trim();
    });

    try {
      const data = await api.post(`/${kind}/auth/${mode}`, payload);
      if (data.token) localStorage.setItem(`${kind}_token`, data.token);
      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      window.location.href = returnTo && kind === 'user' ? returnTo : `${kind}-dashboard.html`;
    } catch (err) {
      alertBox.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

async function loadWhoAmI(kind, elId) {
  try {
    const data = await api.get(`/${kind}/auth/me`);
    const person = data.owner || data.user;
    document.getElementById(elId).textContent = person.name;
    return person;
  } catch (err) {
    window.location.href = `${kind}-login.html`;
  }
}

function logoutAs(kind) {
  api.post(`/${kind}/auth/logout`).catch(() => {}).finally(() => {
    localStorage.removeItem(`${kind}_token`);
    window.location.href = `${kind}-login.html`;
  });
}
