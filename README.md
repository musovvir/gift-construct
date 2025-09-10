# Telegram Gift Constructor (React + Vite)

Telegram Mini App для создания подарков с 3x3 сеткой, модальным окном настройки и поддержкой Lottie анимаций.

## 🚀 Быстрый запуск

### Локальная разработка

```bash
# 1. Установка зависимостей
npm install

# 2. Запуск (автоматически запустит прокси + React)
npm run dev

# 3. Открыть http://localhost:5173
```

### Деплой на Vercel

```bash
# 1. Сборка проекта
npm run build

# 2. Деплой на Vercel
# Подключите GitHub репозиторий к Vercel
# Vercel автоматически создаст Vercel Function для проксирования API запросов
```

**✅ Готово к деплою!** Приложение использует Vercel Function для проксирования API запросов, поэтому работает без CORS проблем.

### Деплой на другие хостинги

Для хостингов без поддержки serverless функций (Netlify, GitHub Pages и т.д.) нужно будет использовать внешний CORS-прокси или настроить собственный сервер.

## 📁 Структура проекта

```
constructor-react-v2/
├── src/
│   ├── components/          # React компоненты
│   │   ├── GiftConstructor.jsx  # Главный компонент
│   │   ├── Grid.jsx             # Сетка ячеек
│   │   ├── GridCell.jsx         # Отдельная ячейка
│   │   ├── Modal.jsx            # Модальное окно
│   │   ├── SearchableSelect.jsx # Поисковые селекты
│   │   └── ThemeToggle.jsx      # Переключатель темы
│   ├── hooks/              # API хуки
│   │   └── useApi.js
│   ├── services/           # API сервисы
│   │   └── api.js
│   ├── utils/              # Утилиты
│   │   └── patternUtils.jsx
│   ├── styles/             # Стили
│   │   └── App.css
│   └── contexts/           # React контексты
│       └── ThemeContext.jsx
├── proxy-server.js         # CORS прокси сервер
└── package.json
```

## 🛠️ Локальная разработка

### Установка

```bash
# Клонирование и переход в папку
cd constructor-react-v2

# Установка зависимостей
npm install
```

### Запуск

**Автоматический запуск (рекомендуется):**
```bash
npm run dev
```
Запускает:
- CORS прокси на http://localhost:3001
- React приложение на http://localhost:5173

**Ручной запуск:**
```bash
# Терминал 1: Прокси сервер
node proxy-server.js

# Терминал 2: React приложение
npm run start
```

### Проверка

```bash
# Проверка прокси
curl http://localhost:3001

# Проверка React приложения
curl http://localhost:5173
```

## 🚀 Деплой на хостинг

### Подготовка

```bash
# Сборка проекта
npm run build

# Результат в папке dist/ - готовые статические файлы
ls dist/
```

### Загрузка на хостинг

**Для обычного хостинга (cPanel, FileManager):**

1. Войдите в панель управления хостингом
2. Откройте файловый менеджер
3. Перейдите в папку `public_html` (или `www`, `htdocs`)
4. Загрузите **ВСЕ файлы** из папки `dist/` в корень сайта
5. Убедитесь, что `index.html` находится в корне

**Настройка .htaccess (для Apache):**
Создайте файл `.htaccess` в корне сайта:
```apache
RewriteEngine On
RewriteBase /

# Handle React Router
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# CORS headers
Header add Access-Control-Allow-Origin "*"
Header add Access-Control-Allow-Methods "GET,POST,OPTIONS"
```

### Альтернативные хостинги

**Vercel:**
```bash
npm i -g vercel
vercel login
vercel
```

**Netlify:**
```bash
npm i -g netlify-cli
netlify login
netlify deploy --dir=dist
```

**GitHub Pages:**
```bash
npm install --save-dev gh-pages
npm run build
npx gh-pages -d dist
```

## 🔧 Настройка CORS

### Development
Используется прокси сервер `proxy-server.js` для обхода CORS ограничений.

### Production
Если API поддерживает CORS для вашего домена, измените в `src/services/api.js`:
```javascript
const API_BASE = 'https://api.changes.tg'; // убрать localhost:3001
```

### Serverless функции

**Для Vercel** - создайте `api/proxy.js`:
```javascript
export default async function handler(req, res) {
  const { path } = req.query;
  const apiUrl = `https://api.changes.tg/${path.join('/')}`;
  
  const response = await fetch(apiUrl);
  const data = await response.json();
  
  res.status(200).json(data);
}
```

## 📱 Telegram WebApp

Приложение полностью совместимо с Telegram WebApp:
- Автоматическая инициализация
- Поддержка тем (светлая/темная)
- Haptic Feedback
- Адаптивный дизайн

## 🎨 Особенности

- **React 18** с хуками
- **Vite** для быстрой разработки
- **React Query** для кэширования API
- **Lottie анимации** для подарков
- **Круговые паттерны** с настройкой цветов
- **Поисковые селекты** с фильтрацией
- **Темная/светлая тема**

## 🔧 Решение проблем

### Порты заняты
```bash
# Остановить процессы
pkill -f "vite|node.*proxy"

# Или найти и остановить конкретные
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### API не работает
1. Проверьте прокси: `curl http://localhost:3001`
2. Убедитесь в правильности API_BASE в `src/services/api.js`
3. Проверьте CORS настройки для production

### Сайт не работает на хостинге
1. Убедитесь, что файл `.htaccess` создан
2. Проверьте, что все файлы из `dist/` загружены в корень
3. Откройте DevTools и проверьте 404 ошибки

## 📄 Лицензия

MIT License