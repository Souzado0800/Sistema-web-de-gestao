/**
 * View: Cadastro e Gestão de Departamentos / Centros de Custo.
 */
import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showModal, closeModal, confirmDialog } from '../components.js';

export async function renderDepartments(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Departamentos & Centros de Custo</h1>
        <p class="page-subtitle">Gerencie os setores da empresa que consom os materiais e produtos do estoque</p>
      </div>
      <div>
        <button id="btn-add-dept" class="btn btn-primary admin-only">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Novo Departamento</span>
        </button>
      </div>
    </div>

    <div class="content-card">
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome do Departamento</th>
                <th>Centro de Custo</th>
                <th>Descrição</th>
                <th>Retiradas Registradas</th>
                <th>Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="departments-table-tbody">
              <tr><td colspan="6" class="text-center text-muted">Carregando departamentos...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  loadDepartmentsList();

  const addBtn = document.getElementById('btn-add-dept');
  if (addBtn) {
    if (!state.isAdmin()) addBtn.classList.add('hidden');
    addBtn.addEventListener('click', () => openDepartmentModal());
  }
}

async function loadDepartmentsList() {
  const tbody = document.getElementById('departments-table-tbody');
  if (!tbody) return;

  try {
    const data = await api.get('/departments');
    const departments = data.departments || [];

    if (departments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Nenhum departamento cadastrado.</td></tr>`;
      return;
    }

    const isAdmin = state.isAdmin();

    tbody.innerHTML = departments.map(d => `
      <tr>
        <td class="font-semibold">${d.name}</td>
        <td><code>${d.cost_center || 'N/A'}</code></td>
        <td class="text-muted">${d.description || '-'}</td>
        <td><strong>${d.movement_count || 0}</strong> saídas vinculadas</td>
        <td>${d.active ? '<span class="badge badge-normal">Ativo</span>' : '<span class="badge badge-zero">Inativo</span>'}</td>
        <td class="text-right">
          ${isAdmin ? `
            <div class="table-actions" style="justify-content: flex-end;">
              <button class="btn btn-sm btn-outline btn-edit-dept" data-id="${d.id}" data-name="${d.name}" data-cc="${d.cost_center || ''}" data-desc="${d.description || ''}" data-active="${d.active}">Editar</button>
              <button class="btn btn-sm btn-outline text-danger btn-del-dept" data-id="${d.id}" data-name="${d.name}">Desativar</button>
            </div>
          ` : '-'}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-dept').forEach(btn => {
      btn.addEventListener('click', () => {
        openDepartmentModal(btn.dataset.id, {
          name: btn.dataset.name,
          cost_center: btn.dataset.cc,
          description: btn.dataset.desc,
          active: btn.dataset.active === 'true'
        });
      });
    });

    tbody.querySelectorAll('.btn-del-dept').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmDialog({
          title: 'Desativar Departamento',
          message: `Deseja desativar o departamento "${btn.dataset.name}"? O histórico de saídas continuará preservado.`,
          confirmText: 'Desativar',
          onConfirm: async () => {
            try {
              await api.delete(`/departments/${btn.dataset.id}`);
              showToast('Departamento atualizado com sucesso!');
              loadDepartmentsList();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });
    });

  } catch (err) {
    console.error('Erro ao listar departamentos:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha ao carregar departamentos: ${err.message}</td></tr>`;
  }
}

function openDepartmentModal(deptId = null, existing = null) {
  const isEditing = !!deptId;
  const d = existing || { name: '', cost_center: '', description: '', active: true };

  const content = `
    <div class="modal-header">
      <h3 class="modal-title">${isEditing ? 'Editar Departamento' : 'Novo Departamento'}</h3>
      <button class="modal-close-btn">&times;</button>
    </div>
    <form id="form-dept-save">
      <div class="modal-body">
        <div class="form-group">
          <label for="dept-name">Nome do Departamento / Setor *</label>
          <input type="text" id="dept-name" class="form-input" placeholder="Ex: Tecnologia da Informação" value="${d.name}" required>
        </div>

        <div class="form-group">
          <label for="dept-cc">Código do Centro de Custo</label>
          <input type="text" id="dept-cc" class="form-input font-mono" placeholder="Ex: TI-03" value="${d.cost_center || ''}">
        </div>

        <div class="form-group">
          <label for="dept-desc">Descrição / Atribuições</label>
          <textarea id="dept-desc" class="form-textarea" rows="2" placeholder="Informações adicionais do setor...">${d.description || ''}</textarea>
        </div>

        ${isEditing ? `
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" id="dept-active" ${d.active ? 'checked' : ''}>
              <span>Departamento Ativo</span>
            </label>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEditing ? 'Salvar Alterações' : 'Cadastrar'}</button>
      </div>
    </form>
  `;

  showModal(content, (modalRoot) => {
    modalRoot.querySelector('#form-dept-save').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: modalRoot.querySelector('#dept-name').value,
        cost_center: modalRoot.querySelector('#dept-cc').value,
        description: modalRoot.querySelector('#dept-desc').value
      };
      if (isEditing) {
        payload.active = modalRoot.querySelector('#dept-active').checked;
      }

      try {
        if (isEditing) {
          await api.put(`/departments/${deptId}`, payload);
          showToast('Departamento atualizado com sucesso!');
        } else {
          await api.post('/departments', payload);
          showToast('Departamento cadastrado com sucesso!');
        }
        closeModal();
        loadDepartmentsList();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
