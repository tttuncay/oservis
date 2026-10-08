# Projeyi kendi makinenizde çalıştırma

Bu doküman, ServisApp'i sıfırdan ayağa kaldırıp yönetim paneline giriş yapmanız için
gereken adımları anlatır. `README.md` kurulumu özetler; buradaki fark, gerçekten
takıldığınız yerlerin (Docker, port çakışması, giriş yapacak hesabın olmaması) çözümünün
de yazıyor olması.

> Diğer `docs/` dosyaları İngilizcedir; bu dosya günlük kullanım rehberi olduğu için
> Türkçe yazılmıştır.

---

## 1. Gereksinimler

| Araç | Sürüm | Kontrol |
|---|---|---|
| Node.js | 22 LTS | `node -v` → `v22.x` |
| pnpm | 9.x | `pnpm -v` → `9.x` (yoksa: `corepack enable pnpm`) |
| Docker Desktop | güncel | `docker info` hata vermemeli |

Docker Desktop'ın **kurulu olması yetmez, çalışıyor olması gerekir.** Windows'ta
başlangıçta otomatik açılmıyorsa her oturumda elle başlatmanız gerekir — en sık
karşılaşılan hata bu.

---

## 2. İlk kurulum (yalnızca bir kez)

```bash
# 1. Bağımlılıklar
pnpm install

# 2. Ortam dosyası
cp .env.example .env
```

