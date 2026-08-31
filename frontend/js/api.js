// Central place to configure the backend URL. Automatically uses relative '/api'
// in production (e.g. Render) and supports standalone frontend servers on port 8080.
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '8080'
  ? 'http://localhost:5000/api'
  : '/api';

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};

  // Pick the right stored token based on which API this call is for, so the
  // admin, owner, and user portals (which can be open in the same browser)
  // don't stomp on each other's sessions.
  const kind = path.startsWith('/admin/') ? 'admin' : path.startsWith('/owner/') ? 'owner' : path.startsWith('/user/') ? 'user' : null;
  const storedToken = kind ? localStorage.getItem(`${kind}_token`) : null;
  if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include', // send the matching httpOnly cookie if present
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    /* no JSON body */
  }

  if (!res.ok) {
    if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/register')) {
      // Session expired - bounce to the matching login page
      const loginPage = kind === 'owner' ? 'owner-login.html' : kind === 'user' ? 'user-login.html' : 'admin-login.html';
      window.location.href = loginPage;
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' })
};

function fmtDate(d) {
  if (!d) return '-';
  const date = new Date(d.includes('T') || d.includes('Z') ? d : d.replace(' ', 'T') + 'Z');
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function badge(status) {
  return `<span class="badge ${status}">${status.replace(/_/g, ' ')}</span>`;
}

function logoutAdmin() {
  api.post('/admin/auth/logout').catch(() => {}).finally(() => {
    localStorage.removeItem('admin_token');
    window.location.href = 'admin-login.html';
  });
}
