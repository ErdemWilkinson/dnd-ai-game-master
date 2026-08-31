import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as api from './api';
import type { Character } from './types';

vi.mock('./api');

const CHARACTER: Character = {
  id: 'c1',
  name: 'Kalıcı Kahraman',
  race: 'human',
  class: 'fighter',
  appearance: null,
  level: 1,
  xp: 0,
  hp: { current: 12, max: 12 },
  mana: { current: 0, max: 0 },
  attributes: { str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11 },
  inventory: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  // ChatPanel de mount olacağı için ilgili API çağrısını da mock'luyoruz.
  vi.mocked(api.getChatHistory).mockResolvedValue({ messages: [] });
  // Karakter yoksa CharacterCreation mount olur, o da bunu çağırır.
  vi.mocked(api.getCharacterOptions).mockResolvedValue({ races: [], classes: [], appearances: [] });
});

describe('App — Bug #4: sayfa yenilenince aktif karakter geri yüklenmeli', () => {
  it('backend\'de aktif karakter varsa açılışta doğrudan oyun ekranını gösterir (oluşturma formuna dönmez)', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    render(<App />);

    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    expect(screen.queryByText('Karakter Oluştur')).not.toBeInTheDocument();
  });

  it('backend\'de aktif karakter yoksa (404/hata) karakter oluşturma formunu gösterir', async () => {
    vi.mocked(api.getCurrentCharacter).mockRejectedValue(new Error('Aktif karakter yok.'));
    render(<App />);

    await waitFor(() => expect(screen.getByText('Karakter Oluştur')).toBeInTheDocument());
  });
});

describe('App — Faz 3-A: oluşturma -> açılış hikayesi -> oyun akışı', () => {
  it('karakter oluşturulduktan sonra önce IntroScreen gösterilir, "Devam Et" ile oyun ekranına geçilir', async () => {
    vi.mocked(api.getCurrentCharacter).mockRejectedValue(new Error('Aktif karakter yok.'));
    vi.mocked(api.getCharacterOptions).mockResolvedValue({
      races: [{ id: 'human', name: 'İnsan', attributeBonuses: {} }],
      classes: [{ id: 'fighter', name: 'Savaşçı', baseHp: 12, baseMana: 0, primaryAttribute: 'str', startingInventory: [] }],
      appearances: [{ id: 'scarred-veteran', name: 'Yara İzli Gazi', description: '...' }],
    });
    const rolledAttributes = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 };
    vi.mocked(api.rollStats).mockResolvedValue({ rolls: rolledAttributes, attributes: rolledAttributes });
    vi.mocked(api.createCharacter).mockResolvedValue(CHARACTER);
    vi.mocked(api.getCharacterIntro).mockResolvedValue({ text: 'Gözlerini karanlıkta açıyorsun.', source: 'ai' });

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByText('Karakter Oluştur')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Karakter adı'), 'Kalıcı Kahraman');
    await user.click(screen.getByRole('button', { name: /Zar At/i }));
    // ROLL_ANIMATION_MS=700ms'lik gerçek zamanlı animasyon süresini bekliyoruz.
    await new Promise((resolve) => setTimeout(resolve, 800));
    await waitFor(() => expect(screen.getByRole('button', { name: /Maceraya Başla/i })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: /Maceraya Başla/i }));

    await waitFor(() => expect(screen.getByText('Macera Başlıyor')).toBeInTheDocument());
    expect(screen.getByText('Gözlerini karanlıkta açıyorsun.')).toBeInTheDocument();
    expect(screen.queryByText('Kalıcı Kahraman')).not.toBeInTheDocument(); // oyun ekranı henüz gösterilmiyor

    await user.click(screen.getByRole('button', { name: /Devam Et/i }));

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    expect(screen.queryByText('Macera Başlıyor')).not.toBeInTheDocument();
  });
});

