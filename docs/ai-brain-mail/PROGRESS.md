# UWE AI Brain Mail Progress

## Aktueller Stand

- P00 Repo analysis: done
- P01 Production host baseline: partial
  - P01A Production ENV and path concept: done
  - P01B App/DB/Storage healthcheck: done
  - P01C Persistent paths: open
  - P01D Production docs: open
- P02 Cloudflare and auth hardening: blocked until P01C/P01D are done
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

## P01 completion note

P01A and P01B were reported as completed by the user.
`GRANULAR_TASKS.md` also defines P01C and P01D, so P01 is not fully complete yet.

Remaining P01 tasks:

- P01C Persistent paths: Make uploads, data, backups and exports configurable through env or existing settings.
- P01D Production docs: Document old-laptop production start and smoke checks.

Before starting the long-running orchestrator flow, the agent should verify the local working tree with `git status` and confirm that the current build/test state is acceptable.

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

Finish P01C and P01D next. After P01C/P01D are completed and build/tests are acceptable, update this file to mark P01 done and continue with P02.
