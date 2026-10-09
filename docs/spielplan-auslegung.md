# Spielplan: Auslegung des Standards

Zu `docs/spielplan-standard.md` (Format `spielplan/0`, Entwurf). Hier steht **je Entscheidung: Stelle, Lücke, Auslegung, Begründung**, wo nötig mit
Vorschlag für den Standard. Der Standard selbst wird nie geändert. Jede Umsetzung hängt ihren Abschnitt an; fremde Einträge werden nicht verändert.
Wo der Standard dem Lernlog-Abgleich des Auftrags oder sich selbst widerspricht, gilt der Abgleich, und der Widerspruch steht als **Befund**.

Kürzel: A = Auslegung, B = Befund zum Standard. Die Nummern gelten je Abschnitt.

---

## Kern (engine/js/spielplan.js, tools/check-spielplan.mjs, tools/yaml-lite.mjs)

Der Kern rechnet jede Stufe jeder Einheit und jede Freischaltung als **Zeitpunkt** („ab wann“), nicht als Zustand. Der Spielstand zu einem `jetzt`
vergleicht nur Zeitpunkte mit `jetzt`. Daraus folgen mehrere Entscheidungen unten fast von selbst: 5.2 gilt ohne Sonderfall, die Zeit-Bausteine
rechnen auf Stunden genau, und jede Freischaltung hat ihr „seit“, ohne dass etwas zusätzlich gespeichert wird.

### A1 · Zeit: `jetzt`, UTC, Stunden statt Tage
- **Stelle:** 1 („`heute`“), 5.1 (`ab`, `wartezeit` in Stunden), 5.2 („Tage vergehen nur“), 8 (`stand` als Datum).
- **Lücke:** In welcher Zeitzone beginnt ein Tag, ein Takt? Was ist `heute`, wenn die Wartezeit Stunden kennt?
- **Auslegung:** `spielstand(plan, ereignisse, jetzt)` nimmt einen Zeitpunkt: ISO-8601-Text (ohne Offset gilt UTC), `Date` oder Millisekunden.
  Ein reines Datum gilt als 00:00 UTC. Tage und Takte beginnen um 00:00 UTC (der Takt eines Spielers beginnt am Kalendertag seines ersten Ereignisses,
  Wochen dauern 7 Tage ab diesem Tag, Monate sind Kalendermonate). `stand` im Spielstand ist das UTC-Datum, dazu `jetzt` als voller Zeitpunkt.
  Ohne `jetzt` gilt die Uhr; das ist die einzige Unreinheit der Funktion, die Brücke übergibt immer einen Zeitpunkt.
- **Begründung:** Eine reine Funktion braucht eine feste Zeitzone, sonst rechnen zwei Geräte verschieden. UTC ist die einzige, die überall gleich ist.
  Stunden-Genauigkeit ist nötig, weil die Zwangspause („3 Stunden“) der Lern-Heldenreise sonst nicht ausdrückbar ist. 5.2 bleibt gewahrt: Alle Zeit-Bausteine
  (`ab`, `takt`, `wartezeit`) werden mit der Zeit nur wahr.
- **Grenze:** Für Spieler in Deutschland beginnt der Tag um 1 oder 2 Uhr. Wer einen lokalen Tagesbeginn braucht, braucht ein Feld `zeitzone` im Spielplan (Vorschlag für `spielplan/1`).

### A2 · Die Stufe hängt nicht vom Zugang ab
- **Stelle:** 4, 5.
- **Lücke:** Zählt ein Ereignis an einer noch gesperrten Einheit (aus einem anderen Gerät, bei „Freier Zugang“)?
- **Auslegung:** Ja. Die Stufe ist eine reine Funktion der Ereignisse; der Zugang ist eine Funktion der Stufen. Nichts geht verloren (Grundsatz 3).
  Nur die Kurzform `braucht` verlangt zusätzlich, dass das Werkzeug offen ist (A8).
- **Begründung:** Mit „Stufe zählt nur, wenn offen“ würde ein Spieler, der im freien Zugang alles durchspielt, nichts freischalten. So schaltet sich nach einem
  Durchgang im freien Zugang alles auf, was die Regeln hergeben.

### A3 · Zugang wird über `in` vererbt; `in` darf eine Liste sein
- **Stelle:** 3.1 (`in`: „die übergeordnete Einheit“), 5 („Jede Einheit ist offen, bis eine Regel sie als Ziel nennt“).
- **Lücke:** Sind die Stationen einer gesperrten Reise offen? Und eine Station, die auf mehreren Reisen liegt (das Wesen des Museums), hat sie mehrere Eltern?
- **Auslegung:** Eine Einheit ist offen, wenn (a) keine Regel sie nennt oder eine ihrer Regeln erfüllt ist, **und** (b) sie keine Eltern hat oder mindestens ein Elter offen ist.
  `in` darf ein Text oder eine Liste von Texten sein. Alle Eltern zählen die Einheit als Mitglied (4.1). `freigeschaltet` nennt nur Einheiten, die eine Regel nennt,
  nicht die geerbten. `bedingung` sagt bei geerbter Sperre: „Zum Öffnen: „Trauma“ muss offen sein („Verzerrung“ geschafft).“ Verborgen (`sichtbar`) vererbt sich ebenso.
- **Begründung:** Ohne Vererbung bräuchte jede der 205 Stationen eine eigene Regel. Mit nur einem Elter würde eine Kreuzungsstation nur für ihre Heimat-Reise zählen.
- **Vorschlag für den Standard:** In 3.1 `in` als „Einheit oder Liste“ führen und in 5 den Satz zur Vererbung ergänzen (B1).

