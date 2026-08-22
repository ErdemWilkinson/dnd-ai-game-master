# Görev Listesi

Durum: `[ ]` yapılmadı, `[~]` devam ediyor, `[x]` tamamlandı

## Faz 1 — İskelet

### Coder
- [x] `backend/`: package.json + Express server scaffold (server.js, `npm start`)
- [x] `backend`: karakter oluşturma endpoint'i (`POST /api/character/create`) — sadece D&D, ırk/sınıf/isim al
- [x] `backend`: karakter state endpoint'leri (`GET/POST /api/character`)
- [x] `backend`: sohbet endpoint'leri (`GET/POST /api/chat`) — GM cevabı kural tabanlı/şablon metin üretsin (rastgele flavor text havuzu yeterli)
- [x] `backend`: sahne/taktik map endpoint'leri (`GET /api/scene`, `move`, `end-turn`, item use/equip/drop/throw)
- [x] `frontend/`: Vite + React + TS scaffold
- [x] `frontend`: karakter oluşturma formu (ırk + sınıf seçimi, isim) — tek evren, wizard yok
- [x] `frontend`: karakter kartı bileşeni (HP/mana/attributes/envanter)
- [x] `frontend`: sohbet akışı bileşeni
- [x] `frontend`: taktik grid harita bileşeni

### Tester
- [x] Backend test altyapısı kur (Vitest + supertest) — `backend/tests/`, `npm test`
- [x] Frontend test altyapısı kur (Vitest + React Testing Library) — `frontend/src/**/*.test.tsx`, `npm test`
- [x] Karakter oluşturma endpoint'i için testler — `backend/tests/character.test.js` (17 test)
- [x] Sohbet endpoint'i için testler — `backend/tests/chat.test.js` (9 test)
- [x] Taktik map endpoint'leri için testler (move/end-turn/item işlemleri) — `backend/tests/scene.test.js` (20 test)
- [x] Manuel QA checklist'i hazırla (Faz 1 tamamlanınca kullanılacak) — bkz. `QA_CHECKLIST.md`

Test durumu: backend 45/46 geçiyor (1 tanesi bilinçli KIRMIZI, bkz. Bug #1), frontend 6/7 geçiyor (1 tanesi bilinçli KIRMIZI, bkz. Bug #3). Kırmızı testler gerçek uygulama bug'larını belgeliyor — coder düzeltince yeşile dönecek, testeri "sildim" diye kapatmayın.

## Bulunan Buglar (Faz 1 QA — tester tarafından, coder düzeltmeli)

1. **[Backend bug, testle doğrulandı] İksir iyileştirmesi hiç çalışmıyor.**
   `backend/routes/scene.js:84` — `/iksir/i.test(item.name)` regex'i, eşya isimlerindeki Türkçe noktalı büyük **İ** harfini (U+0130) yakalamıyor. `item.name` = `"İksir (Küçük İyileştirme)"` iken bu regex `false` döner (JS'in Unicode case-fold'u Türkçe locale kuralı uygulamıyor — `"İ".toLowerCase()` bile `"i"` değil `"i̇"` — i + combining dot — üretiyor). Sonuç: `POST /api/scene/item/use` ile iksir kullanıldığında eşya envanterden düşüyor ama **HP asla artmıyor**. Kanıt: `backend/tests/scene.test.js` içindeki "iksir kullanmak HP'yi maksimuma kadar iyileştirir..." testi bilinçli olarak kırmızı bırakıldı (`hp.current` bekleniyor 6, geliyor 1).
   Öneri düzeltme: regex yerine örn. `item.name.toLocaleLowerCase('tr').includes('iksir')` ya da eşyaya `type: 'potion'` gibi locale'den bağımsız bir alan eklemek.

2. **[Frontend — büyük kapsam eksiği] Envanter aksiyonları (kullan/kuşan/at/fırlat) arayüzde hiç yok.**
   Backend tarafında `POST /api/scene/item/use|equip|drop|throw` tam çalışıyor (testlerle doğrulandı) ve `frontend/src/api.ts` içinde `useItem`/`equipItem`/`dropItem` wrapper'ları bile yazılmış — ama hiçbir component bunları çağırmıyor, `throwItem` fonksiyonu da hiç yok. `CharacterCard.tsx` envanteri sadece statik bir liste olarak gösteriyor, tıklanabilir hiçbir aksiyon yok. `PROJECT.md`'de "envanter (kullan/kuşan/at/fırlat)" Faz 1 kapsamında açıkça isteniyor — bu haliyle kapsam eksik.

3. **[Frontend i18n bug, testle doğrulandı] Karakter kartında ırk/sınıf Türkçe değil, ham id gösteriliyor.**
   `CharacterCard.tsx:21` `{character.race} · {character.class}` yazıyor — bunlar backend'den gelen ham id'ler (`"human"`, `"fighter"`), CSS `text-transform: capitalize` ile sadece büyük harfle başlatılıyor ("Human · Fighter"), ama arayüzün geri kalanı tamamen Türkçe (İnsan, Savaşçı, Elf, Büyücü...). Kanıt: `frontend/src/components/CharacterCard.test.tsx` son testi bilinçli kırmızı.
   Öneri düzeltme: `getCharacterOptions()`'dan gelen races/classes listesinden `name` alanını lookup edip göstermek (App genelinde races/classes state'i zaten yükleniyor, CharacterCard'a prop olarak geçirilebilir ya da id→name map'i context'e taşınabilir).

4. **[Frontend bug] Sayfa yenilenince (F5) karakter oluşturma ekranına geri dönüyor, mevcut karakter kayboluyor.**
   `App.tsx` karakter state'ini sadece React `useState` içinde tutuyor, `getCurrentCharacter()` (api.ts'de zaten var, hiç çağrılmıyor) ile backend'deki aktif karakteri geri yüklemiyor. Backend'de karakter hâlâ mevcutken (tek global "aktif karakter" slotu) kullanıcı sayfayı yenilerse tekrar oluşturma formunu görüyor; formu tekrar doldurup gönderirse backend'deki **eski karakterin üzerine sessizce yenisi yazılıyor** (HP/envanter durumu kaybolur).

5. **[Davranış / netleştirme gerekiyor — bug olmayabilir] Düşman sırasındayken oyuncu grid'e tıklayınca aslında düşman token'ını hareket ettiriyor.**
   Faz 1'de AI/otomatik düşman hareketi yok. `TacticalGrid.tsx`'teki `handleCellClick`, her zaman `scene.activeTokenId`'yi hedef alıyor — "Turu Bitir"e basılıp sıra Goblin'e geçtiğinde, kullanıcı herhangi bir hücreye tıklarsa fiilen **Goblin'i kendisi hareket ettirmiş oluyor** (curl ile doğrulandı, konsol hatası yok, sessizce çalışıyor). Arayüzde bunu engelleyen ya da açıklayan hiçbir şey yok. Faz 2'de AI eklenene kadar kasıtlı bir placeholder mı, yoksa şimdiden engellenmeli mi — PM/coder ile netleştirilmeli.

