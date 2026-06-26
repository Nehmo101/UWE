# Soundboard ↔ worker flow

The browser never talks to the RTX machine directly. A soundboard action becomes a
queued connector job that the RTX Host Connector claims and plays locally.

## Flow

```text
User klickt Soundbutton
  → Host prüft Auth/Berechtigung
  → Host erstellt Queue-Job (sound_play / sound_stop / sound_stop_all / sound_volume)
  → RTX Connector claimt den Job (Lane: audio)
  → RTX Connector spielt lokal ab oder triggert Spotify
  → RTX Connector meldet complete/fail
  → UI zeigt Status
```

API: `POST /api/worlds/{worldSlug}/soundboard/rtx` with
`{ action: "play" | "stop" | "stop_all" | "volume", buttonId?, sourceUrl?, title?, volume? }`.

## Priorities

- `sound_stop` / `sound_stop_all` → priority **100** (emergency stop).
- `sound_play` / `sound_volume` → priority **90**.
- Audio jobs run in the `audio` lane and **overtake** long GPU jobs — sound never
  waits behind an LLM or image job.

## Degraded mode (RTX offline)

When no connector advertising `audio_local` is online, the endpoint returns a calm
degraded response (HTTP 200), **not** an error:

```json
{ "queued": false, "degraded": true,
  "message": "RTX Connector offline — lokale Audioausgabe ist pausiert." }
```

The soundboard UI stays usable (browser playback and editing continue) and shows
the offline notice with a link to **System → RTX Connector**.

## Spotify

The host can control Spotify directly via the Spotify Web API (existing routes).
The queue additionally defines `spotify_play` / `spotify_pause` / `spotify_volume`
/ `spotify_transfer_device` job types (lane `spotify`, priority 80) so a connector
can drive a preferred local device. Wiring those host routes onto the queue is a
follow-up; today the direct Spotify path remains.

## Local audio playback

The connector plays a sound by spawning an optional player command
(`UWE_CONNECTOR_AUDIO_CMD`, e.g. `mpv --no-video`). Without it, the job is
acknowledged so the host UI reflects receipt — the platform-specific audio backend
is configured per RTX machine.