### A4 · Sammel-Einheiten: Randfälle
- **Stelle:** 4.1.
- **Lücke:** Was gilt ohne kritische und ohne wesentliche Mitglieder? Wie wird „zwei Drittel“ gerundet? Was bei Kreisen (eine Episode `uebt` einen Skill, der in ihr liegt)?
- **Auslegung:** (1) Ohne kritische und ohne wesentliche Mitglieder gibt es nichts zu messen: die Stufe kommt nur aus direkten Ereignissen (sonst wäre die leere Menge „zu 100 %“ erfüllt).
  (2) `ceil(n · anteil)`; der Standardanteil ist **exakt** zwei Drittel (n=3 → 2, n=6 → 4); ein angegebener Anteil wird auf `ceil(n · anteil − 1e-9)` gerechnet.
  Anteil als Text `"2/3"` ist erlaubt. (3) Kreise werden von unten aufgelöst: Eine Stufe, die nur durch den Kreis getragen würde, gilt nicht.
  (4) Mitglieder, die selbst Sammel-Einheiten sind, zählen mit ihrer berechneten Stufe.
- **Begründung:** Die Stufe muss eine eindeutige Funktion sein, unabhängig von der Reihenfolge des Rechnens.
- **Befund B2:** Der Kopf-Beispielwert `stufen: { anteil: 0.67 }` (Abschnitt 10) widerspricht „zwei Drittel“: Bei 3 wesentlichen Einheiten verlangt 0.67 drei statt zwei
  (`ceil(2.01)`). `check-spielplan` warnt davor. Vorschlag: im Beispiel `anteil: 2/3` oder `0.66`.

### A5 · `nach` und `braucht` an derselben Einheit
- **Stelle:** 5.4 („Kurzform für eine Regel“), 5 („Nennen mehrere Regeln dieselbe Einheit, genügt eine davon“).
- **Lücke:** Eine Quest mit `nach: episode/a` und `braucht: [werkzeug/w]` ergäbe wörtlich zwei Regeln, von denen eine genügt (ODER). Das Zelda-Prinzip meint UND.
- **Auslegung:** Die Kurzformen derselben Einheit werden zu **einer** Regel mit „alle“ verbunden (`kurz/<id>`). Erst mehrere Regeln (`regeln:` oder Kurzform plus Regel) sind Alternativen.
- **Begründung:** Wer `nach` und `braucht` an eine Einheit schreibt, will beides.
- **Befund B3:** 5.4 und 5 widersprechen sich für diesen Fall. Vorschlag: in 5.4 „mehrere Kurzformen an einer Einheit gelten zusammen“.

### A6 · Stufe 3 und 4: Beleg, Fall, Transfer
- **Stelle:** 4 (Tabelle), 6.2 (`beleg.fall`), Lernlog-Abgleich („zwei verschiedene Fälle oder weitergegeben (geteilt)“).
- **Lücke:** Was ist ein „Fall“? Reicht `geteilt` allein? Zählt `angewendet` ohne Beleg?
- **Auslegung:** Ein **Fall** ist `beleg.fall` (Kennung), verglichen ohne Leerzeichen am Rand und ohne Groß-/Kleinschreibung. Stufe 4 braucht zwei verschiedene Fälle **oder**
  `angewendet` (mit Beleg) **und** `geteilt`, in beliebiger Reihenfolge. Ein Beleg ohne `fall` zählt für Stufe 3, aber nie als einer der zwei Fälle.
  `geteilt` allein ergibt Stufe 1 (berührt), `angewendet` ohne gültigen Beleg (`art` aus messung, bestaetigung, eigen) ergibt Stufe 2.
  Höhere Stufen schließen niedrigere ein (angewendet ohne vorheriges `geschafft` ist Stufe 3).
- **Begründung:** Der Abgleich sagt „oder geteilt“, der Standard „angewendet **und** geteilt“; die Treppe der Stufen (4 setzt 3 voraus) verlangt das Zweite.
  Ohne feste Bedeutung von „Fall“ ließe sich Stufe 4 durch denselben Beleg doppelt melden.
- **Befund B4:** Abgleich und Standard (4) sagen nicht dasselbe über `geteilt`. Und das Lernlog nennt „weitergeben“ nicht als Merkmal von Transfer
  (siehe `docs/spielplan-lernlog-notizen.md`, B4).

### A7 · Werkzeug-Ereignisse über `mit`
- **Stelle:** 4.2 („Meldet eine Quest `geschafft` mit `mit: [werkzeug/…]`, zählt das für das Werkzeug als `geschafft`“).
- **Lücke:** Gilt das auch für `bestanden` und `angewendet`? Wie kommt ein Werkzeug auf Stufe 3 und 4 (Ausrüstung = Anwendung auf **neue Fälle**)?
- **Auslegung:** `geschafft`, `bestanden` und `angewendet` (samt Beleg und Fall) werden an jedes genannte **Werkzeug** durchgereicht; `begonnen`, `erkundet`, `geteilt` nicht.
  `mit` nennt nur Werkzeuge; anderes wird ignoriert.
- **Begründung:** Sonst wäre Transfer (zwei Fälle) am Werkzeug nur über direkte Meldungen am Werkzeug möglich, obwohl es im Einsatz an Quests benutzt wird.

### A8 · `braucht`: „offen und schon einmal benutzt“
- **Stelle:** 5.4.
- **Auslegung:** Bausteine kennen ein Feld `offen: true` („nur offene Einheiten zählen“). `braucht` ist die Kurzform dafür mit Stufe 1.
- **Begründung:** Wörtlich verlangt 5.4 „offen **und** benutzt“; nach A2 allein reicht Stufe 1 nicht.
- **Vorschlag:** `offen` als Feld in 5.1 aufnehmen.

