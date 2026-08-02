# Планировщик

Личный планировщик задач: день — не список, а картина. Задача — плитка на сетке из четырёх колонок: важность задаёт размер, срочность — цвет, состояние — серая плитка или живая. PWA, ставится на домашний экран iPhone, работает офлайн, синхронизируется через Supabase.

## Запуск

```bash
npm install
cp .env.example .env   # вписать URL и publishable-ключ своего проекта Supabase
npm run dev
```

Серверная часть (миграции, RLS, pg_cron, Edge Functions) живёт отдельно. Публикуемый ключ Supabase не секрет: вся безопасность держится на политиках RLS.

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

GitHub Pages: пуш в `main` собирает и выкатывает страницу (`.github/workflows/pages.yml`).
Настройка один раз: Settings → Pages → Source: «GitHub Actions»; Settings → Secrets and
variables → Actions → Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_VAPID_PUBLIC_KEY` (публичные значения). Страница живёт на
`https://<ник>.github.io/<репозиторий>/` — приложение собрано под подпуть
(`BASE_PATH`), с корнем или своим доменом тоже работает.
