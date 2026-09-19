/**
 * Cliente HTTP Fetch para comunicação com a API Serverless na Netlify.
 */

const API_BASE = '/api';

export const api = {
  getToken() {
    return localStorage.getItem('auth_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Sessão expirada. Faça login novamente.');
      }

      // Se for download de arquivo (CSV)
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/csv')) {
        const blob = await response.blob();
        return blob;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status}: Falha na operação.`);
      }

      return data;
    } catch (err) {
      console.error(`[API Fetch Error] ${endpoint}:`, err);
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== null && val !== undefined && val !== '') {
        query.append(key, val);
      }
    }
    const qStr = query.toString();
    return this.request(`${endpoint}${qStr ? '?' + qStr : ''}`, { method: 'GET' });
  },

  post(endpoint, body = {}) {
    return this.request(endpoint, { method: 'POST', body });
  },

  put(endpoint, body = {}) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  async downloadCsv(endpoint, params = {}, defaultFilename = 'relatorio.csv') {
    const query = new URLSearchParams({ ...params, format: 'csv' });
    const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}?${query.toString()}`;
    const token = this.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Falha ao exportar CSV');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
};