### A9 · Wiederkehr
- **Stelle:** 5.5 („fällig, wenn seit ihrem letzten Ereignis der nächste Abstand vergangen ist; erfüllt, wenn alle Abstände je mit einem neuen Ereignis eingelöst sind“).
- **Lücke:** Von wann an? Was ist ein „neues Ereignis“? Zählen zu frühe Ereignisse?
- **Auslegung:** Wiedersehen kann man, was man geübt hat: Die Folge beginnt, wenn die Einheit Stufe 2 erreicht (`t0`). Jedes spätere Ereignis an der Einheit (bei Sammel-Einheiten:
  an ihren Mitgliedern) setzt „das letzte Ereignis“ neu; liegt es mindestens den nächsten Abstand nach dem vorigen, ist dieser Abstand eingelöst. Fällig ist die Einheit,
  wenn `letztes + nächster Abstand ≤ jetzt`. Nach dem letzten Abstand ist die Wiederkehr erfüllt (`eingeloest`). Wer lange weg war, bekommt **eine** fällige Wiederkehr,
  keine Rückstandsliste. Fehlt `fuer`, gelten alle Einheiten.
- **Begründung:** Ein zu früh gemeldetes Ereignis ist kein Wiedersehen, setzt aber die Uhr zurück („seit ihrem letzten Ereignis“); so kann niemand eine Wiederholung erzwingen und niemand wird gemahnt.

### A10 · Nächste Aufgabe (5.6)
- **Stelle:** 5.6.
- **Lücke:** Was heißt „deren nächste Stufe eine Regel erfüllt oder ihr am nächsten bringt“? Wie vergleicht man `reihenfolge` über Eltern hinweg? Wie kommt der Satz zustande?
- **Auslegung:** (1) Fällig ist die längst fällige Wiederkehr; bei Sammel-Einheiten ist die Aufgabe das am längsten nicht berührte Mitglied. (2) Für jede unerfüllte Regel mit gesperrtem Ziel
  wird gerechnet, wie viele **Schritte** (Stufen an offenen, aktionsfähigen Einheiten) sie noch braucht; die Regel mit den wenigsten gewinnt, die Aufgabe ist ein Schritt darin.
  Wo eine Regel eine Auswahl lässt (zwei von sechzehn Reisen, zwei Drittel der Stationen einer Reise), gilt: Erledigtes zuerst, dann Angefangenes (das Nächstliegende zuerst), dann Unberührtes in der Reihenfolge der
  Autorin. Der Satz „bringt“ heißt bei einem Schritt „Danach geht das Werkzeug „X“ auf.“, bei mehreren Stufen an einer Einheit „Noch 2 Schritte, dann geht …“ und bei mehreren Einheiten „Noch 33 Stationen, dann
  geht die Reise „X“ auf.“ (`noch` zählt Stufen, `noch_einheiten` Einheiten). Regeln, die nur noch auf Zeit warten, sind keine Aufgabe
  (sie stehen in `wartet`). (3) Sonst nach Gewicht, dann `reihenfolge` **entlang der Eltern** (Pfad von der Wurzel), dann höhere Stufe zuerst, dann id. Erst bis Stufe 2 (Hauptpfad),
  danach darüber hinaus bis `stufen.bis`. Verborgene Ziele werden nie genannt („Danach geht etwas Neues auf.“).
  `reihenfolge` zählt entlang der Eltern, aber nur, wo eine Nummer steht; wer die Reihenfolge der Reise (statt „alle Mythos-Karten zuerst“) will, gibt gleiches Gewicht, denn Gewicht geht vor Reihenfolge (5.6).
- **Begründung:** Sonst wäre die Reihenfolge von der Dateireihenfolge abhängig. Aktionsfähig sind Einheiten ohne Mitglieder der Arten inhalt, quest, erlebnis, werkzeug, episode;
  Gebiete und Skills werden nie „gemacht“, sondern ergeben sich.
- **Erweiterungen:** `stufen.bis` (höchste Stufe, die das Angebot vergibt, Standard 4; das Museum kann Beleg und Transfer nicht prüfen und setzt 2), optionales Feld `aufgabe` an einer Einheit
  (Satz oder Sätze je Stufe), optionales `begriffe` im Plan (z. B. episode → „Reise“) für die Sätze.

### A11 · Verwitterung
- **Stelle:** 4.3.
- **Auslegung:** Verwittert ist eine Einheit mit Stufe ≥ 1, deren letztes Ereignis (bei Sammel-Einheiten: das jüngste an ihr oder ihren Mitgliedern) länger als `verfall_tage` her ist.
  Stufe und Freischaltung bleiben. Einheiten ohne Ereignis verwittern nicht (es gibt nichts, was verwittern könnte). Eine verwitterte Einheit kann als Wiederkehr-Aufgabe erscheinen (4.3): Sie steht in der
  Reihenfolge von 5.6 Punkt 1 neben den fälligen, seit dem Tag, an dem sie verwittert ist (bei gesetzter Wiederkehr nur, wenn `fuer` sie trifft).

