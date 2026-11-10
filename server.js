/**
 * ПРОЕКТИРОВАНИЕ ИНФОРМАЦИОННЫХ СИСТЕМ (v2.0)
 * Полнофункциональный Node.js сервер с нативной базой данных SQLite (node:sqlite)
 * - JWT аутентификация (HMAC-SHA256 через node:crypto)
 * - Защищённые эндпоинты БД с проверкой заголовка X-API-Key
 * - Single Page Application статический хостинг
 * - Без внешних npm-зависимостей (работает на встроенных модулях Node 22/24)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'is-presentation-super-secret-jwt-key-2026';
const DB_FILE = path.join(__dirname, 'database.sqlite');

// 1. Инициализация базы данных SQLite
const db = new DatabaseSync(DB_FILE);

// Создание таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Architect',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT 'read_write',
    status TEXT NOT NULL DEFAULT 'active',
    calls_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS systems (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    architecture_type TEXT NOT NULL,
    sla_level TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT,
    database_tech TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS slides_data (
    slide_num INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    category TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    api_key TEXT,
    status_code INTEGER NOT NULL,
    ip_address TEXT,
    timestamp TEXT NOT NULL
  );
`);

// Хеширование паролей (SHA-256 с солью)
function hashPassword(password) {
  return crypto.createHmac('sha256', JWT_SECRET).update(password).digest('hex');
}

// Заполнение начальными данными, если база пустая
const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (userCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const adminId = 'usr_admin_001';
  const archId = 'usr_arch_002';
  const now = new Date().toISOString();

  insertUser.run(adminId, 'admin', 'admin@system.local', hashPassword('admin123'), 'Administrator', now);
  insertUser.run(archId, 'architect', 'architect@system.local', hashPassword('pass123'), 'Solution Architect', now);

  // Создаем стандартные X-API-Key
  const insertKey = db.prepare(`
    INSERT INTO api_keys (key, name, user_id, permissions, status, calls_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertKey.run('xak_live_master_9948201', 'Master Production Key', adminId, 'read_write', 'active', 12, now);
  insertKey.run('xak_live_dev_7731902', 'Architect Sandbox Key', archId, 'read_write', 'active', 5, now);
  insertKey.run('xak_public_demo_key', 'Demo Read-Only Key', archId, 'read', 'active', 42, now);

  // Добавляем тестовые архитектурные системы
  const insertSystem = db.prepare(`
    INSERT INTO systems (id, code, title, architecture_type, sla_level, status, description, database_tech, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSystem.run('sys_01', 'IS-CORE-BILLING', 'Ядро биллинговой системы', 'Microservices', '99.99%', 'Active', 'Обработка транзакций в реальном времени, event-driven шина Kafka', 'PostgreSQL + Redis', now);
  insertSystem.run('sys_02', 'IS-ECOMMERCE-GW', 'API Gateway E-Commerce', 'API Gateway + Envoy', '99.95%', 'Active', 'Маршрутизация внешнего трафика, rate limiting, JWT верификация', 'Redis Cluster', now);
  insertSystem.run('sys_03', 'IS-INVENTORY-SRV', 'Управление складскими остатками', 'Modular Monolith', '99.9%', 'Active', 'Инвентаризация и распределенный учет партий продукции', 'PostgreSQL', now);
  insertSystem.run('sys_04', 'IS-ANALYTICS-DWH', 'Корпоративное хранилище данных', 'Lambda / Lakehouse', '99.5%', 'Active', 'Аналитическая отчетность, ETL конвейеры, витрины данных', 'ClickHouse + MinIO', now);
  insertSystem.run('sys_05', 'IS-CRM-CUSTOMER', 'Управление отношениями с клиентами', 'Microservices', '99.9%', 'Draft', 'Омниканальный контакт-центр и единый профиль клиента 360', 'MongoDB + Elastic', now);

  // Заполняем темы слайдов
  const insertSlide = db.prepare(`
    INSERT OR REPLACE INTO slides_data (slide_num, title, topic, category)
    VALUES (?, ?, ?, ?)
  `);

  const initialSlides = [
    [1, 'Титульный лист', 'Тема №14: Проектирование ИС', 'Введение'],
    [2, 'План презентации', 'Интерактивная карта 26 слайдов', 'Навигация'],
    [3, 'Понятие информационной системы', 'Сущность, компоненты и цели ИС', 'Теория'],
    [4, 'Жизненный цикл ИС (SDLC)', 'Модели каскадная, спиральная, Agile', 'Методология'],
    [5, 'Стандарты проектирования', 'ГОСТ 34, ГОСТ 19, ISO/IEC 12207', 'Стандарты'],
    [6, 'Предпроектное обследование', 'AS-IS, TO-BE, бизнес-процессы', 'Анализ'],
    [7, 'Методологии моделирования', 'UML, BPMN 2.0, IDEF0', 'Моделирование'],
    [8, 'Архитектурные стили ИС', 'Монолит, Микросервисы, EDA, SOA', 'Архитектура'],
    [9, 'Монолитная архитектура', 'Плюсы, минусы, область применения', 'Архитектура'],
    [10, 'Микросервисная архитектура', 'Декомпозиция, API Gateway, Docker', 'Архитектура'],
    [11, 'Событийно-ориентированная (EDA)', 'Message Broker: Kafka, RabbitMQ', 'Архитектура'],
    [12, 'Серверлесс и Cloud Native', 'FaaS, Kubernetes, Multi-Cloud', 'Облака'],
    [13, 'Проектирование баз данных', 'Реляционные (SQL) и NoSQL решения', 'Данные'],
    [14, 'Нормализация и оптимизация БД', '1NF - BCNF, Индексы, Шардирование', 'Данные'],
    [15, 'Интеграция систем и API', 'REST, GraphQL, gRPC, Webhooks', 'Интеграция'],
    [16, 'Безопасность ИС', 'Аутентификация, JWT, OAuth2, RBAC', 'Безопасность'],
    [17, 'Проектирование UI/UX', 'Юзабилити, дизайн-системы, WCAG', 'Интерфейс'],
    [18, 'Тестирование информационных систем', 'Пирамида тестирования, TDD, QA', 'Качество'],
    [19, 'CI/CD и DevOps практики', 'Автоматизация сборки и деплоя', 'DevOps'],
    [20, 'Надежность и масштабирование', 'High Availability, Репликация, SLA', 'Надежность'],
    [21, 'Мониторинг и наблюдаемость', 'Метрики, логи, трейсинг (APM)', 'Эксплуатация'],
    [22, 'Управление рисками проекта', 'Матрица рисков, митигация', 'Управление'],
    [23, 'Документирование проектов', 'ТЗ, Архитектурный паспорт (ADR)', 'Документация'],
    [24, 'Экономическая эффективность', 'ROI, TCO, расчет окупаемости ИС', 'Экономика'],
    [25, 'Практический кейс: E-Commerce', 'Сквозной разбор проектирования', 'Практика'],
    [26, 'Выводы и Заключение', 'Итоги, тренды ИИ и блок Q&A', 'Финал']
  ];

  initialSlides.forEach(s => insertSlide.run(s[0], s[1], s[2], s[3]));
}

// =================== JWT ФУНКЦИИ (HMAC-SHA256) ===================

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function signJWT(payload, expiresInSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

function verifyJWT(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;
  const dataToSign = `${headerB64}.${payloadB64}`;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    return null; // Подпись не совпадает
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Токен истек
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// Вспомогательная функция для парсинга тела запроса
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
  });
}

// Отправка JSON ответа
function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    ...extraHeaders
  });
  res.end(JSON.stringify(data, null, 2));
}

// Логирование вызовов API в БД
function logApiCall(endpoint, method, apiKey, statusCode, req) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    db.prepare(`
      INSERT INTO api_logs (endpoint, method, api_key, status_code, ip_address, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(endpoint, method, apiKey || null, statusCode, ip, new Date().toISOString());
  } catch (e) {
    // игнорируем ошибки логирования
  }
}

// Проверка X-API-Key
function validateApiKey(req) {
  const key = req.headers['x-api-key'] || req.headers['x-apikey'];
  if (!key) return null;

  const foundKey = db.prepare('SELECT * FROM api_keys WHERE key = ? AND status = ?').get(key, 'active');
  if (foundKey) {
    // Увеличиваем счетчик вызовов
    db.prepare('UPDATE api_keys SET calls_count = calls_count + 1 WHERE key = ?').run(key);
    return foundKey;
  }
  return null;
}

// Определение MIME-типов для статики
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// =================== HTTP СЕРВЕР ===================

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  // =================== API МАРШРУТЫ ===================

  // 1. АУТЕНТИФИКАЦИЯ: Регистрация (POST /api/auth/register)
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseBody(req);
    const { username, email, password, role } = body;

    if (!username || !email || !password) {
      return sendJson(res, 400, {
        success: false,
        error: 'Validation failed',
        message: 'Поля username, email и password обязательны для заполнения'
      });
    }

    try {
      const userId = 'usr_' + crypto.randomBytes(6).toString('hex');
      const now = new Date().toISOString();
      const userRole = role === 'Administrator' ? 'Administrator' : 'Solution Architect';
      const passwordHash = hashPassword(password);

      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, username, email, passwordHash, userRole, now);

      // Генерируем начальный X-API-Key для нового пользователя
      const apiKey = 'xak_live_' + crypto.randomBytes(8).toString('hex');
      db.prepare(`
        INSERT INTO api_keys (key, name, user_id, permissions, status, calls_count, created_at)
        VALUES (?, ?, ?, 'read_write', 'active', 0, ?)
      `).run(apiKey, `Default Key (${username})`, userId, now);

      // Генерируем JWT
      const token = signJWT({ id: userId, username, email, role: userRole });

      return sendJson(res, 201, {
        success: true,
        message: 'Пользователь успешно зарегистрирован',
        token,
        apiKey,
        user: { id: userId, username, email, role: userRole }
      });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return sendJson(res, 409, {
          success: false,
          error: 'Conflict',
          message: 'Пользователь с таким именем или email уже существует'
        });
      }
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 2. АУТЕНТИФИКАЦИЯ: Логин (POST /api/auth/login)
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { emailOrUsername, password } = body;

    if (!emailOrUsername || !password) {
      return sendJson(res, 400, {
        success: false,
        error: 'Validation failed',
        message: 'Укажите логин/email и пароль'
      });
    }

    const user = db.prepare(`
      SELECT * FROM users WHERE email = ? OR username = ?
    `).get(emailOrUsername, emailOrUsername);

    if (!user || user.password_hash !== hashPassword(password)) {
      return sendJson(res, 401, {
        success: false,
        error: 'Unauthorized',
        message: 'Неверный логин или пароль'
      });
    }

    // Ищем активный API Key пользователя
    const keyRow = db.prepare('SELECT key FROM api_keys WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(user.id);
    const apiKey = keyRow ? keyRow.key : 'xak_live_' + crypto.randomBytes(8).toString('hex');

    // Генерируем JWT токен
    const token = signJWT({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    return sendJson(res, 200, {
      success: true,
      message: 'Успешная JWT аутентификация',
      token,
      apiKey,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  }

  // 3. АУТЕНТИФИКАЦИЯ: Профиль пользователя по Bearer JWT (GET /api/auth/me)
  if (pathname === '/api/auth/me' && method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJson(res, 401, {
        success: false,
        error: 'Unauthorized',
        message: 'Требуется заголовок Authorization: Bearer <jwt_token>'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);

    if (!decoded) {
      return sendJson(res, 401, {
        success: false,
        error: 'InvalidToken',
        message: 'JWT токен недействителен или срок его действия истек'
      });
    }

    const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(decoded.id);
    const keys = db.prepare('SELECT key, name, permissions, status, calls_count, created_at FROM api_keys WHERE user_id = ?').all(decoded.id);

    return sendJson(res, 200, {
      success: true,
      user: user || decoded,
      keys,
      claims: decoded
    });
  }

  // 4. ГЕНЕРАЦИЯ X-API-Key: (POST /api/keys/generate) - требует JWT
  if (pathname === '/api/keys/generate' && method === 'POST') {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const decoded = verifyJWT(token);

    if (!decoded) {
      return sendJson(res, 401, {
        success: false,
        error: 'Unauthorized',
        message: 'Для выпуска API-ключа необходима авторизация по JWT (Bearer токен)'
      });
    }

    const body = await parseBody(req);
    const keyName = body.name || `API Key (${new Date().toLocaleDateString()})`;
    const newKey = 'xak_live_' + crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO api_keys (key, name, user_id, permissions, status, calls_count, created_at)
      VALUES (?, ?, ?, 'read_write', 'active', 0, ?)
    `).run(newKey, keyName, decoded.id, now);

    return sendJson(res, 201, {
      success: true,
      message: 'Новый X-API-Key успешно сгенерирован',
      key: newKey,
      name: keyName
    });
  }

  // =================== ЗАЩИЩЁННЫЙ API С ПРОВЕРКОЙ X-API-Key ===================

  // Проверка для всех маршрутов /api/v1/*
  if (pathname.startsWith('/api/v1/')) {
    const apiKeyData = validateApiKey(req);
    const clientKey = req.headers['x-api-key'] || req.headers['x-apikey'];

    if (!apiKeyData) {
      logApiCall(pathname, method, clientKey, 401, req);
      return sendJson(res, 401, {
        success: false,
        error: 'Unauthorized: Invalid or missing X-API-Key',
        message: 'Доступ запрещён! Требуется действующий заголовок X-API-Key.',
        hint: 'Передайте валидный ключ в заголовке "X-API-Key: xak_live_master_9948201" или войдите в систему и скопируйте свой ключ.'
      }, {
        'WWW-Authenticate': 'ApiKey realm="IS-Presentation-Database"'
      });
    }

    // 5. ПОЛУЧИТЬ СПИСОК СИСТЕМ ИЗ БД (GET /api/v1/systems)
    if (pathname === '/api/v1/systems' && method === 'GET') {
      const typeFilter = parsedUrl.searchParams.get('type');
      let query = 'SELECT * FROM systems';
      const params = [];

      if (typeFilter) {
        query += ' WHERE architecture_type LIKE ?';
        params.push(`%${typeFilter}%`);
      }
      query += ' ORDER BY created_at DESC';

      const systems = db.prepare(query).all(...params);
      logApiCall(pathname, method, apiKeyData.key, 200, req);

      return sendJson(res, 200, {
        success: true,
        source: 'SQLite Database (node:sqlite Native)',
        authenticated_key: apiKeyData.key,
        key_name: apiKeyData.name,
        count: systems.length,
        data: systems
      });
    }

    // 6. СОЗДАТЬ СИСТЕМУ В БД (POST /api/v1/systems)
    if (pathname === '/api/v1/systems' && method === 'POST') {
      if (apiKeyData.permissions === 'read') {
        logApiCall(pathname, method, apiKeyData.key, 403, req);
        return sendJson(res, 403, {
          success: false,
          error: 'Forbidden',
          message: 'Данный X-API-Key имеет права только на чтение (read-only)'
        });
      }

      const body = await parseBody(req);
      const { code, title, architecture_type, sla_level, status, description, database_tech } = body;

      if (!code || !title) {
        logApiCall(pathname, method, apiKeyData.key, 400, req);
        return sendJson(res, 400, {
          success: false,
          error: 'Validation failed',
          message: 'Поля code и title обязательны'
        });
      }

      const newId = 'sys_' + crypto.randomBytes(4).toString('hex');
      const now = new Date().toISOString();

      try {
        db.prepare(`
          INSERT INTO systems (id, code, title, architecture_type, sla_level, status, description, database_tech, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newId,
          code.toUpperCase(),
          title,
          architecture_type || 'Microservices',
          sla_level || '99.9%',
          status || 'Active',
          description || '',
          database_tech || 'PostgreSQL',
          now
        );

        logApiCall(pathname, method, apiKeyData.key, 201, req);
        return sendJson(res, 201, {
          success: true,
          message: 'Запись успешно добавлена в базу данных SQLite',
          createdId: newId,
          data: { id: newId, code: code.toUpperCase(), title, architecture_type, sla_level, status }
        });
      } catch (err) {
        logApiCall(pathname, method, apiKeyData.key, 409, req);
        return sendJson(res, 409, { success: false, error: 'Duplicate entry or constraint violation: ' + err.message });
      }
    }

    // 7. УДАЛИТЬ СИСТЕМУ ИЗ БД (DELETE /api/v1/systems/:id)
    if (pathname.startsWith('/api/v1/systems/') && method === 'DELETE') {
      const systemId = pathname.replace('/api/v1/systems/', '');
      const result = db.prepare('DELETE FROM systems WHERE id = ?').run(systemId);

      logApiCall(pathname, method, apiKeyData.key, 200, req);
      return sendJson(res, 200, {
        success: true,
        message: `Запись ${systemId} удалена из БД`,
        changes: result.changes
      });
    }

    // 8. СПИСОК 26 СЛАЙДОВ ИЗ БД (GET /api/v1/slides)
    if (pathname === '/api/v1/slides' && method === 'GET') {
      const slides = db.prepare('SELECT * FROM slides_data ORDER BY slide_num ASC').all();
      logApiCall(pathname, method, apiKeyData.key, 200, req);
      return sendJson(res, 200, {
        success: true,
        total_slides: slides.length,
        data: slides
      });
    }

    // 9. СТАТИСТИКА И АНАЛИТИКА API (GET /api/v1/stats)
    if (pathname === '/api/v1/stats' && method === 'GET') {
      const systemsCount = db.prepare('SELECT COUNT(*) as c FROM systems').get().c;
      const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
      const apiCallsCount = db.prepare('SELECT COUNT(*) as c FROM api_logs').get().c;
      const recentLogs = db.prepare('SELECT * FROM api_logs ORDER BY id DESC LIMIT 10').all();

      logApiCall(pathname, method, apiKeyData.key, 200, req);
      return sendJson(res, 200, {
        success: true,
        stats: {
          database_engine: 'SQLite Native (Node 24)',
          total_systems: systemsCount,
          total_users: usersCount,
          total_api_calls: apiCallsCount,
          auth_mode: 'JWT (HS256) + X-API-Key Header'
        },
        recent_logs: recentLogs
      });
    }

    return sendJson(res, 404, { success: false, error: 'Endpoint not found' });
  }

  // =================== РАЗДАЧА СТАТИЧЕСКИХ ФАЙЛОВ SPA ===================

  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: если запрошен неизвестный путь, отдаём index.html
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('500 Internal Server Error');
      }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ИС-ПРОЕКТИРОВАНИЕ: SPA + JWT + SQLite API Запущен!`);
  console.log(`🌐 Адрес сайта:     http://localhost:${PORT}`);
  console.log(`🔑 Защищённый API:  http://localhost:${PORT}/api/v1/systems (требует X-API-Key)`);
  console.log(`🔐 JWT Auth:        http://localhost:${PORT}/api/auth/login`);
  console.log(`💾 База данных:     ${DB_FILE} (Native node:sqlite)`);
  console.log(`====================================================`);
});
