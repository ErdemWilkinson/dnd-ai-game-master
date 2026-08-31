import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('kasıtlı test hatası');
}

describe('ErrorBoundary — İnovasyon fikri #55', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('normal render sırasında hata yoksa children\'ı olduğu gibi gösterir', () => {
    render(
      <ErrorBoundary>
        <p>Normal içerik</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Normal içerik')).toBeInTheDocument();
  });

  it('bir çocuk bileşen render sırasında hata fırlatırsa fallback UI gösterir, uygulama beyaz ekrana düşmez', () => {
    // React, yakalanan hataları da konsola loglar - testte gürültü olmasın diye sessize alıyoruz.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Bir şeyler ters gitti')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sayfayı Yenile' })).toBeInTheDocument();
    expect(screen.queryByText('Normal içerik')).not.toBeInTheDocument();
  });

  it('fallback\'te "Sayfayı Yenile" tıklanınca window.location.reload çağrılır', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // jsdom'da window.location.reload gerçek bir navigasyon denediğinden
    // ve salt-okunur olduğundan doğrudan spy'lanamıyor - tüm `location`
    // global'ini vitest'in `vi.stubGlobal`'ıyla geçici olarak değiştiriyoruz.
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: 'Sayfayı Yenile' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('İnovasyon fikri #105: fallback UI gösterilince "Sayfayı Yenile" butonuna otomatik focus verilir', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'Sayfayı Yenile' })).toHaveFocus();
  });
});
