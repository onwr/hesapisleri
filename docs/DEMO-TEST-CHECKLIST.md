# Hesapişleri — Uçtan Uca Demo Test Checklist

**Demo giriş:** `owner@demo.com` / `123456`  
**Diğer kullanıcılar:** `muhasebe@demo.com`, `personel@demo.com` (şifre: `123456`)  
**Super Admin:** `superadmin@hesapisleri.com` / `123456`

**Otomatik kontroller:** `npm run test:demo`  
**Ön koşul:** `npm run seed:demo` çalıştırılmış olmalı.

Etiketler:
- `[AUTO]` — `test-demo-flow.ts` ile otomatik doğrulanır
- `[MANUEL]` — Tarayıcıda elle test edilir

---

## 0. Hazırlık

- [ ] `[AUTO]` Demo seed script hatasız tamamlandı
- [ ] `[MANUEL]` `npm run dev` çalışıyor (`http://localhost:3000`)
- [ ] `[MANUEL]` Tarayıcıda önbellek temiz / gizli sekme kullanıldı

---

## 1. Login

| # | Kontrol | Tip |
|---|---------|-----|
| 1.1 | `owner@demo.com` / `123456` ile giriş başarılı | `[AUTO]` + `[MANUEL]` |
| 1.2 | Başarılı giriş sonrası `/dashboard` yönlenmesi | `[MANUEL]` |
| 1.3 | Hatalı şifrede uyarı mesajı | `[MANUEL]` |
| 1.4 | Çıkış sonrası korumalı sayfalara erişim engeli | `[MANUEL]` |

---

## 2. Dashboard

| # | Kontrol | Tip |
|---|---------|-----|
| 2.1 | Bugün / ay satış kartları > 0 veya anlamlı | `[AUTO]` |
| 2.2 | Gelir / gider / kâr kartları dolu | `[AUTO]` |
| 2.3 | Bekleyen tahsilat / vadesi geçen tutar görünür | `[AUTO]` |
| 2.4 | Kasa & banka toplam bakiye > 0 | `[AUTO]` |
| 2.5 | Aylık satış grafiği en az 1 veri noktası | `[MANUEL]` |
| 2.6 | Gelir-gider grafiği boş değil | `[MANUEL]` |
| 2.7 | Son işlemler listesi dolu | `[MANUEL]` |
| 2.8 | Banka hesapları kartı listeleniyor | `[MANUEL]` |
| 2.9 | Yaklaşan ödemeler bölümü | `[MANUEL]` |
| 2.10 | AI öngörü kartı metin içeriyor | `[MANUEL]` |

---

## 3. POS / Hızlı Satış

| # | Kontrol | Tip |
|---|---------|-----|
| 3.1 | Ürün grid'i dolu (≥ 20 aktif ürün) | `[AUTO]` |
| 3.2 | Kategori filtresi ürünleri daraltıyor | `[MANUEL]` |
| 3.3 | Arama kutusu SKU / ürün adı buluyor | `[MANUEL]` |
| 3.4 | Barkod alanı ile ürün ekleme | `[MANUEL]` |
| 3.5 | Sepete ürün ekleme / adet artırma | `[MANUEL]` |
| 3.6 | Stoktan fazla satış engelleniyor | `[AUTO]` + `[MANUEL]` |
| 3.7 | Nakit PAID satış → kasa bakiyesi artıyor | `[MANUEL]` |
| 3.8 | Veresiye UNPAID satış → müşteri cari artıyor | `[MANUEL]` |
| 3.9 | Kısmi ödeme (PARTIAL) akışı | `[MANUEL]` |

---

## 4. Satışlar

