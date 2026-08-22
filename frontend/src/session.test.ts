import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// getSessionId() modül içinde bir modül-seviyesi `cachedSessionId` tutuyor,
// bu yüzden her testte modülü sıfırdan import etmemiz gerekiyor (aksi halde
// önceki testin cache'i sızar). vi.resetModules() + dinamik import kullanıyoruz.
async function freshGetSessionId() {
  vi.resetModules();
  const mod = await import('./session');
  return mod.getSessionId;
}

const STORAGE_KEY = 'dnd-session-id';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getSessionId', () => {
  it('localStorage boşsa yeni bir UUID üretir ve localStorage\'a yazar', async () => {
    const getSessionId = await freshGetSessionId();
    const id = getSessionId();

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(id);
  });

  it('localStorage\'da zaten bir id varsa onu kullanır, yeni üretmez', async () => {
    localStorage.setItem(STORAGE_KEY, 'existing-session-id-123');
    const getSessionId = await freshGetSessionId();

    expect(getSessionId()).toBe('existing-session-id-123');
  });

  it('aynı modül içinde art arda çağrılar hep aynı id\'yi döner (bellek-içi cache)', async () => {
    const getSessionId = await freshGetSessionId();
    const first = getSessionId();
    const second = getSessionId();

    expect(first).toBe(second);
  });

  it('her çağrıda farklı bir UUID üretilmez (randomUUID sadece ilk seferde çağrılır)', async () => {
    const randomUUIDSpy = vi.spyOn(crypto, 'randomUUID');
    const getSessionId = await freshGetSessionId();

    getSessionId();
    getSessionId();
    getSessionId();

    expect(randomUUIDSpy).toHaveBeenCalledTimes(1);
  });

  it('localStorage erişilemezse (örn. gizli sekme) çökmeden bellek-içi bir id döner', async () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => { throw new Error('erişim engellendi'); },
        setItem: () => { throw new Error('erişim engellendi'); },
      },
      configurable: true,
    });

    try {
      const getSessionId = await freshGetSessionId();
      const id = getSessionId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      // İkinci çağrıda da (localStorage hâlâ erişilemez) aynı bellek-içi id dönmeli
      expect(getSessionId()).toBe(id);
    } finally {
      Object.defineProperty(window, 'localStorage', { value: original, configurable: true });
    }
  });
});