### A12 · Ereignisse sind Strings und Kennungen, nie Inhalte
- **Stelle:** 6.2, 7.2.
- **Auslegung:** Die Brücke nimmt `melde()` nur an, wenn Verb und Objekt stimmen; `freigeschaltet` darf keine App melden. `ergebnis` behält nur Zahlen (`dauer_s`, `punkte`, `max`) und `erfolg`.
  `beleg.quelle` und `fall` müssen Kennungen sein (a–z, 0–9, `-_:./`, Fall höchstens 64 Zeichen): alles andere (Namen, Sätze) wird weggelassen, der Beleg bleibt. Ein Fall mit Leerzeichen
  ist also kein Fall und ergibt keinen Transfer. Gleiche Ereignisse binnen einer Minute werden nicht doppelt gespeichert. Ab 4000 gespeicherten Ereignissen verdichtet die Brücke `begonnen` und `erkundet`: je Einheit bleiben das erste und das letzte (Stufen und Zeitpunkte ändern sich dadurch nicht, nur zwischenliegende Wiederholungen der Wiederkehr entfallen).
- **Begründung:** 7.2 verbietet freie Texte; der Kern setzt es durch, statt es der App zu überlassen.

### A13 · Ereignisse aus der Zukunft, unlesbare Ereignisse
- **Auslegung:** Ereignisse mit `zeit` nach `jetzt` (falsche Uhr) zählen, aber mit `zeit = jetzt` (nichts geht verloren). Ereignisse mit unbekanntem Verb, unbekanntem Objekt, unlesbarer Zeit oder dem
  abgeleiteten Verb `freigeschaltet` werden übersprungen und im Spielstand unter `ignoriert` mit Grund genannt. Der Kern wirft dabei nie.
- **Grenze von 5.2:** Für Ereignisse aus der Zukunft rechnet eine Wartezeit ab dem jeweiligen `jetzt` statt ab der angegebenen Zeit; sie verschiebt sich also, solange die Uhr dahinter liegt.
  Stufen sinken und Einheiten gehen dabei nie wieder zu (getestet mit Zufallsereignissen nach `jetzt`). Die Brücke stempelt Ereignisse mit der eigenen Uhr, erzeugt solche Ereignisse also nicht; sie
  entstehen nur durch `importiere` aus fremden Quellen oder `melde(…, { zeit })`.

### A14 · Erweiterungen des Spielstands
Zusätzlich zu Abschnitt 8: je Einheit `art`, `letzte`, `seit` (wann aufgegangen), `fortschritt` (Sammel-Einheiten: wie viele kritische, wesentliche, optionale Mitglieder die nächste Stufe haben),
`wiederkehr`; oben `bis`, `wartet` (laufende Pausen), `nebenquests`, `ignoriert`, `rueckblick.vorher` (der vorige Takt; zu Beginn eines Taktes ist der aktuelle leer),
`freigeschaltet[].enthuellung/art/name` (Kurzformen bekommen einen Standardsatz). `aufgabe` bekommt `art` (regel, weiter, wiederkehr), `stufe`, `adresse`, `regel`/`oeffnet`/`noch` bzw. `faellig`.

### A15 · Bedingung als Satz
`bedingung` an gesperrten, angedeuteten Einheiten: „Zum Öffnen: …“ mit dem, was fehlt: „3 Reisen geschafft – 1 fehlt“, „„X“ angewendet“, „ab dem 24.12.2026“, „noch 1 Std. 30 Min. Pause nach „X““.
`alle` nennt nur das noch Fehlende; `eine` nennt die Alternativen. Bei verborgenen Einheiten gibt es **keinen** Satz (Grundsatz 5), auch nicht versehentlich.

### A16 · Brücke
`verbinde({ plan, app, speicher, praefix, jetzt, lager })`: Speicher `lokal` unter `<praefix><plan.id>:ereignisse|wer|gesehen` (Standardpräfix `gm:sp:`), ohne erreichbaren Speicher Arbeitsspeicher.
`wer` ist `lokal:` plus acht Hexzeichen; `zuruecksetzen()` löscht alles und vergibt eine neue Kennung. `bei('freigeschaltet')` feuert für jede Freischaltung einmal (ein Merkzettel `gesehen`, je Einheit einmal, im
Speicher verhindert Wiederholungen nach dem Neuladen, auch für Freischaltungen durch Zeit, die erst beim nächsten Öffnen auffallen). `aktualisiere()` rechnet mit der Uhr neu.
`horche(fenster, { erlaubt })` nimmt `postMessage({ type: 'sp:melde', verb, objekt, … })` aus Übungen im iframe an, standardmäßig nur von der eigenen Herkunft (unter `file://` „null“ gegen „null“), sonst nach `erlaubt(ereignis)`.
`speicher` darf eine Liste sein (`['lokal', adapter]`); mit `nur_lokal: true` verweigert die Brücke jeden anderen Adapter (7.2). Die Seite sendet nichts; die Adapter laden nur Anwendungen,
die `spielplan-adapter.js` selbst einbinden.

### A17 · xAPI-Übersetzung
`nachXapi(ereignis, plan, opts)`: `object.id` = `basis` + `objekt`; ohne `basis` ersatzweise `urn:spielplan:<id>:`. `actor.account.homePage` = `basis`; `verb.display` = {de: Verb}; `result` aus `ergebnis`
(`completion` bei geschafft und bestanden, `success` bei bestanden, `duration` als ISO-8601-Dauer, `score`); `beleg` und `mit` als Erweiterungen unter `https://zukunftsgut.org/spielplan/ext/…`;
`app` als `grouping`-Aktivität (= `basis` oder `opts.activityId`) und als Erweiterung; zusätzlich `parent` (die erste Eltern-Einheit). Die Statement-`id` ist ein UUID-förmiger Hash des Inhalts,
damit Nachreichen nichts doppelt anlegt.

