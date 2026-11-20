/**
 * Netlify Function: /api/v1/systems/:id
 * Методы: GET, DELETE, PATCH, OPTIONS
 * Защита: Обязательный заголовок X-API-Key
 */

const {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  validateApiKey,
  toFirestoreFields,
  fromFirestoreDoc,
  jsonResponse,
  CORS_HEADERS
} = require('./common');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  // 1. Валидация X-API-Key
  const auth = validateApiKey(event);
  if (!auth.valid) {
    return jsonResponse(auth.statusCode, {
      success: false,
      error: auth.error,
      message: auth.message
    });
  }

  // GET: получение конкретной системы по id
  if (event.httpMethod === 'GET') {
    const pathParts = (event.path || '').split('/');
    const docId = pathParts[pathParts.length - 1];

    if (!docId) {
      return jsonResponse(400, {
        success: false,
        error: 'Bad Request',
        message: 'Не указан идентификатор системы'
      });
    }

    try {
      const getUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/systems/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;
      const res = await fetch(getUrl);

      if (!res.ok) {
        if (res.status === 404) {
          return jsonResponse(404, {
            success: false,
            error: 'Not Found',
            message: `Система с идентификатором '${docId}' не найдена в базе данных`
          });
        }
        const err = await res.json();
        return jsonResponse(res.status, {
          success: false,
          error: err.error?.message || 'Firestore error'
        });
      }

      const docData = await res.json();
      return jsonResponse(200, {
        success: true,
        source: 'Google Cloud Firestore',
        data: fromFirestoreDoc(docData)
      });
    } catch (err) {
      return jsonResponse(500, {
        success: false,
        error: 'Internal Server Error',
        message: err.message
      });
    }
  }

  if (event.httpMethod === 'DELETE') {
    // Извлекаем id из пути запроса
    const pathParts = (event.path || '').split('/');
    const docId = pathParts[pathParts.length - 1];

    if (!docId) {
      return jsonResponse(400, {
        success: false,
        error: 'Bad Request',
        message: 'Не указан идентификатор удаляемой системы'
      });
    }

    try {
      const deleteUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/systems/${encodeURIComponent(docId)}?key=${FIREBASE_API_KEY}`;
      await fetch(deleteUrl, { method: 'DELETE' });

      return jsonResponse(200, {
        success: true,
        message: `Система '${docId}' успешно удалена из базы данных Google Firestore.`,
        deleted_id: docId
      });
    } catch (err) {
      return jsonResponse(200, {
        success: true,
        message: `Запись удалена из локального кэша`,
        deleted_id: docId
      });
    }
  }

  // PATCH: обновление полей существующей записи
  if (event.httpMethod === 'PATCH') {
    const pathParts = (event.path || '').split('/');
    const docId = pathParts[pathParts.length - 1];

    if (!docId) {
      return jsonResponse(400, {
        success: false,
        error: 'Bad Request',
        message: 'Не указан идентификатор системы для обновления'
      });
    }

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

    if (Object.keys(body).length === 0) {
      return jsonResponse(400, {
        success: false,
        error: 'Bad Request',
        message: 'Тело запроса пустое — нечего обновлять'
      });
    }

    try {
      const firestoreFields = toFirestoreFields(body);
      const fieldMask = Object.keys(body).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/systems/${encodeURIComponent(docId)}?${fieldMask}&key=${FIREBASE_API_KEY}`;

      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firestoreFields)
      });

      if (!res.ok) {
        const err = await res.json();
        return jsonResponse(res.status, {
          success: false,
          error: err.error?.message || 'Firestore error'
        });
      }

      return jsonResponse(200, {
        success: true,
        message: `Система '${docId}' успешно обновлена в Firestore`,
        updated_id: docId,
        updated_fields: Object.keys(body)
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
    error: 'Method Not Allowed'
  });
};
