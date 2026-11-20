/**
 * Общие утилиты и конфигурация для Netlify Functions
 * Связка Netlify + Google Firebase Firestore + Identity Toolkit (JWT)
 */

const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-fallback-key-change-in-env';

// Мастер-ключи и ролевая модель X-API-Key по HTTP методам
const MASTER_API_KEY = 'xak_live_master_9948201';

const METHOD_KEY_MAP = {
  // 1. GET (Чтение)
  'xak_get_read_8841': {
    name: 'GET Read Key',
    methods: ['GET'],
    description: 'Разрешён только просмотр данных (GET)'
  },
  // 2. POST (Создание)
  'xak_post_create_4492': {
    name: 'POST Create Key',
    methods: ['POST'],
    description: 'Разрешено только добавление новых записей (POST)'
  },
  // 3. PATCH (Обновление)
  'xak_patch_update_6631': {
    name: 'PATCH Update Key',
    methods: ['PATCH', 'PUT'],
    description: 'Разрешено только частичное изменение записей (PATCH)'
  },
  // 4. DELETE (Удаление)
  'xak_delete_remove_1109': {
    name: 'DELETE Remove Key',
    methods: ['DELETE'],
    description: 'Разрешено только удаление записей (DELETE)'
  },
  // 5. MASTER (Все методы)
  'xak_live_master_9948201': {
    name: 'Master Production Key (Full Access)',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    description: 'Полный доступ ко всем HTTP-методам'
  }
};

function getKeyPermissions(apiKey) {
  if (!apiKey) return null;
  if (METHOD_KEY_MAP[apiKey]) {
    return METHOD_KEY_MAP[apiKey];
  }
  // Поддержка префиксов
  if (apiKey.startsWith('xak_get_')) {
    return { name: 'GET Key (Prefix)', methods: ['GET'] };
  }
  if (apiKey.startsWith('xak_post_')) {
    return { name: 'POST Key (Prefix)', methods: ['POST'] };
  }
  if (apiKey.startsWith('xak_patch_')) {
    return { name: 'PATCH Key (Prefix)', methods: ['PATCH', 'PUT'] };
  }
  if (apiKey.startsWith('xak_delete_') || apiKey.startsWith('xak_del_')) {
    return { name: 'DELETE Key (Prefix)', methods: ['DELETE'] };
  }
  if (apiKey === MASTER_API_KEY || apiKey.startsWith('xak_master_') || apiKey.startsWith('xak_admin_')) {
    return { name: 'Master Key (Prefix)', methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] };
  }
  return null;
}

// Проверка валидности X-API-Key с привязкой к HTTP-методу
function validateApiKey(event) {
  const headers = event.headers || {};
  const apiKey = headers['x-api-key'] || headers['X-API-Key'] || headers['X-Api-Key'];
  const method = (event.httpMethod || 'GET').toUpperCase();
  
  if (!apiKey) {
    return {
      valid: false,
      statusCode: 401,
      error: 'Unauthorized: Missing X-API-Key header',
      message: 'Доступ к API закрыт! Требуется заголовок X-API-Key.',
      hint: 'Используйте ключ, соответствующий методу: GET (xak_get_read_8841), POST (xak_post_create_4492), PATCH (xak_patch_update_6631), DELETE (xak_delete_remove_1109)'
    };
  }

  const keyConfig = getKeyPermissions(apiKey);

  if (!keyConfig) {
    return {
      valid: false,
      statusCode: 401,
      error: 'Unauthorized: Invalid X-API-Key',
      message: 'Указанный X-API-Key недействителен или не зарегистрирован в системе.',
      hint: 'Допустимые ключи: GET -> xak_get_read_8841, POST -> xak_post_create_4492, PATCH -> xak_patch_update_6631, DELETE -> xak_delete_remove_1109, ALL -> xak_live_master_9948201'
    };
  }

  // Проверка права на текущий HTTP-метод
  if (!keyConfig.methods.includes(method)) {
    return {
      valid: false,
      statusCode: 403,
      error: 'Forbidden: Method Not Allowed For This Key',
      message: `Отказ в доступе! Ключ '${apiKey}' имеет права только на: [${keyConfig.methods.join(', ')}], но вы отправили метод ${method}.`,
      hint: `Для метода ${method} используйте предназначенный для него ключ X-API-Key.`,
      allowed_methods: keyConfig.methods,
      attempted_method: method
    };
  }

  return { valid: true, apiKey, permissions: keyConfig.methods };
}

