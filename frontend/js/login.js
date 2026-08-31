const form = document.getElementById('loginForm');
const alertBox = document.getElementById('alertBox');
const loginBtn = document.getElementById('loginBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.innerHTML = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api.post('/admin/auth/login', { email, password });
    // Also keep the token in localStorage as a fallback for browsers/environments
    // where the cross-origin cookie doesn't get set (e.g. some sandboxed previews).
    if (data.token) localStorage.setItem('admin_token', data.token);
    window.location.href = 'dashboard.html';
  } catch (err) {
    alertBox.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    loginBtn.disabled = false;
    loginBtn.textContent = 'Admin Login';
  }
});
