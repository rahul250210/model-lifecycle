"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { lightPalette, darkPalette, themePalette as defaultTheme } from "./themePalette";

type ThemeType = typeof defaultTheme;
type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    theme: ThemeType;
    mode: ThemeMode;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>('light');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Check local storage or system preference
        const savedMode = localStorage.getItem('themeMode') as ThemeMode;
        if (savedMode) {
            setMode(savedMode);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setMode('dark');
        }
    }, []);

    // Sync backgrounds and color-scheme to prevent white space on overscroll
    useEffect(() => {
        const currentTheme = mode === 'light' ? lightPalette : darkPalette;
        document.documentElement.style.backgroundColor = currentTheme.background;
        document.documentElement.style.colorScheme = mode;
        document.body.style.backgroundColor = currentTheme.background;
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';

        // Target the #root element for extra coverage
        const rootElement = document.getElementById('root');
        if (rootElement) {
            rootElement.style.backgroundColor = currentTheme.background;
            rootElement.style.overscrollBehavior = 'none';
        }
    }, [mode]);

    const toggleTheme = () => {
        setMode((prev) => {
            const newMode = prev === 'light' ? 'dark' : 'light';
            localStorage.setItem('themeMode', newMode);
            return newMode;
        });
    };

    const theme = mode === 'light' ? lightPalette : darkPalette;

    return (
        <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>
            {!mounted ? <div style={{ visibility: 'hidden' }}>{children}</div> : children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
