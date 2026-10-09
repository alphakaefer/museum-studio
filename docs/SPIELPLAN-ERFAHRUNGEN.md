# Spielplan: Erfahrungen aus dem Prototyp

Was beim Bau des Prototyps nach `docs/spielplan-standard.md` (Format `spielplan/0`) aufgefallen ist: was trug, was erfunden werden musste, was sich ändern sollte.
Jeder Abschnitt gehört der Umsetzung, die ihn geschrieben hat; angehängt wird, fremde Abschnitte bleiben unverändert. Einzelne Entscheidungen mit Stelle, Lücke, Auslegung und Begründung
stehen in `docs/spielplan-auslegung.md`, die Befunde zum Standard dort in der Tabelle „Befunde zum Standard“ (B1 bis B19).

## Kern: Regelrechnung, Brücke, Adapter, Prüfung, YAML-Leser, Tests

*Dateien:* `engine/js/spielplan.js` (1668 Zeilen), `engine/js/spielplan-adapter.js` (451, vom Museum nicht geladen), `tools/yaml-lite.mjs` (404), `tools/check-spielplan.mjs` (95),
`tools/spielplan-test.mjs` (1926), `docs/spielplan-beispiel-kaffee.yaml` (Anhang des Standards, wörtlich), `docs/spielplan-konformitaet.json` (22 Fälle für eine zweite Umsetzung), `docs/spielplan-auslegung.md`.

### Was geht
- `Spielplan.spielstand(plan, ereignisse, jetzt)` ist eine reine Funktion. Gerechnet wird nicht der Zustand, sondern für jede Stufe jeder Einheit und jede Freischaltung der **Zeitpunkt**, ab dem sie gilt
  (kleinste und größte Werte über Ereignisse und Regeln, Fixpunkt von oben). Der Spielstand zu einem `jetzt` vergleicht nur Zeitpunkte. So gilt 5.2 ohne Sonderfall, Wartezeiten rechnen auf Stunden,
  und jede Freischaltung hat ihr „seit“, ohne dass etwas außer den Ereignissen gespeichert wird.
- Brücke (`verbinde`) mit lokalem Speicher, Hörern (`freigeschaltet`, `stufe`, `melde`), Merkzettel gegen doppelte Enthüllungen, Datenschutz-Filter, Ausfall des Speichers, zweiter Tab, `postMessage` aus Übungen.
  `nachXapi` übersetzt rein. Die Seite sendet nichts (getestet in Node und in Chromium; der Build kennt den Adapter nicht).
- Prüfung (`pruefe`, `check-spielplan`) mit Erreichbarkeitsrechnung statt bloßer Verweisprüfung: Sie spielt alles durch, was offen ist, und meldet, was nie aufgeht, mit Ursache (Zyklus, Stufe über `bis`, fehlender Takt).
- Adapter xAPI (cmi5-Start, gespeicherte Warteschlange, Nachreichen, Aussondern ungültiger Statements) und SCORM (1.2 und 2004, `completed`, `suspend_data` in drei Formen) gegen Mock-LRS und Attrappen-APIs.

### Zahlen
- **147 Tests**, 15 Sekunden, ohne Abhängigkeiten (`node tools/spielplan-test.mjs`; mit Playwright und Chromium kommen 2 Browser-Tests dazu, sonst werden sie übersprungen).
- Eigenschaftstests mit festem Startwert: 400 Zufallspläne (bis 15 Einheiten, Regeln mit allen Bausteinen, Kurzformen, Eltern als Liste, Rhythmus) gegen ein **zweites, bewusst naives Orakel**, je dreimal
  (jetzt, früherer Zeitpunkt, ohne Wartezeit); dazu: ein Fuzz-Test (1500 Kaffee-Pläne mit 1 bis 4 zufällig verdorbenen Feldern: nichts wirft, nichts hängt), Reihenfolge der Ereignisse, Einheiten und Regeln egal, nichts sinkt oder geht zu (auch mit Ereignissen aus der Zukunft), Fixpunkt stabil, Pausen ändern
  keine Stufe, Doppelte ändern nichts, und **Spielbarkeit**: Wer jeweils der einen Aufgabe folgt, öffnet in endlich vielen Schritten genau das, was durch vollständiges Spielen überhaupt aufgehen kann.
