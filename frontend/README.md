# Frontend — D&D AI Game Master

React + TypeScript + Vite. Backend'in (`../backend`) `http://localhost:3001` üzerinde çalıştığını varsayar; dev sunucusu `/api` isteklerini oraya proxy'ler (bkz. `vite.config.ts`).

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

- `src/types.ts` — backend ile paylaşılan tipler (Character, Scene, ChatMessage, ...)
- `src/api.ts` — `/api/*` fetch sarmalayıcıları, `NetworkError` (bağlantı hatası) ile normal HTTP hatalarını ayırt eder
- `src/App.tsx` — ekranlar arası akışı yönetir (yükleniyor → karakter oluşturma → açılış sahnesi → oyun → game over), session'ın aktif karakterini/sahnesini backend'den çeker
- `src/components/`
  - `CharacterCreation.tsx` — isim + ırk + sınıf + görünüş seçimi formu, zar atma
  - `IntroScreen.tsx` — karakter oluşturulduktan sonra AI/mock açılış anlatımını gösteren tam ekran ara sahne
  - `CharacterCard.tsx` — HP/mana barları, XP/seviye ilerleme çubuğu, attributes, envanter (kullan/kuşan/at/fırlat), büyü listesi
  - `ChatPanel.tsx` — GM sohbet akışı
  - `TacticalGrid.tsx` — tıklanabilir taktik grid harita: token hareketi, saldırı, büyü (tekli hedef ve Ateş Topu gibi alan etkili/AoE), tur bitirme, Aksiyon/Bonus Aksiyon göstergesi
  - `HelpModal.tsx` — "Nasıl Oynanır?" yardım penceresi (ilk oyun ekranında bir kerelik otomatik açılır, `localStorage`'da işaretlenir)
  - `GameOverScreen.tsx` — karakter öldüğünde gösterilen özet ekranı (seviye, XP, temizlenen karşılaşma sayısı), yeniden başlatma
  - `ErrorBoundary.tsx` — beklenmeyen render hatalarını yakalayıp sayfayı yeniden yüklemeyi teklif eden genel hata sınırı

## Mimari notları

- Sürekli görünen 3 panelli bir düzen yerine, ana görünüm normalde tam ekran metin/sohbet modundadır (`ChatPanel`); taktik grid SADECE sahnede düşman varken (ya da bir eşya fırlatma/büyü hedefi seçilirken) otomatik olarak görünür (`App.tsx`'teki `showGrid`/`mode-combat` / `mode-text`).
- Karakter paneli (`CharacterCard`) artık sürekli görünen bir panel değil, üst çubuktaki bir düğmeyle açılıp kapanan bir overlay'dir.
- Bir karşılaşma temizlendiğinde sahne hemen bir sonrakine geçmez — backend "nefes alma" penceresine girer (`pendingEncounterIndex`); bu sırada grid gizlenir ve oyuncuya ayrı bir "Devam Et" butonu gösterilir.
- `App.tsx` sahne/token state'ini kendisi tutmaz; `TacticalGrid`'in `onSceneUpdate` callback'i üzerinden `hasEnemies`, oyuncunun `actionAvailable`/`bonusActionAvailable` durumu gibi bilgiler yukarı taşınıp `CharacterCard`'a prop olarak geçirilir (böylece envanterdeki "Kullan"/"Fırlat" butonları da Aksiyon ekonomisine uyar).
- Render'ın soğuk başlangıcında ilk isteğin 30-60sn sürebilmesi ihtimaline karşı, başlangıç karakterini çekerken bağlantı hatalarında birkaç kez otomatik yeniden deneme yapılır (kullanıcıya "bağlanılıyor" geri bildirimiyle).

## Testler / lint

```bash
npm test         # vitest run
npm run lint     # oxlint
```
