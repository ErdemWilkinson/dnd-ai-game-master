interface Props {
  characterName: string;
  level: number;
  xp?: number;
  encountersCleared?: number | null;
  onRestart: () => void;
  restarting?: boolean;
  restartError?: string | null;
}

// Yaratıcı cron fikir #9: eskiden ekran bomboştu (sadece isim+seviye) -
// backend zaten bu verileri tutuyordu (character.xp, scene.encounterIndex),
// sadece kullanıcıya hiç gösterilmiyordu.
export function GameOverScreen({
  characterName,
  level,
  xp = 0,
  encountersCleared = null,
  onRestart,
  restarting = false,
  restartError = null,
}: Props) {
  return (
    <div className="game-over-screen" role="alertdialog" aria-modal="true" aria-label="Oyun Bitti">
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
      <button type="button" onClick={onRestart} disabled={restarting}>
        {restarting ? 'Yeniden başlatılıyor...' : 'Yeniden Başla'}
      </button>
      {restartError && <p className="error">{restartError} Tekrar dene.</p>}
    </div>
  );
}
