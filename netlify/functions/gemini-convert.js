/**
 * Netlify Function: gemini-convert
 * Конвертирует загруженный файл в HTML-слайды через Gemini API
 * POST /api/gemini/convert
 * Body: { fileUri, mimeType, fileName }
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CONVERSION_PROMPT = `Ты эксперт по конвертации презентаций. Проанализируй загруженный документ и извлеки все слайды/страницы.
Для каждого слайда верни JSON объект в массиве slides:
{
  "slideNumber": <номер>,
  "title": "<заголовок слайда>",
  "content": "<HTML разметка содержимого слайда — заголовки h2/h3, абзацы p, списки ul/li, таблицы table, выдели ключевые слова через <strong>>",
  "speakerNotes": "<краткие заметки докладчика>",
  "layout": "title|content|two-column|table|diagram"
}
Верни ТОЛЬКО валидный JSON массив slides без markdown блоков.`;

exports.handler = async (event) => {
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

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Невалидный JSON в теле запроса' }) };
  }

  const { fileUri, mimeType, fileName } = body;

  if (!fileUri || !mimeType) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Требуются fileUri и mimeType' }) };
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { fileData: { mimeType, fileUri } },
              { text: CONVERSION_PROMPT }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return {
        statusCode: geminiRes.status,
        headers,
        body: JSON.stringify({ error: `Ошибка Gemini API: ${geminiRes.status}`, details: errText })
      };
    }

    const geminiData = await geminiRes.json();

    // Извлекаем текст из ответа
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawText) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Gemini вернул пустой ответ', raw: geminiData })
      };
    }

    // Парсим JSON из ответа (убираем возможные markdown блоки)
    let slides;
    try {
      // Убираем ```json ... ``` если Gemini всё же добавил
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      slides = JSON.parse(cleaned);

      // Если вернулся объект {slides: [...]}, достаём массив
      if (!Array.isArray(slides) && slides.slides) {
        slides = slides.slides;
      }

      if (!Array.isArray(slides)) {
        throw new Error('Ответ не является массивом слайдов');
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw text:', rawText.substring(0, 500));
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({
          error: 'Не удалось распарсить ответ Gemini как JSON',
          details: parseErr.message,
          rawPreview: rawText.substring(0, 1000)
        })
      };
    }

    // Нормализуем слайды
    const normalizedSlides = slides.map((slide, idx) => ({
      slideNumber: slide.slideNumber || idx + 1,
      title: slide.title || `Слайд ${idx + 1}`,
      content: slide.content || '',
      speakerNotes: slide.speakerNotes || '',
      layout: slide.layout || 'content'
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        slides: normalizedSlides,
        totalSlides: normalizedSlides.length,
        fileName: fileName || 'presentation'
      })
    };

  } catch (err) {
    console.error('gemini-convert error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Внутренняя ошибка сервера' })
    };
  }
};