| # | Kontrol | Tip |
|---|---------|-----|
| 4.1 | Satış listesi dolu (≥ 20 kayıt) | `[AUTO]` |
| 4.2 | Satış detay sayfası açılıyor | `[MANUEL]` |
| 4.3 | UNPAID satışta tahsilat alınabiliyor | `[MANUEL]` |
| 4.4 | Tahsilat sonrası `paidAmount` ve kasa güncelleniyor | `[MANUEL]` |
| 4.5 | Satış iptali stok / cari / kasayı geri alıyor | `[MANUEL]` |
| 4.6 | Teklifler sekmesi DRAFT kayıtları gösteriyor | `[AUTO]` + `[MANUEL]` |
| 4.7 | Teklif `T-` ile başlıyor | `[AUTO]` |

---

## 5. Teklifler

| # | Kontrol | Tip |
|---|---------|-----|
| 5.1 | Teklif detay sayfası açılıyor | `[MANUEL]` |
| 5.2 | Teklif → satışa dönüştürme başarılı | `[MANUEL]` |
| 5.3 | Dönüşümde stok düşüyor | `[MANUEL]` |
| 5.4 | Dönüşümde cari / kasa doğru güncelleniyor | `[MANUEL]` |
| 5.5 | Teklif iptali stok/cari etkilemiyor | `[MANUEL]` |

---

## 6. Müşteriler

| # | Kontrol | Tip |
|---|---------|-----|
| 6.1 | Müşteri listesi dolu (≥ 20) | `[AUTO]` |
| 6.2 | Borçlu müşteri (balance > 0) mevcut | `[AUTO]` |
| 6.3 | Alacaklı müşteri (balance < 0) mevcut | `[AUTO]` |
| 6.4 | Borçlu / alacaklı filtreleri çalışıyor | `[MANUEL]` |
| 6.5 | Müşteri detayında cari bakiye doğru | `[MANUEL]` |
| 6.6 | Satış / fatura / hareket geçmişi görünüyor | `[MANUEL]` |
| 6.7 | Gruplar sayfası müşteri sayıları doğru | `[MANUEL]` |
| 6.8 | Toplu işlemler: telefon kopyalama | `[MANUEL]` |
| 6.9 | Toplu işlemler: e-posta kopyalama | `[MANUEL]` |
| 6.10 | Toplu işlemler: CSV export indiriliyor | `[MANUEL]` |

---

## 7. Ürünler & Stok

| # | Kontrol | Tip |
|---|---------|-----|
| 7.1 | Ürün listesi dolu (≥ 30) | `[AUTO]` |
| 7.2 | DEMO SKU prefix'li ürünler listeleniyor | `[AUTO]` |
| 7.3 | Düşük stok filtresi sonuç döndürüyor | `[AUTO]` + `[MANUEL]` |
| 7.4 | Ürün detayında son satışlar görünüyor | `[MANUEL]` |
| 7.5 | Stok hareketleri listeleniyor | `[MANUEL]` |
| 7.6 | Manuel stok hareketi (IN/OUT) eklenebiliyor | `[MANUEL]` |
| 7.7 | Kategori yönetimi istatistikleri tutarlı | `[MANUEL]` |

---

## 8. Faturalar

| # | Kontrol | Tip |
|---|---------|-----|
| 8.1 | Fatura listesi dolu (≥ 10) | `[AUTO]` |
| 8.2 | Tahsil edilen / kalan sütunları mantıklı | `[MANUEL]` |
| 8.3 | Fatura detayında tahsilat formu | `[MANUEL]` |
| 8.4 | Tahsilat sonrası `paidAmount` ve kasa artıyor | `[MANUEL]` |
| 8.5 | Tahsilatlı fatura iptali engelleniyor | `[MANUEL]` |
| 8.6 | PAID / PARTIAL / UNPAID karışık kayıtlar | `[AUTO]` |

---

## 9. Giderler

| # | Kontrol | Tip |
|---|---------|-----|
| 9.1 | PAID ve UNPAID giderler listeleniyor | `[AUTO]` |
| 9.2 | UNPAID gider ödenebiliyor | `[MANUEL]` |
| 9.3 | Ödeme sonrası kasa düşüyor | `[MANUEL]` |
| 9.4 | PAID giderde tutar değişimi engelleniyor | `[MANUEL]` |
| 9.5 | PAID giderde hesap değişimi engelleniyor | `[MANUEL]` |
| 9.6 | Gider iptali PAID ise kasa iadesi | `[MANUEL]` |

