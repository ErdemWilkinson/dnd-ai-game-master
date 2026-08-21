# Manuel QA Checklist — Faz 1

Kullanım: backend (`cd backend && npm start`, :3001) ve frontend (`cd frontend && npm run dev`, :5173) ayrı terminallerde çalışırken, tarayıcıda `http://localhost:5173` açılarak sırayla kontrol edilir.

## Karakter oluşturma
- [ ] Sayfa ilk açıldığında karakter oluşturma formu görünüyor (isim, ırk, sınıf)
- [ ] Isim boş bırakılıp gönderilirse "İsim gerekli." hatası gösteriliyor, istek atılmıyor
- [ ] Geçerli isim + ırk + sınıf ile "Maceraya Başla" karakteri oluşturuyor ve oyun ekranına geçiyor
- [ ] Farklı ırk/sınıf kombinasyonlarında HP/Mana/attribute başlangıç değerleri ırk bonusu + sınıf temel değerine göre doğru
- [ ] **[Bilinen bug #3]** Karakter kartındaki ırk/sınıf satırı Türkçe isimle mi gösteriliyor, yoksa ham id ile mi ("Human · Fighter" görürseniz bug hâlâ açık demektir)

## Sohbet (GM)
- [ ] Mesaj gönderilince hem oyuncu mesajı hem GM cevabı sohbet akışında görünüyor
- [ ] Boş mesaj gönderilemiyor (buton/enter tepki vermiyor ya da hata veriyor)
- [ ] "saldır" / "bak" / "konuş" gibi anahtar kelimeler farklı flavor-text kategorisi tetikliyor mu (kabaca gözlemlenebilir)
- [ ] Sayfa yenilenince önceki sohbet geçmişi geri geliyor mu (backend'de saklanıyor, ama **bilinen bug #4** nedeniyle karakter ekranına hiç ulaşamayabilirsiniz)

## Taktik grid
- [ ] Harita, engeller, loot ve iki token (oyuncu + goblin) doğru render ediliyor
- [ ] Menzil dışı bir hücreye tıklayınca hata mesajı gösteriliyor, token hareket etmiyor
- [ ] Engelli bir hücreye tıklayınca hata mesajı gösteriliyor
- [ ] Menzil içi boş bir hücreye tıklayınca token o hücreye taşınıyor
- [ ] Loot olan bir hücreye hareket edince loot toplanıyor (haritadan kayboluyor)
- [ ] "Turu Bitir" sıradaki token'a geçiyor, tüm tokenlar turunu tamamlayınca tur sayacı artıyor
- [ ] **[Bilinen bug #5]** Düşman sırasındayken bir hücreye tıklayınca ne oluyor — düşman token'ı hareket ediyor mu? (evetse bilinen davranış, PM'e sorulmuş durumda)

## Envanter
- [ ] **[Bilinen eksik #2]** Envanterde eşya kullan/kuşan/at/fırlat için tıklanabilir bir aksiyon var mı (şu an YOK — bu maddeyi coder ekleyene kadar "başarısız" işaretleyin)
- [ ] (Eklendiğinde) İksir kullanınca HP artıyor mu — **[bilinen bug #1]** şu an artmıyor, regex bug'ı düzeltilene kadar bu adım başarısız olacak
- [ ] (Eklendiğinde) Kuşanma toggle'ı envanterde "kuşanıldı" etiketini doğru gösterip kaldırıyor mu
- [ ] (Eklendiğinde) Eşya atınca (drop) envanterden düşüp sahnenin loot listesine ekleniyor mu

## Genel / hata durumları
- [ ] Backend kapalıyken frontend açılırsa kullanıcıya anlamlı bir hata gösteriliyor mu (şu an: `getCharacterOptions` reddedilirse form boş kalıyor, hata mesajı görünüyor ama ırk/sınıf seçenekleri hiç yüklenmiyor)
- [ ] Tarayıcı konsolunda beklenmedik hata/uyarı var mı (DevTools > Console)
- [ ] Sayfa yenileme (F5) sonrası davranış — **[bilinen bug #4]** karakter oluşturma ekranına geri dönüyor, eski karakter kayboluyor

## Kapsam dışı (Faz 1'de bilerek yok, "bug" olarak raporlamayın)
- Gerçek LLM tabanlı GM (şu an kural tabanlı/şablon metin)
- Kalıcı depolama / login / çoklu oturum (state sunucu belleğinde, tek global oturum)
- Sahne görselleri (statik placeholder yok, sadece grid)
- Düşman AI / otomatik saldırı mantığı
