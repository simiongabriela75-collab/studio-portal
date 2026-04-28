# Studio Portal — Инструкция по деплою

## Шаг 1 — Firebase (5 минут)

1. Зайди на https://firebase.google.com → "Get started"
2. Создай новый проект (название: studio-portal)
3. Левое меню → **Firestore Database** → Create database → Start in **test mode** → Next
4. Левое меню → **Project settings** (шестерёнка) → "Your apps" → иконка </> (Web)
5. Назови приложение "studio-portal" → Register app
6. Скопируй объект `firebaseConfig` — он выглядит так:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "studio-portal-xxxxx.firebaseapp.com",
  projectId: "studio-portal-xxxxx",
  storageBucket: "studio-portal-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

7. Открой файл `src/firebase.js` и замени значения в `firebaseConfig` на свои

---

## Шаг 2 — GitHub (3 минуты)

1. Зайди на https://github.com → New repository
2. Назови репозиторий: `studio-portal`
3. Загрузи все файлы проекта:
```bash
cd studio-portal
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ТВОЙusername/studio-portal.git
git push -u origin main
```

---

## Шаг 3 — Vercel (2 минуты)

1. Зайди на https://vercel.com → Sign up with GitHub
2. "Add New Project" → Import твой репозиторий `studio-portal`
3. Framework Preset: **Vite**
4. Нажми **Deploy**
5. Через 1 минуту твой сайт доступен по адресу: `studio-portal.vercel.app`

---

## Готово! Как использовать

### Дизайнер:
- Открывает `studio-portal.vercel.app`
- Создаёт проект, заполняет данные
- Нажимает "📋 Скопировать ссылку" → отправляет клиенту

### Клиент:
- Получает ссылку вида `studio-portal.vercel.app/project/proj_xxx`
- Видит все этапы, рендеры
- Одобряет рендеры, оставляет комментарии и правки
- Дизайнер видит изменения в РЕАЛЬНОМ ВРЕМЕНИ (без перезагрузки)

---

## Структура файлов

```
studio-portal/
├── src/
│   ├── App.jsx          ← весь UI (дизайнер + клиент)
│   ├── firebase.js      ← конфиг и хелперы Firebase
│   └── main.jsx         ← точка входа React
├── index.html
├── package.json
├── vite.config.js
└── vercel.json          ← роутинг для SPA
```

---

## Как добавить рендер из Google Drive

1. Загрузи фото на Google Drive
2. Правая кнопка на файл → "Поделиться" → "Открыть доступ" → "Все у кого есть ссылка"
3. Скопируй ссылку, найди в ней ID файла (между /d/ и /view):
   `https://drive.google.com/file/d/ЭТОТ_ID/view`
4. Создай прямую ссылку на изображение:
   `https://drive.google.com/uc?export=view&id=ЭТОТ_ID`
5. Вставь эту ссылку в поле "Ссылка на изображение"
