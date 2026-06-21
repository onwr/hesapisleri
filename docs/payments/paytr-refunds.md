# PayTR Refunds

Admin endpoint: `POST /api/admin/payments/[id]/refund`

- Yalnız super admin kullanır.
- Sadece başarılı üyelik ödemeleri iade edilebilir.
- Toplam iade tutarı payment amount'u aşamaz.
- PayTR timeout durumunda refund local success sayılmaz; `UNKNOWN` bırakılır.
- Full refund payment durumunu `REFUNDED` yapar.
- Partial refund payment durumunu `PARTIALLY_REFUNDED` yapar.
- Partner komisyonu ters kayıtla düzeltilir; eski earning silinmez.
