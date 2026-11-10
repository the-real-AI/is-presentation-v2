/**
 * ============================================================================
 * КУРСОВОЙ / УЧЕБНЫЙ ПРОЕКТ: ОДНОСТРАНИЧНОЕ ВЕБ-ПРИЛОЖЕНИЕ (SPA)
 * СВЯЗКА NETLIFY ФРОНТЕНДА С GOOGLE FIREBASE FIRESTORE ЧЕРЕЗ X-API-KEY
 * ============================================================================
 */

// ============================================================================
// 1. КОНФИГУРАЦИЯ GOOGLE FIREBASE & X-API-KEY
// Укажите Project ID и Web API Key из настроек вашего проекта в Firebase Console
// ============================================================================
const DEFAULT_FIREBASE_PROJECT_ID = 'is-presentation-v2';
const DEFAULT_FIREBASE_API_KEY = 'YOUR_FIREBASE_API_KEY_HERE'; // Замените на Web API Key из Firebase
const DEFAULT_FIREBASE_COLLECTION = 'systems';

// Чтение сохранённых параметров из localStorage (чтобы можно было менять прямо из UI)
let FIREBASE_PROJECT_ID = localStorage.getItem('fb_project_id') || DEFAULT_FIREBASE_PROJECT_ID;
let FIREBASE_API_KEY = localStorage.getItem('fb_api_key') || DEFAULT_FIREBASE_API_KEY;
let FIREBASE_COLLECTION = localStorage.getItem('fb_collection') || DEFAULT_FIREBASE_COLLECTION;

