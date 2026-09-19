/**
 * Ponto de Entrada Principal da Aplicação SPA (Single Page Application).
 */
import { api } from './api.js';
import { state } from './state.js';
import { router } from './router.js';
import { showToast } from './components.js';
import { openStockEntryModal, openStockExitModal, openStockAdjustModal } from './views/movements.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  wireAuthEvents();
  wireGlobalLayout();

  const token = api.getToken();
  if (!token) {
    showLoginScreen();
  } else {
    try {
      const data = await api.get('/auth/me');
      setupAuthenticatedUser(data.user);
    } catch (err) {
      showLoginScreen();
    }
  }
}

function showLoginScreen() {
  document.getElementById('login-container').classList.remove('hidden');
  document.getElementById('app-layout').classList.add('hidden');
}

function setupAuthenticatedUser(user) {
  state.setUser(user);

  document.getElementById('login-container').classList.add('hidden');
  document.getElementById('app-layout').classList.remove('hidden');

  // Atualiza perfil no rodapé da sidebar
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  const avatarEl = document.getElementById('user-avatar-initials');

  if (nameEl) nameEl.textContent = user.full_name;
  if (roleEl) roleEl.textContent = user.role === 'admin' ? 'Administrador' : 'Operador';
  if (avatarEl) {
    const initials = user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    avatarEl.textContent = initials || 'US';
  }

  // Oculta itens exclusivos de admin para operadores
  const isAdmin = user.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    if (!isAdmin) {
      el.classList.add('hidden');
    } else {
      el.classList.remove('hidden');
    }
  });

  // Inicializa o roteador de SPA
  router.init();

  // Carrega configurações gerais e alertas
  checkStockAlertsBadge();
}

function wireAuthEvents() {
  const loginForm = document.getElementById('login-form');
  const errorMsg = document.getElementById('login-error');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.classList.add('hidden');
      const submitBtn = document.getElementById('btn-login-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Verificando...</span>';

      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await api.post('/auth/login', { username, password });
        api.setToken(res.token);
        setupAuthenticatedUser(res.user);
        showToast(`Bem-vindo, ${res.user.full_name}!`);
      } catch (err) {
        errorMsg.textContent = err.message || 'Falha na autenticação';
        errorMsg.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Entrar no Sistema</span>';
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await api.post('/auth/logout');
      } catch (e) {}
      api.setToken(null);
      showToast('Você saiu do sistema.', 'info');
      showLoginScreen();
    });
  }

  // Intercepta token expirado
  window.addEventListener('auth:unauthorized', () => {
    showToast('Sessão expirada. Faça login novamente.', 'warning');
    showLoginScreen();
  });
}

function wireGlobalLayout() {
  // Toggle da sidebar mobile
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const closeBtn = document.getElementById('sidebar-close-mobile');
  const sidebar = document.getElementById('app-sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
  if (closeBtn && sidebar) {
    closeBtn.addEventListener('click', () => sidebar.classList.remove('open'));
  }

  // Ações rápidas no Header Superior
  const quickEntryBtn = document.getElementById('btn-quick-entry');
  const quickExitBtn = document.getElementById('btn-quick-exit');
  const quickAdjBtn = document.getElementById('btn-quick-adjust');

  if (quickEntryBtn) quickEntryBtn.addEventListener('click', () => openStockEntryModal());
  if (quickExitBtn) quickExitBtn.addEventListener('click', () => openStockExitModal());
  if (quickAdjBtn) quickAdjBtn.addEventListener('click', () => openStockAdjustModal());

  // Sino de alertas
  const alertBell = document.getElementById('btn-alert-bell');
  if (alertBell) {
    alertBell.addEventListener('click', () => {
      router.navigate('/purchases');
    });
  }

  // Busca rápida global
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim().length > 0) {
        router.navigate('/products');
        setTimeout(() => {
          const filterInput = document.getElementById('prod-filter-search');
          if (filterInput) {
            filterInput.value = searchInput.value.trim();
            filterInput.dispatchEvent(new Event('input'));
          }
        }, 100);
      }
    });
  }
}

async function checkStockAlertsBadge() {
  try {
    const data = await api.get('/purchases/replenishment');
    const items = data.items || [];
    const bellBadge = document.getElementById('alert-bell-badge');
    const sidebarBadge = document.getElementById('badge-replenishment-count');

    if (items.length > 0) {
      if (bellBadge) bellBadge.classList.remove('hidden');
      if (sidebarBadge) {
        sidebarBadge.textContent = items.length;
        sidebarBadge.classList.remove('hidden');
      }
    } else {
      if (bellBadge) bellBadge.classList.add('hidden');
      if (sidebarBadge) sidebarBadge.classList.add('hidden');
    }
  } catch (err) {
    // Silencioso em caso de erro de rede
  }
}
