/*
 * Nora Business — soporte de carga PDF
 * Este archivo funciona junto a business.js sin sustituir su lógica.
 */
(() => {
  'use strict';

  const form = document.getElementById('documentForm');
  const fileInput = document.getElementById('docFile');
  const titleInput = document.getElementById('docTitle');
  const contentInput = document.getElementById('docContent');
  const modal = document.getElementById('documentModal');

  if (!form || !fileInput) return;

  const MAX_PDF_BYTES = 10 * 1024 * 1024;

  function showMessage(message, type = 'info') {
    const toast = document.getElementById('toast');

    if (!toast) {
      alert(message);
      return;
    }

    toast.textContent = message;
    toast.classList.remove('success', 'error', 'info');
    toast.classList.add(type);

    if (typeof toast._noraTimer === 'number') {
      clearTimeout(toast._noraTimer);
    }

    toast._noraTimer = setTimeout(() => {
      toast.textContent = '';
      toast.classList.remove('success', 'error', 'info');
    }, 5000);
  }

  function isPdf(file) {
    return Boolean(
      file &&
      (
        file.type === 'application/pdf' ||
        /\.pdf$/i.test(file.name)
      )
    );
  }

  function setLoading(loading) {
    const submit = form.querySelector('button[type="submit"]');

    if (!submit) return;

    submit.disabled = loading;
    submit.dataset.originalText ||= submit.textContent;
    submit.textContent = loading
      ? 'Procesando PDF…'
      : submit.dataset.originalText;
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];

    if (!file || !isPdf(file)) return;

    if (file.size > MAX_PDF_BYTES) {
      fileInput.value = '';
      showMessage('El PDF supera el límite de 10 MB.', 'error');
      return;
    }

    if (titleInput && !titleInput.value.trim()) {
      titleInput.value = file.name
        .replace(/\.pdf$/i, '')
        .slice(0, 160);
    }

    if (contentInput) {
      contentInput.removeAttribute('required');
      contentInput.placeholder =
        'El contenido del PDF se extraerá automáticamente al guardarlo.';
    }
  });

  /*
   * Capturamos el submit antes de business.js.
   *
   * Si el archivo seleccionado es PDF:
   *   - evitamos que business.js intente tratarlo como texto;
   *   - lo enviamos al endpoint específico de PDF;
   *   - el servidor extrae el texto;
   *   - se guarda en la base de conocimiento.
   */
  form.addEventListener('submit', async (event) => {
    const file = fileInput.files?.[0];

    if (!isPdf(file)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (file.size > MAX_PDF_BYTES) {
      showMessage('El PDF supera el límite de 10 MB.', 'error');
      return;
    }

    const title = String(titleInput?.value || '')
      .trim()
      .slice(0, 160);

    setLoading(true);

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          resolve(String(reader.result || ''));
        };

        reader.onerror = () => {
          reject(
            new Error(
              'No se pudo leer el PDF seleccionado.'
            )
          );
        };

        reader.readAsDataURL(file);
      });

      const response = await fetch(
        '/api/business/knowledge/pdf',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title,
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            data: dataUrl
          })
        }
      );

      let result = {};

      try {
        result = await response.json();
      } catch (_) {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.message ||
          'No se ha podido incorporar el PDF.'
        );
      }

      showMessage(
        result.message ||
          'PDF incorporado correctamente. Nora ya puede consultarlo.',
        'success'
      );

      form.reset();

      if (contentInput) {
        contentInput.setAttribute('required', '');
        contentInput.placeholder =
          'Pegue el contenido del documento aquí...';
      }

      if (modal) {
        modal.classList.add('hidden');
      }

      /*
       * Recargamos para actualizar:
       * - contador de documentos
       * - tarjetas de conocimiento
       * - actividad
       * - contexto disponible para el chat
       */
      setTimeout(
        () => window.location.reload(),
        700
      );

    } catch (error) {
      console.error(
        'Error cargando PDF en Nora Business:',
        error
      );

      showMessage(
        error.message ||
          'No se ha podido procesar el PDF.',
        'error'
      );

    } finally {
      setLoading(false);
    }
  }, true);
})();

