# 🚀 Архитектурный реестр ИС & Мультимедийная SPA Презентация (v2.0)
## Связка: Netlify + Google Cloud Firebase + JWT (RFC 7519) + X-API-Key

Современное мультиплатформенное одностраничное веб-приложение (**Single Page Application**), развёртываемое на **Netlify** с облачной NoSQL базой данных **Google Cloud Firestore**, аутентификацией **Google Firebase Auth (JWT)** и защищённым шлюзом **Netlify Functions** с обязательной верификацией заголовка **`X-API-Key`**.

---

### 🌟 Ключевые возможности и архитектура (v2.0)

#### 1. ⚡ Single Page Application (SPA)
Вся навигация между разделами работает **без перезагрузки страницы**:
- 🖥️ **Слайды** (`#presentation`) — полный комплекс из 26 слайдов с интерактивными архитектурными схемами, таймером доклада, звуковыми эффектами (Web Audio API), лазерной указкой/маркером и поддержкой интерактивных досок (Smartboard).
- 🗄️ **База данных ИС** (`#database`) — реестр архитектурных систем из **Google Cloud Firestore**, мгновенный поиск, фильтрация по стилям (Microservices, Monolith, EDA, Cloud Native, Lambda), добавление новых систем и расчёт метрик SLA.
- 🔌 **API & X-API-Key Console** (`#api-console`) — встроенный интерактивный Swagger-тестер API:
  - Селектор HTTP методов (`GET`, `POST`, `DELETE`);
  - Выбор эндпоинтов (`/api/v1/systems`, `/api/v1/stats`, `/api/v1/slides`);
  - Поле для ввода заголовка `X-API-Key` (с кнопками «Подставить мой ключ» и «Очистить ключ» для проверки безопасности);
  - Инспектор кодов ответа с цветовой дифференциацией:
    - 🟢 **HTTP 200 OK** (при наличии действующего `X-API-Key`);
    - 🔴 **HTTP 401 Unauthorized** (при отсутствии ключа);
  - Замер времени отклика сервера (мс);
  - Форматированный вывод JSON и автоматический генератор команд **cURL**.
- 👤 **JWT Авторизация и Профиль** (`#profile`) — формы входа и регистрации Google Firebase Auth, визуализатор токена (Header, Payload, Signature), генерация и копирование персонального `X-API-Key`.

#### 2. 🔐 JWT Аутентификация (RFC 7519) & Google Firebase
- Подлинные JWT токены, выпускаемые Google Firebase Identity Toolkit.
- Инспектор токена прямо в интерфейсе: разделение на Header (алгоритм RS256/HS256), Payload (claims `sub`, `iss: https://securetoken.google.com/<project_id>`, `email`, `role`, `exp`) и Signature.
- Быстрый демо-вход в 1 клик:
  - 👑 **Administrator**: `admin@system.local` / `admin123` (мастер-ключ `xak_live_master_9948201`)
  - 🛠️ **Solution Architect**: `architect@system.local` / `pass123` (ключ `xak_live_arch_7731902`)
  - Регистрация любого нового пользователя с сохранением в Firebase Auth.

#### 3. 📱 Мультиплатформенная адаптация (Universal Responsive)
- **Смартфоны (320px – 576px)**: мобильное всплывающее меню (Mobile Drawer), touch-target кнопки (>=44px), поддержка горизонтальных свайпов, компактные карточки вместо ломающихся таблиц.
- **Планшеты (768px – 1024px)**: гибкий двухколоночный макет для API-консоли, сенсорный отклик.
- **Десктопы и 4K (1200px+)**: стеклянный неоморфный дизайн (Glassmorphism), анимации на Canvas, горячие клавиши управления презентацией (`Space`, `F`, `Home`, `End`).
- **Интерактивные сенсорные доски (Smartboards)**: плавающие боковые сенсорные кнопки переключения слайдов, режим виртуальной лазерной указки/рисования стилусом на canvas.
- **Печать и PDF (`Ctrl + P`)**: режим чистой печати документации без панелей навигации.