---

## 10. Kasa & Banka

| # | Kontrol | Tip |
|---|---------|-----|
| 10.1 | 4 hesap listeleniyor (1 kasa + 3 banka) | `[AUTO]` |
| 10.2 | Hesap detayında hareketler görünüyor | `[MANUEL]` |
| 10.3 | Hesaplar arası transfer çalışıyor | `[MANUEL]` |
| 10.4 | Transfer sonrası kaynak azalıp hedef artıyor | `[MANUEL]` |
| 10.5 | CSV export indiriliyor | `[MANUEL]` |
| 10.6 | Transfer gelir/gider rapor toplamına dahil değil | `[AUTO]` + `[MANUEL]` |

---

## 11. Raporlar

| # | Kontrol | Tip |
|---|---------|-----|
| 11.1 | Gelir / gider özeti > 0 | `[AUTO]` |
| 11.2 | Gelir-gider grafiği dolu | `[MANUEL]` |
| 11.3 | Transferler gelir/gider sayılmıyor | `[AUTO]` |
| 11.4 | Satış cirosu ile nakit girişi ayrımı | `[MANUEL]` |
| 11.5 | CSV export çalışıyor | `[MANUEL]` |

---

## 12. AI Asistan

| # | Kontrol | Tip |
|---|---------|-----|
| 12.1 | Metrik kartları dolu | `[AUTO]` |
| 12.2 | Karşılama mesajı anlamlı (nakit/tahsilat içerir) | `[AUTO]` |
| 12.3 | "Nakit akışı" sorusuna yanıt üretiliyor | `[AUTO]` |
| 12.4 | "Stok riski" sorusuna yanıt üretiliyor | `[AUTO]` |
| 12.5 | Finans / tahsilat / stok / gider sekmeleri | `[MANUEL]` |
| 12.6 | Hızlı soru butonları çalışıyor | `[MANUEL]` |

---

## 13. Ayarlar

| # | Kontrol | Tip |
|---|---------|-----|
| 13.1 | Firma bilgileri dolu (Örnek Ticaret) | `[AUTO]` |
| 13.2 | Fatura ayarları kaydedilebiliyor | `[MANUEL]` |
| 13.3 | Kasa/banka varsayılan hesapları kaydedilebiliyor | `[MANUEL]` |
| 13.4 | OWNER: Kullanıcı ve rol paneli görünür | `[MANUEL]` |
| 13.5 | Davet gönderme / rol değiştirme | `[MANUEL]` |
| 13.6 | STAFF: Kullanıcı yönetimi menüsü gizli | `[AUTO]` + `[MANUEL]` |
| 13.7 | ACCOUNTANT: Kullanıcı yönetimi menüsü gizli | `[AUTO]` + `[MANUEL]` |

---

## 14. RBAC (Rol Bazlı Erişim)

### muhasebe@demo.com

| # | Kontrol | Tip |
|---|---------|-----|
| 14.1 | `/pos` → yetkisiz / yönlendirme | `[MANUEL]` |
| 14.2 | Sidebar'da POS menüsü yok | `[AUTO]` + `[MANUEL]` |
| 14.3 | `/cash-bank`, `/invoices`, `/reports` erişilebilir | `[MANUEL]` |
| 14.4 | POS API 403 döner | `[AUTO]` (sunucu açıksa) |
| 14.5 | Kasa API erişimi var | `[AUTO]` (sunucu açıksa) |

### personel@demo.com

| # | Kontrol | Tip |
|---|---------|-----|
| 14.6 | `/pos` erişilebilir | `[MANUEL]` |
| 14.7 | Sidebar'da POS menüsü var | `[AUTO]` + `[MANUEL]` |
| 14.8 | `/cash-bank`, `/reports` engellenir | `[MANUEL]` |
| 14.9 | Kasa transfer API 403 döner (`/api/cash-bank/transfer`) | `[AUTO]` (sunucu açıksa) |
| 14.10 | POS checkout API erişimi var | `[AUTO]` (sunucu açıksa) |

