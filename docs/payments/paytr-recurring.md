# PayTR Recurring

Recurring charge akışı:

1. `CompanySubscription.nextBillingAt <= now` abonelikler bulunur.
2. `autoRenew=true` ve default aktif kart gerekir.
3. `SubscriptionBillingRun` unique `(subscriptionId, periodStart)` ile oluşturulur.
4. Yeni `MembershipPayment` ve yeni `merchantOid` oluşturulur.
5. `utoken`/`ctoken` decrypt edilerek PayTR recurring request gönderilir.
6. PayTR response `success` veya `wait_callback` ise subscription uzatılmaz; callback beklenir.
7. Network timeout `UNKNOWN` yapılır ve status query/reconciliation ile çözülür.

Aynı dönem için ikinci charge gönderilmemelidir.
