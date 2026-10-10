# Spielplan im Museum

Der **Spielplan** gibt einem Museum ein Spielgefühl: Reisen und Stationen gehen nach und nach auf, wichtige Dinge kommen nach Abständen wieder, und das Museum schlägt immer genau eine nächste Aufgabe vor.
Er ist **optional**. Ein Paket ohne `packs/<paket>/spielplan.json` verhält sich exakt wie bisher; der Build bindet dann nichts Neues ein.
Die Rechenregeln stehen in `docs/spielplan-auslegung.md`, der Arbeitsstand in `docs/SPIELPLAN-ARBEITSSTAND.md`.

Der Maßstab ist ein Spiel, kein Dashboard. Es gibt deshalb vier Dinge und ausdrücklich **keinen Reiter mit Statistik**:

1. eine **Geschichte**: jede Reise hat einen Auftakt und einen Abschluss,
2. den **Moment des Freischaltens**: etwas geht dort auf, wo du gerade bist,
3. **Rhythmus**: Wiedersehen nach Abständen, ein Takt, Verwitterung statt Serien, die reißen,
4. **Rückmeldung am Ort**: dort, wo du handelst, nicht in einer Übersicht.

## Was Lernende erleben

- **Freischalten.** Manche Reisen, Stationen oder Karten sind am Anfang angedeutet und gehen auf, wenn du etwas geschafft hast. Das Museum sagt dir, was fehlt.
- **Rhythmus.** Gelerntes kann mit der Zeit verwittern und kommt zum Wiedersehen zurück. Eine Pause kostet nichts; es gibt keine Serie, die reißt.
- **Genau eine nächste Aufgabe.** Im Eingang steht ein Vorschlag, nie eine Pflicht und nie eine Liste.
- **Freier Zugang.** Ein Schalter (im Eingang und an jedem Hinweis auf Gesperrtes) öffnet alles und streicht alle Wartezeiten. Gezählt wird weiter. Er lässt sich jederzeit umlegen.
- **Fortschritt** zeigt sich im Reisepass (Stempel, Freischaltungen) und an den Karten selbst, nicht in einer Statistik.

## Datenschutz

Alles bleibt auf dem Gerät. Gespeichert werden nur Kennungen und Zeitpunkte (nie Eingaben) im lokalen Speicher des Browsers unter dem Präfix `gm:sp:`. Die Seite sendet nichts, es gibt keine externen Abrufe.
Ein Gerät, ein Browser: Fortschritt wandert nicht zwischen Geräten.

## Für ein Paket einschalten

Voraussetzung: Plan (`plan.json`) und Stationen stehen. Die Schritte:

```bash
node tools/spielplan-aus-plan.mjs <paket> --auto      # spielbarer Standard: packs/<paket>/spielplan.json
node tools/check-spielplan.mjs <paket> --streng --bericht --wege
node tools/check-pack.mjs <paket>
node tools/build.mjs <paket> --skins=all
```

`--auto` bildet das Paket auf Einheiten ab: Reise = Episode (Auftakt und Abschluss aus Tagline und Text, die erste Reise ist das Onboarding), Station = Inhalt, Mythos-Karte = Quest, Exponat = Erlebnis,
Werkzeug-Reise = Werkzeug, Umsteigestationen und Querthemen = Skill, Reisetypen oder Kartengruppen = Gebiet. Ein Drittel der Reisen ist offen, jede gesperrte Reise hat mindestens zwei Wege, sie zu öffnen.

**Verfeinern** (die kuratierte Schicht, sie überschreibt die Automatik abschnittsweise):

- `packs/<paket>/spielplan-kern.yaml`, Vorlage mit Erläuterungen: `docs/spielplan-vorlage-kern.yaml`. Hier stehen Auftakt und Abschluss im Ton des Museums, Enthüllungstexte, Gewichte (kritisch, wesentlich, optional), `offen: [...]` und die **„Ich kann …“-Sätze**.
- `packs/<paket>/spielplan-zuordnung/*.json`: Zuordnung von Stationen und Karten zu Gebieten und Fähigkeiten.
- Danach `--auto` erneut ausführen; die Ausgabe nennt jede Ersetzung als Hinweis.

