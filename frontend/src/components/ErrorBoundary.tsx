import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// İnovasyon fikri #55: React'te hiç Error Boundary yoktu - beklenmedik bir
// render hatası (örn. bir bileşende null referans) tüm uygulamayı boş beyaz
// ekrana düşürüyordu, kullanıcı ne olduğunu hiç anlamıyordu.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary yakaladı:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app app-centered">
          <div className="game-over-screen" role="alertdialog" aria-modal="true" aria-label="Bir hata oluştu">
            <h2>Bir şeyler ters gitti</h2>
            <p className="game-over-text">
              Beklenmeyen bir hata oluştu. Karakterin/ilerlemen kayıp olmadı - sayfayı yenilemen yeterli.
            </p>
            <button type="button" onClick={() => window.location.reload()}>
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