- **Mutationsprobe:** 41 absichtlich eingebaute Fehler (falscher Anteil, vertauschtes min/max, vergessene Verwandlungen, Adapter verwirft bei 401, Hash ignoriert …); alle werden gefangen, nachdem
  sechs Tests nachgebessert wurden (sie hatten zuerst nur ein Drittel der Mutanten im Adapter-Teil gefangen).
- Tempo (Spielplan mit 364 Einheiten und 1900 Ereignissen): Spielstand 5 bis 10 ms, Prüfung 52 ms. Gegenprobe an den echten Daten von `packs/gehirn` (daraus abgeleiteter Plan, 247 Einheiten, nicht im Repo):
  2,6 ms je Spielstand bei 444 Ereignissen, 444 Schritte, bis alles offen und bis Stufe 2 gespielt ist, 12 Freischaltungen.

### Was der Standard trägt, was nicht
- **Trägt:** die sechs Grundsätze, die Stufen, das Gewicht (kritisch, wesentlich, optional) mit der Sammelregel, die Zeit-Bausteine, der Verzicht auf „nicht“. Der letzte Punkt ist die klügste Entscheidung des
  Entwurfs: Weil alle Bedingungen nur wahr werden können, ist der Spielstand eine eindeutige Funktion, und Eigenschaftstests (Reihenfolge, Monotonie, Fixpunkt) lassen sich überhaupt schreiben.
- **Trägt nicht, ohne dass man etwas erfindet:** Kreuzungen und Vererbung (B1), Rundung und Randfälle der Sammelregel (B2, B8), Kurzformen zusammen (B3), Transfer und `geteilt` (B4), alles um die nächste
  Aufgabe (B11), die Wiederherstellung unter SCORM 1.2 (B9). Das sind Stellen, an denen zwei Umsetzungen sonst verschiedene Spielstände ausrechnen würden; die Konformität (Stufe B, „Stufen sind in allen Apps
  dieselben“) steht und fällt damit. Vorschlag: aus `docs/spielplan-auslegung.md` die Einträge A3 bis A6, A9 und A10 in den Standard übernehmen und ein Konformitätsset (Plan, Ereignisse, erwarteter
  Spielstand) als JSON mitliefern; `tools/spielplan-test.mjs` enthält dafür die Vorlage (Kaffee-Beispiel samt Verlauf).
- **Befund aus dem Gegentest:** Der Standard gibt keine Antwort, wie viele Schritte „bis zur nächsten Freischaltung“ ein Spieler als zumutbar empfindet. Im abgeleiteten Plan für das volle Gehirnmuseum
  („zwei Reisen geschafft“ öffnet die nächste Reise) stehen am Anfang „Noch 35 Stationen“ im Eingang. Das ist die ehrliche Rechnung, aber nicht der „Moment“ aus Grundsatz 6. Dramaturgie braucht kleine
  Schleifen (ein Werkzeug nach der ersten Mythos-Karte) neben den großen; das ist Sache des Plans, aber der Standard sagt es nur in 3.3 für das Onboarding.

### Ein Fehler, den erst die Zufallstests fanden
Die Aufgabe „bringt“ und die Sätze der Bedingungen nannten **verborgene** Einheiten beim Namen, sobald die Verborgenheit über eine Reise geerbt war (die Einheit selbst trug `sichtbar` nicht). Gefunden hat
das ein Test, der für jeden Zufallsplan prüft, dass kein Satz den Namen einer verborgenen, gesperrten Einheit enthält. Behoben: Solche Einheiten heißen im Satz „etwas Verborgenes“, im Eingang erscheinen
sie nicht. Das ist Grundsatz 5, an einer Stelle, die der Standard nicht kennt (Sätze entstehen erst bei der Umsetzung).

### YAML ohne Abhängigkeit: praktikabel?
- **Aufwand:** 404 Zeilen (davon rund 30 Kommentar), 28 Tests (Rundlauf mit 300 zufälligen Strukturen als Block-YAML, Flow-YAML und JSON, 16 Fehlerfälle mit Zeilennummer, die Beispiele des Standards).
  Das Kaffee-Beispiel liest er in 0,4 ms. Der Bau war ein Arbeitsgang, die Fehlersuche lag fast nur bei Kommentaren und Anführungszeichen (`#` in Zeichenketten, Apostrophe, Flow über mehrere Zeilen).
