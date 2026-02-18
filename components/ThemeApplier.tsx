"use client";

import { useEffect } from "react";

/** Reads saved theme/scheme from localStorage and applies data attributes to <body> on mount. */
export default function ThemeApplier() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("spellChessTheme");
    const theme = savedTheme === "light" ? "light" : "dark";
    const defaultScheme = theme === "light" ? "wood" : "green";
    const savedScheme = localStorage.getItem("spellChessBoardScheme");
    const scheme = ["wood", "green", "blue", "purple"].includes(savedScheme ?? "")
      ? savedScheme!
      : defaultScheme;
    document.body.dataset.theme = theme;
    document.body.dataset.scheme = scheme;
  }, []);

  return null;
}
