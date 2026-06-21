# PayTR Environment

Server-only değişkenler:

- `PAYTR_MERCHANT_ID`
- `PAYTR_MERCHANT_KEY`
- `PAYTR_MERCHANT_SALT`
- `PAYTR_TEST_MODE`
- `PAYTR_DIRECT_API_ENABLED`
- `PAYTR_CARD_STORAGE_ENABLED`
- `PAYTR_RECURRING_ENABLED`
- `PAYTR_NON3D_ENABLED`
- `PAYTR_CALLBACK_URL`
- `PAYTR_OK_URL`
- `PAYTR_FAIL_URL`
- `APP_URL`
- `CRON_SECRET`
- `PAYMENT_TOKEN_ENCRYPTION_KEY`

Production ortamında PayTR secret değerleri ve `APP_URL` eksikse ödeme başlatma fail eder. Recurring/Non3D yetkisi kapalıysa otomatik yenileme açık başarı üretmez; kullanıcıya yetki bekleniyor mesajı gösterilir.
