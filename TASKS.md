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

## Faz 7 — İçerik Çeşitliliği + Deploy Hazırlığı (Postgres geçişi)

Kullanıcı kararı: "inovasyonlara devam et". PM değerlendirmesi: tek sabit sahne/karşılaşma var (kazanınca hiçbir yere ilerlenmiyor), ve proje hâlâ sadece localhost'ta çalışıyor. Deploy için araştırma yapıldı: Render kart istemeyen gerçek bir ücretsiz katman sunuyor ama ücretsiz web servislerinde kalıcı disk YOK (SQLite dosyası silinebilir) — kullanıcı kararı: Render + ücretsiz Postgres'e geçilecek, gerçek kalıcılık korunacak.

### A) İçerik çeşitliliği (coder, hemen başlanabilir) [x] TAMAMLANDI (commit 1ff7458)
- [x] `data/encounters.js` — 4 farklı karşılaşma (Terk Edilmiş Mahzen/goblin, Örümcek İni/dev örümcek, İskelet Mezarlığı/2 iskelet, Ejderha İni/genç ejderha). `sceneFactory.js`'teki `createScene(encounterIndex)` bu listeden kurulum yapıyor (liste sonuna gelince başa dönüyor). `/attack` ve `/cast`, sahnede düşman kalmayınca `advanceToNextEncounter()` çağırıp anlatıma geçiş mesajı ekliyor.
- [x] İlerleme göstergesi: `scene.encounterIndex`/`totalEncounters` — sahne zaten bütünüyle JSON olarak DB'ye yazıldığından (Faz 6-B) yeni bir DB şeması gerekmedi, otomatik kalıcı. Frontend'de "Karşılaşma: N/M" gösteriliyor.

**Doğrulama:** izole portta uçtan uca — goblin ölünce sahne otomatik "Örümcek İni"ye geçti (yeni düşman, oyuncu spawn'a döndü, tur/aksiyon sıfırlandı), gerçek dosya DB'siyle restart testinde `encounterIndex` korundu. backend 215/216 (1 bilinen davranış değişikliği — bkz. commit mesajı, tester güncellemeli), frontend 73/73 yeşil.

### B) Postgres'e geçiş (coder, A'dan bağımsız paralel yapılabilir) [x] TAMAMLANDI (commit 94e20de)
- [x] `data/dbSqlite.js` (senkron, mevcut `better-sqlite3` mantığı) ve `data/dbPostgres.js` (asenkron, `pg` Pool) aynı metod setini sağlıyor. `data/db.js` seçici: `DATABASE_URL` varsa VE `VITEST` değilse Postgres, aksi halde SQLite. `services/persistence.js`'in save* fonksiyonları hâlâ senkron-görünümlü çağrılıyor (route'larda hiçbir değişiklik gerekmedi) — SQLite'ta gerçekten bloklayıcı, Postgres'te "fire and forget" (in-memory Map zaten çalışma-zamanı otoritesi). `loadAll()` async oldu, `server.js` açılışta await ediyor.
- [x] `scripts/initPostgres.js` — elle şema kurulumu için yardımcı script (uygulama zaten her açılışta otomatik `CREATE TABLE IF NOT EXISTS` çalıştırıyor).

**Doğrulama:** `DATABASE_URL` yokken engine='sqlite' (değişmedi); `DATABASE_URL`+`VITEST=true` → yine 'sqlite' (test izolasyonu korunuyor); `DATABASE_URL` tek başına → 'postgres', `Pool` eager bağlanmıyor; sahte/erişilemez bir Postgres URL'iyle gerçek başlatma denemesi net bir hata mesajıyla temiz exit etti (asılıp kalmadı); gerçek dosya SQLite ile uçtan uca restart testi refactor sonrası da bozulmadı. backend 237/237, gerçek bir Postgres instance'ı yok — o kısım yukarıdaki dry-run testleriyle doğrulandı, gerçek bağlantı testi PM ile deploy aşamasında yapılacak.

### C) Render deploy hazırlığı (coder, kod/config seviyesinde) [x] TAMAMLANDI (commit d2a6558)
- [x] `PORT` zaten `process.env.PORT`'tan okunuyordu (değişiklik gerekmedi). `GEMINI_API_KEY`/`DATABASE_URL` zaten sadece ortam değişkeninden okunuyor, `.env` gitignore'da, kodda/repoda hiçbir secret yok — doğrulandı.
- [x] `frontend/src/api.ts`: `BASE` artık `import.meta.env.VITE_API_BASE`'den okunuyor (yoksa `/api`'ye düşer, yerel dev proxy davranışı değişmedi). Gerçek build ile doğrulandı: `VITE_API_BASE` build-time env'i verilince tam URL bundle'a gömülüyor.
- [x] `render.yaml` — backend (Node Web Service, `healthCheckPath: /api/health`, `DATABASE_URL` Render Postgres'ten `fromDatabase` ile otomatik, `GEMINI_API_KEY` `sync: false` yani dashboard'dan elle girilecek), frontend (Static Site, `VITE_API_BASE` backend servisinden `fromService` ile bağlanmaya çalışıyor), ücretsiz Postgres tanımı.