- **Urteil:** Praktikabel als **Teilmenge mit klaren Fehlern**, nicht als YAML. Er liest, was die Beispiele brauchen, und lehnt alles andere mit Zeilennummer ab (Anker, Tags, mehrere Dokumente,
  mehrzeilige Zeichenketten ohne `|`/`>`). Wer YAML schreibt, braucht die Prüfung ohnehin. Für Pakete, die Agenten erzeugen, ist **JSON das richtige Lieferformat**: Agenten schreiben es verlässlich, `JSON.parse`
  ist der Leser, und der Build liefert denselben Inhalt als Skript. YAML bleibt ein Autorenformat für kleine, von Hand gepflegte Pläne (wie das Kaffee-Beispiel).
- **Falle im Standard:** In YAML sind `adresse: #/station/kaldi` ein Kommentar und `ja`/`nein` Zeichenketten; das Beispiel in 3.1 ist als YAML falsch (B6).

### Grenzen
- **Zeit ist UTC.** Tage und Takte beginnen für Spieler in Deutschland um 1 oder 2 Uhr (A1). Ein Feld `zeitzone` im Plan fehlt.
- **Ereignisse aus der Zukunft** zählen, verschieben aber Wartezeiten (A13); die Brücke erzeugt sie nicht.
- **Adapter nur gegen Attrappen.** Weder ein echter LRS noch ein echtes Lernsystem ist getestet. cmi5 ist unvollständig (`abandoned`, `waived`, MoveOn, `returnURL`, `masteryScore`), SCORM setzt weder
  `session_time` noch eine Punktzahl. Aus `suspend_data` Form S kommen Stufen und Freischaltungen zurück, nicht Pausen, Verwitterung und Wiederkehr (B9).
- **Kein echtes Mehrspieler- oder Mehr-Apps-Konzept** (Standard 12.1); `wer` ist ein Browser-Profil, nicht eine Person.
- **Stufe 3 und 4 sind im Museum nicht erreichbar** (kein Beleg). Das Museum setzt `stufen.bis: 2`; „gemeistert“ bleibt dort leer (B14).
- **Klassisches Skript heißt: kein `import`.** In einem Paket mit `"type": "module"` (wie diesem Repo) liefert `require()`/`import` von `engine/js/spielplan.js` keine API (`module` gibt es im Modul-Kontext nicht); die Werkzeuge laden es wie ein Browser per `vm` (`ladeKern` in `tools/check-spielplan.mjs`). In einem CommonJS-Kontext liefert `require()` die API (getestet).
- **Orakel und Kern haben denselben Autor.** Die Eigenschaftstests beweisen, dass der Kern die Auslegungen A1 bis A12 widerspruchsfrei umsetzt, nicht, dass diese Auslegungen richtig sind. Dafür braucht es
  eine zweite Umsetzung (etwa im Zwilling oder im Augenspiel) und das Konformitätsset (`docs/spielplan-konformitaet.json`, 22 Fälle; Stufe, Zugang, Takt und Freischaltungen bestätigt ein unabhängig geschriebenes Orakel, `verwittert` und `faellig` nur der Kern).

## Gehirnmuseum: die kuratierte Schicht (Gestaltung)

*Dateien:* `packs/gehirn/spielplan-kern.yaml` (rund 990 Zeilen, gut ein Zehntel Kommentar), `docs/spielplan-gehirn.md` (Konzept, Graphen, Prüfung, Spielzeit, 16 Befunde), Einträge G1 bis G9 in `docs/spielplan-auslegung.md`.

### Was entstanden ist
- 6 Flügel, 16 Reisen mit Etappe, Auftakt und Abschluss (die erste Reise ist das Onboarding), 9 Fähigkeiten mit „Ich kann …“, 17 Werkzeuge (Sorten modell, methode, heuristik, technik), 46 Regeln mit Enthüllung, Rhythmus.
  238 der 270 Einheiten leitet ein Werkzeug aus `plan.json` ab; die Datei hält nur die 32 kuratierten und die Entscheidungen dazwischen.
- Start: 5 Reisen aus 5 Flügeln offen, 11 Reisen und ein Flügel angedeutet gesperrt, eine von 270 Einheiten verborgen. Eine Wartezeit (3 Stunden), nur als Alternative.
- `check-spielplan --streng` meldet für den gemischten Plan 0 Fehler und 0 Warnungen.

