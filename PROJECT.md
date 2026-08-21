# Proje: D&D AI Game Master (isim henüz kesinleşmedi)

## Konsept
Tek oyunculu, sohbet tabanlı, taktik ızgaralı bir D&D RPG simülatörü.
- Oyuncu karakter oluşturur (ırk/sınıf seçimi, isim).
- Game Master (GM) şimdilik **kural tabanlı / mock** metinlerle anlatım yapar (gerçek LLM entegrasyonu sonraki faz).
- Karakter kartı: HP, mana, attributes, envanter (kullan/kuşan/at/fırlat).
- Taktik grid harita: token hareketi, engeller, loot, tur sistemi.
- Sahne görseli (statik placeholder resimler).

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
- **coder** session (claude-game-b7): implementasyon
- **tester** session (claude-game-5c): test yazımı + QA
- **PM** (bu session): görev dağıtımı, karar koordinasyonu, kullanıcıyla iletişim

## Çalışma düzeni
- Görevler `TASKS.md` içinde tutulur, PM tarafından güncellenir.
- PM her 15 dakikada bir coder ve tester'a ilerleme/görev hatırlatması gönderir (cron).
