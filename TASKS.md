# Görev Listesi

Durum: `[ ]` yapılmadı, `[~]` devam ediyor, `[x]` tamamlandı

## Faz 1 — İskelet

### Coder
- [x] `backend/`: package.json + Express server scaffold (server.js, `npm start`)
- [x] `backend`: karakter oluşturma endpoint'i (`POST /api/character/create`) — sadece D&D, ırk/sınıf/isim al
- [x] `backend`: karakter state endpoint'leri (`GET/POST /api/character`)
- [x] `backend`: sohbet endpoint'leri (`GET/POST /api/chat`) — GM cevabı kural tabanlı/şablon metin üretsin (rastgele flavor text havuzu yeterli)
- [x] `backend`: sahne/taktik map endpoint'leri (`GET /api/scene`, `move`, `end-turn`, item use/equip/drop/throw)
- [ ] `frontend/`: Vite + React + TS scaffold
- [ ] `frontend`: karakter oluşturma formu (ırk + sınıf seçimi, isim) — tek evren, wizard yok
- [ ] `frontend`: karakter kartı bileşeni (HP/mana/attributes/envanter)
- [ ] `frontend`: sohbet akışı bileşeni
- [ ] `frontend`: taktik grid harita bileşeni

### Tester
- [ ] Backend test altyapısı kur (örn. Vitest + supertest)
- [ ] Frontend test altyapısı kur (örn. Vitest + React Testing Library)
- [ ] Karakter oluşturma endpoint'i için testler
- [ ] Sohbet endpoint'i için testler
- [ ] Taktik map endpoint'leri için testler (move/end-turn/item işlemleri)
- [ ] Manuel QA checklist'i hazırla (Faz 1 tamamlanınca kullanılacak)

## Notlar
- FRP (`C:\Users\erdem\OneDrive\Masaüstü\FRP`) yalnızca konsept referansıdır, kod kopyalanmayacak.
- Değişiklik/karar gerektiren konularda PM'e (bu session) danışın, kullanıcıya sormadan büyük mimari karar almayın.
