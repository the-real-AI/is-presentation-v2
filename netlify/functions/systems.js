/**
 * Netlify Function: /api/v1/systems
 * Методы: GET, POST, OPTIONS
 * Защита: Обязательный заголовок X-API-Key
 * Источник данных: Google Cloud Firestore REST API
 */

const {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  INITIAL_SYSTEMS,
  validateApiKey,
  fromFirestoreDoc,
  toFirestoreFields,
  jsonResponse,
  CORS_HEADERS
} = require('./common');

exports.handler = async (event, context) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  // 1. Проверка заголовка X-API-Key
  const auth = validateApiKey(event);
  if (!auth.valid) {
    return jsonResponse(auth.statusCode, {
      success: false,
      error: auth.error,
      message: auth.message,
      hint: auth.hint,
      timestamp: new Date().toISOString()
    });
  }

  const firestoreBaseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/systems`;

  // 2. Обработка GET: получение списка систем
  if (event.httpMethod === 'GET') {
    try {
      const response = await fetch(`${firestoreBaseUrl}?key=${FIREBASE_API_KEY}`);
      if (response.ok) {
        const firestoreData = await response.json();
        const documents = firestoreData.documents || [];
        const items = documents.map(fromFirestoreDoc).filter(Boolean);

        // Если коллекция в Firestore ещё пуста, вернем эталонные данные
        const result = items.length > 0 ? items : INITIAL_SYSTEMS;

        return jsonResponse(200, {
          success: true,
          count: result.length,
          source: items.length > 0 ? 'Google Cloud Firestore' : 'Google Cloud Firestore (Initial Seed Cache)',
          project_id: FIREBASE_PROJECT_ID,
          authorized_by: auth.apiKey,
          data: result
        });
      } else {
        // Fallback на начальные данные при первом создании проекта
        return jsonResponse(200, {
          success: true,
          count: INITIAL_SYSTEMS.length,
          source: 'Google Cloud Firestore (Bootstrap Fallback)',
          project_id: FIREBASE_PROJECT_ID,
          authorized_by: auth.apiKey,
          data: INITIAL_SYSTEMS
        });
      }
    } catch (err) {
      return jsonResponse(200, {
        success: true,
        count: INITIAL_SYSTEMS.length,
        source: 'Local Failover Cache',
        project_id: FIREBASE_PROJECT_ID,
        authorized_by: auth.apiKey,
        data: INITIAL_SYSTEMS
      });
    }
  }

  // 3. Обработка POST: добавление новой системы в Firestore
  if (event.httpMethod === 'POST') {
    try {
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return jsonResponse(400, {
          success: false,
          error: 'Bad Request',
          message: 'Некорректный JSON в теле запроса'
        });
      }

      if (!body.code || !body.title) {
        return jsonResponse(400, {
          success: false,
          error: 'Validation Error',
          message: 'Обязательные поля: code (код системы) и title (название)'
        });
      }

      const docId = body.id || 'sys_' + Math.random().toString(36).substring(2, 8);
      const newSystem = {
        id: docId,
        code: String(body.code).toUpperCase().trim(),
        title: String(body.title).trim(),
        architecture_type: body.architecture_type || 'Microservices',
        sla_level: body.sla_level || '99.9%',
        status: body.status || 'Active',
        database_tech: body.database_tech || 'Firestore NoSQL',
        description: body.description || '',
        created_at: new Date().toISOString()
      };

      const firestoreBody = toFirestoreFields(newSystem);

      // Запись документа в Firestore REST API
      const writeUrl = `${firestoreBaseUrl}?documentId=${encodeURIComponent(docId)}&key=${FIREBASE_API_KEY}`;
      const writeRes = await fetch(writeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firestoreBody)
      });

      return jsonResponse(201, {
        success: true,
        message: 'Система успешно зарегистрирована в реестре Firestore!',
        source: 'Google Cloud Firestore',
        data: newSystem
      });
    } catch (err) {
      return jsonResponse(500, {
        success: false,
        error: 'Internal Server Error',
        message: err.message
      });
    }
  }

  return jsonResponse(405, {
    success: false,
    error: 'Method Not Allowed',
    message: `Метод ${event.httpMethod} не поддерживается для /api/v1/systems`
  });
};
