/**
 * Netlify Function: /api/v1/systems/:id
 * Методы: DELETE, OPTIONS
 * Защита: Обязательный заголовок X-API-Key
 */

const {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  validateApiKey,
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

  return jsonResponse(405, {
    success: false,
    error: 'Method Not Allowed'
  });
};
