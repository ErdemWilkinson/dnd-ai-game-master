# Backend — D&D AI Game Master

Node.js + Express API. Faz 1: state bellek-içi (in-memory), kalıcılık yok — sunucu yeniden başlatılınca sıfırlanır.

## Kurulum

```bash
cd backend
npm install
```

## Çalıştırma

```bash
npm start       # node server.js
npm run dev     # node --watch server.js (dosya değişince otomatik yeniden başlar)
```

Varsayılan port: `3001` (`PORT` env değişkeniyle değiştirilebilir). Sağlık kontrolü: `GET /api/health`.

## Endpoint'ler

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/character/options` | Seçilebilir ırk/sınıf listesi |
| POST | `/api/character/create` | `{ name, raceId, classId }` — yeni karakter oluşturur, aktif karakter yapar |
| GET | `/api/character` | Aktif karakteri döner |
| POST | `/api/character` | Aktif karakterin hp/mana/attributes/inventory alanlarını günceller |
| GET | `/api/character/:id` | ID ile karakter getirir |
| GET | `/api/chat` | Sohbet geçmişi |
| POST | `/api/chat` | `{ message }` — oyuncu mesajı ekler, kural tabanlı GM cevabı üretir |
| GET | `/api/scene` | Aktif sahne/taktik harita durumu |
| POST | `/api/scene/move` | `{ tokenId, x, y }` — token hareketi (menzil/engel kontrolü) |
| POST | `/api/scene/end-turn` | Sırayı bir sonraki token'a geçirir |
| POST | `/api/scene/item/use` | `{ characterId, itemId }` — eşya kullan |
| POST | `/api/scene/item/equip` | `{ characterId, itemId }` — eşya kuşan/çıkar |
| POST | `/api/scene/item/drop` | `{ characterId, itemId }` — eşya at (oyuncu token'ının konumuna loot olarak düşer) |
| POST | `/api/scene/item/throw` | `{ characterId, itemId, x, y }` — eşyayı belirtilen kareye fırlat |

## Notlar

- GM cevapları `data/gmFlavor.js` içindeki şablon metin havuzlarından rastgele seçilir (gerçek LLM entegrasyonu sonraki fazda).
- Tüm state `data/store.js` içindeki `Map`'lerde tutulur; tek oyunculu, tek "aktif" karakter/sahne varsayımıyla çalışır.
