const STORAGE_KEY = 'dnd-session-id';

let cachedSessionId: string | null = null;

export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;

  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      cachedSessionId = existing;
      return existing;
    }
  } catch {
    // localStorage erişilemez olabilir (gizli sekme vb.) - bellek-içi tek seferlik id'ye düş
  }

  const id = crypto.randomUUID();
  cachedSessionId = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // yazılamıyorsa sorun değil, bu oturum boyunca bellekteki id kullanılır
  }
  return id;
}
