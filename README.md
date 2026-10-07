# Museum Studio

Ein Framework, das ein **vernetztes Wissensgebiet** als begehbares Museum zeigt.
Besucher gehen **Reisen** (wie U-Bahn-Linien) durch **Stationen** (kleine Lektionen). Wo eine Station auf mehreren Reisen liegt,
steigt man um und sieht, dass das Gebiet ein Netz ist, kein Inhaltsverzeichnis.

Entstanden aus dem **Gehirnmuseum** (Psychologie, Neurobiologie, Philosophie des Geistes, 16 Reisen, 205 Stationen).
Dasselbe Gerüst trägt andere Gebiete: Organisationsentwicklung, Quantenphysik, Kosmologie, Spieltheorie, Zukunftsforschung …
(Ideen in `docs/THEMENIDEEN.md`).

*English in short:* a static, dependency-free framework (plain JavaScript, no build step for the visitor, no external requests) that renders a
knowledge domain as a metro-style network of journeys and stations with transfer points, a timeline for historical journeys, a travel passport,
search, interactive exhibits and swappable themes. Content lives in a *pack*; the engine never needs to change. The default UI language is German;
the vocabulary is configurable per pack.

## Was drin ist
- **Netzplan** der Reisen mit Umsteigestationen (Liniennummern, Zoom, Liste), **Zeitstrahl** für historische Reisen, **Reise-Modus**, **Reisepass** (Stempel nur im Browser), **Suche**.
- **Skins (Themes):** `halle` (Standard), `kabinett` (organisch, historisch), `ma` (Zen, Bauhaus), `quelltext` (Computer-Code). Zur Laufzeit umschaltbar, hell und dunkel.
- **Pakete:** `packs/_vorlage` (kleines Muster), `packs/beispiel-gehirn` (Ausschnitt aus dem Gehirnmuseum), eigene Pakete über `npm run setup` (Einrichtung mit Fragen) oder `tools/new-pack.mjs`.
- **Kein Tracking, keine Cookies, keine externen Abrufe, Systemschriften.** Läuft per Doppelklick (`file://`) und auf jedem Webspace.

## Installation und Start
**Voraussetzungen:** [Node.js](https://nodejs.org) ab Version 18. Git ist praktisch, aber nicht nötig. Playwright mit Chromium braucht nur der Browser-Rauchtest (`npm run smoke`), alles andere läuft ohne.

```bash
git clone https://github.com/alphakaefer/museum-studio.git
cd museum-studio
npm run setup            # oder: node tools/onboarding.mjs
```
Die Einrichtung prüft zuerst deine Umgebung (`npm run doctor`), stellt dann ein paar kurze Fragen (Name, Thema, Zielgruppe, Umfang, Look, heikle Themen, Quellen, Lizenz; Enter übernimmt jeweils den Vorschlag)
und legt `packs/<id>/` an, samt **Auftragsdatei** `BRIEFING.md` für KI-Agenten. Danach hast du zwei Wege:
1. **Mit einer KI:** den am Ende ausgegebenen Prompt in Claude Code (oder einen anderen Agenten) einfügen: „Lies `docs/AGENTEN.md` und `packs/<id>/BRIEFING.md` und richte das Paket nach der Anleitung ein …“.
2. **Von Hand:** `BRIEFING.md` lesen und `docs/AGENTEN.md` ab Schritt 1 abarbeiten.

Beispielpakete bauen und ansehen:
```bash
npm run check -- beispiel-gehirn                    # Prüfungen
npm run build -- beispiel-gehirn --skins=all        # erzeugt dist/beispiel-gehirn/
open dist/beispiel-gehirn/index.html                # oder per Doppelklick (auch: spieltheorie)
```
Fertig? `npm run check -- <id>`, `node tools/layout-map.mjs <id>`, `npm run build -- <id> --skins=all`. Die Seite in `dist/<id>/` ist rein statisch und läuft auf jedem Webspace.
Alle Fragen, ihre Wirkung und der nichtinteraktive Aufruf (`--config`, `--defaults`, `--dry-run`): [`docs/ONBOARDING.md`](docs/ONBOARDING.md).

## Werkzeuge
```bash
node tools/new-pack.mjs quanten --title="Quantenwelt" --journeys=6 --historical=1 [--stations=14]   # Gerüst ohne Befragung
node tools/layout-map.mjs quanten && node tools/check-pack.mjs quanten && node tools/build.mjs quanten --skins=all
node tools/list-icons.mjs            # gültige Icon-Schlüssel
node tools/check-skin.mjs --all      # Skins prüfen
```
Der Browser-Rauchtest (`tools/smoke.mjs`) braucht zusätzlich Playwright mit Chromium; es gibt keine festen Pfade:
```bash
mkdir -p ~/pw && cd ~/pw && npm init -y && npm i playwright && npx playwright install chromium   # einmalig
cd <dieses Repository>
PLAYWRIGHT_MODULE_DIR=~/pw node tools/smoke.mjs beispiel-gehirn --quick   # Paket vorher bauen
```
`PLAYWRIGHT_MODULE_DIR` (Ordner, in dem Playwright installiert ist; sonst werden das Repository, `NODE_PATH` und der globale npm-Ordner durchsucht), `CHROMIUM_PATH` (eigene Chromium-Programmdatei, sonst der von Playwright installierte Browser).
Screenshots landen standardmäßig in `dist/<paket>/_shots/` (`--shots=<ordner>` ändert das). Der Test öffnet auch jedes Exponat. `npm run doctor` zeigt, was davon bei dir schon da ist.

## Dokumentation
| Datei | Für wen |
|---|---|
| `docs/ONBOARDING.md` | **Einrichtung**: die Fragen von `npm run setup`, ihre Wirkung, Konfiguration ohne Fragen, Auftragsdatei |
| `docs/AGENTEN.md` | **KI-Agenten und Redaktion**: Schritt für Schritt ein neues Wissensgebiet einrichten, Regeln, Qualitätstore |
| `docs/INHALT-SCHREIBEN.md` | Wer Stationen schreibt: Schema, Stil, Beispiele, Checkliste |
| `docs/DESIGNER.md` | **Gestalter**: eigene Skins entwerfen, Tokens, Komponenten, Prüfung |
| `docs/ARCHITEKTUR.md` | Entwickler: Verzeichnisse, Datenformate (alle `pack.json`-Felder), Namespace-API, Build, Prüfwerkzeuge |
| `docs/ENGINE-WUENSCHE.md` | Wunschliste an die Engine-Pflege (Vorlage; Pakete-Autoren tragen dort ein, statt die Engine anzufassen) |
| `docs/THEMENIDEEN.md` | Startpunkte für fünf weitere Wissensgebiete |
| `docs/FRAMEWORK-PLAN.md` | Bauplan und Entwurfsentscheidungen |

## Status
Version 0.1. Den Arbeitsstand eines Pakets führt `packs/<id>/ARBEITSSTAND.md` (Vorlage: `packs/_vorlage/ARBEITSSTAND.md`), Faktencheck: `packs/<id>/FAKTENCHECK.md`. Lizenz: MIT für den Code (`LICENSE`), CC BY 4.0 für die Beispielinhalte (`LICENSE-CONTENT.md`).
