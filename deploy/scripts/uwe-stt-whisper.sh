#!/usr/bin/env bash
# Reference speech-to-text wrapper for the UWE Maschinenraum.
#
# UWE ships no speech engine on purpose: Ollama has no audio endpoint, and
# pinning one Python/whisper stack would put a manual install step back on the
# host. Instead the connector calls a command of the owner's choosing —
# configured in the Command Center as `sttCommand` (env `UWE_CONNECTOR_STT_CMD`).
#
# Contract (JSON on stdin, JSON on stdout):
#   in : {"audioPath":"/tmp/uwe-stt-….webm","mimeType":"audio/webm","language":"de","model":"large-v3-turbo"}
#   out: {"text":"…","model":"…"}
#
# This wrapper drives whisper.cpp's `whisper-cli`. For faster-whisper or any
# OpenAI-compatible `/v1/audio/transcriptions` server, keep the same contract and
# swap the middle section.
#
# Setup on the Maschinenraum host (once):
#   WHISPER_CLI=/opt/whisper.cpp/build/bin/whisper-cli
#   WHISPER_MODEL=/opt/whisper.cpp/models/ggml-large-v3-turbo.bin
# then set the Command Center's STT command to:
#   bash /path/to/UWE/deploy/scripts/uwe-stt-whisper.sh
set -euo pipefail

WHISPER_CLI="${WHISPER_CLI:-whisper-cli}"
WHISPER_MODEL="${WHISPER_MODEL:-}"
FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"

fail() {
  echo "uwe-stt-whisper: $1" >&2
  exit 1
}

command -v jq >/dev/null 2>&1 || fail "jq wird benötigt"
command -v "$WHISPER_CLI" >/dev/null 2>&1 || fail "whisper-cli nicht gefunden ($WHISPER_CLI)"
[[ -n "$WHISPER_MODEL" ]] || fail "WHISPER_MODEL ist nicht gesetzt"
[[ -f "$WHISPER_MODEL" ]] || fail "Whisper-Modell nicht gefunden ($WHISPER_MODEL)"

PAYLOAD="$(cat)"
AUDIO_PATH="$(jq -r '.audioPath // empty' <<<"$PAYLOAD")"
LANGUAGE="$(jq -r '.language // "de"' <<<"$PAYLOAD")"

[[ -n "$AUDIO_PATH" && -f "$AUDIO_PATH" ]] || fail "audioPath fehlt oder ist nicht lesbar"

# whisper.cpp needs 16 kHz mono PCM; browsers record Opus in WebM.
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
WAV_PATH="$WORK_DIR/audio.wav"

command -v "$FFMPEG_BIN" >/dev/null 2>&1 || fail "ffmpeg wird für die Konvertierung benötigt"
"$FFMPEG_BIN" -loglevel error -y -i "$AUDIO_PATH" -ar 16000 -ac 1 -c:a pcm_s16le "$WAV_PATH" \
  || fail "Audio konnte nicht nach WAV konvertiert werden"

"$WHISPER_CLI" \
  --model "$WHISPER_MODEL" \
  --language "$LANGUAGE" \
  --output-json \
  --output-file "$WORK_DIR/out" \
  --no-prints \
  "$WAV_PATH" >/dev/null 2>&1 || fail "whisper-cli ist fehlgeschlagen"

[[ -f "$WORK_DIR/out.json" ]] || fail "whisper-cli hat keine JSON-Ausgabe erzeugt"

jq -n \
  --arg text "$(jq -r '[.transcription[].text] | join(" ") | gsub("^\\s+|\\s+$";"")' "$WORK_DIR/out.json")" \
  --arg model "$(basename "$WHISPER_MODEL")" \
  '{text: $text, model: $model}'