`.env.example` Redis için `6379` verir. Windows'ta bu port çoğu zaman Hyper-V tarafından
rezerve edilmiştir; kopyaladıktan sonra `.env` içindeki `REDIS_PORT` ve `REDIS_URL`
değerlerini `16379` yapın. Gerekçe ve doğrulama komutu için
[§7 "Redis portu"](#redis-portu-bind-hatası) bölümüne bakın. Bu makinedeki `.env` zaten
`16379` kullanıyor.

```bash
# 3. Altyapı (postgres+postgis, redis, minio)
docker compose up -d

# 4. Şema ve Prisma istemcisi
pnpm db:deploy
```

`pnpm db:deploy` çıktısında `No pending migrations to apply.` veya uygulanan migration
listesi görmelisiniz. Hata alırsanız Docker konteynerleri henüz hazır olmayabilir;
15 saniye bekleyip tekrar deneyin.

---

## 3. Her seferinde çalıştırma

```bash
# Docker Desktop açık mı? Değilse başlatın ve motorun hazır olmasını bekleyin:
docker info > /dev/null && echo hazir

docker compose up -d     # konteynerler zaten ayaktaysa hiçbir şey yapmaz
pnpm dev                 # API + web, tek terminalde
```

`pnpm dev` önce `packages/shared`, `packages/i18n` ve `packages/contracts` paketlerini
derler, sonra API'yi ve Vite'ı birlikte başlatır. İlk açılış ~30 saniye sürer; API'nin
hazır olduğunu `[api]` satırlarında Nest'in route listesini görünce anlarsınız.

Kuyruk işçisi **ayrı bir süreçtir**, üretimde olduğu gibi. Gerekiyorsa ikinci bir
terminalde:

```bash
pnpm dev:worker
```

Mobil uygulama da ayrı başlatılır:

```bash
pnpm --filter @servisapp/mobile start
```

### Adresler

| Ne | Nerede |
|---|---|
| Web konsolu | <http://localhost:5173> |
| API | <http://localhost:3000/api/v1> |
| Sağlık ucu | <http://localhost:3000/api/v1/health> |
| Sağlık sayfası | <http://localhost:5173/sysadmin/health> |
| MinIO konsolu | <http://localhost:9001> |

Her şeyin ayakta olduğunu tek komutla doğrulamak için:

```bash
curl -s http://localhost:3000/api/v1/health
```

Beklenen çıktı — `database`, `redis` ve `queue` üçü de `"status":"up"`:

```json
{"status":"ok","info":{
  "database":{"status":"up","latencyMs":2},
  "redis":{"status":"up","latencyMs":1},
  "queue":{"status":"up","queue":"heartbeat","waiting":0,"active":0,"failed":0}}}
```

---

## 4. Panele giriş

`pnpm db:seed` şu an **Phase 0 placeholder'ıdır** — hiçbir kullanıcı oluşturmaz. Veritabanında
görebileceğiniz `user-*@example.test` kayıtları entegrasyon testlerinden kalan artıklardır ve
parolaları rastgeledir; onlarla giriş yapamazsınız.

Yerel geliştirme için bir demo şirket ve yönetici hesabı oluşturuldu:

| | |
|---|---|
| Adres | <http://localhost:5173/login> |
| E-posta | `admin@demo.servisapp.test` |
| Parola | `DemoServis2026!` |
| Şirket | Demo Servis Taşımacılık A.Ş. |
| Rol | ADMIN |

> Bu hesap yalnızca yerel geliştirme içindir. Parolası bilerek dokümana yazılmıştır ve
> hiçbir ortamda gerçek veriye erişmez. Üretimde böyle bir hesap oluşturulmaz.

Giriş sonrası sol menüden Genel bakış, Güzergâhlar, Araçlar, Öğrenciler, Veliler,
Personel, Başvurular, Okullar ve Ayarlar bölümlerine ulaşırsınız. Tüm listeler boştur —
Phase 3 ekranları var, veri yok.

### Hesabı yeniden oluşturmak

`pnpm db:reset` çalıştırdığınızda veritabanı sıfırlanır ve bu hesap da silinir. Yeniden
oluşturmak için aşağıdaki betiği `apps/api/prisma/demo-account.local.ts` olarak kaydedin:

```ts
/** Yerel demo hesabı. Yalnızca geliştirme içindir, elle çalıştırılır. */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { v7 as uuidv7 } from 'uuid';

const EMAIL = 'admin@demo.servisapp.test';
const PASSWORD = 'DemoServis2026!';

// RLS uygulama rolü için FORCED olduğundan owner bağlantısı kullanılır.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } },
});

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 4,
  });

  const existing = await prisma.user.findFirst({ where: { email: EMAIL } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
    console.log('Mevcut demo kullanıcısının parolası sıfırlandı.');
  } else {
    const tenantId = uuidv7();
    const userId = uuidv7();

    await prisma.$transaction(async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          legalName: 'Demo Servis Taşımacılık A.Ş.',
          status: 'ACTIVE',
          timezone: 'Europe/Istanbul',
        },
      });
      await tx.user.create({
        data: {
          id: userId,
          fullName: 'Demo Yönetici',
          email: EMAIL,
          phoneE164: '+905550000001',
          passwordHash,
          phoneVerified: true,
          status: 'ACTIVE',
          locale: 'tr',
        },
      });
      await tx.userTenantRole.create({
        data: {
          id: uuidv7(),
          userId,
          tenantId,
          role: 'ADMIN',
          status: 'ACTIVE',
          approvedAt: new Date(),
        },
      });
    });
    console.log(`Tenant ${tenantId} ve yönetici ${userId} oluşturuldu.`);
  }

  console.log(`\n  e-posta : ${EMAIL}\n  parola  : ${PASSWORD}\n`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
```

Depo kökünden çalıştırın:

```bash
npx tsx --env-file=.env apps/api/prisma/demo-account.local.ts
```

Üç nokta önemlidir:

- **`--env-file=.env` şart.** `tsx`, Prisma CLI'ın aksine `.env` dosyasını kendiliğinden
  okumaz; bayrak olmadan bağlantı dizesi boş gelir.
- **Dosya `apps/api/` altında olmalı.** `argon2`, `uuid` ve `@prisma/client` o workspace'in
  `node_modules`'ında; başka bir yere koyarsanız `MODULE_NOT_FOUND` alırsınız.
- **`MIGRATION_DATABASE_URL` kullanılır.** Uygulama rolü RLS'i aşamaz; şema sahibi rolüyle
  bağlanmak zorundadır (SDD §4.2).

`.local.ts` uzantısı bilinçlidir — sürüm kontrolüne girmemesi gereken, makineye özel bir
dosyadır.

---

## 5. API'yi doğrudan denemek

Giriş isteği bir **discriminated union**'dır: web istemcileri `surface: "web"` ve `email`,
mobil istemciler `surface: "mobile"` ve `phone` gönderir (FR-AUTH-080). `deviceId` her
ikisinde de zorunludur ve UUID olmalıdır.

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
        "surface": "web",
        "email": "admin@demo.servisapp.test",
        "password": "DemoServis2026!",
        "deviceId": "11111111-1111-4111-8111-111111111111"
      }'
