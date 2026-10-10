# Spielplan: Arbeitsstand

Stand: 9. Oktober 2026, Branch `experiment/spielplan`. Dieses Dokument sagt, was der Spielplan ist, was schon fertig ist, was als Nächstes folgt und wie du weitermachst.
Es wird am Ende jedes Arbeitslaufs aktualisiert; Entscheidungen im Einzelnen stehen in `docs/spielplan-auslegung.md`, Erfahrungen in `docs/SPIELPLAN-ERFAHRUNGEN.md`.

## Ziel

Der **Spielplan** ist eine Mechanik für Freischalten, Rhythmus und Fortschritt in Lernangeboten. In Museum Studio soll er **optional** laufen: Ein Paket mit `packs/<paket>/spielplan.json` bekommt Spielgefühl,
ein Paket ohne diese Datei verhält sich exakt wie bisher. Getestet wird er in zwei neuen Museen (ein Sprachkurs und ein aufmerksamkeitssensibles Thema, siehe `docs/NEUE-TESTTHEMEN.md`).

Der Maßstab ist ein **Spiel, kein Dashboard**. Ein Spielplan im Museum braucht deshalb vier Dinge:
1. eine **Geschichte** (jede Reise hat einen Auftakt und einen Abschluss),
2. den **Moment des Freischaltens** (etwas geht auf, genau dort, wo du gerade handelst),
3. **Rhythmus** (Wiedersehen nach Abständen, ein Takt, Verwitterung statt Serien, die reißen),
4. **Rückmeldung am Ort** (nicht in einem Reiter mit Statistik; der ist ausdrücklich nicht das Ziel).

Für Lernende gilt immer: Es gibt einen **Freien Zugang** (ein Schalter), **Pausen kosten nichts**, und als Vorschlag erscheint **immer nur eine nächste Aufgabe**, nie eine Pflicht.

## Regeln, die immer gelten

- **Ohne `spielplan.json` ändert sich nichts.** Alles Neue hängt an `MUSEUM.data.spielplan`; der Build bindet ohne Spielplan nichts Neues ein (ein Test baut Pakete ohne Spielplan und prüft die Ausgabe).
- **Keine Fachbezüge in `engine/` und `tools/`:** keine Reise-IDs, keine Fachtexte, keine Domain- oder Personennamen. Fachliches gehört in Pakete.
- **Statisch, klassische Skripte, keine Abhängigkeiten, keine externen Abrufe.** Die Seite sendet nichts. Gespeichert wird nur lokal (Präfix `gm:sp:`, jeder Zugriff in `try/catch`).
- **Der Adapter (`engine/js/spielplan-adapter.js`, xAPI und SCORM) wird nie eingebunden.** Er ist eine Schnittstelle für Anwendungen, die ihn selbst laden.
- Deutsch mit Du-Ansprache, barrierefrei, hell und dunkel, alle vier Looks (`themes/`), vom Handy bis zum Desktop.
- **Der Standard bleibt unverändert.** Der Spielplan folgt einem Standard-Entwurf (Format `spielplan/0`), der nicht Teil dieses Repositorys ist. Wo er offen war oder sich widersprach, steht die Entscheidung
  in `docs/spielplan-auslegung.md` (Auslegungen A, Befunde B, Gestaltungsentscheidungen G, Hygiene H); jeder Eintrag sagt in der Zeile „Worum es geht“, welche Stelle des Entwurfs gemeint ist (die Datei `spielplan-standard.md` liegt nicht in diesem Repository).

## Was fertig ist

