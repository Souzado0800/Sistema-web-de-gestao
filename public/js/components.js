/**
 * Componentes Reutilizáveis de Interface: Modais, Toasts, Diálogos e Badges.
 */

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;

  let icon = '✔';
  if (type === 'error') icon = '✖';
  if (type === 'warning') icon = '⚠';
  if (type === 'info') icon = 'ℹ';

  toast.innerHTML = `
    <span class="toast-icon font-semibold">${icon}</span>
    <span class="toast-text">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function showModal(contentHtml, onMounted = null) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop cursor-pointer" id="modal-backdrop-close"></div>
    <div class="modal-box modal-lg" id="active-modal-box">
      ${contentHtml}
    </div>
  `;
  container.classList.remove('hidden');

  const backdrop = document.getElementById('modal-backdrop-close');
  if (backdrop) {
    backdrop.addEventListener('click', closeModal);
  }

  const closeBtns = container.querySelectorAll('.modal-close-btn, .btn-modal-cancel');
  closeBtns.forEach(btn => btn.addEventListener('click', closeModal));

  if (typeof onMounted === 'function') {
    onMounted(container);
  }
}

export function closeModal() {
  const container = document.getElementById('modal-container');
  if (container) {
    container.classList.add('hidden');
    container.innerHTML = '';
  }
}

export function confirmDialog({ title = 'Confirmação', message = 'Deseja prosseguir?', confirmText = 'Confirmar', isDanger = true, onConfirm = null }) {
  const dialog = document.getElementById('confirm-dialog');
  const titleEl = document.getElementById('confirm-dialog-title');
  const msgEl = document.getElementById('confirm-dialog-message');
  const okBtn = document.getElementById('btn-confirm-ok');
  const cancelBtn = document.getElementById('btn-confirm-cancel');

  if (!dialog) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtn.textContent = confirmText;
  okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

  dialog.classList.remove('hidden');

  const cleanup = () => {
    dialog.classList.add('hidden');
    okBtn.replaceWith(okBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  };

  const newCancel = document.getElementById('btn-confirm-cancel');
  newCancel.addEventListener('click', cleanup);

  const newOk = document.getElementById('btn-confirm-ok');
  newOk.addEventListener('click', () => {
    cleanup();
    if (typeof onConfirm === 'function') onConfirm();
  });
}

export function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function renderStockBadge(level, currentStock, minStock) {
  const current = parseFloat(currentStock);
  const min = parseFloat(minStock);

  if (level === 'zero' || current <= 0) {
    return `<span class="badge badge-zero" title="Estoque zerado!">Sem Estoque (0)</span>`;
  }
  if (level === 'critical' || current <= (min * 0.5)) {
    return `<span class="badge badge-critical" title="Estoque crítico: muito abaixo do mínimo!">Crítico (${current})</span>`;
  }
  if (level === 'low' || current <= min) {
    return `<span class="badge badge-low" title="Abaixo do estoque mínimo!">Estoque Baixo (${current})</span>`;
  }
  return `<span class="badge badge-normal" title="Estoque adequado">Normal (${current})</span>`;
}

export function renderPagination({ total, limit, offset, onPageChange }) {
  if (total <= limit) return '';

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const startRecord = offset + 1;
  const endRecord = Math.min(offset + limit, total);

  let html = `
    <div class="pagination-wrapper">
      <div class="pagination-info">
        Exibindo <strong>${startRecord}</strong> a <strong>${endRecord}</strong> de <strong>${total}</strong> registros
      </div>
      <div class="pagination-controls">
        <button class="btn btn-sm btn-outline btn-page-prev" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
        <span class="pagination-page">Página ${currentPage} de ${totalPages}</span>
        <button class="btn btn-sm btn-outline btn-page-next" ${currentPage === totalPages ? 'disabled' : ''}>Próxima</button>
      </div>
    </div>
  `;

  return {
    html,
    attachEvents(container) {
      const prevBtn = container.querySelector('.btn-page-prev');
      const nextBtn = container.querySelector('.btn-page-next');
      if (prevBtn && currentPage > 1) {
        prevBtn.addEventListener('click', () => onPageChange(offset - limit));
      }
      if (nextBtn && currentPage < totalPages) {
        nextBtn.addEventListener('click', () => onPageChange(offset + limit));
      }
    }
  };
}