### A18 · `sorte: baustein`
Der Standard nennt `baustein` als Sorte (Absatz unter der Artentabelle in 3), der Lernlog-Abgleich nicht. Die Prüfung warnt bei jeder Sorte außerhalb von modell, methode, heuristik, technik, app
(Fehler wäre zu streng: „Die Sorte ändert nichts an der Rechnung“). **Befund B5:** Widerspruch zwischen Abgleich und Standard; im Unternehmens-Zwilling ist „Baustein“ das häufigste Werkzeug.

### A19 · Prüfung (Erreichbarkeit)
Die Prüfung spielt in einer Simulation alles bis `stufen.bis` durch, was offen ist, und wartet beliebig lange; Einheiten, die dabei nie aufgehen, sind Fehler (mit Ursache: unbekannt,
Stufe über `bis`, Takt fehlt, hängt von etwas Unerreichbarem ab, **Zyklus ohne Einstieg**). Eine zweite, vorsichtige Simulation gibt Sammel-Einheiten mit Inhalt keine direkten Ereignisse;
was nur in der ersten aufgeht, ist eine Warnung („geht nur auf, wenn direkt an einer Sammel-Einheit gemeldet wird“). Kritische Einheiten, die nie aufgehen, blockieren ihre Sammlungen
für immer und werden eigens genannt (Befund B2 der Lernlog-Notizen).

### A20 · Wartezeit überspringen
`spielstand(…, { ohneWartezeit: true })` rechnet Pausen als vorbei, sobald die Stufe erreicht ist. Das ist der Haken für „Freier Zugang“, damit die Zwangspause ein Vorschlag bleibt
(Grundsatz 4; Lernlog-Notizen, B7).

### A21 · YAML-Leser
`tools/yaml-lite.mjs` liest die Teilmenge, die die Beispiele brauchen. Bekannte Unterschiede zu YAML 1.2: Zahlen mit führenden Nullen sind Zahlen (`007` → 7); `yes`/`no`/`on`/`off` sind Text;
Anker, Aliase, Tags, mehrere Dokumente, komplexe Schlüssel, mehrzeilige Zeichenketten ohne `|`/`>` sind Fehler mit Zeilennummer. **Befund B6:** `adresse: #/station/kaldi` (Beispiel in 3.1) ist in YAML
ein Kommentar; Adressen mit `#` brauchen Anführungszeichen. Aufwand siehe `docs/SPIELPLAN-ERFAHRUNGEN.md`.

### A22 · Felder und Optionen, die der Kern über den Standard hinaus liest
| Wo | Name | Bedeutung | Eintrag |
|---|---|---|---|
| Einheit | `in` als Liste | mehrere Eltern (Kreuzungen); offen, sobald ein Elter offen ist | A3 |
| Einheit | `aufgabe` | Satz (oder `{ "1": …, "2": … }` je Ziel-Stufe) statt der Standardsätze der nächsten Aufgabe | A10 |
| Baustein | `offen: true` | nur offene Einheiten zählen (`braucht` ist die Kurzform) | A8 |
| Plan | `stufen.bis` | höchste Stufe, die das Angebot vergibt (1 bis 4, Standard 4) | A10, A19 |
| Plan | `begriffe` | Wörter der Arten für die Sätze, z. B. `{ "episode": { "art": "die", "sg": "Reise", "pl": "Reisen" } }` | A10, A15 |
| `spielstand(…, opts)` | `ohneWartezeit`, `wer`, `bis` | Pausen überspringen, nur Ereignisse einer Kennung, höchste Stufe | A20 |
| `Spielplan.verbinde` | `lager`, `praefix`, `jetzt` | Speicherobjekt statt `localStorage` (Tests), anderes Präfix, Uhr | A16 |

### A23 · SCORM: Wiederaufnahme aus `suspend_data`
- **Stelle:** 7.1 („Ereignisse knapp in `suspend_data`; unter SCORM 1.2 nur 4096 Zeichen – dann nur Freischaltungen und Stufen“).
- **Lücke:** Der Spielstand ist eine Funktion der Ereignisse (Abschnitt 1). Aus „Stufen und Freischaltungen“ allein lässt er sich nicht berechnen.
- **Auslegung:** `suspend_data` hat drei Formen, die kürzeste, die in die Grenze passt (1.2: 4096, 2004: 64000 Zeichen), gewinnt. **E**: Ereignisse mit Tabelle der benutzten Einheiten-ids (lesbar
  auch nach einer Planänderung). **X**: dieselben Ereignisse mit Einheiten als Nummer in id-Reihenfolge und einem Hash der Einheiten (nur lesbar, solange die Einheiten dieselben sind). Je Ereignis Verb, Einheit,
  Minuten seit dem vorigen, `mit`, Belegart und Fall; kein `ergebnis`, keine Quelle. Gemessen an 205 Einheiten mit ids von 24 Zeichen: E braucht etwa 31 Zeichen je Ereignis (bis etwa 100 Ereignisse in 4096),
  X etwa 7 (bis etwa 550). **S**: eine Ziffer je Einheit, dazu die Freischaltungen und der Hash; Aus S entstehen **Ersatzereignisse** an den Blatt-Einheiten (Stufe 1 begonnen, 2 geschafft, 3 angewendet mit
  Fall `scorm-1`, 4 mit zwei Fällen), gestempelt mit dem Zeitpunkt der Wiederaufnahme. `completed` setzt der Adapter, wenn die Wurzel Stufe 2 erreicht (mehrere Wurzeln: Sammel-Regel über sie).
  Bei Unterbrechung setzt er `cmi.core.exit` bzw. `cmi.exit` auf `suspend`, sonst verwerfen manche Lernsysteme die Daten.