**Not (coder, dürüstlük payı):** `render.yaml`'daki `fromService` ile servisler-arası tam URL referansı Render'ın güncel şemasına birebir uyup uymadığını gerçek bir Render ortamım olmadığı için %100 doğrulayamadım — dosyanın içinde bunu açıkça belirten bir yorum bıraktım, dashboard'da ilk deploy denemesinde PM/kullanıcının bu alanı kontrol etmesi gerekebilir.

**ÖNEMLİ — coder/tester DIKKAT:** Gerçek Render/GitHub hesabı açma, repo'yu GitHub'a push'lama, ve Render dashboard'unda servisleri kurma adımları PM ile kullanıcı arasında ayrıca yürütülecek (dış hesap işlemleri, sizin yetkinizde değil). Sizin işiniz sadece kodun/config'in deploy'a HAZIR olmasını sağlamak.

### Tester
- [x] Yeni sahne geçişi için testler (karşılaşma temizlenince doğru geçiş, ilerlemenin DB'ye yazılıp restart sonrası korunduğu)
- [x] Postgres soyutlamasının SQLite davranışını bozmadığını doğrula (mevcut testler hâlâ geçmeli, `DATABASE_URL` yokken SQLite'a düştüğü açıkça test edilsin). Gerçek bir Postgres instance'ı yoksa bu kısmı mock'la/dokümante et, gerçek Postgres bağlantı testi PM ile birlikte deploy aşamasında yapılacak.

**Tester notları (Faz 7-A kısmı, 2026-08-22):**
- Coder'ın işaret ettiği stale test düzeltildi: yenilmiş bir düşmana tekrar saldırma artık 404 dönüyor (eskiden 400 "aksiyon tükendi" bekliyordu) — karşılaşma geçişinde oyuncu token'ı taze (`actionAvailable:true`) yeniden kuruluyor, o yüzden davranış gerçekten değişti
- `encounters.test.js` (yeni, 12 test): `ENCOUNTERS` içeriği (en az 2 karşılaşma, her biri isim+düşman içeriyor, düşman id'leri global benzersiz), `createScene()` (doğru karşılaşmayı kuruyor, oyuncu her zaman spawn'a (1,1) yerleşiyor, liste sonunda başa dönüyor, grid boyutu sabit, `createDefaultScene()` geriye dönük uyumlu), `advanceToNextEncounter()` (sahneyi REFERANSLA mutasyona uğratıyor — aynı obje/id döner, encounterIndex+1, oyuncu resetleniyor, son karşılaşmadan sonra başa dönüyor)
- `scene.test.js`'e "Faz 7-A: karşılaşma temizlenince yeni alana geçiş" bloğu (7 test): `/attack` ile geçiş tetikleniyor + anlatım cümlesi ekleniyor + oyuncu/tur resetleniyor, `/cast` (Ateş Topu) ile de aynı geçiş tetikleniyor, **birden fazla düşmanlı bir karşılaşmada (İskelet Mezarlığı) sadece SON düşman ölünce geçiş tetikleniyor** (ilk düşman ölümünde henüz geçiş yok — regresyon riski yüksek bir davranış, özellikle test edildi)
- `TacticalGrid.test.tsx`'e "Karşılaşma: N/M" göstergesi testleri (2 test, 1-tabanlı gösterim doğrulandı)
- Test durumu (Faz 7-A kapsamı): backend **234/234**, frontend **75/75**, tsc+vite build temiz
- **Canlı sunucuya karşı uçtan uca doğrulama (curl, çalışan gerçek dev server, 2026-08-22):** Goblin'i öldürünce sahne otomatik "Örümcek İni"ye geçti (`encounterIndex:0→1`, yeni düşman "Dev Örümcek"), narration'da "Karşılaşma temizlendi! Yeni bir alana geçiliyor: Örümcek İni." cümlesi doğru eklendi, geçiş sonrası aynı goblin-1'e tekrar saldırma denemesi doğru şekilde 404 döndü.

**Tester notları (B — Postgres soyutlaması, 2026-08-22):**
- Coder'ın belgelediği tek bilinen kırılma (`loadAll()` artık async) düzeltildi: `persistence.test.js`'teki 3 `loadAll()` çağrısı `await`'lendi, ilgili test callback'leri `async` yapıldı. Beyaz-kutu testler (`db.exec`/`db.prepare` ile doğrudan erişim) `dbSqlite.js`'in geriye dönük uyumluluk için hâlâ export ettiği ham `db` instance'ı sayesinde değişiklik gerektirmedi.
- `db.test.js` (yeni, 3 test): motor seçimi env değişkenlerine göre doğru çalışıyor mu — bunu AYNI process içinde test etmek güvenilir değil çünkü `data/db.js` import ANINDA `process.env` okuyor ve Node'un CJS require cache'i `vi.resetModules()` ile temizlenmiyor; onun yerine her senaryoyu ayrı bir `node -e` alt process'inde çalıştırıp `engine` alanını okudum (gerçek "import anı" davranışını birebir test eden tek güvenilir yöntem). Doğrulanan 3 senaryo: `DATABASE_URL` yokken `engine==='sqlite'`, `DATABASE_URL`+`VITEST=true` iken YİNE `'sqlite'` (test izolasyonu), `DATABASE_URL` tek başına iken `'postgres'` (ve modül import anında ÇÖKMÜYOR — `pg` Pool'un eager bağlanmadığını doğruluyor).
- Coder'ın "sahte Postgres URL'iyle gerçek başlatma denemesi temiz exit ediyor" iddiasını bağımsız olarak tekrar doğruladım: `DATABASE_URL=postgres://...localhost:59999/...` ile gerçek `node server.js` çalıştırdım — `ECONNREFUSED` ile net bir hata basıp **exit code 1** ile temiz çıktı (asılı kalmadı).
- Gerçek dosya `game.db` ile canlı restart: refactor sonrası da bozulmadı — `node --watch` dev server'ı coder'ın kaydettiği değişiklikleri otomatik yükledi, restart öncesi oluşturduğum bir karakteri ve hareketini restart sonrası birebir doğruladım.
- Test durumu: backend **237/237**, tsc gerekmiyor (backend-only).

**Tester notları (C — Render deploy hazırlığı, 2026-08-22):**
- `render.yaml`'ı gözden geçirdim — `healthCheckPath: /api/health` gerçekten var ve çalışıyor (curl ile doğrulandı), `GEMINI_API_KEY` gerçekten `sync: false` (repoda secret yok), yapı mantıklı. Coder'ın kendi notuyla aynı fikirdeyim: `fromService`/`hostport` alanının Render'ın güncel şemasına birebir uyup uymadığı gerçek bir hesap olmadan doğrulanamaz — bu PM+kullanıcı ile ilk deploy denemesinde kontrol edilecek, benim/coder'ın yetkisinde değil.
- `VITE_API_BASE` build-time davranışını BAĞIMSIZ olarak iki gerçek `vite build` ile doğruladım: `VITE_API_BASE` verilince bundle'a tam URL (`onrender.com/api`) gömülüyor; verilmeyince bundle'da hiç `onrender` referansı yok (varsayılan `/api` davranışı bozulmamış).
- Test durumu: frontend **75/75**, tsc+vite build (hem varsayılan hem `VITE_API_BASE` override'lı) temiz.

**Faz 7 (A+B+C) tester tarafından TAMAMEN doğrulandı** — bilinen açık bug yok. Gerçek Postgres/Render ortamı olmadığı için B/C'nin bir kısmı (gerçek bağlantı, gerçek dashboard deploy'u) mock/dry-run ile doğrulandı — gerçek doğrulama PM+kullanıcı ile deploy aşamasında yapılacak.

## Faz 8 — Deploy Sonrası Geri Bildirim (bug + AI kalitesi + envanter UX + layout)

**DEPLOY DURUMU:** Proje canlıda: https://dnd-game-frontend-t9hr.onrender.com/ (backend: dnd-game-backend-sz9e.onrender.com, Postgres: dnd-game-db). Kullanıcı gerçek ortamda test etti, geri bildirim verdi.

**PM tanısı (önemli, coder başlamadan önce oku):** Production'da AI Game Master **mock'a düşüyor** (`curl` ile `/api/chat` denendi, `source: "mock"` döndü) — kullanıcının "DM aptal/tekdüze" şikayetinin kök nedeni bu, anlatım kalitesi kodu değil. `GEMINI_API_KEY`'in Render'daki değeri kontrol ediliyor (kullanıcıyla birlikte, PM ayrıca ilgileniyor) — coder bu maddeye dokunmadan önce PM'den "key düzeltildi" onayını bekleyebilir, ya da paralel olarak mock şablonlarının çeşitliliğini de artırabilir (ikisi de faydalı, birbirini engellemez).

### A) Buglar (öncelik 1) [x] TAMAMLANDI (coder)
- [x] **Otomatik sayfa kaydırma bugu**: Kök neden tam tahmin edildiği gibiydi — `ChatPanel.tsx`'teki `bottomRef.current?.scrollIntoView({behavior:'smooth'})` varsayılan `block:'start'` davranışıyla nearest scrollable ancestor'ın ötesine geçip sayfayı da kaydırıyordu. `scrollIntoView` tamamen kaldırıldı, yerine `.chat-messages` container'ına doğrudan ref verilip `container.scrollTop = container.scrollHeight` kullanıldı (sadece o container kayıyor, sayfa/body hiç etkilenmiyor). Playwright ile doğrulandı: birden fazla chat mesajı/tur sonrası `document.scrollingElement.scrollTop` hep 0.

### B) AI/DM anlatım kalitesi (öncelik 2) — key-bağımsız kısımlar [x] TAMAMLANDI (coder)
- [ ] Gerçek key ile prod doğrulaması — PM/kullanıcı tarafında, coder'ın kapsamında değil
- [x] Mock şablon çeşitliliği artırıldı: `data/gmFlavor.js` — GENERIC 5→10, ATTACK/LOOK/TALK havuzları genişletildi, iki yeni kategori eklendi (hareket/keşif, büyü) + regex'ler daha fazla fiil varyasyonu yakalıyor. `services/enemyAI.js`'teki düşman saldırı/yaklaşma metinleri de artık sabit tek cümle değil, birden fazla şablondan rastgele seçiliyor (`pick()` helper).
- [x] **Savaş mesajlarında ham zar matematiği gizlendi**: `services/enemyAI.js`'teki `runEnemyTurn` artık "(18+2=20 vs 12)" gibi ifadeleri metne hiç gömmüyor (HP durumu gibi anlatıma faydalı bilgi kalıyor, ör. "(HP: 8/12)"). `/attack` ve `/cast` zaten AI/mock narration kullanıyordu (ham matematik hiç yoktu), ek olarak `pushGmMessage`'a opsiyonel bir `roll` parametresi eklenip attackResult/castResult mesaja iliştirildi (debug/QA için, JSON'da duruyor). Frontend `ChatPanel.tsx`: eski `roll-tag` paragrafı (ana metnin altında sürekli görünen "GÜÇ kontrolü: 14+2=16 (DC 12)") kaldırıldı, yerine sadece sonucu (`Başarılı`/`Başarısız` vb.) gösteren küçük bir `roll-badge` chip'i eklendi — tam sayısal detay `title` tooltip'inde duruyor. Canlı Playwright testiyle (goblin ile tam bir dövüş, ölüm + karşılaşma geçişi dahil) chat metninde `\d+\+\d+=\d+` deseninin hiç geçmediği doğrulandı.
- **Bilinen test kırılması (kasıtlı):** `backend/tests/enemyAI.test.js` ve `scene.test.js`'teki 2 test, düşman saldırı mesajının SABİT "...vuruyor..." metnini bekliyordu — artık birden fazla şablondan rastgele seçildiği için bazı çalıştırmalarda farklı bir şablon ("tam isabet ettiriyor" gibi) eşleşiyor. `frontend/ChatPanel.test.tsx`'teki 1 test eski `roll-tag` metnini (ham "14+2=16") bekliyor, artık `roll-badge` + tooltip var.

### C) Envanter/ekipman UX (öncelik 3) [x] TAMAMLANDI (coder)
- [x] **Kullan/Kuşan buton karmaşası düzeltildi**: `CharacterCard.tsx` — "Kullan" butonu artık SADECE `!item.slot` (slotsuz/tüketilebilir eşya, örn. iksir) olduğunda gösteriliyor; "Kuşan/Çıkar" SADECE `item.slot` varsa gösteriliyor. Playwright ile doğrulandı (Kısa Kılıç/Deri Zırh → sadece Kuşan, İksir → sadece Kullan).
- [x] **Sürükle-bırak ile kuşanma eklendi**: Envanter `<li>` artık `draggable` (slotu olan, kuşanılmamış eşyalarda), paper-doll slot'ları `onDragOver`/`onDrop` ile HTML5 native drag-and-drop kabul ediyor (eşyanın `slot`'u hedef slotla eşleşmiyorsa drop sessizce yok sayılıyor). Tıklama ile kuşanma/çıkarma da bozulmadan çalışmaya devam ediyor. **Not:** bunun için boş slotlardaki `disabled` HTML attribute'u kaldırıldı (disabled elementler drag/drop event'i almıyor) — tıklama güvenliği artık `onClick` içindeki `equippedItem &&` guard'ıyla korunuyor, CSS de `:disabled` yerine `.filled` class'ına göre güncellendi. Playwright'ta gerçek bir HTML5 drag simülasyonuyla (Kısa Kılıç → "El" slotu) uçtan uca doğrulandı.
- [x] **Emoji kullanımı genişletildi**: HP (❤️)/Mana (🔮)/Büyüler (✨)/Ekipman (🎽)/Envanter (🎒) başlıkları, 13 paper-doll slotunun her biri (🪖 Baş, 😷 Maske, 👓 Gözlük, 👂 Kulak, 📿 Boyun, 🎒 Sırt, 🥋 Zırh, 👕 Üst Giysi, 🧤 Eldiven, 🪢 Kemer, 👢 Ayakkabı, 💍 Aksesuar, ⚔️ El), envanter aksiyon butonları (🧪 Kullan, 🎽 Kuşan/Çıkar, 🗑️ At, 🎯 Fırlat).
- **Bilinen test kırılması (kasıtlı):** `frontend/CharacterCard.test.tsx`'teki 12 test eski buton metinlerini (emoji'siz "Kullan"/"Kuşan" vb.), eski "her zaman iki buton" varsayımını, ve boş slotta `disabled` attribute'unu bekliyor — hepsi bilinçli UX değişikliği, tester güncellemeli.

