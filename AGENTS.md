# AGENTS.md

Bu projede 3 Claude Code session'ı birlikte çalışır.

## Roller
- **PM** (proje yöneticisi): Kullanıcıyla iletişim, kapsam/karar netleştirme, görev dağıtımı (`TASKS.md`), 15 dakikada bir coder/tester'a ilerleme kontrolü.
- **coder** (`claude-game-b7`): `TASKS.md` → "### Coder" bölümündeki görevleri uygular.
- **tester** (`claude-game-5c`): `TASKS.md` → "### Tester" bölümündeki görevleri uygular; coder'ın çıktısını test eder.

## Koordinasyon kuralları
- Görev tamamlandığında `TASKS.md`'de ilgili satır `[x]` olarak işaretlenir ve commit atılır.
- Devam eden bir görev `[~]` ile işaretlenebilir.
- Mimari/kapsam değişikliği gerektiren bir durumla karşılaşılırsa **PM'e** bildirilir; kullanıcıya doğrudan soru sorulmaz (PM zaten kullanıcı ile koordinasyonu yürütüyor).
- coder ve tester aynı repoda çalışır — commit çakışmalarına dikkat edilir, gerekirse `git pull`/rebase yapılır.
- Konsept referansı: `C:\Users\erdem\OneDrive\Masaüstü\FRP` — **kopyalanmaz**, sadece fikir/veri modeli olarak bakılır.

## Cron
PM session'ında her 15 dakikada bir çalışan bir kontrol görevi vardır: `TASKS.md` okunur, coder ve tester'a ilerleme sorulur, bir sonraki görev hatırlatılır, blokaj varsa kullanıcıya iletilir.
