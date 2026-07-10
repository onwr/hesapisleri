# nginx Production Güvenlik Ayarları

Bu repo nginx config'i içermez — nginx sunucu üzerinde ayrı olarak yönetilir.
Bu doküman, uygulama kodunun (özellikle `lib/payments/trusted-client-ip.ts`
ve `lib/auth/auth-rate-limit-service.ts`) doğru çalışması için nginx
tarafında yapılması gereken ayarları ve doğrulama komutlarını içerir.

**Durum:** Kod tarafı hazır; aşağıdaki operasyon adımları production sunucuda
manuel uygulanmayı bekliyor.

## 1. `server_tokens off;`

nginx sürüm bilgisinin HTTP yanıt header'larında ve hata sayfalarında
görünmesini engeller (bilinen sürüm açıklarının hedef alınmasını zorlaştırır).

`http {}` bloğuna ekleyin (tüm server bloklarını kapsar):

```nginx
http {
    server_tokens off;
    ...
}
```

### Operasyon adımları (production)

**1. Yedek alın**

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.$(date +%F-%H%M%S)
```

**2. `http {}` bloğuna ekleyin**

```bash
sudo nano /etc/nginx/nginx.conf
# http {} bloğunun içine şu satırı ekleyin:
# server_tokens off;
```

**3. Yapılandırmayı doğrulayın**

```bash
sudo nginx -t
```

Beklenen çıktı: `syntax is ok` / `test is successful`

**4. Reload**

```bash
sudo systemctl reload nginx
```

**5. Header kontrolü**

```bash
curl -I https://hesapisleri.com
curl -I https://hesapisleri.com/olmayan-sayfa
```

Beklenen: `Server` header'ında sürüm numarası görünmemeli (`nginx/1.24.0` gibi
değil; çoğu kurulumda yalnızca `nginx` görünür).

**Notlar**

- `server_tokens off` yalnızca sürüm bilgisini gizler; `Server` header'ını
  tamamen kaldırmayabilir.
- `nginx-extras` kurmayın; header'ı tamamen kaldırmak bu fazın kapsamı dışındadır.
- Tam `nginx.conf` dosyasını ezme; yalnızca `server_tokens off;` satırını ekleyin.

## 2. Client IP forwarding (trusted proxy)

`lib/payments/trusted-client-ip.ts`, login/forgot-password rate limiting ve
ödeme akışları için gerçek istemci IP'sini bu header'lardan çözer:

- `X-Real-IP` — **birincil kaynak**. nginx bu header'ı doğrudan ayarlar
  (append değil, overwrite) — istemci bu değeri sahtekarlıkla değiştiremez.
- `X-Forwarded-For` — yalnız fallback. nginx `$proxy_add_x_forwarded_for`
  kullanıyorsa istemcinin gönderdiği değere EKLEME yapılır; uygulama bu
  yüzden dizinin **son** elemanını (nginx'in eklediği) kullanır, ilk elemanı
  DEĞİL (ilk eleman istemci tarafından uydurulmuş olabilir).

Her `server`/`location` bloğunda (proxy_pass kullanılan yerlerde) şunlar
MUTLAKA bulunmalı:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Bu ayarlar eksikse (veya nginx önünde başka bir CDN/proxy varsa ve o katman
kendi IP'sini eklemiyorsa) rate limiting ve fraud/audit loglarındaki IP
bilgisi yanlış olabilir.

## 3. Kontrol / test komutları

Değişiklik sonrası sırayla:

```bash
sudo nginx -t
```

Sözdizimi hatasızsa (`syntax is ok` / `test is successful`):

```bash
sudo systemctl reload nginx
```

Ardından gerçek yanıt header'larını doğrulayın (`Server` header'ında sürüm
numarası GÖRÜNMEMELİ, yalnız `nginx` yazmalı, `nginx/1.24.0` gibi versiyon
içermemeli):

```bash
curl -I https://hesapisleri.com
curl -I https://hesapisleri.com/olmayan-sayfa
```

Beklenen çıktı örneği:

```
HTTP/2 200
server: nginx
...
```

(`server: nginx/1.24.0 (Ubuntu)` gibi bir satır görürseniz `server_tokens off;`
henüz etkili olmamış demektir — yedek, `nginx -t` ve `reload` adımlarını
tekrar kontrol edin.)

## Kapsam dışı

Bu doküman yalnız `server_tokens` ve client-IP forwarding'i kapsar. TLS/SSL
sertifika yönetimi, rate-limiting (nginx seviyesinde — uygulama seviyesinde
zaten `AuthRateLimit` ile yapılıyor), veya CDN/WAF yapılandırması bu
dokümanın kapsamı dışındadır.
