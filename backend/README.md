# Backend — D&D AI Game Master

Node.js + Express API. Faz 12 (2026-08) ile eski taktik-grid (x/y hareket, ayrı sahne state'i)
tamamen kaldırıldı — oyun artık tek bir **serbest-form sohbet** arayüzü: oyuncu doğal Türkçe ile
ne yapmak istediğini yazar (`POST /api/chat`), sunucu bu metinden niyeti algılayıp (saldır/kuşan/
bırak/al/iç/büyü) GERÇEK mekanik sonuçlar (HP/mana/XP/envanter) üretir (bkz. "Sohbet" bölümü).
Runtime durum `data/store.js` içindeki `Map`'lerde tutulur; bu `Map`'ler başlangıçta kalıcı
depodan (`data/db.js` — SQLite ya da Postgres) yüklenir ve her değişiklikte oraya geri yazılır
(bkz. "Kalıcılık" bölümü).

## Kurulum

```bash
cd backend
npm install
```

## Çalıştırma

```bash
npm start       # node server.js
npm run dev     # node --watch server.js (dosya değişince otomatik yeniden başlar)
```

Varsayılan port: `3001` (`PORT` env değişkeniyle değiştirilebilir). Sağlık kontrolü: `GET /api/health`.

## Ortam değişkenleri

Hepsi sadece ortam değişkeninden okunur, hiçbiri kodda/`.env`'de commit edilmez (`.env` `.gitignore`'da).

| Değişken | Zorunlu mu | Açıklama |
|---|---|---|
| `PORT` | Hayır | Varsayılan `3001`, Render gibi platformlar otomatik ayarlar |
| `GEMINI_API_KEY` | Hayır | Yoksa/hata verirse/timeout olursa sistem sessizce mock GM'e düşer |
| `GEMINI_MODEL` | Hayır | Varsayılan `gemini-3.6-flash` |
| `AI_HOURLY_LIMIT` | Hayır | Saatlik AI çağrı limiti (tüm session'lar paylaşır), varsayılan `30` |
| `DATABASE_URL` | Hayır | Varsa Postgres kullanılır (`pg`), yoksa yerel `game.db` (SQLite) — bkz. `data/db.js`. Testlerde (`VITEST=true`) bu değişken olsa bile her zaman SQLite (`:memory:`) kullanılır |
| `DATABASE_SSL` | Hayır | `false` verilirse Postgres bağlantısında SSL kapatılır (varsayılan açık) |
| `DB_PATH` | Hayır | SQLite dosya yolu override (test/geliştirme amaçlı) |
| `FRONTEND_ORIGIN` | Hayır | CORS için izinli origin listesi (virgülle ayrılmış) — yerel dev origin'lerine EK olarak |
| `PUBLIC_RATE_LIMIT_MAX` | Hayır | Kimliksiz-erişilebilir uçlarda IP başına dakikalık istek sınırı, varsayılan `20` |

## Session izolasyonu

Her istemci `X-Session-Id` header'ıyla kendini tanıtır (bkz. `services/sessionId.js`). Bu header
eksikse sunucu süreç ömrü boyunca sabit kalan bir `DEFAULT_SESSION_ID`'ye düşer (yalnızca eski
istemciler/araçlar için geriye dönük uyumluluk amaçlı). Karakter, sohbet geçmişi ve "aktif karakter"
ilişkisi tamamen session bazlı tutulur — farklı session'lar birbirinin verisini göremez.
`GET /api/character` aktif karakteri sessionId üzerinden döner (parametre olarak `characterId`
almaz); `POST /api/character/intro` ise `characterId`'nin çağıran session'ın aktif karakteriyle
eşleştiğini doğrular, aksi halde 403 döner. (Faz 12-C öncesi ayrı bir `requireOwnedCharacter()`
helper'ı vardı — grid'in `scene.js`'i kalkınca bu tek kontrol noktası kalmadığından helper da
kaldırıldı, kontrol doğrudan route içine taşındı.)

## Kalıcılık

`data/db.js`, `DATABASE_URL` varlığına göre SQLite (`data/dbSqlite.js`) veya Postgres
(`data/dbPostgres.js`) seçer. Sunucu açılışında `loadAll()` ile tüm karakterler/sohbet
geçmişleri/session kayıtları bellek-içi `Map`'lere yüklenir; bu `Map`'ler çalışma zamanının tek
gerçek kaynağıdır, DB ise arka planda (fire-and-forget `save*()` çağrılarıyla) güncellenen bir
gölge kopyadır. Süresi dolmuş (stale) session'lar periyodik olarak temizlenir.

Serbest-form düşman/loot durumu (`services/freeformEncounter.js`) bilinçli olarak DB'ye PERSIST
EDİLMEZ — sadece bellekte tutulur, sunucu restart'ında sıfırlanır (kabul edilebilir bir kısıtlama,
karakter/envanter/XP gibi kalıcı veri etkilenmez).

## AI entegrasyonu

GM anlatımı `services/aiGm.js` üzerinden Google Gemini ile üretilir (`services/narrationService.js`
tek giriş noktasıdır). Aşağıdaki durumlardan HERHANGİ biri gerçekleşirse sistem sessizce
`data/gmFlavor.js` / `data/openingFlavor.js` içindeki şablon metinlere (mock) düşer, kullanıcıya
hata göstermez:

