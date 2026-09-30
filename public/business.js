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
