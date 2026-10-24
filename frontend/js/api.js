// Central place to configure the backend URL. Automatically uses relative '/api'
// in production (e.g. Render) and connects to http://localhost:5000/api for local static servers.
function getApiBase() {
  if (typeof window !== 'undefined' && window.__API_BASE__) return window.__API_BASE__;
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') return 'http://localhost:5000/api';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  if (isLocal && window.location.port !== '5000') {
    return 'http://localhost:5000/api';
  }
  return '/api';
}
const API_BASE = getApiBase();

async function apiRequest(path, { method = 'GET', body, timeoutMs = 25000 } = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = body && !isFormData ? { 'Content-Type': 'application/json' } : {};

  // Pick the right stored token based on which API this call is for, so the
  // admin, owner, and user portals don't stomp on each other's sessions.
  const kind = path.startsWith('/admin/') ? 'admin' : path.startsWith('/owner/') ? 'owner' : path.startsWith('/user/') ? 'user' : null;
  let storedToken = kind ? localStorage.getItem(`${kind}_token`) : null;
  if (!storedToken && path.startsWith('/upload/')) {
    storedToken = localStorage.getItem('owner_token') || localStorage.getItem('admin_token');
  }
  if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include', // send the matching httpOnly cookie if present
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
      signal: controller ? controller.signal : undefined
    });
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (err && err.name === 'AbortError') {
      throw new Error('Connection timed out. The server might be warming up, please click Retry.');
    }
    throw new Error('Network error: Unable to reach IND Homes server. Please check connection and click Retry.');
  } finally {
    if (timer) clearTimeout(timer);
  }

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
  del: (path) => apiRequest(path, { method: 'DELETE' }),
  upload: (path, formData) => apiRequest(path, { method: 'POST', body: formData, timeoutMs: 60000 })
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
