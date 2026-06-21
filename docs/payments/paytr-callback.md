# PayTR Callback

Endpoint: `POST /api/payments/paytr/callback`

- Public route'tur.
- Login/session/tenant guard kullanmaz.
- `application/x-www-form-urlencoded` body parse eder.
- PayTR HMAC hash `timingSafeEqual` ile doğrulanır.
- `merchant_oid` ile local `MembershipPayment` bulunur.
- Amount ve currency local snapshot ile eşleşmelidir.
- Duplicate callback `PaymentWebhookEvent.eventKey` ile idempotent işlenir.
- Başarılı cevap yalnız `OK` text response olmalıdır.

Success/fail redirect sayfaları üyelik güncellemez.