```

Yanıt `tokens.accessToken` (15 dk), `tokens.refreshToken` (web için 12 saat) ve `me`
nesnesini döndürür. Sonraki isteklerde:

```bash
curl -s http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

Sadece `email` + `password` gönderirseniz `VALIDATION_FAILED` /
`invalid_union_discriminator` alırsınız — eksik olan `surface` alanıdır.

---

## 6. Durdurma

```bash
# pnpm dev çalışan terminalde
Ctrl+C

# Konteynerler (veri korunur)
docker compose stop

# Konteynerler + veritabanı hacimleri (her şey silinir)
docker compose down -v
```

`down -v` sonrası §2'deki `pnpm db:deploy` adımını ve §4'teki demo hesabını tekrarlamanız
gerekir.

---

## 7. Sorun giderme

### `docker compose` "cannot find the file specified" diyor

Docker Desktop çalışmıyor. Başlatın ve motorun hazır olmasını bekleyin:

```bash
until docker info > /dev/null 2>&1; do sleep 3; done; echo hazir
```

İlk açılışta 30–60 saniye sürebilir.

### Redis portu: bind hatası

```
bind: An attempt was made to access a socket in a way forbidden by its access permissions
```

Hyper-V, TCP portlarını bloklar hâlinde rezerve eder ve 6379 çoğu zaman bu blokların
içine düşer. Rezerve aralıkları görün:

```bash
netsh interface ipv4 show excludedportrange protocol=tcp
```

Sonra `.env` içindeki `REDIS_PORT` ve `REDIS_URL`'i bu aralıkların dışında bir porta alın
(`16379` çalışıyor). Yalnızca host tarafındaki port değişir; uygulamada hiçbir şey
değişmez.

### Web sayfası bembeyaz açılıyor

Vite bağımlılıkları yeniden optimize ediyordur (`Re-optimizing dependencies because
lockfile has changed`). Birkaç saniye bekleyip sayfayı yenileyin. Devam ederse tarayıcı
konsoluna bakın; `packages/*` derlenmemişse `pnpm build:packages` çalıştırın.

### `MODULE_NOT_FOUND` — Prisma istemcisi bulunamıyor

```bash
pnpm db:generate
```

### Sayfayı yenileyince giriş ekranına atıyor

Bu şu anki davranıştır: erişim jetonu yalnızca bellekte tutuluyor ve uygulama açılışta
`refreshToken` ile oturumu geri kurmuyor. Tam sayfa yenilemesi (F5) yerine uygulama içi
menüyle gezinin. Bunun bilinçli bir Phase 3 kararı mı yoksa eksik mi olduğu netleşmedi.

### `pnpm db:deploy` bağlantı hatası veriyor

Postgres henüz hazır değildir. Sağlık durumunu kontrol edin:

```bash
docker compose ps
```

`servisapp-postgres` satırında `healthy` yazmasını bekleyin.

---

## 8. Veritabanına bakmak

```bash
docker exec -it servisapp-postgres psql -U servisapp_owner -d servisapp
```

`.env` iki bağlantı tanımlar ve **birbirinin yerine kullanılamazlar**:

| Değişken | Rol | Kim kullanır |
|---|---|---|
| `DATABASE_URL` | `servisapp_app` — `BYPASSRLS` **yok** | Uygulama, çalışma zamanında |
| `MIGRATION_DATABASE_URL` | `servisapp_owner` — şemanın sahibi | Yalnızca `prisma migrate` |

Şema sahibi her satır seviyesi güvenlik politikasını sessizce yok sayar. Uygulama owner
rolüyle bağlansaydı izolasyon testleri hiçbir şey doğrulamadan geçerdi (SDD §4.2). psql
ile elle bakarken owner rolünü kullanmak sorun değildir; uygulamanın bağlantısını
değiştirmeyin.

---

## 9. Testler

```bash
pnpm test:unit               # dış bağımlılık gerektirmez
pnpm test:integration        # docker compose up -d gerekir
pnpm test:tenant-isolation   # docker compose up -d gerekir
pnpm lint && pnpm typecheck
```

