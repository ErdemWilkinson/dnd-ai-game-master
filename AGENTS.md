# AGENTS.md

Bu projede genelde 3 Claude Code session'ı birlikte çalışır: **PM**, **coder**, **tester**. Session isimleri pencere/oturum her yeniden başladığında rastgele değişir — bu dosyadaki isimler SIK SIK eskir. İsimlere güvenme, aşağıdaki "Rol keşfi" prosedürünü izle.

## Roller
- **PM** (proje yöneticisi): Kullanıcıyla iletişim, kapsam/mimari karar netleştirme, görev dağıtımı (`TASKS.md`), coder/tester'a periyodik ilerleme kontrolü, `PROJECT.md`/`INDEX.md`/`AGENTS.md` gibi üst-seviye dokümanların bakımı.
- **coder**: Kodu yazan/düzelten session. `TASKS.md`'deki atanmış ya da kendi bulduğu küçük/net işleri alır, test eder (`backend`+`frontend`), commit atıp push'lar.
- **tester**: Bağımsız QA yapar — coder'ın "düzeltildi, test ettim" dediği işleri ikinci gözle (kod inceleme + canlı/otomatik test) doğrular, coder'ın üzerinde çalıştığı dosyalara aynı anda dokunmaz.

**Kullanıcı tek bir session'a "sen codersın, PM ve tester işini de kendin yap" diyebilir** — bu durumda o session üçünü birden üstlenir (kapsam kararlarını kendi verir, kendi test eder), diğer roller boşsa/yoksa bunu normal kabul et.

## Rol keşfi (her session'ın turu başında/rol belirsizse yapması gereken)
İsimler eskidiği için, "kim hangi rolde" sorusuna asla eski bu dosyadaki isimlerden değil, şu sırayla cevap ver:
1. **Kullanıcının bu session'a doğrudan söylediği şey** en yüksek öncelik — biri sana "sen codersın" dediyse rolün odur, dosyada ne yazdığı önemli değil.
2. `ListAgents` ile o an aktif peer session'ları gör (isimler değişmiş olabilir, sayı/`started X önce` bilgisine bak).
3. Kendini tanıt + rolünü sor (`SendMessage`) — her yeni/rolü belirsiz peer'e kısa bir öz-tanıtım + güncel durum özeti gönder, karşılığında rolünü öğren.
4. Öğrendiğin güncel isim/rol eşleşmesini bu dosyaya (aşağıdaki "Güncel oturum" bölümüne) yaz — bir sonraki session için iz bırak.
5. PM görünmüyorsa (offline/kapalı): coder, kendi başına PM'in normalde vereceği küçük/net kararları verebilir (örn. stale TASKS.md maddelerini kapatmak, küçük a11y/bug fix'leri almak); büyük mimari/kapsam kararları için PM dönene ya da kullanıcı doğrudan talimat verene kadar bekler, kullanıcıya PM yerine geçip doğrudan büyük kapsam sorusu sormaz.

## Güncel oturum (bilgi amaçlı, değişebilir — güvenme, rol keşfini uygula)
- **coder**: `claude-game-d1` (2026-08-30 itibarıyla) — Faz 12 sonrası fikir #94/#95/#86 + stale-madde temizliğini yaptı.
- **tester**: `claude-game-ff` (2026-08-30'da kullanıcı tarafından atandı) — fikir #94/#86/#95'i bağımsız doğruladı.
- **PM**: Şu an aktif görünmüyor (son bilinen: `claude-game-a5`, offline).
- Rolsüz/beklemede: `claude-game-69`, `claude-game-de`, `evrimsel-web-claude-81` — kullanıcı tarafından henüz atanmadı.

## Yeni coder devri (kullanıcı "coder başka bir session olsun" dediğinde)
1. Kullanıcı yeni bir session açar ve ona "sen codersın" der (ya da mevcut rolsüz bir session'a söyler).
2. Eski coder, yeni coder'a `SendMessage` ile kısa bir devir notu gönderir: son commit hash'i, TASKS.md'de açık/beklemede kalan madde var mı, bilinen riskler (örn. paylaşılan git working directory çakışma riski).
3. Yeni coder `git log --oneline -10` + `TASKS.md`'nin İnovasyon Fikirleri bölümünün sonunu okuyarak bağlamı doğrular (devir notuna körü körüne güvenmez).
4. Eski coder, yeni coder devraldıktan sonra dosyalara dokunmayı bırakır (çakışma riski).

## Koordinasyon kuralları
- Görev tamamlandığında `TASKS.md`'de ilgili satır `[x]` olarak işaretlenir (DÜZELTİLDİ / ARTIK GEÇERSİZ / YANLIŞ ALARM gibi net bir sonuç etiketiyle) ve commit atılır.
- Devam eden bir görev `[~]` ile işaretlenebilir.
- Mimari/kapsam değişikliği gerektiren bir durumla karşılaşılırsa **PM'e** bildirilir; PM yoksa/offline'sa ve karar küçük/geri alınabilirse coder kendi takdirini kullanıp ilerleyebilir (TASKS.md'ye gerekçesiyle not düşerek), büyükse kullanıcıya iletir.
- coder ve tester aynı repoda çalışır — commit çakışmalarına dikkat edilir, gerekirse `git pull`/rebase yapılır. Bir session'ın uncommitted değişikliği başka bir session'ın commit'ine karışabilir (bilinen, zararsız bir tuhaflık) — fark edilirse commit mesajında dürüstçe belirtilir, geçmiş asla rewrite edilmez.
- Bir madde TASKS.md'de "bekliyor" görünüyor ama kod incelemesinde zaten çözülmüş çıkarsa (stale kayıt), kod değişikliği yapılmaz — sadece kayıt "[x] ZATEN DÜZELTİLMİŞ/ARTIK GEÇERSİZ" olarak güncellenir, orijinal metin referans için korunur.
- Konsept referansı: `C:\Users\erdem\OneDrive\Masaüstü\FRP` — **kopyalanmaz**, sadece fikir/veri modeli olarak bakılır.

## Cron
PM session'ında (aktifken) iki ayrı periyodik kontrol çalışır:
1. **PM görev kontrolü**: `TASKS.md` okunur, coder ve tester'a ilerleme sorulur, bir sonraki görev hatırlatılır, blokaj varsa kullanıcıya iletilir.
2. **Yaratıcı cron**: proje ve canlı uygulama incelenip henüz ele alınmamış bir inovasyon/eksik fikri bulunur, `TASKS.md` > "## İnovasyon Fikirleri" bölümüne eklenir; ekip boştaysa ve iş küçükse doğrudan atanır.

PM offline'ken bu periyodik kontroller çalışmaz — coder, kullanıcı "cron'u çalıştır" gibi bir istek yaparsa bu rolü manuel olarak (kod tabanını tarayıp yeni bir fikir bularak) tek seferlik üstlenebilir, ama bu gerçek bir zamanlanmış görev değildir.

## Deploy
- Frontend: https://dnd-game-frontend-t9hr.onrender.com/
- Backend: https://dnd-game-backend-sz9e.onrender.com
- GitHub: https://github.com/ErdemWilkinson/dnd-ai-game-master (private)
- Gerçek Render/GitHub hesap işlemleri PM+kullanıcı arasında yürütülür, coder/tester'ın yetkisinde değil.