| Teil | Dateien | Stand |
|---|---|---|
| **Kern:** Regelrechnung als reine Funktion (Stufen, Freischaltungen als Zeitpunkte, Zugang mit Vererbung, Rhythmus, nächste Aufgabe), Brücke mit lokalem Speicher, Übersetzung nach xAPI | `engine/js/spielplan.js` | fertig; Museum lädt ihn nur mit Spielplan |
| **Adapter:** xAPI (cmi5-Start, Warteschlange) und SCORM (1.2, 2004) | `engine/js/spielplan-adapter.js` | fertig, nur gegen Attrappen getestet, vom Museum nicht geladen |
| **Prüfung:** Verweise, Formfehler und Erreichbarkeit (spielt alles durch und meldet, was nie aufgeht) | `tools/check-spielplan.mjs`, `Spielplan.pruefe` | fertig |
| **YAML-Leser** für kleine, von Hand geschriebene Pläne (Teilmenge, Fehler mit Zeilennummer) | `tools/yaml-lite.mjs` | fertig; Lieferformat für Pakete ist JSON |
| **Tests:** Regeln, Zufallspläne gegen ein zweites Orakel, xAPI, Brücke, Adapter, Werkzeuge, Build, Browser | `tools/spielplan-test.mjs` | fertig, grün (ein paar Tests werden ohne Browser oder ohne Anbindung übersprungen und als solche gezählt) |
| **Konformitätsset** für eine zweite Umsetzung (22 Fälle) und das **Kaffee-Beispiel** | `docs/spielplan-konformitaet.json`, `docs/spielplan-beispiel-kaffee.yaml` | fertig; das Set wird vom Test erzeugt und auf Aktualität geprüft |
| **Auslegungen und Befunde** | `docs/spielplan-auslegung.md`, `docs/SPIELPLAN-ERFAHRUNGEN.md` | fertig, wächst mit jedem Lauf (nur anhängen) |
| **Hygiene für das öffentliche Repository:** neutrales xAPI-Vokabular (`plan.vokabular`), Tests ohne den Entwurf, Build-Test mit echtem Bau, Kaffee-Beispiel mit eigenen Freitexten | siehe H1 bis H4 in der Auslegung | fertig |

Der Kern kennt die sieben Arten `gebiet`, `inhalt`, `werkzeug`, `quest`, `erlebnis`, `skill`, `episode`, die Stufen 2 bis 4 (Grundverständnis, Anwendung, Transfer), das Gewicht
`kritisch`, `wesentlich`, `optional` (eine Stufe einer Sammlung braucht alle kritischen und von den wesentlichen mindestens zwei Drittel, aufgerundet; optionale sind Nebenquests) und den Zeitbaustein `wartezeit`.

## Was in diesem Lauf folgt

Reihenfolge ungefähr wie unten; jede Zeile ist ein eigener Arbeitsschritt, der mit kleinen, gezielten Commits endet.

1. **Anbindung** an das Museum: `engine/js/spiel.js` (`MUSEUM.spiel` mit `aktiv`, `stand()`, `melde()`, `bei()`, `zugang()`, `naechsteAufgabe()`, `frei`, `setFrei()`), `engine/css/spiel.css`, Einbindung im Build
   nur mit `spielplan.json` (`data/spielplan.js`, `js/spielplan.js`, `js/spiel.js`, `css/spiel.css`), Ereignisse aus der Oberfläche (Station geöffnet, Mythos-Karte, Exponat, Reise).
2. **Generator:** `tools/spielplan-aus-plan.mjs` leitet aus dem Stationsplan (`plan.json`) einen Spielplan ab. Zuordnung im Museum: Reise = `episode` (Auftakt und Abschluss aus Tagline und Text, `etappe` gesetzt,
   die erste Reise ist das Onboarding), Station = `inhalt`, Mythos-Karte = `quest`, Exponat = `erlebnis`, Werkzeug-Reise (`tool: true`) = `werkzeug`, Umsteigestationen und Querthemen = `skill` mit „Ich kann …“,
   Reisetypen oder Kartengruppen = `gebiet`, Reisepass-Stempel = Episode geschafft. Das Beispielpaket `beispiel-gehirn` ist das erste Paket mit Spielplan.
3. **Ansichten:** der Moment des Freischaltens am Ort, Eingang mit der einen nächsten Aufgabe, Freier Zugang als Schalter, Reisepass mit Freischaltungen und Stempeln, Netzplan mit angedeutet Gesperrtem und Stufenzeichen,
   Zeitstrahl. Keine eigene Statistik-Ansicht.
4. **Onboarding:** Wenn jemand ein neues Museum baut, soll die Frage nach dem Spielplan dazugehören (`tools/onboarding-fragen.json`, `docs/ONBOARDING.md`), samt Vorschlag und Folgen in einfacher Sprache.
5. **Dokumentation:** Schritt „Spielplan“ in `docs/AGENTEN.md`, Hinweise für die beiden Testthemen, Abschnitte in den Auslegungen und Erfahrungen.
6. **Prüfung:** Spielsimulation im Browser (Playwright), alle vier Looks in hell und dunkel, Handy bis Desktop, Tastatur und Screenreader, danach unabhängige Durchsicht gegen die Grundsätze und das Spielgefühl.