describe('App — Faz 6-C: Game Over ve Yeniden Başla', () => {
  it('character.hp.current<=0 olunca oyun ekranı yerine GameOverScreen gösterilir', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue({ ...CHARACTER, hp: { current: 0, max: 12 } });
    render(<App />);

    await waitFor(() => expect(screen.getByText('Oyun Bitti')).toBeInTheDocument());
    expect(screen.queryByText('D&D AI Game Master')).not.toBeInTheDocument();
  });

  it('"Yeniden Başla" resetSession\'ı çağırır ve karakter oluşturma ekranına döner', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue({ ...CHARACTER, hp: { current: 0, max: 12 } });
    vi.mocked(api.resetSession).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Oyun Bitti')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Yeniden Başla' }));

    expect(api.resetSession).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('Karakter Oluştur')).toBeInTheDocument());
  });

  it('character.hp.current>0 iken GameOverScreen gösterilmez, normal oyun ekranı çalışmaya devam eder (regresyon)', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    expect(screen.queryByText('Oyun Bitti')).not.toBeInTheDocument();
  });

  it('İnovasyon fikri #82: resetSession() başarısız olursa Game Over ekranında sessizce takılı kalmaz, hata gösterip tekrar denemeye izin verir', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue({ ...CHARACTER, hp: { current: 0, max: 12 } });
    vi.mocked(api.resetSession).mockRejectedValueOnce(new Error('Bağlantı kurulamadı.'));
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Oyun Bitti')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Yeniden Başla' }));

    await waitFor(() => expect(screen.getByText(/Bağlantı kurulamadı\..*Tekrar dene\./)).toBeInTheDocument());
    // Sessizce takılı kalmadı - buton hâlâ tıklanabilir, ekran hâlâ Game Over (karakter oluşturma formuna geçmedi).
    expect(screen.getByRole('button', { name: 'Yeniden Başla' })).not.toBeDisabled();
    expect(screen.getByText('Oyun Bitti')).toBeInTheDocument();

    vi.mocked(api.resetSession).mockResolvedValueOnce({ ok: true });
    await user.click(screen.getByRole('button', { name: 'Yeniden Başla' }));
    await waitFor(() => expect(screen.getByText('Karakter Oluştur')).toBeInTheDocument());
  });
});

describe('App — İnovasyon fikri #103: karakter panelindeki restartError da aria-live taşımalı (fikir #86 ile aynı bug sınıfı)', () => {
  it('resetSession() canlı karakterken (karakter paneli üzerinden) başarısız olursa hata mesajı aria-live="polite" ile duyurulur', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    vi.mocked(api.resetSession).mockRejectedValueOnce(new Error('Bağlantı kurulamadı.'));
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /karakter ve envanteri aç\/kapat/i }));
    await user.click(screen.getByRole('button', { name: 'Yeni Karaktere Başla' }));
    await user.click(screen.getByRole('button', { name: 'Evet, Sil' }));

    await waitFor(() => expect(screen.getByText(/Bağlantı kurulamadı\..*Tekrar dene\./)).toBeInTheDocument());
    const errorSpan = screen.getByText(/Bağlantı kurulamadı\..*Tekrar dene\./);
    expect(errorSpan).toHaveAttribute('aria-live', 'polite');
  });
});

describe('App — İnovasyon fikri #106: karakter paneli overlay\'i HelpModal\'ın a11y desenlerini (dialog rolü, focus, Escape) taşımalı', () => {
  it('panel role="dialog" + aria-modal="true" + aria-label taşır', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /karakter ve envanteri aç\/kapat/i }));

    const dialog = screen.getByRole('dialog', { name: 'Kalıcı Kahraman - karakter ve envanter' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('panel açılınca kapatma butonuna (✕) otomatik focus verilir', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /karakter ve envanteri aç\/kapat/i }));

    expect(screen.getByRole('button', { name: 'Karakter panelini kapat' })).toHaveFocus();
  });

  it('Escape tuşuna basınca panel kapanır', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /karakter ve envanteri aç\/kapat/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('App — İnovasyon fikri #80: footer atıf linki tıklanabilir olmalı', () => {
  it('tgstation atıf metni gerçek bir <a> linki içerir, doğru href/target/rel ile', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());

    const link = screen.getByRole('link', { name: 'github.com/tgstation/tgstation' });
    expect(link).toHaveAttribute('href', 'https://github.com/tgstation/tgstation');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('Faz 12-C (grid kaldırıldı): chat artık TEK arayüz, HUD her zaman görünür', () => {
  it('HP/Mana/Seviye bilgisi karakter panelini açmadan HER ZAMAN header\'da görünür (HUD şeridi)', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue({
      ...CHARACTER,
      hp: { current: 7, max: 12 },
      mana: { current: 2, max: 4 },
      level: 3,
    });
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());
    // Karakter paneli AÇILMADAN (showCharacterPanel hâlâ false, 🎒 butonu tıklanmadı) bu bilgiler görünür olmalı.
    expect(screen.getByText('❤️ 7/12')).toBeInTheDocument();
    expect(screen.getByText('🔮 2/4')).toBeInTheDocument();
    expect(screen.getByText('Lv 3')).toBeInTheDocument();
  });

  it('İnovasyon fikri #89: HUD şeridi aria-live="polite" ile işaretli - ekran okuyucu HP/Mana değişikliklerini duyurabiliyor', async () => {
    vi.mocked(api.getCurrentCharacter).mockResolvedValue(CHARACTER);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Kalıcı Kahraman')).toBeInTheDocument());

    const hud = document.querySelector('.header-hud');
    expect(hud).toHaveAttribute('aria-live', 'polite');
    expect(hud).toHaveAttribute('aria-atomic', 'true');
  });
});
