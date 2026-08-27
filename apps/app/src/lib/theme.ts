import { useEffect, useState } from 'react';

/**
 * Тема оформления. Помимо светлой и тёмной есть «как в системе» — и это значение по умолчанию:
 * раньше системная тема запоминалась в хранилище при первом же запуске, после чего приложение
 * навсегда переставало следовать за системой, даже если человек ни разу не трогал переключатель.
 */
export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

const KEY = 'los-theme';

export const themeLabels: Record<ThemePreference, string> = {
  system: 'Как в системе',
  light: 'Светлая',
  dark: 'Тёмная',
};

function storedPreference(): ThemePreference {
  const saved = localStorage.getItem(KEY);
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme(): {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(storedPreference);
  const [system, setSystem] = useState<Theme>(systemTheme);

  // Системная тема может смениться на лету (закат в настройках телефона) — следим за ней.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme: Theme = preference === 'system' ? system : preference;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    localStorage.setItem(KEY, next);
  }

  return {
    theme,
    preference,
    setPreference,
    // Кнопка в шапке переключает свет/тьму явно — это осознанный выбор, а не «как в системе».
    toggle: () => setPreference(theme === 'dark' ? 'light' : 'dark'),
  };
}
