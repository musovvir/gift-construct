import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Проверяем сохраненную тему или используем темную по умолчанию
    const saved = localStorage.getItem('theme');
    if (saved) {
      return saved === 'dark';
    }
    return true; // Темная тема по умолчанию
  });

  useEffect(() => {
    // Сохраняем тему в localStorage
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // Применяем тему к документу
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
