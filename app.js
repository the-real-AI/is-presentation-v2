/**
 * ============================================================================
 * КУРСОВОЙ / УЧЕБНЫЙ ПРОЕКТ: ОДНОСТРАНИЧНОЕ ВЕБ-ПРИЛОЖЕНИЕ (SPA)
 * СВЯЗКА С БАЗОЙ ДАННЫХ ЧЕРЕЗ REST API С АВТОРИЗАЦИЕЙ X-API-KEY
 * ============================================================================
 */

// ============================================================================
// 1. КОНФИГУРАЦИЯ API И КЛЮЧА ДОСТУПА
// Измените эти константы на адрес вашего сервера и персональный ключ:
// ============================================================================
const DEFAULT_API_URL = 'http://localhost:3000/api/v1/systems';
const DEFAULT_API_KEY = 'xak_live_master_9948201'; // Замените на ваш 'YOUR_API_KEY_HERE'

// Поддержка сохранения переопределений из модального окна настроек (localStorage)
let API_URL = localStorage.getItem('is_project_api_url') || DEFAULT_API_URL;
let API_KEY = localStorage.getItem('is_project_api_key') || DEFAULT_API_KEY;

// ============================================================================
// 2. ДЕМОНСТРАЦИОННЫЙ НАБОР ДАННЫХ (OFFLINE MOCK ДЛЯ СТАТИЧЕСКОГО NETLIFY)
// Используется для мгновенной демонстрации, если внешний бэкенд не запущен
// ============================================================================
const MOCK_SYSTEMS_DB = [
  {
    id: "sys_01",
    code: "IS-CORE-BILLING",
    title: "Ядро биллинговой системы",
    architecture_type: "Microservices",
    sla_level: "99.99%",
    status: "Active",
    database_tech: "PostgreSQL + Redis",
    description: "Процессинг транзакций в реальном времени, event-driven шина на Kafka, распределенные блокировки."
  },
  {
    id: "sys_02",
    code: "IS-ECOMMERCE-GW",
    title: "API Gateway E-Commerce",
    architecture_type: "API Gateway",
    sla_level: "99.95%",
    status: "Active",
    database_tech: "Redis Cluster",
    description: "Входной шлюз для клиентского трафика: rate-limiting, JWT валидация и SSL терминирование."
  },
  {
    id: "sys_03",
    code: "IS-INVENTORY-SRV",
    title: "Управление складскими остатками",
    architecture_type: "Modular Monolith",
    sla_level: "99.9%",
    status: "Active",
    database_tech: "PostgreSQL",
    description: "Учёт партий товаров, синхронизация остатков между складами с использованием CQRS паттерна."
  },
  {
    id: "sys_04",
    code: "IS-ANALYTICS-DWH",
    title: "Корпоративное хранилище данных",
    architecture_type: "Lambda",
    sla_level: "99.5%",
    status: "Active",
    database_tech: "ClickHouse + MinIO",
    description: "Аналитическое хранилище больших объёмов данных, витрины отчётности и ETL-пайплайны."
  },
  {
    id: "sys_05",
    code: "IS-CRM-CUSTOMER",
    title: "Управление отношениями с клиентами",
    architecture_type: "Microservices",
    sla_level: "99.9%",
    status: "Draft",
    database_tech: "MongoDB + Elastic",
    description: "Омниканальная платформа поддержки клиентов, единый профиль клиента 360 и полнотекстовый поиск."
  },
  {
    id: "sys_06",
    code: "IS-NOTIFICATION-BUS",
    title: "Шлюз рассылки уведомлений",
    architecture_type: "Event-Driven",
    sla_level: "99.95%",
    status: "Active",
    database_tech: "RabbitMQ + Redis",
    description: "Асинхронная доставка push-уведомлений, SMS и электронных писем по шаблонам."
  }
];

// ============================================================================
// 3. ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ============================================================================
const AppState = {
  rawItems: [],       // Сырые данные из БД
  filteredItems: [],   // Отфильтрованные данные
  viewMode: 'grid',    // 'grid' или 'table'
  isLoading: false,
  lastError: null,
  isMockData: false
};

