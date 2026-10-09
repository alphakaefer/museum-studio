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


## Generator: ein Spielplan mit einem Befehl, danach von Hand verfeinert

*Dateien:* `tools/spielplan-aus-plan.mjs` (663 Zeilen), `tools/check-spielplan.mjs` (um Bericht, Engpass-Analyse und Spielzeit erweitert, 271), `tools/spielplan-generator-test.mjs` (22 Tests, 2 Sekunden), `docs/spielplan-vorlage-kern.yaml` (die kommentierte Vorlage),
`packs/beispiel-gehirn/spielplan-kern.yaml` (226 Zeilen), `packs/beispiel-gehirn/spielplan-zuordnung/*.json` (drei Dateien, 60 Einträge), `packs/beispiel-gehirn/spielplan.json` (erzeugt). Entscheidungen: E1 bis E13 und BE1 bis BE6 in `docs/spielplan-auslegung.md`.

### Was geht
- `node tools/spielplan-aus-plan.mjs <paket> --auto` erzeugt in einem Zehntel bis einer halben Sekunde einen **spielbaren** Standard-Spielplan für jedes Paket, auch für eines mit einer einzigen Reise: Gebiete, Etappen, ein Drittel der Reisen offen, mindestens zwei Wege je gesperrter Reise,
  Enthüllungen und Auftakt/Abschluss aus den Paketdaten, Rhythmus. Die Ausgabe ist ohne Warnung und besteht `check-spielplan --streng`; ein Paket ohne Mythos-Karte in der ersten Reise bekommt eine einzige, erklärte Warnung (BE1).
- Danach genügt es, die Vorlage zu kopieren und nur zu ändern, was anders sein soll; der Generator nennt jede Ersetzung als Hinweis. Ohne `--auto` entsteht nur das Kuratierte (so entstand `spielplan.json` des Beispielpakets).
- `check-spielplan --bericht --wege` rechnet mit dem Kern als Spielerin: was beim Start offen ist, Regeln je gesperrter Reise, ob eine einzelne Einheit etwas für immer sperren könnte (Engpass), und wie viele Schritte es dauert, wenn man jeweils der einen Aufgabe folgt.
- Für Sprachenlernen und sensible Themen steht ein eigener Abschnitt in der Vorlage (Kompetenzsätze nach Niveau, Wiederkehr für Wortschatz; Freier Zugang als Standard, keine Wartezeiten, Sicherheit vor Erinnerung).

### Zahlen (Rechnung mit dem Kern, ein Schritt = eine Einheit, 4 Minuten je Schritt angenommen)
| Paket | Modus | Einheiten | Regeln | Reisen offen / gesperrt | Regeln je gesperrter Reise | erste Freischaltung | alles offen | alles auf Stufe 2 |
|---|---|---|---|---|---|---|---|---|
| Kaffee-Vorlage (2 Reisen, 18 Stationen) | auto | 21 | 2 | 1 / 1 | 2 | nach 1 Schritt | 1 | 19 (76 Min.) |
| Spieltheorie (3 Reisen, historische, 28) | auto | 35 | 5 | 1 / 2 | 2 und 3 | 1 | 2 | 31 (2,1 Std.) |
| Beispielpaket (3 Reisen, 66) | auto | 78 | 5 | 1 / 2 | 2 und 3 | 1 | 2 | 74 (4,9 Std.) |
| Beispielpaket | kuratiert | 91 | 13 | 2 / 1 | 3 | 1 | 15 (60 Min.) | 80 (5,3 Std.) |
| Wegwerf: 1 Reise, 14 Stationen | auto | 17 | 4 | 1 / 0 (Kapitel: 8 Einheiten offen, 9 gesperrt) | – | 1 | 3 | 16 |
| Wegwerf: 4 Reisen, ohne Kreuzungen und Exponate | auto | 57 | 6 | 1 / 3 | 2, 2, 2 | 2 | 22 | 52 |
| Wegwerf: 8 Reisen, 2 Kreuzungen je Paar | auto | 124 | 15 | 3 / 5 | 3 je Reise | 1 | 5 | 114 (7,6 Std.) |
- **Engpässe:** bei keinem der sieben Pläne hängt eine gesperrte Einheit mit mindestens zwei Regeln an einer einzelnen Einheit. Die vier Werkzeuge mit nur einem Weg im kuratierten Plan stehen getrennt („Nur ein Weg“).
- **Die Momente im kuratierten Plan** kommen nach Schritt 1 (Pre-Mortem), 3 (die gesperrte Reise), 5, 8, 10, 13, 15 und 15 (acht Freischaltungen in der ersten Stunde); danach tragen Stufen, Fähigkeiten, Wiedersehen und der Takt.
- Der Test baut Wegwerf-Pakete (1, 2, 4, 6, 8, 16 Reisen; mit und ohne Mythos-Karten, Kreuzungen, Exponate; Werkzeug-Reise; historische Reise; abweichendes Vokabular) und prüft Offen-Zahl, zwei Wege, Engpässe, Spielbarkeit und Gleichheit zweier Läufe.

