import { createContext, useContext, useEffect, useState } from "react";
import { darkTheme, lightTheme } from "./theme";

const ThemeContext = createContext({ theme: "dark", toggleTheme: () => {} });

function applyTheme(name) {
  const vars = name === "light" ? lightTheme : darkTheme;
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-theme", name);
}

function getInitialTheme() {
  const saved = localStorage.getItem("qc-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const t = getInitialTheme();
    applyTheme(t);
    return t;
  });

  // Sync system preference changes (only when user hasn't explicitly chosen)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e) => {
      if (!localStorage.getItem("qc-theme")) {
        const next = e.matches ? "light" : "dark";
        applyTheme(next);
        setTheme(next);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem("qc-theme", next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
