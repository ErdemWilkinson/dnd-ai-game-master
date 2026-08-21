import { useEffect, useState } from 'react';
import { createCharacter, getCharacterOptions } from '../api';
import type { Character, ClassOption, RaceOption } from '../types';

interface Props {
  onCreated: (character: Character) => void;
}

export function CharacterCreation({ onCreated }: Props) {
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [name, setName] = useState('');
  const [raceId, setRaceId] = useState('');
  const [classId, setClassId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCharacterOptions()
      .then(({ races, classes }) => {
        setRaces(races);
        setClasses(classes);
        setRaceId(races[0]?.id ?? '');
        setClassId(classes[0]?.id ?? '');
      })
      .catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('İsim gerekli.');
      return;
    }
    setSubmitting(true);
    try {
      const character = await createCharacter(name.trim(), raceId, classId);
      onCreated(character);
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Karakter adı" />
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

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Oluşturuluyor...' : 'Maceraya Başla'}
      </button>
    </form>
  );
}
