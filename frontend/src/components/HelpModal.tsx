import { useEffect, useRef } from 'react';

interface Props {
  onClose: () => void;
}

// Yaratıcı cron fikir #5: sistem (D20 zar, serbest-form aksiyonlar) hiçbir
// açıklama olmadan doğrudan oyuncuya sunuluyordu - kapsamlı bir tutorial
// değil, sadece kısa bir özet.
// Yaratıcı cron fikir #100: Faz 12 ile grid sistemi tamamen kaldırılıp tek
// arayüz serbest-form chat olduğu halde bu modal hiç güncellenmemişti -
// tıklayarak saldırma/Aksiyon-Bonus Aksiyon ekonomisi/"Turu Bitir"/hedef-seç
// modu gibi ARTIK VAR OLMAYAN bir sistemi tarif ediyordu, oyuncu yardım
// isteyince doğal dilde nasıl yazacağını hiç öğrenmiyordu. İçerik
// `actionResolver.js`'deki GERÇEK intent kalıplarından (saldır/kuşan/bırak/
// al/iç + büyü isim/eşanlamlıları) ve `freeformCombat.js`'in davranışından
// (düşman karşılığı, ölüm) alınarak yeniden yazıldı.
export function HelpModal({ onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Yaratıcı cron fikir #17: klavye desteği yoktu - Esc ile kapanmıyordu,
  // focus yönetimi yoktu (Tab ile arkadaki sayfaya kaçılabiliyordu).
  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div className="help-modal" role="dialog" aria-modal="true" aria-label="Nasıl Oynanır?" onClick={(e) => e.stopPropagation()}>
        <h3>🎲 Nasıl Oynanır?</h3>
        <ul>
          <li>Bu bir <strong>serbest-form sohbet</strong> — grid/kare yok, sadece ne yapmak istediğini <strong>doğal Türkçe</strong> ile yaz. Ör: <em>"Goblin'e saldırıyorum"</em>, <em>"Kısa Kılıcı kuşanıyorum"</em>, <em>"İksiri içiyorum"</em>.</li>
          <li>Karakter kartına (envanter, ekipman, büyüler) her zaman header'daki <strong>🎒 butonuyla</strong> ulaşırsın.</li>
          <li><strong>Saldırmak</strong> için hedefin adını yaz (birden fazla düşman varsa isim belirtmen gerekir): "Goblin'e saldırıyorum", "Kapıyı kır".</li>
          <li><strong>Büyü</strong> kullanmak için büyünün adını ya da doğal bir eşanlamlısını yaz — <strong>Ateş Topu</strong> ("alev topu fırlatıyorum" de olur, karşılaşmadaki TÜM düşmanlara hasar verir) veya <strong>İyileştir</strong> ("kendimi tedavi ediyorum" de olur, sadece mana yeten sınıflarda çalışır).</li>
          <li><strong>Eşya kuşanmak/çıkarmak</strong> için eşyanın adını yaz: "Kısa Kılıcı kuşanıyorum" ya da kısaca "Kılıcımı kuşanıyorum" — aynı slotta başka bir şey kuşanılıysa otomatik çıkarılır. Farklı silahlar farklı hasar verir, kuşanılı zırh gelen hasarı azaltır.</li>
          <li><strong>Eşya bırakmak</strong> için "bırakıyorum" ya da "atıyorum" yaz: "Kılıcımı bırakıyorum" — bıraktığın eşya sahnede kalır, istersen tekrar alabilirsin.</li>
          <li>Sahnedeki eşyayı <strong>almak</strong> için "alıyorum" ya da "topluyorum" yaz: "Yerdeki eşyayı alıyorum" — envanterin dolarsa (30 eşya) önce bir şey bırakman gerekir.</li>
          <li><strong>İksir içmek</strong> (veya "kullanmak") HP'ni iyileştirir: "İksiri içiyorum".</li>
          <li>Bir düşmanı yenip karşılaşmayı temizleyince otomatik bir sonraki alana geçersin, kısa bir anlatım eşlik eder.</li>
          <li>Kendi saldırı/saldırı büyünden sonra hâlâ canlı düşman varsa <strong>karşılık verebilir</strong> ve sana hasar verebilir — HP sıfırlanırsa karakterin ölür, yeni bir maceraya başlaman gerekir.</li>
        </ul>
        <button type="button" ref={closeButtonRef} onClick={onClose}>
          Anladım
        </button>
      </div>
    </div>
  );
}
