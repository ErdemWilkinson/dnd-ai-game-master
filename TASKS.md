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
- [ ] `backend`: `.env.example` ekle (`GEMINI_API_KEY=`), `.gitignore`'a `.env` olduğunu doğrula, `dotenv` ile yükle
- [ ] `backend`: `@google/generative-ai` (veya güncel resmi Gemini SDK) bağımlılığını ekle, Flash ailesinden ücretsiz katmana uygun hızlı/ucuz bir model seç
- [ ] `backend`: `services/aiGm.js` — karakter + sahne durumu + son birkaç sohbet mesajından bir GM anlatım promptu kurup Gemini'den tek bir narration metni döndüren fonksiyon
- [ ] `backend`: basit in-memory rate limiter (saatlik sayaç) — limit aşılınca veya `GEMINI_API_KEY` yoksa/istek hata verirse mevcut `gmFlavor.js` mock yoluna sessizce düş
- [ ] `backend`: chat POST route'unu bu yeni AI-GM katmanını kullanacak şekilde bağla (try AI → catch/limit → fallback mock), hangi kaynaktan geldiğini (ai/mock) mesaj objesine ekle (debug/QA için)
- [ ] Key olmadan da (mock fallback ile) sistemin sorunsuz çalıştığını doğrula, key eklenince gerçek AI cevabını da test et

### Tester
- [ ] Gemini çağrısını mock'layarak: (a) başarılı AI cevabı senaryosu, (b) hata/timeout → mock fallback senaryosu, (c) rate limit aşımı → mock fallback senaryosu için testler yaz — gerçek API key gerektirmemeli
- [ ] Rate limiter'ın sayaç mantığını test et
- [ ] Key eklendikten sonra gerçek bir manuel QA turu: birkaç sohbet mesajı gönderip AI cevabının tutarlı/oyun bağlamına uygun geldiğini doğrula
- [ ] QA_CHECKLIST.md'ye Faz 2 maddelerini ekle

## Notlar
- FRP (`C:\Users\erdem\OneDrive\Masaüstü\FRP`) yalnızca konsept referansıdır, kod kopyalanmayacak.
- Değişiklik/karar gerektiren konularda PM'e (bu session) danışın, kullanıcıya sormadan büyük mimari karar almayın.
