# AGENTS.md

Bu projede 3 Claude Code session'ı birlikte çalışır.

## Roller
- **PM** (proje yöneticisi): Kullanıcıyla iletişim, kapsam/karar netleştirme, görev dağıtımı (`TASKS.md`), 15 dakikada bir coder/tester'a ilerleme kontrolü.
- **coder** (`claude-game-ec`, önceki `claude-game-c8`/`claude-game-38` — pencereler 2026-08-25'te yeniden başladı, isimler değişti): Kullanıcı bu session'a doğrudan "sen codersın, PM ve tester işini de kendin yap" dediği için `claude-game-ec` hem coder hem kendi PM/tester doğrulamasını kendisi yapıyor.
- **tester** (`claude-game-74`, 2026-08-26'da PM tarafından yeniden aktifleştirildi — Faz 8'de tester'dı, uzun süre yanıtsız kaldıktan sonra tekrar bağlandı): Faz 12 (yüksek riskli mimari değişiklik) için bağımsız QA sağlıyor, `claude-game-ec`'in üzerinde çalıştığı dosyalara dokunmuyor.
- **claude-game-34**: Rolü hâlâ netleşmedi (kullanıcıdan ayrı bir talimat almış olabilir) — netleşene kadar boşta, kimsenin işine dokunmuyor.

Not: session isimleri pencere/oturum yeniden başlatıldığında değişebilir (rastgele bir sonek atanıyor) — güncel isimler için PM ile teyit edin, bu dosya güncel olmayabilir.

## Koordinasyon kuralları
- Görev tamamlandığında `TASKS.md`'de ilgili satır `[x]` olarak işaretlenir ve commit atılır.
- Devam eden bir görev `[~]` ile işaretlenebilir.
- Mimari/kapsam değişikliği gerektiren bir durumla karşılaşılırsa **PM'e** bildirilir; kullanıcıya doğrudan soru sorulmaz (PM zaten kullanıcı ile koordinasyonu yürütüyor).
- coder ve tester aynı repoda çalışır — commit çakışmalarına dikkat edilir, gerekirse `git pull`/rebase yapılır.
- Konsept referansı: `C:\Users\erdem\OneDrive\Masaüstü\FRP` — **kopyalanmaz**, sadece fikir/veri modeli olarak bakılır.

## Cron
PM session'ında iki ayrı 15 dakikalık cron çalışır:
1. **PM görev kontrolü**: `TASKS.md` okunur, coder ve tester'a ilerleme sorulur, bir sonraki görev hatırlatılır, blokaj varsa kullanıcıya iletilir.
2. **Yaratıcı cron**: proje ve canlı uygulama incelenip henüz ele alınmamış bir inovasyon/eksik fikri bulunur, `TASKS.md` > "## İnovasyon Fikirleri" bölümüne eklenir; ekip boştaysa ve iş küçükse doğrudan atanır.

## Deploy
- Frontend: https://dnd-game-frontend-t9hr.onrender.com/
- Backend: https://dnd-game-backend-sz9e.onrender.com
- GitHub: https://github.com/ErdemWilkinson/dnd-ai-game-master (private)
- Gerçek Render/GitHub hesap işlemleri PM+kullanıcı arasında yürütülür, coder/tester'ın yetkisinde değil.
