interface Props {
  characterName: string;
  level: number;
  onRestart: () => void;
}

export function GameOverScreen({ characterName, level, onRestart }: Props) {
  return (
    <div className="game-over-screen">
      <h2>Oyun Bitti</h2>
      <p className="game-over-text">
        <strong>{characterName}</strong>, seviye {level}'de düştü. Macera burada sona erdi.
      </p>
      <button type="button" onClick={onRestart}>
        Yeniden Başla
      </button>
    </div>
  );
}
