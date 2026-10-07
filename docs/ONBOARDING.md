# Einrichtung (Onboarding)

Das Onboarding stellt ein paar kurze Fragen zu Thema, Zielgruppe und Rahmen eines neuen Museums und macht daraus einen **Auftrag für KI-Agenten** (`BRIEFING.md`), bei Bedarf auch ein startbereites Paket unter `packs/<id>/`. **Zahlen (Reisen, Stationen) werden nicht abgefragt:** Das entscheidet der Agent fachlich und zeigt den Plan zur Freigabe, bevor er Texte schreibt.

Drei Wege, alle mit denselben Fragen (einzige Quelle: `tools/onboarding-fragen.json`) und demselben Auftragstext (gemeinsamer Kern: `tools/onboarding-core.mjs`):

| Weg | Wann | Aufruf |
|---|---|---|
| **Dialog mit einer KI** | kein Terminal, KI hat Zugriff auf das Repository | KI auf `AGENTS.md` verweisen (Claude Code, Codex, Gemini CLI, Copilot, Cursor …); sie führt Dialog und Befehle selbst aus |
| **`onboarding.html`** | kein Terminal, kein Repository-Zugriff der KI | Datei per Doppelklick im Browser öffnen, Fragen beantworten, drei Ergebnisse kopieren oder speichern |
| **Terminal** | Node.js ab 18 vorhanden | `npm run setup` (oder `node tools/onboarding.mjs`) |

```bash
npm run doctor     # prüft Node, Git, Playwright/Chromium und erklärt, was fehlt (und dass es meist ohne geht)
npm run setup      # Einrichtung; ruft doctor am Anfang selbst auf
```

Im Terminal hat jede Frage eine Erklärung und einen Standardwert in eckigen Klammern (**Enter übernimmt ihn**). Falsche Eingaben werden freundlich erklärt und neu erfragt.
Am Ende steht eine Zusammenfassung: **J** (anlegen), **N** (abbrechen), **W** (alle Fragen nochmal, deine Antworten als Vorgabe).
Geschrieben wird erst nach der Bestätigung und in einem Zug: Strg+C oder ein Abbruch hinterlässt nie ein halbes Paket, ein bestehendes Paket wird **nie** überschrieben.
Danach nennt das Werkzeug den **vollständigen Pfad** des Pakets und von `BRIEFING.md` („Dein Auftrag liegt hier: …“) und bietet an, den Ordner zu öffnen (nur mit angeschlossenem Terminal: macOS `open`, Linux `xdg-open`, Windows `explorer`).

## Was entsteht

| Datei in `packs/<id>/` | Inhalt |
|---|---|
| `pack.json` | ausgefüllt: `title`, `eyebrow`, `tagline`, `lang`, `defaultSkin`, `limits` (Standard: je Reise 11 bis 28 Stationen, dazu `visualShare`), `requireVisualPlan`, `footer`, `license`, `credits` (und `author`) |
| `plan.json` | **leerer Plan** (`journeys:[]`, `stations:[]`, `orders:{}`) mit TODO-Markierung `_TODO`; keine Stub-Reisen |
| `journeys.js` | ohne Reisen, mit Hinweis, was einzutragen ist |
| `BRIEFING.md` | lesbarer Auftrag: Thema, Zielgruppe, Ton, Umfang und Aufbau (Entscheidungsregeln), Reisenamen, Sorgfaltsregeln, Quellen, Look, Anschauung, Lizenz, Checkliste „Was der Agent liefern soll“ |
| `BRIEFING.json` | derselbe Auftrag maschinenlesbar (alle Antworten, abgeleitete Werte) |
| `ARBEITSSTAND.md` | vorbefüllt; alles, was nicht ausdrücklich der Auftraggeber entschieden hat, steht als **Annahme** mit „Bestätigt: offen“ |

`node tools/check-pack.mjs <id>` meldet für ein frisches Paket genau eine verständliche Meldung („Plan noch leer: Schritt 1 und 2 der Anleitung“), keine Folgefehler. Wer ein Gerüst mit Platzhaltern will, nutzt weiter `node tools/new-pack.mjs <id> --title=… --journeys=… [--historical=…] [--stations=…]` (Verhalten unverändert).

## Die Fragen und ihre Wirkung

