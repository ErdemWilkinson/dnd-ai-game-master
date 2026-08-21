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

**Gerçek key ile QA — kısmen tamamlandı (2026-08-22):** Kullanıcının sağladığı key, Google Cloud proje tarafında bir faturalandırma/kota bloke'una takılıyor (`429 "Your prepayment credits are depleted"` — denenen tüm modellerde, `gemini-2.5-flash`/`gemini-3.1-flash-lite`/`gemini-2.5-flash-lite`/`gemini-3.7-flash`/`gemini-flash-lite-latest`). Bu kod tarafında düzeltilebilecek bir şey değil, kullanıcının Google AI Studio/Cloud faturalandırma ayarlarını düzeltmesi gerekiyor (ai.google.dev/gemini-api/docs/billing#prepay). **Bu blocker sayesinde tester olarak gerçek Gemini SDK + gerçek ağ çağrısıyla fallback yolunu uçtan uca doğrulama fırsatı doğdu** — aşağıdaki ilk 2 madde bu şekilde zaten doğrulandı:
- [x] Geçersiz/hatalı/kota aşmış bir key ile backend çökmüyor, sessizce mock'a düşüyor — gerçek 429 hatası ile canlı doğrulandı (backend log: "AI GM çağrısı başarısız, mock'a düşülüyor: ... 429 Too Many Requests ...")
- [x] Frontend'de mock mesajlarda "GM (mock)" etiketi görünüyor — tarayıcıda gerçek key ile canlı doğrulandı, konsol/sayfa hatası yok
- [ ] `backend/.env` içine geçerli (faturalandırması aktif) bir `GEMINI_API_KEY` girilip ilk sohbet mesajında `source: "ai"` dönüyor mu — **kullanıcının billing sorununu çözmesini bekliyor**
- [ ] AI'ın anlatımı Türkçe, atmosferik ve 2-4 cümle civarında mı (prompt'un istediği gibi) — **bekliyor**
- [ ] AI, karakter adı/ırk/sınıf/HP gibi bağlama uygun referanslar veriyor mu (birkaç farklı mesajla dene) — **bekliyor**
- [ ] AI, oyun durumunu (HP, envanter, konum) DEĞİŞTİRMİYOR — sadece anlatım üretiyor mu (state hâlâ backend'in kontrolünde olmalı) — **bekliyor**
- [ ] Arka arkaya çok sayıda mesaj gönderilip saatlik limit (varsayılan 30) aşıldığında gerçek AI akışından otomatik olarak `source: "mock"`'a düşüyor mu — **bekliyor** (mock ile birim testte zaten doğrulandı, ama gerçek AI akışının ortasında da denenmeli)

## Bilinen kısıtlar (bug değil, kayıt altında)
- Düşman sırası engeli sadece frontend'de (istemci tarafı kontrol); backend `/scene/move` teknik olarak hâlâ herhangi bir aktif token'ı kabul ediyor. Tek istemcili Faz 1'de risksiz.
- `frontend/src/data/dndNames.ts`, backend `data/dnd.js` ile elle senkron tutulması gereken statik bir kopya — ırk/sınıf listesi değişirse ikisi de güncellenmeli.

## Kapsam dışı (Faz 1'de bilerek yok, "bug" olarak raporlamayın)
- Gerçek LLM tabanlı GM (şu an kural tabanlı/şablon metin)
- Kalıcı depolama / login / çoklu oturum (state sunucu belleğinde, tek global oturum)
- Sahne görselleri (statik placeholder yok, sadece grid)
- Düşman AI / otomatik saldırı mantığı