// Вычисляемый базовый URL Google Firestore REST API
function getFirestoreUrl() {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${FIREBASE_COLLECTION}`;
}

// ============================================================================
// 2. ЭТАЛОННЫЕ ДАННЫЕ ДЛЯ FIREBASE (И OFFLINE ДЕМО-РЕЖИМА)
// ============================================================================
const INITIAL_SYSTEMS = [
  {
    code: "IS-CORE-BILLING",
    title: "Ядро биллинговой системы",
    architecture_type: "Microservices",
    sla_level: "99.99%",
    status: "Active",
    database_tech: "Google Cloud Firestore + Redis",
    description: "Обработка финансовых транзакций в реальном времени, event-driven шина сообщений, распределенный учет."
  },
  {
    code: "IS-ECOMMERCE-GW",
    title: "API Gateway E-Commerce",
    architecture_type: "API Gateway",
    sla_level: "99.95%",
    status: "Active",
    database_tech: "Firebase Realtime DB",
    description: "Входной шлюз для клиентского трафика: rate limiting, верификация JWT токенов и аудит безопасности."
  },
  {
    code: "IS-INVENTORY-SRV",
    title: "Управление складскими остатками",
    architecture_type: "Modular Monolith",
    sla_level: "99.9%",
    status: "Active",
    database_tech: "PostgreSQL (Cloud SQL)",
    description: "Инвентаризация и распределенный учет партий продукции на складах с использованием CQRS паттерна."
  },
  {
    code: "IS-ANALYTICS-DWH",
    title: "Корпоративное хранилище данных",
    architecture_type: "Lambda",
    sla_level: "99.5%",
    status: "Active",
    database_tech: "Google BigQuery + Firestore",
    description: "Хранилище аналитической отчётности, витрины данных, ETL-пайплайны и мониторинг метрик."
  },
  {
    code: "IS-CRM-CUSTOMER",
    title: "Управление отношениями с клиентами",
    architecture_type: "Microservices",
    sla_level: "99.9%",
    status: "Draft",
    database_tech: "Cloud Firestore NoSQL",
    description: "Омниканальная платформа взаимодействия с клиентами, единый профиль клиента 360."
  },
  {
    code: "IS-NOTIFICATION-BUS",
    title: "Шлюз рассылки уведомлений",
    architecture_type: "Event-Driven",
    sla_level: "99.95%",
    status: "Active",
    database_tech: "Google Pub/Sub + Redis",
    description: "Асинхронная доставка push-уведомлений, SMS и email по шаблонам событий."
  }
];

// ============================================================================
// 3. СОСТОЯНИЕ ПРИЛОЖЕНИЯ (APP STATE)
// ============================================================================
const AppState = {
  rawItems: [],
  filteredItems: [],
  viewMode: 'grid', // 'grid' | 'table'
  isLoading: false,
  isMock: false
};

// ============================================================================
// 4. ССЫЛКИ НА ЭЛЕМЕНТЫ DOM
// ============================================================================
const DOM = {
  // Экраны состояний
  stateLoading: document.getElementById('state-loading'),
  stateError: document.getElementById('state-error'),
  stateContent: document.getElementById('state-content'),

  // Ошибка
  errorTitle: document.getElementById('error-title'),
  errorDesc: document.getElementById('error-desc'),
  errorDetails: document.getElementById('error-details'),
  btnErrorRetry: document.getElementById('btn-error-retry'),
  btnUseMock: document.getElementById('btn-use-mock'),
  btnEditKeyFromError: document.getElementById('btn-edit-key-from-error'),

  // Вывод данных
  cardsView: document.getElementById('cards-view'),
  tableView: document.getElementById('table-view'),
  tableBody: document.getElementById('table-body'),
  emptyResults: document.getElementById('empty-results'),
  statsContainer: document.getElementById('stats-container'),

  // Метрики
  statTotal: document.getElementById('stat-total'),
  statMicro: document.getElementById('stat-micro'),
  statSla: document.getElementById('stat-sla'),

  // Статус бейдж
  statusIndicator: document.getElementById('api-status-indicator'),
  statusText: document.getElementById('status-text'),

  // Фильтры
  searchInput: document.getElementById('search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  filterArchitecture: document.getElementById('filter-architecture'),
  btnReload: document.getElementById('btn-reload'),
  btnResetFilters: document.getElementById('btn-reset-filters'),
  btnViewGrid: document.getElementById('btn-view-grid'),
  btnViewTable: document.getElementById('btn-view-table'),

  // Модалка настроек Firebase
  modalSettings: document.getElementById('modal-settings'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  formApiSettings: document.getElementById('form-api-settings'),
  cfgProjectId: document.getElementById('cfg-project-id'),
  cfgApiKey: document.getElementById('cfg-api-key'),
  cfgCollection: document.getElementById('cfg-collection'),
  btnSetInvalidKey: document.getElementById('btn-set-invalid-key'),
  btnSeedFirebase: document.getElementById('btn-seed-firebase'),

  // Модалка деталей
  modalDetails: document.getElementById('modal-details'),
  btnCloseDetails: document.getElementById('btn-close-details'),
  detailCode: document.getElementById('detail-code'),
  detailBody: document.getElementById('detail-body')
};

// ============================================================================
// 5. ПРЕОБРАЗОВАНИЕ ДОКУМЕНТОВ GOOGLE FIRESTORE В ОБЪЕКТЫ JS
// ============================================================================
function parseFirestoreDoc(doc) {
  const id = doc.name ? doc.name.split('/').pop() : 'doc_' + Math.random().toString(36).substring(2, 7);
  const fields = doc.fields || {};
  const item = { id };

  for (const [key, valueObj] of Object.entries(fields)) {
    if (valueObj.stringValue !== undefined) item[key] = valueObj.stringValue;
    else if (valueObj.integerValue !== undefined) item[key] = Number(valueObj.integerValue);
    else if (valueObj.doubleValue !== undefined) item[key] = Number(valueObj.doubleValue);
    else if (valueObj.booleanValue !== undefined) item[key] = valueObj.booleanValue;
    else item[key] = '';
  }

  return item;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'id') continue;
    fields[key] = { stringValue: String(val || '') };
  }
  return { fields };
}

// ============================================================================
// 6. ЗАПРОС К GOOGLE FIREBASE REST API С ЗАГОЛОВКОМ X-API-KEY
// ============================================================================
async function fetchFirebaseData() {
  setLoadingState(true);

  // Если ключ еще не задан пользователем — предлагаем демо-режим или ввод ключа
  if (FIREBASE_API_KEY === 'YOUR_FIREBASE_API_KEY_HERE') {
    setLoadingState(false);
    updateStatusBadge(false, 'Требуется Firebase Key');
    renderErrorUI(new Error('Firebase Web API Key не настроен. Нажмите «Сменить X-API-Key» для ввода ключа из Firebase Console или выберите «Демонстрационные данные».'));
    return;
  }

  const firestoreEndpoint = getFirestoreUrl();

  try {
    console.info(`[Firebase REST API] Запрос документов к Firestore: ${firestoreEndpoint}`);

    // Передаем авторизационный заголовок X-API-Key (и x-goog-api-key для сервисов Google Cloud)
    const headers = {
      'Accept': 'application/json',
      'X-API-Key': FIREBASE_API_KEY,
      'x-goog-api-key': FIREBASE_API_KEY
    };

    const response = await fetch(firestoreEndpoint, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      let errBody = {};
      try { errBody = await response.json(); } catch(e) {}

      if (response.status === 401 || response.status === 403) {
        throw new Error(`HTTP ${response.status} Unauthorized: Недействительный ключ X-API-Key для Google Firebase. ${errBody.error?.message || ''}`);
      } else if (response.status === 404) {
        throw new Error(`HTTP 404: Проект ${FIREBASE_PROJECT_ID} или база данных Firestore не найдены. Создайте базу Firestore в консоли Firebase.`);
      } else {
        throw new Error(`Google Cloud Error (${response.status}): ${errBody.error?.message || response.statusText}`);
      }
    }

    const json = await response.json();
    const documents = json.documents || [];

    if (documents.length === 0) {
      // Коллекция существует, но пустая — предложим наполнить тестовыми записями
      console.warn('[Firebase] Коллекция пуста.');
      AppState.rawItems = [...INITIAL_SYSTEMS];
      AppState.isMock = true;
      updateStatusBadge(true, 'Firebase (Пустая коллекция / Demo)');
    } else {
      AppState.rawItems = documents.map(parseFirestoreDoc);
      AppState.isMock = false;
      updateStatusBadge(true, 'Google Firebase Online (200 OK)');
    }

    renderSuccessUI();

  } catch (error) {
    console.error('[Firebase Fetch Error]', error);
    updateStatusBadge(false, 'Firebase Error');
    renderErrorUI(error);
  } finally {
    setLoadingState(false);
  }
}

// ============================================================================
// 7. НАПОЛНЕНИЕ БАЗЫ ДАННЫХ FIREBASE (SEED FIRESTORE)
// ============================================================================
async function seedFirebaseDatabase() {
  if (FIREBASE_API_KEY === 'YOUR_FIREBASE_API_KEY_HERE') {
    alert('Пожалуйста, сначала укажите валидный Web API Key и Project ID от вашего Firebase!');
    return;
  }

  const endpoint = getFirestoreUrl();
  const btn = DOM.btnSeedFirebase;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Запись в Firebase...';

  try {
    let createdCount = 0;
    for (const item of INITIAL_SYSTEMS) {
      const docPayload = toFirestoreFields(item);
      const res = await fetch(`${endpoint}?documentId=${encodeURIComponent(item.code)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': FIREBASE_API_KEY,
          'x-goog-api-key': FIREBASE_API_KEY
        },
        body: JSON.stringify(docPayload)
      });
      if (res.ok) createdCount++;
    }

    alert(`Успешно создано ${createdCount} записей в вашей базе данных Google Firebase Firestore!`);
    DOM.modalSettings.classList.remove('active');
    fetchFirebaseData();
  } catch (err) {
    alert('Ошибка при записи в Firebase: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Заполнить Firebase';
  }
}