| Nr. | Frage (Schlüssel) | Wirkung |
|---|---|---|
| 1 | **Museumsname** (`name`; Richtwert höchstens 24 Zeichen, Warnung darüber) | `pack.json` `title`; Prüfung warnt ab 30 Zeichen |
| 2 | **Paket-ID** (`id`; aus dem Namen abgeleitet, a–z, 0–9, Bindestrich, nicht vergeben) | Ordner `packs/<id>/`; vergeben heißt: neue ID wählen |
| 3 | **Untertitel oder Leitfrage** (`untertitel`) | `pack.json` `tagline` |
| 4 | **Thema** in ein bis zwei Sätzen (`thema`) | Auftrag im Briefing; `eyebrow` (kurzer erster Satz) |
| 5 | **Zielgruppe** (`zielgruppe`: laien, studierende, fachleute, gemischt) | Tonregeln im Briefing |
| 6 | **Sprache** (`sprache`) | `pack.json` `lang`; bei anderen Sprachen als Deutsch Hinweis, dass die festen Oberflächentexte der Engine deutsch bleiben |
| 7 | **Anrede** (`anrede`: du, Sie) | Briefing und Fußtexte |
| 8 | **Soll die Geschichte des Fachs eine eigene Reise bekommen?** (`geschichte`: ja, agent, nein; Standard agent) | Entscheidungsregel im Briefing für historische Reisen (Zeitstrahl) |
| 9 | **Größenordnung** als Wunsch (`groesse`: kompakt, mittel, umfassend, agent; Standard agent) | nur Hinweis mit Richtwert im Briefing, keine Zahl im Paket |
| 10 | **Reisenamen oder Themenideen** (optional, `reisenamen`) | Ideen im Briefing; der Agent übernimmt oder formuliert um |
| 11 | **Standard-Look** (`skin`, Ordner unter `themes/`) und 12 **Umschaltung für Besucher** (`skinWahl`) | `defaultSkin`; Baubefehl `--skins=all` oder `--skins=<skin>` |
| 13 | **Wie wichtig ist Anschauung?** (`anschauung`: zentral 50 %, viel 35 %, etwas 20 %, wenig 10 %) | `limits.visualShare`, `requireVisualPlan: true`; Briefing: Mindestzahl nach dem Plan ausrechnen |
| 14 | **Heikle Themen** (`heikel`: gesundheit, politik, religion, gewalt; Mehrfachauswahl) | `footer` (bei Gesundheit/Gewalt Hilfe-Spalte, Telefonseelsorge Deutschland) und Sorgfaltsregeln im Briefing |
| 15 | **Quellenregeln** (`quellen`: offen, eigene, domain) und bei domain **Adresse** (`materialHost`, https) | Quellenabschnitt im Briefing; `MATERIAL_HOST` im Prüfbefehl |
| 16 | **Urheber/Credits** (`urheber`) | `credits`, `author` |
| 17 | **Lizenz** (`lizenz`): **nur freie**: `cc-by-4.0` (Standard: frei nutzbar mit Namensnennung), `cc-by-sa-4.0` (Bearbeitungen unter derselben Lizenz), `cc0-1.0` (gemeinfrei gewidmet) | `license`; „alle Rechte vorbehalten“ und andere Werte werden abgelehnt (freie Lizenzen sind Voraussetzung) |
| 18 | **Impressum/Datenschutz-URL** (optional, `impressumUrl`) | Fußspalte „Rechtliches“ |

Alle Standardwerte, die nicht ausdrücklich gewählt wurden, stehen in `BRIEFING.json` unter `standardUebernommen` und in `ARBEITSSTAND.md` als Annahme.

### Fragenquelle

`tools/onboarding-fragen.json` enthält je Frage: `key`, `block`, `titel`, `hilfe` (ein Satz), `erklaerung` (optional, nur auf der Seite), `typ` (`text`, `id`, `sprache`, `auswahl`, `mehrfach`, `jaNein`, `liste`, `url`), `optionen` (mit `id`, `label`, `beschreibung`, Alias-Namen und wirkungstragenden Texten wie `ton`, `sorgfalt`, `regel`, `richtwert`, `anteil`), `standard`, `pflicht`, `nurWenn`, `validierung` (Regel und Fehlertexte) und `wirkung`. Die Regeln und der Briefing-Text stehen in `tools/onboarding-core.mjs` (reine Funktionen, keine Node-Zugriffe).
Nach jeder Änderung an einer dieser Dateien oder an `tools/onboarding-seite.tpl.html`: `node tools/build-onboarding-html.mjs` (erzeugt `onboarding.html`, `--check` prüft nur). Test, dass Browser und Terminal denselben Auftrag erzeugen: `PLAYWRIGHT_MODULE_DIR=<ordner> node tools/onboarding-test.mjs`.

## Nichtinteraktiv

```bash
node tools/onboarding.mjs --config=meine-antworten.json     # keine Fragen, keine Abschlussfrage
node tools/onboarding.mjs --defaults                        # alles Standard (Name „Mein Museum“)
node tools/onboarding.mjs --config=datei.json --dry-run     # Probelauf: nichts anlegen, nur zeigen
node tools/onboarding.mjs --yes                             # Fragen ja, Abschlussfrage nein
```

Die Konfiguration hat **dieselben Felder wie `BRIEFING.json`**; eine vorhandene `BRIEFING.json` mit anderer `id` lässt sich direkt wieder einspeisen.
Fehlende Felder bekommen den Standardwert (nur `name` ist Pflicht); unbekannte Felder, ungültige Werte, eine nicht freie Lizenz oder eine vergebene `id` werden mit Fehlertext und Exit-Code 2 abgelehnt. Ohne `id` wird sie aus dem Namen abgeleitet.
Bei `--dry-run` steht am Anfang und Ende „Probelauf: es wurde nichts angelegt.“.

