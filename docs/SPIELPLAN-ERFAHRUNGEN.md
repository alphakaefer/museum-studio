# Spielplan: Erfahrungen aus dem Prototyp

Was beim Bau des Prototyps nach dem Spielplan-Standard (Format `spielplan/0`, Entwurf, nicht Teil dieses Repositorys) aufgefallen ist: was trug, was erfunden werden musste, was sich ändern sollte.
Den Stand dieser Umsetzung beschreibt `docs/SPIELPLAN-ARBEITSSTAND.md`.
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
- Tempo (Spielplan mit 364 Einheiten und 1900 Ereignissen): Spielstand 5 bis 10 ms, Prüfung 52 ms. Gegenprobe an einem aus den Stationsplänen eines großen Museums abgeleiteten Plan (rund 250 Einheiten, die
  Daten liegen nicht in diesem Repository): wenige Millisekunden je Spielstand bei einigen hundert Ereignissen, ein Spielverlauf bis „alles offen“ und bis Stufe 2 in einigen hundert Schritten.

### Was der Standard trägt, was nicht
- **Trägt:** die sechs Grundsätze, die Stufen, das Gewicht (kritisch, wesentlich, optional) mit der Sammelregel, die Zeit-Bausteine, der Verzicht auf „nicht“. Der letzte Punkt ist die klügste Entscheidung des
  Entwurfs: Weil alle Bedingungen nur wahr werden können, ist der Spielstand eine eindeutige Funktion, und Eigenschaftstests (Reihenfolge, Monotonie, Fixpunkt) lassen sich überhaupt schreiben.
- **Trägt nicht, ohne dass man etwas erfindet:** Kreuzungen und Vererbung (B1), Rundung und Randfälle der Sammelregel (B2, B8), Kurzformen zusammen (B3), Transfer und `geteilt` (B4), alles um die nächste
  Aufgabe (B11), die Wiederherstellung unter SCORM 1.2 (B9). Das sind Stellen, an denen zwei Umsetzungen sonst verschiedene Spielstände ausrechnen würden; die Konformität (Stufe B: dieselben Stufen
  in jeder App) steht und fällt damit. Vorschlag: aus `docs/spielplan-auslegung.md` die Einträge A3 bis A6, A9 und A10 in den Standard übernehmen und ein Konformitätsset (Plan, Ereignisse, erwarteter
  Spielstand) als JSON mitliefern; `tools/spielplan-test.mjs` enthält dafür die Vorlage (Kaffee-Beispiel samt Verlauf).
- **Befund aus dem Gegentest:** Der Standard gibt keine Antwort, wie viele Schritte „bis zur nächsten Freischaltung“ ein Spieler als zumutbar empfindet. In einem aus den Stationsplänen eines großen Museums
  abgeleiteten Plan („zwei Reisen geschafft“ öffnet die nächste Reise) steht am Anfang eine Aufgabe wie „Noch dreißig und mehr Stationen“. Das ist die ehrliche Rechnung, aber nicht der „Moment“ aus Grundsatz 6. Dramaturgie braucht kleine
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
  eine zweite Umsetzung (etwa in einer anderen App oder einem Lernsystem-Plugin) und das Konformitätsset (`docs/spielplan-konformitaet.json`, 22 Fälle; Stufe, Zugang, Takt und Freischaltungen bestätigt ein unabhängig geschriebenes Orakel, `verwittert` und `faellig` nur der Kern).

## Kuratierte Schicht eines großen Museums (Gestaltung, Prototyp)

*Dateien:* keine in diesem Repository. Die Daten des Prototyps (ein handgepflegter Spielplan für ein großes Museum, abgeleitet aus dem Stationsplan und von Hand ergänzt) und das Konzept dazu sind privat.
Hier stehen nur die Erfahrungen, die für jeden Spielplan gelten; die zugehörigen Entscheidungen sind die Einträge G1 bis G9 in `docs/spielplan-auslegung.md`.

