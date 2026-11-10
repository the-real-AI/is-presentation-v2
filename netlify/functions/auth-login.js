/**
 * Netlify Function: /api/auth/login
 * Аутентификация через Google Firebase Identity Toolkit (Email/Password)
 * Возвращает Firebase ID Token (JWT по стандарту RFC 7519) и X-API-Key
 */

const {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  jsonResponse,
  CORS_HEADERS
} = require('./common');

// Вспомогательная функция генерации JWT для локальных демо-пользователей
function makeDemoJwt(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const proj = FIREBASE_PROJECT_ID || 'presentation-cloud';
  const payload = Buffer.from(JSON.stringify({
    iss: `https://securetoken.google.com/${proj}`,
    aud: proj,
    auth_time: now,
    user_id: user.id,
    sub: user.id,
    iat: now,
    exp: now + 3600 * 24, // 24 часа
    email: user.email,
    email_verified: true,
    role: user.role,
    username: user.username
  })).toString('base64url');
  const signature = Buffer.from('mock_signature_presentation_firebase_jwt').toString('base64url');
  return `${header}.${payload}.${signature}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method Not Allowed' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { success: false, error: 'Bad Request' });
  }

  const emailOrUser = (body.emailOrUsername || body.email || '').trim().toLowerCase();
  const password = body.password || '';

  // 1. Быстрый демо-вход для демонстраций
  if ((emailOrUser === 'admin@system.local' || emailOrUser === 'admin') && password === 'admin123') {
    const user = {
      id: 'usr_admin_001',
      username: 'admin',
      email: 'admin@system.local',
      role: 'Administrator'
    };
    return jsonResponse(200, {
      success: true,
      message: 'Успешный вход под учётной записью Администратора',
      token: makeDemoJwt(user),
      user,
      apiKey: 'xak_live_master_9948201',
      auth_provider: 'Firebase Mock / Admin Master'
    });
  }

  if ((emailOrUser === 'architect@system.local' || emailOrUser === 'architect') && password === 'pass123') {
    const user = {
      id: 'usr_arch_002',
      username: 'architect',
      email: 'architect@system.local',
      role: 'Solution Architect'
    };
    return jsonResponse(200, {
      success: true,
      message: 'Успешный вход под учётной записью Архитектора',
      token: makeDemoJwt(user),
      user,
      apiKey: 'xak_live_arch_7731902',
      auth_provider: 'Firebase Mock / Solution Architect'
    });
  }

  // 2. Обращение к реальному Google Firebase Identity Toolkit
  try {
    const fbRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailOrUser,
          password: password,
          returnSecureToken: true
        })
      }
    );

    const fbData = await fbRes.json();

    if (fbRes.ok && fbData.idToken) {
      const generatedApiKey = 'xak_live_' + fbData.localId.substring(0, 10);
      const username = fbData.displayName || emailOrUser.split('@')[0];
      return jsonResponse(200, {
        success: true,
        message: 'Аутентификация Google Firebase успешно пройдена!',
        token: fbData.idToken, // Реальный Google Firebase JWT
        refreshToken: fbData.refreshToken,
        expiresIn: fbData.expiresIn,
        user: {
          id: fbData.localId,
          email: fbData.email,
          username: username,
          role: 'Architect'
        },
        apiKey: generatedApiKey,
        auth_provider: 'Google Firebase Authentication (RFC 7519 JWT)'
      });
    } else {
      const errorMsg = fbData.error ? fbData.error.message : 'Ошибка входа в Firebase';
      // Если в Firebase ещё не зарегистрирован, но пароль не пустой — авто-фолбек
      return jsonResponse(401, {
        success: false,
        error: 'Unauthorized',
        message: `Ошибка входа: ${errorMsg}. (Для проверки используйте demo: admin / admin123)`
      });
    }
  } catch (err) {
    return jsonResponse(500, {
      success: false,
      error: 'Firebase Auth Error',
      message: err.message
    });
  }
};
