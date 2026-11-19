const { CORS_HEADERS, jsonResponse } = require('./common');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  return jsonResponse(200, { ok: true, status: 'authenticated' });
};
