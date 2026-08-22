import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { getScene as GetScene, getChatHistory as GetChatHistory } from './api';

// Faz 6-A: her istek X-Session-Id header'ı taşımalı. Gerçek fetch'i mock'layıp
// istek header'larını doğruca kontrol ediyoruz. session.ts modül-seviyesi bir
// cachedSessionId tutuyor, bu yüzden localStorage.clear() ile birlikte
// vi.resetModules() + dinamik import de gerekiyor (bkz. session.test.ts).
let getScene: typeof GetScene;
let getChatHistory: typeof GetChatHistory;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }),
  );
  const api = await import('./api');
  getScene = api.getScene;
  getChatHistory = api.getChatHistory;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api.ts — Faz 6-A: X-Session-Id header', () => {
  it('her istek X-Session-Id header\'ı içerir', async () => {
    await getScene();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['X-Session-Id']).toBeTruthy();
    expect(typeof headers['X-Session-Id']).toBe('string');
  });

  it('aynı oturumda ardışık isteklerin hepsi AYNI session id\'yi kullanır', async () => {
    await getScene();
    await getChatHistory();

    const calls = vi.mocked(fetch).mock.calls;
    const idFromFirst = (calls[0][1]?.headers as Record<string, string>)['X-Session-Id'];
    const idFromSecond = (calls[1][1]?.headers as Record<string, string>)['X-Session-Id'];
    expect(idFromFirst).toBe(idFromSecond);
  });

  it('session id localStorage\'a kaydedilir, sayfa yenilense bile aynı kalır', async () => {
    await getScene();
    const stored = localStorage.getItem('dnd-session-id');
    expect(stored).toBeTruthy();

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['X-Session-Id']).toBe(stored);
  });
});