### Was sich beim Bau gezeigt hat
- **Die erste Fassung öffnete alles mit einer Station.** Eine Station, die auf allen drei Reisen liegt, war der Schlüssel jeder gesperrten Reise; ein Exponat öffnete alle Kapitel einer einzigen Reise zugleich. Behoben mit einer Liste schon vergebener Schlüssel (kein Schlüssel öffnet zwei Reisen, soweit die Daten es zulassen)
  und mit „Exponat des vorigen Kapitels“. Der Test „Spielbarkeit“ und die Spielzeit (alles offen nach einem Schritt) haben es gezeigt, die Durchsicht der Regeln allein nicht.
- **Auch dann sind die Sperren der Automatik dünn:** höchstens zwei Schritte bis alles offen (E5, Grenze). Ein Schlüssel ist eben eine Station. Wer eine Dramaturgie will, schreibt sie: Meilensteine (`mindestens: 6` Stationen einer Reise), Ketten (ein Werkzeug öffnet das nächste), eine Fähigkeit als Bedingung.
  Im kuratierten Plan liegen die Momente über 15 Schritte (eine Stunde) statt über 2; Ziel wäre eine Verteilung über das Spiel, nicht nur über die erste Stunde.
- **Die Aufgabe springt, und Werkzeuge ziehen sie.** Sie wählt die billigste Regel, wo immer sie liegt: Nach der ersten Station führte sie in die zweite Reise (ein billiger Weg) und dann durch alle Werkzeugregeln, bevor sie in die erste Reise zurückkam. Gemildert haben drei Dinge:
  der Einstiegsschlüssel liegt auf der ersten, kritischen Station der ersten Reise (G5), die Werkzeuge der späteren Reisen kosten zwei Einheiten statt einer (Station und Exponat), und Werkzeuge hängen in Ketten (das Grounding erst nach dem Toleranzfenster). Das Grundproblem ist BE4, nicht lösbar im Plan.
- **Schritte in Stufen, Sätze für Menschen:** Der Kern sagt „Noch 2 Schritte“ für eine unberührte Station, die ein einziges Ereignis auf Stufe 2 bringt (BE2). Die Anbindung sollte `noch_einheiten` zeigen.
- **Die verschachtelten Klammern kamen aus meinem Plan:** Ein Weg als `eine` in einer Regel, die selbst neben anderen Regeln steht, ergab „((A oder B) oder C)“ im Sperrsatz. Je Weg eine eigene Regel (mit eigener Enthüllung, die den Ort nennt) liest sich flach; der Preis ist, dass jede Regel einen Satzteil beisteuert.
  Mehr als drei bis vier Wege je Einheit machen den Satz auf einer grauen Karte unlesbar; die Automatik baut höchstens vier.
- **Werkzeug als Bedingung:** Weil das Museum keine Meldung „Werkzeug benutzt“ kennt, taugt `braucht` (verlangt Stufe 1) nicht. Im kuratierten Plan steht `{ einheit: werkzeug/…, stufe: 0, offen: true }` (Besitz statt Benutzung, BE3); keine Regel hängt an einer höheren Stufe eines Werkzeugs.
  Die Werkzeuge sind Nebenquests; ohne Meldungen der Anbindung bliebe die letzte Aufgabe („Probier … aus“) offen. Die Anbindung sollte das Feld `einsatz` lesen und beim Abschluss von Station oder Exponat `mit: [werkzeug/…]` melden (E7).
