import React, { useContext, useEffect } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { themeTokensToCssVars } from '../utils/cssVars';

export function CMSThemeProvider({ children }: { children: React.ReactNode }) {
  const context = useContext(ThemeContext);

  useEffect(() => {
    if (!context || !context.theme) return;
    
    const root = document.documentElement;
    const vars = themeTokensToCssVars(context.theme);

    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
  }, [context?.theme]);

  return <>{children}</>;
}
