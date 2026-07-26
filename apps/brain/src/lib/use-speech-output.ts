"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Read an assistant answer aloud via the browser's own speech synthesis.
 * No server round-trip; note that some OS voices are cloud-backed, which is why
 * this is a per-message button rather than something that fires automatically.
 */
export function useSpeechOutput() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const toggle = useCallback(
    (id: string, text: string) => {
      if (!("speechSynthesis" in window)) return;
      if (speakingId === id) {
        stop();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingId(id);
    },
    [speakingId, stop],
  );

  return { supported, speakingId, toggle, stop };
}
