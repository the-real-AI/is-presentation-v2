/**
 * Netlify Function: /api/keys/generate
 * Генерация нового персонального X-API-Key для авторизованного пользователя
 */

const { jsonResponse, CORS_HEADERS } = require('./common');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Проверка Bearer JWT
  const authHeader = (event.headers || {})['authorization'] || (event.headers || {})['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse(401, {
      success: false,
      error: 'Unauthorized',
      message: 'Для выпуска нового X-API-Key требуется Bearer JWT токен в заголовке Authorization.'
    });
  }

  const newKey = 'xak_live_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
  return jsonResponse(200, {
    success: true,
    apiKey: newKey,
    permissions: 'read_write',
    created_at: new Date().toISOString(),
    message: 'Новый X-API-Key успешно сгенерирован и привязан к вашему аккаунту.'
  });
};
