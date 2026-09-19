/**
 * View: Gestão de Usuários e Permissões (RBAC - Restrito a Administradores).
 */
import { api } from '../api.js';
import { showToast, showModal, closeModal, formatDate } from '../components.js';

export async function renderUsers(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestão de Usuários e Acessos</h1>
        <p class="page-subtitle">Controle de perfis (Administrador e Operador), credenciais de acesso e segurança</p>
      </div>
      <div>
        <button id="btn-add-user" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
          <span>Novo Usuário</span>
        </button>
      </div>
    </div>

    <div class="content-card">
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Usuário (Login)</th>
                <th>Nome Completo</th>
                <th>E-mail</th>
                <th>Perfil de Acesso</th>
                <th>Status</th>
                <th>Data de Criação</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="users-table-tbody">
              <tr><td colspan="7" class="text-center text-muted">Carregando usuários...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  loadUsersList();

  document.getElementById('btn-add-user').addEventListener('click', () => openUserModal());
}

async function loadUsersList() {
  const tbody = document.getElementById('users-table-tbody');
  if (!tbody) return;

  try {
    const data = await api.get('/users');
    const users = data.users || [];

    tbody.innerHTML = users.map(u => {
      const roleBadge = u.role === 'admin'
        ? `<span class="badge" style="background:#dbeafe; color:#1e40af;">Administrador</span>`
        : `<span class="badge" style="background:#f1f5f9; color:#475569;">Operador</span>`;

      return `
        <tr>
          <td><code>${u.username}</code></td>
          <td class="font-semibold">${u.full_name}</td>
          <td>${u.email}</td>
          <td>${roleBadge}</td>
          <td>${u.active ? '<span class="badge badge-normal">Ativo</span>' : '<span class="badge badge-zero">Inativo</span>'}</td>
          <td>${formatDate(u.created_at)}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline btn-edit-user" data-id="${u.id}" data-json='${JSON.stringify(u)}'>
              Editar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = JSON.parse(btn.dataset.json);
        openUserModal(u.id, u);
      });
    });

  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Falha ao carregar usuários: ${err.message}</td></tr>`;
  }
}

function openUserModal(userId = null, existing = null) {
  const isEditing = !!userId;
  const u = existing || { username: '', full_name: '', email: '', role: 'operator', active: true };

  const content = `
    <div class="modal-header">
      <h3 class="modal-title">${isEditing ? `Editar Usuário: ${u.username}` : 'Cadastrar Novo Usuário'}</h3>
      <button class="modal-close-btn">&times;</button>
    </div>
    <form id="form-user-save">
      <div class="modal-body">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label for="user-uname">Nome de Usuário (Login) *</label>
            <input type="text" id="user-uname" class="form-input" placeholder="Ex: jsilva" value="${u.username}" ${isEditing ? 'disabled style="background:#f1f5f9;"' : 'required'}>
          </div>
          <div class="form-group">
            <label for="user-name">Nome Completo *</label>
            <input type="text" id="user-name" class="form-input" placeholder="Ex: João da Silva" value="${u.full_name}" required>
          </div>
        </div>

        <div class="form-group">
          <label for="user-email">E-mail Corporativo *</label>
          <input type="email" id="user-email" class="form-input" placeholder="joao.silva@empresa.com" value="${u.email}" required>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label for="user-role">Perfil de Permissão *</label>
            <select id="user-role" class="form-select" required>
              <option value="operator" ${u.role === 'operator' ? 'selected' : ''}>Operador (Entradas, Saídas e Consultas)</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador (Acesso Total e Configurações)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="user-pwd">${isEditing ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha de Acesso *'}</label>
            <input type="password" id="user-pwd" class="form-input" placeholder="••••••••" ${isEditing ? '' : 'required'}>
          </div>
        </div>

        ${isEditing ? `
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" id="user-active" ${u.active ? 'checked' : ''}>
              <span>Conta Ativa no Sistema</span>
            </label>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEditing ? 'Salvar Alterações' : 'Criar Usuário'}</button>
      </div>
    </form>
  `;

  showModal(content, (modalRoot) => {
    modalRoot.querySelector('#form-user-save').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        full_name: modalRoot.querySelector('#user-name').value,
        email: modalRoot.querySelector('#user-email').value,
        role: modalRoot.querySelector('#user-role').value
      };

      const pwd = modalRoot.querySelector('#user-pwd').value;
      if (pwd && pwd.trim().length > 0) {
        payload.password = pwd;
      }

      if (!isEditing) {
        payload.username = modalRoot.querySelector('#user-uname').value;
      } else {
        payload.active = modalRoot.querySelector('#user-active').checked;
      }

      try {
        if (isEditing) {
          await api.put(`/users/${userId}`, payload);
          showToast('Usuário atualizado com sucesso!');
        } else {
          await api.post('/users', payload);
          showToast('Usuário criado com sucesso!');
        }
        closeModal();
        loadUsersList();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
