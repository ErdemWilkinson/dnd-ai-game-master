# Proje: D&D AI Game Master (isim henüz kesinleşmedi)

## Konsept
Tek oyunculu, sohbet tabanlı, taktik ızgaralı bir D&D RPG simülatörü.
- Oyuncu karakter oluşturur (ırk/sınıf seçimi, isim).
- Game Master (GM) Google Gemini API ile gerçek AI anlatım üretir; key yoksa/hata/timeout/kota aşımı olursa sessizce kural tabanlı mock metinlere düşer (bkz. aşağıdaki "AI GM" notu).
- Karakter kartı: HP, mana, attributes, envanter (kullan/kuşan/at/fırlat).
- Taktik grid harita: token hareketi, engeller, loot, tur sistemi.
- Taktik grid, sadece düşman varken görünür olacak şekilde tam ekran metin/sohbet moduyla otomatik geçiş yapar (Faz 11).

## Kapsam kararları
- Sadece **D&D evreni** (Star Wars / Naruto YOK — ileride eklenebilir ama şimdi değil).
- **Referans**: `C:\Users\erdem\OneDrive\Masaüstü\FRP` klasöründeki prototip konsept ilhamı olarak incelendi.
  **BİREBİR KOPYALANMAYACAK** — kod sıfırdan, temiz yazılacak. Sadece fikir/veri modeli referansı.
- AI GM: Faz 1/1.5'te **sahte/kural tabanlı** (rastgele/şablon metinler). Faz 2'de **Google Gemini API** (ücretsiz katman) ile gerçek AI GM eklendi — maliyet/darboğaz riski nedeniyle Claude API yerine tercih edildi. Rate limit aşılırsa veya key yoksa/hata olursa otomatik olarak mock GM'e (Faz 1'deki flavor text) düşülür — AI bir "üst katman", oyunun temel akışı asla ona bağımlı değil.

## Stack
- Frontend: React + Vite (TypeScript)
- Backend: Node.js + Express
- Konum: bu repo kökü (`frontend/`, `backend/`)

## Roller
Güncel session isimleri sıkça değişir (pencere yeniden başlatıldıkça) — güncel isimler için `AGENTS.md`'ye bakın, burada tekrar edilmiyor.
- **coder**: implementasyon
- **tester**: test yazımı + QA
- **PM** (bu session): görev dağıtımı, karar koordinasyonu, kullanıcıyla iletişim

## Çalışma düzeni
- Görevler `TASKS.md` içinde tutulur, PM tarafından güncellenir.
- PM her 15 dakikada bir coder ve tester'a ilerleme/görev hatırlatması gönderir (cron).