- **Ein Kreis, den ich fast gebaut hätte:** Die Mythos-Karte der Stärke 3 öffnet sich mit der Fähigkeit „Belege prüfen“; hätte die Karte selbst diese Fähigkeit geübt, wäre sie ihre eigene Bedingung gewesen. Die Prüfung findet solche Kreise, aber erst, wenn sie schon im Plan stehen; die Zuordnung (`uebt`) ist die Stelle, an der man sie baut.
- **Die eine Pause nur, wo der andere Weg schwer ist:** Eine Wartezeit neben einem ebenso billigen Weg ist sinnlos (der Mensch nimmt den billigen). Beim Verhaltensexperiment steht sie neben dem schweren Weg (eine Fähigkeit auf Stufe 2): Wer lieber wartet, kann es; der Freie Zugang überspringt sie.
- **Ein sensibles Thema ist kein Endgame-Gegner.** Die Traumareise ist offen, weil niemand durch eine Sperre von dem ausgeschlossen werden soll, was er sucht. Gesperrt ist nur die schwerste Mythos-Karte; kritisch sind die Stationen, die Halt geben. Die Sprache vermeidet „Gegner“ und „Boss“.
  Diese Entscheidung lässt sich nur im Kern treffen; die Automatik sperrt jede Reise nach demselben Schema, und `offen: [...]` ist der Griff dafür.
- **Aufwand:** Der Kern des Beispielpakets entstand in einem Arbeitsgang nach Lektüre aller Stationstitel und -teaser und der Exponat-Stationen. Die meiste Zeit ging nicht in Daten, sondern in die Dramaturgie: die ersten 30 Aufgaben ausgeben, lesen, Regeln verschieben, wieder ausgeben.
  Der Generator mit Bericht macht diesen Kreislauf in einer Sekunde möglich; ohne ihn wäre der Plan nicht zu beurteilen gewesen.

### Was nicht trägt
- **Etappe und Quest:** Ein Paket ohne Mythos-Karten kann `onboarding` und `endgame` nicht ohne Warnung vergeben (BE1). Die Automatik lässt dann `endgame` weg und nennt den Grund; für `onboarding` bleibt die Warnung.
- **Skills fehlen in der Automatik.** Ein „Ich kann …“ schreibt ein Mensch; ohne sie zeigt der Reisepass nur Reisen und Stempel, die Wiederkehr hat nichts Fachliches zu bringen und der Zielzustand der Onboarding-Reise ist nur das, was gesperrt ist. Die Vorlage sagt das und zeigt, wie man Fähigkeiten anlegt und zuordnet.
- **Die Aufgabe ist der schwächste Teil:** Sie springt (BE4), sie zählt Stufen (BE2) und sie kennt keine Dramaturgie. Wer eine Erzählung will, muss sie mit Regeln erzwingen.

### Grenzen
- **Die Zahlen sind gerechnet, nicht gemessen.** Vier Minuten je Schritt sind eine Annahme; die Wege der Menschen (Stöbern statt der Aufgabe folgen) sind nicht gerechnet. Ob acht Momente in der ersten Stunde „Spielgefühl“ oder Lärm sind, zeigt nur ein Test mit Menschen.
- **Texte sind Entwürfe.** Enthüllungen, Auftakte und Abschlüsse des Beispielpakets sind aus den Stationstexten geschrieben, nicht gegen Quellen geprüft; die zur Traumareise und zum Grounding gehören vor einer Veröffentlichung fachlich gelesen.
- **Die Automatik ist an synthetischen Paketen mit Werkzeug-Reise getestet, an keinem echten.** Ob die Sorte-Abbildung (konzept, methode, instrument) trägt, zeigt das erste Paket mit einer Werkzeug-Reise.
- **Verriegelte Stationen und der Rauchtest:** Ein Rauchtest, der jede Station mit Exponat öffnet, findet keine Start-Schaltfläche, wo die Station gesperrt ist (im Beispielpaket die beiden Exponate der gesperrten Reise). Der Test muss zuerst den Freien Zugang einschalten.


## Museum-Anbindung A: der Spielplan im Museum (Kern, Stationen, Reise-Modus, Eingang)

*Dateien:* `engine/js/spiel.js` (906 Zeilen), `engine/css/spiel.css` (182), kleine Eingriffe in `engine/js/core.js`, `journey.js`, `app.js`, `search.js` (zusammen rund 200 neue Zeilen, alle hinter `if (MUSEUM.spiel && MUSEUM.spiel.aktiv)`), `tools/check-pack.mjs` (Prüfung des Spielplans im Paket),
`tools/smoke.mjs` (Freier Zugang an), `tools/spiel-test.mjs` (Browser-Test der Anbindung, 21 Prüfungen), `tools/spiel-vergleich.mjs` (alt gegen neu für Pakete ohne Spielplan). Entscheidungen: M1 bis M15 und BM1 bis BM8 in `docs/spielplan-auslegung.md`.
Der Build (`tools/build.mjs`) band `data/spielplan.js`, `js/spielplan.js`, `js/spiel.js` und `css/spiel.css` nur mit `spielplan.json` ein, nie den Adapter; das war schon vorbereitet und ist unverändert.

