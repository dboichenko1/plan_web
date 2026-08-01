# Планировщик

Личный планировщик задач: день — не список, а картина. Задача — плитка на сетке из четырёх колонок: важность задаёт размер, срочность — цвет, состояние — серая плитка или живая. PWA, ставится на домашний экран iPhone, работает офлайн, синхронизируется через Supabase.

## Запуск

```bash
npm install
cp .env.example .env   # вписать URL и publishable-ключ своего проекта Supabase
npm run dev
```

Серверная часть (миграции, RLS, pg_cron, Edge Functions) живёт в отдельном приватном репозитории. Публикуемый ключ Supabase не секрет: вся безопасность держится на политиках RLS.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | разработка |
| `npm run build` | типы + прод-сборка |
| `npm test` | тесты |
| `npm run coverage` | покрытие `src/domain` (порог 100%) |
| `npm run typecheck` | проверка типов |
| `npm run icons` | перегенерировать иконки PWA |

## Хостинг

Cloudflare Pages: сборка `npm run build`, каталог `dist`, переменные окружения `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`.
