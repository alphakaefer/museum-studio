# Einrichtung (Onboarding)

Beim Installieren stellt `npm run setup` (oder `node tools/onboarding.mjs`) ein paar kurze Fragen zu Thema, Umfang und Rahmen eines neuen Museums.
Daraus entsteht ein **startbereites Paket** unter `packs/<id>/` und ein **Auftrag für KI-Agenten** (`BRIEFING.md`). Nur Node.js ab 18 nötig, keine Abhängigkeiten.

```bash
npm run doctor     # prüft Node, Git, Playwright/Chromium und erklärt, was fehlt (und dass es meist ohne geht)
npm run setup      # Einrichtung; ruft doctor am Anfang selbst auf
```

Jede Frage hat eine Erklärung und einen Standardwert in eckigen Klammern (**Enter übernimmt ihn**). Falsche Eingaben werden freundlich erklärt und neu erfragt.
Am Ende steht eine Zusammenfassung: **J** (anlegen), **N** (abbrechen), **W** (alle Fragen nochmal, deine Antworten als Vorgabe).
Geschrieben wird erst nach der Bestätigung und in einem Zug: Strg+C oder ein Abbruch hinterlässt nie ein halbes Paket, und ein bestehendes Paket wird **nie** überschrieben.

## Was entsteht

| Datei in `packs/<id>/` | Inhalt |
|---|---|
| `pack.json` | ausgefüllt: `title`, `eyebrow`, `tagline`, `lang`, `defaultSkin`, `limits` (mit `visualShare`), `requireVisualPlan`, `footer`, `license`, `credits` (und `author`, falls angegeben) |
| `plan.json`, `journeys.js`, `stationen/*.js` | Gerüst von `tools/new-pack.mjs` mit der gewählten Reisezahl, den historischen Reisen und Stationsrümpfen (alles Weitere ist `TODO`) |
| `BRIEFING.md` | lesbarer Auftrag: Thema, Zielgruppe, Ton, Umfang, Reisevorschläge, Sorgfaltsregeln, Quellen, Look, Lizenz, Checkliste „Was der Agent liefern soll“ |
| `BRIEFING.json` | derselbe Auftrag maschinenlesbar (alle Antworten, dazu abgeleitete Werte) |
| `ARBEITSSTAND.md` | vorbefüllt; alles, was nicht ausdrücklich der Auftraggeber entschieden hat, steht als **Annahme** mit „Bestätigt: offen“ |

Am Ende druckt das Skript „Nächste Schritte“: einen fertigen Prompt zum Kopieren für Claude oder andere KI-Agenten sowie die Befehle für Prüfung und Bau.
Die Prüfung (`node tools/check-pack.mjs <id>`) meldet danach nur die gewollten `TODO`-Platzhalter, keine Strukturfehler.

## Die Fragen und ihre Wirkung