- `GEMINI_API_KEY` tanımlı değil,
- saatlik AI çağrı bütçesi (`AI_HOURLY_LIMIT`) dolmuş,
- Gemini isteği 15 saniye içinde cevap vermemiş (timeout),
- Gemini isteği hata/boş cevap döndürmüş.

Yanıtlar `POST /api/chat` ve `POST /api/character/intro` gibi uçlarda `source: "ai" | "mock"`
alanıyla döner, hangi yolun kullanıldığı istemciye açıkça bildirilir.

## Endpoint'ler

### Karakter (`/api/character`)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/character/options` | Seçilebilir ırk/sınıf/görünüş listesi |
| POST | `/api/character/roll-stats` | `{ raceId }` — zar atıp ırk bonuslu attribute seti üretir (kaydetmez) |
| POST | `/api/character/create` | `{ name, raceId, classId, appearanceId, attributes? }` — yeni karakter oluşturur, session'ın aktif karakteri yapar |
| POST | `/api/character/intro` | `{ characterId }` — AI (veya mock) açılış anlatımını üretir, sohbet geçmişine ekler |
| GET | `/api/character` | Session'ın aktif karakterini döner (yoksa 404) |
| POST | `/api/character/reset` | Session'ın karakter/sohbet/serbest-form karşılaşma bağlarını temizler ve karakteri kalıcı olarak siler |

### Sohbet (`/api/chat`)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/chat` | Session'ın sohbet geçmişi |
| POST | `/api/chat` | `{ message }` (max 500 karakter) — oyuncu mesajı ekler, mekanik sonucu çözer, AI/mock GM cevabı üretir |

Tüm `/api/character/*` POST uçları (`create`, `roll-stats`, `intro`, `reset`) ile `/api/chat` POST,
IP bazlı `PUBLIC_RATE_LIMIT_MAX`'e tabidir; `POST /api/chat` ve `/character/intro` ayrıca paylaşılan
saatlik `AI_HOURLY_LIMIT` bütçesini de tüketir (AI anlatımı tetikledikleri için).

## Serbest-form mekanik çözümleme

`POST /api/chat`'e gelen her oyuncu mesajı `services/actionResolver.js`'deki niyet kalıplarıyla
(regex tabanlı, Türkçe çekim-farkında — bkz. dosyanın başındaki `WORD_START` notu) taranır, eşleşen
ilk niyet `services/freeformCombat.js`'teki `resolveFreeformAction()` içinde GERÇEK bir mekanik
sonuca (HP/mana/XP/envanter mutasyonu) dönüştürülür. Öncelik sırası (bir mesaj birden fazla kalıba
uysa bile TEK bir sonuç üretilir): **büyü > saldırı > eşya kullan (iç) > eşya kuşan/çıkar > eşya
bırak > eşya al**. Hiçbir niyet eşleşmezse (ya da mekanik ön koşul sağlanmazsa — ör. hedef/eşya
bulunamadı) `resolveFreeformAction` `null` döner, sistem saf roleplay/flavor anlatımına düşer
(`services/actionResolver.js`'in `resolveAction()`'ı, sadece anlatım rengi için tahmini bir D20).

- **Saldırı**: aktif karşılaşmadaki düşmana (birden fazla düşman varsa isim eşleşmesi gerekir)
  primary attribute + D20 ile vurur; kendi saldırısından SONRA hâlâ canlı düşman varsa TEK bir
  düşman karşılık verir (`resolveEnemyRetaliation`).
- **Büyü**: `data/spells.js`'teki isim ya da eşanlamlısı (`SPELL_ALIASES`) metinde geçince tetiklenir;
  saldırı büyüsü (Ateş Topu) karşılaşmadaki TÜM canlı düşmanlara isabet eder (AoE).
- **Eşya kuşan/çıkar/bırak**: `nameMatchesText()` ortak isim eşleştirme fonksiyonunu kullanır — tam
  eşya adını, onun Türkçe ünsüz-yumuşamış çekimli halini (ör. "Kılıç"→"Kılıcı") VE (çok kelimeli
  isimlerde) SADECE son kelimeyi de dener (ör. "Kısa Kılıç" → "Kılıcımı"). İsim eşleşmezse hiç
  mekanik sonuç üretilmez (sahip olunmayan/var olmayan bir eşyaya sessizce düşülmez).
- **Eşya al/bırak**: sahnenin loot havuzuyla (`services/freeformEncounter.js`) karşılıklı çalışır —
  bırakılan eşya loot havuzuna eklenir, tekrar alınabilir. Envanter üst sınırı (`MAX_INVENTORY=30`)
  doluyken alma isteği `inventoryFull` ile reddedilir.
- Ölü bir karakter (`hp.current<=0`) `POST /api/chat` üzerinden hiçbir mekanik aksiyon
  gerçekleştiremez — `routes/chat.js` en başta erken döner, AI çağrısı/mekanik çözümleme hiç
  tetiklenmez.

## Notlar

- Ayrı bir "Action/Bonus Action" tur ekonomisi YOK (grid dönemine özgüydü, Faz 12 ile kalktı) —
  oyuncu istediği kadar mesaj yazabilir, her mesaj kendi başına çözülür.
- Sahiplik/yetki kontrolleri (`/character/intro`'daki aktif-karakter kontrolü) her istekte session
  ile `characterId` eşleşmesini doğrular.