---

## 15. Super Admin

| # | Kontrol | Tip |
|---|---------|-----|
| 15.1 | `superadmin@hesapisleri.com` → `/admin` yönlenmesi | `[MANUEL]` |
| 15.2 | Platform metrik kartları dolu | `[MANUEL]` |
| 15.3 | Demo firma listede (`Örnek Ticaret`) | `[AUTO]` |
| 15.4 | Firma detay sayfası açılıyor | `[MANUEL]` |
| 15.5 | Kullanıcılar listesi dolu | `[AUTO]` |
| 15.6 | Admin API yetkisiz kullanıcıya 403 | `[AUTO]` (sunucu açıksa) |

---

## Manuel Test Listesi (tarayıcıda)

Aşağıdaki akışlar otomatik script ile doğrulanamaz; demo sunumundan önce tek tek işaretleyin:

1. **Login** — Dashboard yönlendirme, hatalı şifre, çıkış
2. **Dashboard** — Grafikler, son işlemler, banka kartları, AI öngörü
3. **POS** — Kategori/arama/barkod, sepet, nakit & veresiye satış, kasa/cari artışı
4. **Satışlar** — Detay, tahsilat, iptal (stok/cari/kasa geri alımı), teklifler sekmesi
5. **Teklifler** — Detay, satışa dönüştürme, stok/cari/kasa doğrulama
6. **Müşteriler** — Borçlu/alacaklı filtre, detay bakiye, gruplar, toplu export
7. **Ürünler** — Düşük stok filtresi UI, detay satış/stok hareketleri, stok girişi
8. **Faturalar** — Tahsilat formu, paidAmount/kasa güncelleme, tahsilatlı iptal engeli
9. **Giderler** — UNPAID ödeme, PAID düzenleme engeli, iptal iadesi
10. **Kasa & Banka** — Transfer, CSV export, hesap detay hareketleri
11. **Raporlar** — Grafikler, satış cirosu vs nakit ayrımı, CSV export
12. **AI Asistan** — Sekmeler, hızlı soru butonları
13. **Ayarlar** — Kaydetme, kullanıcı daveti, STAFF/ACCOUNTANT gizleme (UI)
14. **RBAC** — `/pos`, `/cash-bank`, `/reports` sayfa erişimleri (3 kullanıcı)
15. **Super Admin** — `/admin` dashboard, firma detay, kullanıcı listesi

---

## Canlı Demo Hazırlık Raporu

### Son otomatik test (2026-06-04)

```
Tarih: 2026-06-04
Otomatik test: PASS (npm run test:demo — 65/65)
Manuel test tamamlanma: bekliyor

Canlı demo hazır mı?  KISMİ (otomatik OK, manuel UI bekliyor)

Otomatik doğrulananlar:
- Demo veri sayıları (müşteri, ürün, satış, teklif, fatura, gider)
- Giriş şifreleri (4 kullanıcı)
- Dashboard metrikleri ve finans toplamları
- Stok aşımı engeli, AI yanıtları
- RBAC izinleri ve sidebar menüleri
- Super Admin veri listesi
- HTTP API (sunucu açıksa): login, RBAC 403, admin overview

Manuel doğrulama gerekenler:
- UI grafikleri ve formlar
- POS ödeme akışları
- İptal / dönüşüm / transfer / export işlemleri
- Ayarlar kaydetme ve davet
```

### Şablon (manuel test sonrası doldurun)

```
Tarih:
Test eden:
Otomatik test: PASS / FAIL (npm run test:demo)
Manuel test tamamlanma: ___%

Canlı demo hazır mı?  EVET / HAYIR / KISMİ

Eksikler / notlar:
-
-
```

---

## Hızlı komutlar

```powershell
# Demo veriyi yükle
npm run seed:demo

# Otomatik kontroller
npm run test:demo

# Birim testler
npm test

# Derleme
npm run build
```
