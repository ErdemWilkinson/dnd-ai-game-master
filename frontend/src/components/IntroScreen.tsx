interface Props {
  text: string;
  source: 'ai' | 'mock';
  onContinue: () => void;
}

export function IntroScreen({ text, source, onContinue }: Props) {
  return (
    <div className="intro-screen">
      <h2>Macera Başlıyor</h2>
      <p className="intro-text">{text}</p>
      {source === 'mock' && <p className="chat-source-tag">(mock anlatım)</p>}
      <button type="button" onClick={onContinue}>
        Devam Et
      </button>
    </div>
  );
}
