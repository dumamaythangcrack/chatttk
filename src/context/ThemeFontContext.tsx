import React, { createContext, useState, useEffect, useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

type Theme = "light" | "dark" | "system";

interface ThemeFontContextType {
  theme: Theme;
  font: "default" | "serif" | "mono";
  fontSize: number;
  lineHeight: number;
  setTheme: (theme: Theme) => void;
  setFont: (font: "default" | "serif" | "mono") => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
}

export const ThemeFontContext = createContext<ThemeFontContextType | undefined>(undefined);

export function ThemeFontProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [font, setFontState] = useState<"default" | "serif" | "mono">("default");
  const [fontSize, setFontSizeState] = useState(16);
  const [lineHeight, setLineHeightState] = useState(1.5);

  const saveSettings = useCallback(async (key: string, value: any) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, "settings", auth.currentUser.uid), { [key]: value });
    } catch (err) {
      console.error("Failed to save setting:", err);
    }
  }, []);

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value);
    saveSettings("theme", value);
  }, [saveSettings]);

  const setFont = useCallback((value: "default" | "serif" | "mono") => {
    setFontState(value);
    saveSettings("font", value);
  }, [saveSettings]);

  const setFontSize = useCallback((value: number) => {
    setFontSizeState(Math.max(12, Math.min(20, value)));
    saveSettings("fontSize", value);
  }, [saveSettings]);

  const setLineHeight = useCallback((value: number) => {
    setLineHeightState(Math.max(1, Math.min(2, value)));
    saveSettings("lineHeight", value);
  }, [saveSettings]);

  return (
    <ThemeFontContext.Provider value={{ theme, font, fontSize, lineHeight, setTheme, setFont, setFontSize, setLineHeight }}>
      {children}
    </ThemeFontContext.Provider>
  );
}

export function useThemeFont() {
  const context = React.useContext(ThemeFontContext);
  if (!context) throw new Error("useThemeFont must be used within ThemeFontProvider");
  return context;
}
