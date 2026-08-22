# Manuel QA Checklist — Faz 1 / Faz 1.5 / Faz 2 / Faz 3 / Faz 3.5 / Faz 4 / Faz 5 / Faz 6

Kullanım: backend (`cd backend && npm start`, :3001) ve frontend (`cd frontend && npm run dev`, :5173) ayrı terminallerde çalışırken, tarayıcıda `http://localhost:5173` açılarak sırayla kontrol edilir.

Durum: Faz 1.5, Faz 2 ve Faz 3 (A, C, D, E) tamamlandı ve regresyonla doğrulandı (son: 2026-08-22). Geçmiş bug numaraları (TASKS.md > "Bulunan Buglar") referans olarak bırakıldı. **Faz 3 ile karakter oluşturma akışı ve envanterdeki fırlatma UX'i kökten değişti — bu bölümdeki "Karakter oluşturma" ve alttaki fırlatma maddeleri güncel (Faz 3 sonrası) akışı yansıtıyor.**

## Karakter oluşturma (Faz 3-A: D20 zar + dış görünüş + AI açılış hikayesi)
- [x] Sayfa ilk açıldığında, aktif karakter yoksa karakter oluşturma formu görünüyor (isim, ırk, sınıf, dış görünüş)
- [x] Isim boş bırakılıp gönderilirse "İsim gerekli." hatası gösteriliyor, istek atılmıyor
- [x] "Zar At (D20)" butonuna basmadan "Maceraya Başla" butonu disabled kalır
- [x] Zar atılınca kısa bir animasyon (rastgele değerler hızlıca değişiyor) ardından gerçek D20+ırk bonusu sonucu attribute kutucuklarında görünüyor
- [x] Irk değiştirilince önceki zar sonucu sıfırlanıyor (submit tekrar disabled oluyor) — ırk bonusu değiştiği için mantıklı
- [x] Geçerli isim + zar sonrası "Maceraya Başla" ile karakter oluşuyor, hemen ardından AI (veya mock) açılış hikayesi ekranı ("Macera Başlıyor") gösteriliyor
- [x] Açılış hikayesi mock kaynaklıysa "(mock anlatım)" etiketi görünüyor
- [x] "Devam Et" ile oyun ekranına geçiliyor
- [x] Farklı ırk/sınıf kombinasyonlarında HP/Mana/attribute başlangıç değerleri ırk bonusu + sınıf temel değerine göre doğru
- [x] Karakter kartındaki ırk/sınıf satırı Türkçe isimle gösteriliyor ("Elf · Büyücü" vb., eski bug #3 düzeltildi)

## Sohbet (GM)
- [x] Mesaj gönderilince hem oyuncu mesajı hem GM cevabı sohbet akışında görünüyor
- [x] Boş mesaj gönderilemiyor
- [x] "saldır" / "bak" / "konuş" gibi anahtar kelimeler farklı flavor-text kategorisi tetikliyor
- [x] Sayfa yenilenince önceki sohbet geçmişi geri geliyor (Bug #4 düzeltildi, artık karakter ekranına ulaşılıyor)
- [x] **(Faz 3-D)** Her GM mesajının altında zar sonucu özeti görünüyor (örn. "Güç kontrolü: 14+2=16 (DC 12) — Başarılı")

## Taktik grid
- [x] Harita, engeller, loot ve iki token (oyuncu + goblin) doğru render ediliyor
- [x] **(Faz 3-C)** Hareket hakkı 5 kareye çıkarıldı — menzil kontrolleri buna göre çalışıyor
- [x] Menzil dışı bir hücreye tıklayınca hata mesajı gösteriliyor, token hareket etmiyor
- [x] Engelli bir hücreye tıklayınca hata mesajı gösteriliyor
- [x] Menzil içi boş bir hücreye tıklayınca token o hücreye taşınıyor
- [x] Loot olan bir hücreye hareket edince loot toplanıyor (haritadan kayboluyor)
- [x] "Turu Bitir" sıradaki token'a geçiyor, tüm tokenlar turunu tamamlayınca tur sayacı artıyor
- [x] Düşman sırasındayken grid'e tıklamak engelleniyor: "Sıra sende değil." hatası gösteriliyor, grid görsel olarak pasifleşiyor (`grid-disabled`), backend'e istek gitmiyor (Bug #5 düzeltildi — PM kararı: engelle)
- [x] Sıra tekrar oyuncuya geçince engel kalkıyor, hareket normal çalışıyor
- [x] **(Faz 3-C)** Sahne başlığında "Aksiyon: ✓/✗ · Bonus: ✓/✗" göstergesi var
- [x] **(Faz 3.5 Bug A, düzeltildi — commit eb04d66)** Kullan/Fırlat ile Aksiyon harcandığında gösterge artık ANINDA ✗'e dönüyor (App.tsx'teki `sceneRefreshTick` sayesinde TacticalGrid yeniden sahne çekiyor) — canlı tarayıcıda tekrar doğrulandı.
- [x] End-turn ile sıra tekrar oyuncuya gelince Aksiyon/Bonus Aksiyon ✓'a sıfırlanıyor

## Envanter
- [x] Her eşya satırında Kullan / Kuşan(-Çıkar) / At / Fırlat butonları var (Bug #2 düzeltildi)
- [x] İksir kullanınca HP artıyor (max'a kadar), eşya envanterden düşüyor (Bug #1 düzeltildi — Türkçe "İ" regex sorunu)
- [x] Kuşanma toggle'ı "kuşanıldı" etiketini doğru gösterip kaldırıyor, buton metni Kuşan↔Çıkar arası değişiyor, Aksiyon TÜKETMİYOR
- [x] Eşya atınca (drop) envanterden düşüp sahnenin loot listesine ekleniyor, Aksiyon TÜKETMİYOR
- [x] **(Faz 3-E, yeniden tasarlandı)** Fırlat artık X/Y formu değil — "Fırlat" tıklanınca grid hedef-seçim moduna geçiyor ("Fırlatma hedefi seç"), bir kareye tıklayınca fırlatılıyor, tekrar "Fırlat"a (artık "Hedef Seçiliyor...") basılınca iptal ediliyor
- [x] **(Faz 3-C)** Kullan ve Fırlat, oyuncunun sırası VE Aksiyon hakkı gerektiriyor — Aksiyon tükenmişken ikinci kullanım/fırlatma "Bu tur için Aksiyon hakkın kalmadı." ile reddediliyor

## Genel / hata durumları
- [ ] Backend kapalıyken frontend açılırsa kullanıcıya anlamlı bir hata gösteriliyor mu (şu an: `getCharacterOptions` reddedilirse form boş kalıyor, hata mesajı görünüyor ama ırk/sınıf seçenekleri hiç yüklenmiyor) — **Faz 1.5 kapsamına alınmadı, gelecekte gözden geçirilebilir**
- [x] Tarayıcı konsolunda beklenmedik hata/uyarı yok (DevTools > Console) — regresyon QA'sında doğrulandı
- [x] Sayfa yenileme (F5 / yeni sekme) sonrası karakter ve envanter durumu korunuyor (Bug #4 düzeltildi)

## Faz 2 — AI Game Master (Gemini)

Otomatik testlerle doğrulanan davranış (`backend/tests/aiGmFallback.test.js`, `rateLimiter.test.js`), gerçek key gerektirmedi:
- [x] `GEMINI_API_KEY` tanımsızken sohbet endpoint'i hatasız çalışıyor, `gmMessage.source` `"mock"` dönüyor
- [x] Gemini çağrısı hata/timeout verirse istek yine de 201 ile başarılı dönüyor, kullanıcı hata görmüyor, `source: "mock"`
- [x] Rate limit (saatlik sayaç) aşılınca Gemini'ye hiç istek gitmiyor, `source: "mock"`
- [x] Gemini başarılı cevap verdiğinde `source: "ai"` ve gerçek anlatım metni kullanıcıya dönüyor
- [x] Rate limiter: limit dahilinde kabul/sayaç artışı, limit aşımında red, pencere dolunca sıfırlanma, varsayılan limit (30) — hepsi birim testle doğrulandı

**Gerçek key ile QA — TAMAMLANDI (2026-08-22).** Kullanıcının önceki key'i Google Cloud proje tarafında bir faturalandırma/kota bloke'una takılmıştı (`429 "Your prepayment credits are depleted"`); bu kod tarafında düzeltilebilecek bir şey değildi (tester ve coder tarafından ayrı ayrı canlı doğrulandı — fallback her ikisinde de kusursuz çalıştı). Kullanıcı farklı bir Google Cloud projesinden yeni bir key sağladıktan sonra tüm maddeler doğrulandı:
- [x] Geçersiz/hatalı/kota aşmış bir key ile backend çökmüyor, sessizce mock'a düşüyor — gerçek 429 hatasıyla canlı doğrulandı (backend log: "AI GM çağrısı başarısız, mock'a düşülüyor: ... 429 Too Many Requests ...")
- [x] Frontend'de mock mesajlarda "GM (mock)" etiketi görünüyor — tarayıcıda canlı doğrulandı, konsol/sayfa hatası yok
- [x] `backend/.env` içine geçerli key girilip ilk sohbet mesajında `source: "ai"` dönüyor — curl ile 3 turluk sohbette de doğrulandı
- [x] AI'ın anlatımı Türkçe, atmosferik ve birkaç cümle — 3 turluk gerçek bir sohbette gözlemlendi (mahzen/sandık teması), üslup tutarlı ve atmosferik
- [x] AI, karakter adı/ırk/sınıf'a uygun referanslar veriyor — Elf/Büyücü karakterle test edildi, cevaplarda "keskin elf gözleriniz" ve "asanızın gölgesi" gibi ırk/sınıfa özgü ayrıntılar geçti (genel şablon değil, gerçekten bağlama duyarlı)
- [x] Çok turlu sohbette önceki mesajlara tutarlı referans veriliyor — 2. ve 3. turdaki cevaplar 1. ve 2. turda tanıtılan sandığa doğrudan atıfta bulundu (AI'ın `recentMessages` bağlamını gerçekten kullandığının kanıtı)
- [x] AI, oyun durumunu (HP, envanter, konum) DEĞİŞTİRMİYOR — 3 turluk sohbet öncesi/sonrası karakter (HP/mana/envanter) ve sahne (token pozisyonları/loot/round) state'i birebir karşılaştırıldı, hiçbir alan değişmedi
- [x] Saatlik limit aşılınca gerçek AI akışının ortasında otomatik `source: "mock"`'a düşülüyor — `AI_HOURLY_LIMIT=2` ile canlı test edildi: 1. ve 2. istek `source: "ai"`, 3. ve 4. istek tam beklendiği gibi `source: "mock"`; tarayıcıda "(mock)" etiketi doğru göründü, konsol hatası yok

**Faz 2 tamamen kapandı — bilinen açık madde yok.**

## Faz 3 — Karakter yaratımı, BG3-esinli savaş sistemi, zengin AI anlatımı

Otomatik testlerle doğrulanan davranış (`backend/tests/dice.test.js`, `actionResolver.test.js`, `characterIntro.test.js`, `scene.test.js`'teki Faz 3-C testleri; `frontend/src/components/TacticalGrid.test.tsx`, `ChatPanel.test.tsx`, `CharacterCreation.test.tsx`):
- [x] D20 zar atma (`rollD20`) her zaman 1-20 aralığında, uç değerler (Math.random 0 ve ~1) doğru çalışıyor
- [x] `/character/roll-stats` ırk bonusunu doğru uyguluyor, geçersiz ırk için 400
- [x] `/character/create`'e geçerli attributes gönderilirse sunucu zar atmıyor (aynen kullanılıyor); eksik/geçersizse sunucu kendi zarını atıyor
- [x] `/character/intro`: var olmayan karakter 404; AI başarılı → `source:"ai"`; AI hata/key yok → sessizce mock açılışa düşüyor; üretilen mesaj sohbet geçmişine ilk GM mesajı olarak ekleniyor
- [x] `actionResolver`: nat20 her zaman critical-success, nat1 her zaman critical-failure (toplam DC'yi geçse/geçmese bile), DC 12 karşılaştırması doğru
- [x] Aksiyon ekonomisi: Kullan/Fırlat Aksiyon tüketiyor ve tükenmişken 400 dönüyor; Kuşan/Çıkar/At bedava kalıyor (PM onaylı kapsam); end-turn ile yeni aktif token'ın Aksiyon/Bonus Aksiyon hakları sıfırlanıyor
- [x] `gmMessage.roll` alanı her sohbet cevabında dolduruluyor, ChatPanel'de gösteriliyor

**Tarayıcıda uçtan uca regresyon (Playwright, 2026-08-22) — TAMAMLANDI:** Karakter oluştur (isim → zar animasyonu → D20 sonucu → dış görünüş) → AI/mock açılış hikayesi ekranı → "Devam Et" ile oyun ekranı → saldırı mesajı gönder (zar sonucu chat'te göründü) → eşya kullan (Aksiyon tüketti, backend doğru reddetti ikinci kullanımda) → iki kez "Turu Bitir" (Aksiyon sıfırlandı) → grid'de tıklayarak fırlat (çalıştı, Aksiyon tekrar tüketildi ve gösterge bu sefer doğru güncellendi). Konsol/sayfa hatası yok.

2 bulgu tespit edildi ve **Faz 3.5'te ikisi de düzeltilip doğrulandı** (commit eb04d66, detaylar TASKS.md'de):
1. ~~Aksiyon göstergesi CharacterCard-tetiklemeli eylemlerden sonra anında güncellenmiyordu~~ → düzeltildi, canlı doğrulandı (bkz. yukarıdaki "Taktik grid" bölümü)
2. ~~`actionResolver`'daki `ara` anahtar kelimesi çapasız regex yüzünden "duvara", "kaçarak" gibi kelimelerde yanlış stat'a düşüyordu~~ → düzeltildi, `WORD_START` kelime sınırıyla + testle doğrulandı

Gerçek Gemini AI içeriği bu turda yeniden doğrulanamadı (kota tükenmişti, 429) — fallback yolu sorunsuz çalıştı ama Faz 3'ün "5 duyu" + zar-bağlamlı anlatım kalitesi henüz gerçek bir AI cevabıyla görsel olarak teyit edilmedi; dolu kotalı bir key ile tekrar denenmeli.

**Faz 3 + Faz 3.5 kapandı — bilinen açık bug yok** (mock+outcome ton notu kayıtlı, düşük öncelikli, blocker değil).

## Faz 4 — Hareket bugları, ekipman slotları, basit düşman AI, BG3 görsel stili

Otomatik testlerle doğrulanan davranış: backend **138/138**, frontend **38/38**, tsc+vite build temiz.

- [x] Hedef kare boş olsa bile yol arada bir engelden geçiyorsa hareket reddediliyor ("Yol bir engelle kesiliyor.") — Bresenham yol kontrolü
- [x] Aynı turda ardışık hareketlerin toplam mesafesi (`movementLeft`) budget'i aşınca reddediliyor, dahilindeyse kabul ediliyor, end-turn'de `speed`'e sıfırlanıyor
- [x] Sahne başlığında "Hareket: kalan/max" göstergesi doğru çalışıyor
- [x] Ekipman: envanterdeki her eşyaya doğru slot atanıyor (Kısa Kılıç→El, Deri Zırh→Göğüs, İksir→yok); slotu olmayan eşya kuşanılamaz (400); aynı slotta yeni eşya kuşanılınca eskisi otomatik çıkarılıyor (paper-doll swap)
- [x] CharacterCard'da "Ekipman" başlığı altında 6 slotluk (Baş/Göğüs/Kollar/El/Bacaklar/Ayaklar) paper-doll görünümü — kuşanılmış eşya doğru slotta ve altın çerçeveyle, boş slotlar "(boş)"
- [x] Basit düşman AI: düşman sırası geldiğinde `Turu Bitir` çağrısı İÇİNDE otomatik olarak çözülüyor — bitişik değilse oyuncuya doğru hareket edip "X sana doğru yaklaşıyor." mesajı, bitişikse D20+2 vs DC12 ile saldırı deniyor (isabette d6 hasar + HP düşüyor, ıskada mesaj), sıra hemen oyuncuya geri dönüyor. Ek AI/LLM çağrısı YOK, tamamen deterministik.
- [x] Düşman mesajları sohbet geçmişine `source:"mock"` ile ekleniyor, ChatPanel'de görünüyor
- [x] BG3 görsel teması: Cinzel/Spectral fontları doğru yükleniyor, bronz/altın vurgulu paneller, iyi kontrast, okunabilirlik sorunu yok, bozuk layout yok — tarayıcıda (Playwright) görsel olarak doğrulandı

- [x] **Panel yerleşimi düzeltildi (commit 673f7f0) ve doğrulandı:** Sol=karakter, orta=Macera Günlüğü (sohbet, geniş sütun), sağ=taktik harita (380px) — Faz 3-B/4-B'de onaylanan yerleşim artık tarayıcıda (Playwright DOM sırası + ekran görüntüsü) doğrulandı.

**Faz 4 TAMAMEN KAPANDI** — bilinen açık madde yok (mock+outcome ton çelişkisi notu düşük öncelikli, blocker değil).

## Faz 5 (madde 1-2) — Vurma mekaniği + hareket sonrası otomatik anlatıcı

Otomatik testlerle doğrulanan davranış: backend **159/159**, frontend **44/44**, tsc+vite build temiz.

- [x] Bitişik bir düşman token'ına tıklamak saldırıyor (BG3 tarzı, ayrı buton yok); menzil dışıysa (bitişik değilse) 400
- [x] Saldırı sırası/Aksiyon hakkı kontrolü: sıra oyuncuda değilken veya Aksiyon tükenmişken 400
- [x] D20 + karakterin sınıfına göre primary attribute modifier'i (fighter→GÜÇ, wizard→ZEKA vb.) vs DC 12; nat1 her zaman ıska, nat20 kritik (iki d6 zarının toplamı hasar veriyor)
- [x] İsabetli saldırı hedefin HP'sini düşürüyor, Aksiyon hakkını tüketiyor; HP 0'a inince hedef sahneden kalkıyor, "yenildi" anlatımı ekleniyor, ölü hedefe tekrar saldırı reddediliyor
- [x] Saldırı sonucu (AI/mock) sohbete ekleniyor; karakter/sahne state'i frontend'de güncelleniyor
- [x] Grid'de token tooltip'i artık HP bilgisi gösteriyor; sıra oyuncudayken "Bitişik bir düşmana tıklayarak saldırabilirsin." ipucu görünüyor (fırlatma modunda gizli)
- [x] Başarılı her hareket sonrası otomatik olarak kısa bir AI/mock anlatım üretilip sohbete ekleniyor; başarısız hareket (menzil dışı/engelli) anlatım ÜRETMİYOR
- [x] Fallback ilkesi korunuyor (`services/narrationService.js` — chat/attack/move üçü paylaşıyor): key yok/hata/rate-limit → sessizce mock'a düşüyor

**Tarayıcıda uçtan uca canlı doğrulama (Playwright, 2026-08-22):** Karakter oluştur → hareket et (anlatım sohbete düştü: "Bir an için sessizlik çöküyor, sonra uzaktan boğuk bir kükreme duyuluyor.") → birkaç "Turu Bitir" ile düşmanın yaklaşmasını bekle → bitişik olunca düşman otomatik saldırdı (4 hasar, HP 12→8, "Goblin sana vuruyor! 4 hasar aldın. (18+2=20 vs 12, HP: 8/12)") → bitişik düşmana tıklayıp karşı saldırdım (Aksiyon ✗'e döndü, sonuç sohbete düştü). Konsol/sayfa hatası yok.

**Faz 5 madde 1-2 KAPANDI** — bilinen açık bug yok.

## Faz 5 madde 3 — SS13 tarzı ikonlu envanter/ekipman

Otomatik testlerle doğrulanan davranış: backend **165/165**, frontend **49/49**, tsc+vite build temiz.

- [x] 13 SS13 slotu (baş/maske/gözlük/kulak/boyun/sırt/zırh/üst giysi/eldiven/kemer/ayakkabı/aksesuar/el) doğru etiketleriyle render ediliyor
- [x] Her eşyaya karakter oluşturulurken slotuna göre doğru `icon` alanı atanıyor (`/icons/<slot>.png`); "el" slotundaki silahlar için asset setinde ikon yok, `icon: null` dönüyor (frontend emoji fallback ⚔ kullanıyor)
- [x] Dolu slot ikonuyla + altın "filled" çerçeveyle gösteriliyor, boş slot "·" yer tutucusu gösteriyor
- [x] Dolu bir slota tıklamak eşyayı çıkarıyor (aynı `equipItem`/toggle mantığı — swap, aynı slotta yeni eşya kuşanılınca eskisinin otomatik çıkması sayesinde zaten sağlanıyor), boş slot tıklanamıyor (disabled)
- [x] Envanter listesindeki her eşya (ikonu varsa) küçük bir thumbnail gösteriyor

**Tarayıcıda (Playwright) görsel QA — TAMAMLANDI (2026-08-22), kritik çünkü coder hiç canlı render görmemişti:** 13 slotlu paper-doll 3 sütunlu düzende doğru render edildi, tüm ikonlar gerçekten yüklendi (DOM'da `naturalWidth: 32`, `complete: true` — kırık/placeholder img yok), "Zırh" slotundaki ikon yakın çekim ekran görüntüsünde net bir zırh/yelek sprite'ı olarak tanındı (ERROR/bozuk görüntü YOK), "El" slotu ⚔ emoji fallback'i doğru gösterdi, dolu slota tıklayınca eşya başarıyla çıkarıldı. **CC BY-SA 3.0 atıf notu sayfa altında gerçekten görünüyor**: "İkonlar /tg/station projesinden, CC BY-SA 3.0 lisansı altında alınmıştır (github.com/tgstation/tgstation)." Konsol/sayfa hatası yok.

**Faz 5 (madde 1, 2, 3) TAMAMEN KAPANDI** — bilinen açık bug yok.

## Faz 6-A — Oturum izolasyonu (çoklu kullanıcı)

Otomatik testlerle doğrulanan davranış: backend **175/175**, frontend **57/57**, tsc+vite build temiz.

- [x] Her tarayıcı ilk ziyarette kendi `X-Session-Id`'sini üretip `localStorage`'a kaydediyor, sonraki tüm isteklerde aynı id gönderiliyor
- [x] İki farklı session tamamen bağımsız karakter/sahne/sohbete sahip — biri diğerini hiç görmüyor/etkilemiyor
- [x] `X-Session-Id` header'ı olmayan eski istekler (curl vb.) `"default"` oturumuna düşüyor, geriye dönük uyumluluk korunuyor
- [x] Rate limiter kasıtlı olarak GLOBAL (session-başına değil, uygulama-geneli tek kota — PM kararı)

**Tarayıcıda gerçek çoklu-kullanıcı testi (Playwright, iki ayrı browser context, 2026-08-22) — TAMAMLANDI:** İki bağımsız "kullanıcı" (izole localStorage) aynı anda karakter oluşturdu, sohbet etti, grid'de hareket etti — hiçbiri diğerinin ismini, sohbetini veya sahne durumunu görmedi/etkilemedi. Farklı session id'ler doğrulandı. Konsol hatası yok.

**Bilinen mimari not (bug değil, kayıt altında):** `item/use|equip|drop|throw` ve `/attack` endpoint'leri, gönderilen `characterId`'nin gerçekten o session'a ait olduğunu doğrulamıyor — sadece `characters` Map'inde var mı diye bakıyor. nanoid'ler tahmin edilemez olduğu için pratik risk düşük, testle belgelendi (`sessionIsolation.test.js`).

**Faz 6-A TAMAMEN KAPANDI** — bilinen açık bug yok.

## Faz 6-B — SQLite kalıcılık

Otomatik testlerle doğrulanan davranış: backend **184/184** (test koşumları otomatik `:memory:` DB kullanıyor, gerçek `game.db`'ye dokunmuyor), tsc/build backend-only olduğu için gerekmiyor.

- [x] Karakter/sahne/sohbet her mutasyon noktasında (create/move/end-turn/attack/item aksiyonları/chat/intro) SQLite'a da yazılıyor
- [x] Sunucu açılışında (`loadAll()`) DB'deki her şey in-memory Map'lere geri yükleniyor
- [x] DB boşken veya bir session'ın aktif karakteri yokken (`active_character_id` NULL) hata vermeden çalışıyor

**Gerçek dosya DB'siyle canlı restart testi (2026-08-22) — TAMAMLANDI, test suite'inin kullandığı `:memory:` değil, gerçek `game.db`:** Backend'i başlattım → karakter oluşturdum → grid'de hareket ettim → sohbet ettim → backend process'ini `taskkill` ile GERÇEKTEN sonlandırıp yeniden başlattım. Restart sonrası: karakter (isim/HP/envanter) birebir aynı, oyuncu token'ı tam hareket ettiğim konumda (movementLeft doğru düşürülmüş halde), sohbet geçmişindeki tüm mesajlar eksiksiz geri geldi.

**Faz 6-B TAMAMEN KAPANDI** — bilinen açık bug yok.

## Bilinen kısıtlar (bug değil, kayıt altında)
- SS13 slot listesinde ayrı bir "kalkan" slotu yok — Kalkan eşyası en yakın karşılık olan "back" (sırt) slotuna atanmış, PM/coder kararı, tutarlı davranıyor.
- Silahlar (hand slotu) için tgstation asset setinde ikon yok — frontend metin/emoji fallback (⚔) kullanıyor, kapsam dışı değil ama görsel olarak diğer slotlardan farklı.
- `frontend/src/data/dndNames.ts`, backend `data/dnd.js` ile elle senkron tutulması gereken statik bir kopya — ırk/sınıf listesi değişirse ikisi de güncellenmeli.
- Aksiyon ekonomisi kontrolü backend'de `/scene/item/use` ve `/scene/item/throw`'da uygulanıyor; grid hareketi (`/scene/move`) ayrı bir kaynaktan (movementLeft) yönetiliyor — PM onaylı kapsam, bug değil.
- Düşman AI tamamen scriptli/deterministik (greedy hareket + basit D20 saldırı) — karmaşık strateji, kapak/yükseklik mekaniği ve AI görsel üretimi Faz 4 kapsamı dışında bırakıldı (kullanıcı kararı).

## Faz 6-C — Oyun döngüsü (ölüm/seviye/büyü), backend+frontend

Otomatik testlerle doğrulanan davranış: backend **216/216**, frontend **73/73**, tsc+vite build temiz.

- [x] Öldürme başına 20 XP, eşik level×50, seviye atlayınca HP.max/mana.max +2 (tam dolum) + primary attribute +1
- [x] "İyileştir" (hedefsiz, kendine) ve "Ateş Topu" (menzilli, hedef-seç modu) büyüleri doğru mana/menzil/hasar mantığıyla çalışıyor
- [x] Mana yetersizken büyü butonları disabled; `mana.max===0` sınıflarda "Büyüler" bölümü hiç görünmüyor
- [x] `hp.current<=0` olunca GameOverScreen gösteriliyor, savaş fiilen duruyor (attack/cast/item 400 ile reddediliyor)
- [x] "Yeniden Başla" → `/character/reset` → karakter oluşturma ekranına dönülüyor, eski karakter kaydı DB'de kalıyor (sadece session bağı kopuyor)

**Bulunan bug (coder tarafından anında düzeltildi, commit `a2d6bab`):** Büyü hedef-seç modundayken düşman olmayan bir hücreye tıklamak sessizce oyuncuyu hareket ettiriyordu (`castSpell` yerine `moveToken` çağrılıyordu). Regresyon testiyle yakalandı, aynı oturumda düzeltildi ve doğrulandı.

**Kritik süreç bulgusu (kod bug'ı değil):** QA'ya başlarken çalışan backend dev server'ı (`node server.js`, watch'sız) coder'ın Faz 6-C route'larını (`/scene/cast`, `/character/reset`) hiç yüklememişti — eski bir process'ti, restart edilmemişti. `/scene/cast` ve `/character/reset` 404 "Cannot POST" dönüyordu, halbuki backend test suite'i (kendi Express app instance'ını kuran) 216/216 yeşildi. `taskkill`+`npm run dev` ile restart edince düzeldi. **Büyük bir faz kapanışından önce dev server'ın gerçekten yeniden başlatıldığını doğrulamak gerekiyor — "testler yeşil" tek başına yeterli değil.**

**Tarayıcıda uçtan uca canlı QA (Playwright, restart edilmiş backend'e karşı, 2026-08-22) — TAMAMLANDI:** Büyücü oluştur → İyileştir'i cast et (mana 12→8, HP güncellendi, sohbete anlatım düştü) → Ateş Topu hedef-seç moduna gir (grid'de "Büyü hedefi seç" göstergesi doğru) → tur döngüsüyle HP'yi 0'a düşür → **GameOverScreen doğru render edildi** → "Yeniden Başla" ile **Karakter Oluştur formuna başarıyla dönüldü**. Konsol hatalarının hepsi beklenen (400 = menzil-dışı/HP-0 sonrası reddedilen istekler, birkaç başlangıç 404'ü) — gerçek hata yok.

**İki ayrı session ile Faz 6-A rejeksiyon testi (restart edilmiş backend'e karşı) — TAMAMLANDI:** iki bağımsız browser context tamamen izole kaldı, farklı `X-Session-Id`'ler doğrulandı.

**"Biri ölüp reset atarken diğeri etkilenmemeli" senaryosu (curl, gerçek `game.db`) — TAMAMLANDI:** A `/character/reset` ile sıfırlandı, B'nin karakteri (isim/HP/envanter) hiç etkilenmeden erişilebilir kaldı.

**Gerçek dosya DB'siyle son restart doğrulaması (`:memory:` değil, gerçek `game.db`) — TAMAMLANDI:** Karakter oluşturuldu, backend `taskkill` ile gerçekten sonlandırılıp yeniden başlatıldı, karakter (isim/HP/envanter) birebir geri geldi.

**Faz 6 (A+B+C) TAMAMEN KAPANDI** — bilinen açık bug yok. QA sırasında oluşturulan test verileri gerçek `game.db`'den temizlendi.

## Faz 7 — İçerik çeşitliliği + Postgres soyutlaması + Render deploy hazırlığı

Otomatik testlerle doğrulanan davranış: backend **237/237**, frontend **75/75**, tsc+vite build (varsayılan + `VITE_API_BASE` override'lı) temiz.

- [x] Karşılaşma temizlenince (`/attack` veya `/cast`) sıradaki alana otomatik geçiliyor, ilerleme (`encounterIndex/totalEncounters`) DB'ye yazılıp restart sonrası korunuyor, frontend'de "Karşılaşma: N/M" doğru gösteriliyor
- [x] Çok düşmanlı bir karşılaşmada sadece SON düşman ölünce geçiş tetikleniyor (ilk düşman ölümünde henüz değil)
- [x] `DATABASE_URL` yokken davranış hiç değişmedi (SQLite, testler dahil); `DATABASE_URL`+`VITEST` iken de yine SQLite (test izolasyonu korunuyor); `DATABASE_URL` tek başına iken Postgres motoru seçiliyor ve modül import anında çökmüyor
- [x] Erişilemez bir Postgres URL'iyle gerçek sunucu başlatma denemesi net bir hatayla (ECONNREFUSED) temiz exit ediyor (asılı kalmıyor) — bağımsız olarak tekrar doğrulandı
- [x] `VITE_API_BASE` build-time env'i verilince bundle'a tam backend URL'i gömülüyor, verilmeyince varsayılan `/api` proxy davranışı bozulmuyor — iki gerçek `vite build` ile doğrulandı
- [x] `render.yaml`'daki `healthCheckPath` (`/api/health`) gerçekten var ve çalışıyor, hiçbir secret dosyada yok

**Not:** Gerçek bir Postgres/Render ortamı yok — Postgres bağlantısı ve Render'daki `fromService` şema uyumu dry-run/mock ile doğrulandı, gerçek deploy denemesi PM+kullanıcı ile ayrıca yapılacak (bu tester'ın/coder'ın yetkisinde değil).

**Faz 7 (A+B+C) TAMAMEN KAPANDI** — bilinen açık bug yok.

## Kapsam dışı (bilerek yok, "bug" olarak raporlamayın)
- Gerçek LLM tabanlı GM (Gemini varsa kullanılıyor, yoksa kural tabanlı/şablon metin — bkz. Faz 2)
- Login/hesap sistemi (oturum izolasyonu var — Faz 6-A — ve kalıcılık var — Faz 6-B, SQLite — ama kullanıcı hesabı/parola/login akışı yok, sessionId localStorage tabanlı anonim kimlik)
- Sahne görselleri (statik placeholder yok, sadece grid) ve AI ile görsel/portre üretimi
- Savaş mekaniği derinliği (kapak, yükseklik, fırlatma menzili vb.)