// Эталонные данные реестра ИС
const INITIAL_SYSTEMS = [
  {
    id: 'sys_01',
    code: 'IS-CORE-BILLING',
    title: 'Ядро биллинговой системы',
    architecture_type: 'Microservices',
    sla_level: '99.99%',
    status: 'Active',
    database_tech: 'Google Cloud Firestore + Redis',
    description: 'Обработка финансовых транзакций в реальном времени, event-driven шина сообщений, распределенный учет.'
  },
  {
    id: 'sys_02',
    code: 'IS-ECOMMERCE-GW',
    title: 'API Gateway E-Commerce',
    architecture_type: 'API Gateway',
    sla_level: '99.95%',
    status: 'Active',
    database_tech: 'Firebase Realtime DB',
    description: 'Входной шлюз для клиентского трафика: rate limiting, верификация JWT токенов и аудит безопасности.'
  },
  {
    id: 'sys_03',
    code: 'IS-INVENTORY-SRV',
    title: 'Управление складскими остатками',
    architecture_type: 'Modular Monolith',
    sla_level: '99.9%',
    status: 'Active',
    database_tech: 'PostgreSQL (Cloud SQL)',
    description: 'Инвентаризация и распределенный учет партий продукции на складах с использованием CQRS паттерна.'
  },
  {
    id: 'sys_04',
    code: 'IS-ANALYTICS-DWH',
    title: 'Корпоративное хранилище данных',
    architecture_type: 'Lambda',
    sla_level: '99.5%',
    status: 'Active',
    database_tech: 'Google BigQuery + Firestore',
    description: 'Хранилище аналитической отчётности, витрины данных, ETL-пайплайны и мониторинг метрик.'
  },
  {
    id: 'sys_05',
    code: 'IS-CRM-CUSTOMER',
    title: 'Управление отношениями с клиентами',
    architecture_type: 'Microservices',
    sla_level: '99.9%',
    status: 'Draft',
    database_tech: 'Cloud Firestore NoSQL',
    description: 'Омниканальная платформа взаимодействия с клиентами, единый профиль клиента 360.'
  },
  {
    id: 'sys_06',
    code: 'IS-NOTIFICATION-BUS',
    title: 'Шлюз рассылки уведомлений',
    architecture_type: 'Event-Driven',
    sla_level: '99.95%',
    status: 'Active',
    database_tech: 'Google Pub/Sub + Redis',
    description: 'Асинхронная доставка push-уведомлений, SMS и email по шаблонам событий.'
  }
];

// Преобразование Firestore Document в плоский JS объект
function fromFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = {};
  const pathParts = (doc.name || '').split('/');
  obj.id = pathParts[pathParts.length - 1] || '';

  for (const [key, valObj] of Object.entries(doc.fields)) {
    if ('stringValue' in valObj) obj[key] = valObj.stringValue;
    else if ('integerValue' in valObj) obj[key] = parseInt(valObj.integerValue, 10);
    else if ('doubleValue' in valObj) obj[key] = parseFloat(valObj.doubleValue);
    else if ('booleanValue' in valObj) obj[key] = valObj.booleanValue;
    else if ('timestampValue' in valObj) obj[key] = valObj.timestampValue;
    else if ('nullValue' in valObj) obj[key] = null;
    else obj[key] = valObj;
  }
  return obj;
}

// Преобразование JS объекта в формат полей Firestore
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'id') continue;
    if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) fields[key] = { integerValue: val.toString() };
      else fields[key] = { doubleValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (val === null || val === undefined) {
      fields[key] = { nullValue: null };
    } else {
      fields[key] = { stringValue: JSON.stringify(val) };
    }
  }
  return { fields };
}

// Стандартные CORS заголовки для браузера
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body, null, 2)
  };
}

module.exports = {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  JWT_SECRET,
  MASTER_API_KEY,
  METHOD_KEY_MAP,
  INITIAL_SYSTEMS,
  validateApiKey,
  fromFirestoreDoc,
  toFirestoreFields,
  CORS_HEADERS,
  jsonResponse
};
