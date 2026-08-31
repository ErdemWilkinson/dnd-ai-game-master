# Frontend — D&D AI Game Master

React + TypeScript + Vite. Backend'in (`../backend`) `http://localhost:3001` üzerinde çalıştığını varsayar; dev sunucusu `/api` isteklerini oraya proxy'ler (bkz. `vite.config.ts`).

Faz 12 (2026-08) ile eski taktik-grid arayüzü (tıklanabilir harita, token hareketi, Aksiyon/Bonus
Aksiyon ekonomisi) tamamen kaldırıldı. Oyun artık tek bir **tam ekran sohbet** (`ChatPanel`) — oyuncu
ne yapmak istediğini doğal Türkçe ile yazar, backend mekanik sonucu çözer. Karakter/envanter artık
"salt-okunur" bir kart (`CharacterCard`) — hiçbir buton/tıklama içermez, tüm aksiyonlar chat üzerinden.

## Kurulum

```bash
cd frontend
npm install
```

## Çalıştırma

```bash
npm run dev      # http://localhost:5173, backend'in ayrıca çalışıyor olması gerekir
npm run build    # tip kontrolü (tsc -b) + production build -> dist/
npm run preview  # build çıktısını yerelde önizler
```

## Ortam değişkenleri

| Değişken | Zorunlu mu | Açıklama |
|---|---|---|
| `VITE_API_BASE` | Hayır | Build-time. Ayarlanmazsa `/api` kullanılır (yerel dev proxy'si için). Production'da (örn. Render Static Site, backend'den ayrı bir origin) backend'in tam URL'i verilmeli, örn. `VITE_API_BASE=https://dnd-game-backend.onrender.com/api npm run build` |

## Yapı

- `src/types.ts` — backend ile paylaşılan tipler (Character, ChatMessage, ...)
- `src/api.ts` — `/api/*` fetch sarmalayıcıları, `NetworkError` (bağlantı hatası) ile normal HTTP hatalarını ayırt eder
- `src/App.tsx` — ekranlar arası akışı yönetir (yükleniyor → karakter oluşturma → açılış anlatımı → oyun → game over), session'ın aktif karakterini backend'den çeker
- `src/components/`
  - `CharacterCreation.tsx` — isim + ırk + sınıf + görünüş seçimi formu, zar atma
  - `IntroScreen.tsx` — karakter oluşturulduktan sonra AI/mock açılış anlatımını gösteren tam ekran ara sahne
  - `HeaderHud.tsx` — header'da her zaman görünen kısa HP/Mana/Seviye şeridi (`aria-live` ile ekran okuyucu güncellemesi)
  - `CharacterCard.tsx` — 🎒 butonuyla açılan overlay: HP/mana/XP barları, attributes, paper-doll ekipman görünümü, envanter listesi — **tamamen salt-okunur**, hiçbir buton/aksiyon içermez (saldırı/büyü/eşya kullan-kuşan-bırak-al artık chat üzerinden doğal dille yapılır)
  - `ChatPanel.tsx` — GM sohbet akışı, oyuncunun tek etkileşim yüzeyi (mesaj yazıp gönderme)
  - `HelpModal.tsx` — "Nasıl Oynanır?" yardım penceresi (ilk oyun ekranında bir kerelik otomatik açılır, `localStorage`'da işaretlenir) — serbest-form sohbet örnekleri anlatır
  - `GameOverScreen.tsx` — karakter öldüğünde gösterilen özet ekranı (seviye, XP), yeniden başlatma
  - `ErrorBoundary.tsx` — beklenmeyen render hatalarını yakalayıp sayfayı yeniden yüklemeyi teklif eden genel hata sınırı

## Mimari notları

- Grid/token/sahne state'i YOK — ana görünüm her zaman tam ekran sohbet (`ChatPanel`), `App.tsx`
  başka bir "mod" (savaş/metin) yönetmez. Backend'deki serbest-form düşman/karşılaşma durumu
  frontend'e hiç sızmaz, oyuncu sadece chat mesajlarının anlatımından (narration) öğrenir.
- Karakter paneli (`CharacterCard`) sürekli görünen bir panel değil, üst çubuktaki 🎒 düğmesiyle
  açılıp kapanan salt-okunur bir overlay'dir — HP/Mana'yı her an görmek için ayrıca `HeaderHud`
  (header'da sabit, `CharacterCard` açık olmasa da görünür) kullanılır.
  - "Menü/buton yok" tasarım kararı (PM onaylı): eskiden burada Kullan/Kuşan/At/Fırlat/Büyü-seç
    butonları ve drag-and-drop kuşanma vardı, Faz 12-C-hazırlık 2 ile hepsi kaldırıldı — eşya
    fırlatma (`throw`) için freeform karşılığı bilinçli olarak eklenmedi (kabul edilebilir bir
    kayıp), bırakma (`drop`) ise sonradan chat'e eklendi (bkz. backend TASKS.md fikir #96).
- `ChatPanel`, backend'den dönen güncel `character` nesnesini her mesajdan sonra `onCharacterChange`
  callback'iyle `App.tsx`'e taşır — `App.tsx` bunu state'te tutup `HeaderHud`/`CharacterCard`'a prop
  olarak geçirir (ayrı bir polling/refetch yok, sohbet cevabı zaten güncel karakteri içeriyor).
- Render'ın soğuk başlangıcında ilk isteğin 30-60sn sürebilmesi ihtimaline karşı, başlangıç karakterini çekerken bağlantı hatalarında birkaç kez otomatik yeniden deneme yapılır (kullanıcıya "bağlanılıyor" geri bildirimiyle).

## Testler / lint

```bash
npm test         # vitest run
npm run lint     # oxlint
```
