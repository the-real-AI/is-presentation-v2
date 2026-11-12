/**
 * UploadModule — клиентский модуль загрузки и конвертации презентаций
 * Поддерживает: .pptx, .pdf
 * Использует: Gemini File API + Gemini 2.0 Flash
 */

const UploadModule = (() => {
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint'
  ];
  const ALLOWED_EXTS = ['.pdf', '.pptx', '.ppt'];
  const MAX_SIZE_MB = 50;

  // DOM References (ленивая инициализация)
  let dropzone, fileInput, statusEl, statusText, progressFill;

  function getDOMRefs() {
    dropzone = document.getElementById('upload-dropzone');
    fileInput = document.getElementById('file-input');
    statusEl = document.getElementById('upload-status');
    statusText = document.getElementById('upload-status-text');
    progressFill = document.getElementById('upload-progress-fill');
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  function init() {
    getDOMRefs();
    if (!dropzone || !fileInput) return;

    // Drag & Drop events
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });

    // Click to pick file
    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('.btn-upload-select')) return; // button handles its own click
      fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) handleFile(file);
      fileInput.value = ''; // reset so same file can be re-picked
    });
  }

  // ─── File Validation & Pipeline ─────────────────────────────────────────────

  function handleFile(file) {
    // Validate extension
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      showError(`❌ Неподдерживаемый формат: ${ext}. Загрузите .pptx или .pdf`);
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showError(`❌ Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум ${MAX_SIZE_MB} МБ`);
      return;
    }

    // Start pipeline
    runPipeline(file);
  }

  async function runPipeline(file) {
    try {
      showStatus(`⬆️ Загрузка файла «${file.name}»...`, 15);

      // Step 1: Upload to Gemini File API
      const { fileUri, mimeType } = await uploadToGemini(file);
      showStatus('🔄 Файл загружен. Запуск AI конвертации...', 40);

      // Step 2: Convert with Gemini
      const { slides } = await convertWithGemini(fileUri, mimeType, file.name);
      showStatus(`✅ Конвертация завершена! Найдено слайдов: ${slides.length}`, 90);

      // Step 3: Render slides
      await delay(600);
      renderSlides(slides, file.name);

    } catch (err) {
      showError(`❌ Ошибка: ${err.message || 'Неизвестная ошибка'}`);
      console.error('Upload pipeline error:', err);
    }
  }

  // ─── Upload ──────────────────────────────────────────────────────────────────

  async function uploadToGemini(file) {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const res = await fetch('/api/gemini/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || err.details || `Ошибка загрузки: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.fileUri) throw new Error('Сервер не вернул fileUri');
    return data;
  }

  // ─── Convert ─────────────────────────────────────────────────────────────────

  async function convertWithGemini(fileUri, mimeType, fileName) {
    const res = await fetch('/api/gemini/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUri, mimeType, fileName })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || err.details || `Ошибка конвертации: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.slides || !Array.isArray(data.slides) || data.slides.length === 0) {
      throw new Error('Gemini не вернул слайды. Попробуйте другой файл.');
    }

    return data;
  }

  // ─── Render Slides ───────────────────────────────────────────────────────────

  function renderSlides(slides, fileName) {
    const container = document.getElementById('presentation-container');
    if (!container) {
      showError('❌ Элемент #presentation-container не найден');
      return;
    }

    // Очищаем существующие слайды
    const existingSlides = container.querySelectorAll('.slide');
    existingSlides.forEach(s => s.remove());

    // Создаём новые слайды
    slides.forEach((slide, idx) => {
      const isFirst = idx === 0;
      const section = document.createElement('section');
      section.className = `slide${isFirst ? ' active' : ''}`;
      section.setAttribute('data-slide', slide.slideNumber);
      section.setAttribute('data-topic', slide.title || `Слайд ${slide.slideNumber}`);
      section.setAttribute('data-layout', slide.layout || 'content');

      const layoutClass = getLayoutClass(slide.layout);

      section.innerHTML = `
        <div class="slide-inner ${layoutClass}">
          <div class="slide-header-block">
            <div class="slide-num-badge">
              <span class="slide-num-label">СЛАЙД</span>
              <span class="slide-num-val">${String(slide.slideNumber).padStart(2, '0')}</span>
            </div>
            <h1 class="slide-title-main">${escapeHtml(slide.title)}</h1>
          </div>
          <div class="slide-body-content">
            ${slide.content || '<p class="text-muted">Содержимое не извлечено</p>'}
          </div>
          ${slide.speakerNotes ? `
          <div class="slide-speaker-notes">
            <i class="fa-solid fa-microphone-lines"></i>
            <span>${escapeHtml(slide.speakerNotes)}</span>
          </div>` : ''}
        </div>
      `;

      container.appendChild(section);
    });

    const totalSlides = slides.length;

    // Обновляем counter-total
    document.querySelectorAll('.counter-total').forEach(el => {
      el.textContent = String(totalSlides).padStart(2, '0');
    });

    // Reinit presentation engine
    if (typeof Presentation !== 'undefined' && Presentation.reinit) {
      Presentation.reinit(totalSlides);
    }

    // Обновляем dock dots если доступно
    if (typeof Presentation !== 'undefined' && Presentation.reinitDockDots) {
      Presentation.reinitDockDots(totalSlides);
    }

    // Скрываем статус
    if (statusEl) statusEl.style.display = 'none';

    // Переключаемся на вкладку презентации
    if (typeof SpaRouter !== 'undefined') {
      SpaRouter.navigate('presentation');
    }

    console.log(`✅ UploadModule: загружено ${totalSlides} слайдов из «${fileName}»`);
  }

  // ─── UI Helpers ──────────────────────────────────────────────────────────────

  function showStatus(message, progressPct = 0) {
    getDOMRefs();
    if (dropzone) dropzone.style.display = 'none';
    if (statusEl) statusEl.style.display = 'block';
    if (statusText) statusText.textContent = message;
    if (progressFill) {
      progressFill.style.width = `${progressPct}%`;
      progressFill.style.transition = 'width 0.5s ease';
    }
  }

  function showError(message) {
    getDOMRefs();
    if (dropzone) dropzone.style.display = 'flex';
    if (statusEl) statusEl.style.display = 'none';

    // Показываем ошибку в dropzone
    const existing = document.querySelector('.upload-error-msg');
    if (existing) existing.remove();

    const errEl = document.createElement('div');
    errEl.className = 'upload-error-msg';
    errEl.textContent = message;
    if (dropzone) dropzone.appendChild(errEl);

    // Автоудаление через 6 секунд
    setTimeout(() => errEl.remove(), 6000);
  }

  function resetUI() {
    getDOMRefs();
    if (dropzone) {
      dropzone.style.display = 'flex';
      dropzone.classList.remove('drag-over');
    }
    if (statusEl) statusEl.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    if (statusText) statusText.textContent = '';
  }

  function getLayoutClass(layout) {
    const map = {
      'title': 'layout-title',
      'content': 'layout-content',
      'two-column': 'layout-two-column',
      'table': 'layout-table',
      'diagram': 'layout-diagram'
    };
    return map[layout] || 'layout-content';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  return {
    init,
    handleFile,
    uploadToGemini,
    convertWithGemini,
    renderSlides,
    resetUI
  };
})();