Offen ist, ob „Freischalten“ für Sprachenlernen und für ein sensibles Thema überhaupt gewollt ist oder ob Wiederholen ohne Sperren genügt. Dafür gibt es den Freien Zugang; ob die beiden Testthemen ihn
als Standard brauchen, zeigt der Test.

## Bekannte Grenzen

- **Zeit ist UTC.** Tage und Takte beginnen für Lernende in Deutschland um 1 oder 2 Uhr (A1). Ein Feld `zeitzone` fehlt.
- **Stufen 3 und 4 sind im Museum nicht erreichbar:** Das Museum kann Beleg und Transfer nicht prüfen und setzt `stufen.bis: 2` (B14).
- **Der Adapter ist nur gegen Attrappen getestet** (kein echtes Lernsystem, kein echter LRS).
- **Zeiten sind gerechnet, nicht gemessen.** Ob der erste Moment schnell genug kommt, zeigt nur ein Test mit Menschen.
- **Aus SCORM-`suspend_data` kommen Stufen und Freischaltungen zurück, nicht Pausen und Wiederkehr** (A23).

## So machst du weiter

**Von Hand**
```
git checkout experiment/spielplan
node tools/spielplan-test.mjs                        # Kern, Adapter, Werkzeuge, Build; --kurz für weniger Zufallsläufe
node tools/check-spielplan.mjs docs/spielplan-beispiel-kaffee.yaml     # Prüfung einer Datei oder eines Pakets
node tools/spielplan-test.mjs --schreibe-konformitaet                 # nur nach einer Änderung am Kaffee-Beispiel: Konformitätsset neu erzeugen
node tools/check-pack.mjs <paket>                    # Paketprüfung wie bisher
node tools/smoke.mjs <paket> --quick                 # Rauchtest im Browser
node tools/build.mjs <paket> --skins=all --out=dist/<name>             # bauen, Ergebnis: dist/<name>/index.html
```
- Für die Browser-Tests braucht es Playwright und Chromium (`PLAYWRIGHT_MODULE_DIR`, `CHROMIUM_PATH`); ohne sie werden sie übersprungen.
- Liegt dir der Standard-Entwurf vor, setze `SPIELPLAN_STANDARD=<Pfad>`: Dann prüft ein Test, dass der YAML-Leser seine Beispiele versteht. Lege den Entwurf nie ins Repository (`.gitignore` schützt `docs/spielplan-standard.md`).
- Ein Spielplan gehört nach `packs/<paket>/spielplan.json` (JSON). Den Rest erzeugt der Build.

**Mit KI-Agenten**
- Lies zuerst den Kopfkommentar von `engine/js/spielplan.js` (API) und `docs/spielplan-auslegung.md` (alle Entscheidungen). Die Abschnitte A1 bis A13 sind die Rechenregeln, auf die jede Umsetzung gleich antworten muss.
- Committe gezielt (`git add <Datei>`, nie `git add -A`); an gemeinsamen Dateien (`engine/js/*.js`, `engine/css/*.css`, `tools/build.mjs`, `docs/*.md`) nur kleine Änderungen, nie komplett neu schreiben.
- Neue Entscheidungen, Erfindungen und Vorschläge an den Standard kommen als **neuer Abschnitt** ans Ende von `docs/spielplan-auslegung.md` und `docs/SPIELPLAN-ERFAHRUNGEN.md`; bestehende Einträge anderer bleiben unverändert.
- Schreibe in öffentliche Dokumente eigene Beschreibungen, keine wörtlichen Passagen aus dem Standard-Entwurf; verweise nicht mit Abschnittsnummern, sondern sage kurz, worum es inhaltlich geht.

## Nachtrag Onboarding und Doku (10. Oktober 2026)

