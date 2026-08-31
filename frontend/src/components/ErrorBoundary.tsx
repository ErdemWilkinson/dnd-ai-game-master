import { Component, createRef, type ErrorInfo, type ReactNode } from 'react';

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
  private reloadButtonRef = createRef<HTMLButtonElement>();

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary yakaladı:', error, info.componentStack);
  }

  // Yaratıcı cron fikir #105: HelpModal'ın #17'de aldığı focus yönetimi
  // (açılınca ana butona odaklan) bu tam-ekran dialog'a hiç uygulanmamıştı.
  // componentDidUpdate de gerekli - hasError zaten true iken (ilk mount'tan
  // SONRA) bir sonraki hata yakalanırsa componentDidMount tekrar çalışmaz,
  // sadece bir güncelleme tetiklenir.
  componentDidMount() {
    if (this.state.hasError) this.reloadButtonRef.current?.focus();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (this.state.hasError && !prevState.hasError) this.reloadButtonRef.current?.focus();
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
            <button type="button" ref={this.reloadButtonRef} onClick={() => window.location.reload()}>
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
