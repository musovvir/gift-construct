import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import GiftConstructor from './components/GiftConstructor';
import ThemeToggle from './components/ThemeToggle';
import './styles/App.css';

// Создаем QueryClient для React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 минут
      cacheTime: 10 * 60 * 1000, // 10 минут
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [telegramWebApp, setTelegramWebApp] = useState(null);

  useEffect(() => {
    // Инициализация Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Настройка темы
      if (tg.colorScheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      
      setTelegramWebApp(tg);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="app">
          <header className="app-header">
            <h1>For my dear «Midnight Blue» community from{' '}
              <a
                href="https://t.me/musovvir_v"
                target="_blank"
                rel="noopener noreferrer"
                className="header-link"
              >
                @musovvir_v
              </a>
            </h1>
            <ThemeToggle />
          </header>
          
          <main className="app-main">
            <GiftConstructor telegramWebApp={telegramWebApp} />
          </main>
          
          <footer className="app-footer">
            <p>
              Big thanks to{' '}
              <a
                href="https://t.me/giftchanges"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                @giftchanges
              </a>
              {' '}for{' '}
              <a
                href="https://api.changes.tg/"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                API
              </a>
            </p>
          </footer>
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;