// ============================================================================
// 8. УПРАВЛЕНИЕ UI СОСТОЯНИЯМИ
// ============================================================================
function setLoadingState(loading) {
  AppState.isLoading = loading;
  if (loading) {
    DOM.stateLoading.style.display = 'block';
    DOM.stateError.style.display = 'none';
    DOM.stateContent.style.display = 'none';
    DOM.btnReload.querySelector('i').classList.add('fa-spin');
  } else {
    DOM.stateLoading.style.display = 'none';
    DOM.btnReload.querySelector('i').classList.remove('fa-spin');
  }
}

function renderErrorUI(error) {
  DOM.stateError.style.display = 'block';
  DOM.stateContent.style.display = 'none';

  DOM.errorTitle.textContent = 'Ошибка подключения к базе данных Google Firebase';
  DOM.errorDesc.textContent = error.message || 'Проверьте настройки проекта и правильность X-API-Key.';
  DOM.errorDetails.textContent = `Эндпоинт Firestore: ${getFirestoreUrl()}\nЗаголовок: X-API-Key: ${FIREBASE_API_KEY}\nProject ID: ${FIREBASE_PROJECT_ID}`;
}

function renderSuccessUI() {
  DOM.stateError.style.display = 'none';
  DOM.stateContent.style.display = 'block';
  DOM.statsContainer.style.display = 'grid';

  updateStats();
  applyFiltersAndRender();
}

