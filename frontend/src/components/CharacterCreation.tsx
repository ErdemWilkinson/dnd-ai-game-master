import { useEffect, useRef, useState } from 'react';
import { createCharacter, getCharacterIntro, getCharacterOptions, rollStats } from '../api';
import type { AppearanceOption, Attributes, Character, ClassOption, RaceOption } from '../types';

interface Props {
  onCreated: (character: Character, intro: { text: string; source: 'ai' | 'mock' }) => void;
}

const ATTR_LABELS: Record<keyof Attributes, string> = {
  str: 'GÜÇ',
  dex: 'ÇEVİKLİK',
  con: 'DAYANIKLILIK',
  int: 'ZEKA',
  wis: 'BİLGELİK',
  cha: 'KARİZMA',
};

const ROLL_ANIMATION_MS = 700;

// İnovasyon fikri #42: backend'deki character.js MAX_NAME_LENGTH ile aynı -
// kullanıcı limiti ancak 400 aldıktan sonra öğrenmesin diye burada da
// uygulanıyor.
const MAX_NAME_LENGTH = 50;

export function CharacterCreation({ onCreated }: Props) {
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [appearances, setAppearances] = useState<AppearanceOption[]>([]);
  const [name, setName] = useState('');
  const [raceId, setRaceId] = useState('');
  const [classId, setClassId] = useState('');
  const [appearanceId, setAppearanceId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [rolling, setRolling] = useState(false);
  const [displayedAttributes, setDisplayedAttributes] = useState<Attributes | null>(null);
  const [finalAttributes, setFinalAttributes] = useState<Attributes | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const rollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    getCharacterOptions()
      .then(({ races, classes, appearances }) => {
        setRaces(races);
        setClasses(classes);
        setAppearances(appearances ?? []);
        setRaceId(races[0]?.id ?? '');
        setClassId(classes[0]?.id ?? '');
        setAppearanceId(appearances?.[0]?.id ?? '');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    // Irk değişince önceki zar sonucu artık geçerli değil (bonuslar değişir).
    setFinalAttributes(null);
    setDisplayedAttributes(null);
  }, [raceId]);

  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) window.clearInterval(rollIntervalRef.current);
    };
  }, []);

  async function handleRoll() {
    if (!raceId || rolling) return;
    setError(null);
    setRolling(true);
    setFinalAttributes(null);

    const rollPromise = rollStats(raceId);

    const keys = Object.keys(ATTR_LABELS) as (keyof Attributes)[];
    rollIntervalRef.current = window.setInterval(() => {
      const randomized = {} as Attributes;
      for (const key of keys) randomized[key] = Math.floor(Math.random() * 20) + 1;
      setDisplayedAttributes(randomized);
    }, 60);

    try {
      const { attributes } = await rollPromise;
      await new Promise((resolve) => setTimeout(resolve, ROLL_ANIMATION_MS));
      if (rollIntervalRef.current) {
        window.clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      setDisplayedAttributes(attributes);
      setFinalAttributes(attributes);
    } catch (e) {
      if (rollIntervalRef.current) {
        window.clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      setError((e as Error).message);
    } finally {
      setRolling(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('İsim gerekli.');
      return;
    }
    if (!finalAttributes) {
      setError('Önce zar atmalısın.');
      return;
    }
    setSubmitting(true);
    try {
      const character = await createCharacter(name.trim(), raceId, classId, appearanceId, finalAttributes);
      const intro = await getCharacterIntro(character.id);
      onCreated(character, intro);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="character-creation" onSubmit={handleSubmit}>
      <h2>Karakter Oluştur</h2>

      <label>
        İsim
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Karakter adı"
          maxLength={MAX_NAME_LENGTH}
        />
      </label>

      <label>
        Irk
        <select value={raceId} onChange={(e) => setRaceId(e.target.value)}>
          {races.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Sınıf
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Dış Görünüş
        <select value={appearanceId} onChange={(e) => setAppearanceId(e.target.value)}>
          {appearances.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <div className="dice-roll-section">
        <button type="button" onClick={handleRoll} disabled={rolling || !raceId}>
          {rolling ? 'Zar atılıyor...' : finalAttributes ? 'Tekrar Zar At' : 'Zar At (D20)'}
        </button>
        {displayedAttributes && (
          <div className="attributes-grid">
            {(Object.keys(ATTR_LABELS) as (keyof Attributes)[]).map((key) => (
              <div key={key} className={`attribute ${rolling ? 'rolling' : ''}`}>
                <span className="attribute-label">{ATTR_LABELS[key]}</span>
                <span className="attribute-value">{displayedAttributes[key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting || !finalAttributes}>
        {submitting ? 'Oluşturuluyor...' : 'Maceraya Başla'}
      </button>
    </form>
  );
}
