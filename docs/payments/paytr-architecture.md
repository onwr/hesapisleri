# PayTR Payment Architecture

Hesap İşleri PayTR entegrasyonu mevcut `MembershipPlan`, `CompanySubscription` ve `MembershipPayment` modellerini genişletir. Yeni generic `Payment` veya ikinci subscription sistemi yoktur.

## Source Of Truth

- İlk ödeme ve renewal kayıtları `MembershipPayment` üzerinde tutulur.
- Üyelik erişimi `CompanySubscription` state machine ile yönetilir.
- Frontend success/fail URL ödeme kanıtı değildir.
- Üyelik yalnız geçerli PayTR callback hash'i, doğru `merchantOid`, tutar, currency ve idempotent DB transaction sonrasında aktive edilir.

## Katmanlar

- Billing domain: period, subscription, auto-renew, retry, grace.
- Payment domain: payment attempt, methods, refunds, reconciliation.
- Provider adapter: PayTR hash, Direct API form, callback, recurring, status query, refund.

## Güvenlik

- Kart formu doğrudan PayTR'a POST edilir.
- PAN/CVV backend'e gönderilmez ve saklanmaz.
- `utoken`/`ctoken` encrypted tutulur.
- Callback public route'tur ve session kullanmaz.