### Zahlen (Rechnung mit dem Kern und Zeitannahmen, keine Messung mit Menschen)
- Erster Moment nach etwa 3 Minuten, vier Momente (zwei Werkzeuge, zwei Reisen) nach 12 bis 14 Minuten, alle in der ersten Reise. Die erste Fähigkeit nach etwa 46, der erste Stempel nach etwa 53 Minuten.
- Der Aufgabe folgend ist alles Gesperrte nach etwa 2 Stunden offen (29 Freischaltungen); Reise für Reise sind alle 16 Reisen nach etwa 6,5 Stunden auf Stufe 2; alles auf Stufe 2 braucht etwa 11,6 Stunden.
- Zwei Wege je Ziel: alle 11 gesperrten Ziele haben zwei disjunkte Wege; bei den beiden Endgame-Reisen teilen zwei der drei Wege Kreuzungsstationen („Golgi und Cajal“, „H. M.“).

### Was der Standard trägt
Die Regelrechnung ist so eindeutig, dass sich ein ganzer Plan durchspielen und auf Engpässe prüfen lässt (Verbieten einer Einheit und Neurechnen genügt). Die sechs Grundsätze ließen sich einhalten; „Gesperrtes ist angedeutet“ und
„Der Moment zählt“ haben im Plan einen klaren Ort (`bedingung`, `enthuellung`). Die Sammelregel mit Gewicht trägt, solange man mit den Kreuzungen lebt.

### Was nicht trägt (Auswahl; vollständig in `docs/spielplan-gehirn.md`, Abschnitt 14)
- **Die Aufgabe springt** (Befund 3): Wer ihr folgt, wird nach vier Schlüsseln quer durch die Reisen geführt, auch zur letzten Station einer Reise. Der Abstand zur Regel ist das einzige Maß; „Nähe“ fehlt.
- **`bedingung` formuliert alle Wege** (Befund 4): Bei drei Wegen entsteht ein Satz mit 40 Wörtern; auf einer grauen Karte unlesbar. „Zwei unabhängige Wege“ und „Bedingung als Satz“ widersprechen sich.
- **Die Schlüssel sind nicht sparsam** (Befund 8): Zwei Wege je Ziel heißt 43 von 205 Stationen als Schlüssel. Der Spielstand sagt nicht je Einheit, was sie öffnet (`schluessel_fuer` fehlt).
- **Gewicht je Einheit koppelt Reisen** (Befund 12), und die Prüfung kennt keinen Engpass (Befund 13). Beide Endgame-Reisen haben deshalb ein Paar von Wegen, das etwas teilt.
- **Ein Werkzeug braucht einen Einsatzort** (Befund 7): Der Kern hält jedes Werkzeug für aktionsfähig. Vier Einsatzorte sind erfunden, damit keine Aufgabe unerfüllbar ist.
- **Station und Werkzeug sind dieselbe Sache** (Befund 1): 16 von 17 Werkzeugen. Der Standard trennt die Arten mit Überschneidung.

### Grenzen
- **Die Zeiten sind gerechnet.** Spielzeit und Reihenfolge gelten für einen Spieler, der der Aufgabe folgt oder Reise für Reise spielt; echte Besucher tun beides nicht. Ob der erste Moment nach 3 Minuten „reinholt“, zeigt nur ein Test mit Menschen.
- **Die Prüfskripte (Ableitung, Spielverlauf, Engpässe) sind nicht im Repository.** Die Methode steht in Abschnitt 8 von `docs/spielplan-gehirn.md`; `check-spielplan` sollte Engpässe und „zwei Wege“ selbst melden.
- **Oberfläche und Brücke ungetestet.** Dieser Teil liefert Daten und Anforderungen (Abschnitt 13); ob Enthüllung, Schlüssel-Vorschau und Einsatz-Zeile am Ort so ankommen, ist offen.
- **Erzähltexte sind Entwürfe.** 44 Auftakte und Abschlüsse, 46 Enthüllungen, 17 Werkzeugkarten stammen aus Intro, Outro und Stationstexten des Pakets; sie sind nicht gegen Quellen geprüft. Die Texte zu Trauma und Erbe
  gehören vor einer Veröffentlichung fachlich gelesen.