6. **[Küçük / kod kokusu] `routes/scene.js` POST /move'daki 404 "Token bulunamadı" dalı fiilen ölü kod.**
   `scene.activeTokenId !== tokenId` kontrolü zaten önce çalıştığı için, var olmayan bir `tokenId` gönderildiğinde (aktif token id'siyle eşleşmediği sürece) her zaman önce 400 dönüyor; 404'e ancak `activeTokenId`'nin kendisi `scene.tokens` içinde yoksa ulaşılabilir ki bu normal akışta oluşmaz. Fonksiyonel bir hata değil, sadece test yazarken fark edildi.

7. **[Test altyapısı notu — coder'ı etkilemez ama gelecekteki test yazarları bilmeli] `backend/data/store.js` singleton'ları CJS/ESM karışımında ikiye katlanabiliyor.**
   Backend `require`/`module.exports` (CommonJS) kullanıyor. Bir test dosyası aynı store'u ESM `import` ile çekerse (Vitest'in `vite-node` transformu ile native `require()` cache'i ayrışabildiği için), test `characters.clear()` çağırsa bile route'ların kullandığı GERÇEK Map temizlenmiyor — testler rastgele başarısız oluyor gibi görünüyor. Çözüm: `backend/tests/*.test.js` içinde `createRequire(import.meta.url)` kullanarak app kodunu her zaman `require()` ile çekmek (mevcut 3 test dosyasında bu yapıldı). Yeni backend test dosyası yazan biri aynı deseni takip etmeli.

## Faz 1.5 — Bug Fix / Polish (kullanıcı kararı: AI'dan önce sağlamlaştırma)

PM kararı (bug #5 netleştirmesi): Faz 2'ye kadar düşman AI'ı yok, bu yüzden düşman sırasında grid tıklaması **engellenmeli** (placeholder olarak bırakmak yerine) — kullanıcının kendi token'ı olmayanı hareket ettirmesi kafa karıştırıcı bir bug gibi görünüyor, davranış olarak kabul edilemez.

### Coder — öncelik sırasıyla
- [x] Bug #1 (Backend): `scene.js:84` iksir regex'i Türkçe "İ" yakalamıyor → `item.name.toLocaleLowerCase('tr').includes('iksir')` ile düzeltildi
- [x] Bug #2 (Frontend, kapsam eksiği): Envanterde kullan/kuşan/at/fırlat için UI eklendi (`CharacterCard.tsx`, `api.ts`'e `throwItem` eklendi)
- [x] Bug #3 (Frontend i18n): CharacterCard'da ırk/sınıf artık Türkçe isimle gösteriliyor (`src/data/dndNames.ts` statik id→isim haritası — CharacterCard testleri API mock'lamadığı için senkron çözüm seçildi)
- [x] Bug #4 (Frontend): Sayfa yenilenince `getCurrentCharacter()` ile mevcut karakter geri yükleniyor (`App.tsx`, loading state eklendi)
- [x] Bug #5 (Frontend, PM kararı yukarıda): Sıra oyuncuda değilken grid tıklaması engellendi, "senin sıran değil" uyarısı + grid görsel olarak pasifleştiriliyor (`TacticalGrid.tsx`)
- [x] Bug #6 (opsiyonel, düşük öncelik): `scene.js` move endpoint'inde token varlık kontrolü sıra kontrolünden önceye alındı, 404 dalı artık erişilebilir

Doğrulama: backend 46/46, frontend 7/7 test yeşil; `tsc --noEmit` ve `npm run build` (frontend) temiz; tüm düzeltmeler curl ile uçtan uca de test edildi.

### Tester
- [x] Coder düzeltmeleri push ettikçe ilgili kırmızı testlerin yeşile döndüğünü doğrula — backend 46/46 → 47/47, frontend 7/7 → 12/12
- [x] Bug #4 ve #5 için yeni test/QA adımı ekle — `frontend/src/App.test.tsx` (Bug #4), `frontend/src/components/TacticalGrid.test.tsx` (Bug #5); Bug #6 için de `backend/tests/scene.test.js`'e regresyon testi eklendi
- [x] Tüm Faz 1.5 bugları kapanınca tam regresyon QA'sı yap, QA_CHECKLIST.md'yi güncelle — bkz. aşağıdaki "Faz 1.5 QA sonucu"

### Faz 1.5 QA sonucu (tester)
Tüm 6 bug otomatik testlerle VE tarayıcıda (Playwright/chromium ile gerçek kullanıcı akışı) doğrulandı:
- Backend: **47/47** test yeşil (yeni: Bug #6 regresyon testi — var olmayan tokenId artık 404 dönüyor).
- Frontend: **12/12** test yeşil (yeni: `App.test.tsx` — sayfa açılışında aktif karakter geri yükleniyor/yüklenmiyor senaryoları; `TacticalGrid.test.tsx` — düşman sırasında tıklama engelleniyor + grid pasifleşiyor).
- Tarayıcı regresyonu: karakter oluşturma (Elf/Büyücü ile, Türkçe isim doğru gösterildi) → envanter kuşan/kullan/at aksiyonları çalıştı (envanter sayısı her aksiyonda doğru azaldı) → sayfa yeniden yüklendiğinde (fresh nav) karakter ve envanter durumu **aynen korundu** → "Turu Bitir" sonrası düşman sırasında grid'e tıklayınca "Sıra sende değil." hatası + `grid-disabled` sınıfı göründü, backend'e hiç istek gitmedi → sıra oyuncuya dönünce engel kalkıp normal hareket tekrar çalıştı. Konsol hatası, sayfa hatası veya başarısız istek yok.
- `QA_CHECKLIST.md` güncellendi: tüm "bilinen bug" notları kaldırıldı, ilgili maddeler "çalışıyor" olarak işaretlenebilir hale getirildi.

**Kalan/gelecek notlar (blocker değil):**
- Bug #5'in engeli sadece frontend tarafında (`TacticalGrid.tsx` client-side kontrol) — backend `/scene/move` hâlâ herhangi bir aktif token'ı hareket ettirmeye izin veriyor. Tek istemcili Faz 1 kapsamında risksiz, ama Faz 2'de gerçek AI/çoklu istemci gelirse backend'de de doğrulama gerekir.
- `frontend/src/data/dndNames.ts`, backend `data/dnd.js` ile senkron statik bir kopya — ırk/sınıf listesi ileride değişirse ikisinin birden güncellenmesi gerekiyor (coder'ın kendi notu, tester olarak onaylıyorum, potansiyel unutma riski var).

**Faz 1.5 KAPANDI.** Bilinen açık bug yok, Faz 2'ye geçişe testerdan onay.

## Faz 2 — Gerçek AI Game Master (Google Gemini API)

Kullanıcı kararı: Claude API yerine **Gemini API** (ücretsiz katman) — maliyet/darboğaz endişesi nedeniyle. Kullanıcı biraz sonra bir Gemini API key sağlayacak (aistudio.google.com/apikey, ücretsiz alınabiliyor).

Tasarım ilkeleri (PM):
- AI, oyunun bel kemiği DEĞİL — bir "üst katman". Key yoksa / hata verirse / rate limit aşılırsa **otomatik ve sessizce** mevcut mock GM'e (Faz 1 flavor text) düşülür. Oyun asla AI'a bağımlı çökmemeli.
- Faz 2'de AI sadece **anlatım/narration** üretir (chat mesajı). Oyun durumunu (HP, envanter, token pozisyonu) AI değil, mevcut kural tabanlı backend yönetmeye devam eder — AI'ın state mutasyonu yapması riskli/kapsam dışı, ileride değerlendirilir.
- Rate limit: oturum başına/saatlik makul bir üst sınır (örn. saatte 30 AI çağrısı) — ücretsiz katman kotasını da korur.
- `GEMINI_API_KEY` ortam değişkeninden okunur, **asla commit edilmez** (`.env`, `.gitignore`'da olmalı). Key gelene kadar sistem otomatik mock'a düşerek çalışmaya devam eder.

### Coder
- [x] `backend`: `.env.example` eklendi (`GEMINI_API_KEY=`, `PORT=`), `.env` `.gitignore`'a eklendi, `dotenv` ile `server.js`'de yükleniyor
- [x] `backend`: `@google/generative-ai` eklendi, model `gemini-3.6-flash` (`GEMINI_MODEL` env ile override edilebilir)
- [x] `backend`: `services/aiGm.js` — karakter + sahne + son 6 mesajdan prompt kurup Gemini'den narration metni döndürüyor
- [x] `backend`: `services/rateLimiter.js` — saatlik sabit pencere sayacı, varsayılan limit 30 (`AI_HOURLY_LIMIT` ile override edilebilir)
- [x] `backend`: `routes/chat.js` AI katmanına bağlandı — key yok/rate limit aşıldı/Gemini hata verdi → sessizce `gmFlavor.js` mock'a düşer, `gmMessage.source` alanı (`"ai"`/`"mock"`) eklendi
- [x] Key olmadan (curl ile: `source: "mock"` dönüyor) ve geçersiz key ile (Gemini 400 hatası loglanıp sessizce mock'a düşüyor) doğrulandı.
- [x] **Gerçek geçerli key ile doğrulandı.** İlk birkaç key farklı Gemini projelerinde `429 "prepayment credits depleted"` hatası veriyordu (kullanıcı tarafı faturalandırma sorunu, kod değişikliği gerektirmedi — sadece varsayılan model adı `gemini-2.5-flash` → `gemini-3.6-flash` güncellendi, commit 07e977e). Kullanıcının farklı bir Google Cloud projesinden aldığı son key ile başarılı: `source: "ai"`, Türkçe/atmosferik/bağlama uygun anlatım geldi, çok turlu sohbette geçmiş bağlamı doğru kullanıldı. Ayrıca gerçek trafikte bir istek Gemini'den geçici `503 "high demand"` aldı ve sistem sessizce mock'a düşüp bir sonraki istekte AI'a geri döndü — hem başarı hem geçici hata senaryosu canlı ortamda doğrulandı.

Not: `services/sceneState.js` eklendi — `scene.js`'in özel `getScene()`'i, AI prompt'unun sahne bağlamına da ihtiyacı olduğu için `routes/scene.js` ve `routes/chat.js` arasında paylaşılan ortak modüle taşındı (küçük bir refactor, davranış değişmedi).

### Tester
- [x] Gemini çağrısını mock'layarak: (a) başarılı AI cevabı senaryosu, (b) hata/timeout → mock fallback senaryosu, (c) rate limit aşımı → mock fallback senaryosu için testler yazıldı — `backend/tests/aiGmFallback.test.js` (5 test, gerçek API key gerektirmiyor)
- [x] Rate limiter'ın sayaç mantığını test et — `backend/tests/rateLimiter.test.js` (5 test: limit dahilinde kabul, limit aşımı red, varsayılan limit, pencere dolunca reset, pencere dolmadan reset olmaması)
- [x] Key eklendikten sonra gerçek bir manuel QA turu — **tamamlandı** (bkz. aşağı)
- [x] QA_CHECKLIST.md'ye Faz 2 maddeleri eklendi

**Test altyapısı notu (Bug #7'nin devamı):** `vi.mock()` bu backend'de (CommonJS) işe yaramıyor — Vitest'in ESM modül grafiği, düz `.js` CommonJS dosyalarının kendi iç `require()` çağrılarını yakalayamıyor. `aiGmFallback.test.js`'te bunun yerine `require.cache`'e chat.js yüklenmeden ÖNCE sahte `aiGm`/`rateLimiter` modülleri enjekte edildi (native Node require-cache tekniği). İleride benzer bir servis mock'lamak gerekirse bu dosyadaki yorum + deseni takip edin, `vi.mock` denemeyin.

Test durumu: backend **57/57**, frontend **12/12** yeşil.

**Gerçek AI ile tam manuel QA turu (2026-08-22, tester) — TAMAMLANDI:** Kullanıcının yeni key'i (farklı Google Cloud projesi) ile:
- 3 turluk gerçek bir sohbet (Elf/Büyücü karakterle, mahzen/sandık senaryosu) — hepsi `source: "ai"`, Türkçe/atmosferik, ırk/sınıfa özgü ayrıntılar içeriyordu ("keskin elf gözleriniz", "asanızın gölgesi"), ve turlar birbirine tutarlı referans veriyordu (AI gerçekten `recentMessages` bağlamını kullanıyor).
- State mutasyonu kontrolü: sohbet öncesi/sonrası karakter (HP/mana/envanter) ve sahne (token pozisyonu/loot/round) birebir karşılaştırıldı — **hiçbir alan değişmedi**, AI sadece anlatım üretiyor.
- Gerçek rate-limit aşımı: `AI_HOURLY_LIMIT=2` ile backend başlatılıp 4 mesaj gönderildi → 1-2. `source:"ai"`, 3-4. `source:"mock"` (tam beklendiği gibi), tarayıcıda "(mock)" etiketi doğru göründü.
- Önceki billing-blocker (429) senaryosu da hem coder hem tester tarafından ayrı ayrı canlı doğrulanmıştı (fallback kusursuz çalıştı) — bkz. QA_CHECKLIST.md Faz 2 bölümü.

**Faz 2 KAPANDI.** Bilinen açık madde yok.

**Ortam notu (tester, bu oturumda keşfedildi):** Bu Windows/Git-Bash ortamında `lsof` komutu YOK — `lsof -ti:PORT | xargs kill` deseni sessizce no-op oluyor ve arkada eski (stale) bir node process çalışmaya devam edebiliyor, bu da "restart ettim ama state hâlâ eski" gibi kafa karıştırıcı sonuçlara yol açtı. Doğru yöntem: `netstat -ano | grep ":PORT" | grep LISTENING` ile PID bulup `taskkill //PID <pid> //F` kullanmak.

## Faz 3 — Karakter Yaratımı, BG3-Esinli Savaş Sistemi, Zengin AI Anlatımı

Kullanıcının kendi elle test edip verdiği geri bildirim (2026-08-22). Kapsam büyük, kullanıcı kararı: tek Faz 3 olarak veriliyor, ekip mantıklı bir sırayla uygulasın (önerilen sıra aşağıda A→E, ama sıkı bir kural değil). Mevcut ekran düzeni (macera günlüğü/sohbet merkezde, taktik kare kenarda, envanter) kullanıcı tarafından ONAYLANDI, DEĞİŞTİRİLMEYECEK.

### A) Karakter oluşturma akışı — yeniden tasarım [x] TAMAMLANDI (commit ba79a89)
- [x] Stat ataması artık **manuel seçim değil, D20 zar atarak rastgele** belirleniyor — `POST /api/character/roll-stats` (ırk bonusu uygulanmış), frontend'de kısa bir "zarlar yuvarlanıyor" animasyonu (rastgele değerler ~700ms) gerçek sonuca oturuyor
- [x] Yeni adım: **dış görünüş** seçimi — `data/appearances.js`'te 5 seçenek, form'a dropdown eklendi
- [x] İsim girişinden sonra, oyun ekranına geçmeden önce **AI'ın ürettiği açılış hikayesi** gösteriliyor — `POST /api/character/intro`, ayrı prompt (`generateOpeningStory`), key yoksa/hata olursa `data/openingFlavor.js` mock şablonuna düşüyor (Faz 2 ilkesiyle tutarlı), yeni `IntroScreen.tsx` "Devam Et" ile oyuna geçiyor. Açılış mesajı ayrıca sohbet geçmişine ilk GM mesajı olarak da ekleniyor.

**Bilinen test kırılmaları (kasıtlı tasarım değişikliği, tester güncellemeli):**
- `backend/tests/character.test.js`: "insan ırkı tüm attribute'lara +1 bonus uygular" testi deterministik 11/11/... bekliyordu, artık zar rastgele — RNG mock'lanmalı (Bug #7'deki require-cache deseni `services/dice.js` için de kullanılabilir).
- Frontend: `CharacterCreation.test.tsx`, `App.test.tsx`, `CharacterCard.test.tsx` eski tek-adımlı akışı / eski `Character` tipini (appearance alanı yok) varsayıyor — `tsc -b` (yani `npm run build`) bu dosyalarda tip hatası veriyor. Uygulama kodu (test hariç) hem `tsc --noEmit` hem `vite build` ile temiz.

### B) Ekran düzeni — DEĞİŞİKLİK YOK
- Macera günlüğü (sohbet) merkezde, taktik kare kenarda, envanter mevcut haliyle kalıyor — kullanıcı onayladı.

### C) Taktik/savaş sistemi — Baldur's Gate 3'ten esinlenerek [x] TAMAMLANDI (commit 02751c1)
- [x] Hareket hakkı: kare başına maksimum **4 → 5** kareye çıkarıldı (`data/sceneFactory.js`)
- [x] **Aksiyon ekonomisi**: token'lara `actionAvailable`/`bonusActionAvailable` eklendi, `end-turn` yeni aktif token için sıfırlıyor. PM onaylı kapsam: item kullan + fırlat Aksiyon harcıyor (ve harcanmışsa/oyuncunun sırası değilse 400 dönüyor), kuşan/çıkar/at bedava kalıyor. Bonus Aksiyon şu an hiçbir eylem tarafından tüketilmiyor (mevcut kapsamda buna ihtiyaç duyan bir eylem yok, alan hazır bekliyor).
- [x] **Büyü/mana sistemi**: PM onaylı karar — ayrı 5e slot tablosu eklenmedi, mevcut mana havuzu büyü kaynağı olarak kalmaya devam ediyor (somut bir büyü listesi olmadığı için).

### D) AI anlatım kalitesi [x] TAMAMLANDI (commit 02751c1)
- [x] Prompt'a **5 duyu betimlemesi** talimatı eklendi (`services/aiGm.js` buildPrompt)
- [x] **Eylem çözümlemesi zar ile**: `services/actionResolver.js` — mesajdan ilgili stat sezilir (saldırı→GÜÇ, inceleme→BİLGELİK, ikna→KARİZMA, diğer→ÇEVİKLİK), D20+modifier vs DC 12 ile başarı/başarısızlık/kritik belirlenir. Zar backend'de atılıyor, AI'a bağlam olarak veriliyor ve AI sadece SONUCA göre anlatıyor (kendi zarını uydurmuyor) — Faz 2 ilkesiyle tutarlı. Mock fallback da outcome'a göre kısa bir ek cümle ekliyor. `gmMessage.roll` alanında QA/debug için tam zar detayı dönüyor, ChatPanel'de gösteriliyor.

**Bilinen küçük eksik:** Aksiyon tespiti basit anahtar kelime regex'i kullanıyor (gmFlavor.js'teki kategori mantığına benzer) — "saldırıyorum" gibi bazı yazım varyasyonları (dotsuz/dotlu ı) beklenen "GÜÇ" yerine varsayılan "ÇEVİKLİK"e düşebiliyor. Fonksiyonel bir hata değil (zar mekaniği doğru çalışıyor, sadece hangi stat kullanıldığı bazen tahmini), ama not düşüyorum.

### E) Fırlatma UX'i iyileştirme [x] TAMAMLANDI (commit 59727ef)
- [x] x/y formu kaldırıldı, "Fırlat" tıklanınca grid hedef seçim moduna geçiyor (BG3 tarzı), bir kareye tıklayarak fırlatılıyor.

### Tester
- [x] A, E, C, D implemente edildikçe testler güncellendi/genişletildi — backend **104/104** (yeni: `dice.test.js`, `characterIntro.test.js`, `actionResolver.test.js`, `scene.test.js`'e Aksiyon ekonomisi gating testleri, `chat.test.js`'e `roll` alanı testi), frontend **31/31** (yeni: `ChatPanel.test.tsx` baştan, `TacticalGrid.test.tsx`'e fırlatma-modu + Aksiyon göstergesi testleri, `CharacterCreation.test.tsx` D20 akışına göre yeniden yazıldı). `tsc -b` ve `vite build` temiz.
- [x] Faz 3 sonunda tam regresyon QA'sı yapıldı (Playwright/chromium ile uçtan uca) — bkz. aşağı ve `QA_CHECKLIST.md`

**Faz 3 (A, C, D, E) tamamen kapandı** — coder implementasyonu + tester test/QA turu bitti. B zaten değişiklik gerektirmiyordu.

**Takip maddesi (PM, düşük öncelik, blocker değil):** `actionResolver.js`'deki `detectActionAttribute`'un BİLGELİK anahtar kelimesi `ara` çapasız (unanchored substring) olduğu için Türkçe'de çok yaygın olan "-ara-" hecesini içeren kelimelerde (`duvarA`, `kaçARAk`, `karanlığA`...) yanlışlıkla tetikleniyor — tester tarafından `actionResolver.test.js`'te somut örneklerle doğrulandı, coder'ın zaten not düştüğü "ı/i varyasyonu" sorunundan daha geniş kapsamlı bir kök neden. Zar mekaniği bozuk değil, sadece bazen yanlış stat/modifier ile atılıyor. Öneri: `ara` yerine `\bara\b` gibi kelime sınırlı regex. Faz 3 regresyonunu bloke etmiyor.

**Yeni bug bulundu (tester, regresyon QA — Faz 3.5'e alınabilir, blocker değil):** TacticalGrid'deki "Aksiyon: ✓/✗ · Bonus: ✓/✗" göstergesi, envanterden `CharacterCard` üzerinden tetiklenen eylem-tüketen aksiyonlardan (Kullan, Fırlat) sonra ANINDA güncellenmiyor. Backend Aksiyon hakkını doğru tüketiyor (ikinci kullanım gerçekten 400 "Bu tur için Aksiyon hakkın kalmadı." ile reddediliyor — canlı doğrulandı), ama gösterge bir sonraki sahne fetch'ine (hareket/Turu Bitir/grid-üzerinden fırlatma) kadar yanlışlıkla "✓" göstermeye devam ediyor. Kök neden: `TacticalGrid` kendi `scene` state'ini tutuyor, sadece kendi tetiklediği aksiyonlarda (`move`/`end-turn`/grid-throw) `setScene` çağırıyor; `CharacterCard`'ın `onCharacterChange` callback'i `TacticalGrid`'i haberdar etmiyor. (Grid üzerinden fırlatma — TacticalGrid'in kendi yönettiği akış — göstergeyi doğru güncelliyor, bu da kök nedeni doğruluyor.) Öneri: sahne state'ini `App.tsx`'e taşımak (lift state) ya da `CharacterCard`'ın aksiyon tüketen çağrılarından sonra da bir sahne refetch'i tetiklemek.

**Küçük içerik notu:** Mock GM cevabı + outcome eki kombinasyonu bazen ton olarak çelişebiliyor — örnek: "Rakibin geri sekiyor." (ATTACK_RESPONSES şablonu) + "Ve işler olabileceğin en kötü şekilde ters gitti." (critical-failure eki) aynı cümlede yan yana geldi. Fonksiyonel değil, sadece okuma deneyimi açısından not.

**QA notu:** Bu regresyon turunda gerçek Gemini AI cevabı doğrulanamadı — önceki Faz 2 turunda kullanılan key kotası tükenmiş (429), bu yüzden intro + chat akışları mock'a düştü. Fallback yine kusursuz çalıştı (konsol/sayfa hatası yok), ama Faz 3'ün "5 duyu betimlemesi" ve zar-sonucu-bağlamlı AI anlatımı gerçek bir AI cevabıyla henüz görsel olarak doğrulanmadı — yeni/dolu kotalı bir key ile tekrar denenebilir.

## Faz 3.5 — Bug Fix (tester regresyon QA sonucu)

### Coder
- [x] Bug A (commit eb04d66): `App.tsx`'e `sceneRefreshTick` eklendi — `CharacterCard`'ın `onCharacterChange`'i artık bu sayacı da artırıyor, `TacticalGrid` bunu `refreshKey` prop'u olarak alıp sahneyi yeniden çekiyor. Sahne state'i tam lift edilmedi (daha küçük bir müdahale tercih edildi), ama sonuç aynı: Kullan/Fırlat sonrası Aksiyon/Bonus göstergesi artık anında güncelleniyor.
- [x] Bug B (commit eb04d66): Kategori regex'leri Türkçe harfleri tanıyan bir kelime-başı sınırıyla (`WORD_START`) sarmalandı — "duvara"/"kaçarak" artık yanlışlıkla BİLGELİK'e düşmüyor (node ile doğrulandı). Ayrıca aşırı genel "it" kökü STR listesinden çıkarıldı (aynı sınıf false-positive riski taşıyordu: "itiraz", "itibar"), "saldır" için dotsuz/dotlu ı toleransı eklendi.
- [ ] (opsiyonel, düşük öncelik, dokunulmadı) Mock GM + outcome eki ton çelişkisi — "Rakibin geri sekiyor" + "işler kötü gitti" gibi kombinasyonlar; sadece okunabilirlik notu, isterse ele alınır

### Tester
- [x] Bug A doğrulandı — canlı tarayıcıda (Playwright): karakter oluştur → eşya "Kullan" → Aksiyon göstergesi ARADA HİÇBİR hareket/end-turn olmadan anında "✓"→"✗" değişti. Regresyon yok.
- [x] Bug B doğrulandı — `actionResolver.test.js`'teki eski (buggy) `"wis"` beklentisi doğru sonuca (`"dex"`) çevrildi + `araştır` kökünün hâlâ doğru çalıştığını, `saldır`'ın ı/i toleransını ve `it` kökünün kaldırıldığını doğrulayan 3 yeni test eklendi. `node -e` ile de canlı doğrulandı (duvara/kaçarak/karanlığa artık dex, saldırıyorum/saldiriyorum ikisi de str, itiraz/itiyorum artık str değil).
- [x] Test durumu: backend **107/107**, frontend **31/31**, tsc+vite build temiz.

**Faz 3.5 KAPANDI.** Bilinen açık bug yok (mock+outcome ton notu kayıtlı ama düşük öncelikli, blocker değil).

### Not
Gerçek Gemini key kotası bu turda yine tükendi (429) — Faz 3'ün "5 duyu betimlemesi" gerçek bir AI cevabıyla henüz görsel doğrulanmadı, fallback sorunsuz çalıştı. Yeni/dolu kotalı bir key gelirse tekrar denenmeli.

## Faz 4 — Hareket Bugları, Ekipman Slotları, Basit Düşman AI, BG3 Görsel Stili

Kullanıcının elle test edip verdiği geri bildirim. Kullanıcı kararları: düşman AI'ı **basit scriptli** olacak (oyuncuya doğru hareket + yakınsa saldırı, karmaşık strateji yok, AI/LLM çağrısı YOK — maliyet/darboğaz ilkesiyle tutarlı); "BG3 gibi olsun" isteği sadece **görsel/estetik** kapsamında (renk, buton stili, panel yerleşimi) — savaş mekaniği derinliği (kapak, yükseklik vb.) ve AI görsel üretimi bu fazda KAPSAM DIŞI.

### Coder — öncelik sırasıyla (A ve B gerçek bug, önce onlar) [x] TAMAMLANDI
- [x] Bug A (commit 3652ea3): `/scene/move`'a Bresenham yol kontrolü eklendi (`services/sceneState.js`), kaynaktan hedefe düz çizgi bir engelle kesişirse "Yol bir engelle kesiliyor." ile reddediliyor. Tam pathfinding değil (basit yeterli, PM notuyla uyumlu).
- [x] Bug B (commit 3652ea3): Kök neden — mesafe kontrolü sabit `token.speed`'e karşı yapılıyordu, aynı turda birden fazla `/move` çağrısı kümülatif sınırlanmıyordu (regresyon değil, hiç enforce edilmemiş). Token'lara `movementLeft` eklendi, her hareket düşürüyor, `end-turn` yeni token için `speed`'e sıfırlıyor. Frontend'de "Hareket: kalan/max" göstergesi eklendi.
- [x] Ekipman slotları (commit d54a62c): `data/itemSlots.js` — eşya adı→slot eşlemesi (head/chest/arms/legs/feet/hand, slotu olmayanlar null). `item/equip` artık slotu null olan eşyayı reddediyor (400), aynı slotta başka kuşanılmış eşya varsa önce onu çıkarıyor. CharacterCard'da "Ekipman" başlığı altında 6 slotluk paper-doll görünümü.
- [x] Basit düşman AI (commit 91d9d64): `services/enemyAI.js` — düşman sırası geldiğinde `end-turn` içinde OTOMATİK olarak çözülüyor (greedy hareket + bitişikse D20+2 vs DC12 saldırı, başarılıysa d6 hasar), sıra hemen oyuncuya geri dönüyor. Ek AI/LLM çağrısı yok, tamamen deterministik. Sonuç mesajları sohbet geçmişine ekleniyor (`source: "mock"`).
- [x] BG3 görsel stili (commit d6c4f80): Google Fonts (Cinzel/Spectral), bronz/altın vurgulu ornate panel çerçeveleri, gradient buton/bar stilleri. Panel yerleşimi değişmedi. Bonus: `index.css`'teki alakasız Vite şablon kalıntısı temizlendi.

**Davranışsal not (Bug değil, tasarım gereği):** `/scene/end-turn`'ün yanıt şekli korundu (hâlâ sahneyi düz/top-level döndürüyor, üzerine `enemyMessages` eklendi — geriye dönük uyumlu) ama DAVRANIŞ değişti: artık tek bir `end-turn` çağrısı, düşman turu varsa onu da otomatik çözüp sırayı oyuncuya kadar ilerletiyor (eskiden manuel iki çağrı gerekiyordu). `backend/tests/scene.test.js`'teki 3 eski test bu eski akışı varsayıyordu, güncellenmesi gerekiyor.

### Tester
- [x] Bug A/B için regresyon testleri — `scene.test.js`: hedef boş ama yol engelden geçiyorsa 400, yol açıksa normal çalışıyor; ardışık hareketlerin kümülatif mesafesi budget'i aşınca red, dahilindeyse kabul, end-turn'de sıfırlanıyor
- [x] Ekipman slot sistemi için testler — `itemSlots.test.js` (6 test) + `scene.test.js`'e slotu-olmayan-eşya-400 ve aynı-slotta-swap testleri + `character.test.js`'e create-time slot ataması testi + `CharacterCard.test.tsx`'e paper-doll render testleri (5 test)
- [x] Basit düşman AI için testler — `enemyAI.test.js` (moveEnemyToward + runEnemyTurn doğrudan birim testleri, Math.random mock ile deterministik) + `scene.test.js`'e end-turn üzerinden uçtan uca senaryolar (yaklaşma mesajı, isabetli saldırı+hasar, nat1 ıskalama, aksiyon tüketimi, chat history'ye ekleniyor)
- [x] Eski 3 end-turn testi yeni atomik-tur-çözümleme davranışına göre güncellendi (regresyon değil, kasıtlı davranış değişikliği)
- [x] Görsel stil için tarayıcıda elle QA yapıldı (Playwright screenshot'ları) — bkz. aşağıdaki bulgu
- [x] Test durumu: backend **138/138**, frontend **38/38**, tsc+vite build temiz

**Tarayıcıda uçtan uca QA (Playwright, 2026-08-22):** Karakter oluştur → oyun ekranı → eşya kuşan (paper-doll'da doğru slotta göründü, gold border) → engelin arkasındaki boş bir kareye tek hamlede gitmeye çalış (reddedildi: "Yol bir engelle kesiliyor.") → art arda iki hareketle kümülatif limiti aş (reddedildi: "Hedef menzil dışında.", "Hareket: 2/5" göstergesi doğruydu) → Turu Bitir (düşman otomatik yaklaştı, "Goblin sana doğru yaklaşıyor." sohbete düştü, sıra hemen oyuncuya döndü). Konsol/sayfa hatası yok (sadece kasıtlı test 400'leri ve başlangıç 404'ü).

**BG3 görsel teması:** Cinzel/Spectral fontları doğru yükleniyor (Google Fonts + fallback stack), bronz/altın vurgulu ornate paneller, iyi kontrast, okunabilirlik sorunu yok, bozuk layout yok. Görsel olarak başarılı.

**⚠️ Bulgu — panel yerleşimi onaylanan spesifikasyona ters:** Hem Faz 3-B ("Macera günlüğü (sohbet) merkezde, taktik kare kenarda... kullanıcı onayladı") hem Faz 4-B ("sol=karakter bilgisi, orta=günlük/sohbet, sağ=taktik harita") açıkça **sohbetin ORTADA** olmasını istiyor. Ama gerçek render'da (`App.css:31` — `grid-template-columns: 280px 1fr 320px`, DOM sırası `CharacterCard → TacticalGrid → ChatPanel`) **taktik harita ortada (1fr, en geniş sütun), sohbet sağda** görünüyor — iki fazdır tam tersi. Bu Faz 4'ün yeni bir regresyonu değil (DOM/CSS sırası muhtemelen Faz 1'den beri hiç değişmedi), ama iki ayrı kullanıcı onayına rağmen hiç düzeltilmemiş. Ekran görüntüsüyle doğrulandı. Düzeltme küçük: `App.tsx`'te `<TacticalGrid>` ve `<ChatPanel>`'in DOM sırasını değiştirmek yeterli olabilir (grid-template-columns'un orta sütunu zaten `1fr` genişlikte, sohbete daha uygun).

**[x] Düzeltildi (commit 673f7f0, coder):** `App.tsx`'te `ChatPanel`/`TacticalGrid` DOM sırası değiştirildi (artık orta sütun sohbet, sağ sütun harita). `App.css`'te sağ sütun genişliği 320px→380px yapıldı (10 genişlikli taktik grid'in daha rahat sığması için). tsc+build temiz, frontend 38/38 yeşil.

**[x] Tester tarafından görsel olarak doğrulandı (2026-08-22):** Tarayıcıda (Playwright) DOM sırası kontrol edildi — `.app-main` çocukları artık `character-card → chat-panel → tactical-grid` sırasında, ekran görüntüsünde de sol=karakter, orta=Macera Günlüğü (geniş sütun), sağ=Terk Edilmiş Mahzen (taktik harita, 380px) doğru şekilde render ediliyor. Konsol hatası yok. **Faz 3-B/4-B'de onaylanan yerleşim artık gerçekten uygulanmış durumda.**

**Faz 4 TAMAMEN kapandı — bilinen açık madde yok** (mock+outcome ton notu ve daha önceki düşük öncelikli notlar hariç, blocker değil).

## Faz 5 — Vurma Mekaniği, Hareket Sonrası Otomatik Anlatıcı, İkon Tabanlı Envanter

Kullanıcının el çizimi diyagram + ekran görüntüsü ile verdiği geri bildirim (2026-08-22). Üç madde:

### Coder
- [x] **Vurma/saldırı mekaniği** (commit 9ef818f): `POST /api/scene/attack` — bitişik bir düşman token'ına tıklanınca (TacticalGrid'de ayrı buton yok, BG3 tarzı tıkla-saldır) D20 + karakterin sınıfına göre primary attribute modifier'i vs DC 12 ile zar+hasar hesaplanıyor (d6, kritikte +d6), Aksiyon hakkı tüketiyor, sonuç hem hedefin HP'sine (0'a inince sahneden kaldırılıyor) hem chat'e (AI/mock anlatımla) yansıyor. `enemyAI.js`'in düşman saldırı mantığıyla simetrik (aynı DC/zar boyutu).
- [x] **Hareket sonrası otomatik anlatıcı** (commit 9ef818f): `/scene/move` başarılı olduğunda otomatik olarak kısa bir AI/mock anlatım üretilip chat'e ekleniyor. Fallback ilkesi korundu. Not: AI dene→mock'a düş mantığı `services/narrationService.js`'e çıkarıldı (chat.js, attack, move üçü de paylaşıyor — kod tekrarı önlendi).
- [x] **İkon tabanlı envanter/ekipman** (commit 3550ebe): `backend/scripts/extractIcons.js` — DMI metadata'sını (zTXt Description chunk) parse edip her slot için doğru state'i (ilk tile değil — bazı dosyalarda ilk state kasıtlı boş/animasyonlu bir yer tutucu, örn. `head/default.dmi`, bunu görsel olarak "ERROR" metni çıkararak fark ettim, düzeltip doğru state'i (`head/hats.dmi` → "tophat" gibi) hedefleyecek şekilde script'i geliştirdim) kesip `frontend/public/icons/` altına 12 PNG olarak yazdı — hepsini Read tool ile görsel olarak tek tek doğruladım (gözlük, cerrahi maske, kemer, eldiven, şapka, zırh net tanınıyor). SS13 tarzı 13 slota geçildi (`data/itemSlots.js`): head/mask/glasses/ears/neck/back/suit/under/gloves/belt/shoes/accessories/hand. Mevcut eşyalar yeniden eşlendi (Deri Zırh→suit, Kalkan→back [SS13 listesinde kalkan slotu yoktu, en yakın karşılık — not düşüldü], silahlar→hand [asset setinde silah ikonu yok, emoji fallback ⚔]). Paper-doll artık 3 sütunlu, ikonlu ve tıklanabilir (dolu slota tıklamak çıkarır); envanter listesindeki her eşya küçük bir ikon gösteriyor. CC BY-SA 3.0 atıf notu App.tsx footer'ına eklendi (lisans yükümlülüğü).
  **Not:** Grafik/asset işleme ortamda görsel önizleme aracı olmadığından her ikonu Read tool'un görsel render özelliğiyle tek tek kontrol ettim — bu sayede ilk yaklaşımın (kör kör ilk tile'ı almak) `head`/`suit` için yanlış (boş/error placeholder) kare seçtiğini yakaladım, PM'in "ilk state genelde yeterli" notusu bu iki dosya için geçerli değildi.

### Tester
- [x] Vurma mekaniği için testler — `scene.test.js`'e 16 test (hedef/karakter bulunamadı, sıra/Aksiyon kontrolü, menzil dışı red, isabetli saldırı+hasar+HP düşüşü, nat1 ıskalama, nat20 kritik çift zar, hedef ölünce sahneden kalkması + "yenildi" anlatımı, ölü hedefe tekrar saldırının reddi, sohbete ekleniyor, sınıfın primary attribute'ünü kullanması) — Math.random mock ile deterministik
- [x] Hareket sonrası otomatik anlatıcı için testler — `scene.test.js`'e 3 test (narration alanı dolu + sohbete ekleniyor, mock fallback, başarısız harekette narration üretilmiyor); `narrationService.test.js` (yeni, 6 test) ile paylaşılan fallback servisi doğrudan test edildi
- [x] Frontend: `TacticalGrid.test.tsx`'e bitişik-düşmana-tıkla-saldır testleri (attackTarget çağrılıyor/moveToken çağrılmıyor, onCharacterChange/onChatActivity tetikleniyor, boş hücre hâlâ hareket ediyor, ipucu metni doğru koşullarda görünüyor, tooltip HP gösteriyor)
- [x] Tarayıcıda (Playwright) uçtan uca canlı doğrulama: hareket sonrası anlatım sohbete düştü ("Bir an için sessizlik çöküyor, sonra uzaktan boğuk bir kükreme duyuluyor."), düşman birkaç turda yaklaşıp bitişik olunca oyuncuya saldırdı (4 hasar, HP 12→8, doğru mesaj formatı: "Goblin sana vuruyor! 4 hasar aldın. (18+2=20 vs 12, HP: 8/12)"), oyuncu karşı saldırdı (Aksiyon ✗'e döndü, "Saldırın hedefi buluyor, ama karşı taraf henüz düşmedi." sohbete düştü). Konsol/sayfa hatası yok.
- [x] Test durumu: backend **159/159**, frontend **44/44**, tsc+vite build temiz.
- [x] İkon envanteri (commit 3550ebe) test + görsel QA'sı tamamlandı — bkz. aşağı

**Faz 5 madde 1-2 KAPANDI.**

**Faz 5 madde 3 (ikon envanteri) test/QA sonucu:**
- Backend testleri SS13 slot adlarına (chest→suit, arms→back) güncellendi + yeni testler eklendi: `itemSlots.test.js`'e `getIconForSlot` testleri (bilinen slot→doğru yol, "hand"→null, bilinmeyen slot→null, tüm SLOTS'un SLOT_ICONS'ta karşılığı var) ve 13 slotun tam listesi; `character.test.js`'e create-time icon ataması testi (armor→`/icons/suit.png`, hand-slotlu silah→null çünkü asset setinde silah ikonu yok, slotsuz eşya→null).
- Frontend `CharacterCard.test.tsx` Faz 5-3'e göre baştan yazıldı: 13 slotun etiketleriyle render edilmesi, dolu slotun ikonuyla+`filled` class'ıyla gösterilmesi, boş slotun "·" yer tutucusu, "hand" slotunun boşken bile ⚔ emoji fallback göstermesi (equippedItem'dan bağımsız render — bilinçli belgelendi), dolu bir slota tıklamanın eşyayı çıkarması (`equipItem` çağrısı, mock'landı) ve boş slotun disabled olması, envanter listesindeki ikon thumbnail'lerinin doğru/yanlış eşyalarda görünüp görünmemesi.
- Test durumu: backend **165/165**, frontend **49/49**, tsc+vite build temiz.
- **Tarayıcıda (Playwright) görsel QA — kritik, çünkü coder screenshot alamamıştı:** 13 slotlu paper-doll doğru render edildi (3 sütun), tüm ikonlar gerçekten yüklendi (`naturalWidth: 32`, `complete: true` — DOM'da kırık/placeholder img yok), "Zırh" slotundaki ikon zoom'lanmış ekran görüntüsünde net bir zırh/yelek sprite'ı olarak tanındı (ERROR/bozuk görüntü YOK), "El" slotu ⚔ emoji fallback'i doğru gösterdi, boş slotlar "·" gösterdi, dolu slota tıklayınca eşya başarıyla çıkarıldı (paper-doll güncellendi). **CC BY-SA 3.0 atıf notu sayfanın altında gerçekten görünüyor**: "İkonlar /tg/station projesinden, CC BY-SA 3.0 lisansı altında alınmıştır (github.com/tgstation/tgstation)." Konsol/sayfa hatası yok (sadece beklenen başlangıç 404'ü).

**Faz 5 (madde 1, 2, 3) TAMAMEN KAPANDI.** Bilinen açık bug yok.

**Bilinen test kırılmaları (kasıtlı slot sistemi değişikliği, tester güncellemeli):** `backend/tests/itemSlots.test.js` + `character.test.js`'teki 2 test eski "chest"/"arms" slot adlarını bekliyor (artık "suit"/"back"). `frontend/CharacterCard.test.tsx`'teki 3 test eski "Göğüs" slot etiketini ve "(boş)" metnini bekliyor (artık ikon/emoji gösteriliyor, metin yok).

## Faz 6 — Çoklu Kullanıcı Altyapısı + Kalıcılık + Oyun Döngüsü

PM'in kendi değerlendirmesi (kullanıcı onayladı): Proje şu ana kadar tek kişilik bir demo gibi çalışıyor — backend'de TEK bir global karakter/sahne/sohbet state'i var, herkes aynı state'i paylaşıyor, ve her şey RAM'de (server restart'ta her şey siliniyor). "Kullanıcılara açma" hedefi için bunlar olmadan ilerlemek anlamsız. Kullanıcı kararı: önce A+B (altyapı), sonra C (oyun döngüsü).

### A) Oturum izolasyonu (öncelik 1, en kritik) [x] TAMAMLANDI (commit 91e4ebf)
- [x] Frontend: `session.ts` — ilk ziyarette `crypto.randomUUID()` ile session ID üretilip `localStorage`'a (`dnd-session-id`) kaydediliyor, bellek-içi cache'leniyor; `api.ts`'teki her istek `X-Session-Id` header'ı gönderiyor
- [x] Backend: `services/sessionId.js` header'ı okuyor (yoksa `"default"`'e düşüyor — geriye dönük uyumluluk). `data/store.js`'e `activeCharacterIdBySession` eklendi; `chatHistories`/`scenes` zaten sessionId'ye göre anahtarlanan Map'lerdi, artık gerçek sessionId ile anahtarlanıyor (sabit `"default"` yerine). `characters` hâlâ characterId'ye göre global (id'ler benzersiz)
- [x] Rate limiter kasıtlı olarak GLOBAL bırakıldı (PM kararıyla tutarlı) — testle doğrulandı (`allowRequest()` parametresiz)
- [x] Var olmayan/eskimiş sessionId → mevcut karakter/sahne yok davranışıyla tutarlı (404 karakter yoksa, sahne lazy-init ediliyor)

**Tester notu (mimari, bug değil):** `item/use|equip|drop|throw` ve `/attack` endpoint'leri `characterId`'yi body'den alıp doğrudan global `characters` Map'inde arıyor — sessionId'nin o characterId'nin GERÇEK sahibi olduğunu doğrulamıyor. nanoid'ler tahmin edilemez olduğu için pratik risk düşük, ama mimari olarak "characterId bilmek = erişim" varsayımına dayanıyor. Test edilip belgelendi (`sessionIsolation.test.js`), bug olarak açılmadı — ileride (özellikle B/kalıcılık sonrası, hesaplar kalıcı hale gelince) tekrar gözden geçirilmesi önerilir.

#### Tester (A — oturum izolasyonu)
- [x] `sessionIsolation.test.js` (yeni, 10 test): iki farklı `X-Session-Id` ile karakter oluşturma/görüntüleme birbirinden bağımsız, A'nın karakter güncellemesi B'yi etkilemiyor, A B'den SONRA oluşturulsa bile ikisi de kendi karakterini görüyor (eski "son oluşturulan karakter" hack'i tamamen gitmiş), header yoksa `"default"`'e düşüyor, sahne izolasyonu (hareket/end-turn birbirini etkilemiyor), sohbet izolasyonu (A'nın mesajı B'de görünmüyor), GM anlatımının doğru session'ın karakterine göre üretilmesi, rate limiter'ın gerçekten global kaldığı, characterId-sahiplik-doğrulaması-yok mimari notunun testle belgelenmesi
- [x] `session.test.ts` (yeni, 5 test): ilk çağrıda UUID üretilip localStorage'a yazılıyor, var olan id yeniden kullanılıyor, aynı modülde cache'leniyor (randomUUID sadece 1 kez çağrılıyor), localStorage erişilemezse (gizli sekme) çökmeden bellek-içi id dönüyor
- [x] `api.test.ts` (yeni, 3 test): her istek `X-Session-Id` header'ı taşıyor, ardışık isteklerde aynı id kullanılıyor, id localStorage'a yazılıyor
- [x] Test durumu: backend **175/175**, frontend **57/57**, tsc+vite build temiz
- [x] **Tarayıcıda gerçek çoklu-kullanıcı testi (Playwright, iki AYRI browser context = iki gerçek izole kullanıcı, 2026-08-22):** İki farklı karakter oluşturuldu (OyuncuA, OyuncuB) — her ikisi de sadece kendi ismini görüyor, birbirininkini görmüyor; A sohbete mesaj gönderdi, B'nin sohbeti tamamen boş/etkilenmemiş kaldı; A grid'de hareket etti, B sayfayı yenileyince kendi token'ı hâlâ başlangıç konumunda (A'nın hareketi hiç yansımadı); iki farklı `dnd-session-id` localStorage'da doğrulandı. Konsol hatası yok (sadece beklenen başlangıç 404'leri).

**Faz 6-A TAMAMEN KAPANDI** — bilinen açık bug yok (characterId-sahiplik notu mimari gözlem, blocker değil).

### B) Kalıcılık (öncelik 2) [x] TAMAMLANDI (commit 170adf3)
- [x] `backend/data/db.js` — `better-sqlite3` ile tek dosyalık DB (`game.db`), 4 tablo: characters/scenes/chat_histories/sessions. Test koşumlarında (`process.env.VITEST`) otomatik `:memory:` kullanılıyor — paylaşılan `game.db`'yi kilitleyip aynı makinedeki diğer session'ların eşzamanlı `npm test` koşumlarıyla çakışmasın diye (gerçekten çakıştığını gördüm, dosya "busy" hatası verdi, bu yüzden bu düzeltmeyi ekledim).
- [x] `backend/services/persistence.js` — repository katmanı: `loadAll()` sunucu açılışında DB'deki her şeyi in-memory Map'lere yüklüyor, `saveCharacter/saveScene/saveChatHistory/saveActiveCharacterId` her mutasyon noktasından çağrılıyor. **Tasarım kararı:** mevcut route kodu nesneleri hep REFERANSLA mutasyona uğratıyor (`.set()`'i tekrar çağırmadan) — "şeffaf DB-destekli Map" yaklaşımı bunu sessizce bozardı (her `get()` DB'den taze bir kopya dönerdi, mutasyonlar hiçbir yere yazılmazdı). Bunun yerine in-memory Map çalışma-zamanı otoritesi olarak kaldı, SQLite sadece restart'lar arası bir "gölge" kopya — her mutasyon noktasına (move/end-turn/attack/item aksiyonları/character create-update/chat/intro) açıkça `saveX()` çağrısı eklendi.

**Doğrulama:** izole bir `DB_PATH` ile karakter oluşturdum, hareket ettim, sohbet ettim, sunucuyu tamamen kapatıp yeniden başlattım — karakter/pozisyon/sohbet geçmişi birebir korundu. backend 175/175, frontend 57/57 yeşil, tsc+build temiz.

#### Tester (B — kalıcılık)
- [x] `persistence.test.js` (yeni, 9 test): `saveCharacter`/`saveScene`/`saveChatHistory`/`saveActiveCharacterId` DB'ye doğru yazıyor (upsert — aynı id ikinci kez yazılınca satır çoğalmıyor, günceller); `loadAll()` DB doluyken Map'leri doğru dolduruyor, DB boşken hata vermeden çalışıyor, `active_character_id` NULL olan bir session satırını atlıyor; **uçtan uca "restart" testi**: gerçek route çağrılarıyla (create+move+chat) state oluşturup in-memory Map'leri elle temizleyip `loadAll()` çağırdım, YENİ bir app/request ile aynı sessionId üzerinden karakter/pozisyon/sohbet geçmişinin birebir geri geldiğini doğruladım
- [x] **Gerçek dosya DB'siyle canlı doğrulama (test suite'inin kullandığı `:memory:` değil) — PM'in istediği gibi:** backend'i gerçek `game.db` ile başlattım, karakter oluşturdum, grid'de hareket ettim (x:2,y:1), sohbet ettim, PID'i `taskkill` ile GERÇEKTEN sonlandırıp backend'i yeniden başlattım. Restart sonrası: karakter adı/HP/envanter birebir aynı, oyuncu token'ı tam x:2,y:1'de (movementLeft:4, hareketin doğru düşürüldüğü de korunmuş), sohbet geçmişindeki 3 mesaj (açılış + oyuncu mesajı + GM cevabı) eksiksiz geri geldi.
- [x] Test durumu: backend **184/184**, tsc/build gerekmiyor (backend-only), frontend değişmedi (57/57 hâlâ geçiyor)

**Faz 6-B TAMAMEN KAPANDI** — bilinen açık bug yok.

**[x] Ek düzeltme (commit 309cb89, coder):** Tester'ın Faz 6-A'da bulduğu "characterId sahiplik doğrulaması yok" mimari notu PM onayıyla giderildi. `routes/scene.js`'e `requireOwnedCharacter()` helper'ı eklendi (karakter yoksa 404, session'ın aktif karakteri değilse 403) — `attack`, `item/use`, `item/equip`, `item/drop`, `item/throw` ve `character.js`'teki `/intro` endpoint'lerine uygulandı.

**[x] Tester doğrulaması:** Eski (200 bekleyen) tasarım-notu testi `403` bekleyecek şekilde güncellendi + kapsam genişletildi: `sessionIsolation.test.js`'e 6 test — `item/equip` 403 (state gerçekten değişmemiş), `item/use`/`item/equip`/`item/drop`/`item/throw`'un hepsi (`it.each`) 403, `/scene/attack` 403, `/character/intro` 403, sahibin kendi characterId'siyle hâlâ normal (200) çalıştığı regresyon testi, var olmayan characterId'nin 403 değil 404 döndüğü (öncelik sırası doğru: önce "var mı", sonra "sahibi mi"). Backend **192/192** yeşil.

### C) Oyun döngüsü tamamlama (öncelik 3, A+B'den sonra) [x] TAMAMLANDI (commit 5acc043 backend, ff82fbc frontend)
- [x] **Oyuncu ölümü**: `POST /api/character/reset` session'ın karakter/sahne/sohbet bağını temizliyor (karakter kaydı DB'de kalıyor, sadece session artık ona işaret etmiyor). `requireOwnedCharacter()` artık HP≤0 karakterlerin attack/cast/item endpoint'lerini 400 ile reddediyor (savaş fiilen duruyor). Frontend: `GameOverScreen.tsx` — `character.hp.current<=0` olunca oyun ekranı yerine gösteriliyor, "Yeniden Başla" `resetSession()`'ı çağırıp karakter oluşturma ekranına dönüyor.
- [x] **Seviye/XP sistemi**: `services/leveling.js` — düz formül: öldürme başına 20 XP, eşik = level×50. Eşik aşılınca level+1, HP.max +2 (tam iyileşme), mana.max +2 (varsa, tam dolum), sınıfın primary attribute'u +1. `/attack` ve `/cast` (Ateş Topu ile düşman öldürülürse) ikisi de `awardXp()` çağırıyor, seviye atlarsa chat'e yansıyor. Node ile 3 ardışık öldürmeyi simüle edip formülü doğruladım (2. öldürmede henüz atlamıyor, 3.'de 60xp≥50 eşiğini aşıp level 2'ye geçiyor, 10xp devrediyor).
- [x] **Büyü/yetenek seçimi**: `data/spells.js` + `POST /api/scene/cast` — "Ateş Topu" (menzilli hasar, range 3, d8, mevcut saldırı zar mantığıyla simetrik: D20+primaryAttribute modifier vs DC12) ve "İyileştir" (kendine sabit HP, zar yok). İkisi de 4 mana harcayıp Aksiyon tüketiyor, sadece `mana.max>0` olan sınıflar kullanabiliyor. Frontend: CharacterCard'da "Büyüler" bölümü (mana yetersizse buton devre dışı), Ateş Topu fırlatmaya benzer bir "hedef seç" moduna giriyor (TacticalGrid'de düşmana tıklayınca cast ediliyor), İyileştir doğrudan kendine uygulanıyor.

**Doğrulama:** İzole portta uçtan uca — İyileştir HP'yi doğru iyileştirip mana düşürdü, Ateş Topu menzil/mana kontrolü doğru çalıştı (başarısız atışlar da mana harcadı, sonra "yetersiz mana" ile reddedildi), karakter HP 0'a çekilince attack 400 ile reddedildi, `/reset` sonrası GET /character 404 döndü ve yeni karakter oluşturunca sahne SIFIRDAN geldi (goblin tam can/başlangıç konumunda). backend 216/216, frontend 57/57 yeşil (tester paralel test eklemiş, regresyon yok), tsc+build temiz.

#### Tester (C — oyun döngüsü frontend, 2026-08-22)
- [x] `GameOverScreen.test.tsx` (yeni, 2 test): karakter adı/seviyesi doğru gösteriliyor, "Yeniden Başla" `onRestart`'ı çağırıyor
- [x] `CharacterCard.test.tsx`'e Faz 6-C bloğu (6 test): `mana.max===0` iken "Büyüler" bölümü hiç render edilmiyor, mana kullanan karakterde iki büyü butonu de mana maliyetiyle gösteriliyor, mana yetersizken butonlar disabled, hedefsiz büyü (İyileştir) tıklanınca `onStartCast` ÇAĞRILMADAN doğrudan `castSpell` çağrılıyor, hedefli büyü (Ateş Topu) tıklanınca tam tersi (`castSpell` çağrılmıyor, `onStartCast` ile hedef-seç moduna giriliyor), `castingSpellId` eşleşince buton "Hedef Seçiliyor..." oluyor ve tekrar tıklanınca `onCancelCast` çağrılıyor
- [x] `TacticalGrid.test.tsx`'e Faz 6-C bloğu (5 test): büyü hedef-seç modunda düşmana tıklamak `castSpell`'i doğru argümanlarla çağırıyor (`attackTarget` DEĞİL), büyü modunda grid sıra düşmanda olsa bile devre dışı kalmıyor, başarılı castten sonra `onCastComplete`/`onChatActivity` çağrılıyor, `castingSpellId` yokken normal saldırı akışı bozulmuyor (regresyon) — **ve kritik bir gerçek bug'ı yakaladı:**
- [x] `App.test.tsx`'e Faz 6-C bloğu (3 test): `hp.current<=0` olunca `GameOverScreen` gösteriliyor (oyun ekranı değil), "Yeniden Başla" `resetSession()`'ı çağırıp karakter oluşturma ekranına dönüyor, `hp.current>0`'ken `GameOverScreen` hiç gösterilmiyor (regresyon)

**Bulunan ve coder tarafından anında düzeltilen bug (commit `a2d6bab`):** `TacticalGrid.tsx`'in `handleCellClick`'inde büyü hedef-seç modundayken (`castingSpellId` set) düşman OLMAYAN bir hücreye (kendi hücresi, boş kare) tıklamak `castSpell`'i çağırmıyordu ama sessizce `handleMoveTarget`'a düşüp `moveToken` çağırıyordu — yani "hedef seç" modundayken oyuncu yanlışlıkla hareket ettirilebiliyordu (throw modunda bu sorun yoktu, çünkü `throwingItemId` dalı erken `return` ediyor). Regresyon testiyle kırmızıya düşürüp raporladım, coder aynı oturumda no-op erken `return` ekleyerek düzeltti; test şimdi yeşil.

**Kritik altyapı bulgusu (bug değil, ortam/süreç sorunu — düzeltildi):** Canlı tarayıcı QA'sına başlayınca `/api/scene/cast` ve `/api/character/reset` **404 "Cannot POST"** döndürüyordu — backend test suite'i 216/216 yeşildi ama **çalışan dev server** (`node server.js`, watch modu değil) coder'ın Faz 6-C route'larını hiç yüklememiş eski bir process'ti (muhtemelen o commit'ten önce başlatılmış, restart edilmemiş). `netstat`+`taskkill` ile PID'i bulup `npm run dev` (`node --watch`) ile yeniden başlattım — sonrasında tüm endpoint'ler 200 döndü. **Ders:** frontend/backend "testleri yeşil" demek çalışan dev server'ın güncel kodu çalıştırdığı anlamına gelmiyor; büyük bir faz kapanışından önce dev server'ın gerçekten restart edildiğini doğrulamak gerekiyor.

- [x] Test durumu (restart sonrası): backend **216/216**, frontend **73/73**, tsc+vite build temiz
- [x] **Tarayıcıda uçtan uca canlı QA (Playwright, restart edilmiş backend'e karşı, 2026-08-22):** Büyücü karakteri oluşturuldu → "Büyüler" bölümü doğru render edildi → İyileştir'e tıklandı, mana 12/12→8/12 düştü, HP güncellendi, sohbete anlatım düştü → Ateş Topu'na tıklanınca "Büyü hedefi seç" moduna girdi (grid'de düşman tıklanabilir hale geldi) → "Turu Bitir" ile tur döngüsü ilerletilip HP 0'a düşürüldü → **GameOverScreen doğru render edildi** ("QA Buyucu, seviye 1'de düştü") → "Yeniden Başla" tıklanınca `resetSession` çağrıldı ve **Karakter Oluştur formuna başarıyla dönüldü**. Konsol hatalarının hepsi beklenen (400'ler menzil-dışı/HP-0 sonrası reddedilen istekler, birkaç başlangıç 404'ü) — gerçek/beklenmeyen hata yok.
- [x] **İki ayrı session ile Faz 6-A rejeksiyon testi (restart edilmiş backend'e karşı):** iki bağımsız browser context, iki farklı karakter/sohbet — hiçbiri diğerini görmüyor, farklı `X-Session-Id`'ler doğrulandı — Faz 6-A hâlâ sağlam.
- [x] **PM'in istediği "biri ölüp reset atarken diğeri etkilenmemeli" senaryosu (curl ile, gerçek `game.db`):** İki karakter (IsoA/IsoB) oluşturuldu, A `/character/reset` ile sıfırlandı (200, sonra GET /character 404) — B'nin karakteri (HP/envanter/isim) tamamen etkilenmeden 200 ile dönmeye devam etti.
- [x] **Gerçek dosya DB'siyle son restart doğrulaması (PM'in istediği gibi, `:memory:` değil):** IsoB'nin karakterini oluşturduktan sonra backend process'ini `taskkill` ile gerçekten sonlandırıp yeniden başlattım — GET /character IsoB'nin session id'siyle sorgulanınca karakter (isim/HP/envanter) birebir geri geldi.
- [x] QA sırasında oluşturulan test session/karakter kayıtları gerçek `game.db`'den temizlendi (üretim verisi yok, sadece dev DB).

**Faz 6 (A+B+C, backend+frontend) TAMAMEN KAPANDI** — bilinen açık bug yok. Tek not: dev server'ların büyük backend değişikliklerinden sonra elle restart edilmesi gerekiyor (watch modu yoksa) — süreç notu olarak kayıt altına alındı, kod bug'ı değil.

### Not (düşük öncelik, bu fazda ele alınmayacak)
- Silah ikonları eksik (asset setinde yoktu, emoji fallback kullanılıyor) — ayrı bir asset kaynağı gerekir
- Proje henüz hiçbir yerde deploy edilmedi, sadece localhost'ta çalışıyor — deploy/hosting kararı ayrı bir konuşma konusu

## Notlar
- FRP (`C:\Users\erdem\OneDrive\Masaüstü\FRP`) yalnızca konsept referansıdır, kod kopyalanmayacak. Kök `.gitignore` ile git takibi dışında.
- Değişiklik/karar gerektiren konularda PM'e (bu session) danışın, kullanıcıya sormadan büyük mimari karar almayın.
