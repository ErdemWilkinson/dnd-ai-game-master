interface Props {
  onClose: () => void;
}

// Yaratıcı cron fikir #5: sistem (D20 zar, Aksiyon+Bonus ekonomisi, büyü
// hedef-seç modu, ekipman slotları) hiçbir açıklama olmadan doğrudan
// oyuncuya sunuluyordu - kapsamlı bir tutorial değil, sadece kısa bir özet.
export function HelpModal({ onClose }: Props) {
  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <h3>🎲 Nasıl Oynanır?</h3>
        <ul>
          <li>Her turda bir <strong>Aksiyon</strong> ve bir <strong>Bonus Aksiyon</strong> hakkın var (sağ panelde ✓/✗ ile gösterilir) — saldırı, büyü ve eşya kullanma Aksiyon harcar.</li>
          <li>Bitişik bir düşmana <strong>tıklayarak saldırırsın</strong>; boş bir kareye tıklamak yerine hareket ettirir.</li>
          <li>Büyü/eşya fırlatma "hedef seç" moduna girer — grid'de bir hedefe tıklayana kadar bekler, iptal için butona tekrar bas.</li>
          <li>Sıra bittiğinde <strong>"Turu Bitir"</strong>e bas; düşmanın hareketi/saldırısı otomatik çözülüp sıra sana geri döner.</li>
        </ul>
        <button type="button" onClick={onClose}>
          Anladım
        </button>
      </div>
    </div>
  );
}
