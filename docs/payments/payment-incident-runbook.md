# Payment Incident Runbook

## Callback Gelmezse

`WAIT_CALLBACK` ödemeler için `POST /api/cron/payment-reconciliation` çalıştırılır. PayTR status query sonucu amount/currency eşleşirse manuel reconcile yapılabilir.

## Payment UNKNOWN Kalırsa

Yeni charge gönderilmez. Önce status query yapılır. Provider sonucu kesinleşmeden retry yapılmaz.

## Çift Ödeme Şüphesi

`merchantOid`, `SubscriptionBillingRun(subscriptionId, periodStart)` ve PayTR panel kayıtları karşılaştırılır.

## Refund Takılırsa

`PaymentRefund.status=UNKNOWN|PROCESSING` kayıtları provider iade sonucu ile karşılaştırılır. Aynı `referenceNo` ile kör tekrar gönderilmez.

## Secret Sızıntısı

PayTR merchant key/salt rotate edilir, `PAYMENT_TOKEN_ENCRYPTION_KEY` rotasyonu planlı migration ile yapılır, callback invalid hash alarmı takip edilir.