### Was geht
- **Ein Paket mit `spielplan.json` spielt:** Der Eingang zeigt genau eine nächste Aufgabe (mit dem Satz, was sie bringt, und dem Schalter für den Freien Zugang), gesperrte Reisen stehen angedeutet (Schloss, Satz mit der Bedingung, „Was fehlt noch?“),
  eine gesperrte Station oder Reise unter ihrer Adresse zeigt ein ruhiges Hinweisbild mit der Bedingung und dem Weg zur Aufgabe, die Suche verrät nichts über Gesperrtes, und im Reise-Modus erklärt eine gesperrte Haltestelle sich selbst. Station, Mythos-Karte, Exponat, Einsatz eines Werkzeugs,
  „Weiter“, Reise öffnen, Stempel und Link kopieren melden Ereignisse (nur Kennungen). Sobald etwas aufgeht, kommt am Ort eine Karte mit dem `enthuellung`-Text (Ansehen oder Weiter, aria-live, Bewegung nur ohne `prefers-reduced-motion`); dieselbe Karte erzählt Fähigkeiten („Du kannst jetzt mehr“),
  den Auftakt eines Gebiets und den Abschluss einer Reise. Auftakt, Etappe und Abschluss der Episode stehen in der Einführung und auf der Abschlusskarte. Wiedersehen, Verwitterung und Takt zeigen sich freundlich (Aufgabe „Ein Wiedersehen“, „Wartet auf ein Wiedersehen“, „Aufgefrischt“), nie als Strafe oder Serie.
- **Ein Paket ohne `spielplan.json` ist unverändert.** Der Vergleich (`tools/spiel-vergleich.mjs`) baut Spieltheorie, die Vorlage und das Beispielpaket (dieses vor dem Spielplan) mit der Engine vor und nach der Anbindung und vergleicht alle Dateien außer `js/*.js` (gleich) und elf Zustände der Seite
  (Eingang, Station, Mythos-Karte, Exponat, Reise-Modus an drei Stellen, Rundreise, Netzplan, Reisepass, Suche) Zeichen für Zeichen: **kein Unterschied**, keine Konsolenfehler. `MUSEUM.spiel` ist dort nicht definiert, `localStorage` bekommt keinen Schlüssel `gm:sp:`.
- **Freier Zugang** als Schalter im Eingang und auf jedem Hinweisbild (und als Vorbelegung `"spielFrei": true` in `pack.json`): öffnet alles, überspringt Pausen, zählt weiter.

### Zahlen
- **Tests:** 21 Prüfungen im Browser (`node tools/spiel-test.mjs`, gut drei Minuten mit allen Skins; `--schnell` nur mit `halle`), darunter die Darstellung in vier Skins × hell/dunkel × Handy/Desktop (Kontrast aller Texte der Spielplan-Blöcke gegen den gemischten Hintergrund, kein seitliches Scrollen).
  `tools/spielplan-test.mjs` bleibt grün (149 Tests), `tools/smoke.mjs` läuft für das Beispielpaket mit Spielplan sauber durch (mit Freiem Zugang, sonst fände es die Exponate gesperrter Stationen nicht).
- **Spielverlauf im Museum:** Wer im Beispielpaket (kuratierte Schicht, 91 Einheiten) jeweils der einen Aufgabe folgt (Stationen lesen, Mythos-Karten drehen, Exponate bedienen, Werkzeuge einsetzen), bekommt den ersten Moment nach **einem** Schritt (die erste Station schenkt das Pre-Mortem);
  die acht Freischaltungen kommen bei Schritt 1, 3, 5, 8, 10, 13, 15 und 15, danach tragen sechs Fähigkeiten (Schritt 15, 28, 29, 41, 47, 50) und fünf Abschlüsse (drei Reisen, zwei Gebiete) die Momente, zusammen 19 Karten; nach **71 Aufgaben** gibt es keine mehr und alle 91 Einheiten stehen auf Stufe 2.
  Das ist die Rechnung des Kerns (`check-spielplan --bericht`: Anzahl der Schritte), durch das echte Museum gespielt: Kern und Anbindung sind sich einig. Ob acht Momente in den ersten fünfzehn Schritten Spielgefühl oder Lärm sind, zeigt nur ein Test mit Menschen (Grenzen).