| Nr. | Frage | Feld in `BRIEFING.json` | Wirkung |
|---|---|---|---|
| 1 | **Museumsname** (Richtwert höchstens 24 Zeichen; länger gibt eine Warnung) | `name` | `pack.json` `title`; die Prüfung warnt ab 30 Zeichen |
| 2 | **Paket-ID**, abgeleitet aus dem Namen (a–z, 0–9, Bindestrich; nicht vergeben) | `id` | Ordner `packs/<id>/`, `pack.json` `id`; vergeben heißt: neue ID wählen |
| 3 | **Untertitel oder Leitfrage** | `untertitel` | `pack.json` `tagline` |
| 4 | **Thema** in ein bis zwei Sätzen | `thema` | Auftrag im Briefing; `eyebrow` (kurzer erster Satz, sonst „Ein vernetztes Museum“) |
| 5 | **Zielgruppe** (Laien, Studierende, Fachleute, gemischt) | `zielgruppe` | Tonregeln im Briefing |
| 6 | **Sprache der Inhalte** und **Anrede** (du/Sie) | `sprache`, `anrede` | `pack.json` `lang`; Anrede im Briefing und in den Fußtexten. Deutsch ist vollständig unterstützt; bei anderen Sprachen werden Code und Inhalte angenommen, die festen Oberflächentexte der Engine bleiben aber deutsch (Hinweis im Briefing, Wortschatz `vocab` muss der Agent übersetzen) |
| 7 | **Umfang**: Reisen (3 bis 16, Standard 6) und Stationen je Reise (11 bis 28, Standard 14) | `reisen`, `stationenJeReise` | Zahl der Reisen im Gerüst; `limits.max` = Stationen je Reise + 6 (höchstens 28), `limits.min` = 11. Angezeigt wird eine Schätzung eindeutiger Stationen (Mitgliedschaften mal 0,8) und ein Aufwandshinweis; mehr als rund 220 eindeutige werden abgelehnt (Richtwert 200) |
| 8 | **Historische Reisen** (0 bis 3, weniger als Reisen) | `historisch` | die letzten Reisen werden `typ:'historisch'` und erscheinen im **Zeitstrahl** (Stationen mit `year`/`yearLabel`, chronologisch) |
| 9 | **Reisenamen oder Themenideen** (optional, mit Komma, bei Kommas im Namen mit Semikolon) | `reisenamen` | Arbeitsnamen in `plan.json` und `journeys.js`; im Briefing als Vorschläge; leer heißt: der Agent macht Vorschläge |
| 10 | **Standard-Look** (Liste der Skins aus `themes/` mit je einem Satz aus `theme.json`) und **Umschaltung für Besucher** | `skin`, `skinWahl` | `pack.json` `defaultSkin`; Baubefehl `--skins=all` (Umschaltung) oder `--skins=<skin>` |
| 11 | **Wie wichtig ist Anschauung?** zentral (≈ 50 % der Stationen mit Abbildung oder Exponat), viel (≈ 35 %, Standard), etwas (≈ 20 %), wenig (≈ 10 %). Abstrakte Themen (Mathematik, Physik, Ökonomie) vertragen mehr | `anschauung` | `pack.json` `limits.visualShare` (0,5 / 0,35 / 0,2 / 0,1) und `requireVisualPlan: true`; im Briefing und in der Prüfliste steht die **konkrete Mindestzahl** (Anteil mal geschätzte eindeutige Stationen), ebenso in der Zusammenfassung; jede Station braucht in `plan.json` ein Feld `visual` |
| 12 | **Heikle Themen** (Gesundheit, Politik/Weltanschauung, Religion, Gewalt/Trauma; Mehrfachauswahl oder keine) | `heikel` | erzeugt den Text in `pack.json` `footer` (bei Gesundheit/Gewalt zusätzlich eine Hilfe-Spalte mit Telefonseelsorge, Deutschland) und **Sorgfaltsregeln** im Briefing |
| 13 | **Quellenregeln** (offene Quellen, eigene Texte des Auftraggebers, eigene Domain für Weiterlesen-Links; Mehrfachauswahl) | `quellen`, `materialHost` | Quellenabschnitt im Briefing; bei „Domain“ die Nachfrage nach der Adresse, die als `MATERIAL_HOST` in den Prüfbefehl kommt |
| 14 | **Urheber/Credits**, **Lizenz** (CC BY 4.0, CC BY-SA 4.0, alle Rechte vorbehalten, andere) und optional **Impressum/Datenschutz-URL** | `urheber`, `lizenz`, `lizenzText`, `impressumUrl` | `pack.json` `credits`, `author`, `license`; der Link steht als Fußspalte „Rechtliches“ |

Alle Standardwerte, die du nicht ausdrücklich gewählt hast, stehen in `BRIEFING.json` unter `standardUebernommen` und in `ARBEITSSTAND.md` als Annahme.

**Zum Gerüst.** `new-pack` legt ein gleichmäßiges Fenstermuster an (jede Reise hat die gewählte Stationszahl, benachbarte Reisen kreuzen sich, ab 6 Reisen kreuzt jede Reise vier andere).
Die Zahl der Rümpfe ist daher nicht die Zielzahl; das Briefing nennt die Zielzahl, und der Agent ergänzt oder streicht im Plan.

## Nichtinteraktiv