- **Grenze:** Aus Form S kommen Stufen und Freischaltungen zurück, **nicht** Wartezeit, Verwitterung und Wiederkehr (sie beginnen bei der Wiederaufnahme neu). Die Formen E und X haben Minutengenauigkeit.
  Beides ist nur gegen Attrappen getestet, nicht gegen ein echtes Lernsystem. Nicht umgesetzt: `session_time`, `score`, `mastery`.

### A24 · xAPI-Adapter (cmi5)
Der Adapter liest die Startparameter (`endpoint`, `fetch`, `actor`, `registration`, `activityId`), holt mit `fetch` einmal ein Zugangstoken, liest `LMS.LaunchData` und übernimmt `contextTemplate`,
sendet `initialized`, die Ereignisse und Freischaltungen, `completed` (Wurzel Stufe 2) und `terminated`. Jedes Statement liegt zuerst in einer gespeicherten Warteschlange; bei Ausfall (Netz, 5xx, 408, 429, 401, 403)
bleibt sie stehen und wird nachgereicht (auch beim Ereignis `online`), in Stapeln zu höchstens 50. Ein Statement, das der LRS mit 4xx ablehnt, wird einzeln ausgesondert (`verworfen`), 409 gilt als angekommen.
Nicht umgesetzt: `abandoned`, `waived`, `satisfied`, MoveOn-Kriterien, `returnURL`, `masteryScore`, Wiederholung nach Zeit (nur beim nächsten Ereignis oder Aufruf von `nachreichen()`). Nur gegen einen Mock-LRS getestet.

### A25 · Spielplan-Beispiel Kaffee (Anhang des Standards)
`docs/spielplan-beispiel-kaffee.yaml` ist wörtlich der Anhang, **unverändert**; der Test benutzt ihn so. Er genügt den Regeln des Standards bis auf zwei Stellen, die die Prüfung als Warnung meldet:
`erlebnis/roestung` trägt `braucht` (3.1: nur für `quest`), und `episode/weltmarkt` hat keinen Inhalt (4.1 sagt nichts über leere Sammel-Einheiten; ihre Stufe käme nur aus direkten Ereignissen).
Dazu die Frage, ob `in` für alle Arten außer `gebiet` Pflicht ist (3.1, Spalte „Für“): `werkzeug/roestkurve`, `skill/quellen` und `skill/roesten` haben keines; die Prüfung nimmt `in` als freiwillig.

### A26 · Konformitätsset
`docs/spielplan-konformitaet.json` enthält 22 Fälle (Plan, Ereignisse, `jetzt`, Optionen, erwartete Stufen, Zugänge, Takt, Freischaltungen mit Zeitpunkt, `verwittert`, `faellig`). Eine zweite Umsetzung des Standards
(Zwilling, Augenspiel, LearnDash-Brücke) rechnet sie nach; weicht sie ab, hat sie an einer der Stellen A1 bis A13 anders ausgelegt. Stufe, Zugang, Takt und Freischaltungen hat ein unabhängig geschriebenes
Orakel im Test bestätigt, `verwittert` und `faellig` nur der Kern. Erzeugt und auf Aktualität geprüft von `tools/spielplan-test.mjs` (`--schreibe-konformitaet`).

### Befunde zum Standard (aus dem Bau des Kerns)
Je Befund: Abschnitt, Problem, Beleg, Vorschlag. Reihenfolge nach Gewicht für die nächste Fassung.

