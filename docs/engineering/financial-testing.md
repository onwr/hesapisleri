# Finansal Modül Test Standardı

Finansal hesaplama veya kayıt akışı değiştirildiğinde unit test yazılmadan iş tamamlanmış kabul edilmez.

## Kapsam

- Satış, POS checkout, fatura, KDV, indirim, tahsilat
- Gider, kasa-banka, hesap transferi
- Çalışan ödemesi, bordro, üyelik ödemesi
- Partner komisyonu, iade/değişim
- Döviz kuru kullanılan hesaplamalar
- Rapor toplamları

## Her değişiklikte minimum test seti

1. Normal senaryo
2. Sıfır değer
3. Negatif / geçersiz input
4. Decimal yuvarlama
5. Tenant izolasyonu (companyId scope)
6. Transaction rollback veya idempotency
7. Eski kayıtların korunması
8. Cache invalidation (varsa)

## Kurallar

- Hesaplama mantığı React component içinde tutulmaz; saf helper/service fonksiyonuna ayrılır.
- Finansal modülde başarısız test varken merge/deploy yapılmaz.
- `npm run verify` yeşil olmalıdır.

## Komutlar

```bash
npm test
npx tsc --noEmit
npx next build
npm run verify
```
