import type { Character } from '../types';

interface Props {
  character: Character;
}

// Faz 12-B (serbest-form mimari sıfırlaması): grid artık zorunlu açılmıyor,
// chat varsayılan/tek görünüm oldu - eskiden HP/Mana'yı görmek için karakter
// panelini (🎒) açmak gerekiyordu, bu küçük şerit onları HER ZAMAN görünür
// tutuyor (detaylı envanter/attributes için panel hâlâ mevcut).
//
// İnovasyon fikri #89: grid artık varsayılan olarak gizli olduğundan bu şerit
// HP/Mana'yı görmenin BİRİNCİL yolu haline geldi, ama `aria-live` yoktu -
// ekran okuyucu kullanan bir oyuncu her saldırı/büyü/iksirden sonraki HP/Mana
// değişikliğini hiç duymuyordu. `aria-live="polite"` + `aria-atomic="true"`
// eklendi ki her güncellemede TÜM şerit (sadece değişen kısım değil) yeniden
// okunsun - HP/Mana/Seviye kısa metinler olduğundan bu makul.
export function HeaderHud({ character }: Props) {
  return (
    <div
      className="header-hud"
      aria-label={`${character.name} - HP ${character.hp.current}/${character.hp.max}, Seviye ${character.level}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="header-hud-item header-hud-hp">
        ❤️ {character.hp.current}/{character.hp.max}
      </span>
      {character.mana.max > 0 && (
        <span className="header-hud-item header-hud-mana">
          🔮 {character.mana.current}/{character.mana.max}
        </span>
      )}
      <span className="header-hud-item header-hud-level">Lv {character.level}</span>
    </div>
  );
}
