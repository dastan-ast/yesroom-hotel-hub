# YesRoom — Self-Hosted Deployment Guide

## Требования

| Компонент | Минимум | Рекомендуемо |
|-----------|---------|--------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Диск | 20 GB SSD | 50 GB SSD |
| Docker | 24+ | latest |
| Docker Compose | v2.20+ | latest |

## Быстрый старт

### 1. Клонируйте репозиторий

```bash
git clone https://github.com/your-org/yesroom.git
cd yesroom
```

### 2. Настройте окружение

```bash
cp .env.example .env
nano .env
```

Обязательно замените:
- `POSTGRES_PASSWORD` — пароль PostgreSQL
- `JWT_SECRET` — минимум 32 символа
- `ANON_KEY` / `SERVICE_ROLE_KEY` — сгенерируйте на [supabase.com/docs/guides/self-hosting#api-keys](https://supabase.com/docs/guides/self-hosting#api-keys)
- `SITE_URL` — ваш домен
- SMTP-настройки для отправки email

### 3. SSL-сертификаты

```bash
mkdir -p docker/nginx/ssl

# Let's Encrypt (certbot)
certbot certonly --standalone -d yesroom.yourdomain.com -d api.yesroom.yourdomain.com

cp /etc/letsencrypt/live/yesroom.yourdomain.com/fullchain.pem docker/nginx/ssl/
cp /etc/letsencrypt/live/yesroom.yourdomain.com/privkey.pem docker/nginx/ssl/
```

### 4. Обновите домены в Nginx

Замените `yesroom.yourdomain.com` на ваш домен в:
- `docker/nginx/conf.d/yesroom.conf`

### 5. Запуск

```bash
docker compose up -d
```

### 6. Проверка

```bash
# Статус всех сервисов
docker compose ps

# Логи
docker compose logs -f

# Проверка API
curl https://api.yesroom.yourdomain.com/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"
```

## Архитектура

```
┌─────────────────────────────────────────────────┐
│                    Nginx :443                    │
│              (SSL + Rate Limiting)               │
├────────────────────┬────────────────────────────┤
│   yesroom.com      │   api.yesroom.com          │
│   ↓                │   ↓                        │
│   Frontend         │   Kong API Gateway :8000   │
│   (Vite static)    │   ├─ /auth/v1 → GoTrue     │
│                    │   ├─ /rest/v1 → PostgREST   │
│                    │   ├─ /realtime → Realtime   │
│                    │   ├─ /storage → Storage     │
│                    │   └─ /functions → Deno      │
├────────────────────┴────────────────────────────┤
│              PostgreSQL :5432                    │
│              Redis :6379 (кэш/очереди)          │
└─────────────────────────────────────────────────┘
```

## Бэкапы

```bash
# Дамп БД
docker exec yesroom-db pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# Восстановление
cat backup.sql | docker exec -i yesroom-db psql -U postgres postgres
```

## Обновление

```bash
git pull
docker compose build frontend
docker compose up -d
```

## Мониторинг

```bash
# Redis статус
docker exec yesroom-redis redis-cli -a $REDIS_PASSWORD info stats

# Активные подключения к БД
docker exec yesroom-db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

## Платформы развёртывания

| Платформа | Совместимость |
|-----------|--------------|
| Coolify | ✅ Полная |
| CapRover | ✅ Полная |
| Portainer | ✅ Полная |
| OpenCloud | ✅ Docker Compose |
| Hetzner | ✅ VPS + Docker |
| DigitalOcean | ✅ Droplet + Docker |
