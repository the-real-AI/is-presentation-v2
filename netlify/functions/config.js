/**
 * Netlify Function: /api/config
 * Безопасная передача публичной конфигурации Firebase на фронтенд из переменных окружения
 */

const { CORS_HEADERS, jsonResponse } = require('./common');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'presentation-3ecc0';
  const apiKey = process.env.FIREBASE_WEB_API_KEY || '';

  return jsonResponse(200, {
    apiKey: apiKey,
    authDomain: `${projectId}.firebaseapp.com`,
    projectId: projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "1049003748352",
    appId: process.env.FIREBASE_APP_ID || "1:1049003748352:web:298544740ecb6dcffa3ce5",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-B57J3DP04C"
  });
};