Fertig: Fragen Spielplan und Zugang (Terminal, `onboarding.html`, Briefing, Test grün), `docs/SPIELPLAN.md`, Schritt 6b in `docs/AGENTEN.md`, Abschnitt 9b in `docs/ARCHITEKTUR.md`, README, `docs/NEUE-TESTTHEMEN.md`, beide Beispielkonfigurationen (Probelauf grün).
Offen: `docs/ONBOARDING.md` (Fragenliste um Spielplan und Zugang ergänzen), `docs/DESIGNER.md` (Spielplan-Klassen in `spiel.css`), `AGENTS.md` (ein Verweis). Die Abschnitte zu Reisepass und Ansichten in `docs/SPIELPLAN.md` gelten, sobald die Ansichten committet sind.

## Ansichten (Anbindung B), vorläufiger Stand

Fertig: Reisepass (`engine/js/passport.js`, Abschnitt `buildSpiel`): die eine nächste Aufgabe, „Was aufgegangen ist“ mit der Enthüllung als Satz, „Wartet auf ein Wiedersehen“ ohne Strafton, kurzer Rückblick des Takts, Schalter Freier Zugang; weitere Vorschläge nur aufgeklappt. Netzplan (`map.js`): gesperrte Haltepunkte grau und gestrichelt, Bedingung im Vorlesetext und Titel, Stufenzeichen (kleine Striche), verborgene Knoten ausgeblendet. Zeitstrahl (`timeline.js`): Gesperrtes abgedunkelt mit Satz zur Bedingung (Liste, senkrechte Ansicht, Vorschau). Stile in `engine/css/spiel-ansichten.css`, nur mit Spielplan eingebunden.
Lücken: Stufenzeichen und Gesperrt-Zustand fehlen in der Listenansicht des Netzplans; verborgene Knoten bleiben in der Tab-Reihenfolge des Gesamtnetzes (Fokus ins Leere) und die Linien laufen weiter; Reisepass-Stempel zeigen keine eigene Spielplan-Kennzeichnung; Screenshots nur für Skin „halle“ geprüft (hell/dunkel, 390 und 1280 Pixel), Kabinett, Ma und Quelltext nicht einzeln angesehen; Reisen-Knoten gesperrter Reisen im Linienplan ungeprüft.

## Abnahme (10. Oktober 2026)

**Fertig und geprüft:** Regression (spielplan-test 149 von 149, check-pack für alle drei Pakete, check-spielplan beispiel-gehirn, smoke beispiel-gehirn --quick, spiel-test 22 von 22). Pakete ohne `spielplan.json` (spieltheorie, _vorlage) verhalten sich wie auf Commit 29441df: `tools/spiel-vergleich.mjs` findet in elf Zuständen keinen Unterschied. Der Abnahme-Spieler `tools/spielplan-sim.mjs` läuft grün auf beispiel-gehirn (80 Schritte bis alles offen) und auf spieltheorie mit `--auto` (31 Schritte).
**Vorläufig:** Darstellung nur stichprobenartig angesehen (Skins halle und kabinett, hell und dunkel, 1280 und 390 Pixel; Eingang, Enthüllung, Reisepass, Netzplan). Skins editorial und gazette nicht einzeln angesehen (spiel-test prüft Kontrast und Überlauf in allen Skins nur ohne `--schnell`).
**Offen:** `docs/ONBOARDING.md`, `docs/DESIGNER.md`, `AGENTS.md` (siehe Nachtrag oben); die Lücken der Ansichten (Listenansicht des Netzplans, Tab-Reihenfolge verborgener Knoten); ein Test mit echten Lernenden; Zeitzone (A1); Stufen 3 und 4.
**Bekannte Fehler:** keine blockierenden. Die Enthüllungskarte ist nicht blockierend und kann auf dem Handy kurz die Schaltfläche darunter verdecken, bis man Weiter wählt. Nach 60 Tagen Pause gilt jede Einheit als verwittert (gewollt; Stufen bleiben, es erscheint nur der Wiedersehen-Vorschlag).
**Nächste Schritte:** 1. Neue Museen mit der Befehlsfolge aus `docs/NEUE-TESTTHEMEN.md` anlegen, `--auto` und kuratierte Schicht. 2. `node tools/spielplan-sim.mjs --paket=<id>` nach jeder Änderung. 3. Offene Dokumente nachziehen. 4. Zwei bis drei Menschen probespielen lassen.
