/**
 * View: Cadastro e Gestão de Fornecedores Homologados.
 */
import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showModal, closeModal, confirmDialog } from '../components.js';

export async function renderSuppliers(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Fornecedores Homologados</h1>
        <p class="page-subtitle">Cadastre os parceiros comerciais, distribuidores e fabricantes que fornecem materiais para a empresa</p>
      </div>
      <div>
        <button id="btn-add-supplier" class="btn btn-primary admin-only">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Novo Fornecedor</span>
        </button>
      </div>
    </div>

    <!-- FILTRO DE BUSCA -->
    <div class="content-card">
      <div class="card-body" style="padding: 1.1rem 1.4rem;">
        <div class="filter-bar">
          <input type="text" id="sup-filter-search" class="form-input" style="max-width: 320px;" placeholder="Buscar por Nome, Razão Social, CNPJ ou Contato...">
          <button id="btn-search-suppliers" class="btn btn-outline">Buscar</button>
        </div>
      </div>
    </div>

    <!-- TABELA DE FORNECEDORES -->
    <div class="content-card">
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome / Nome Fantasia</th>
                <th>Razão Social</th>
                <th>CNPJ</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Contato</th>
                <th>Produtos Vinculados</th>
                <th>Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="suppliers-table-tbody">
              <tr><td colspan="9" class="text-center text-muted">Carregando fornecedores...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  loadSuppliersList();

  const searchInput = document.getElementById('sup-filter-search');
  searchInput.addEventListener('input', () => {
    loadSuppliersList(searchInput.value);
  });

  const addBtn = document.getElementById('btn-add-supplier');
  if (addBtn) {
    if (!state.isAdmin()) addBtn.classList.add('hidden');
    addBtn.addEventListener('click', () => openSupplierModal());
  }
}

