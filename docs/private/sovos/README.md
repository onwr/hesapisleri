# Sovos özel dokümanları

Bu klasör **Git'e commit edilmez**. Sovos WSDL/ZIP ve müşteriye özel materyaller buraya konur.

## Manuel indirme

Aşağıdaki dosyaları Sovos Developer Portal'dan indirip bu klasöre koyun:

| Dosya adı (önerilen) | Kaynak |
|----------------------|--------|
| `sovos-e-fatura-ws-api-v2.3.zip` | https://api.fitbulut.com/servis/assets/docs/Sovos%20Bulut%20e-Fatura%20WS%20API%20v2.3.zip |
| `sovos-e-arsiv-ws-api-v2.3.zip` | https://api.fitbulut.com/servis/assets/docs/Sovos%20Bulut%20e-Ar%C5%9Fiv%20Fatura%20WS%20API%20v2.3.zip |
| `sovos-e-irsaliye-ws-api-v1.3.zip` | https://api.fitbulut.com/servis/assets/docs/Sovos%20Bulut%20e-%C4%B0rsaliye%20WS%20API%20v1.3.zip |
| `sovos-ubl-tr-catalogue.xlsx` | https://api.fitbulut.com/servis/assets/docs/Sovos%20R%26D%20-%20UBL-TR%20Catalogue.xlsx |
| `sovos-faq.xlsx` | https://api.fitbulut.com/servis/assets/docs/Sovos%20R%26D%20-S%C4%B1k%20Sorulan%20Sorular.xlsx |

GİB UBL paketleri (opsiyonel, XSD doğrulama için):

- https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/UBL-TR1.2.1_Paketi.zip
- https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-FaturaPaketi.zip

## Otomatik indirme

```bash
cd web
npx tsx scripts/sovos/fetch-sovos-docs.ts
```

## WSDL manifest üretimi

ZIP'ler yerleştirildikten sonra:

```bash
npx tsx scripts/sovos/inspect-sovos-contracts.ts
```

Çıktı: `generated/sovos-contract-manifest.json`

Credential veya müşteri bilgisi bu dosyalara yazılmamalıdır.