### D) Layout (öncelik 4) [x] TAMAMLANDI (coder, A ile birlikte — aynı köke bağlıydı)
- [x] `.app` artık `height:100vh; overflow:hidden` (eskiden `min-height:100vh`), `.app-main` `flex:1; min-height:0; overflow:hidden`, üç panel (`character-card`/`tactical-grid`/`chat-panel`) kendi içinde `overflow-y:auto` ile scroll oluyor. `index.css`'e `html,body,#root{height:100%;overflow:hidden}` eklendi (savunma amaçlı). Sürükle-bırak ile TAMAMEN özelleştirilebilir panel yerleşimi eklenmedi (kullanıcı istemiyordu), sadece sabit/taşmayan düzen. Playwright ile 1400x800 viewport'ta doğrulandı: `document.body.scrollHeight === window.innerHeight` (sayfa hiç taşmıyor), `.character-card` kendi içinde scroll edilebiliyor (`scrollHeight > clientHeight`).

### Tester [x] TAMAMLANDI (2026-08-23)
- [x] **Bilinen test kırılmaları düzeltildi** — `enemyAI.test.js`/`scene.test.js`: sabit "vuruyor" metni bekleyen 2 test artık şablon-bağımsız (hasar miktarı + `HP: x/y` deseni) doğruluyor; ayrıca kendi QA'mda 2 EK regresyon buldum ve düzelttim: (a) `scene.test.js`'teki "yaklaşıyor" testi de aynı nedenle (rastgele şablon seçimi) flaky'di, 3 şablonun hepsini kabul edecek şekilde genişletildi; (b) `chat.test.js`'teki ATTACK havuzu testi (3→6 şablon genişleyince eski regex bazılarını kaçırıyordu) genişletildi. `ChatPanel.test.tsx`: eski roll-tag testi kaldırılıp yeni roll-badge+tooltip davranışını doğrulayan bir teste dönüştürüldü. `CharacterCard.test.tsx`: 12 kırık test emoji-prefixli buton/label metinlerine (regex ile), kaldırılan `disabled` attribute'una (artık `.filled` class + onClick guard kontrolü) göre güncellendi.
- [x] Backend'i 6 kez art arda çalıştırıp flaky kalmadığını doğruladım — **237/237** stabil.
- [x] **Scroll bugu regresyonu**: Playwright ile karakter oluşturup 5 chat mesajı + 6 "Turu Bitir" sonrası `document.scrollingElement.scrollTop` ve `document.body.scrollHeight` hiç değişmedi (`=== window.innerHeight`, sayfa hiç taşmadı); `.chat-messages` container'ının KENDİSİ doğru şekilde en alta kaydı (`scrollTop === scrollHeight - clientHeight`). Ayrıca jsdom testinde de container-scroll davranışı ayrı bir birim testle (yeni) doğrulandı.
- [x] **Savaş mesajlarında ham zar matematiği**: Canlı Playwright ile hem düşman saldırılarını hem oyuncunun bitişik goblin'e tıklayarak saldırmasını tetikledim — chat metninin tamamında (`innerText`) `\d+\+\d+=\d+` deseni HİÇ yok; oyuncu saldırısında "Başarılı" rozeti göründü, ham veri (`Güç kontrolü: 18+0=18 (DC 12)`) sadece rozetin `title` tooltip'inde duruyor.
- [x] **Kullan/Kuşan buton mantığı**: Canlı QA'da doğrulandı — slotlu eşyalarda (Kısa Kılıç, Deri Zırh) SADECE Kuşan/Çıkar, slotsuz eşyada (İksir) SADECE Kullan gösteriliyor. `CharacterCard.test.tsx`'e Faz 8 için yeni bir test eklendi (slotlu eşyada Kullan butonunun HİÇ render edilmediğini doğrulayan).
- [x] **Sürükle-bırak**: Hem jsdom'da (`fireEvent.dragStart/dragOver/drop` + sahte `DataTransfer`, 3 yeni test: uygun slota bırakma → `equipItem` çağrılıyor, slot uyuşmazlığında sessizce yok sayılıyor, kuşanılı eşya `draggable=false`) hem de gerçek Playwright'ta (Chromium native HTML5 drag-and-drop, Kısa Kılıç → El slotu) uçtan uca doğrulandı — ikisinde de kuşanma başarılı, slot `filled` class'ı aldı.
- [x] **Layout**: 1400x800 viewport'ta Playwright ile `document.body.scrollHeight === window.innerHeight` doğrulandı (sayfa hiç taşmıyor), ekran görüntüleriyle 3 panelin (karakter/sohbet/harita) viewport'a sabit oturduğu ve panel-içi scroll'un çalıştığı görsel olarak teyit edildi.
- [x] Test durumu (bu turda): backend **237/237** (6 kez tekrar çalıştırılıp stabil), frontend **80/80** (3 kez tekrar çalıştırılıp stabil), `tsc -b && vite build` temiz.
- [x] Konsol/sayfa hatası: tüm Playwright akışlarında (karakter oluşturma → chat → sürükle-bırak → dövüş → tur döngüsü) sıfır `pageerror`/`console.error` (404'ler hariç, beklenen).

**Faz 8 TAMAMEN kapandı** (A, C, D, B'nin key-bağımsız kısmı) — bilinen açık bug yok. B'nin geri kalanı (gerçek key ile prod doğrulaması) PM/kullanıcı tarafında, coder/tester kapsamında değil.

## Faz 9 — Yaratıcı Cron Bulgularının Uygulanması (rate-limit, cleanup, mobil, hata UX)

Aşağıdaki "İnovasyon Fikirleri" bölümündeki 1-4 numaralı maddeler PM tarafından değerlendirildi, Faz 9 olarak resmileştirildi.

### Coder [x] TAMAMLANDI
- [x] **Genel API rate-limit** (fikir #2): `express-rate-limit` eklendi (`services/publicRateLimit.js`), `/character/create` ve `/character/roll-stats`'a uygulandı — IP başına dakikada 20 istek (env `PUBLIC_RATE_LIMIT_MAX` ile override edilebilir), aşılınca 429 + Türkçe hata mesajı. Test ortamında (`VITEST`) tamamen devre dışı (aksi halde testler birbirini 429'a düşürürdü). **Not:** iki route aynı middleware instance'ını paylaştığı için sayaç da ortak — yani `/create` + `/roll-stats` birlikte dakikada 20 istek limitine tabi (ayrı ayrı değil), bu "genel" bir kamuya-açık-uç-limiti olarak kasıtlı. Canlı curl testiyle doğrulandı: 25 ardışık istekten ilk 20'si 200, sonraki 5'i 429.
- [x] **Orphan temizliği** (fikir #1): `/character/reset` artık `persistence.clearSession(sessionId, characterId)` üzerinden orphan karakter satırını (hem in-memory Map hem DB) gerçekten siliyor. Ayrıca `sessions` tablosuna `updated_at` kolonu eklendi (SQLite: `PRAGMA table_info` ile varlık kontrolü + `ALTER TABLE`; Postgres: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), her `upsertSession` çağrısında güncelleniyor. `services/persistence.js`'e `cleanupStaleSessions(maxAgeMs)` eklendi — 30 günden eski session'ları (+ bağlı karakter/sahne/sohbet) siler; `server.js` açılışta bir kere ve sonra günde bir `setInterval` (`.unref()`'lü) ile çağırıyor, `VITEST` altında hiç çalışmıyor. Canlı curl + doğrudan `game.db` sorgusuyla doğrulandı: reset sonrası karakter satırı DB'den gerçekten siliniyor (404 + DB'de `undefined` satır).
- [x] **Sessiz fetch hataları** (fikir #4): `api.ts`'e `NetworkError` sınıfı eklendi — `fetch()` başarısız olursa (bağlantı hatası) ya da yanıt JSON parse edilemezse (örn. Render'ın soğuk başlangıçta döndürdüğü ham hata sayfası) bu tip fırlatılıyor, normal HTTP hatalarından (örn. "aktif karakter yok" 404'ü) ayrı tutuluyor. `App.tsx`'teki ilk karakter yüklemesi artık SADECE `NetworkError`'da "Bağlantı kurulamadı, tekrar deneniyor... (N/3)" gösterip 4 saniye arayla 3 kez otomatik deniyor; gerçek 404 (aktif karakter yok) hiç retry'a girmeden direkt oluşturma formuna düşüyor. Playwright ile canlı doğrulandı: backend kapalıyken retry mesajı sayaçla görünüyor, backend tekrar ayağa kalkınca otomatik kurtarıyor.
- [x] **Mobil/responsive temel destek** (fikir #3, PM kararı): `App.css`'e `@media (max-width: 768px)` eklendi — `.app-main` tek sütuna düşüyor (`grid-auto-rows: 42vh`, kendi içinde dikey scroll), `.character-creation`/`.intro-screen`/`.game-over-screen` sabit piksel genişlik yerine `width:100%; max-width:420px` oluyor. Karmaşık sekme/accordion eklenmedi (PM kararıyla tutarlı). Playwright'ta gerçek 375×812 viewport ile doğrulandı: hiçbir ekranda yatay taşma yok (`body.scrollWidth === innerWidth`), 3 panel dikey sırayla erişilebilir, karakter oluşturma formu da düzgün ortalanıyor.

### Tester
- [ ] Rate-limit için test (limit aşımının 429 döndürdüğünü doğrula)
- [ ] Orphan temizliği için test (reset sonrası karakterin gerçekten silindiğini, eski session'ların temizlendiğini doğrula)
- [ ] Fetch retry UX'i için test/QA (backend'i geçici kapatıp retry mesajının göründüğünü dene)
- [ ] Mobil breakpoint'i gerçek dar viewport (örn. 375px) ile Playwright'ta görsel QA
- [ ] **Bilinen test kırılması (kasıtlı):** `backend/tests/scene.test.js`'teki "reset, karakterin kendisini SİLMEZ" testi artık yanlış — reset artık karakteri GERÇEKTEN siliyor (fikir #1'in amacı buydu). Test adı ve assertion'ları tersine çevrilmeli (`404` bekleyecek şekilde).

## İnovasyon Fikirleri (yaratıcı cron)
(Bu bölümü yaratıcı cron dolduracak — her turda bir fikir ekler. Yukarıdaki maddeler Faz 9'a taşındı.)

7. **[2026-08-23] [x] DÜZELTİLDİ (coder)** `/api/health` yanıtı DB bağlantısını hiç kontrol etmiyor — Postgres çökerse Render bunu fark etmez. `backend/server.js:31-33` — health check sabit `{status:"ok"}` döndürüyor, hiçbir DB sorgusu yapmıyordu. `render.yaml`'da `healthCheckPath: /api/health` bu uç noktaya bağlı — yani Postgres bağlantısı koparsa/bozulursa (ki ücretsiz Render Postgres'te olabilir), backend "sağlıklı" raporlamaya devam ediyordu. **Düzeltme:** `data/dbSqlite.js`/`data/dbPostgres.js`'e `ping()` eklendi (`SELECT 1`), `server.js`'teki `/api/health` artık `await db.ping()` yapıp başarısız olursa `503 {status:"error"}` dönüyor. Gerçek dev server + `game.db` ile canlı doğrulandı (200 dönüyor), backend testleri regresyon göstermedi (236/237, tek kırılma daha önceden bilinen/kasıtlı reset testi).

6. **[2026-08-23] Sohbet geçmişi (chat history) hiç sınırlandırılmamış — tek bir uzun oturumda bile sınırsız büyüyor.** (Not: bu, Faz 9'daki "terkedilmiş session temizliği" fikrinden FARKLI bir sorun — o abandoned session'lar içindi, bu aktif/meşru bir oturumun kendisi için.) `backend/routes/chat.js:46,66` — `history.push(...)` hiçbir üst sınır kontrolü yapmadan diziye ekliyor. AI'a giden prompt bağlamı doğru şekilde sınırlı (`history.slice(-6)` / `slice(-HISTORY_CONTEXT_SIZE)`, `chat.js`/`scene.js`'de doğrulandı — token maliyeti güvende), ama DEPOLAMA katmanı sınırsız: her yeni mesajda (Faz 6-B'nin "whole-object" kalıcılık deseniyle) büyüyen tüm dizi yeniden DB'ye yazılıyor, uzun bir maceranın (yüzlerce tur) chat_history satırı hem büyüyor hem her yazma O(n) maliyetli hale geliyor. Öneri: depolanan geçmişi de makul bir üst sınırla (örn. son 200 mesaj) kırp — AI bağlamını zaten etkilemiyor, sadece performans/depolama sağlamlığı için. Küçük/net bir iş ama şu an ekip meşgul, coder/tester boşalınca alınabilir.

5. **[2026-08-23] Sıfır onboarding/yardım içeriği — sistem artık oldukça karmaşık (D20 zar, aksiyon+bonus aksiyon ekonomisi, büyü, hedef seçme, ekipman slotları) ama hiçbir açıklama yok.** Kod tabanında "yardım"/"help"/"tutorial"/"nasıl oynanır" içeren hiçbir metin/bileşen bulamadım (grep ile doğruladım). Faz 3'ten beri (BG3-esinli sistemler) mekanikler epey derinleşti ama yeni bir ziyaretçi karakter oluşturma ekranından sonra hiçbir yönlendirme almadan doğrudan oyuna düşüyor — "Aksiyon/Bonus" ne demek, saldırmak için düşmana tıklaman gerektiği, büyü hedef-seç modu gibi şeyler keşfedilmesi gereken detaylar. Bu özellikle "kullanıcılara açma" hedefinde ilk-izlenim kaybına yol açabilir. Öneri: küçük bir "Nasıl Oynanır?" modal'ı/tooltip serisi (ilk oyun ekranına girişte bir kerelik gösterilen 3-4 maddelik bir özet yeterli, kapsamlı bir tutorial sistemi şart değil). Orta boy bir iş — PM/kullanıcı önceliklendirmeli, otomatik atanmadı.

4. **[2026-08-23] Frontend'de fetch hataları tamamen sessizce yutuluyor — Render'ın "soğuk başlangıç" gecikmesiyle birleşince kullanıcı boş/bozuk bir ekranla baş başa kalıyor.** `App.tsx`'te ilk veri çekmeleri `.catch(() => {})` ile hiçbir kullanıcı geri bildirimi vermeden hata yutuyor (satır 24, 46). Bu, tam olarak kullanıcının şikayet ettiği "Failed to fetch" ekranının (VITE_API_BASE düzeltmeden önce gördüğü) kök nedeniydi — o spesifik bug artık düzeldi ama ALTTAKİ desen (sessiz hata yutma) hâlâ duruyor. Render'ın ücretsiz web servisleri ~15 dk hareketsizlikten sonra "uyuyor", ilk istek 30-60 saniye sürebiliyor (araştırmayla doğrulanmıştı, bkz. Faz 7 deploy notları) — bir ziyaretçi backend uyanırken siteye gelirse şu an hiçbir şey görmeyecek/bozuk bir ekranla karşılaşacak, "sunucu uyanıyor, biraz bekle" gibi bir geri bildirim yok. Öneri: en azından ilk yükleme başarısız olursa kullanıcıya "Bağlantı kurulamadı, tekrar deneniyor..." gibi bir mesaj + otomatik retry (birkaç saniye arayla 2-3 deneme) göster. Küçük/net bir iş, coder/tester Faz 8 push'unu bitirince alınabilir.

2. **[2026-08-23] `POST /api/character/create` (ve genel olarak çoğu endpoint) üzerinde hiç rate-limit yok — spam/kaynak tüketimi riski.** Kontrol ettim: `services/rateLimiter.js`'in `allowRequest()`'i SADECE AI (Gemini) çağrılarını sınırlıyor (`character.js:122`, `/intro` içinde). `POST /api/character/create` tamamen sınırsız — kimlik doğrulama da olmadığı için bir betik saniyede yüzlerce sahte session/karakter oluşturabilir. 1 numaralı fikirle (orphan temizliği) birleşince asıl risk ortaya çıkıyor: temizlik olmasa bile spam + sınırsız create = ücretsiz Postgres'in 1GB'ını hızla doldurabilir, ayrıca free-tier backend'in CPU/RAM'ini de zorlayabilir. Öneri: IP bazlı basit bir genel rate-limit middleware (örn. `express-rate-limit`, dakikada X istek) en azından `/character/create` ve `/character/roll-stats` gibi kimliksiz-erişilebilir uç noktalara eklensin. Küçük/net bir iş, mevcut Faz 8 bittikten sonra alınabilir.

3. **[2026-08-23] Sıfır mobil/responsive destek — sabit piksel genişlikli 3 sütunlu layout küçük ekranlarda tamamen kırılıyor.** `frontend/src/App.css` ve `index.css`'de hiç `@media` sorgusu yok (grep ile doğruladım, 0 sonuç). `.app-main`'in `grid-template-columns: 280px 1fr 380px` (App.css:44) sabit değeri — sadece iki yan panel bile 660px, çoğu telefon ekranından (örn. 375-414px) geniş. Faz 8'de layout'u "hiç kaymasın" diye `height:100vh + overflow:hidden` yaptık (coder raporu) — bu, masaüstünde scroll bugunu çözerken, dar ekranlarda muhtemelen içeriği kırpıyor/kullanılamaz hale getiriyor (canlıda telefon simülasyonuyla doğrulamadım ama CSS'e bakınca kaçınılmaz görünüyor). "Kullanıcılara açma" hedefiyle ziyaretçilerin büyük kısmı mobilden gelebilir. Bu net bir "küçük iş" değil — en azından tek sütuna düşen bir mobil breakpoint (örn. 768px altı: panelleri alt alta, karakter kartı/harita bir sekme/accordion arkasına) gerektirir, biraz tasarım kararı ister. PM/kullanıcı ile önceliklendirilmeli, coder'a otomatik atanmadı.

1. **[2026-08-23] Terkedilmiş session/karakterler için temizlik yok — ücretsiz Postgres'te (1GB limit) sınırsız büyüme riski.** `POST /api/character/reset` (`backend/routes/character.js:174`) sadece session'ın `activeCharacterIdBySession`/`chatHistories`/`scenes` bağını siliyor, ama `characters` Map'indeki (ve DB'deki) karakter satırının KENDİSİNİ hiç silmiyor — karakter kalıcı olarak "sahipsiz" (orphan) kalıyor. Aynı şekilde hiç dönmeyen/hiç reset atmayan session'lar da sonsuza dek DB'de kalıyor. Bugün az sayıda kullanıcı var, sorun yok — ama "kullanıcılara açma" hedefiyle her ziyaretçi kalıcı bir DB satırı biriktiriyor demek, ücretsiz Postgres katmanının 1GB sınırına er ya da geç çarpar. Öneri: (a) `/reset`'in orphan karakter satırını da gerçekten silmesi, (b) belirli bir süre (örn. 30 gün) hiç aktivite görmemiş session/karakterleri temizleyen bir bakım görevi (basit bir zamanlanmış SQL DELETE yeterli, ayrı bir cron job servisi şart değil — server açılışında ya da periyodik bir `setInterval` ile de yapılabilir). Küçük/net bir iş, coder boşalınca alınabilir.

## Notlar
- FRP (`C:\Users\erdem\OneDrive\Masaüstü\FRP`) yalnızca konsept referansıdır, kod kopyalanmayacak. Kök `.gitignore` ile git takibi dışında.
- Değişiklik/karar gerektiren konularda PM'e (bu session) danışın, kullanıcıya sormadan büyük mimari karar almayın.
- **Prod deploy bilgisi:** frontend https://dnd-game-frontend-t9hr.onrender.com/, backend https://dnd-game-backend-sz9e.onrender.com — gerçek Render/GitHub hesap işlemleri PM+kullanıcı arasında yürütülür, coder/tester'ın yetkisinde değil.