// ============================================================================
// 4. DOM ЭЛЕМЕНТЫ
// ============================================================================
const DOM = {
  // Состояния
  stateLoading: document.getElementById('state-loading'),
  stateError: document.getElementById('state-error'),
  stateContent: document.getElementById('state-content'),
  
  // Контейнеры вывода
  cardsView: document.getElementById('cards-view'),
  tableView: document.getElementById('table-view'),
  tableBody: document.getElementById('table-body'),
  emptyResults: document.getElementById('empty-results'),
  statsContainer: document.getElementById('stats-container'),
  
  // Элементы ошибки
  errorTitle: document.getElementById('error-title'),
  errorDesc: document.getElementById('error-desc'),
  errorDetails: document.getElementById('error-details'),
  btnErrorRetry: document.getElementById('btn-error-retry'),
  btnUseMock: document.getElementById('btn-use-mock'),
  btnEditKeyFromError: document.getElementById('btn-edit-key-from-error'),
  
  // Индикатор статуса
  statusIndicator: document.getElementById('api-status-indicator'),
  statusText: document.getElementById('status-text'),
  
  // Статистика
  statTotal: document.getElementById('stat-total'),
  statMicro: document.getElementById('stat-micro'),
  statSla: document.getElementById('stat-sla'),
  
  // Фильтры и поиск
  searchInput: document.getElementById('search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  filterArchitecture: document.getElementById('filter-architecture'),
  btnReload: document.getElementById('btn-reload'),
  btnResetFilters: document.getElementById('btn-reset-filters'),
  btnViewGrid: document.getElementById('btn-view-grid'),
  btnViewTable: document.getElementById('btn-view-table'),
  
  // Модальные окна
  modalSettings: document.getElementById('modal-settings'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  formApiSettings: document.getElementById('form-api-settings'),
  cfgApiUrl: document.getElementById('cfg-api-url'),
  cfgApiKey: document.getElementById('cfg-api-key'),
  btnSetInvalidKey: document.getElementById('btn-set-invalid-key'),
  btnRestoreDefaults: document.getElementById('btn-restore-defaults'),
  
  modalDetails: document.getElementById('modal-details'),
  btnCloseDetails: document.getElementById('btn-close-details'),
  detailCode: document.getElementById('detail-code'),
  detailBody: document.getElementById('detail-body')
};

// ============================================================================
// 5. ОСНОВНАЯ ФУНКЦИЯ ЗАПРОСА К API (FETCH С ЗАГОЛОВКОМ X-API-KEY)
// ============================================================================
/**
 * Выполняет асинхронный HTTP GET-запрос к API базы данных с передачей токена авторизации.
 * Включает строгую проверку HTTP-кодов (200, 401, 403, 500) и try/catch.
 */
async function fetchSystemsData() {
  setLoadingState(true);
  AppState.lastError = null;

  try {
    // Формируем заголовки запроса согласно требованиям: передаем 'X-API-Key'
    const headers = {
      'Accept': 'application/json',
      'X-API-Key': API_KEY
    };

    console.info(`[API Request] Отправка запроса на ${API_URL}`);
    console.info(`[Auth Header] X-API-Key: ${API_KEY ? `${API_KEY.substring(0, 8)}...` : 'ОТСУТСТВУЕТ'}`);

    const response = await fetch(API_URL, {
      method: 'GET',
      headers: headers
    });

    // Обработка статус-кодов сервера
    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch (e) {
        errorBody = { message: response.statusText };
      }

      if (response.status === 401) {
        throw new Error(`401 Unauthorized: Неверный или отсутствующий ключ X-API-Key. ${errorBody.message || ''}`);
      } else if (response.status === 403) {
        throw new Error(`403 Forbidden: Доступ запрещён для данного API-ключа. ${errorBody.message || ''}`);
      } else if (response.status === 404) {
        throw new Error(`404 Not Found: Эндпоинт ${API_URL} не найден.`);
      } else {
        throw new Error(`HTTP ${response.status}: ${errorBody.message || 'Ошибка сервера базы данных'}`);
      }
    }

    // Успешный ответ: парсим JSON
    const result = await response.json();
    const data = Array.isArray(result) ? result : (result.data || []);

    AppState.rawItems = data;
    AppState.isMockData = false;
    updateStatusBadge(true, 'API Connected (200 OK)');
    renderSuccessUI();

  } catch (error) {
    console.error('[API Error]', error);
    AppState.lastError = error;
    updateStatusBadge(false, 'API Error / Offline');
    renderErrorUI(error);
  } finally {
    setLoadingState(false);
  }
}

// ============================================================================
// 6. УПРАВЛЕНИЕ СОСТОЯНИЯМИ UI (LOADING, ERROR, CONTENT)
// ============================================================================
function setLoadingState(isLoading) {
  AppState.isLoading = isLoading;
  if (isLoading) {
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

  const is401 = error.message.includes('401');
  const isFailedFetch = error.message.includes('Failed to fetch') || error.name === 'TypeError';

  if (is401) {
    DOM.errorTitle.textContent = 'Ошибка 401: Недействительный X-API-Key';
    DOM.errorDesc.textContent = 'Сервер базы данных отклонил запрос из-за отсутствия или невалидности авторизационного заголовка X-API-Key.';
  } else if (isFailedFetch) {
    DOM.errorTitle.textContent = 'Сервер API недоступен (Offline)';
    DOM.errorDesc.textContent = `Не удалось установить соединение с сервером по адресу ${API_URL}. Запустите локальный бэкенд (npm start) или включите демонстрационный режим.`;
  } else {
    DOM.errorTitle.textContent = 'Ошибка получения данных из БД';
    DOM.errorDesc.textContent = error.message || 'Произошла непредвиденная ошибка при обработке ответа.';
  }

  DOM.errorDetails.textContent = `Запрос: GET ${API_URL}\nЗаголовок: X-API-Key: ${API_KEY}\nПодробности: ${error.stack || error.message}`;
}

function renderSuccessUI() {
  DOM.stateError.style.display = 'none';
  DOM.stateContent.style.display = 'block';
  DOM.statsContainer.style.display = 'grid';

  updateStats();
  applyFiltersAndRender();
}

function updateStatusBadge(isOnline, text) {
  DOM.statusIndicator.className = 'api-status-badge ' + (isOnline ? 'online' : 'offline');
  DOM.statusText.textContent = text;
}

// ============================================================================
// 7. ФИЛЬТРАЦИЯ И РЕНДЕРИНГ ДАННЫХ
// ============================================================================
function applyFiltersAndRender() {
  const query = (DOM.searchInput.value || '').trim().toLowerCase();
  const archFilter = DOM.filterArchitecture.value;

  // Фильтрация
  AppState.filteredItems = AppState.rawItems.filter(item => {
    const code = (item.code || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const db = (item.database_tech || '').toLowerCase();
    const arch = item.architecture_type || '';

    const matchesSearch = !query || code.includes(query) || title.includes(query) || desc.includes(query) || db.includes(query);
    const matchesArch = !archFilter || arch.includes(archFilter);

    return matchesSearch && matchesArch;
  });

  // Переключение состояния отсутствия результатов
  if (AppState.filteredItems.length === 0) {
    DOM.cardsView.style.display = 'none';
    DOM.tableView.style.display = 'none';
    DOM.emptyResults.style.display = 'block';
    return;
  }

  DOM.emptyResults.style.display = 'none';

  // Рендеринг в зависимости от выбранного вида (Сетка / Таблица)
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

/**
 * Рендерит данные в виде адаптивной сетки карточек
 */
function renderCards(items) {
  DOM.cardsView.innerHTML = items.map((item, index) => {
    const isDraft = item.status === 'Draft';
    const slaColor = item.sla_level?.includes('99.99') ? 'text-green' : 'text-cyan';

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
          <p class="card-desc">${escapeHtml(item.description || 'Архитектурное решение в рамках проектирования ИС.')}</p>
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
              <span class="meta-key"><i class="fa-solid fa-database"></i> База данных:</span>
              <span class="meta-val font-mono">${escapeHtml(item.database_tech || 'PostgreSQL')}</span>
            </div>
          </div>

          <div class="card-footer">
            <button class="btn btn-outline btn-sm" onclick="showSystemDetails('${item.id}')">
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

/**
 * Рендерит данные в виде адаптивной таблицы
 */
function renderTable(items) {
  DOM.tableBody.innerHTML = items.map(item => `
    <tr>
      <td><span class="code-badge">${escapeHtml(item.code || '')}</span></td>
      <td><strong>${escapeHtml(item.title || '')}</strong></td>
      <td><i class="fa-solid fa-layer-group text-cyan"></i> ${escapeHtml(item.architecture_type || '')}</td>
      <td><span class="font-mono text-green">${escapeHtml(item.sla_level || '')}</span></td>
      <td><span class="font-mono">${escapeHtml(item.database_tech || '')}</span></td>
      <td>
        <span class="status-badge ${item.status === 'Draft' ? 'draft' : 'active'}">
          ${escapeHtml(item.status || 'Active')}
        </span>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="showSystemDetails('${item.id}')">
          Инфо
        </button>
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

// ============================================================================
// 8. ДЕТАЛЬНЫЙ ПРОСМОТР И ДЕЙСТВИЯ С КАРТОЧКАМИ
// ============================================================================
window.showSystemDetails = function(id) {
  const item = AppState.rawItems.find(i => i.id === id);
  if (!item) return;

  DOM.detailCode.textContent = item.code || 'Детали системы';
  DOM.detailBody.innerHTML = `
    <h3 style="font-size:1.25rem; font-weight:800; color:#fff; margin-bottom:12px;">${escapeHtml(item.title)}</h3>
    <p style="color:var(--text-muted); font-size:0.92rem; line-height:1.6; margin-bottom:18px;">${escapeHtml(item.description)}</p>

    <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:12px; padding:16px; margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem;">
        <span style="color:var(--text-dim)">Архитектурный шаблон:</span>
        <strong style="color:var(--accent-cyan)">${escapeHtml(item.architecture_type)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem;">
        <span style="color:var(--text-dim)">Целевой показатель доступности (SLA):</span>
        <strong style="color:var(--accent-green); font-family:var(--font-mono)">${escapeHtml(item.sla_level)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem;">
        <span style="color:var(--text-dim)">Стек базы данных:</span>
        <strong style="color:#fff; font-family:var(--font-mono)">${escapeHtml(item.database_tech)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
        <span style="color:var(--text-dim)">Статус жизненного цикла:</span>
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
    alert(`Код системы «${code}» скопирован в буфер обмена!`);
  });
};

// ============================================================================
// 9. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initEventHandlers() {
  // Поиск
  DOM.searchInput.addEventListener('input', () => {
    DOM.btnClearSearch.style.display = DOM.searchInput.value ? 'block' : 'none';
    applyFiltersAndRender();
  });

  DOM.btnClearSearch.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.btnClearSearch.style.display = 'none';
    applyFiltersAndRender();
  });

  // Фильтр архитектуры
  DOM.filterArchitecture.addEventListener('change', applyFiltersAndRender);

  // Сброс фильтров
  DOM.btnResetFilters.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.filterArchitecture.value = '';
    DOM.btnClearSearch.style.display = 'none';
    applyFiltersAndRender();
  });

  // Переключение вида (Сетка / Таблица)
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

  // Кнопка перезагрузки данных
  DOM.btnReload.addEventListener('click', fetchSystemsData);
  DOM.btnErrorRetry.addEventListener('click', fetchSystemsData);

  // Демонстрационный режим (Offline Mock)
  DOM.btnUseMock.addEventListener('click', () => {
    AppState.rawItems = [...MOCK_SYSTEMS_DB];
    AppState.isMockData = true;
    updateStatusBadge(true, 'Demo Mode (Mock DB)');
    renderSuccessUI();
  });

  // Модальное окно настроек
  DOM.btnOpenSettings.addEventListener('click', () => {
    DOM.cfgApiUrl.value = API_URL;
    DOM.cfgApiKey.value = API_KEY;
    DOM.modalSettings.classList.add('active');
  });

  DOM.btnEditKeyFromError.addEventListener('click', () => {
    DOM.cfgApiUrl.value = API_URL;
    DOM.cfgApiKey.value = API_KEY;
    DOM.modalSettings.classList.add('active');
  });

  DOM.btnCloseSettings.addEventListener('click', () => {
    DOM.modalSettings.classList.remove('active');
  });

  DOM.btnCloseDetails.addEventListener('click', () => {
    DOM.modalDetails.classList.remove('active');
  });

  // Закрытие модалок по клику на оверлей
  [DOM.modalSettings, DOM.modalDetails].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // Тест 401 Unauthorized
  DOM.btnSetInvalidKey.addEventListener('click', () => {
    DOM.cfgApiKey.value = 'invalid_test_key_401';
  });

  // Сброс настроек к дефолтным
  DOM.btnRestoreDefaults.addEventListener('click', () => {
    DOM.cfgApiUrl.value = DEFAULT_API_URL;
    DOM.cfgApiKey.value = DEFAULT_API_KEY;
  });

  // Сохранение настроек API
  DOM.formApiSettings.addEventListener('submit', (e) => {
    e.preventDefault();
    API_URL = DOM.cfgApiUrl.value.trim();
    API_KEY = DOM.cfgApiKey.value.trim();

    localStorage.setItem('is_project_api_url', API_URL);
    localStorage.setItem('is_project_api_key', API_KEY);

    DOM.modalSettings.classList.remove('active');
    fetchSystemsData();
  });
}

// ============================================================================
// 10. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initEventHandlers();
  // Автоматический запрос к API при старте страницы
  fetchSystemsData();
});