function updateStatusBadge(online, text) {
  DOM.statusIndicator.className = 'api-status-badge ' + (online ? 'online' : 'offline');
  DOM.statusText.textContent = text;
}

// ============================================================================
// 9. ФИЛЬТРАЦИЯ И РЕНДЕРИНГ КАРТОЧЕК
// ============================================================================
function applyFiltersAndRender() {
  const query = (DOM.searchInput.value || '').trim().toLowerCase();
  const archFilter = DOM.filterArchitecture.value;

  AppState.filteredItems = AppState.rawItems.filter(item => {
    const code = (item.code || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const db = (item.database_tech || '').toLowerCase();
    const arch = item.architecture_type || '';

    const matchSearch = !query || code.includes(query) || title.includes(query) || desc.includes(query) || db.includes(query);
    const matchArch = !archFilter || arch.includes(archFilter);

    return matchSearch && matchArch;
  });

  if (AppState.filteredItems.length === 0) {
    DOM.cardsView.style.display = 'none';
    DOM.tableView.style.display = 'none';
    DOM.emptyResults.style.display = 'block';
    return;
  }

  DOM.emptyResults.style.display = 'none';

  if (AppState.viewMode === 'grid') {
    DOM.cardsView.style.display = 'grid';
    DOM.tableView.style.display = 'none';
    renderCards(AppState.filteredItems);
  } else {
    DOM.cardsView.style.display = 'none';
    DOM.tableView.style.display = 'block';
    renderTable(AppState.filteredItems);
  }
}

function renderCards(items) {
  DOM.cardsView.innerHTML = items.map((item, index) => {
    const isDraft = item.status === 'Draft';
    const slaColor = (item.sla_level || '').includes('99.99') ? 'text-green' : 'text-cyan';

    return `
      <article class="system-card" style="animation-delay: ${index * 0.05}s">
        <div>
          <div class="card-top">
            <span class="code-badge">${escapeHtml(item.code || 'SYS')}</span>
            <span class="status-badge ${isDraft ? 'draft' : 'active'}">
              <i class="fa-solid fa-circle" style="font-size: 0.5rem"></i>
              ${escapeHtml(item.status || 'Active')}
            </span>
          </div>

          <h3 class="card-title">${escapeHtml(item.title || 'Информационная система')}</h3>
          <p class="card-desc">${escapeHtml(item.description || 'Архитектурный компонент проектируемой системы.')}</p>
        </div>

        <div>
          <div class="card-meta-list">
            <div class="card-meta-item">
              <span class="meta-key"><i class="fa-solid fa-layer-group"></i> Архитектура:</span>
              <span class="meta-val">${escapeHtml(item.architecture_type || 'Microservices')}</span>
            </div>
            <div class="card-meta-item">
              <span class="meta-key"><i class="fa-solid fa-shield-heart"></i> Уровень SLA:</span>
              <span class="meta-val font-mono ${slaColor}">${escapeHtml(item.sla_level || '99.9%')}</span>
            </div>
            <div class="card-meta-item">
              <span class="meta-key"><i class="fa-solid fa-fire text-amber"></i> База данных:</span>
              <span class="meta-val font-mono">${escapeHtml(item.database_tech || 'Cloud Firestore')}</span>
            </div>
          </div>

          <div class="card-footer">
            <button class="btn btn-outline btn-sm" onclick="showSystemDetails('${item.id || item.code}')">
              <i class="fa-solid fa-circle-info"></i> Подробнее
            </button>
            <button class="btn btn-secondary btn-sm" onclick="copySystemCode('${item.code}')" title="Скопировать код">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderTable(items) {
  DOM.tableBody.innerHTML = items.map(item => `
    <tr>
      <td><span class="code-badge">${escapeHtml(item.code || '')}</span></td>
      <td><strong>${escapeHtml(item.title || '')}</strong></td>
      <td><i class="fa-solid fa-layer-group text-cyan"></i> ${escapeHtml(item.architecture_type || '')}</td>
      <td><span class="font-mono text-green">${escapeHtml(item.sla_level || '')}</span></td>
      <td><span class="font-mono">${escapeHtml(item.database_tech || 'Firestore')}</span></td>
      <td>
        <span class="status-badge ${item.status === 'Draft' ? 'draft' : 'active'}">
          ${escapeHtml(item.status || 'Active')}
        </span>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="showSystemDetails('${item.id || item.code}')">Инфо</button>
      </td>
    </tr>
  `).join('');
}

function updateStats() {
  const total = AppState.rawItems.length;
  const micro = AppState.rawItems.filter(i => (i.architecture_type || '').includes('Microservices')).length;

  DOM.statTotal.textContent = total;
  DOM.statMicro.textContent = micro;
}

window.showSystemDetails = function(idOrCode) {
  const item = AppState.rawItems.find(i => i.id === idOrCode || i.code === idOrCode);
  if (!item) return;

  DOM.detailCode.textContent = item.code || 'Детали системы';
  DOM.detailBody.innerHTML = `
    <h3 style="font-size:1.25rem; font-weight:800; color:#fff; margin-bottom:12px;">${escapeHtml(item.title)}</h3>
    <p style="color:var(--text-muted); font-size:0.92rem; line-height:1.6; margin-bottom:18px;">${escapeHtml(item.description)}</p>

    <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:12px; padding:16px; margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem;">
        <span style="color:var(--text-dim)">Архитектурный стиль:</span>
        <strong style="color:var(--accent-cyan)">${escapeHtml(item.architecture_type)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem;">
        <span style="color:var(--text-dim)">Доступность (SLA):</span>
        <strong style="color:var(--accent-green); font-family:var(--font-mono)">${escapeHtml(item.sla_level)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem;">
        <span style="color:var(--text-dim)">СУБД / Хранилище:</span>
        <strong style="color:#fff; font-family:var(--font-mono)">${escapeHtml(item.database_tech)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
        <span style="color:var(--text-dim)">Статус:</span>
        <strong style="color:${item.status === 'Active' ? '#34d399' : '#fbbf24'}">${escapeHtml(item.status)}</strong>
      </div>
    </div>

    <div style="text-align:right;">
      <button class="btn btn-secondary" onclick="DOM.modalDetails.classList.remove('active')">Закрыть</button>
    </div>
  `;

  DOM.modalDetails.classList.add('active');
};

window.copySystemCode = function(code) {
  navigator.clipboard.writeText(code).then(() => {
    alert(`Идентификатор «${code}» скопирован в буфер обмена!`);
  });
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// 10. ОБРАБОТЧИКИ СОБЫТИЙ И НАСТРОЙКИ
// ============================================================================
function initEventHandlers() {
  DOM.searchInput.addEventListener('input', () => {
    DOM.btnClearSearch.style.display = DOM.searchInput.value ? 'block' : 'none';
    applyFiltersAndRender();
  });

  DOM.btnClearSearch.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.btnClearSearch.style.display = 'none';
    applyFiltersAndRender();
  });

  DOM.filterArchitecture.addEventListener('change', applyFiltersAndRender);

  DOM.btnResetFilters.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.filterArchitecture.value = '';
    DOM.btnClearSearch.style.display = 'none';
    applyFiltersAndRender();
  });

  DOM.btnViewGrid.addEventListener('click', () => {
    AppState.viewMode = 'grid';
    DOM.btnViewGrid.classList.add('active');
    DOM.btnViewTable.classList.remove('active');
    applyFiltersAndRender();
  });

  DOM.btnViewTable.addEventListener('click', () => {
    AppState.viewMode = 'table';
    DOM.btnViewTable.classList.add('active');
    DOM.btnViewGrid.classList.remove('active');
    applyFiltersAndRender();
  });

  DOM.btnReload.addEventListener('click', fetchFirebaseData);
  DOM.btnErrorRetry.addEventListener('click', fetchFirebaseData);

  // Демонстрационный режим
  DOM.btnUseMock.addEventListener('click', () => {
    AppState.rawItems = [...INITIAL_SYSTEMS];
    AppState.isMock = true;
    updateStatusBadge(true, 'Demo Mode (Mock Firestore)');
    renderSuccessUI();
  });

  // Модалка настроек Firebase
  DOM.btnOpenSettings.addEventListener('click', () => {
    DOM.cfgProjectId.value = FIREBASE_PROJECT_ID;
    DOM.cfgApiKey.value = FIREBASE_API_KEY;
    DOM.cfgCollection.value = FIREBASE_COLLECTION;
    DOM.modalSettings.classList.add('active');
  });

  DOM.btnEditKeyFromError.addEventListener('click', () => {
    DOM.cfgProjectId.value = FIREBASE_PROJECT_ID;
    DOM.cfgApiKey.value = FIREBASE_API_KEY;
    DOM.cfgCollection.value = FIREBASE_COLLECTION;
    DOM.modalSettings.classList.add('active');
  });

  DOM.btnCloseSettings.addEventListener('click', () => DOM.modalSettings.classList.remove('active'));
  DOM.btnCloseDetails.addEventListener('click', () => DOM.modalDetails.classList.remove('active'));

  [DOM.modalSettings, DOM.modalDetails].forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
  });

  DOM.btnSetInvalidKey.addEventListener('click', () => {
    DOM.cfgApiKey.value = 'invalid_firebase_key_401';
  });

  DOM.btnSeedFirebase.addEventListener('click', seedFirebaseDatabase);

  // Сохранение настроек
  DOM.formApiSettings.addEventListener('submit', (e) => {
    e.preventDefault();
    FIREBASE_PROJECT_ID = DOM.cfgProjectId.value.trim();
    FIREBASE_API_KEY = DOM.cfgApiKey.value.trim();
    FIREBASE_COLLECTION = DOM.cfgCollection.value.trim() || 'systems';

    localStorage.setItem('fb_project_id', FIREBASE_PROJECT_ID);
    localStorage.setItem('fb_api_key', FIREBASE_API_KEY);
    localStorage.setItem('fb_collection', FIREBASE_COLLECTION);

    DOM.modalSettings.classList.remove('active');
    fetchFirebaseData();
  });
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  initEventHandlers();
  fetchFirebaseData();
});
