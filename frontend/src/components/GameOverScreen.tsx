interface Props {
  characterName: string;
  level: number;
  xp?: number;
  encountersCleared?: number | null;
  onRestart: () => void;
}

// Yaratıcı cron fikir #9: eskiden ekran bomboştu (sadece isim+seviye) -
// backend zaten bu verileri tutuyordu (character.xp, scene.encounterIndex),
// sadece kullanıcıya hiç gösterilmiyordu.
export function GameOverScreen({ characterName, level, xp = 0, encountersCleared = null, onRestart }: Props) {
  return (
    <div className="game-over-screen">
      <h2>Oyun Bitti</h2>
      <p className="game-over-text">
        <strong>{characterName}</strong>, seviye {level}'de düştü. Macera burada sona erdi.
      </p>
      <p className="game-over-summary">
        {encountersCleared !== null && encountersCleared > 0
          ? `${encountersCleared} karşılaşma temizledin, `
          : ''}
        {xp} XP kazandın.
      </p>
      <button type="button" onClick={onRestart}>
        Yeniden Başla
      </button>
    </div>
  );
}