### Was entstanden ist
- Gebiete, Reisen mit Etappe, Auftakt und Abschluss (die erste Reise ist das Onboarding), Fähigkeiten mit „Ich kann …“, Werkzeuge (Sorten modell, methode, heuristik, technik), Regeln mit Enthüllung, Rhythmus.
  Der größte Teil der Einheiten ließ sich aus dem Stationsplan ableiten; die Plan-Datei hält nur das Kuratierte und die Entscheidungen dazwischen.
- Beim Start ist ein Teil der Reisen offen (aus verschiedenen Gebieten), der Rest angedeutet gesperrt, fast nichts verborgen. Eine einzige Wartezeit, nur als Alternative (G8).
- `check-spielplan --streng` meldete für den gemischten Plan keine Fehler und keine Warnungen.

### Zeitannahmen (Rechnung mit dem Kern, keine Messung mit Menschen)
- Der erste Moment kam nach wenigen Minuten, mehrere Momente (Werkzeuge, Reisen) nach einer Viertelstunde, alle in der ersten Reise; die erste Fähigkeit und der erste Stempel nach rund einer Stunde.
- Wer der Aufgabe folgt, hatte nach wenigen Stunden alles Gesperrte offen; Reise für Reise alle Reisen auf Stufe 2 nach einem halben Arbeitstag, alles auf Stufe 2 nach rund einem Arbeitstag.
- Zwei Wege je Ziel: Für jedes gesperrte Ziel gab es zwei Wege ohne gemeinsame Einheit; bei den Endgame-Reisen teilten sich zwei der drei Wege Kreuzungsstationen (G3).

### Was der Standard trägt
Die Regelrechnung ist so eindeutig, dass sich ein ganzer Plan durchspielen und auf Engpässe prüfen lässt (Verbieten einer Einheit und Neurechnen genügt). Die sechs Grundsätze ließen sich einhalten; „Gesperrtes ist angedeutet“ und
„Der Moment zählt“ haben im Plan einen klaren Ort (`bedingung`, `enthuellung`). Die Sammelregel mit Gewicht trägt, solange man mit den Kreuzungen lebt.

### Was nicht trägt (Auswahl)
- **Die Aufgabe springt:** Wer ihr folgt, wird nach den ersten Schlüsseln quer durch die Reisen geführt, auch zur letzten Station einer Reise. Der Abstand zur Regel ist das einzige Maß; „Nähe“ fehlt.
- **`bedingung` formuliert alle Wege:** Bei drei Wegen entsteht ein sehr langer Satz; auf einer grauen Karte unlesbar. „Zwei unabhängige Wege“ und „Bedingung als Satz“ widersprechen sich.
- **Die Schlüssel sind nicht sparsam:** Zwei Wege je Ziel heißt, dass ein Fünftel der Stationen als Schlüssel dient. Der Spielstand sagt nicht je Einheit, was sie öffnet (ein Feld `schluessel_fuer` fehlt).
- **Gewicht je Einheit koppelt Reisen**, und die Prüfung kennt keinen Engpass. Beide Endgame-Reisen haben deshalb ein Paar von Wegen, das etwas teilt (G3, G4).
- **Ein Werkzeug braucht einen Einsatzort:** Der Kern hält jedes Werkzeug für aktionsfähig. Wo es keinen natürlichen Ort gab, musste einer erfunden werden, damit keine Aufgabe unerfüllbar ist (G2).
- **Station und Werkzeug sind dieselbe Sache:** Fast alle Werkzeuge waren zugleich der Stoff einer Station. Der Standard trennt die Arten mit Überschneidung (G1).

