/**
 * Netlify Function: /api/v1/slides
 * Метаданные 26 слайдов презентации
 * Защита: заголовок X-API-Key
 */

const { validateApiKey, jsonResponse, CORS_HEADERS } = require('./common');

const SLIDES_METADATA = [
  { slide_num: 1, topic: 'Титульный лист', title: 'Проектирование информационных систем' },
  { slide_num: 2, topic: 'Цели и задачи', title: 'Цели и назначение проекта' },
  { slide_num: 3, topic: 'Объект и предмет', title: 'Границы исследования и проектирования' },
  { slide_num: 4, topic: 'Стейкхолдеры', title: 'Карта заинтересованных сторон' },
  { slide_num: 5, topic: 'Требования', title: 'Функциональные и нефункциональные требования' },
  { slide_num: 6, topic: 'Архитектура', title: 'Концептуальная архитектура ИС' },
  { slide_num: 7, topic: 'Микросервисы', title: 'Декомпозиция на микросервисы' },
  { slide_num: 8, topic: 'Интеграции', title: 'Интеграционные протоколы и API' },
  { slide_num: 9, topic: 'Базы данных', title: 'Модель данных и хранилище Google Firebase' },
  { slide_num: 10, topic: 'Схемы БД', title: 'Реляционные и документоориентированные схемы' },
  { slide_num: 11, topic: 'Безопасность', title: 'JWT Аутентификация и X-API-Key' },
  { slide_num: 12, topic: 'SLA и масштабирование', title: 'Отказоустойчивость и High Availability' },
  { slide_num: 13, topic: 'CI/CD и деплой', title: 'Пайплайн развёртывания на Netlify' },
  { slide_num: 14, topic: 'Клиент-сервер', title: 'Архитектура Single Page Application' },
  { slide_num: 15, topic: 'Smartboard & Touch', title: 'Адаптивность под интерактивные доски' },
  { slide_num: 16, topic: 'Мобильная версия', title: 'Mobile First и адаптивная верстка' },
  { slide_num: 17, topic: 'Спецификация API', title: 'RESTful API и Swagger-консоль' },
  { slide_num: 18, topic: 'Аудит и логи', title: 'Мониторинг, логирование и телеметрия' },
  { slide_num: 19, topic: 'Тестирование', title: 'Стратегия тестирования и контроль качества' },
  { slide_num: 20, topic: 'Экономическая оценка', title: 'TCO и экономическая эффективность' },
  { slide_num: 21, topic: 'План внедрения', title: 'Дорожная карта реализации проекта' },
  { slide_num: 22, topic: 'Риски проекта', title: 'Анализ архитектурных рисков' },
  { slide_num: 23, topic: 'Результаты', title: 'Ключевые результаты проектирования' },
  { slide_num: 24, topic: 'Демонстрация', title: 'Интерактивная демонстрация реестра' },
  { slide_num: 25, topic: 'Заключение', title: 'Выводы и перспективы развития' },
  { slide_num: 26, topic: 'Вопросы и ответы', title: 'Спасибо за внимание!' }
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const auth = validateApiKey(event);
  if (!auth.valid) {
    return jsonResponse(auth.statusCode, {
      success: false,
      error: auth.error,
      message: auth.message
    });
  }

  return jsonResponse(200, {
    success: true,
    total: SLIDES_METADATA.length,
    data: SLIDES_METADATA
  });
};
