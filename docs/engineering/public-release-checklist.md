# Checkliste: Repo öffentlich schalten

Stand: 2026-07-29

Diese Liste deckt ab, was **nicht** im Repository liegt, sondern in den
GitHub-Einstellungen geklickt werden muss. Der Dateianteil (LICENSE,
CONTRIBUTING, CODE_OF_CONDUCT, Templates, Dependabot, SHA-Pinning) ist im
Repository erledigt.

Reihenfolge ist bewusst: Punkt 1 muss **vor** dem Umschalten passieren, alles
Weitere direkt danach.

---

## 1. Vor dem Umschalten — Fork-PR-Freigabe

**Der wichtigste Punkt.** Am Repo hängt ein self-hosted Runner auf dem UWE-Host
(Label `uwe-deploy`, `uwe`-User mit NOPASSWD-sudoers). Bei `pull_request` führt
GitHub die Workflow-Datei **aus dem PR-Branch** aus — ein Fork-PR kann sich also
einen Job mit `runs-on: [self-hosted, uwe-deploy]` selbst schreiben.

> **Settings → Actions → General → Fork pull request workflows from outside
> collaborators → „Require approval for all external contributors"**

Ohne diese Einstellung genügt ein einziger gemergter Fremd-PR, damit die Person
danach ohne Freigabe Code auf dem Host im LAN ausführen kann. Hintergrund und
Zusatzmaßnahmen: [self-hosted-ci.md](self-hosted-ci.md#pflicht-einstellung-im-öffentlichen-repo).

Ebenfalls unter **Settings → Actions → General** prüfen:

- **Workflow permissions** → „Read repository contents and packages permissions"
  (nicht Read *and write*).
- „Allow GitHub Actions to create and approve pull requests" → **aus**, außer es
  wird gebraucht.

---

## 2. Direkt nach dem Umschalten — Security-Features

**Settings → Code security**

- [ ] **Private vulnerability reporting** → aktivieren.
      `SECURITY.md` und `.github/ISSUE_TEMPLATE/config.yml` verlinken bereits
      auf `/security/advisories/new` — ohne diese Einstellung läuft der Link ins Leere.
- [ ] **Dependabot alerts** → aktivieren.
- [ ] **Dependabot security updates** → aktivieren.
      (Die Versions-Updates kommen aus `.github/dependabot.yml`.)
- [ ] **Secret scanning** → aktivieren. Scannt die **komplette History**
      serverseitig — das ist der eigentliche Backstop hinter `pnpm secret:scan`.
- [ ] **Push protection** → aktivieren. Blockt versehentlich gepushte
      Zugangsdaten, bevor sie öffentlich werden.
- [ ] **CodeQL** (Default Setup) → für ein öffentliches Repo kostenlos.

---

## 3. Branch Protection für `main`

**Settings → Rules → Rulesets** (oder Branch protection rules)

- [ ] Direkte Pushes auf `main` unterbinden, PR verlangen.
- [ ] Required status checks: die Jobs aus `pr-check.yml`.
- [ ] „Require branches to be up to date before merging".
- [ ] Force-Push auf `main` blocken — **erst nach** dem History-Rewrite setzen,
      sonst blockt die Regel den Rewrite-Push selbst.
- [ ] Löschen von `main` blocken.

---

## 4. Sichtbarkeit und Auffindbarkeit

- [ ] **Description** setzen — ohne sie erscheint das Repo in der Suche nackt.
- [ ] **Topics** vergeben, z. B. `self-hosted`, `nextjs`, `typescript`,
      `dnd`, `ttrpg`, `monorepo`, `prisma`, `local-first`, `personal-knowledge-management`.
- [ ] **Discussions** aktivieren — `.github/ISSUE_TEMPLATE/config.yml` verweist
      darauf. Ohne Aktivierung ist der Link tot.
- [ ] Entscheiden, ob **Wiki** und **Projects** an bleiben (bei ungenutzt: aus).

---

## 5. History-Rewrite — Stand und Restarbeit

**Erledigt am 2026-07-29.** Umgeschrieben wurden alle 2261 Commits über alle
33 Branches. Drei Identitäten waren betroffen — die letzten beiden fielen erst
im vollständigen Mirror auf:

| Alt | Neu |
|---|---|
| private Mailadresse (89 Commits, Autor + Committer) | `114261361+Nehmo101@users.noreply.github.com` |
| lokale Adresse des Arbeitsrechners (Klarname im Namensfeld) | dito |
| lokale Adresse des Host-Systems | dito |

Die beiden lokalen Adressen verrieten zusätzlich den Vornamen und zwei
interne Hostnamen. Verifiziert: Inhalt bit-identisch (Tree-Hash von `main`
unverändert), Commit-Zahl unverändert, `git fsck` fehlerfrei. Verbleibende
Identitäten sind ausschließlich Bot- und Noreply-Adressen.

### Offen — sonst war der Rewrite wirkungslos

> **Der Rewrite allein entfernt die Adresse nicht von GitHub.**

GitHub verwaltet `refs/pull/*` selbst; diese Refs sind schreibgeschützt und
zeigen weiterhin auf die **alten** Commits. Ein Scan des Server-Stands nach dem
Push findet dort noch **36 Treffer** der alten Adressen. Solange das so ist, ist
die E-Mail über `refs/pull/N/head` und über direkte Commit-SHA-URLs abrufbar —
für jeden, sobald das Repo öffentlich ist.

Betroffen sind **159 distinkte Commits**, erreichbar über **575 der 621**
PR-Refs. `refs/pull/*` lassen sich nicht selbst löschen — kein Git-Befehl, keine
API, keine Einstellung.

### Entschieden: neues Repository (Weg B)

Das aktuelle Repo hat **0 Forks, 0 Stars, 0 Watcher, 0 offene Issues** — extern
hat es nie jemand gesehen. Ein Neuanfang kostet daher nichts, wirkt sofort und
vollständig (ein neues Repo hat gar keine PR-Refs), und niemand muss auf GitHub
Support warten.

- [ ] Aktuelles Repo in **`UWE-archiv`** umbenennen und **privat lassen** — so
      bleiben die 202 Issues und 621 PRs als Nachschlagewerk erhalten.
- [ ] Neues Repo **`UWE`** anlegen (gleicher Name, damit die Links in
      `SECURITY.md`, `README.md` und `.github/ISSUE_TEMPLATE/config.yml`
      gültig bleiben).
- [ ] Die **umgeschriebene** History dorthin pushen — nicht aus einem alten
      Klon, sonst kommen die alten Commits zurück.
- [ ] Erst danach öffentlich schalten und die Punkte 1–4 dieser Liste abarbeiten.

**Umzug, der dabei anfällt:**

- Self-hosted Runner neu registrieren (hängt am alten Repo, Label `uwe-deploy`)
- Secrets neu setzen: `CURSOR_API_KEY`, `STUDIO_API_TOKEN`,
  `STUDIO_CALLBACK_URL`, `TAURI_SIGNING_PRIVATE_KEY` (+ Passwort)
- `/opt/uwe` auf dem Host auf die neue Remote-URL umstellen
- Der Owner-Check in `deploy.yml` (`repository_owner == 'Nehmo101'`) bleibt gültig

*Verworfene Alternative (Weg A):* GitHub Support um das Aufräumen verwaister
Objekte bitten. Kostenlos und ohne Umzug, aber Wartezeit von Tagen, und bis
dahin ist der Rewrite wirkungslos.

### Danach

- [ ] **GitHub → Settings → Emails → „Keep my email address private"** aktivieren.
- [ ] Lokal auf allen Arbeitsrechnern:
      ```bash
      git config --global user.email "114261361+Nehmo101@users.noreply.github.com"
      git config --global user.name "VordenkerEnte"
      ```
      Sonst trägt der nächste Commit die private Adresse wieder ein.
- [ ] Auf dem **UWE-Host** (`/opt/uwe`) frisch ziehen — die alte History ist dort
      nicht mehr anschlussfähig, der Deploy-Job würde sonst scheitern:
      ```bash
      git fetch origin && git reset --hard origin/main
      ```
- [ ] Der Commit-Autor auf dem Host war eine lokale Adresse. Falls dort
      automatisiert committet wird, die Identität ebenfalls umstellen:
      ```bash
      sudo -u uwe git config --global user.email "114261361+Nehmo101@users.noreply.github.com"
      ```
- [ ] Alte Klone auf anderen Rechnern neu ziehen. Alle Commit-SHAs sind neu.

---

## Bewusst nicht gemacht

- **Assets nach Git LFS.** `assets/scenes/` (74 MB) wird von
  `scripts/copy-scenes.mjs` in jedes `public/scenes/` kopiert und von
  `pickScene.test.ts` geprüft — die Bilder sind aktiv in Benutzung. LFS würde
  den Clone auf ~13 MB drücken, aber jeder Cloner bräuchte `git-lfs`, und der
  GitHub-Free-Tier hat 1 GB Bandbreite pro Monat. Bei einem öffentlichen Repo
  ist das schnell erschöpft. 87 MB Clone-Größe ist der bessere Kompromiss.
- **`terra.html` entfernen.** Bewusst eingefrorene v1-Referenz, von
  `terra/README.md` und den Test-Fixtures referenziert.
