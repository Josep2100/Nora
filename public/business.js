/*
 * Claryvo — soporte de carga PDF
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
          'PDF incorporado correctamente. Claryvo ya puede consultarlo.',
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
        'Error cargando PDF en Claryvo:',
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

  const state = { tasks: [], documents: [], team: [] };
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
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function formatGoogleCalDates(dueDate) {
    if (!dueDate) return '';
    const start = new Date(dueDate);
    if (isNaN(start.getTime())) return '';
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return `${fmt(start)}/${fmt(end)}`;
  }

  async function setupCalendarFeed() {
    const button = document.getElementById('syncCalendarBtn');
    if (!button) return;

    try {
      const feed = await requestJson('/api/business/calendar/feed');
      // Windows/Outlook y Google Calendar necesitan una URL HTTPS completa.
      button.href = feed.httpsUrl;
      button.title = 'Abrir el feed HTTPS del calendario';
      button.dataset.webcalUrl = feed.webcalUrl || '';
      const help = document.getElementById('calendarSyncHelp');
      const urlInput = document.getElementById('calendarFeedUrl');
      const copyButton = document.getElementById('copyCalendarUrlBtn');
      if (help && urlInput) {
        urlInput.value = feed.httpsUrl || '';
        help.classList.remove('hidden');
        copyButton?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(feed.httpsUrl);
            showToast('URL HTTPS copiada. Péguela en “Suscribirse desde la web”.', 'success');
          } catch (_) {
            urlInput.select();
            showToast('Seleccione y copie la URL HTTPS manualmente.', 'info');
          }
        }, { once: true });
      }
      const connections = await requestJson('/api/calendar/connections').catch(() => ({}));
      const status = document.getElementById('calendarConnectionStatus');
      if (status) {
        const connected = [connections.google && 'Google Calendar', connections.microsoft && 'Outlook/Microsoft 365'].filter(Boolean);
        status.textContent = connected.length
          ? `Conectado: ${connected.join(' y ')}. Las tareas nuevas con fecha se añadirán automáticamente.`
          : 'Conecte uno o ambos calendarios arriba para añadir automáticamente las tareas con fecha.';
      }
    } catch (error) {
      // El enlace .ics sigue funcionando si el feed no está disponible.
      console.warn('No se pudo preparar la suscripción de calendario:', error.message);
    }
  }

  async function handleToggleTask(taskId) {
    try {
      const res = await requestJson(`/api/business/tasks/${taskId}/toggle`, { method: 'POST' });
      const taskIndex = state.tasks.findIndex(t => String(t.id) === String(taskId));
      if (taskIndex >= 0) {
        state.tasks[taskIndex].completed = Boolean(res.task?.completed);
      }
      renderTasks();
      showToast(res.message || (res.task?.completed ? '✓ Tarea completada' : 'Tarea pendiente'), 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo actualizar el estado de la tarea.', 'error');
    }
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('¿Desea eliminar esta tarea?')) return;
    try {
      await requestJson(`/api/business/tasks/${taskId}`, { method: 'DELETE' });
      state.tasks = state.tasks.filter(t => String(t.id) !== String(taskId));
      renderTasks();
      showToast('Tarea eliminada correctamente.', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo eliminar la tarea.', 'error');
    }
  }

  function createTaskItem(task, isFullView = false) {
    const item = document.createElement('div');
    item.className = `task-item${task.completed ? ' completed' : ''}`;

    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `task-check${task.completed ? ' done' : ''}`;
    marker.title = task.completed ? 'Marcar como pendiente' : 'Marcar como completada';
    marker.setAttribute('aria-label', task.completed ? 'Completada' : 'Pendiente');
    marker.textContent = task.completed ? '✓' : '';
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      void handleToggleTask(task.id);
    });

    const info = document.createElement('div');
    info.className = 'task-info';

    const title = document.createElement('strong');
    title.textContent = task.title || 'Tarea';
    if (task.completed) {
      title.style.textDecoration = 'line-through';
      title.style.opacity = '0.6';
    }
    info.append(title);

    const metadata = document.createElement('small');
    const details = [priorityLabels[task.priority] || 'Media'];
    const dueDate = formatDate(task.dueDate);
    if (dueDate) {
      details.push(`📅 ${dueDate} (Recordatorio 24h antes)`);
    }
    metadata.textContent = details.join(' · ');
    info.append(metadata);

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.style.display = 'flex';
    actions.style.alignItems = 'center';
    actions.style.gap = '6px';
    actions.style.marginLeft = 'auto';

    if (task.dueDate && isFullView) {
      const gcalLink = document.createElement('a');
      gcalLink.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.title)}&dates=${formatGoogleCalDates(task.dueDate)}&details=${encodeURIComponent(task.description || 'Tarea asignada en Claryvo')}`;
      gcalLink.target = '_blank';
      gcalLink.rel = 'noopener';
      gcalLink.className = 'cal-link';
      gcalLink.title = 'Añadir a Google Calendar';
      gcalLink.textContent = '📅 GCal';
      gcalLink.style.fontSize = '11px';
      gcalLink.style.padding = '3px 7px';
      gcalLink.style.borderRadius = '6px';
      gcalLink.style.background = '#1b2333';
      gcalLink.style.color = '#78aaff';
      gcalLink.style.textDecoration = 'none';

      const icsLink = document.createElement('a');
      icsLink.href = `/api/business/calendar/task/${task.id}.ics`;
      icsLink.download = `tarea-${task.id}.ics`;
      icsLink.className = 'cal-link';
      icsLink.title = 'Descargar evento .ics con alarma 1 día antes para Apple / Outlook / Móvil';
      icsLink.textContent = '📱 .ics';
      icsLink.style.fontSize = '11px';
      icsLink.style.padding = '3px 7px';
      icsLink.style.borderRadius = '6px';
      icsLink.style.background = '#1b2333';
      icsLink.style.color = '#5ee0b0';
      icsLink.style.textDecoration = 'none';

      actions.append(gcalLink, icsLink);
    }

    if (isFullView) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Eliminar tarea';
      deleteBtn.textContent = '🗑️';
      deleteBtn.style.fontSize = '12px';
      deleteBtn.style.padding = '3px 6px';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        void handleDeleteTask(task.id);
      });
      actions.append(deleteBtn);
    }

    item.append(marker, info, actions);
    return item;
  }

  function renderTasks() {
    const pending = state.tasks.filter(task => !task.completed);
    const stat = document.getElementById('statOpenTasks');
    if (stat) stat.textContent = String(pending.length);

    const recentContainer = document.getElementById('dashboardTasks');
    const fullContainer = document.getElementById('fullTaskList');
    const recent = [...state.tasks].reverse().slice(0, 5);

    if (recentContainer) {
      recentContainer.replaceChildren();
      if (recent.length) recent.forEach(task => recentContainer.append(createTaskItem(task, false)));
      else addEmptyState(recentContainer, 'No hay tareas pendientes. Añada la primera acción del equipo.');
    }

    if (fullContainer) {
      fullContainer.replaceChildren();
      if (state.tasks.length) {
        [...state.tasks].reverse().forEach(task => fullContainer.append(createTaskItem(task, true)));
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
        addEmptyState(preview, 'Añada un procedimiento para que Claryvo pueda consultarlo.');
      }
    }
  }

  async function handleRemoveMember(memberId) {
    if (!confirm('¿Desea revocar el acceso de este miembro?')) return;
    try {
      await requestJson(`/api/business/team/${memberId}`, { method: 'DELETE' });
      state.team = state.team.filter(m => String(m.id) !== String(memberId));
      renderTeam();
      showToast('Acceso revocado correctamente.', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo revocar el acceso.', 'error');
    }
  }

  function createTeamCard(member) {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '14px';
    card.style.padding = '14px';
    card.style.background = '#101522';
    card.style.border = '1px solid var(--line)';
    card.style.borderRadius = '14px';
    card.style.marginBottom = '9px';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = (member.name || member.email || 'M').charAt(0).toUpperCase();

    const info = document.createElement('div');
    info.style.flex = '1';

    const nameRow = document.createElement('strong');
    nameRow.textContent = member.name || member.email;
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'center';
    nameRow.style.gap = '8px';

    if (member.isOwner) {
      const ownerBadge = document.createElement('span');
      ownerBadge.textContent = '👑 Propietario';
      ownerBadge.style.fontSize = '10px';
      ownerBadge.style.color = '#f59e0b';
      ownerBadge.style.background = '#3a2d12';
      ownerBadge.style.padding = '2px 6px';
      ownerBadge.style.borderRadius = '4px';
      nameRow.append(ownerBadge);
    }
    info.append(nameRow);

    const emailRow = document.createElement('span');
    emailRow.textContent = member.email;
    emailRow.style.color = '#7f8ba0';
    emailRow.style.fontSize = '12px';
    emailRow.style.display = 'block';
    emailRow.style.marginTop = '2px';
    info.append(emailRow);

    const permDesc = {
      all: 'Permisos: Control total',
      editor: 'Permisos: Crear y editar tareas y conocimiento',
      read: 'Permisos: Solo lectura y consultas'
    };
    const permRow = document.createElement('small');
    permRow.textContent = permDesc[member.permissions] || `Permisos: ${member.role}`;
    permRow.style.color = '#9ca8bf';
    permRow.style.fontSize = '11px';
    permRow.style.display = 'block';
    permRow.style.marginTop = '3px';
    info.append(permRow);

    const rightCol = document.createElement('div');
    rightCol.style.display = 'flex';
    rightCol.style.alignItems = 'center';
    rightCol.style.gap = '8px';

    const roleBadge = document.createElement('span');
    roleBadge.className = 'role';
    roleBadge.textContent = member.role || 'Miembro';
    rightCol.append(roleBadge);

    if (!member.isOwner) {
      const revokeBtn = document.createElement('button');
      revokeBtn.type = 'button';
      revokeBtn.className = 'delete-btn';
      revokeBtn.title = 'Revocar acceso';
      revokeBtn.textContent = '🗑️';
      revokeBtn.style.padding = '4px 8px';
      revokeBtn.addEventListener('click', () => {
        void handleRemoveMember(member.id);
      });
      rightCol.append(revokeBtn);
    }

    card.append(avatar, info, rightCol);
    return card;
  }

  function renderTeam() {
    const stat = document.getElementById('statMembers');
    if (stat) stat.textContent = String(state.team.length || 1);

    const container = document.getElementById('teamList');
    if (container) {
      container.replaceChildren();
      if (state.team.length) {
        state.team.forEach(member => container.append(createTeamCard(member)));
      } else {
        addEmptyState(container, 'No hay miembros adicionales invitados aún.');
      }
    }
  }

  function checkUpcomingReminders() {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const upcoming = state.tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const due = new Date(t.dueDate).getTime();
      return due > now && due <= (now + oneDayMs);
    });

    if (upcoming.length > 0 && typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        upcoming.forEach(task => {
          const dueFmt = formatDate(task.dueDate);
          try {
            new Notification('Recordatorio Claryvo (Entrega próxima)', {
              body: `La tarea "${task.title}" vence en menos de 24 horas (${dueFmt}).`,
              icon: '/icon-192.png'
            });
          } catch (_) {}
        });
      }
    }
  }

  async function refreshWorkspace() {
    try {
      const [taskData, documentData, teamData] = await Promise.all([
        requestJson('/api/business/tasks'),
        requestJson('/api/business/knowledge/documents'),
        requestJson('/api/business/team').catch(() => ({ team: [] }))
      ]);
      state.tasks = Array.isArray(taskData.tasks) ? taskData.tasks : [];
      state.documents = Array.isArray(documentData.documents) ? documentData.documents : [];
      state.team = Array.isArray(teamData.team) ? teamData.team : [];
      renderTasks();
      renderDocuments();
      renderTeam();
      checkUpcomingReminders();
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
    label.textContent = role === 'nora' ? 'Claryvo' : 'Usted';
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    body.append(label, paragraph);
    message.append(body);
    messages.append(message);
    messages.scrollTop = messages.scrollHeight;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const calendarMessage = new URLSearchParams(window.location.search).get('calendar');
    const calendarMessages = {
      'google-not-configured': ['Google Calendar aún no está configurado. Añade sus credenciales OAuth en Render.', 'info'],
      'microsoft-not-configured': ['Outlook/Microsoft 365 aún no está configurado. Añade sus credenciales OAuth en Render.', 'info'],
      'google-connected': ['Google Calendar conectado correctamente.', 'success'],
      'microsoft-connected': ['Outlook/Microsoft 365 conectado correctamente.', 'success'],
      cancelled: ['Conexión de calendario cancelada.', 'info'],
      error: ['No se pudo completar la conexión del calendario.', 'error']
    };
    if (calendarMessage && calendarMessages[calendarMessage]) {
      const [message, type] = calendarMessages[calendarMessage];
      showToast(message, type);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // Pedir permiso para notificaciones de recordatorio si está soportado
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

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
    document.getElementById('inviteBtn')?.addEventListener('click', () => openModal('inviteModal'));

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
      const details = document.getElementById('taskDetails')?.value.trim() || '';
      const dueValue = document.getElementById('taskDue')?.value || '';
      const priority = document.getElementById('taskPriority')?.value || '';
      if (!title || !details || !dueValue || !priority) {
        showToast('Completa todos los campos de la tarea antes de guardarla.', 'error');
        return;
      }

      setFormLoading(taskForm, true, 'Guardando...');
      try {
        const result = await requestJson('/api/business/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: details,
            priority,
            dueDate: dueValue ? new Date(dueValue).toISOString() : null
          })
        });
        taskForm.reset();
        closeModal(document.getElementById('taskModal'));
        await refreshWorkspace();
        const created = Object.entries(result.calendarSync || {}).filter(([, value]) => value === 'created').map(([provider]) => provider === 'google' ? 'Google Calendar' : 'Outlook');
        showToast(created.length ? `Tarea guardada y añadida a ${created.join(' y ')}.` : 'Tarea guardada en el espacio empresarial.', 'success');
      } catch (error) {
        showToast(error.message || 'No se pudo guardar la tarea.', 'error');
      } finally {
        setFormLoading(taskForm, false, 'Guardando...');
      }
    });

    const inviteForm = document.getElementById('inviteForm');
    inviteForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const name = document.getElementById('inviteName')?.value.trim() || '';
      const email = document.getElementById('inviteEmail')?.value.trim() || '';
      const roleSelect = document.getElementById('inviteRole');
      const role = roleSelect?.value || 'Miembro';
      const selectedOption = roleSelect?.options[roleSelect.selectedIndex];
      const permissions = selectedOption?.dataset.perm || 'editor';

      if (!email) {
        showToast('Indique el correo electrónico del colaborador.', 'error');
        return;
      }

      setFormLoading(inviteForm, true, 'Enviando invitación...');
      try {
        const result = await requestJson('/api/business/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, role, permissions })
        });
        inviteForm.reset();
        closeModal(document.getElementById('inviteModal'));
        await refreshWorkspace();
        showToast(result.message || 'Invitación registrada con éxito.', 'success');
      } catch (error) {
        showToast(error.message || 'No se pudo registrar la invitación.', 'error');
      } finally {
        setFormLoading(inviteForm, false, 'Enviar invitación');
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

    void setupCalendarFeed();
  });
})();
