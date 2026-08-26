# Backend — D&D AI Game Master

Node.js + Express API. Runtime durum `data/store.js` içindeki `Map`'lerde tutulur; bu `Map`'ler
başlangıçta kalıcı depodan (`data/db.js` — SQLite ya da Postgres) yüklenir ve her değişiklikte
oraya geri yazılır (bkz. "Kalıcılık" bölümü).

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
istemciler/araçlar için geriye dönük uyumluluk amaçlı). Karakter, sahne, sohbet geçmişi ve "aktif
karakter" ilişkisi tamamen session bazlı tutulur — farklı session'lar birbirinin verisini göremez.
Sahiplik gerektiren tüm `scene.js`/`character.js` uçları, işlem yapılan `characterId`'nin gerçekten
o session'a ait olduğunu doğrular (`requireOwnedCharacter`), aksi halde 403/404 döner.

## Kalıcılık

`data/db.js`, `DATABASE_URL` varlığına göre SQLite (`data/dbSqlite.js`) veya Postgres
(`data/dbPostgres.js`) seçer. Sunucu açılışında `loadAll()` ile tüm karakterler/sahneler/sohbet
geçmişleri/session kayıtları bellek-içi `Map`'lere yüklenir; bu `Map`'ler çalışma zamanının tek
gerçek kaynağıdır, DB ise arka planda (fire-and-forget `save*()` çağrılarıyla) güncellenen bir
gölge kopyadır. Süresi dolmuş (stale) session'lar periyodik olarak temizlenir.

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
| POST | `/api/character/reset` | Session'ın karakter/sahne/sohbet bağlarını temizler ve karakteri kalıcı olarak siler |

### Sohbet (`/api/chat`)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/chat` | Session'ın sohbet geçmişi |
| POST | `/api/chat` | `{ message }` (max 500 karakter) — oyuncu mesajı ekler, AI/mock GM cevabı üretir |

### Sahne / taktik grid (`/api/scene`)

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/scene` | Aktif sahne/taktik harita durumu |
| POST | `/api/scene/move` | `{ tokenId, x, y }` — token hareketi (menzil/engel kontrolü) |
| POST | `/api/scene/end-turn` | Sırayı bir sonraki token'a geçirir, düşman turlarını çözer |
| POST | `/api/scene/attack` | `{ characterId, targetTokenId }` — Action harcayan yakın/menzilli saldırı |
| POST | `/api/scene/cast` | `{ characterId, spellId, targetTokenId? }` — büyü kullan (bazı büyüler alan etkili, hedefsiz olabilir) |
| POST | `/api/scene/item/use` | `{ characterId, itemId }` — eşya kullan (Bonus Action) |
| POST | `/api/scene/item/equip` | `{ characterId, itemId }` — eşya kuşan/çıkar |
| POST | `/api/scene/item/drop` | `{ characterId, itemId }` — eşya at (oyuncu token'ının konumuna loot olarak düşer) |
| POST | `/api/scene/item/throw` | `{ characterId, itemId, x, y }` — eşyayı belirtilen kareye fırlat (Action) |

Tüm `/api/scene/*` uçları ile `/api/character/create`, `/roll-stats`, `/intro` ve `/api/chat` POST,
IP bazlı `PUBLIC_RATE_LIMIT_MAX`'e tabidir; `attack`/`cast`/`item/*` gibi AI anlatımı tetikleyen
uçlar ayrıca paylaşılan saatlik `AI_HOURLY_LIMIT` bütçesini de tüketir.

## Notlar

- Aksiyon ekonomisi: bir turda saldırı/büyü/fırlatma tek bir Action, eşya kullanımı ayrı bir Bonus
  Action harcar; sahnede düşman yoksa bu kısıtlar tamamen devre dışı kalır.
- Sahiplik/yetki kontrolleri (`requireOwnedCharacter`, `/character/intro`'daki aktif-karakter
  kontrolü) her istekte session ile `characterId` eşleşmesini doğrular.
