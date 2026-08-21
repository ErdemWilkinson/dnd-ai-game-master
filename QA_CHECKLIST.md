# Manuel QA Checklist — Faz 1 / Faz 1.5 / Faz 2

Kullanım: backend (`cd backend && npm start`, :3001) ve frontend (`cd frontend && npm run dev`, :5173) ayrı terminallerde çalışırken, tarayıcıda `http://localhost:5173` açılarak sırayla kontrol edilir.

Durum: Faz 1.5 bug-fix turu tamamlandı (2026-08-21), tüm maddeler tester tarafından hem otomatik testle hem tarayıcıda doğrulandı. Geçmiş bug numaraları (TASKS.md > "Bulunan Buglar") referans olarak bırakıldı. Faz 2 (Gemini AI GM) iskeleti otomatik testlerle (mock) doğrulandı (2026-08-22); gerçek key ile manuel tur henüz yapılmadı, kullanıcı key sağlayınca bu dosyaya işlenecek.

## Karakter oluşturma
- [x] Sayfa ilk açıldığında, aktif karakter yoksa karakter oluşturma formu görünüyor (isim, ırk, sınıf)
- [x] Isim boş bırakılıp gönderilirse "İsim gerekli." hatası gösteriliyor, istek atılmıyor
- [x] Geçerli isim + ırk + sınıf ile "Maceraya Başla" karakteri oluşturuyor ve oyun ekranına geçiyor
- [x] Farklı ırk/sınıf kombinasyonlarında HP/Mana/attribute başlangıç değerleri ırk bonusu + sınıf temel değerine göre doğru
- [x] Karakter kartındaki ırk/sınıf satırı Türkçe isimle gösteriliyor ("Elf · Büyücü" vb., eski bug #3 düzeltildi)

## Sohbet (GM)
- [x] Mesaj gönderilince hem oyuncu mesajı hem GM cevabı sohbet akışında görünüyor
- [x] Boş mesaj gönderilemiyor
- [x] "saldır" / "bak" / "konuş" gibi anahtar kelimeler farklı flavor-text kategorisi tetikliyor
- [x] Sayfa yenilenince önceki sohbet geçmişi geri geliyor (Bug #4 düzeltildi, artık karakter ekranına ulaşılıyor)

## Taktik grid
- [x] Harita, engeller, loot ve iki token (oyuncu + goblin) doğru render ediliyor
- [x] Menzil dışı bir hücreye tıklayınca hata mesajı gösteriliyor, token hareket etmiyor
- [x] Engelli bir hücreye tıklayınca hata mesajı gösteriliyor
- [x] Menzil içi boş bir hücreye tıklayınca token o hücreye taşınıyor
- [x] Loot olan bir hücreye hareket edince loot toplanıyor (haritadan kayboluyor)
- [x] "Turu Bitir" sıradaki token'a geçiyor, tüm tokenlar turunu tamamlayınca tur sayacı artıyor
- [x] Düşman sırasındayken grid'e tıklamak engelleniyor: "Sıra sende değil." hatası gösteriliyor, grid görsel olarak pasifleşiyor (`grid-disabled`), backend'e istek gitmiyor (Bug #5 düzeltildi — PM kararı: engelle)
- [x] Sıra tekrar oyuncuya geçince engel kalkıyor, hareket normal çalışıyor

## Envanter
- [x] Her eşya satırında Kullan / Kuşan(-Çıkar) / At / Fırlat butonları var (Bug #2 düzeltildi)
- [x] İksir kullanınca HP artıyor (max'a kadar), eşya envanterden düşüyor (Bug #1 düzeltildi — Türkçe "İ" regex sorunu)
- [x] Kuşanma toggle'ı "kuşanıldı" etiketini doğru gösterip kaldırıyor, buton metni Kuşan↔Çıkar arası değişiyor
- [x] Eşya atınca (drop) envanterden düşüp sahnenin loot listesine ekleniyor
- [x] Fırlat: X/Y girip onaylayınca eşya envanterden düşüp belirtilen koordinata loot olarak ekleniyor

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

## Bilinen kısıtlar (bug değil, kayıt altında)
- Düşman sırası engeli sadece frontend'de (istemci tarafı kontrol); backend `/scene/move` teknik olarak hâlâ herhangi bir aktif token'ı kabul ediyor. Tek istemcili Faz 1'de risksiz.
- `frontend/src/data/dndNames.ts`, backend `data/dnd.js` ile elle senkron tutulması gereken statik bir kopya — ırk/sınıf listesi değişirse ikisi de güncellenmeli.

## Kapsam dışı (Faz 1'de bilerek yok, "bug" olarak raporlamayın)
- Gerçek LLM tabanlı GM (şu an kural tabanlı/şablon metin)
- Kalıcı depolama / login / çoklu oturum (state sunucu belleğinde, tek global oturum)
- Sahne görselleri (statik placeholder yok, sadece grid)
- Düşman AI / otomatik saldırı mantığı
