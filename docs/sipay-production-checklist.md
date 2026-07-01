# Sipay Production Readiness Checklist

Bu liste secret değerleri içermez. Production cutover öncesi operasyon ekibi tarafından işaretlenmelidir.

## Merchant ve panel

- [ ] Sipay merchant credential'ları production secret store'da
- [ ] Sipay panelde webhook URL: `https://<domain>/api/webhooks/sipay`
- [ ] `sale_web_hook_key` env ile eşleşiyor
- [ ] Return URL: `https://<domain>/api/billing/sipay/return`
- [ ] Cancel URL: `https://<domain>/api/billing/sipay/cancel`
- [ ] Production domain tamamı HTTPS

## Uygulama config

- [ ] `BILLING_PAYMENT_PROVIDER=SIPAY` yalnız sandbox doğrulaması sonrası
- [ ] `SIPAY_ENABLED=true`
- [ ] `SIPAY_ENV=live`
- [ ] `SIPAY_BASE_URL` → `https://app.sipay.com.tr`
- [ ] Startup validation hatasız (`instrumentation.ts`)
- [ ] PayTR historical callback route'ları aktif kalıyor

## Altyapı

- [ ] Redis (`REDIS_URL` veya `SIPAY_TOKEN_REDIS_URL`) multi-instance token cache için
- [ ] Webhook rate limit gözlemleniyor
- [ ] CSP checkout redirect allowlist doğrulandı
- [ ] Observability: webhook quarantine, finalize duplicate, token refresh metrikleri
- [ ] Alerting: checkstatus unavailable, webhook 5xx, refund UNKNOWN

## Test ve doğrulama

- [ ] Sandbox: `SIPAY_SANDBOX_TEST=1 npm run test:sipay-sandbox`
- [ ] Manuel sandbox ödeme + `--check <invoice-id>`
- [ ] Refund opsiyonel: `--refund <invoice-id> <amount>` (opt-in env)
- [ ] Webhook replay testi
- [ ] DB integration concurrency testleri geçti

## Güvenlik ve operasyon

- [ ] Secret rotation planı (APP_SECRET, webhook key)
- [ ] PayTR fallback planı (provider switch + historical data)
- [ ] Rollback planı: `BILLING_PAYMENT_PROVIDER=PAYTR`
- [ ] Kart verisi log/DB/ActivityLog'da yok