- **Größe und Kosten:** `spiel.js` rechnet den Spielstand je Sekunde und Änderung höchstens einmal (Kern 5 bis 10 ms bei 364 Einheiten), alles andere sind kleine DOM-Änderungen. Je Station läuft ein Zähler, solange sie offen ist (alle 500 ms eine Rechnung).

### Was sich beim Bau gezeigt hat
- **Das Beispielpaket durchzuspielen fand, was kein Test fand:** Die Aufgabe „Geh den Bestätigungsfehler ganz durch“ kam nie zum Ende. Die Marke am Ende des Lesestoffs lag vor dem Exponat; wer ans Ende der Seite scrollte, scrollte an ihr vorbei, und sie wurde nie als „im Bild“ gesehen (ein hohes Exponat schiebt sie nach oben aus dem Bild).
  Jetzt gilt sie als erreicht, sobald sie im Bild war **oder schon darüber hinaus** liegt. Das Muster: Wer „gelesen“ misst, muss die Seite beschreiben, die er nicht kennt (Exponate, Abbildungen, hohe Karten).
- **Der Zähler zählte bei der ersten Runde null** (die Zeit seit der Anlage wurde erst im zweiten Takt gerechnet); ein Exponat ohne Aufräumfunktion meldete nie sein Ende (die Seite meldet jetzt Start und Ende selbst, nicht über die Aufräumfunktion des Exponats).
- **Der Fokus ging verloren, wenn der Eingang sich neu zeichnete.** Der Stand wird jede halbe Minute neu gerechnet; zeichnete der Eingang dabei seinen Schalter neu, verlor jemand, der gerade mit der Tastatur umschaltete, die Stelle. Jetzt wird nur der Teil erneuert, dessen Inhalt sich ändert, der Schalter nie, der Satz mit der Pause an Ort und Stelle.
- **Ein verstecktes Panel behält seinen Inhalt.** Das Hinweisbild einer gesperrten Reise blieb im geschlossenen Stationspanel stehen; Tests, die nach dem Hinweisbild fragen, müssen die Sichtbarkeit prüfen, nicht das Vorhandensein.
- **Kontrast gegen die Skins:** Der Knopf `gm-btn-primary` hat im dunklen Skin „ma“ nur 2,49:1 (Text des Knopfes gegen seine Fläche; `themes/` gehört der Anbindung nicht). Die Anbindung benutzt deshalb `gm-btn-warm`, das in allen vier Skins besteht, und meldet es hier; derselbe Knopf steht an anderer Stelle des Museums („Reise beginnen“).
- **Die langen Bedingungen:** Bei drei Wegen schreibt der Kern einen langen Satz („Zum Öffnen: … oder (… und … Pause, nachdem …)“). Im Hinweisbild ist Platz dafür, auf einer Reise-Karte nicht; dort sind fünf Zeilen erlaubt, der volle Satz steht im `title`.
- **„Noch 2 Schritte“ für eine unberührte Station** (BE2 des Generators) liest sich im Museum falsch; die Anbindung schreibt den Satz für eine einzelne Einheit um („Danach geht … auf.“, M11).
- **Der Rauchtest und gesperrte Stationen:** Er findet keine Start-Schaltfläche des Exponats, wo die Station gesperrt ist (so schrieb es auch der Generator). Er schaltet jetzt den Freien Zugang ein; die Sperren prüft der neue Test.

### Was der Standard trägt, was nicht
- **Trägt:** Die Sätze des Kerns sind als Text der Oberfläche brauchbar, so wie sie sind: `bedingung` auf Karten und im Hinweisbild, `aufgabe` und `bringt` im Eingang, `enthuellung` in der Karte, `kann` bei Fähigkeiten. Die Regel „es gibt kein Nicht“ (5.2) ist genau das, was einen Moment möglich macht:
  Was aufgeht, bleibt offen, also kann eine Karte es einmal zeigen. Die Vererbung über `in` (A3) macht die Kreuzungen des Museums ohne Zusatz spielbar.
- **Trägt nicht:** Lesen ist kein Verstehen (BM1), Wiedersehen braucht jedes Mal ein Ereignis (BM2), der Reise-Modus ist eine Darstellung mit Reihenfolge, die der Standard nicht kennt (BM3), Zähler verraten Verborgenes (BM4), der Freie Zugang ist unbeschrieben (BM5), Ereignisse ohne wahren Zeitpunkt haben kein Kennzeichen (BM6),
  das „Gesehen“ der Enthüllung ist Zustand der App (BM7), und Werkzeuge haben keinen Ort (BM8).

