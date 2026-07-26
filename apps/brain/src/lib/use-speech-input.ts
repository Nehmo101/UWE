"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictation for the KI-Chat, with two deliberately different paths.
 *
 * **local** — `MediaRecorder` → the connector's `stt_local` job → transcript.
 * Nothing leaves the home network; this is the default whenever a connector
 * advertises the capability.
 *
 * **browser** — the Web Speech API. In Chrome this streams the audio to the
 * browser vendor's servers, which is the opposite of what the Brain promises,
 * so it is opt-in only, never the default, and the caller must show a warning.
 * The choice lives in `localStorage` and never on the server.
 *
 * Both paths only ever fill the composer; nothing is sent automatically, so a
 * misheard word stays editable.
 */

export type SpeechMode = "local" | "browser";

const BROWSER_OPT_IN_KEY = "uwe-brain-browser-dictation";

/** Containers a browser may hand us, best first. */
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export interface UseSpeechInputOptions {
  /** True when a connector advertises `stt_local`. */
  localAvailable: boolean;
  /** Called with the recognized text; the caller appends it to the composer. */
  onTranscript: (text: string) => void;
}

export interface UseSpeechInputResult {
  recording: boolean;
  busy: boolean;
  error: string | null;
  mode: SpeechMode;
  /** True when the browser can record at all (secure context + API present). */
  supported: boolean;
  browserFallbackAllowed: boolean;
  enableBrowserFallback: (enabled: boolean) => void;
  toggle: () => void;
  clearError: () => void;
}

export function useSpeechInput(options: UseSpeechInputOptions): UseSpeechInputResult {
  const { localAvailable, onTranscript } = options;

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserFallbackAllowed, setBrowserFallbackAllowed] = useState(false);
  const [supported, setSupported] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    setBrowserFallbackAllowed(window.localStorage.getItem(BROWSER_OPT_IN_KEY) === "true");
    const hasRecorder =
      typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    const hasRecognition = Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
    setSupported(hasRecorder || hasRecognition);
  }, []);

  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.abort();
    },
    [],
  );

  const mode: SpeechMode = localAvailable ? "local" : "browser";

  const enableBrowserFallback = useCallback((enabled: boolean) => {
    setBrowserFallbackAllowed(enabled);
    window.localStorage.setItem(BROWSER_OPT_IN_KEY, String(enabled));
  }, []);

  const uploadRecording = useCallback(async (blob: Blob) => {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "diktat.webm");
      const response = await fetch("/api/ai/assistant/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Spracherkennung fehlgeschlagen.");
      }
      if (data.text) {
        onTranscriptRef.current(data.text);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Spracherkennung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }, []);

  const startLocal = useCallback(async () => {
    const mimeType = pickRecorderMimeType();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size > 0) void uploadRecording(blob);
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError(
        "Kein Zugriff auf das Mikrofon. Bitte die Berechtigung im Browser erlauben.",
      );
    }
  }, [uploadRecording]);

  const startBrowser = useCallback(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Dieser Browser bietet keine eigene Spracherkennung.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) =>
        event.results[index][0].transcript,
      )
        .join(" ")
        .trim();
      if (transcript) onTranscriptRef.current(transcript);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Kein Zugriff auf das Mikrofon."
          : "Spracherkennung des Browsers fehlgeschlagen.",
      );
    };
    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, []);

  const toggle = useCallback(() => {
    setError(null);

    if (recording) {
      recorderRef.current?.stop();
      recorderRef.current = null;
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    if (mode === "local") {
      void startLocal();
      return;
    }

    if (!browserFallbackAllowed) {
      setError(
        "Lokale Spracherkennung ist nicht verfügbar. Den Browser-Fallback musst du unten ausdrücklich erlauben.",
      );
      return;
    }
    startBrowser();
  }, [browserFallbackAllowed, mode, recording, startBrowser, startLocal]);

  const clearError = useCallback(() => setError(null), []);

  return {
    recording,
    busy,
    error,
    mode,
    supported,
    browserFallbackAllowed,
    enableBrowserFallback,
    toggle,
    clearError,
  };
}