async function loadSuppliersList(search = '') {
  const tbody = document.getElementById('suppliers-table-tbody');
  if (!tbody) return;

  try {
    const data = await api.get('/suppliers', { search });
    const suppliers = data.suppliers || [];

    if (suppliers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding:2rem;">Nenhum fornecedor encontrado.</td></tr>`;
      return;
    }

    const isAdmin = state.isAdmin();

    tbody.innerHTML = suppliers.map(s => `
      <tr>
        <td class="font-semibold">${s.name}</td>
        <td class="text-muted">${s.corporate_name || '-'}</td>
        <td><code>${s.cnpj || 'Não informado'}</code></td>
        <td>${s.phone || '-'}</td>
        <td>${s.email ? `<a href="mailto:${s.email}">${s.email}</a>` : '-'}</td>
        <td>${s.contact_person || '-'}</td>
        <td><strong>${s.supplied_products_count || 0}</strong> produto(s)</td>
        <td>${s.active ? '<span class="badge badge-normal">Ativo</span>' : '<span class="badge badge-zero">Inativo</span>'}</td>
        <td class="text-right">
          ${isAdmin ? `
            <div class="table-actions" style="justify-content: flex-end;">
              <button class="btn btn-sm btn-outline btn-edit-sup" data-id="${s.id}">Editar</button>
              <button class="btn btn-sm btn-outline text-danger btn-del-sup" data-id="${s.id}" data-name="${s.name}">Desativar</button>
            </div>
          ` : '-'}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-sup').forEach(btn => {
      btn.addEventListener('click', () => openSupplierModal(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-del-sup').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmDialog({
          title: 'Desativar Fornecedor',
          message: `Deseja desativar o fornecedor "${btn.dataset.name}"? O histórico de compras e entradas permanecerá intacto.`,
          confirmText: 'Desativar',
          onConfirm: async () => {
            try {
              await api.delete(`/suppliers/${btn.dataset.id}`);
              showToast('Fornecedor atualizado com sucesso!');
              loadSuppliersList();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });
    });

  } catch (err) {
    console.error('Erro ao listar fornecedores:', err);
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Falha ao carregar fornecedores: ${err.message}</td></tr>`;
  }
}

async function openSupplierModal(supplierId = null) {
  const isEditing = !!supplierId;
  let s = { name: '', corporate_name: '', cnpj: '', phone: '', email: '', contact_person: '', address: '', notes: '', active: true };

  if (isEditing) {
    try {
      const data = await api.get(`/suppliers`);
      const found = (data.suppliers || []).find(item => String(item.id) === String(supplierId));
      if (found) s = found;
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  const content = `
    <div class="modal-header">
      <h3 class="modal-title">${isEditing ? 'Editar Fornecedor' : 'Cadastrar Novo Fornecedor'}</h3>
      <button class="modal-close-btn">&times;</button>
    </div>
    <form id="form-sup-save">
      <div class="modal-body">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label for="sup-name">Nome Fantasia / Comercial *</label>
            <input type="text" id="sup-name" class="form-input" placeholder="Ex: Tech Supply Equipamentos" value="${s.name}" required>
          </div>
          <div class="form-group">
            <label for="sup-corp">Razão Social</label>
            <input type="text" id="sup-corp" class="form-input" placeholder="Ex: Tech Supply Comércio de Periféricos Ltda" value="${s.corporate_name || ''}">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label for="sup-cnpj">CNPJ</label>
            <input type="text" id="sup-cnpj" class="form-input font-mono" placeholder="00.000.000/0000-00" value="${s.cnpj || ''}">
          </div>
          <div class="form-group">
            <label for="sup-phone">Telefone de Contato</label>
            <input type="text" id="sup-phone" class="form-input" placeholder="(11) 4002-8922" value="${s.phone || ''}">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label for="sup-email">E-mail Comercial</label>
            <input type="email" id="sup-email" class="form-input" placeholder="vendas@empresa.com.br" value="${s.email || ''}">
          </div>
          <div class="form-group">
            <label for="sup-contact">Pessoa de Contato / Vendedor</label>
            <input type="text" id="sup-contact" class="form-input" placeholder="Ex: Carlos Oliveira" value="${s.contact_person || ''}">
          </div>
        </div>

        <div class="form-group">
          <label for="sup-address">Endereço Completo</label>
          <input type="text" id="sup-address" class="form-input" placeholder="Rua, Número, Bairro, Cidade/UF, CEP" value="${s.address || ''}">
        </div>

        <div class="form-group">
          <label for="sup-notes">Observações Comerciais</label>
          <textarea id="sup-notes" class="form-textarea" rows="2" placeholder="Prazos de entrega, limites de faturamento, etc.">${s.notes || ''}</textarea>
        </div>

        ${isEditing ? `
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" id="sup-active" ${s.active ? 'checked' : ''}>
              <span>Fornecedor Homologado Ativo</span>
            </label>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEditing ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}</button>
      </div>
    </form>
  `;

  showModal(content, (modalRoot) => {
    modalRoot.querySelector('#form-sup-save').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: modalRoot.querySelector('#sup-name').value,
        corporate_name: modalRoot.querySelector('#sup-corp').value,
        cnpj: modalRoot.querySelector('#sup-cnpj').value,
        phone: modalRoot.querySelector('#sup-phone').value,
        email: modalRoot.querySelector('#sup-email').value,
        contact_person: modalRoot.querySelector('#sup-contact').value,
        address: modalRoot.querySelector('#sup-address').value,
        notes: modalRoot.querySelector('#sup-notes').value
      };
      if (isEditing) {
        payload.active = modalRoot.querySelector('#sup-active').checked;
      }

      try {
        if (isEditing) {
          await api.put(`/suppliers/${supplierId}`, payload);
          showToast('Fornecedor atualizado com sucesso!');
        } else {
          await api.post('/suppliers', payload);
          showToast('Fornecedor cadastrado com sucesso!');
        }
        closeModal();
        loadSuppliersList();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
