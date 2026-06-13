# UWE AI Brain Mail Progress

## Aktueller Stand

- P00 Repo analysis: done
- P01 Production host baseline: in progress or next
- P02 Cloudflare and auth hardening: open
- P03 Mail Center: open
- P04 Brain Knowledge Store: open
- P05 RTX Inference Connector: open
- P06 AI Run History: open
- P07 Context Builder integration: open
- P08 Review Apply Undo: open
- P09 First Brain Actions: open
- P10 Embeddings and Vector Search: open
- P11 Admin Status Dashboard: open
- P12 Job Queue: open
- P13 QA and Hardening: open

## Architekturregel

UWE owns all persistent application data and all Brain knowledge.
The RTX machine is only an inference worker.
The RTX machine must not persist UWE application data.
Only UWE on the old laptop is exposed through Cloudflare.

## Nach jedem Paket aktualisieren

For each completed package, update this file with:

- package id
- status
- changed files
- commands run
- result
- known limitations
- recommended next package

## Aktuelle Empfehlung

Finish P01 first. After P01, use `docs/ai-brain-mail/ONE_PROMPT_AFTER_P01.md` to start the long-running orchestrator flow.
