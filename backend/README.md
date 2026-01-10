# Backend (Go) — MVP resolve по ссылке t.me/nft/...

Этот backend реализует минимальный эндпоинт:

- `GET /v1/nft/resolve?slug=GiftSlug-371`
- `GET /v1/gifts/supply?period=30d`

Он делает:
1) парсит `slug` → (`giftSlug`, `num`)
2) тянет `id-to-name.json` с `cdn.changes.tg` чтобы получить `giftTitle`
3) тянет список моделей `GET https://api.changes.tg/models/{giftTitle}`
4) **server-side** перебирает модели и пробует `poso.see.tg/api/gifts` с обязательными `title + model_name + num`
5) сохраняет raw JSON в Postgres (таблица `nft_resolve_cache`) как кэш

## Почему так
Ты выяснил, что в `poso` для поиска обязательны `model_name` и `num`, а из ссылки `t.me/nft/...` модель не извлечь. Поэтому resolve делает сервер.

## Запуск локально

### 1) Поднять Postgres

```bash
cd backend
docker compose up -d
```

### 2) Применить миграцию

Любым удобным способом выполнить `backend/migrations/001_init.sql` в БД `gifts`.
Например через `psql`:

```bash
psql "postgres://postgres:pass@localhost:5432/gifts?sslmode=disable" -f migrations/001_init.sql
```

### 3) Запустить API

```bash
export DATABASE_URL="postgres://postgres:pass@localhost:5432/gifts?sslmode=disable"
export POSO_API_BASE="https://poso.see.tg"
export CHANGES_API_BASE="https://api.changes.tg"
export CHANGES_CDN_BASE="https://cdn.changes.tg"
export PORT=8080

go run ./cmd/api
```

Если `poso` всё-таки требует auth в будущем, можно добавить:

```bash
export POSO_TGAUTH="...секрет..."
```

Проверка:

```bash
curl "http://localhost:8080/health"
curl "http://localhost:8080/v1/nft/resolve?slug=KhabibsPapakha-26366"
curl "http://localhost:8080/v1/gifts/supply?gift=KissedFrog"
```

`/v1/gifts/supply` парсит публичную страницу Telegram `t.me/nft/<GiftSlug>-<num>` и вытаскивает строку `Quantity`.

## Подключение фронта

В корне проекта (frontend) добавь:

```bash
VITE_BACKEND_URL="http://localhost:8080"
```

После этого поле “Ссылка на NFT” в модалке будет дергать ваш Go API.

## Следующие шаги (рекомендуется)

- Нормализовать raw JSON в таблицы: `gifts`, `models`, `backdrops`, `patterns`, `owners`, `nft_items`.
- Добавить rate-limit и более умный кэш (Redis).
- Добавить cron/воркер для постепенного наполнения базы.