| Nr | Abschnitt | Problem | Beleg | Vorschlag |
|---|---|---|---|---|
| B1 | 3.1 `in`, 5 | Eine Station auf mehreren Reisen (das Wesen des Museums) hat mehrere Eltern; der Zugang gesperrter Eltern erbt nicht. Wörtlich bräuchte jede der 205 Stationen eine eigene Regel. | `docs/AGENTEN.md` („dieselbe Station liegt auf mehreren Reisen“); Test „Zugang wird über in vererbt“ | `in` als Einheit oder Liste; in 5 den Satz zur Vererbung (A3) |
| B2 | 10 (Kopf) und 4.1 | `anteil: 0.67` ist nicht „zwei Drittel“: bei drei wesentlichen Einheiten verlangt 0.67 alle drei, zwei Drittel nur zwei. Auch die Rundung („zwei Drittel von zwei“) ist nicht gesagt. | Test „stufen.anteil … 0.67“ | `anteil: 2/3` im Beispiel, Rundung nach oben in 4.1 sagen |
| B3 | 5 und 5.4 | „Nennen mehrere Regeln dieselbe Einheit, genügt eine“ gegen „`nach` und `braucht` sind Kurzformen für Regeln“: Eine Quest mit beiden ergäbe ODER, gemeint ist UND (Zelda-Prinzip). | Test „braucht und nach an derselben Einheit“ | in 5.4 „mehrere Kurzformen an einer Einheit gelten zusammen“ (A5) |
| B4 | 4 und Abgleich, 4.2 | Der Abgleich sagt „zwei Fälle **oder** geteilt“, 4 sagt „angewendet **und** geteilt“. 4.2 reicht nur `geschafft` an Werkzeuge durch, dann sind Stufe 3 und 4 am Werkzeug (Ausrüstung = Anwendung auf neue Fälle) nur über direkte Meldungen am Werkzeug erreichbar. | A6, A7; Test „Werkzeug: Ereignisse über mit“ | 4 und 4.2 angleichen; `angewendet` mit Beleg und Fall ebenfalls durchreichen |
| B5 | 3 | `sorte: baustein` steht im Standard, nicht im Abgleich. | A18 | eine Liste für beide |
| B6 | 3.1 `adresse`, 3 | Beispiel `#/station/kaldi` ist in YAML ein Kommentar (Anführungszeichen nötig); Text sagt „einen `namen`“, das Feld heißt `name`. | `tools/yaml-lite.mjs` (Kommentar-Regel) | Beispiel in Anführungszeichen setzen |
| B7 | 3.1 und Anhang | `braucht` „für `quest`“, das Anhang-Beispiel setzt es an einem `erlebnis`. Unklar, ob `in` Pflicht ist (Beispiel: Werkzeug und Skills ohne). | A25; Warnungen der Prüfung | 3.1 ändern oder das Beispiel; „Pflicht/optional“ als Spalte |
| B8 | 4.1 | Stufe einer Sammel-Einheit ohne Mitglieder, nur mit optionalen Mitgliedern oder im Kreis (Episode übt Skill, der in ihr liegt) ist nicht bestimmt. | A4; Anhang: `episode/weltmarkt` | Festlegung A4 übernehmen |
| B9 | 5.1, 5.2, 7.1, 8 | Zeit-Bausteine (`wartezeit`) und Wiederkehr brauchen den **Zeitpunkt**, an dem eine Stufe erreicht wurde; Abschnitt 8 kennt nur Tage, 7.1 lässt unter SCORM 1.2 nur Stufen und Freischaltungen zu. Daraus lässt sich der Spielstand nicht wiederherstellen (Grundsatz: „Gespeichert werden nur die Ereignisse“). | A23, Test „Form S“ | in 7.1 sagen, dass dort Pausen, Verwitterung und Wiederkehr neu beginnen, oder Ereignisse knapp speichern (Form E) |
| B10 | 5.5 | Wiederkehr: Anfang der Folge, „neues Ereignis“, zu frühe Ereignisse, `fuer` ohne Angabe: offen. | A9 | A9 übernehmen |
| B11 | 5.6, 5.5 | „…oder ihr am nächsten bringt“ braucht ein Entfernungsmaß; „je Takt eine Aufgabe“ (5.5) und „genau eine Aufgabe“ (5.6) meinen zwei Dinge; woher der Satz „was sie bringt“ kommt, steht nirgends. | A10 | Entfernung = Zahl der Schritte; Sätze aus Vorlagen mit Überschreiben je Einheit |
| B12 | 5.4 und 6.1 | `braucht` verlangt „offen“, 6.1 sagt „Regeln lesen `freigeschaltet` nicht“. Wörtlich widerspricht sich das. Dazu: Stufe 1 heißt nur „angesehen“, nicht „benutzt“. | A8 | `offen` als Baustein-Feld; `braucht` mit Stufe 2? |
| B13 | 3.2, 4.1 | `gewicht` hängt an der Einheit, nicht an der Mitgliedschaft: Dieselbe Station kann in Reise A kritisch, in Reise B Nebensache sein. | Museum-Kreuzungen | `in: [{ id, gewicht }]` |
| B14 | 4, 9 | Das Museum kann Beleg und Transfer nicht prüfen; seine Sammel-Einheiten bleiben bei Stufe 2, „gemeistert“ ist unerreichbar. Der Standard kennt keine Obergrenze je App (nur in 11 für das Augenspiel als Randbemerkung). | A10, A19 | `stufen.bis` (umgesetzt) |
| B15 | 2 (Grundsatz 4), 5.1 | Eine erzwungene Wartezeit nimmt Autonomie; Grundsatz 4 will Vorschläge. | Lernlog-Notizen B7; A20 | Wartezeit als Empfehlung mit Überspringen (`ohneWartezeit`) |
| B16 | 8 | Beispiele nennen „3 Reisen“, der Standard hat kein Feld für die Wörter einer App („Reise“ für `episode`). | A15, A22 | `begriffe` (umgesetzt) |
| B17 | 5.3 | „Eine Einheit, die nie aufgehen kann, meldet die Prüfung als Fehler“ hängt davon ab, welche Stufen die App vergibt und ob Sammel-Einheiten direkte Ereignisse bekommen. | A19 | beides in der Prüfung benennen |
| B18 | 6.3, 10 | Verben (`…/spielplan/verben/…`), Erweiterungen (`…/ext/…`) und Arten liegen unter derselben Wurzel wie die Objekt-Adressen `basis + objekt`; ein Plan mit der id `ext` oder `verben` würde kollidieren. | A17 | Namensräume reservieren |
| B19 | 12 | Nicht beschrieben: mehrere Personen an einem Gerät (Klassenzimmer). `wer` ist ein Browser-Profil; `zuruecksetzen()` vergibt eine neue Kennung. | A16 | in 12 aufnehmen |


---

## Gehirnmuseum (kuratierte Schicht: `packs/gehirn/spielplan-kern.yaml`, Begründung und Zahlen: `docs/spielplan-gehirn.md`)

Kürzel: G = Gestaltung des Gehirnmuseums. „G-Befund n“ ist Befund n in `docs/spielplan-gehirn.md`, Abschnitt 14 (dort mit Beleg und Vorschlag).

### G1 · Station und Werkzeug sind dieselbe Sache
- **Stelle:** 3 (Arten `inhalt` und `werkzeug`), Lernlog-Abgleich.
- **Lücke:** 16 der 17 Werkzeuge sind der Stoff einer Station (ABC-Modell, Grounding, Hebb-Regel …). Inhalt („Modelle, Theorien“) und Ausrüstung („Modelle, Methoden, Heuristiken“) überschneiden sich; der Standard sagt nicht, wie das Paar gebildet wird.
- **Auslegung:** Die Station bleibt `inhalt` („ich kenne es“); das `werkzeug` ist die Anwendungsseite („ich habe es und setze es ein“) und geht **nach** der Station auf (eigene Regel mit `enthuellung`, nicht die Kurzform `nach`). Werkzeuge liegen in keinem Flügel (kein `in`). Das Feld `aus` hält die Herkunft fest.
- **Begründung:** Sonst zählte dieselbe Sache doppelt in den Sammelstufen. (G-Befund 1)