**Ich-kann-Sätze nicht erfinden.** Leite sie aus anerkannten Kompetenzbeschreibungen oder den Texten des Auftraggebers ab; sonst weglassen und als Annahme in `ARBEITSSTAND.md` festhalten.

**Freier Zugang als Vorbelegung:** `"spielFrei": true` in `pack.json` legt den Schalter beim ersten Besuch um (das Onboarding setzt das bei der Antwort „frei als Standard“). Wirkt nur mit `spielplan.json`.

## Ausprobieren

- Im Browser bauen und öffnen (`dist/<paket>/index.html`), einmal mit und einmal ohne Freien Zugang.
- **Zeitreise:** `window.__SP_HEUTE` ersetzt die Uhr (Text wie `"2026-11-01T09:00:00Z"`, Zahl oder Funktion), zum Beispiel in der Konsole oder per Test vor dem Laden. Damit siehst du Wiedersehen und Verwitterung, ohne zu warten.
  `window.__SP_VERWEIL` ist ein Faktor für die Lesezeiten (kleiner als 1 verkürzt sie).
- **Zurücksetzen:** im Reisepass das Zurücksetzen des Fortschritts, oder in der Konsole `MUSEUM.spiel.zuruecksetzen()`.
- Die Prüfung `check-spielplan` rechnet durch, was beim Start offen ist und ob etwas nie aufgeht. Das ist Rechnung, keine Messung mit Menschen.
- Tests: `node tools/spielplan-test.mjs`, `node tools/smoke.mjs <paket> --quick`.

## Grenzen

- **Stufe 3 und 4 (Anwendung, Transfer) sind im Museum nicht erreichbar:** Das Museum kann Beleg und Transfer nicht prüfen und rechnet bis Stufe 2 (Grundverständnis).
- **xAPI und SCORM** gibt es nur als Schnittstelle (`engine/js/spielplan-adapter.js`); das Museum lädt sie nicht und sie ist nur gegen Attrappen getestet.
- **Ein Gerät.** Zeiten rechnen in UTC (Tage und Takte beginnen in Deutschland um 1 oder 2 Uhr). Ob die Zeiten für Menschen stimmen, zeigt nur ein Test mit Menschen.

## Hinweise für Themen

**Sprachenlernen.** Wiederholen nach Abständen passt gut: Wiedersehen und Verwitterung tragen den Rhythmus, der Takt bleibt freundlich (nie als Tor). Kurze Einheiten, genau eine nächste Aufgabe, keine Serien.
Für Anfänger lieber wenig Sperren (`offen`) und viele Wege.

**Sensible Themen** (Gesundheit, Psyche, Aufmerksamkeit). Freier Zugang als Standard: niemand soll von dem ausgeschlossen werden, was er gerade sucht. Keine Wartezeiten, den Takt nie als Tor, nichts, was nach Leistung oder Versagen klingt,
keine Zählungen, die Druck machen. Die Fachlichkeit und die Sorgfaltsregeln des Briefings gelten unverändert.

## Fehlersuche

| Beobachtung | Ursache und Abhilfe |
|---|---|
| Museum zeigt nichts vom Spielplan | `packs/<paket>/spielplan.json` fehlt, oder der Build lief vor dem Anlegen; neu bauen. |
| `check-spielplan` meldet eine nie aufgehende Einheit | Wege ergänzen oder die Einheit in `offen` aufnehmen; `--wege` zeigt, was fehlt. |
| Alles ist offen | Freier Zugang ist an (Schalter im Eingang, oder `spielFrei` in `pack.json`). |
| Alles ist nach dem Zurücksetzen wieder gesperrt | gewollt; Zurücksetzen löscht Ereignisse und Merkzettel (`gm:sp:`). |
| Enthüllungstext fehlt | Abschnitt im Kern ergänzen; sonst nimmt die Automatik einen Standardtext. |
| Fortschritt weg | anderer Browser oder Gerät, privates Fenster oder gelöschte Website-Daten; der Speicher ist nur lokal. |
