# CLAUDE.md

Bu repoda çalışan her Claude Code session'ı için genel talimatlar.

## Proje
Bkz. [PROJECT.md](./PROJECT.md) — konsept, kapsam kararları, stack.
Bkz. [TASKS.md](./TASKS.md) — güncel görev listesi ve durumları.
Bkz. [AGENTS.md](./AGENTS.md) — session rolleri ve koordinasyon kuralları.

## Kurallar
- `C:\Users\erdem\OneDrive\Masaüstü\FRP` klasörü sadece **konsept referansıdır**. Kod oradan birebir kopyalanmayacak.
- Kapsam: şimdilik yalnızca **D&D evreni**. Star Wars/Naruto gibi ek evrenler eklenmeyecek (kullanıcı aksini söylemedikçe).
- AI Game Master şimdilik **kural tabanlı/mock** — gerçek LLM entegrasyonu ayrı bir faz, kullanıcı onayı olmadan başlatılmaz.
- Büyük mimari/kapsam kararları PM session'ına danışılır, kullanıcıya doğrudan sorulmaz (PM zaten kullanıcıyla koordine).
- Commit atmadan önce `git status` ile neyin stage edildiğine bak, gereksiz/büyük dosya (örn. `node_modules`) commit'lenmesin.

## Çalıştırma
- Backend: `cd backend && npm install && npm start`
- Frontend: `cd frontend && npm install && npm run dev`
(Detaylar ilerledikçe güncellenecek.)