#### 4. 🗄️ База данных Google Firebase Firestore и доступ по `X-API-Key`
- Все запросы к данным защищены serverless-шлюзом **Netlify Functions**:
  - При отсутствии или некорректном заголовке `X-API-Key` возвращается **HTTP 401 Unauthorized**:
    ```json
    {
      "success": false,
      "error": "Unauthorized: Missing X-API-Key header",
      "message": "Доступ к API закрыт! Требуется заголовок X-API-Key."
    }
    ```
  - При наличии валидного ключа возвращаются реальные данные из Firestore:
    ```bash
    curl -H "X-API-Key: xak_live_master_9948201" https://your-site.netlify.app/api/v1/systems
    ```
- **Dual-Mode Fallback**: при оффлайн-запуске приложение автоматически включает локальный кэш с эмуляцией проверки `X-API-Key` и JWT!

---

### 📡 Спецификация REST API

| Метод | Эндпоинт | Требуемая авторизация | Описание |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Открытый | Регистрация пользователя в Firebase, выпуск JWT и X-API-Key |
| `POST` | `/api/auth/login` | Открытый | Вход, выдача Firebase JWT токена и X-API-Key |
| `GET` | `/api/auth/me` | `Bearer <JWT>` | Получение данных текущего пользователя |
| `POST` | `/api/keys/generate` | `Bearer <JWT>` | Генерация нового персонального X-API-Key |
| `GET` | `/api/v1/systems` | `X-API-Key` | Список проектируемых систем из Google Cloud Firestore |
| `POST` | `/api/v1/systems` | `X-API-Key` | Добавление новой системы в Firestore |
| `DELETE`| `/api/v1/systems/:id`| `X-API-Key` | Удаление системы по ID из Firestore |
| `GET` | `/api/v1/slides` | `X-API-Key` | Метаданные 26 слайдов |
| `GET` | `/api/v1/stats` | `X-API-Key` | Аудит запросов и метрики базы данных |

---

### 🚀 Развёртывание на Netlify (Инструкция)

#### Шаг 1: Загрузка на GitHub
```bash
git add .
git commit -m "feat: integrate Google Firebase and Netlify functions with X-API-Key guard"
git push origin main
```

#### Шаг 2: Подключение репозитория к Netlify
1. Перейдите на [netlify.com](https://www.netlify.com/) и войдите через GitHub.
2. Нажмите **Add new site** → **Import an existing project** → выберите **GitHub**.
3. Выберите репозиторий `is-presentation-v2`.
4. Параметры сборки подставятся автоматически из `netlify.toml`:
   - **Publish directory**: `.` (корень)
   - **Functions directory**: `netlify/functions`
5. В разделе **Site configuration** → **Environment variables** добавьте переменные:
   - `FIREBASE_PROJECT_ID`: ID вашего проекта в Firebase
   - `FIREBASE_WEB_API_KEY`: Web API Key из настроек Firebase Console
   - `JWT_SECRET`: секретная строка для подписи токенов
6. Нажмите **Deploy site**. Ваш проект будет опубликован за несколько секунд!

---

### 📁 Структура файлов проекта
```text
is-presentation-v2/
├── index.html               # Единый SPA: 26 слайдов, реестр Firestore, API-консоль, JWT-профиль
├── style.css                # Мультиплатформенные стили (Smartboard, Mobile Drawer, Glassmorphism)
├── script.js                # Клиентский движок: SpaRouter, Firebase SDK, JWT-инспектор, API Console
├── presentation.html        # Резервная копия страницы презентации
├── netlify.toml             # Маршрутизация, редиректы и настройка Netlify Functions
├── .env                     # Конфигурация Firebase проекта пользователя
├── netlify/
│   └── functions/
│       ├── common.js        # Валидация X-API-Key и конвертер Firestore документов
│       ├── systems.js       # GET и POST систем с защитой по X-API-Key
│       ├── systems-delete.js# DELETE системы по ID из Firestore
│       ├── auth-login.js    # Вход через Google Firebase Identity Toolkit (JWT)
│       ├── auth-register.js # Регистрация нового пользователя
│       ├── keys-generate.js # Выпуск персональных X-API-Key
│       ├── stats.js         # Метрики архитектурного реестра
│       └── slides.js        # Метаданные слайдов презентации
└── README.md                # Полная документация
```