**Alte Konfigurationsdateien** mit `reisen`, `stationenJeReise`, `historisch` oder `exponate` laden weiter: Die Zahlen gehen nur als **unverbindlicher Hinweis** ins Briefing (mit Hinweis in der Ausgabe), `historisch` wird zu `geschichte` (0 = nein, größer 0 = ja), `exponate` (ja/spaeter/nein) zu `anschauung` (viel/etwas/wenig).

Auch **Antworten aus einer Pipe** funktionieren (eine Antwort je Zeile, leere Zeile = Standard); sie werden zur Kontrolle ausgegeben, und die Abschlussfrage braucht ein „ja“ oder `--yes`.

### Beispiel: „Spieltheorie“

```json
{
  "name": "Spieltheorie",
  "id": "spieltheorie-neu",
  "untertitel": "Wie Entscheidungen aufeinander treffen",
  "thema": "Wie Akteure entscheiden, wenn das Ergebnis vom Verhalten der anderen abhängt: Dilemmata, Gleichgewichte, Kooperation.",
  "zielgruppe": "laien",
  "sprache": "de",
  "anrede": "du",
  "geschichte": "ja",
  "groesse": "mittel",
  "reisenamen": ["Grundmodelle", "Wann kooperieren Egoisten?", "Eine kurze Geschichte der Spieltheorie"],
  "skin": "halle",
  "skinWahl": true,
  "anschauung": "zentral",
  "heikel": ["politik"],
  "quellen": ["offen"],
  "urheber": "Karl Hosang",
  "lizenz": "cc-by-4.0",
  "impressumUrl": ""
}
```

Zulässige Werte: `zielgruppe` laien | studierende | fachleute | gemischt; `anrede` du | Sie; `geschichte` ja | agent | nein; `groesse` kompakt | mittel | umfassend | agent; `anschauung` zentral | viel | etwas | wenig; `heikel` Liste aus gesundheit, politik, religion, gewalt (leer = keine);
`quellen` Liste aus offen, eigene, domain (bei domain zusätzlich `materialHost`, https-Adresse); `lizenz` cc-by-4.0 | cc-by-sa-4.0 | cc0-1.0; `skin` ein Ordner unter `themes/`.

## Ohne Werkzeuge

Kann die KI keine Befehle ausführen (reiner Chat) und ist auch `onboarding.html` keine Option, entstehen die Dateien von Hand (die KI liefert sie als Codeblöcke mit Zielpfad). Ordner `packs/<id>/` mit:

1. **`pack.json`**: Pflicht `id` (wie der Ordner), `title`, `tagline`, `lang`; empfohlen `eyebrow`, `defaultSkin` (`halle`), `vocab` (Wortschatz, Muster: `packs/_vorlage/pack.json`), `limits` `{ "min": 11, "max": 28, "visualShare": 0.35 }`, `requireVisualPlan: true`, `footer`, `license` (zum Beispiel `Inhalte: CC BY 4.0. Code: MIT (Museum Studio).`), `credits`.
2. **`plan.json`**: zuerst leer `{ "journeys": [], "stations": [], "orders": {} }`; nach der Freigabe mit Reisen (`{id,typ,name}`), Stationen (`{id,title,kind,journeys,why,visual}`) und `orders` gefüllt (`docs/AGENTEN.md`, Schritt 1, 2 und 2b).
3. **`journeys.js`**: Reisen mit Name, Kurzname, Tagline, Intro, Outro, Farben, Icon (Muster: `packs/_vorlage/journeys.js`).
4. **`stationen/<reise-id>.js`**: Stationstexte (Schema: `docs/INHALT-SCHREIBEN.md`, Muster: `packs/_vorlage/stationen/`).
5. **`BRIEFING.md`** (der Auftrag) und **`ARBEITSSTAND.md`** (Annahmen, Fortschritt).

Danach prüft jemand mit Node: `node tools/check-pack.mjs <id>` und baut mit `node tools/build.mjs <id> --skins=all`.

## Wie Agenten den Auftrag lesen

`docs/AGENTEN.md`, Schritt 0, verweist auf die Auftragsdatei: Gibt es `packs/<id>/BRIEFING.md`, **ist das der Auftrag**. Der Agent stellt die Rahmenfragen nicht erneut, entscheidet Reisen und Stationen fachlich, zeigt den Plan zur Freigabe und arbeitet ab Schritt 1. Was als „Standardwert“ markiert ist oder fehlt, trägt er als Annahme in `ARBEITSSTAND.md` ein.
Den Dialog für Menschen ohne Terminal beschreibt `AGENTS.md` (mit dünnen Zeigerdateien `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/museum-studio.mdc`).

## Bekannte Grenzen

- Nicht-deutsche Inhalte: Die festen Oberflächentexte der Engine bleiben deutsch.
- Die Hilfenummern im Fuß (Telefonseelsorge) gelten für Deutschland.
- `onboarding.html` kann die Vergabe einer ID nicht prüfen (kein Zugriff auf den Ordner); das Terminal-Werkzeug tut es und überschreibt nie etwas.