### Das Spielgefühl gegen den Maßstab
Karls Diagnose eines früheren Versuchs: ein Dashboard über ein Spiel, kein Spiel. Gegen die vier Dinge, die ein Spielplan im Museum braucht:
1. **Geschichte:** Auftakt (Einführung der Reise, Etappe als Überschrift), Abschluss (Karte beim Schaffen, Abschlusskarte), Auftakt und Abschluss der Gebiete (Karte), „Dein Einstieg“ im Eingang. Die Texte sind die der Spielplan-Datei; die Anbindung erfindet keine.
2. **Der Moment:** Die Karte mit Enthüllung erscheint dort, wo man gerade handelt, im Panel, im Reise-Modus oder in der Suche. Sie ist nicht blockierend, wird angesagt und hat nur zwei Schaltflächen. Erster Moment nach einem Schritt, acht in den ersten fünfzehn, danach etwa alle sieben Schritte einer.
3. **Rhythmus:** Wiedersehen als eine Aufgabe, Verwitterung als freundlicher Satz, Takt über Regeln, Pausen über `wartezeit`, nirgends eine Serie, die reißt, nirgends ein Zähler der Tage.
4. **Rückmeldung am Ort:** „Geschafft“ im Kopf der Station, ein Satz am Ende, was sie der Reise bringt, eine Zeile an Mythos-Karte und Exponat, der Einsatz-Knopf am Werkzeug. Es gibt keinen Reiter mit Statistik; das Einzige, was der Anbindung hinzugefügt wurde, ist die kleine Karte im Eingang.
- **Wo die Gefahr eines Dashboards bleibt:** Der Eingang trägt jetzt einen zweiten Block unter den Knöpfen; er soll leise bleiben (eine Zeile Aufgabe, eine Zeile Folge). Der Reisepass und der Netzplan (andere Anbindung) sind der Ort für Freischaltungen und Stufen; zeigen sie Zahlen statt Orte, kippt es.

### Grenzen
- **Alle Zahlen sind Annahmen, keine Messung:** ein knappes Drittel der Lesezeit (5 bis 45 Sekunden), vier Sekunden für „Weiter“, sechs Sekunden und eine Bedienung für das Exponat, zehn Minuten bis zur nächsten Meldung derselben Station, 30 Sekunden für die Uhr. Sie stehen als Konstanten am Anfang von `spiel.js`; ein Test mit Menschen sagt, ob sie zu streng oder zu locker sind.
- **Stufe 3 und 4 gibt es im Museum nicht** (M2). „Gemeistert“ bleibt leer.
- **Kein Wochenrückblick:** Der Takt zeigt sich nur über Regeln („ab Woche 2“); die `rueckblick`-Felder des Spielstands zeigt das Museum nicht (sonst entstünde ein Statistik-Block im Eingang). Wer ihn will, setzt eine eigene Ansicht auf `MUSEUM.spiel.stand().rueckblick`.
- **Verborgenes zählt in den Zahlen** („Drei Reisen“, Seitentitel) mit (BM4).
- **Die Karte deckt etwas ab.** Neben dem Panel liegt sie links auf dem abgedunkelten Grund (ab 1240 Pixel Breite), sonst unten rechts oder, auf dem Handy, über der Fußleiste; sie schließt sich nicht von selbst.
- **Zwischenablage unter `file://`:** Ohne sicheren Kontext fällt „Link kopieren“ auf `execCommand` zurück; geht auch das nicht, zeigt es den Link zum Markieren. Das Ereignis `geteilt` gibt es nur, wenn das Kopieren gelang.
- **Tab-Kommunikation:** Zwei Tabs teilen den Stand über `storage`; die Enthüllung zeigt dort der Tab, in dem etwas geschah, der andere zeigt sie, wenn er sie nicht schon gesehen hat. Das Merken (`gm:sp:<plan>:enthuellt`) ist ein Schlüssel ohne Zeitstempel; ein Tab, der gleichzeitig schreibt, kann ihn überschreiben (der Moment kann dann doppelt erscheinen).
- **Reisepass, Netzplan und Zeitstrahl** kennen den Spielplan noch nicht (Aufgabe der zweiten Anbindung); `MUSEUM.spiel.zugang()`, `stand()` und `bei()` sind dafür gedacht.
