"use client";
import { MotionConfig } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { FeedbackProvider } from "./ui/feedback";

type Theme = "dark" | "light";
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: "dark", setTheme: () => {} });

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  useEffect(() => {
    try {
      const t = localStorage.getItem("nx-theme");
      if (t === "light" || t === "dark") setThemeState(t);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("nx-theme", t);
    } catch {
      /* ignore */
    }
  }, []);
  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      <MotionConfig reducedMotion="user">
        <SWRConfig value={{ errorRetryCount: 2, dedupingInterval: 1500 }}>
          <FeedbackProvider>{children}</FeedbackProvider>
        </SWRConfig>
      </MotionConfig>
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
