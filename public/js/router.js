/**
 * Roteador de SPA Client-side.
 * Gerencia o histórico do navegador e a transição entre telas sem recarregar a página.
 */
import { state } from './state.js';
import { renderDashboard } from './views/dashboard.js';
import { renderProducts } from './views/products.js';
import { renderMovements } from './views/movements.js';
import { renderInventory } from './views/inventory.js';
import { renderPurchases } from './views/purchases.js';
import { renderDepartments } from './views/departments.js';
import { renderSuppliers } from './views/suppliers.js';
import { renderReports } from './views/reports.js';
import { renderUsers } from './views/users.js';
import { renderAudit } from './views/audit.js';
import { renderSettings } from './views/settings.js';

const routes = {
  '/dashboard': { handler: renderDashboard, title: 'Dashboard' },
  '/products': { handler: renderProducts, title: 'Produtos' },
  '/movements': { handler: renderMovements, title: 'Movimentações' },
  '/inventory': { handler: renderInventory, title: 'Inventário Físico' },
  '/purchases': { handler: renderPurchases, title: 'Reposição & Compras' },
  '/departments': { handler: renderDepartments, title: 'Departamentos' },
  '/suppliers': { handler: renderSuppliers, title: 'Fornecedores' },
  '/reports': { handler: renderReports, title: 'Relatórios' },
  '/users': { handler: renderUsers, title: 'Usuários', adminOnly: true },
  '/audit': { handler: renderAudit, title: 'Auditoria', adminOnly: true },
  '/settings': { handler: renderSettings, title: 'Configurações', adminOnly: true }
};

export const router = {
  navigate(path, replace = false) {
    if (replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }
    this.resolve();
  },

  resolve() {
    let path = window.location.pathname;
    if (path === '/' || path === '') path = '/dashboard';

    const route = routes[path] || routes['/dashboard'];

    // Se for restrito a admin e o usuário for operador, redireciona
    if (route.adminOnly && !state.isAdmin()) {
      this.navigate('/dashboard', true);
      return;
    }

    const container = document.getElementById('view-container');
    if (!container) return;

    // Atualiza links da sidebar
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
      const linkRoute = link.getAttribute('data-route');
      if (linkRoute === path) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Fecha sidebar no mobile ao navegar
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Executa o handler da view
    route.handler(container);
  },

  init() {
    // Intercepta cliques em links com href relativo
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        e.preventDefault();
        this.navigate(href);
      }
    });

    // Navegação via botão Voltar/Avançar do navegador
    window.addEventListener('popstate', () => {
      this.resolve();
    });

    this.resolve();
  }
};