Entegrasyon ve izolasyon testleri aynı yerel veritabanını kullanır ve arkalarında kayıt
bırakır. Panelde tanımadığınız şirket veya kullanıcı görürseniz kaynağı budur;
`pnpm db:reset` ile temizlenir (ardından §4'teki demo hesabını yeniden oluşturun).

---

## 10. Mobil uygulamada Google ile giriş

Google ile girişi **Expo Go ile deneyemezsiniz.** Expo Go sabit bir uygulamadır; içine
yerel modül yükleyemez. Google Sign-In yerel bir modüldür (ID token'ı cihazda Play
Services üretir), dolayısıyla kendi *geliştirme derlemenizi* almanız gerekir.

```bash
# Yerel modülleri android/ ve ios/ projelerine yaz
pnpm --filter @servisapp/mobile exec npx expo prebuild

# Cihaza kur ve Metro'yu başlat (USB hata ayıklama açık bir telefon ya da emülatör)
pnpm --filter @servisapp/mobile android
```

### `.env` değişince yeniden derleyin

`apps/mobile/.env` içindeki `EXPO_PUBLIC_*` değişkenleri **derleme anında** pakete
gömülür; uygulama bunları çalışırken okumaz. Bu dosyayı değiştirdikten sonra Metro'yu
yeniden başlatmak yetmez — `pnpm --filter @servisapp/mobile android` komutunu tekrar
çalıştırıp derlemeyi yenilemeniz gerekir. Aksi hâlde eski değerle çalışmaya devam eder
ve hata mesajı bunu söylemez.

Gereken tek değişken şudur; **Web** client id'dir, Android olan değil:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
```

Android client id hiçbir yere yazılmaz. Android tarafını Google'a bağlayan şey paket adı
(`com.servisapp.mobile`) ile Google Cloud'a eklenmiş SHA-1 parmak izleridir.

### Sunucu tarafı: gerçek değere çekilecek iki değişken

Kök `.env` dosyasında **ikisi birden** ayarlanmadan Google ile giriş denenemez:

| Değişken | Yerelde alacağı değer | Ayarlanmazsa |
|---|---|---|
| `SOCIAL_PROVIDER_MODE` | `live` | `fake` kalır; token doğrulanmaz (aşağıya bakın) |
| `GOOGLE_OAUTH_CLIENT_IDS` | Google **Web** client id | `live` ile birlikte API açılışta durur |

`fake` modu testler içindir: `FakeIdentityProviderAdapter` yalnızca test paketinin kendi
ürettiği token'ları tanır, imza doğrulaması yapmaz ve hiçbir test Google'a çıkmaz —
`vitest.integration.config.ts` bu yüzden `fake` sabitler, **oraya dokunmayın.** Yan etkisi
şudur: `fake` modda gerçek bir Google token'ı da tanınmaz ve `SOCIAL_PROVIDER_UNAVAILABLE`
ile reddedilir. Tersi de geçerlidir — `fake` ile giriş yapabilmeniz yapılandırmanın doğru
olduğunu göstermez.

Sunucu her ID token'ın `aud` alanını `GOOGLE_OAUTH_CLIENT_IDS` listesine karşı doğrular.
Yerel SDK ile Android'de bu alan **web client id**'dir (`azp` alanı Android client'tır),
bu yüzden listeye web client id yazılmalıdır. Android client id yazarsanız her giriş
`SOCIAL_PROVIDER_UNAVAILABLE` ile reddedilir ve gerekçe istemciye söylenmez — sunucu
kaydına bakmanız gerekir.

`SOCIAL_PROVIDER_MODE=live` iken audience boş bırakılırsa API artık **açılışta durur** ve
duran değişkenin adını söyler. Eskiden sessizce açılır, sonra her girişi
`SOCIAL_PROVIDER_UNAVAILABLE` ile reddederdi: yani boş bir satır, Google'ın erişilemez
olduğunu söyleyen bir hata olarak görünürdü.

### `503 SOCIAL_PROVIDER_UNAVAILABLE` görürseniz

Bu kod tek bir şeyi söyler: **sunucu token'ı kabul etmedi.** Gerekçe kasten istemciye
verilmez (hangi kontrolün düştüğünü söylemek, neyin düzeltileceğini söylemektir), o yüzden
API kaydına bakılır. Sırayla:

1. `SOCIAL_PROVIDER_MODE` gerçekten `live` mi? Değeri değiştirdikten sonra API'yi yeniden
   başlattınız mı? **İlk bakılacak yer burasıdır** — yığın izinde
   `FakeIdentityProviderAdapter.verify` görüyorsanız cevap kesindir: mod hâlâ `fake`.
2. API kaydındaki `Identity provider token rejected` satırı: `reason` alanı `jose`'nin
   gerçek gerekçesidir (`unexpected "aud" claim value`, `"exp" claim timestamp check
   failed`, imza hatası…).
3. `No client id configured for this provider` satırı görüyorsanız `GOOGLE_OAUTH_CLIENT_IDS`
   boştur — ki artık bu durum açılışta yakalanır, yani eski bir süreç çalışıyor demektir.
4. `aud` uyuşmuyorsa `.env`'e Android client id yazılmış olması en olası sebeptir.

### Handshake'i tamamlamak: OTP'yi nasıl okursunuz

Google doğrulaması geçtiğinde **tam oturum almazsınız.** SDD §7.5 gereği yeni bir sosyal
kimliğe handshake token verilir ve zincir şöyle sürer: telefon numarası → OTP → eşleşen
davetlerin kabulü/reddi → tam oturum. Mobil tarafta bunun karşılığı `HANDSHAKE_PHONE`,
`HANDSHAKE_OTP` ve `INVITATIONS` ekranlarıdır.

Yerelde SMS gönderilmez, dolayısıyla kodu **API kaydından** okursunuz. `SMS_PROVIDER`
varsayılanı olan `none` bunun için doğru değerdir — bu değerde `SmsOtpDeliveryAdapter`
üretim dışında kodu kaydına basar:

```
One-time code (development only)   code=123456  destination=+90******4567
```

`SMS_PROVIDER=fake` **yapmayın**: o değer `FakeSmsProvider`'ı bağlar, mesajı yalnızca
bellekte tutar ve kodu kaydına yazmaz. Testlerin gönderileni bellekten okuyabilmesi için
vardır; sizin ekranınızda kodun kaybolması demektir. `http` ise gerçek SMS gönderir ve
`SMS_PROVIDER_URL` ile `SMS_PROVIDER_AUTH` ister.

Girdiğiniz numaranın, bir Admin'in **davet ettiği** numarayla eşleşmesi gerekir; eşleşme
yoksa handshake tamamlanır ama ortada davet olmaz. Davet oluşturmayı §4 anlatır.

Yönetici hesapları bu yoldan giremez: `ADMIN`/`SYSADMIN` için sunucu
`SOCIAL_LOGIN_NOT_PERMITTED` döner (FR-AUTH-210) ve ekran bunu Türkçe söyler. Beklenen
davranıştır, hata değildir — web panelinden parolayla girilir.

### Sık karşılaşılan hata: `DEVELOPER_ERROR`

Uygulama "Google ile giriş bu uygulama sürümünde yapılandırılmamış" diyorsa neredeyse her
zaman sebep SHA-1'dir. Her derleme türü **farklı bir anahtarla** imzalanır ve üçünün de
SHA-1'i aynı Android client kaydına eklenmiş olmalıdır:

| Derleme | SHA-1 nereden alınır |
|---|---|
| Yerel hata ayıklama | `cd apps/mobile/android && ./gradlew signingReport` |
| EAS derlemesi | `pnpm --filter @servisapp/mobile exec npx eas credentials` |
| Play Store | Play Console → Uygulama bütünlüğü → Play App Signing |

Yalnızca ilkini eklediyseniz uygulama sizin makinenizde çalışır, mağazadan indirende
çalışmaz.

### Diğer hatalar

| Ekranda yazan | Anlamı |
|---|---|
| Play Hizmetleri bulunmuyor | Cihazda Google Play Services yok veya eski (SDD §18 TI-07). Çare yok; parolayla giriş açık bırakılmıştır. |
| Google hesabınız doğrulanamadı | Giriş başarılı oldu ama ID token üretilmedi — `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` boş ya da yanlış. |
| Giriş işlemi zaten sürüyor | Hesap seçici açıkken butona ikinci kez basılmış. Bekleyin. |

Onay ekranı Google Cloud'da "Testing" modundayken yalnızca **test kullanıcısı olarak
eklenmiş** hesaplar giriş yapabilir. Kendi hesabınızı oraya eklemeyi unutmayın.
