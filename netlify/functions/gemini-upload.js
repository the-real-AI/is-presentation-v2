/**
 * Netlify Function: gemini-upload
 * Принимает файл (.pptx или .pdf) и загружает его в Gemini File API
 * POST /api/gemini/upload
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!GEMINI_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GEMINI_API_KEY не настроен в переменных окружения' }) };
  }

  try {
    // Получаем тело запроса (base64 или бинарное)
    const bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'binary');

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

    if (!contentType.includes('multipart/form-data')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ожидается multipart/form-data' }) };
    }

    // Парсим multipart вручную
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Не найден boundary в Content-Type' }) };
    }

    const boundary = boundaryMatch[1];
    const { fileBuffer, fileName, mimeType } = parseMultipart(bodyBuffer, boundary);

    if (!fileBuffer) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Файл не найден в запросе' }) };
    }

    // Определяем MIME тип если не указан
    const detectedMime = mimeType || detectMimeType(fileName);

    // Шаг 1: Начинаем resumable upload в Gemini File API
    const startRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'multipart',
          'Content-Type': `multipart/related; boundary=gemini_boundary_123`
        },
        body: buildGeminiMultipart(fileBuffer, fileName, detectedMime)
      }
    );

    if (!startRes.ok) {
      const errText = await startRes.text();
      console.error('Gemini File API error:', errText);
      return {
        statusCode: startRes.status,
        headers,
        body: JSON.stringify({ error: `Ошибка Gemini File API: ${startRes.status}`, details: errText })
      };
    }

    const result = await startRes.json();
    const fileUri = result.file?.uri || result.uri;
    const name = result.file?.name || result.name;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        fileUri,
        mimeType: detectedMime,
        name,
        fileName
      })
    };

  } catch (err) {
    console.error('gemini-upload error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Внутренняя ошибка сервера' })
    };
  }
};

/**
 * Строит тело multipart/related запроса для Gemini File API
 */
function buildGeminiMultipart(fileBuffer, fileName, mimeType) {
  const boundary = 'gemini_boundary_123';
  const metaJson = JSON.stringify({ file: { display_name: fileName } });

  const parts = [
    `--${boundary}\r\n`,
    `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
    `${metaJson}\r\n`,
    `--${boundary}\r\n`,
    `Content-Type: ${mimeType}\r\n\r\n`
  ];

  const header = Buffer.from(parts.join(''));
  const footer = Buffer.from(`\r\n--${boundary}--`);

  return Buffer.concat([header, fileBuffer, footer]);
}

/**
 * Парсит multipart/form-data тело запроса
 */
function parseMultipart(buffer, boundary) {
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(buffer, boundaryBuf);

  for (const part of parts) {
    if (part.length < 4) continue;

    // Найдём разделитель заголовков и тела (\r\n\r\n)
    const headerEnd = findSequence(part, Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;

    const headerStr = part.slice(0, headerEnd).toString('utf8');
    const body = part.slice(headerEnd + 4);

    // Убираем trailing \r\n
    const fileBody = body.slice(-2).equals(Buffer.from('\r\n'))
      ? body.slice(0, -2)
      : body;

    if (headerStr.includes('filename=') || headerStr.includes('content-type:') || headerStr.toLowerCase().includes('content-type:')) {
      const fileNameMatch = headerStr.match(/filename="?([^";\r\n]+)"?/i);
      const mimeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

      if (fileNameMatch && fileBody.length > 0) {
        return {
          fileBuffer: fileBody,
          fileName: fileNameMatch[1].trim(),
          mimeType: mimeMatch ? mimeMatch[1].trim() : null
        };
      }
    }
  }

  return { fileBuffer: null, fileName: null, mimeType: null };
}

function splitBuffer(buf, separator) {
  const parts = [];
  let start = 0;
  let idx = findSequence(buf, separator, start);

  while (idx !== -1) {
    parts.push(buf.slice(start, idx));
    start = idx + separator.length;
    idx = findSequence(buf, separator, start);
  }

  if (start < buf.length) {
    parts.push(buf.slice(start));
  }

  return parts;
}

function findSequence(buf, seq, offset = 0) {
  for (let i = offset; i <= buf.length - seq.length; i++) {
    let found = true;
    for (let j = 0; j < seq.length; j++) {
      if (buf[i + j] !== seq[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

function detectMimeType(fileName) {
  if (!fileName) return 'application/octet-stream';
  const ext = fileName.toLowerCase().split('.').pop();
  const mimes = {
    'pdf': 'application/pdf',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint'
  };
  return mimes[ext] || 'application/octet-stream';
}