(() => {
  'use strict';

  const state = { tasks: [], documents: [] };
  const viewTitles = {
    overview: ['ESPACIO EMPRESARIAL', 'Resumen'],
    knowledge: ['BASE DE CONOCIMIENTO', 'Conocimiento'],
    tasks: ['GESTIÓN', 'Tareas'],
    team: ['EQUIPO', 'Equipo'],
    activity: ['AUDITORÍA BÁSICA', 'Actividad']
  };
  const priorityLabels = { low: 'Baja', medium: 'Media', high: 'Alta' };

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || 'No se pudo completar la operación.');
    }

    return data;
  }

  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('success', 'error', 'info');
    toast.classList.add(type);
    clearTimeout(toast._noraTimer);
    toast._noraTimer = setTimeout(() => {
      toast.textContent = '';
      toast.classList.remove('success', 'error', 'info');
    }, 4500);
  }

  function addEmptyState(container, message) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = message;
    container.append(empty);
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short'
    }).format(date);
  }

  function createTaskItem(task) {
    const item = document.createElement('div');
    item.className = 'task-item';

    const marker = document.createElement('span');
    marker.className = `task-check${task.completed ? ' done' : ''}`;
    marker.textContent = task.completed ? '✓' : '';
    marker.setAttribute('aria-hidden', 'true');

    const info = document.createElement('div');
    info.className = 'task-info';

    const title = document.createElement('strong');
    title.textContent = task.title || 'Tarea';
    info.append(title);

    const metadata = document.createElement('small');
    const details = [priorityLabels[task.priority] || 'Media'];
    const dueDate = formatDate(task.dueDate);
    if (dueDate) details.push(`Vence ${dueDate}`);
    metadata.textContent = details.join(' · ');
    info.append(metadata);

    item.append(marker, info);
    return item;
  }

  function renderTasks() {
    const pending = state.tasks.filter(task => !task.completed);
    const stat = document.getElementById('statOpenTasks');
    if (stat) stat.textContent = String(pending.length);

    const recentContainer = document.getElementById('dashboardTasks');
    const fullContainer = document.getElementById('fullTaskList');
    const recent = [...state.tasks].reverse().slice(0, 4);

    if (recentContainer) {
      recentContainer.replaceChildren();
      if (recent.length) recent.forEach(task => recentContainer.append(createTaskItem(task)));
      else addEmptyState(recentContainer, 'No hay tareas pendientes. Añada la primera acción del equipo.');
    }

    if (fullContainer) {
      fullContainer.replaceChildren();
      if (state.tasks.length) {
        [...state.tasks].reverse().forEach(task => fullContainer.append(createTaskItem(task)));
      } else {
        addEmptyState(fullContainer, 'Todavía no hay tareas en este espacio.');
      }
    }
  }

  function createKnowledgeCard(documentItem) {
    const card = document.createElement('article');
    card.className = 'knowledge-card';

    const top = document.createElement('div');
    top.className = 'doc-top';
    const badge = document.createElement('span');
    badge.className = 'doc-badge';
    badge.textContent = '▤';
    const date = document.createElement('small');
    date.textContent = formatDate(documentItem.createdAt);
    top.append(badge, date);

    const title = document.createElement('h3');
    title.textContent = documentItem.title || 'Documento';
    const preview = document.createElement('p');
    preview.textContent = documentItem.preview || 'Documento incorporado a la base de conocimiento.';

    card.append(top, title, preview);
    return card;
  }

  function renderDocuments() {
    const count = document.getElementById('statKnowledge');
    if (count) count.textContent = String(state.documents.length);

    const grid = document.getElementById('knowledgeGrid');
    if (grid) {
      grid.replaceChildren();
      if (state.documents.length) {
        [...state.documents].reverse().forEach(item => grid.append(createKnowledgeCard(item)));
      } else {
        addEmptyState(grid, 'Aún no se ha añadido documentación.');
      }
    }

    const preview = document.getElementById('dashboardKnowledge');
    if (preview) {
      preview.replaceChildren();
      const items = [...state.documents].reverse().slice(0, 3);
      if (items.length) {
        items.forEach(item => {
          const row = document.createElement('div');
          row.className = 'knowledge-mini';
          const badge = document.createElement('span');
          badge.className = 'doc-badge';
          badge.textContent = '▤';
          const title = document.createElement('strong');
          title.textContent = item.title || 'Documento';
          row.append(badge, title);
          preview.append(row);
        });
      } else {
        addEmptyState(preview, 'Añada un procedimiento para que Nora pueda consultarlo.');
      }
    }
  }

  async function refreshWorkspace() {
    try {
      const [taskData, documentData] = await Promise.all([
        requestJson('/api/business/tasks'),
        requestJson('/api/business/knowledge/documents')
      ]);
      state.tasks = Array.isArray(taskData.tasks) ? taskData.tasks : [];
      state.documents = Array.isArray(documentData.documents) ? documentData.documents : [];
      renderTasks();
      renderDocuments();
    } catch (error) {
      showToast(error.message || 'No se pudo actualizar el espacio.', 'error');
    }
  }

  function setView(view) {
    const target = document.getElementById(`${view}View`);
    if (!target) return;

    document.querySelectorAll('.view').forEach(section => {
      section.classList.toggle('active', section === target);
    });
    document.querySelectorAll('.nav-item').forEach(button => {
      button.classList.toggle('active', button.dataset.view === view);
    });

    const [eyebrow, title] = viewTitles[view] || viewTitles.overview;
    const eyebrowNode = document.getElementById('viewEyebrow');
    const titleNode = document.getElementById('viewTitle');
    if (eyebrowNode) eyebrowNode.textContent = eyebrow;
    if (titleNode) titleNode.textContent = title;
  }

  function openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
  }

  function setFormLoading(form, loading, label) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = loading;
    button.dataset.originalText ||= button.textContent;
    button.textContent = loading ? label : button.dataset.originalText;
  }

  function appendChatMessage(role, text) {
    const messages = document.getElementById('chatMessages');
    if (!messages) return;

    const message = document.createElement('div');
    message.className = `message ${role}`;

    if (role === 'nora') {
      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.textContent = 'N';
      message.append(avatar);
    }

    const body = document.createElement('div');
    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = role === 'nora' ? 'Nora' : 'Usted';
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    body.append(label, paragraph);
    message.append(body);
    messages.append(message);
    messages.scrollTop = messages.scrollHeight;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-view]').forEach(button => {
      button.addEventListener('click', () => {
        setView(button.dataset.view);
        closeSidebar();
      });
    });

    const sidebar = document.getElementById('sidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const closeSidebar = () => {
      sidebar?.classList.remove('open');
      mobileOverlay?.classList.add('hidden');
    };

    document.getElementById('openSidebar')?.addEventListener('click', () => {
      sidebar?.classList.add('open');
      mobileOverlay?.classList.remove('hidden');
    });
    document.getElementById('closeSidebar')?.addEventListener('click', closeSidebar);
    mobileOverlay?.addEventListener('click', closeSidebar);

    document.getElementById('quickTaskBtn')?.addEventListener('click', () => openModal('taskModal'));
    document.getElementById('addTaskBtn')?.addEventListener('click', () => openModal('taskModal'));
    document.getElementById('quickKnowledgeBtn')?.addEventListener('click', () => openModal('documentModal'));
    document.getElementById('addKnowledgeBtn')?.addEventListener('click', () => openModal('documentModal'));

    document.querySelectorAll('.close-modal').forEach(button => {
      button.addEventListener('click', () => closeModal(button.closest('.modal')));
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', event => {
        if (event.target === modal) closeModal(modal);
      });
    });

    const taskForm = document.getElementById('taskForm');
    taskForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const title = document.getElementById('taskTitle')?.value.trim() || '';
      if (!title) return;

      setFormLoading(taskForm, true, 'Guardando...');
      try {
        const dueValue = document.getElementById('taskDue')?.value || '';
        await requestJson('/api/business/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: document.getElementById('taskDetails')?.value.trim() || '',
            priority: document.getElementById('taskPriority')?.value || 'medium',
            dueDate: dueValue ? new Date(dueValue).toISOString() : null
          })
        });
        taskForm.reset();
        closeModal(document.getElementById('taskModal'));
        await refreshWorkspace();
        showToast('Tarea guardada en el espacio empresarial.', 'success');
      } catch (error) {
        showToast(error.message || 'No se pudo guardar la tarea.', 'error');
      } finally {
        setFormLoading(taskForm, false, 'Guardando...');
      }
    });

    const documentForm = document.getElementById('documentForm');
    const fileInput = document.getElementById('docFile');
    const contentInput = document.getElementById('docContent');
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) {
        contentInput?.setAttribute('required', '');
        return;
      }
      if (!document.getElementById('docTitle')?.value.trim()) {
        document.getElementById('docTitle').value = file.name.replace(/\.[^.]+$/, '').slice(0, 160);
      }
      if (!/\.pdf$/i.test(file.name)) contentInput?.removeAttribute('required');
    });

    documentForm?.addEventListener('submit', async event => {
      const file = fileInput?.files?.[0];
      if (file && /\.pdf$/i.test(file.name)) return;
      event.preventDefault();

      const title = document.getElementById('docTitle')?.value.trim() || '';
      setFormLoading(documentForm, true, 'Incorporando...');
      try {
        const content = file ? await file.text() : contentInput?.value.trim() || '';
        if (!title || !content) throw new Error('Indique un título y el contenido del documento.');
        const result = await requestJson('/api/business/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: title, content })
        });
        documentForm.reset();
        contentInput?.setAttribute('required', '');
        closeModal(document.getElementById('documentModal'));
        await refreshWorkspace();
        showToast(result.message || 'Documento incorporado a la base de conocimiento.', 'success');
      } catch (error) {
        showToast(error.message || 'No se pudo incorporar el documento.', 'error');
      } finally {
        setFormLoading(documentForm, false, 'Incorporando...');
      }
    });

    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    chatForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const message = chatInput?.value.trim() || '';
      if (!message) return;

      appendChatMessage('user', message);
      chatInput.value = '';
      const submit = chatForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const result = await requestJson('/api/business/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        const sources = Array.isArray(result.sources) && result.sources.length
          ? `\nFuentes: ${result.sources.join(', ')}`
          : '';
        appendChatMessage('nora', `${result.reply || 'No hay respuesta disponible.'}${sources}`);
        if (result.createdTask) {
          await refreshWorkspace();
        }
      } catch (error) {
        appendChatMessage('nora', error.message || 'No se pudo completar la consulta.');
      } finally {
        if (submit) submit.disabled = false;
        chatInput?.focus();
      }
    });

    document.querySelectorAll('[data-prompt]').forEach(button => {
      button.addEventListener('click', () => {
        if (!chatInput || !chatForm) return;
        chatInput.value = button.dataset.prompt || '';
        chatForm.requestSubmit();
      });
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      try {
        await requestJson('/api/auth/logout', { method: 'POST' });
        window.location.reload();
      } catch (error) {
        showToast(error.message || 'No se pudo cerrar la sesión.', 'error');
      }
    });

    window.addEventListener('nora:dashboard-loaded', () => {
      void refreshWorkspace();
    });
  });
})();
