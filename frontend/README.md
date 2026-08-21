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

## Yapı

- `src/types.ts` — backend ile paylaşılan tipler (Character, Scene, ChatMessage, ...)
- `src/api.ts` — `/api/*` fetch sarmalayıcıları
- `src/components/`
  - `CharacterCreation.tsx` — isim + ırk + sınıf seçimi formu
  - `CharacterCard.tsx` — HP/mana barları, attributes, envanter
  - `ChatPanel.tsx` — GM sohbet akışı
  - `TacticalGrid.tsx` — tıklanabilir taktik grid harita (hareket, tur bitir)

## Bilinen kısıtlar (Faz 1)

- Kimlik doğrulama / çoklu oyuncu yok; backend tek "aktif" karakter/sahne varsayar.
- GM cevapları backend'de kural tabanlı şablon metinlerden üretilir.