### G2 · Stufe 2 am Werkzeug heißt: an einem Ort eingesetzt
- **Stelle:** 4.2, A7.
- **Lücke:** Ausrüstung ist „Anwendung auf neue Fälle“; das Museum kann das nicht belegen (`stufen.bis: 2`). Was hebt ein Werkzeug auf Stufe 2?
- **Auslegung:** Jedes Werkzeug nennt `einsatz`: Orte (Exponat, Mythos-Karte, in einem Fall eine Station), an denen es zählt. Wer einen Ort `geschafft` meldet, das Werkzeug hat und den Einsatz **bestätigt**, meldet `mit: [werkzeug/…]`. Jedes Werkzeug hat mindestens einen Ort, damit der Kern nie eine unerfüllbare Aufgabe („Setze X ein“) nennt; vier Orte sind dafür erfunden (G-Befund 7).
- **Begründung:** Stufe 2 bleibt „geübt“; ohne bestätigten Einsatz wäre sie eine Behauptung des Spielplans.

### G3 · „Unabhängige Regeln“ heißt: zwei Wege ohne gemeinsame Einheit
- **Stelle:** 5, 5.3 (der Standard definiert den Begriff nicht).
- **Auslegung:** Zwei Regeln eines Ziels sind unabhängig, wenn es zwei Wege gibt, deren Einheiten sich nicht schneiden müssen. Geprüft mit dem Kern als Spieler: (1) Einheiten, ohne die eine Regel nie aufgeht („Engpässe“), und (2) konstruktiv: eine minimale Stützmenge der einen Regel verboten, die andere muss trotzdem aufgehen. Ergebnis: alle 11 gesperrten Ziele haben zwei disjunkte Wege; zwei Paare (Endgame-Reisen) teilen Kreuzungsstationen, ihr dritter Weg ist von beiden unabhängig. Reisen eines gesperrten Flügels erben dessen Sperre.
- **Begründung:** Ein einzelner nicht erreichbarer Schlüssel soll nie eine Reise für immer sperren. (G-Befund 13)

### G4 · Mythos-Karten sind nie kritisch
- **Stelle:** 3.2, 4.1, B13.
- **Lücke:** Gewicht gilt je Einheit; eine Mythos-Karte auf drei Reisen wäre in allen kritisch und koppelte Reisen, die sich nicht bedingen sollen (Beleg: zwei Endgame-Wege teilten die Karten „Phrenologie“ und „Herz“).
- **Auslegung:** Alle Mythos-Karten sind wesentlich. Bei den übrigen kritischen Kreuzungsstationen bleibt die Kopplung bestehen. (G-Befund 12)

### G5 · Die Schlüssel der Onboarding-Reise liegen auf kritischen Stationen
- **Stelle:** 3.3 (Onboarding), 5.6.
- **Lücke:** Die Aufgabe sortiert bei gleichem Abstand nach Gewicht, dann nach der Reihenfolge der Autorin. Ohne Eingriff springt sie nach zwei Stationen in eine andere Reise.
- **Auslegung:** Die vier ersten Schlüssel (Müller-Lyer, Kahneman und Tversky, Ankereffekt, Bestätigungsfehler) sind die kritischen Stationen der ersten Reise und stehen an der ersten, fünften, siebten und zehnten Stelle. Vier Momente in 12 bis 14 Minuten, in einer Reise. (G-Befund 3, 15)

### G6 · Fähigkeiten sind nie gesperrt
- **Stelle:** 5 (Grundsatz 5), 8.
- **Lücke:** Der Auftrag will Fähigkeiten als graue Flecken mit Bedingungssatz; eine Fähigkeit wird von keiner Regel genannt, `bedingung` gibt es nur für gesperrte Einheiten.
- **Auslegung:** Stufe 0 („Nebel“) mit dem `kann`-Satz und `fortschritt` (A14) ist der graue Fleck; das Wachsen der Stufe ist der Moment („Ich kann …“). (G-Befund 5)

### G7 · Eine Regel mit mehreren Alternativen hat eine Enthüllung
- **Stelle:** 5, 5.1.
- **Auslegung:** Bei `eine: [Station, Exponat]` ist der Text so gefasst, dass er für beide Wege stimmt. (G-Befund 6)

### G8 · Die Zwangspause kommt einmal und nur als Alternative
- **Stelle:** 5.1 (`wartezeit`), Grundsatz 4, Lernlog-Notizen B7.
- **Auslegung:** `erbe-pause` (3 Stunden nach der Reise Trauma **oder** „Grounding“ eingesetzt) neben einem wartezeitfreien zweiten Weg (`erbe-umsteigen`); „Freier Zugang“ überspringt sie (A20). (G-Befund 9)

### G9 · `art: werkzeug` zählt alle Werkzeuge
- **Stelle:** 5.1 (Baustein `art`).
- **Auslegung:** Weil jedes Werkzeug einen Einsatzort hat (G2), zählen `{ art: werkzeug, stufe: 2, mindestens: n }` in `ki-koffer` und `geist-mythen` ohne Sackgasse; das verborgene Werkzeug zählt mit, sobald es offen ist.
