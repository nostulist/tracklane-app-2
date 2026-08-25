# Tracklane

Личный трекер (привычки, время, тренировки, задачи, финансы) как отдельный сайт
с авторизацией через Supabase.

## Локальный запуск

```bash
npm install
cp .env.example .env   # вставь туда свои ключи из Supabase
npm run dev
```

## Что нужно сделать один раз перед первым запуском

1. Создать проект на supabase.com.
2. Открыть SQL Editor и выполнить содержимое файла `schema.sql`.
3. Скопировать Project URL и anon public key (Settings → API) в `.env`.

## Деплой

Залей проект в приватный репозиторий на GitHub, подключи к Vercel/Netlify
и добавь там те же две переменные окружения (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) в настройках проекта — по кнопке, не в код.
