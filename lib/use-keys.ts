"use client";

import { useEffect, useState } from "react";
import { getKeys, type Keys } from "./keys";

export function useKeys(): Keys {
  const [keys, setKeysState] = useState<Keys>({ llm: null, search: null });

  useEffect(() => {
    setKeysState(getKeys());
    const handler = () => setKeysState(getKeys());
    window.addEventListener("lumiere:keys-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("lumiere:keys-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return keys;
}