### Grenzen
- **Die Zeiten sind gerechnet.** Spielzeit und Reihenfolge gelten für einen Spieler, der der Aufgabe folgt oder Reise für Reise spielt; echte Besucher tun beides nicht. Ob der erste Moment nach wenigen Minuten „reinholt“, zeigt nur ein Test mit Menschen.
- **Die Prüfskripte (Ableitung, Spielverlauf, Engpässe) sind nicht im Repository.** Die Methode ist einfach (den Kern als Spieler benutzen, Einheiten verbieten, neu rechnen); `check-spielplan` sollte Engpässe und „zwei Wege“ selbst melden.
- **Oberfläche und Brücke waren ungetestet.** Dieser Teil lieferte Daten und Anforderungen; ob Enthüllung, Schlüssel-Vorschau und Einsatz-Zeile am Ort so ankommen, war offen und ist Sache der Anbindung an das Museum.
- **Erzähltexte sind Entwürfe.** Auftakte, Abschlüsse, Enthüllungen und Werkzeugkarten, die aus Intro, Outro und Stationstexten abgeleitet werden, sind nicht gegen Quellen geprüft. Texte zu heiklen Themen (etwa Gesundheit) gehören vor einer Veröffentlichung fachlich gelesen.

## Basis und Hygiene: der Kern in einem öffentlichen Repository

*Dateien:* dieselben wie im Abschnitt „Kern“, dazu `docs/SPIELPLAN-ARBEITSSTAND.md`; Entscheidungen H1 bis H4 in `docs/spielplan-auslegung.md`.

### Was passiert ist
Der Kern entstand in einem privaten Prototyp und wurde in dieses öffentliche Repository übernommen. Beim Übernehmen waren vier Dinge zu klären, die der Prototyp nie gesehen hatte:
1. **Der Standard-Entwurf ist nicht dabei.** Ein Test las seine YAML-Beispiele und schlug ohne ihn fehl. Jetzt wird er als „übersprungen“ gezählt und ausgegeben (H2). Der Rest der Tests braucht den Entwurf nicht.
2. **Eine feste Domain im Vokabular.** Der Entwurf legt die Adressen der eigenen xAPI-Verben, der Erweiterungen und der Arten unter eine bestimmte Domain; der Kern und das Kaffee-Beispiel trugen sie. Der Kern benutzt jetzt eine neutrale Wurzel (`urn:spielplan:`),
   die der Plan über `vokabular` ersetzen kann (H1). Das ist eine Erfindung über den Standard hinaus; sie ist klein, und ohne sie ließe sich der Kern nicht für jeden Betreiber verwenden.
3. **Ein Stichwort-Test, der an einem Kommentar scheiterte.** „Der Build bindet den Adapter nicht ein“ wurde durch Suchen des Wortes im Quelltext geprüft. Jetzt prüft der Test den Code ohne Kommentare und baut echte Pakete (H3).
4. **Das Beispiel war der Text des Entwurfs.** Das Kaffee-Beispiel war das Beispiel am Ende des Entwurfs mit getauschter Adresse. Das Gerüst (Ids, Arten, Regeln, Rhythmus) bleibt, die Freitexte sind neu formuliert (H4).

### Was sich daraus für den Standard ergibt
- Die Vokabular-Wurzel gehört in den Plan (`vokabular`), mit neutraler Vorgabe; Beispiele sollten Beispieladressen benutzen (H1, B18).
- Ein Konformitätsset, das ohne den Entwurf läuft (Plan, Ereignisse, erwarteter Spielstand als JSON), ist für öffentliche Umsetzungen wichtiger als die Beispiele im Text (`docs/spielplan-konformitaet.json`).
- Tests, die etwas nicht prüfen können, sollen es sagen. Der Läufer zählt Übersprungenes jetzt eigens, statt es als bestanden zu verbuchen.

### Wie die Bereinigung geprüft wurde
- Suche nach den Namen und Begriffen des privaten Prototyps in `engine/`, `tools/` und den Spielplan-Dokumenten (Treffer wurden entfernt oder durch Kaffee-Beispiel und neutrale Namen ersetzt).
- Wortvergleich der Dokumente mit dem Entwurf (Reihen gleicher Wörter, ab sechs Wörtern in Folge): zitierte Sätze wurden durch eigene Formulierungen mit Abschnittsnummer ersetzt. Übrig sind Feldnamen und Gerüst des Kaffee-Beispiels (Ids, Namen der Einheiten); dessen Freitexte sind neu geschrieben (H4). Das Konformitätsset wurde danach neu erzeugt; die Tests laufen mit und ohne den Entwurf.