```bash
node tools/onboarding.mjs --config=meine-antworten.json     # keine Fragen, keine Abschlussfrage
node tools/onboarding.mjs --defaults                        # alles Standard (Name „Mein Museum“)
node tools/onboarding.mjs --config=datei.json --dry-run     # nur zeigen, nichts schreiben
node tools/onboarding.mjs --yes                             # Fragen ja, Abschlussfrage nein
```

Die Konfiguration hat **dieselben Felder wie `BRIEFING.json`**; man kann eine vorhandene `BRIEFING.json` mit anderer `id` direkt wieder einspeisen.
Fehlende Felder bekommen den Standardwert (nur `name` ist Pflicht, bei `--defaults` nicht); unbekannte Felder, Zahlen außerhalb des Bereichs oder eine vergebene `id` werden mit Fehlertext und Exit-Code 2 abgelehnt.
Ohne `id` wird sie aus dem Namen abgeleitet (bei Kollision mit Zähler, zum Beispiel `spieltheorie-2`).

Auch **Antworten aus einer Pipe** funktionieren (eine Antwort je Zeile, leere Zeile = Standard):
`printf 'Quantenwelt\n\nWas ist wirklich?\n…' | node tools/onboarding.mjs`. Die Antworten werden zur Kontrolle mit ausgegeben; fehlende am Ende sind Standard,
die Abschlussfrage braucht ein ausdrückliches „ja“ (oder `--yes`), sonst wird nichts angelegt.

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
  "reisen": 3,
  "stationenJeReise": 13,
  "historisch": 1,
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

Zulässige Werte: `zielgruppe` laien | studierende | fachleute | gemischt; `anrede` du | Sie; `anschauung` zentral | viel | etwas | wenig (das frühere Feld `exponate` ja | spaeter | nein wird weiter gelesen und als viel | etwas | wenig umgesetzt, mit Hinweis); `heikel` Liste aus gesundheit, politik, religion, gewalt (leer = keine);
`quellen` Liste aus offen, eigene, domain (bei domain zusätzlich `materialHost`, https-Adresse); `lizenz` cc-by-4.0 | cc-by-sa-4.0 | alle-rechte | andere (bei andere zusätzlich `lizenzText`); `skin` ein Ordner unter `themes/`.

## Wie Agenten den Auftrag lesen

`docs/AGENTEN.md`, Schritt 0, verweist auf die Auftragsdatei: Gibt es `packs/<id>/BRIEFING.md` (und `BRIEFING.json`), **ist das der Auftrag**.
Der Agent stellt die Rahmenfragen nicht erneut, sondern arbeitet ab Schritt 1 ab. Was im Briefing fehlt oder als „Standardwert“ markiert ist, trägt er als Annahme in `ARBEITSSTAND.md` ein (die wichtigsten sind schon vorbereitet).
`BRIEFING.json` ist für Werkzeuge gedacht (zum Beispiel Zahlen für Prüfungen oder eine Vorbelegung in einem anderen Tool); `BRIEFING.md` ist die Fassung für Menschen und Agenten, mit der Checkliste „Was der Agent liefern soll“.

Der Prompt, den das Onboarding ausgibt, lautet sinngemäß: „Lies `docs/AGENTEN.md` und `packs/<id>/BRIEFING.md` und richte das Paket nach der Anleitung ein …“.

## Bekannte Grenzen

- Nicht-deutsche Inhalte: Die festen Oberflächentexte der Engine bleiben deutsch.
- Die Hilfenummern im Fuß (Telefonseelsorge) gelten für Deutschland; für andere Länder steht ein allgemeiner Hinweis, den man anpassen muss.
- Die Schätzung eindeutiger Stationen (Mitgliedschaften mal 0,8) ist ein Faustwert; echte Kreuzungen entscheiden.
- Das Gerüst ist ein Muster, keine inhaltliche Planung. Die Stationsrümpfe in `plan.json` tragen ein `visual`-Platzhalterfeld mit `TODO`; die Prüfung meldet es, bis der Agent es durch eine Entscheidung ersetzt hat.
