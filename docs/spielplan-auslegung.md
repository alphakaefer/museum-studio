# Spielplan: Auslegung des Standards

Zum Spielplan-Standard (Format `spielplan/0`, Entwurf). Der Entwurf gehört nicht zu diesem Repository (die Datei `spielplan-standard.md` liegt nicht hier). Damit die Einträge ohne ihn lesbar sind, sagt jeder in der Zeile „Worum es geht“ mit eigenen Worten, welche Stelle des Entwurfs gemeint ist;
die Fassung dieser Umsetzung steht in `docs/SPIELPLAN-ARBEITSSTAND.md`. Hier steht **je Entscheidung: Worum es geht, Lücke, Auslegung, Begründung**, wo nötig mit
Vorschlag für den Standard. Der Standard selbst wird nie geändert. Jede Umsetzung hängt ihren Abschnitt an; fremde Einträge werden nicht verändert.
Wo der Standard dem Abgleich der Einheitenarten (Vorgabe des Auftrags: Arten, Stufen, Gewicht, Zeitbaustein) oder sich selbst widerspricht, gilt der Abgleich,
und der Widerspruch steht als **Befund**.

Kürzel: A = Auslegung, B = Befund zum Standard. Die Nummern gelten je Abschnitt.

---

## Kern (engine/js/spielplan.js, tools/check-spielplan.mjs, tools/yaml-lite.mjs)

Der Kern rechnet jede Stufe jeder Einheit und jede Freischaltung als **Zeitpunkt** („ab wann“), nicht als Zustand. Der Spielstand zu einem `jetzt`
vergleicht nur Zeitpunkte mit `jetzt`. Daraus folgen mehrere Entscheidungen unten fast von selbst: Die Regel, dass Bedingungen nur wahr werden können, gilt ohne Sonderfall, die Zeit-Bausteine
rechnen auf Stunden genau, und jede Freischaltung hat ihr „seit“, ohne dass etwas zusätzlich gespeichert wird.

### A1 · Zeit: `jetzt`, UTC, Stunden statt Tage
- **Worum es geht:** der Begriff `heute`, die Zeit-Bausteine `ab` und `wartezeit` (in Stunden), die Regel, dass Zeit Bedingungen nur wahr macht, und das Datum `stand` im Spielstand.
- **Lücke:** In welcher Zeitzone beginnt ein Tag, ein Takt? Was ist `heute`, wenn die Wartezeit Stunden kennt?
- **Auslegung:** `spielstand(plan, ereignisse, jetzt)` nimmt einen Zeitpunkt: ISO-8601-Text (ohne Offset gilt UTC), `Date` oder Millisekunden.
  Ein reines Datum gilt als 00:00 UTC. Tage und Takte beginnen um 00:00 UTC (der Takt eines Spielers beginnt am Kalendertag seines ersten Ereignisses,
  Wochen dauern 7 Tage ab diesem Tag, Monate sind Kalendermonate). `stand` im Spielstand ist das UTC-Datum, dazu `jetzt` als voller Zeitpunkt.
  Ohne `jetzt` gilt die Uhr; das ist die einzige Unreinheit der Funktion, die Brücke übergibt immer einen Zeitpunkt.
- **Begründung:** Eine reine Funktion braucht eine feste Zeitzone, sonst rechnen zwei Geräte verschieden. UTC ist die einzige, die überall gleich ist.
  Stunden-Genauigkeit ist nötig, weil die Zwangspause („3 Stunden“) der Lern-Heldenreise sonst nicht ausdrückbar ist. Die Regel, dass Bedingungen nur wahr werden können, bleibt gewahrt: Alle Zeit-Bausteine
  (`ab`, `takt`, `wartezeit`) werden mit der Zeit nur wahr.
- **Grenze:** Für Spieler in Deutschland beginnt der Tag um 1 oder 2 Uhr. Wer einen lokalen Tagesbeginn braucht, braucht ein Feld `zeitzone` im Spielplan (Vorschlag für `spielplan/1`).

### A2 · Die Stufe hängt nicht vom Zugang ab
- **Worum es geht:** das Verhältnis von Stufen (Fortschritt) und Zugang (Freischaltung).
- **Lücke:** Zählt ein Ereignis an einer noch gesperrten Einheit (aus einem anderen Gerät, bei „Freier Zugang“)?
- **Auslegung:** Ja. Die Stufe ist eine reine Funktion der Ereignisse; der Zugang ist eine Funktion der Stufen. Nichts geht verloren (Grundsatz: Ereignisse zählen immer).
  Nur die Kurzform `braucht` verlangt zusätzlich, dass das Werkzeug offen ist (A8).
- **Begründung:** Mit „Stufe zählt nur, wenn offen“ würde ein Spieler, der im freien Zugang alles durchspielt, nichts freischalten. So schaltet sich nach einem
  Durchgang im freien Zugang alles auf, was die Regeln hergeben.

### A3 · Zugang wird über `in` vererbt; `in` darf eine Liste sein
- **Worum es geht:** das Feld `in` (übergeordnete Einheit) und die Grundregel, dass eine Einheit offen ist, solange keine Regel sie als Ziel nennt.
- **Lücke:** Sind die Stationen einer gesperrten Reise offen? Und eine Station, die auf mehreren Reisen liegt (das Wesen des Museums), hat sie mehrere Eltern?
- **Auslegung:** Eine Einheit ist offen, wenn (a) keine Regel sie nennt oder eine ihrer Regeln erfüllt ist, **und** (b) sie keine Eltern hat oder mindestens ein Elter offen ist.
  `in` darf ein Text oder eine Liste von Texten sein. Alle Eltern zählen die Einheit als Mitglied (Sammel-Regel). `freigeschaltet` nennt nur Einheiten, die eine Regel nennt,
  nicht die geerbten. `bedingung` sagt bei geerbter Sperre: „Zum Öffnen: „Handel“ muss offen sein („Von der Pflanze zur Tasse“ geschafft).“ (Beispiel: Kaffee-Beispiel, eine Einheit im gesperrten Gebiet Handel.) Verborgen (`sichtbar`) vererbt sich ebenso.
- **Begründung:** Ohne Vererbung bräuchte jede Station eine eigene Regel. Mit nur einem Elter würde eine Kreuzungsstation nur für ihre Heimat-Reise zählen.
- **Vorschlag für den Standard:** Beim Feld `in` „Einheit oder Liste“ erlauben und bei den Regeln einen Satz zur Vererbung ergänzen (B1).

### A4 · Sammel-Einheiten: Randfälle
- **Worum es geht:** die Sammel-Regel: die Stufe einer Einheit, die Mitglieder hat.
- **Lücke:** Was gilt ohne kritische und ohne wesentliche Mitglieder? Wie wird „zwei Drittel“ gerundet? Was bei Kreisen (eine Episode `uebt` einen Skill, der in ihr liegt)?
- **Auslegung:** (1) Ohne kritische und ohne wesentliche Mitglieder gibt es nichts zu messen: die Stufe kommt nur aus direkten Ereignissen (sonst wäre die leere Menge „zu 100 %“ erfüllt).
  (2) `ceil(n · anteil)`; der Standardanteil ist **exakt** zwei Drittel (n=3 → 2, n=6 → 4); ein angegebener Anteil wird auf `ceil(n · anteil − 1e-9)` gerechnet.
  Anteil als Text `"2/3"` ist erlaubt. (3) Kreise werden von unten aufgelöst: Eine Stufe, die nur durch den Kreis getragen würde, gilt nicht.
  (4) Mitglieder, die selbst Sammel-Einheiten sind, zählen mit ihrer berechneten Stufe.
- **Begründung:** Die Stufe muss eine eindeutige Funktion sein, unabhängig von der Reihenfolge des Rechnens.
- **Befund B2:** Der Kopf-Beispielwert `stufen: { anteil: 0.67 }` (im Kopfbeispiel des Entwurfs) widerspricht „zwei Drittel“: Bei 3 wesentlichen Einheiten verlangt 0.67 drei statt zwei
  (`ceil(2.01)`). `check-spielplan` warnt davor. Vorschlag: im Beispiel `anteil: 2/3` oder `0.66`.

### A5 · `nach` und `braucht` an derselben Einheit
- **Worum es geht:** die Kurzformen `nach` und `braucht` (jede steht für eine Regel) und die Grundregel, dass mehrere Regeln am selben Ziel Alternativen sind.
- **Lücke:** Eine Quest mit `nach: episode/a` und `braucht: [werkzeug/w]` ergäbe wörtlich zwei Regeln, von denen eine genügt (ODER), weil Regeln am selben Ziel Alternativen sind. Gemeint ist aber UND (Schlüssel und Werkzeug, wie in Abenteuerspielen).
- **Auslegung:** Die Kurzformen derselben Einheit werden zu **einer** Regel mit „alle“ verbunden (`kurz/<id>`). Erst mehrere Regeln (`regeln:` oder Kurzform plus Regel) sind Alternativen.
- **Begründung:** Wer `nach` und `braucht` an eine Einheit schreibt, will beides.
- **Befund B3:** Die Beschreibung der Kurzformen und die der Alternativen widersprechen sich für diesen Fall. Vorschlag: bei den Kurzformen festhalten, dass mehrere Kurzformen an einer Einheit zusammen gelten.

### A6 · Stufe 3 und 4: Beleg, Fall, Transfer
- **Worum es geht:** die Stufentabelle, das Feld `beleg.fall` der Ereignisse in Kurzform und die Vorgabe des Abgleichs der Einheitenarten für Stufe 4 (zwei verschiedene Fälle, alternativ Weitergeben, also `geteilt`).
- **Lücke:** Was ist ein „Fall“? Reicht `geteilt` allein? Zählt `angewendet` ohne Beleg?
- **Auslegung:** Ein **Fall** ist `beleg.fall` (Kennung), verglichen ohne Leerzeichen am Rand und ohne Groß-/Kleinschreibung. Stufe 4 braucht zwei verschiedene Fälle **oder**
  `angewendet` (mit Beleg) **und** `geteilt`, in beliebiger Reihenfolge. Ein Beleg ohne `fall` zählt für Stufe 3, aber nie als einer der zwei Fälle.
  `geteilt` allein ergibt Stufe 1 (berührt), `angewendet` ohne gültigen Beleg (`art` aus messung, bestaetigung, eigen) ergibt Stufe 2.
  Höhere Stufen schließen niedrigere ein (angewendet ohne vorheriges `geschafft` ist Stufe 3).
- **Begründung:** Der Abgleich lässt Weitergeben als Alternative zu, der Standard verlangt Anwendung und Weitergeben zusammen; die Treppe der Stufen (Stufe 4 setzt 3 voraus) spricht für das Zweite.
  Ohne feste Bedeutung von „Fall“ ließe sich Stufe 4 durch denselben Beleg doppelt melden.
- **Befund B4:** Abgleich und Stufentabelle sagen nicht dasselbe über `geteilt`. Auch inhaltlich ist offen, ob Weitergeben ein Merkmal von Transfer ist
  oder nur ein Zeichen für Anwendung; der Kern folgt der strengeren Lesart des Standards (Anwendung und Weitergeben).

### A7 · Werkzeug-Ereignisse über `mit`
- **Worum es geht:** das Durchreichen an Werkzeuge: Meldet eine Quest `geschafft` und nennt dabei ein Werkzeug, zählt das auch für das Werkzeug.
- **Lücke:** Gilt das auch für `bestanden` und `angewendet`? Wie kommt ein Werkzeug auf Stufe 3 und 4 (Ausrüstung = Anwendung auf **neue Fälle**)?
- **Auslegung:** `geschafft`, `bestanden` und `angewendet` (samt Beleg und Fall) werden an jedes genannte **Werkzeug** durchgereicht; `begonnen`, `erkundet`, `geteilt` nicht.
  `mit` nennt nur Werkzeuge; anderes wird ignoriert.
- **Begründung:** Sonst wäre Transfer (zwei Fälle) am Werkzeug nur über direkte Meldungen am Werkzeug möglich, obwohl es im Einsatz an Quests benutzt wird.

### A8 · `braucht`: „offen und schon einmal benutzt“
- **Worum es geht:** die Kurzform `braucht`.
- **Auslegung:** Bausteine kennen ein Feld `offen: true` („nur offene Einheiten zählen“). `braucht` ist die Kurzform dafür mit Stufe 1.
- **Begründung:** Dem Sinn nach verlangt `braucht`, dass das Werkzeug offen und schon einmal benutzt ist; nach A2 allein reicht Stufe 1 nicht.
- **Vorschlag:** `offen` als Feld der Bedingungs-Bausteine aufnehmen.

### A9 · Wiederkehr
- **Worum es geht:** die Wiederkehr im Abschnitt zum Takt: Sie wird nach dem nächsten Abstand seit dem letzten Ereignis fällig und gilt als erfüllt, wenn jeder Abstand durch ein neues Ereignis eingelöst wurde.
- **Lücke:** Von wann an? Was ist ein „neues Ereignis“? Zählen zu frühe Ereignisse?
- **Auslegung:** Wiedersehen kann man, was man geübt hat: Die Folge beginnt, wenn die Einheit Stufe 2 erreicht (`t0`). Jedes spätere Ereignis an der Einheit (bei Sammel-Einheiten:
  an ihren Mitgliedern) setzt „das letzte Ereignis“ neu; liegt es mindestens den nächsten Abstand nach dem vorigen, ist dieser Abstand eingelöst. Fällig ist die Einheit,
  wenn `letztes + nächster Abstand ≤ jetzt`. Nach dem letzten Abstand ist die Wiederkehr erfüllt (`eingeloest`). Wer lange weg war, bekommt **eine** fällige Wiederkehr,
  keine Rückstandsliste. Fehlt `fuer`, gelten alle Einheiten.
- **Begründung:** Ein zu früh gemeldetes Ereignis ist kein Wiedersehen, setzt aber die Uhr zurück („seit ihrem letzten Ereignis“); so kann niemand eine Wiederholung erzwingen und niemand wird gemahnt.

### A10 · Nächste Aufgabe
- **Worum es geht:** die Regel, dass genau eine nächste Aufgabe genannt wird.
- **Lücke:** Was heißt „am nächsten bringen“ an einer Regel, die noch nicht erfüllt ist (ein Entfernungsmaß fehlt)? Wie vergleicht man `reihenfolge` über Eltern hinweg? Wie kommt der Satz zustande?
- **Auslegung:** (1) Fällig ist die längst fällige Wiederkehr; bei Sammel-Einheiten ist die Aufgabe das am längsten nicht berührte Mitglied. (2) Für jede unerfüllte Regel mit gesperrtem Ziel
  wird gerechnet, wie viele **Schritte** (Stufen an offenen, aktionsfähigen Einheiten) sie noch braucht; die Regel mit den wenigsten gewinnt, die Aufgabe ist ein Schritt darin.
  Wo eine Regel eine Auswahl lässt (zwei von sechzehn Reisen, zwei Drittel der Stationen einer Reise), gilt: Erledigtes zuerst, dann Angefangenes (das Nächstliegende zuerst), dann Unberührtes in der Reihenfolge der
  Autorin. Der Satz „bringt“ heißt bei einem Schritt „Danach geht das Werkzeug „X“ auf.“, bei mehreren Stufen an einer Einheit „Noch 2 Schritte, dann geht …“ und bei mehreren Einheiten „Noch 33 Stationen, dann
  geht die Reise „X“ auf.“ (`noch` zählt Stufen, `noch_einheiten` Einheiten). Regeln, die nur noch auf Zeit warten, sind keine Aufgabe
  (sie stehen in `wartet`). (3) Sonst nach Gewicht, dann `reihenfolge` **entlang der Eltern** (Pfad von der Wurzel), dann höhere Stufe zuerst, dann id. Erst bis Stufe 2 (Hauptpfad),
  danach darüber hinaus bis `stufen.bis`. Verborgene Ziele werden nie genannt („Danach geht etwas Neues auf.“).
  `reihenfolge` zählt entlang der Eltern, aber nur, wo eine Nummer steht; wer die Reihenfolge der Reise (statt „alle Mythos-Karten zuerst“) will, gibt gleiches Gewicht, denn Gewicht geht vor Reihenfolge.
- **Begründung:** Sonst wäre die Reihenfolge von der Dateireihenfolge abhängig. Aktionsfähig sind Einheiten ohne Mitglieder der Arten inhalt, quest, erlebnis, werkzeug, episode;
  Gebiete und Skills werden nie „gemacht“, sondern ergeben sich.
- **Erweiterungen:** `stufen.bis` (höchste Stufe, die das Angebot vergibt, Standard 4; das Museum kann Beleg und Transfer nicht prüfen und setzt 2), optionales Feld `aufgabe` an einer Einheit
  (Satz oder Sätze je Stufe), optionales `begriffe` im Plan (z. B. episode → „Reise“) für die Sätze.

### A11 · Verwitterung
- **Worum es geht:** die Verwitterung: Stufen, die ohne Wiedersehen verblassen.
- **Auslegung:** Verwittert ist eine Einheit mit Stufe ≥ 1, deren letztes Ereignis (bei Sammel-Einheiten: das jüngste an ihr oder ihren Mitgliedern) länger als `verfall_tage` her ist.
  Stufe und Freischaltung bleiben. Einheiten ohne Ereignis verwittern nicht (es gibt nichts, was verwittern könnte). Eine verwitterte Einheit kann als Wiederkehr-Aufgabe erscheinen (so sieht es der Entwurf vor): Sie steht in der
  Reihenfolge von A10 (1) neben den fälligen, seit dem Tag, an dem sie verwittert ist (bei gesetzter Wiederkehr nur, wenn `fuer` sie trifft).

### A12 · Ereignisse sind Strings und Kennungen, nie Inhalte
- **Worum es geht:** die Kurzform der Ereignisse und die Zusage, dass nur Kennungen gespeichert werden, keine freien Texte.
- **Auslegung:** Die Brücke nimmt `melde()` nur an, wenn Verb und Objekt stimmen; `freigeschaltet` darf keine App melden. `ergebnis` behält nur Zahlen (`dauer_s`, `punkte`, `max`) und `erfolg`.
  `beleg.quelle` und `fall` müssen Kennungen sein (a–z, 0–9, `-_:./`, Fall höchstens 64 Zeichen): alles andere (Namen, Sätze) wird weggelassen, der Beleg bleibt. Ein Fall mit Leerzeichen
  ist also kein Fall und ergibt keinen Transfer. Gleiche Ereignisse binnen einer Minute werden nicht doppelt gespeichert. Ab 4000 gespeicherten Ereignissen verdichtet die Brücke `begonnen` und `erkundet`: je Einheit bleiben das erste und das letzte (Stufen und Zeitpunkte ändern sich dadurch nicht, nur zwischenliegende Wiederholungen der Wiederkehr entfallen).
- **Begründung:** Der Entwurf schließt freie Texte aus; der Kern setzt es durch, statt es der App zu überlassen.

### A13 · Ereignisse aus der Zukunft, unlesbare Ereignisse
- **Auslegung:** Ereignisse mit `zeit` nach `jetzt` (falsche Uhr) zählen, aber mit `zeit = jetzt` (nichts geht verloren). Ereignisse mit unbekanntem Verb, unbekanntem Objekt, unlesbarer Zeit oder dem
  abgeleiteten Verb `freigeschaltet` werden übersprungen und im Spielstand unter `ignoriert` mit Grund genannt. Der Kern wirft dabei nie.
- **Grenze der Regel, dass Bedingungen nur wahr werden:** Für Ereignisse aus der Zukunft rechnet eine Wartezeit ab dem jeweiligen `jetzt` statt ab der angegebenen Zeit; sie verschiebt sich also, solange die Uhr dahinter liegt.
  Stufen sinken und Einheiten gehen dabei nie wieder zu (getestet mit Zufallsereignissen nach `jetzt`). Die Brücke stempelt Ereignisse mit der eigenen Uhr, erzeugt solche Ereignisse also nicht; sie
  entstehen nur durch `importiere` aus fremden Quellen oder `melde(…, { zeit })`.

### A14 · Erweiterungen des Spielstands
Zusätzlich zum Spielstand, den der Entwurf beschreibt: je Einheit `art`, `letzte`, `seit` (wann aufgegangen), `fortschritt` (Sammel-Einheiten: wie viele kritische, wesentliche, optionale Mitglieder die nächste Stufe haben),
`wiederkehr`; oben `bis`, `wartet` (laufende Pausen), `nebenquests`, `ignoriert`, `rueckblick.vorher` (der vorige Takt; zu Beginn eines Taktes ist der aktuelle leer),
`freigeschaltet[].enthuellung/art/name` (Kurzformen bekommen einen Standardsatz). `aufgabe` bekommt `art` (regel, weiter, wiederkehr), `stufe`, `adresse`, `regel`/`oeffnet`/`noch` bzw. `faellig`.

### A15 · Bedingung als Satz
`bedingung` an gesperrten, angedeuteten Einheiten: „Zum Öffnen: …“ mit dem, was fehlt: „3 Reisen geschafft – 1 fehlt“, „„X“ angewendet“, „ab dem 24.12.2026“, „noch 1 Std. 30 Min. Pause nach „X““.
`alle` nennt nur das noch Fehlende; `eine` nennt die Alternativen. Bei verborgenen Einheiten gibt es **keinen** Satz (Grundsatz: Verborgenes wird nicht verraten), auch nicht versehentlich.

### A16 · Brücke
`verbinde({ plan, app, speicher, praefix, jetzt, lager })`: Speicher `lokal` unter `<praefix><plan.id>:ereignisse|wer|gesehen` (Standardpräfix `gm:sp:`), ohne erreichbaren Speicher Arbeitsspeicher.
`wer` ist `lokal:` plus acht Hexzeichen; `zuruecksetzen()` löscht alles und vergibt eine neue Kennung. `bei('freigeschaltet')` feuert für jede Freischaltung einmal (ein Merkzettel `gesehen`, je Einheit einmal, im
Speicher verhindert Wiederholungen nach dem Neuladen, auch für Freischaltungen durch Zeit, die erst beim nächsten Öffnen auffallen). `aktualisiere()` rechnet mit der Uhr neu.
`horche(fenster, { erlaubt })` nimmt `postMessage({ type: 'sp:melde', verb, objekt, … })` aus Übungen im iframe an, standardmäßig nur von der eigenen Herkunft (unter `file://` „null“ gegen „null“), sonst nach `erlaubt(ereignis)`.
`speicher` darf eine Liste sein (`['lokal', adapter]`); mit `nur_lokal: true` verweigert die Brücke jeden anderen Adapter (die Zusage „nur lokal“). Die Seite sendet nichts; die Adapter laden nur Anwendungen,
die `spielplan-adapter.js` selbst einbinden.

### A17 · xAPI-Übersetzung
`nachXapi(ereignis, plan, opts)`: `object.id` = `basis` + `objekt`; ohne `basis` ersatzweise `urn:spielplan:<id>:`. `actor.account.homePage` = `basis`; `verb.display` = {de: Verb}; `result` aus `ergebnis`
(`completion` bei geschafft und bestanden, `success` bei bestanden, `duration` als ISO-8601-Dauer, `score`); `beleg` und `mit` als Erweiterungen unter `<vokabular>ext/…` (Wurzel `<vokabular>`: siehe H1);
`app` als `grouping`-Aktivität (= `basis` oder `opts.activityId`) und als Erweiterung; zusätzlich `parent` (die erste Eltern-Einheit). Die Statement-`id` ist ein UUID-förmiger Hash des Inhalts,
damit Nachreichen nichts doppelt anlegt.

### A18 · `sorte: baustein`
Der Standard nennt `baustein` als Sorte (Absatz unter der Artentabelle der Einheiten), der Abgleich der Einheitenarten nicht. Die Prüfung warnt bei jeder Sorte außerhalb von modell, methode, heuristik, technik, app
(ein Fehler wäre zu streng, denn an der Rechnung ändert die Sorte nichts). **Befund B5:** Widerspruch zwischen Abgleich und Standard. Anwendungen, die Werkzeuge als zusammensetzbare Bausteine verstehen, brauchen die Sorte.

### A19 · Prüfung (Erreichbarkeit)
Die Prüfung spielt in einer Simulation alles bis `stufen.bis` durch, was offen ist, und wartet beliebig lange; Einheiten, die dabei nie aufgehen, sind Fehler (mit Ursache: unbekannt,
Stufe über `bis`, Takt fehlt, hängt von etwas Unerreichbarem ab, **Zyklus ohne Einstieg**). Eine zweite, vorsichtige Simulation gibt Sammel-Einheiten mit Inhalt keine direkten Ereignisse;
was nur in der ersten aufgeht, ist eine Warnung („geht nur auf, wenn direkt an einer Sammel-Einheit gemeldet wird“). Kritische Einheiten, die nie aufgehen, blockieren ihre Sammlungen
für immer und werden eigens genannt (eine Sperre durch eine einzige unerreichbare Einheit ist der schlimmste Fall der Erreichbarkeit).

### A20 · Wartezeit überspringen
`spielstand(…, { ohneWartezeit: true })` rechnet Pausen als vorbei, sobald die Stufe erreicht ist. Das ist der Haken für „Freier Zugang“, damit die Zwangspause ein Vorschlag bleibt
(Grundsatz: Vorschläge statt Zwang; Befund B15).

### A21 · YAML-Leser
`tools/yaml-lite.mjs` liest die Teilmenge, die die Beispiele brauchen. Bekannte Unterschiede zu YAML 1.2: Zahlen mit führenden Nullen sind Zahlen (`007` → 7); `yes`/`no`/`on`/`off` sind Text;
Anker, Aliase, Tags, mehrere Dokumente, komplexe Schlüssel, mehrzeilige Zeichenketten ohne `|`/`>` sind Fehler mit Zeilennummer. **Befund B6:** `adresse: #/station/kaldi` (Beispiel bei den Feldern der Einheiten) ist in YAML
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
- **Worum es geht:** die SCORM-Anbindung: Ereignisse knapp in `suspend_data`; unter SCORM 1.2 reichen 4096 Zeichen nur für Freischaltungen und Stufen.
- **Lücke:** Der Spielstand ist eine Funktion der Ereignisse (Grundsatz des Entwurfs). Aus „Stufen und Freischaltungen“ allein lässt er sich nicht berechnen.
- **Auslegung:** `suspend_data` hat drei Formen, die kürzeste, die in die Grenze passt (1.2: 4096, 2004: 64000 Zeichen), gewinnt. **E**: Ereignisse mit Tabelle der benutzten Einheiten-ids (lesbar
  auch nach einer Planänderung). **X**: dieselben Ereignisse mit Einheiten als Nummer in id-Reihenfolge und einem Hash der Einheiten (nur lesbar, solange die Einheiten dieselben sind). Je Ereignis Verb, Einheit,
  Minuten seit dem vorigen, `mit`, Belegart und Fall; kein `ergebnis`, keine Quelle. Gemessen an Einheiten-ids von 24 Zeichen: E braucht etwa 31 Zeichen je Ereignis (bis etwa 100 Ereignisse in 4096),
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
`docs/spielplan-beispiel-kaffee.yaml` folgt dem kleinen Beispiel am Ende des Standards (Kaffee-Museum); geändert ist nur die `basis` (neutrale Adresse, siehe H1). Der Test benutzt es so. Es genügt den Regeln des Standards bis auf zwei Stellen, die die Prüfung als Warnung meldet:
`erlebnis/roestung` trägt `braucht` (laut Feldtabelle nur für `quest`), und `episode/weltmarkt` hat keinen Inhalt (die Sammel-Regel sagt nichts über leere Sammel-Einheiten; ihre Stufe käme nur aus direkten Ereignissen).
Dazu die Frage, ob `in` für alle Arten außer `gebiet` Pflicht ist (Spalte „Für“ der Feldtabelle): `werkzeug/roestkurve`, `skill/quellen` und `skill/roesten` haben keines; die Prüfung nimmt `in` als freiwillig.

### A26 · Konformitätsset
`docs/spielplan-konformitaet.json` enthält 22 Fälle (Plan, Ereignisse, `jetzt`, Optionen, erwartete Stufen, Zugänge, Takt, Freischaltungen mit Zeitpunkt, `verwittert`, `faellig`). Eine zweite, unabhängige Umsetzung des Standards
(eine andere App, ein Lernsystem-Plugin) rechnet sie nach; weicht sie ab, hat sie an einer der Stellen A1 bis A13 anders ausgelegt. Stufe, Zugang, Takt und Freischaltungen hat ein unabhängig geschriebenes
Orakel im Test bestätigt, `verwittert` und `faellig` nur der Kern. Erzeugt und auf Aktualität geprüft von `tools/spielplan-test.mjs` (`--schreibe-konformitaet`).

### Befunde zum Standard (aus dem Bau des Kerns)
Je Befund: Worum es geht, Problem, Beleg, Vorschlag. Reihenfolge nach Gewicht für die nächste Fassung.

| Nr | Worum es geht | Problem | Beleg | Vorschlag |
|---|---|---|---|---|
| B1 | Feld `in`, Grundregel zum Zugang | Eine Station auf mehreren Reisen (das Wesen des Museums) hat mehrere Eltern; der Zugang gesperrter Eltern erbt nicht. Wörtlich bräuchte jede Station eine eigene Regel. | `docs/AGENTEN.md` („dieselbe Station liegt auf mehreren Reisen“); Test „Zugang wird über in vererbt“ | `in` als Einheit oder Liste; bei den Regeln den Satz zur Vererbung (A3) |
| B2 | Kopfbeispiel, Sammel-Regel | `anteil: 0.67` ist nicht „zwei Drittel“: bei drei wesentlichen Einheiten verlangt 0.67 alle drei, zwei Drittel nur zwei. Auch die Rundung („zwei Drittel von zwei“) ist nicht gesagt. | Test „stufen.anteil … 0.67“ | `anteil: 2/3` im Beispiel, Rundung nach oben bei der Sammel-Regel sagen |
| B3 | Alternativen, Kurzformen | Mehrere Regeln am selben Ziel sind Alternativen, `nach` und `braucht` sind Kurzformen für Regeln: Eine Quest mit beiden ergäbe ODER, gemeint ist UND (Zelda-Prinzip). | Test „braucht und nach an derselben Einheit“ | bei den Kurzformen festhalten, dass mehrere an einer Einheit zusammen gelten (A5) |
| B4 | Stufentabelle, Abgleich, Durchreichen | Der Abgleich lässt für Stufe 4 „zwei Fälle oder Weitergeben“ zu, die Stufentabelle verlangt Anwendung und Weitergeben. Das Durchreichen betrifft nur `geschafft`, dann sind Stufe 3 und 4 am Werkzeug (Ausrüstung = Anwendung auf neue Fälle) nur über direkte Meldungen am Werkzeug erreichbar. | A6, A7; Test „Werkzeug: Ereignisse über mit“ | Stufentabelle und Durchreichen angleichen; `angewendet` mit Beleg und Fall ebenfalls durchreichen |
| B5 | Sorten der Werkzeuge | `sorte: baustein` steht im Standard, nicht im Abgleich. | A18 | eine Liste für beide |
| B6 | Felder `adresse` und `name` | Beispiel `#/station/kaldi` ist in YAML ein Kommentar (Anführungszeichen nötig); Text sagt „einen `namen`“, das Feld heißt `name`. | `tools/yaml-lite.mjs` (Kommentar-Regel) | Beispiel in Anführungszeichen setzen |
| B7 | Feldtabelle, Anhang-Beispiel | `braucht` „für `quest`“, das Anhang-Beispiel setzt es an einem `erlebnis`. Unklar, ob `in` Pflicht ist (Beispiel: Werkzeug und Skills ohne). | A25; Warnungen der Prüfung | Feldtabelle oder Beispiel ändern; „Pflicht/optional“ als Spalte |
| B8 | Sammel-Regel | Stufe einer Sammel-Einheit ohne Mitglieder, nur mit optionalen Mitgliedern oder im Kreis (Episode übt Skill, der in ihr liegt) ist nicht bestimmt. | A4; Anhang: `episode/weltmarkt` | Festlegung A4 übernehmen |
| B9 | Zeit-Bausteine, Spielstand, SCORM-Speicher | Zeit-Bausteine (`wartezeit`) und Wiederkehr brauchen den **Zeitpunkt**, an dem eine Stufe erreicht wurde; die Beschreibung des Spielstands kennt nur Tage, die SCORM-Anbindung lässt unter 1.2 nur Stufen und Freischaltungen zu. Daraus lässt sich der Spielstand nicht wiederherstellen (Grundsatz: Gespeichert werden nur Ereignisse). | A23, Test „Form S“ | bei der SCORM-Anbindung sagen, dass dort Pausen, Verwitterung und Wiederkehr neu beginnen, oder Ereignisse knapp speichern (Form E) |
| B10 | Wiederkehr | Wiederkehr: Anfang der Folge, „neues Ereignis“, zu frühe Ereignisse, `fuer` ohne Angabe: offen. | A9 | A9 übernehmen |
| B11 | Nächste Aufgabe, Takt | Die Wahl der Regel, die dem Ziel am nächsten bringt, braucht ein Entfernungsmaß; „eine Aufgabe je Takt“ und „genau eine nächste Aufgabe“ meinen zwei Dinge; woher der Satz „was sie bringt“ kommt, steht nirgends. | A10 | Entfernung = Zahl der Schritte; Sätze aus Vorlagen mit Überschreiben je Einheit |
| B12 | Kurzform `braucht`, abgeleitetes Verb `freigeschaltet` | `braucht` verlangt, dass die Einheit offen ist; der Entwurf sagt aber auch, dass Regeln das abgeleitete Verb `freigeschaltet` nicht lesen. Das widerspricht sich. Dazu: Stufe 1 heißt nur „angesehen“, nicht „benutzt“. | A8 | `offen` als Baustein-Feld; `braucht` mit Stufe 2? |
| B13 | Gewicht, Sammel-Regel | `gewicht` hängt an der Einheit, nicht an der Mitgliedschaft: Dieselbe Station kann in Reise A kritisch, in Reise B Nebensache sein. | Museum-Kreuzungen | `in: [{ id, gewicht }]` |
| B14 | Stufen, Grenzen je App | Das Museum kann Beleg und Transfer nicht prüfen; seine Sammel-Einheiten bleiben bei Stufe 2, „gemeistert“ ist unerreichbar. Der Standard kennt keine Obergrenze je App (nur als Randbemerkung zu einer anderen App). | A10, A19 | `stufen.bis` (umgesetzt) |
| B15 | Grundsatz „Vorschläge statt Zwang“, Zeit-Bausteine | Eine erzwungene Wartezeit nimmt Autonomie; der Grundsatz will Vorschläge. | A20 | Wartezeit als Empfehlung mit Überspringen (`ohneWartezeit`) |
| B16 | Beispiele zum Spielstand | Beispiele nennen „3 Reisen“, der Standard hat kein Feld für die Wörter einer App („Reise“ für `episode`). | A15, A22 | `begriffe` (umgesetzt) |
| B17 | Erreichbarkeits-Prüfung | Die Regel, dass die Prüfung Einheiten, die nie aufgehen können, als Fehler meldet, hängt davon ab, welche Stufen die App vergibt und ob Sammel-Einheiten direkte Ereignisse bekommen. | A19 | beides in der Prüfung benennen |
| B18 | xAPI-Übersetzung, Kopfbeispiel | Verben (`…/spielplan/verben/…`), Erweiterungen (`…/ext/…`) und Arten liegen unter derselben Wurzel wie die Objekt-Adressen `basis + objekt`; ein Plan mit der id `ext` oder `verben` würde kollidieren. | A17 | Namensräume reservieren |
| B19 | Grenzen des Entwurfs | Nicht beschrieben: mehrere Personen an einem Gerät (Klassenzimmer). `wer` ist ein Browser-Profil; `zuruecksetzen()` vergibt eine neue Kennung. | A16 | bei den Grenzen aufnehmen |


---

## Kuratierte Schicht eines großen Museums (Gestaltungsentscheidungen, verallgemeinert)

Kürzel: G = Gestaltungsentscheidung. Diese Einträge stammen aus dem Prototyp eines großen Museums mit handgepflegtem Spielplan. Die Daten dieses Prototyps liegen nicht in diesem Repository;
hier steht nur, was sich daraus für jeden Spielplan ableiten lässt. Die Felder `aus`, `herkunft`, `einsatz` und `kurz` sind Felder der Plan-Datei für den Generator (`tools/spielplan-aus-plan.mjs`), der Kern liest sie nicht.

### G1 · Station und Werkzeug sind oft dieselbe Sache
- **Worum es geht:** die Arten `inhalt` und `werkzeug` und der Abgleich der Einheitenarten.
- **Lücke:** In einem Museum mit vielen Modellen und Methoden ist fast jedes Werkzeug zugleich der Stoff einer Station. Inhalt („Modelle, Theorien“) und Ausrüstung („Modelle, Methoden, Heuristiken“) überschneiden sich; der Standard sagt nicht, wie das Paar gebildet wird.
- **Auslegung:** Die Station bleibt `inhalt` („ich kenne es“); das `werkzeug` ist die Anwendungsseite („ich habe es und setze es ein“) und geht **nach** der Station auf (eigene Regel mit `enthuellung`, nicht die Kurzform `nach`). Werkzeuge liegen in keinem Gebiet (kein `in`). Das Feld `aus` hält die Herkunft fest.
- **Begründung:** Sonst zählte dieselbe Sache doppelt in den Sammelstufen.

### G2 · Stufe 2 am Werkzeug heißt: an einem Ort eingesetzt
- **Worum es geht:** das Durchreichen über `mit` (A7).
- **Lücke:** Ausrüstung ist „Anwendung auf neue Fälle“; ein Museum kann das nicht belegen (`stufen.bis: 2`). Was hebt ein Werkzeug auf Stufe 2?
- **Auslegung:** Jedes Werkzeug nennt `einsatz`: Orte (Exponat, Mythos-Karte, in Ausnahmen eine Station), an denen es zählt. Wer einen Ort `geschafft` meldet, das Werkzeug hat und den Einsatz **bestätigt**, meldet `mit: [werkzeug/…]`. Jedes Werkzeug hat mindestens einen Ort, damit der Kern nie eine unerfüllbare Aufgabe („Setze X ein“) nennt; wo es keinen natürlichen Ort gab, musste einer erfunden werden. Das ist eine Stelle, an der der Kern mehr verlangt als der Standard: Er hält jedes Werkzeug für aktionsfähig.
- **Begründung:** Stufe 2 bleibt „geübt“; ohne bestätigten Einsatz wäre sie eine Behauptung des Spielplans.

### G3 · „Unabhängige Regeln“ heißt: zwei Wege ohne gemeinsame Einheit
- **Worum es geht:** der Begriff „unabhängige Regeln“ (der Standard definiert ihn nicht).
- **Auslegung:** Zwei Regeln eines Ziels sind unabhängig, wenn es zwei Wege gibt, deren Einheiten sich nicht schneiden müssen. Geprüft mit dem Kern als Spieler: (1) Einheiten, ohne die eine Regel nie aufgeht („Engpässe“), und (2) konstruktiv: eine minimale Stützmenge der einen Regel verboten, die andere muss trotzdem aufgehen. Teilen sich zwei Wege Kreuzungsstationen, ist der dritte Weg der unabhängige. Einheiten eines gesperrten Gebiets erben dessen Sperre.
- **Begründung:** Ein einzelner nicht erreichbarer Schlüssel soll nie eine Reise für immer sperren. Die Prüfung `check-spielplan` meldet Engpässe nicht selbst; das wäre eine sinnvolle Erweiterung.

### G4 · Quests sind nie kritisch
- **Worum es geht:** Gewicht und Sammel-Regel; Befund B13.
- **Lücke:** Gewicht gilt je Einheit; eine Quest (Mythos-Karte) auf mehreren Reisen wäre in allen kritisch und koppelte Reisen, die sich nicht bedingen sollen (zwei Endgame-Wege teilten sich dann dieselben Karten).
- **Auslegung:** Alle Quests sind wesentlich. Bei den übrigen kritischen Kreuzungsstationen bleibt die Kopplung bestehen; sie ist ein Preis des Gewichts je Einheit (B13).

### G5 · Die Schlüssel der Onboarding-Reise liegen auf kritischen Stationen
- **Worum es geht:** die Etappe Onboarding und die Wahl der nächsten Aufgabe.
- **Lücke:** Die Aufgabe sortiert bei gleichem Abstand nach Gewicht, dann nach der Reihenfolge der Autorin. Ohne Eingriff springt sie nach wenigen Stationen in eine andere Reise.
- **Auslegung:** Die ersten Schlüssel (Stationen, die die ersten Freischaltungen öffnen) sind die kritischen Stationen der ersten Reise und stehen früh in deren Reihenfolge. So liegen die ersten Momente in wenigen Minuten und in einer Reise.

### G6 · Fähigkeiten sind nie gesperrt
- **Worum es geht:** Gesperrtes als graue Flecken mit Bedingungssatz, wie der Spielstand es darstellt.
- **Lücke:** Der Auftrag will Fähigkeiten als graue Flecken mit Bedingungssatz; eine Fähigkeit wird von keiner Regel genannt, `bedingung` gibt es nur für gesperrte Einheiten.
- **Auslegung:** Stufe 0 („Nebel“) mit dem `kann`-Satz und `fortschritt` (A14) ist der graue Fleck; das Wachsen der Stufe ist der Moment („Ich kann …“).

### G7 · Eine Regel mit mehreren Alternativen hat eine Enthüllung
- **Worum es geht:** Regeln und ihre Bedingungs-Bausteine.
- **Auslegung:** Bei `eine: [Station, Exponat]` ist der Text so gefasst, dass er für beide Wege stimmt.

### G8 · Die Zwangspause kommt einmal und nur als Alternative
- **Worum es geht:** der Baustein `wartezeit`, der Grundsatz „Vorschläge statt Zwang“, Befund B15.
- **Auslegung:** Eine Regel mit `wartezeit` steht immer neben einem zweiten, wartezeitfreien Weg zum selben Ziel; „Freier Zugang“ überspringt die Pause (A20).

### G9 · `art: werkzeug` zählt alle Werkzeuge
- **Worum es geht:** der Baustein `art` der Bedingungen.
- **Auslegung:** Weil jedes Werkzeug einen Einsatzort hat (G2), zählt `{ art: werkzeug, stufe: 2, mindestens: n }` ohne Sackgasse; ein verborgenes Werkzeug zählt mit, sobald es offen ist.


---

## Basis und Hygiene (öffentliche Fassung des Kerns)

Kürzel: H = Entscheidung beim Übernehmen des Kerns in dieses öffentliche Repository. Die Nummern gelten für diesen Abschnitt.

### H1 · Wurzel des xAPI-Vokabulars: neutral und einstellbar
- **Worum es geht:** die Adressen der eigenen Verben, Erweiterungen und Arten (bei dem abgeleiteten Verb, der xAPI-Übersetzung und im Kopfbeispiel); der Entwurf legt sie unter eine feste Adresse einer bestimmten Domain.
- **Lücke:** Der Entwurf legt die Adressen der eigenen Verben (`angewendet`, `freigeschaltet`), der Erweiterungen und der Arten unter eine feste Domain. Eine Umsetzung, die für alle gilt, kann diese Domain nicht voraussetzen; zugleich muss sie jede Domain erlauben, die ihr Vokabular wirklich veröffentlicht.
- **Auslegung:** Der Kern benutzt ohne weitere Angabe die neutrale Wurzel `urn:spielplan:` (also `urn:spielplan:verben/angewendet`, `urn:spielplan:ext/mit`, `urn:spielplan:arten/quest`; eine URN muss nicht erreichbar sein). Das Plan-Feld `vokabular` (Adresse, endet auf `/` oder `:`) ersetzt sie, `opts.vokabular` bei `Spielplan.nachXapi` geht vor dem Plan; die Prüfung meldet ein ungültiges `vokabular` als Fehler. Die ADL-Verben (attempted, experienced, completed, passed, shared) bleiben unberührt. Die Objekt-Adressen (`basis` + `objekt`) gehören dem Plan und ändern sich nicht.
- **Begründung:** Sonst enthielte jedes veröffentlichte Statement eine Adresse, die nicht dem Betreiber gehört. Die Statement-Ids ändern sich mit der Wurzel nicht (sie hängen nur an Ereignis, Zeit und App).
- **Vorschlag für den Standard:** Bei dem abgeleiteten Verb und der xAPI-Übersetzung die Wurzel als Plan-Feld (`vokabular`) führen und eine neutrale Vorgabe nennen; das Kopfbeispiel mit einer Beispieladresse (etwa `https://example.org/…`) schreiben statt mit einer echten Domain. Ergänzt Befund B18 (Namensräume).

### H2 · Der Entwurf des Standards ist keine Voraussetzung der Prüfung
- **Worum es geht:** die Prüfung des Spielplans und die erste Testgruppe.
- **Lücke:** Ein Test las die YAML-Beispiele direkt aus dem Entwurf; ohne ihn (öffentliches Repository) schlug er fehl.
- **Auslegung:** Der Test läuft nur, wenn der Entwurf per Umgebungsvariable `SPIELPLAN_STANDARD` (oder als lokale, nicht eingecheckte `docs/spielplan-standard.md`) vorliegt, und wird sonst als **übersprungen** gezählt und ausgegeben; der Rest der Tests und die Prüfung brauchen den Entwurf nicht. Die YAML-Teilmenge selbst deckt der Rest der Gruppe ab (Lesen, Fehler mit Zeilennummer, Rundlauf mit Zufallsstrukturen, Kaffee-Beispiel).
- **Begründung:** Ein Test, der still grün bleibt, wäre schlechter als einer, der sagt, was er nicht prüft.

### H3 · „Der Build bindet den Adapter nicht ein“ ist eine Aussage über den Code und über die Ausgabe
- **Worum es geht:** die Zusage, dass die Seite nichts sendet (Auslegung A16).
- **Lücke:** Der Test las den Quelltext von `tools/build.mjs` und suchte das Wort „spielplan-adapter“; ein Kommentar, der erklärt, dass der Adapter nie eingebunden wird, ließ ihn scheitern.
- **Auslegung:** Der Test prüft den Code **ohne Kommentare** und baut zusätzlich echte Pakete: ohne `spielplan.json` darf die Ausgabe keine Datei und keinen Verweis des Spielplans enthalten (Kern, Anbindung, Stile, Daten); mit `spielplan.json` kommen Kern, Anbindung, Stile und Daten, nie der Adapter, und die Spielplan-Skripte enthalten keinen Netzwerkzugriff. Der zweite Fall wird übersprungen, solange `engine/js/spiel.js` noch fehlt.
- **Begründung:** Die Zusicherung („ein Paket ohne Spielplan verhält sich wie bisher; die Seite sendet nichts“) gehört an die Ausgabe, nicht an ein Stichwort im Quelltext.

### H4 · Das Kaffee-Beispiel: Gerüst bleibt, Freitexte sind neu
- **Worum es geht:** das kleine Beispiel am Ende des Entwurfs (A25).
- **Lücke:** `docs/spielplan-beispiel-kaffee.yaml` war das Beispiel des Entwurfs, Zeile für Zeile übernommen, nur mit anderer `basis` (so steht es in A25). Das ist eine wörtliche Passage des nicht öffentlichen Entwurfs.
- **Auslegung:** Das Gerüst bleibt: Ids, Arten, Namen der Einheiten, Regeln und Rhythmus. Konformitätsset, Tests und die Beispiele in den Auslegungen hängen daran, und ein Beispiel für ein Format mit festen Feldern kann sich ohnehin nur wenig unterscheiden. Alle Freitexte (Auftakt, beide `kann`-Sätze, beide Enthüllungen) sind neu formuliert, das Konformitätsset ist neu erzeugt (`node tools/spielplan-test.mjs --schreibe-konformitaet`). Seit dieser Änderung stimmt in A25 nur noch der erste Teil („folgt dem kleinen Beispiel“), nicht mehr „geändert ist nur die `basis`“.
- **Begründung:** Der Entwurf bleibt privat; ein öffentliches Beispiel darf seine Gestalt zeigen, aber nicht seinen Text. Geprüft mit einem Wortvergleich (Reihen gleicher Wörter, ab sechs in Folge) über alle Spielplan-Dateien: Übrig sind Feldnamen, Ids und die Namen der Einheiten.
- **Vorschlag für den Standard:** Das Beispiel im Standard und das öffentliche Beispiel getrennt halten; zum Standard gehört ein eigenes freies Beispiel samt Konformitätsset, an dem sich andere Umsetzungen messen können, ohne den Text des Entwurfs zu brauchen.


---

## Generator: Spielplan aus dem Stationsplan (tools/spielplan-aus-plan.mjs)

Kürzel: E = Entscheidung beim Erzeugen eines Spielplans aus den Daten eines Pakets, BE = Befund zum Standard, der dabei aufgefallen ist. Die Nummern gelten für diesen Abschnitt.
Der Generator hat zwei Schichten: eine **Automatik** (`--auto`, ohne Handarbeit) und eine **kuratierte Schicht** (`packs/<paket>/spielplan-kern.yaml` plus `spielplan-zuordnung/*.json`, Vorlage:
`docs/spielplan-vorlage-kern.yaml`). Die Automatik kennt keine Fachbegriffe; alle Texte entstehen aus Namen, Tagline, Einleitung, Ausblick und Stationstiteln des Pakets.

### E1 · Ableitung: welche Quelle ist welche Einheit
- **Worum es geht:** der Abgleich der Einheitenarten (Zuordnung im Museum) und die Felder `in` und `adresse`.
- **Lücke:** Der Abgleich sagt „Reise = Episode, Station = Inhalt, Mythos-Karte = Quest, Exponat = Erlebnis, Werkzeug-Reise = Werkzeug“, aber nicht: Was ist eine Mythos-Karte, wenn nur ein Feld sie zeigt? Wie viele Einheiten ergibt ein Exponat, das an zwei Stationen hängt?
  Sind alle Stationen einer Werkzeug-Reise Werkzeuge?
- **Auslegung:** Je Reise eine Episode (`in` = Gebiet, `adresse` `#/reise/<id>`), je Station ein Inhalt (`in` = alle ihre Reisen, als Text bei einer, als Liste bei mehreren; `reihenfolge` = Platz in der ersten Reise),
  je Station mit Mythos-Karte eine Quest `quest/<station>-mythos` (Mythos-Karte heißt: `kind` ist `mythos` **oder** die Station trägt ein Feld `myth` in `stationen/*.js`), je Exponat ein Erlebnis (steht es an mehreren Stationen, zählt die erste;
  der Generator warnt). Eine Werkzeug-Reise (`tool: true`) ergibt je Station ein Werkzeug `werkzeug/<station>`, aber nur für die Arten `konzept` (Sorte `modell`), `methode` (`methode`) und `instrument` (`technik`);
  eine Person oder ein Ereignis ist kein Werkzeug (Hinweis in der Ausgabe). Das Werkzeug trägt die Adresse seiner Station.
- **Begründung:** Die Quellen liegen in `plan.json`, `journeys.js` und `stationen/*.js`; wer ein Paket baut, soll nichts doppelt eintragen. Die Id des Werkzeugs trägt den Namen der Station, damit die Anbindung beide zusammenfindet (G1).

### E2 · Automatik: Gebiete aus den Reisetypen
- **Worum es geht:** die Art `gebiet` und der Abgleich („Reisetypen oder Kartengruppen = Gebiet“).
- **Lücke:** Wann ist ein Gebiet sinnvoll? Wie viele Reisen verträgt eines?
- **Auslegung:** Je Reisetyp ein Gebiet, aber nur, wenn es mindestens zwei Reisen enthält (ein Gebiet mit einer Reise sagt nichts, was die Reise nicht schon sagt); bei einer einzigen Reise im Paket gibt es keines. Hat ein Typ mehr als fünf Reisen,
  wird er in gleich große Teile zu höchstens fünf geteilt („Teil 1“, „Teil 2“; acht Reisen ergeben zwei Teile zu vier). Name aus `pack.journeyTypes`, Auftakt aus dessen Unterzeile und den Namen der Reisen, Abschluss ein Satz ohne Fachbezug.
- **Begründung:** Gebiete tragen zwei Dinge: einen größeren Meilenstein („Gebiet geschafft“) und die Verteilung der offenen Reisen beim Start (E4).

### E3 · Automatik: Etappen und Stärke der Mythos-Karten
- **Worum es geht:** die Etappen, das Feld `staerke` und die Warnungen der Prüfung zu `onboarding` und `endgame`.
- **Lücke:** Welche Reise ist Onboarding, welche Endgame? Woher kommt die Stärke?
- **Auslegung:** Die erste Reise ist `onboarding`. Historische Reisen (Typ `historisch`) sind `entdecken`, alle übrigen `scaffolding`. Die letzte nicht historische Reise (nicht die erste) ist `endgame`, **aber nur, wenn eine Mythos-Karte bei ihr zu Hause ist**
  (Heimat = erste Reise der Station); sonst bleibt sie `scaffolding`, und die Ausgabe sagt, warum. Die Stärke einer Mythos-Karte richtet sich nach der Etappe ihrer Heimat-Reise: onboarding und entdecken 1, scaffolding 2, endgame 3.
  Hat die erste Reise keine Mythos-Karte zu Hause, bleibt sie trotzdem `onboarding`; die Prüfung warnt dann (siehe BE1), die Ausgabe nennt den Grund.
- **Begründung:** Die Prüfung verlangt für `endgame` eine Quest der Stärke 3 und für `onboarding` eine der Stärke 1 in der Reise. Eine Etappe zu vergeben, die die Prüfung beim ersten Lauf bemängelt, wäre schlechter als sie wegzulassen. Das Onboarding ist dagegen
  eine Eigenschaft der Reihenfolge im Museum (die erste Reise ist der Einstieg), nicht der Daten.

### E4 · Automatik: der Start, ein Drittel der Reisen offen
- **Worum es geht:** der Grundsatz, dass Gesperrtes angedeutet wird, und die Etappen `entdecken` und `onboarding`.
- **Lücke:** Wie viel ist zu Beginn offen, und welche Reisen?
- **Auslegung:** Offen sind `round(n / 3)` Reisen, mindestens eine, höchstens vier (n = Zahl der Reisen; bei n = 1 alle). Die erste Reise ist immer dabei. Die übrigen werden in drei Durchgängen über die Teile der Gebiete gezogen:
  zuerst die erste Reise jedes Teils, dann die mittlere, dann die letzte, bis die Zahl erreicht ist. Bei acht Reisen in zwei Teilen sind das die Reisen 1, 5 und 3. Die übrigen Reisen sind angedeutet gesperrt, nichts ist verborgen.
- **Begründung:** Wer neu ist, soll aus mehr als einer Tür wählen und zugleich sehen, dass es mehr gibt. Bei sechzehn Reisen bleiben vier offen: mehr Auswahl lähmt.

### E5 · Automatik: „zwei unabhängige Regeln“ je gesperrter Reise
- **Worum es geht:** Regeln und Erreichbarkeit; Auslegung G3 („unabhängige Regeln“).
- **Lücke:** G3 meint zwei Wege ohne gemeinsame Einheit. Eine Kreuzungsstation einer offenen Reise ist aber oft zugleich kritisch in der Reise, deren Stufe der andere Weg verlangt.
- **Auslegung:** Jede gesperrte Reise bekommt Regeln (Alternativen, nach Kosten sortiert gebaut): **schnell**, nur für die erste gesperrte Reise: die zwei ersten Stationen der ersten Reise auf Stufe 2 (die erste Freischaltung nach zwei Stationen, Moment des Onboardings);
  **weiter**: die vorige Reise auf Stufe 2 (entfällt, wo „schnell“ sie einschließt); **kreuzung**: eine Kreuzungsstation der Reise, deren andere Reise früher kommt oder zu Beginn offen ist (so entsteht nie ein Kreis);
  **exponat**: ein Exponat einer solchen früheren oder offenen Reise. Bevorzugt werden Schlüssel, die noch keine andere Reise öffnen (sonst öffnete eine Station alles auf einmal), nicht in der Vorgänger-Reise liegen, nicht kritisch und nicht optional sind.
  Hängen alle Wege an derselben Einheit oder gibt es nur einen, kommt eine **zweite Kreuzung**, zuletzt **takt**: `{ takt: n }`, die Zeit allein öffnet die Reise (niemand steht für immer vor einer Tür).
  „Unabhängig“ heißt hier: **keine einzelne Einheit sperrt alle Wege** (Engpass-Analyse E10), nicht: die Wege teilen sich keinen Pfad. Das Fehlen eines gemeinsamen Pfades verlangt der Generator nicht, er vermeidet ihn nur, wo die Daten es erlauben.
- **Begründung:** Der strenge Begriff (zwei Stützmengen ohne Schnitt) ist in kleinen Paketen nicht zu erfüllen: Bei zwei Reisen ist jede Kreuzungsstation Teil beider. Die schwächere, prüfbare Form schützt vor dem Fall, um den es G3 geht: Ein einzelner Schlüssel, der ausfällt, sperrt nichts für immer.
- **Grenze:** Ein Schlüssel öffnet eine Reise nach einem oder zwei Schritten. Das ist Absicht (schnelle Momente), macht die Sperren aber dünn: In den drei Beispielpaketen geht alles, was die Automatik sperrt, nach höchstens zwei Schritten auf. Gewollt langsamere Dramaturgie
  schreibt der Kern (Meilensteine mit `mindestens`, Ketten über Werkzeuge, siehe E13).

### E6 · Automatik: Gewicht
- **Worum es geht:** Gewicht und Sammel-Regel; B13, G4.
- **Auslegung:** Kritisch sind die beiden ersten Stationen jeder Reise und jede Station, die auf mehr als einer Reise liegt. Wesentlich sind Mythos-Karten und ihre Stationen (eine Quest ist nie kritisch, G4) und alles Übrige.
  Optional sind Stationen, deren `why` das Wort „Vertiefung“ nennt; es geht den beiden anderen Regeln vor (eine Kreuzung, die sich als Vertiefung ausgibt, ist keine Hauptquest). Mit der Zuordnung (`gewicht`) und dem Kern (`gewichte`) lässt sich jedes Gewicht ändern.
- **Begründung:** Die ersten Stationen tragen den Einstieg (G5), Kreuzungen sind die Stellen, die das Museum ausmachen. Die Kopplung durch Gewicht je Einheit nimmt die Automatik in Kauf (B13).

### E7 · Automatik: Werkzeuge einer Werkzeug-Reise
- **Worum es geht:** die Art `werkzeug` und das Durchreichen über `mit`; G1, G2.
- **Lücke:** Wie kommt ein Werkzeug auf Stufe 2, wenn das Museum keine Meldung „Werkzeug benutzt“ kennt? Soll es gesperrt sein?
- **Auslegung:** Mit `--auto` geht jedes abgeleitete Werkzeug (E1) nach seiner Station auf (Regel `werkzeug-<station>`, `inhalt/<station>` Stufe 2, Enthüllung „Neu in deiner Ausrüstung: …“ mit dem Teaser der Station), ist **optional** (Nebenquest) und nie Bedingung einer anderen Regel. Ohne `--auto` bleibt es offen, bis der Kern es sperrt.
  Die Automatik verlangt von keinem Werkzeug eine Stufe über 0; wo eine Regel ein Werkzeug braucht, schreibt der Kern `{ einheit: werkzeug/…, stufe: 0, offen: true }` (A8).
- **Begründung:** Solange die Anbindung nicht zusichert, dass sie Werkzeuge meldet, darf kein Weg des Spiels davon abhängen. Als Nebenquest blockiert ein Werkzeug weder eine Sammlung noch eine Reise. Das Feld `einsatz` (Orte, an denen ein Werkzeug zählt, G2) steht an den Werkzeugen der kuratierten Schicht;
  der Kern liest es nicht, die Anbindung darf es lesen und bei Station oder Exponat zugleich `mit: [werkzeug/…]` melden (A7).

### E8 · Automatik: eine einzige Reise wird in drei Kapitel geteilt
- **Worum es geht:** der Grundsatz „der Moment zählt“ und die Etappen.
- **Lücke:** Ein Paket mit einer Reise hat nichts, was sich sperren ließe: kein Moment, kein Spiel.
- **Auslegung:** Hat das Paket genau eine Reise mit mindestens sechs Stationen, teilt der Generator ihre Stationen in drei gleiche Kapitel. Das erste ist offen. Kapitel 2 und 3 (samt Mythos-Karten und Exponaten ihrer Stationen) gehen auf, wenn zwei Stationen des
  vorigen Kapitels geschafft sind **oder** ein Exponat des vorigen Kapitels (nie eines früheren: sonst öffnete ein Exponat alle Kapitel auf einmal) **oder** (ohne Exponat) die nächste Woche (`takt`). Die Enthüllung nennt Zahl und erste Station des neuen Kapitels.
- **Begründung:** Eine Sperre in der einzigen Reise ist die einzige Quelle für Momente. Sie ist kurz (zwei Stationen) und hat immer einen zweiten Weg; der Freie Zugang öffnet alles. Bei mehr als einer Reise gibt es keine Kapitel: Dort sperren Reisen.

### E9 · Kern über Automatik
- **Worum es geht:** der Abgleich („Zuordnung im Museum“) und der Auftrag („kuratierte Schicht überschreibt die Automatik, Konflikte melden“).
- **Auslegung:** Mit `--auto` entsteht erst die Automatik, dann legt der Kern (`spielplan-kern.yaml` oder `--kern=datei`) sich abschnittsweise darüber. `id`, `name`, `basis`, `nur_lokal`, `stufen`, `begriffe`, `rhythmus`, `quest_vorsatz` und `gebiete` ersetzt der Kern ganz;
  `episoden_zusatz`, `gewichte`, `quests`, `aufgaben`, `skills`, `werkzeuge` und `einheiten` mischen sich je Id (der Kern gewinnt je Feld). **Regeln:** Regeln des Kerns gehen vor; eine Regel der Automatik entfällt für jedes Ziel, das eine Regel des Kerns nennt,
  und für jede Einheit, die der Kern unter `offen` führt; Regeln mit gleicher Id ersetzt der Kern. Jede Ersetzung steht als „Hinweis“ in der Ausgabe (nie als Warnung, damit `--streng` nicht daran scheitert). Ohne `--auto` gilt nur der Kern.
  Die Zuordnung (`gewicht`, `uebt`, `braucht`, `staerke`, `name`, `reihenfolge`) wirkt in beiden Fällen zuletzt; ihre `uebt`-Einträge müssen Fähigkeiten nennen, die der Kern anlegt (sonst meldet die Prüfung unbekannte Einheiten).
- **Begründung:** Wer einen Teil kuratiert, soll den Rest nicht neu schreiben müssen. Die Umkehrung (Automatik füllt nur Lücken) lässt Hinweise genau dort entstehen, wo der Kern die Automatik ablöst.

### E10 · Engpass-Analyse (Umsetzung von G3)
- **Worum es geht:** Erreichbarkeit; G3 („check-spielplan meldet Engpässe nicht selbst“).
- **Auslegung:** `check-spielplan --wege` (und der Bericht des Generators mit `--wege`) spielt den Kern als Spielerin: Für jede Einheit, an der man etwas tun kann, wird eine Spielerin gerechnet, die diese eine Einheit nie anfasst, alles andere Offene aber bis zur höchsten Stufe spielt und beliebig lange wartet.
  Was dadurch nie aufgeht, hat diese Einheit als **Engpass**. Kandidaten sind kritische Einheiten, in Regeln genannte Einheiten und Mitglieder kleiner Sammlungen (bei höchstens zwei wesentlichen Mitgliedern braucht die Stufe alle). Gemeldet werden Engpässe nur bei gesperrten Einheiten mit mindestens zwei Regeln;
  Einheiten mit genau einem Weg (Werkzeuge nach einer Station) stehen getrennt („Nur ein Weg“).
- **Begründung:** Die Rechnung braucht nur den Kern, keine neue Logik. Sie ist einfach (Anzahl Einheiten mal ein Spielverlauf) und dauert bei 90 Einheiten unter einer Sekunde. Sie prüft die Robustheit gegen den Ausfall **einer** Einheit, nicht gegen zwei.

### E11 · Spielzeit: Schritte, wenn man der Aufgabe folgt
- **Worum es geht:** die nächste Aufgabe; Auftrag („rechne die Spielzeit“).
- **Auslegung:** `spielzeit` lässt eine Spielerin jeweils der einen nächsten Aufgabe folgen. **Ein Schritt bringt eine Einheit** (Station, Mythos-Karte, Exponat) mit einem Ereignis `geschafft` auf Stufe 2 (Museum: höchste vergebene Stufe); zwischen zwei Schritten vergehen vier Minuten (`--minuten=` ändert das).
  Gibt es nichts zu tun und ist noch etwas gesperrt, vergeht eine Woche. Gemessen werden: Schritte bis zur ersten Freischaltung, bis alles offen ist, bis keine Aufgabe mehr bleibt (alles auf Stufe 2), dazu die Momente (Freischaltung mit Schrittnummer).
  Fällige Wiederkehr kommt in dieser Rechnung nicht vor, weil die Zeit nur Minuten läuft.
- **Begründung:** Der Kern zählt „Schritte“ in Stufen („Noch 2 Schritte“ für eine unberührte Station, BE2); für Menschen ist eine Station ein Schritt. Die vier Minuten sind eine Annahme, keine Messung; die Zahlen taugen zum Vergleichen von Plänen, nicht zum Versprechen.

### E12 · Vorgaben und Ausgabe
- **Auslegung:** `nur_lokal` ist ohne Angabe **true** (das Museum sendet nichts; der Kern verweigert dann jeden anderen Speicher als lokal). Die Id des Spielplans ist `museum-` plus die Id des Pakets als Bezeichner (`_vorlage` wird `museum-vorlage`). Ohne `basis` steht eine Beispieladresse. Die Wörter der Sätze („Reise“, „Station“, „Exponat“)
  kommen aus `pack.vocab`; weicht ein Wort vom Standard ab und fehlt `vocab.journeyArticle`, `stationArticle` oder `exhibitArticle`, nennt die Ausgabe es als Hinweis, denn der Generator kann den Artikel eines deutschen Wortes nicht raten. Die Ausgabe ist **kanonisch**: feste Reihenfolge der Schlüssel, Einheiten
  in der Reihenfolge der Quellen, Regeln in der Reihenfolge der Reisen; zweimal erzeugt ist sie byte-gleich (getestet).

### E13 · Das Beispielpaket (kuratierte Schicht): Gestaltungsentscheidungen
Alle Entscheidungen gelten für `packs/beispiel-gehirn` und zeigen, was der Kern kann; sie sind keine Vorgabe für andere Pakete.
- **Etappen:** Die Etappen folgen der Lernrichtung, nicht der Anzeigereihenfolge: Verzerrungen (Onboarding), Verhaltenstherapie (Scaffolding), Trauma (Endgame, mit der einzigen Mythos-Karte der Stärke 3). `reihenfolge` der Reisen entspricht der Lernrichtung.
- **Das ernste Gebiet bleibt offen.** Die Reise zu Trauma ist von Anfang an offen (Autonomie bei sensiblen Themen); gesperrt ist nur die schwerste Mythos-Karte. Die Stationen, die Sicherheit vor Erinnerung stellen (Begriff, Toleranzfenster, Stabilisierung, Grounding), sind kritisch.
- **Zwei bis drei Wege:** Die gesperrte Reise (Verhaltenstherapie) hat drei Wege ohne gemeinsame Einheit: zwei Stationen der Urteilsforschung, zwei Selbstversuche an Exponaten, oder die ganze erste Reise. Die Mythos-Karte der Stärke 3 hat zwei: eine Fähigkeit auf Stufe 2 oder vier Werkzeuge in der Ausrüstung.
- **Werkzeuge:** Die Id trägt den Namen der Station, `aus` nennt die Station, `einsatz` die Orte. Der Besitz („offen“, Stufe 0) ist die Bedingung anderer Regeln, nie die Benutzung (E7). Ketten entstehen so: Das Gedankenprotokoll öffnet Reframing (zusammen mit sechs Stationen der Reise), das Toleranzfenster das Grounding.
- **Die eine Wartezeit:** Das Verhaltensexperiment geht auf, wenn die Fähigkeit „Gedanken prüfen“ erreicht ist, **oder** nach der Station und achtzehn Stunden Pause nach dem Gedankenprotokoll. Die Pause ist die Alternative zu mehr Arbeit, nie das einzige Tor; der Freie Zugang überspringt sie (A20).
- **Fähigkeiten:** Sechs Fähigkeiten mit „Ich kann …“-Satz; die Zuordnung (`uebt`) hängt Stationen, Exponate und eine Mythos-Karte an sie. Kritische Mitglieder einer Fähigkeit sind dieselben Einheiten, die in ihrer Reise kritisch sind; wer die Fähigkeit schaffen will, muss die Hauptquests der Reise getan haben.
  Eine Fähigkeit, die eine Regel öffnet, darf die Einheit nicht selbst üben (die Mythos-Karte der Stärke 3 zählt zu keiner Fähigkeit, sonst entstünde ein Kreis).
- **Rhythmus:** Takt Woche; Wiedersehen nach 2, 7 und 21 Tagen **für Fähigkeiten** (das Wiedersehen nennt dann den „Ich kann“-Satz); Verwitterung nach 35 Tagen.

### Befunde zum Standard (aus dem Bau des Generators)
Je Befund: Worum es geht, Problem, Vorschlag. Nummern BE1 bis BE6 gehören zu diesem Abschnitt und setzen die Tabelle B1 bis B19 oben fort.

| Nr | Worum es geht | Problem | Vorschlag |
|---|---|---|---|
| BE1 | Etappen | `onboarding` und `endgame` setzen eine Quest voraus (Stärke 1 und 3). Ein Paket ohne Mythos-Karten, die einzige Quest-Quelle im Museum, kann die Etappen nicht ohne Warnung vergeben. Der Abgleich sagt nicht, woher Quests kommen, wenn ein Angebot keine hat. | Etappe und Quest entkoppeln oder eine zweite Quelle von Quests nennen (Aufgaben an Exponaten, Übungen). |
| BE2 | Nächste Aufgabe | Die Entfernung zu einer Regel zählt Stufen, nicht Einheiten: Eine unberührte Station ist „2 Schritte“ entfernt, obwohl ein einziges Ereignis `geschafft` sie auf Stufe 2 hebt. Der Satz „Noch 2 Schritte“ stimmt für den Kern und täuscht den Menschen. | Entfernung in Einheiten zählen und die Stufe nur zur Reihenfolge benutzen; der Kern liefert `noch_einheiten` bereits. |
| BE3 | Kurzform `braucht`, Durchreichen | `braucht` verlangt „offen und schon einmal benutzt“ (Stufe 1). Ein Angebot, das den Gebrauch eines Werkzeugs nicht meldet, kann diese Bedingung nie erfüllen; eine Quest, die ein Werkzeug `braucht`, bleibt für immer zu. Die Alternative `offen: true` mit Stufe 0 (A8) ist nirgends als Kurzform vorgesehen. | Eine Kurzform für Besitz (`hat`) neben `braucht` führen; beim Durchreichen sagen, welche Meldungen ein Angebot für Werkzeuge liefern muss. |
| BE4 | Regeln, nächste Aufgabe | Die nächste Aufgabe wählt die billigste Regel. Hat eine Reise einen kurzen und einen langen Weg, ist der lange nie die Aufgabe, und die Sperre dauert so lange wie der kurze Weg. Der Standard sagt nichts darüber, wie lang ein Weg sein darf, und „zwei Wege“ wirkt als zweimal der billigste. | Empfehlen, die Wege nach Kosten zu staffeln (ein kurzer, ein mittlerer), und die Prüfung die Kosten je Weg nennen lassen. |
| BE5 | Gewicht; B13 | Das Gewicht je Einheit macht die Kreuzung zugleich zum Schlüssel einer Reise und zur Pflicht der anderen: Der kurze Weg über die Kreuzungsstation ist dann kein unabhängiger Weg zur langen Pflicht der Nachbarreise. In Paketen mit zwei Reisen ist strenge Unabhängigkeit nicht zu haben (E5). | `in: [{ id, gewicht }]` (B13) oder die schwächere, prüfbare Unabhängigkeit (kein Engpass einzelner Einheiten) als Begriff einführen. |
| BE6 | Etappen | `entdecken` hat keine Bedeutung für Rechnung und Prüfung (sie warnt nur bei `onboarding` und `endgame`). Der Generator gebraucht sie für historische Reisen; das steht so nicht im Standard. | Sagen, wofür `entdecken` gilt (Reisen ohne eigene Hauptquest, Erkundungen) und was die Prüfung dazu verlangt. |


---

## Museum-Anbindung A: Kern, Stationen, Reise-Modus, Eingang (engine/js/spiel.js)

Kürzel: M = Entscheidung der Anbindung des Spielplans an das Museum, BM = Befund zum Standard, der dabei aufgefallen ist. Die Nummern gelten für diesen Abschnitt.
Die Anbindung (`engine/js/spiel.js`, `engine/css/spiel.css`) wird nur mit `packs/<paket>/spielplan.json` eingebunden; sie stellt `MUSEUM.spiel` bereit (`aktiv`, `stand()`, `einheit(id)`, `zugang(id)`, `melde()`, `bei()`, `naechsteAufgabe()`,
`frei`, `setFrei()`, dazu die Aufrufe der Ansichten). Die Stellen in `core.js`, `journey.js`, `app.js` und `search.js` fragen sie nur, wenn sie aktiv ist; ohne Spielplan bleibt jede Ansicht Zeichen für Zeichen, wie sie war (getestet: Vergleich der Seiten mit und ohne die Änderungen
für drei Pakete in elf Zuständen (Werkzeug `tools/spiel-vergleich.mjs`), siehe `docs/SPIELPLAN-ERFAHRUNGEN.md`).

### M1 · Was im Museum welches Ereignis ist
- **Worum es geht:** die Verben und die Kurzform der Ereignisse, der Abgleich („Zuordnung im Museum“) und die Zusage, dass die Brücke nur Kennungen meldet.
- **Lücke:** Der Abgleich nennt die Einheiten, aber nicht, welche Handlung im Museum welches Verb ist. Das Museum kennt nur zwei Dinge, die es von sich aus erfasst: Besuche (`gm:visited`) und Stempel.
- **Auslegung:**

| Was geschieht | Verb | Einheit |
|---|---|---|
| Station sichtbar geöffnet (erstes Mal; die vorhandene Besuchslogik des Kerns, `gm:visited`) | `erkundet` | `inhalt/<station>` |
| Station bis zum Ende gelesen (M3), oder im Reise-Modus „Weiter“ nach einer Station, die mindestens vier Sekunden offen war | `geschafft` | `inhalt/<station>` |
| Mythos-Karte auf die Seite „Heute wissen wir“ gedreht | `geschafft` | `quest/<station>-mythos` |
| Exponat gestartet / Exponat benutzt (M4) | `begonnen` / `geschafft` | `erlebnis/<exponat>` |
| Einsatz eines Werkzeugs am Ort bestätigt (M5) | `geschafft` mit `mit: [werkzeug/…]` | der Ort (Station, Mythos-Karte oder Exponat) |
| Reise-Modus einer Reise geöffnet | `begonnen` | `episode/<reise>` |
| Reisepass-Stempel (alle Stationen der Reise besucht) | `geschafft` | `episode/<reise>` |
| Link einer Station kopiert (M6) | `geteilt` | `inhalt/<station>` |

  Die Große Rundreise ist keine Einheit (sie ist der Weg über Kreuzungen, keine Geschichte); ihre Stationen zählen wie überall. Gebiete, Fähigkeiten und Werkzeuge bekommen nie ein eigenes Ereignis aus der Oberfläche: Gebiete und Fähigkeiten rechnet der Kern aus ihren Mitgliedern,
  Werkzeuge bekommen es über `mit`. Ereignisse tragen **nur Kennungen** (Verb, Einheit, Zeit, App, Werkzeug-Kennung); nichts aus einem Exponat (Eingaben, Regler, Texte) wird gemeldet, nur dass es bedient wurde.
- **Begründung:** Besuch und Stempel gab es schon; alles andere ist die kleinste ehrliche Aussage über das, was ein Mensch im Museum tun kann. „Reise geöffnet“ heißt nur begonnen: Wer die Einführung liest, hat nichts geschafft.

### M2 · Stufen im Museum: höchstens 2, `stufen.bis: 2`
- **Worum es geht:** die Stufen samt Durchreichen und Grenzen je App, der Abgleich (Stufen 2, 3, 4 = Grundverständnis, Anwendung, Transfer) und Befund B14.
- **Lücke:** Das Museum soll entscheiden, ob und wie es Anwendung (Stufe 3) und Transfer (Stufe 4) melden kann.
- **Auslegung:** **Es meldet sie nicht.** Kein `angewendet`, kein `beleg`, keinen `fall`. `spiel.js` rechnet den Spielstand immer mit `bis: 2` (auch wenn ein Plan mehr verlangt); `stufen.bis: 2` gehört in jeden Spielplan für das Museum (der Generator setzt es),
  und `check-pack` warnt, wenn es fehlt oder größer ist. Die Sätze der nächsten Aufgabe schlagen deshalb nie „Wende … an einem echten Fall an“ vor.
- **Begründung:** Beleg heißt Nachweis, Fall heißt ein Fall aus dem Leben. Das Museum sieht weder noch: Seine Exponate sind Anschauungsstücke, keine Prüfungen, und jede Eingabe darin bleibt im Browser. Eine Selbstauskunft („Ich habe es angewendet“) wäre ein `beleg` der Art `eigen` ohne etwas,
  woran man den Fall unterscheiden könnte (Auslegung A12 verbietet Freitext, ein Fall muss eine Kennung sein). Der Einsatz eines Werkzeugs an zwei Orten wäre nach A6 „zwei Fälle“, aber die Orte des Museums sind Orte der Übung, keine Fälle; ihn als Transfer zu zählen, wäre eine Behauptung des Plans, keine des Menschen.
  „Gemeistert“ bleibt im Museum leer; wer das Spiel um Anwendung erweitern will, braucht eine Anwendung, die den Beleg erhebt (die Brücke nimmt ihn an, `Spielplan.verbinde` und der Adapter sind dafür gebaut), und setzt `bis` dann in ihrem eigenen Plan.
- **Grenze:** Sammel-Einheiten (Reisen, Gebiete) erreichen Stufe 2 und nie mehr. Das Wort „gemeistert“ kommt in keinem Satz des Museums vor.

### M3 · „Gelesen“: Marke am Ende des Lesestoffs plus Verweildauer; „Weiter“ als bewusster Schritt
- **Worum es geht:** das Verb `geschafft`, der Abgleich („Station geschafft = bis zum Ende gelesen“) und Stufe 2.
- **Lücke:** Was heißt „bis zum Ende gelesen“, wenn niemand liest, sondern scrollt?
- **Auslegung:** Hinter dem Lesestoff einer Station (Text, Auf einen Blick, Zitat; **vor** dem Exponat, den Kreuzungen und den Weiterlesen-Links) steht eine unsichtbare Marke. Eine Station gilt als gelesen, wenn (a) die Marke ins Bild kam oder schon überscrollt ist
  (ein hohes Exponat danach schiebt sie sonst nach oben) und (b) die Station so lange sichtbar offen war, wie ein knappes Drittel der Lesezeit dauert (230 Wörter je Minute; mindestens 5, höchstens 45 Sekunden). Gezählt wird nur, solange der Tab sichtbar ist und die Station im Bild.
  Im Reise-Modus gilt zusätzlich: „Weiter“ nach vorn (genau eine Station) meldet die verlassene Station, wenn sie mindestens vier Sekunden offen war; so zählt auch, wer die Station gelesen hat, ohne ans Ende zu scrollen. Eine zweite Meldung derselben Station
  folgt frühestens nach zehn Minuten (Schutz gegen Dauerfeuer); danach zählt jeder Besuch als Wiedersehen (A9).
- **Begründung:** Scrollen allein ist leicht (ein Wisch nach unten), Zeit allein ist es auch (der Tab bleibt offen). Beides zusammen ist nicht beweisbar, aber nicht mehr im Vorbeigehen zu haben. Die Zahlen sind Annahmen, keine Messung; sie stehen als Konstanten am Kopf von `spiel.js`.
- **Befund BM1:** siehe unten (Lesen ist kein Verstehen; der Standard hat dafür kein Wort).

### M4 · „Exponat benutzt“
- **Worum es geht:** der Abgleich („Exponat benutzt = erlebnis geschafft“).
- **Auslegung:** Starten meldet `begonnen`. `geschafft` kommt, wenn das Exponat bedient wurde (ein Klick, eine Taste, eine Eingabe oder eine Berührung im Bereich des Exponats; es zählt nur, **dass** etwas geschah, nicht was) und mindestens sechs Sekunden lief, beim Beenden oder von selbst.
- **Begründung:** Starten allein ist Neugier, nicht Benutzung. Sechs Sekunden und eine Bedienung sind die kleinste Schwelle, die „Ich habe es angeschaut“ von „Ich habe damit gespielt“ trennt, ohne in das Exponat hineinzusehen. Die Exponate des Pakets bleiben unverändert (der Kern meldet Start und Ende als Ereignisse der Seite).

### M5 · Einsatz eines Werkzeugs: ein Knopf am Ort, mit Bestätigung
- **Worum es geht:** das Durchreichen über `mit` (A7), der Einsatz an Orten mit Bestätigung (G2) und E7 (der Generator sagt, die Anbindung solle `einsatz` lesen).
- **Auslegung:** Nennt ein Werkzeug des Plans im Feld `einsatz` einen Ort (Einheit-ID einer Station, Mythos-Karte oder eines Exponats; ein Name ohne Art meint die Station), und ist das Werkzeug offen und der Ort geschafft, zeigt die Station am Ende einen Satz „Dein Werkzeug „X“ passt hier.“ mit dem Knopf „Eingesetzt“.
  Der Knopf meldet `geschafft` am Ort mit `mit: [werkzeug/…]`; der Kern reicht es an das Werkzeug durch (Stufe 2).
- **Begründung:** G2 verlangt eine Bestätigung. Eine automatische Meldung („du hast das Werkzeug, also hast du es eingesetzt“) wäre eine Behauptung des Museums, der Knopf ist die Entscheidung des Menschen. Der Knopf erscheint erst, wenn der Ort geschafft ist, damit niemand ein Werkzeug „einsetzt“, ohne den Ort gesehen zu haben.
- **Grenze:** Ein Werkzeug ohne gültigen `einsatz` bleibt auf Stufe 0 (`check-pack` warnt). Beim Werkzeug, das auf seiner eigenen Station aufgeht, ist der erste Einsatz ein Klick am Ende der Station; das ist gewollt klein.

### M6 · Teilen: ein Knopf „Link kopieren“
- **Worum es geht:** der Abgleich („Link kopiert = geteilt“) und das Verb `geteilt`.
- **Lücke:** Das Museum hatte keine Teilen-Funktion; nichts „kopiert“ einen Link.
- **Auslegung:** Mit Spielplan zeigt jede Station am Ende einen stillen Knopf „Link kopieren“ (Adresse der Station mit `#/station/<id>`). Er benutzt die Zwischenablage, wo es sie gibt, sonst `execCommand`; geht auch das nicht (ein Browser unter `file://`), erscheint der Link in einem Feld zum Markieren. `geteilt` wird nur gemeldet, wenn das Kopieren gelungen ist.
- **Begründung:** Ohne den Knopf gäbe es das Ereignis nie. Gesendet wird nichts: Die Zwischenablage gehört dem Menschen, die Seite sieht sie nie.

### M7 · Übernahme alter Besuche und Stempel (`herkunft: migration`)
- **Worum es geht:** die Kurzform der Ereignisse und der Grundsatz, dass nichts verloren geht.
- **Lücke:** Wer das Museum vor dem Spielplan benutzt hat, hat Besuche (`gm:visited`, eine Liste ohne Zeiten) und Stempel (`gm:stamps`, dazu das Datum aus `gm:stampdates`). Der Standard kennt kein Ereignis ohne echten Zeitpunkt.
- **Auslegung:** Beim ersten Start mit Spielplan (Marke `gm:sp:<plan>:migration`) werden die Besuche einmal als Ereignisse eingetragen: `erkundet` je besuchter Station; für Reisen **mit Stempel** zählen ihre besuchten Stationen als `geschafft` (ein Stempel hieß bisher: alle Stationen besucht), und der Stempel ist
  `geschafft` an der Episode mit seinem Datum (sonst jetzt). Alle tragen das Feld `herkunft: "migration"` (die Brücke speichert unbekannte Felder; der Kern liest sie nicht). Besuchte Stationen ohne Einheit und der Stempel der Großen Rundreise werden übersprungen. `gm:visited` und `gm:stamps` bleiben unverändert (das Museum benutzt sie weiter).
  Die Übernahme löst **keine Enthüllungen** aus: Was sich dabei öffnet, gilt als gesehen (M9).
- **Begründung:** Zeitpunkt der Übernahme statt erfundener Zeiten: Takt und Wiederkehr beginnen bei null, nichts wird rückwirkend fällig. Der Stempel bleibt der Beleg der Reise; ohne die Stationen als geschafft stünden die Regeln („zwei Stationen geschafft“) vor einer Reise, die als abgeschlossen im Pass klebt.
- **Befund BM6:** siehe unten (`herkunft` fehlt im Standard).

### M8 · Freier Zugang
- **Worum es geht:** der Grundsatz „Vorschläge statt Pflichten“, der Baustein `wartezeit`, A20 (`ohneWartezeit`) und B15.
- **Auslegung:** Der Schalter `gm:sp:frei` (`MUSEUM.spiel.frei`, `setFrei(b)`) wirkt auf **Zugang und Pausen**: Jede Einheit ist offen und sichtbar (auch Verborgenes), Wartezeiten sind vorbei (der Spielstand wird mit `ohneWartezeit` gerechnet). Er wirkt **nicht** auf Ereignisse und Regeln: Es wird weiter gezählt,
  Stufen und Freischaltungen kommen weiter zustande (und zeigen weiter ihre Enthüllung, M9), die nächste Aufgabe bleibt ein Vorschlag. Der Schalter steht im Eingang und auf jedem Hinweisbild (M10); ein Klick dort lädt die Adresse neu, sodass das Hinweisbild dem Inhalt weicht. Der Eingang zeigt ihn nur, wenn der Plan überhaupt etwas sperrt (sonst täte er nichts); `setFrei()` und `gm:sp:frei` gelten immer.
  Er hat keine Pflicht und keine Folgen: Man kann ihn jederzeit ausschalten, nichts geht verloren.
- **Begründung:** Für Sprachenlernen und aufmerksamkeitssensible Themen kann Freischalten Druck sein; deshalb ist der Weg ohne Sperre ein Schalter, kein Zugeständnis in den Einstellungen. Er gilt für diese App und dieses Gerät (lokal gespeichert).
- **Vorbelegung (Erfindung der Anbindung):** `pack.json` kennt das Feld `"spielFrei": true`. Es schaltet den Freien Zugang für alle ein, die den Schalter noch nie bedient haben; wer ihn je an- oder ausgeschaltet hat, behält seine Wahl (sie steht in `gm:sp:frei`).
  Der Plan trägt dazu nichts, weil der Standard keinen Freien Zugang kennt (BM5); das Feld gehört ins Paket, nicht in den Spielplan.
- **Offen:** Ob die beiden Testthemen den Freien Zugang als Standard brauchen, entscheidet der Test mit Menschen; `spielFrei` macht beide Fassungen (mit und ohne Vorbelegung) zu einer Zeile im Paket.

### M9 · Der Moment: eine Karte, nicht blockierend
- **Worum es geht:** der Grundsatz „der Moment zählt“, der `enthuellung`-Text der Freischaltungen im Spielstand und A16 (`gesehen`).
- **Auslegung:** Sobald etwas aufgeht, erscheint **dort, wo man handelt**, eine Karte mit Art („Neu geöffnet: Reise“), Name und dem `enthuellung`-Text der Regel, dazu die Schaltflächen „Ansehen“ (öffnet die Adresse der Einheit) und „Weiter“. Sie blockiert nichts: kein Dunkelfeld, keine Fokusfalle, kein `inert`, der Hintergrund bleibt bedienbar.
  Sie wird mit `aria-live` angesagt (`#gm-live`, höflich), trägt `role="region"` mit Überschrift und stiehlt den Fokus nur, wenn gerade nichts Bestimmtes den Fokus hat; Escape in der Karte schließt sie. Bewegung (Einblenden, ein Ring um das Symbol) gibt es nur ohne `prefers-reduced-motion`.
  Mehrere Momente stehen in einer Schlange (die Karte nennt „Dazu geht noch etwas auf“); je Einheit einmal, gemerkt unter `gm:sp:<plan>:enthuellt`, auch über das Neuladen. Die Karte lebt in der obersten Ebene (Suche, Reise-Modus oder Stationspanel), damit die Tastatur sie erreicht; neben dem Stationspanel (breit genug) steht sie links auf dem abgedunkelten Grund, sonst unten rechts über der Fußleiste.
  Zeit-Freischaltungen, die geschahen, während der Tab zu war, zeigen sich beim nächsten Öffnen. **Stille Fälle:** der erste Start (nichts davon war „neu“) und die Übernahme alter Besuche (M7).
  Dieselbe Karte trägt noch drei Momente: **Fähigkeiten** (bei Stufe 2, der höchsten im Museum: „Du kannst jetzt mehr“ mit dem „Ich kann …“-Satz, G6; auf dem Weg dahin sagt jede Station, die sie übt, am Ende „Das übt: Ich kann …“), **Abschluss** einer Reise oder eines Gebiets bei Stufe 2 (der `abschluss`-Text; nicht, wenn gerade der Stempel der Reise im Reise-Modus erscheint, der ihn selbst erzählt) und **Auftakt** eines Gebiets, wenn man zum ersten Mal eine seiner Reisen betritt.
- **Begründung:** Die Karte sitzt neben dem Handeln, nicht in einem Reiter; sie ist Belohnung, kein Hindernis. Schließen heißt „Weiter“, nicht „bestätigen“. Sie verschwindet nicht von selbst: Wer eine Enthüllung liest, soll nicht gehetzt werden (Grundsatz „Vorschläge statt Zwang“), und wer sie wegklickt, hat sie gesehen.
- **Grenze:** Die Karte deckt, wo sie steht, einen Teil des Inhalts ab. Sie ist klein, weicht dem Panel aus, wo es geht, und lässt sich mit einem Klick (oder Escape) schließen; auf dem Handy liegt sie über dem Fuß. Ob die Position stört, zeigt nur ein Test mit Menschen.

### M10 · Gesperrtes ist angedeutet, Verborgenes bleibt ungenannt (Karten, Suche, Reise-Modus, Adresse)
- **Worum es geht:** der Grundsatz, dass Verborgenes nicht verraten wird, das Feld `sichtbar`, der Bedingungssatz im Spielstand, A3 (Vererbung) und A15.
- **Auslegung:** **Angedeutet** heißt: Titel, Symbol und ein Satz mit der `bedingung`, kein Inhalt. Reise-Karten (Eingang und Reiseliste) zeigen ein Schloss, den Satz statt der Tagline, keine Stationsleiste und den Knopf „Was fehlt noch?“, der zum Hinweisbild führt (keine Sackgasse). Die Suche zeigt eine gesperrte Station oder Reise
  nur dann, wenn ihr **Titel** trifft (nie über den Text), mit dem Satz statt des Auszugs; „Überrasch mich“ wählt nur Offenes. Die Kreuzungsliste einer Station nennt eine gesperrte Reise mit der Bedingung statt ihrem Kreuzungssatz. Im Reise-Modus bleiben gesperrte Haltestellen im Linienplan (gestrichelt, kursiv, „Noch verschlossen“ für den Screenreader),
  die Station zeigt das Hinweisbild, „Weiter“ geht einfach weiter (die Große Rundreise erklärt es ebenso); „Nächster Halt“ und die Fußleiste nennen nur den Titel. **Adresse:** `#/station/<id>` und `#/reise/<id>` einer gesperrten Einheit zeigen das **Hinweisbild** (im Stationspanel, auch für Reisen): Schloss, „Noch verschlossen“, Titel, die Bedingung, die nächste Aufgabe mit Knopf (heißt sie genau diese Einheit zu öffnen, „Der Weg dorthin“),
  der Freie Zugang als Schalter. Vor und zurück sind dort aus. **Verborgen** (`sichtbar: verborgen`, auch geerbt) heißt: keine Karte, kein Suchtreffer, keine Kreuzung, in Listen nur „etwas Verborgenes“; unter der Adresse steht „Noch verborgen“ ohne Namen und ohne Bedingung. Die Zahlen im Eingang („Drei Reisen“) zählen Verborgenes mit; das ist bekannt und klein.
- **Begründung:** Die Sperre ist ein Versprechen („hier wartet etwas“), keine Mauer. Das Hinweisbild ist nie eine Sackgasse: Es sagt, was fehlt, und führt zu genau einer Aufgabe oder zum Schalter. Die Suche darf den Text einer gesperrten Station nicht verraten, auch nicht über Treffer.

### M11 · Der Eingang: genau eine nächste Aufgabe
- **Worum es geht:** die eine nächste Aufgabe (A10), der Rhythmus (Takt und Wiederkehr) und Befund BE2 des Generators („Noch 2 Schritte“ für eine unberührte Station).
- **Auslegung:** Unter den Knöpfen des Eingangs steht eine kleine Karte: Art („Dein Einstieg“ beim ersten Besuch, „Als Nächstes“, „Ein Wiedersehen“ bei einer fälligen Wiederkehr), der Satz der Aufgabe, ein Satz, **was sie bringt**, und ein Knopf zur Adresse der Aufgabe. Dazu, wenn eine Pause läuft, ein Satz mit dem Zeitpunkt
  („… geht in 2 Std. auf“; kein Zähler, kein Balken) und der Schalter für den Freien Zugang. Keine Zahlen über den Fortschritt, kein Reiter, keine Liste. Gibt es nichts zu tun, steht dort ein ruhiger Satz. Der Satz „was sie bringt“ stammt vom Kern; nur eine Zeile schreibt die Anbindung um: Der Kern zählt Stufen („Noch 2 Schritte“ für eine Station,
  die ein einziger Besuch von 0 auf 2 hebt); im Museum ist eine Einheit ein Schritt, der Satz heißt dann „Danach geht … auf.“ (`noch_einheiten`).
- **Fällige Wiederkehr** erscheint als Wiedersehen-Aufgabe, ohne Pflicht (A9: eine einzige, keine Liste). **Verwitterung** zeigt sich so: eine Reise-Karte mit gepunktetem Symbol und „Wartet auf ein Wiedersehen“; in der Station ein Satz „Schön, dass du wieder da bist“ und nach dem Lesen „Aufgefrischt.“. Es gibt keine Serien und nichts, was reißt, kein „verpasst“, keinen Rückstand, keine Punkte.
- **Rückmeldung am Ort:** Eine gelesene Station trägt „Geschafft“ im Kopf und am Ende einen Satz, was sie der Reise bringt („Noch 3 Schritte, dann ist die Reise „X“ geschafft.“, gerechnet auf Stufe 2 und mit den Gewichten des Plans); nach Mythos-Karte und Exponat steht die Rückmeldung gleich dort.

### M12 · Geschichte: Auftakt, Abschluss, Etappe
- **Worum es geht:** die Felder `auftakt`, `abschluss`, `etappe` und die Etappen.
- **Auslegung:** Das `auftakt` der Episode steht in der Einführung der Reise (Reise-Modus) als eigene Karte; die `etappe` gibt der Einführung ihre Überschrift („Dein Einstieg“, „Entdecken“, „Vertiefen“, „Finale“). Der `abschluss` steht auf der Abschlusskarte (Stempel), sobald die Reise geschafft ist (Stempel **oder** Stufe 2 nach der Sammelregel), und als Moment (M9).
  Wiederholt ein Text, was die Reise-Daten schon sagen (der Generator leitet Auftakt und Abschluss aus Tagline, Einleitung und Ausblick ab), zeigt die Anbindung ihn nicht noch einmal.
- **Begründung:** Eine Geschichte, die doppelt dasteht, ist keine. Mit handgeschriebenem Auftakt kommt er vor der Einleitung; bei abgeleitetem sieht man nur, was schon dasteht.

### M13 · Zeit: UTC, 30 Sekunden, `__SP_HEUTE`
- **Worum es geht:** A1 (Zeit ist UTC) und die Regel, dass Bedingungen nur wahr werden können.
- **Auslegung:** Die Uhr ist die des Geräts in UTC (A1); jede halbe Minute (und beim Zurückkommen in den Tab) rechnet die Anbindung neu, damit Pausen und Takt sich zeigen, ohne dass man etwas tut. Zum Testen überschreibt `window.__SP_HEUTE` (Text, Zahl oder Funktion) die Uhr; `window.__SP_VERWEIL` (Faktor) kürzt die Lesezeiten.
  Beides ist wirkungslos, wenn es nicht gesetzt ist, und sendet nichts.
- **Grenze:** Der Tag beginnt für Lernende in Deutschland um 1 oder 2 Uhr; ein „Wiedersehen am dritten Tag“ ist also nach Mitternacht UTC fällig. `zeitzone` im Plan fehlt (A1).

### M14 · Speicher und Datenschutz
- **Worum es geht:** die Zusage „nur lokal“ und A16.
- **Auslegung:** Nur lokal, Präfix `gm:sp:`, jeder Zugriff in `try/catch`, ohne Speicher läuft alles im Arbeitsspeicher weiter: `gm:sp:<plan>:ereignisse`, `…:wer`, `…:enthuellt`, `…:migration` und `gm:sp:frei`. Die Seite sendet nichts (getestet: alle Anfragen sind `file:` oder `data:`); der Adapter für xAPI und SCORM wird vom Build nie eingebunden.
  Ein zweiter Tab teilt den Stand über das `storage`-Ereignis. Das Zurücksetzen im Reisepass (`MUSEUM.store.reset()`) setzt auch den Spielstand zurück (neue Kennung, alle Marken weg).

### M15 · Prüfung im Paket
- **Auslegung:** `node tools/check-pack.mjs <paket>` prüft `spielplan.json`, wenn sie da ist (Regeln und Erreichbarkeit wie `check-spielplan`) und gleicht sie mit dem Paket ab: Einheiten, die nichts im Paket meinen, Stationen und Reisen ohne Einheit, `stufen.bis` (M2), Werkzeuge ohne gültigen `einsatz` (M5).
  Ein Rauchtest (`tools/smoke.mjs`) schaltet den Freien Zugang ein, damit er jede Station öffnen kann; die Sperren prüft `tools/spiel-test.mjs`.

### Befunde zum Standard (aus der Anbindung an das Museum)
Je Befund: Worum es geht, Problem, Vorschlag. Nummern BM1 bis BM8 gehören zu diesem Abschnitt und setzen die Tabellen B und BE oben fort.

| Nr | Worum es geht | Problem | Vorschlag |
|---|---|---|---|
| BM1 | Stufen, Verb `geschafft` | `geschafft` heißt „Grundverständnis“, ein Museum kann nur „gelesen“ messen. Ohne Wort für das, was eine App wirklich weiß, behauptet jede App etwas anderes (M3: Scroll plus Zeit; M4: Bedienung plus Zeit; ein Quiz würde `bestanden` melden). | Je Ereignis eine Angabe, **wie** es zustande kam (`quelle` oder eine Belegart `lesen`/`bedienen`), damit Stufe 2 aus Lesen und Stufe 2 aus Prüfung unterscheidbar bleiben, und bei den Stufen sagen, dass Stufe 2 auch „gelesen“ sein darf. |
| BM2 | Wiederkehr, A9 | Wiederkehr wird durch ein **neues Ereignis** eingelöst. Der Standard sagt nicht, dass eine App jedes Wiedersehen melden muss; meldet sie nur den Erstbesuch, bleibt die Wiederkehr für immer fällig. Das Museum meldet jeden Besuch, der M3 erfüllt, höchstens alle zehn Minuten. | Beim Takt sagen, welche Ereignisse als Wiedersehen zählen (jedes `geschafft`/`erkundet` nach dem Abstand) und dass Apps sie melden müssen. |
| BM3 | Felder, Regeln, A3 | Eine Station in einer offenen Reise kann einzeln gesperrt sein. Ein Reise-Modus, der Stationen der Reihe nach zeigt (hier der Kern des Museums), braucht eine Aussage, ob er überspringt oder erklärt; der Standard kennt keine Reihenfolge der Darstellung. | Beim Spielstand oder bei den Grenzen aufnehmen: gesperrte Einheiten einer Folge bleiben sichtbar (angedeutet) und werden nicht übersprungen; „Weiter“ geht weiter. |
| BM4 | Grundsatz „Verborgenes nicht verraten“, Spielstand | Verborgenes darf nicht beim Namen genannt werden, aber Zähler der App („Drei Reisen“, Titel der Seite, Länge eines Balkens) verraten es doch. | In den Hinweisen für Apps sagen, dass Zahlen und Fortschrittsanzeigen nur sichtbare Einheiten zählen, oder `verborgen` als „nicht in Zahlen“ führen. |
| BM5 | Zeit-Bausteine, B15, A20 | Ein Freier Zugang ist in jeder Lernumgebung nötig (Sprachen, aufmerksamkeitssensible Themen), steht aber nirgends als App-Funktion. Seine Bedeutung (Zugang ja, Ereignisse und Regeln nein, Pausen aus) ist hier erfunden. | `freier_zugang` als Funktion der App festschreiben: öffnet alles, überspringt Pausen, zählt weiter; und dass die nächste Aufgabe ein Vorschlag bleibt. |
| BM6 | Kurzform der Ereignisse | Ereignisse **ohne wahren Zeitpunkt** (Übernahme alter Besuche) haben kein Kennzeichen. Eine App, die Besuche aus einer Zeit vor dem Spielplan hat, kann nur erfundene Zeiten eintragen. | Ein Feld `herkunft` (`messung`, `migration`, `import`) in der Kurzform, damit Auswertungen sie unterscheiden; Wiederkehr und Takt dürfen Ereignisse mit `herkunft` ignorieren. |
| BM7 | Spielstand, A16 | Das „Gesehen“ der Enthüllung (der Moment wurde gezeigt) ist Zustand der App, nicht der Ereignisse. Jede App muss es erfinden; zwei Geräte zeigen denselben Moment doppelt. | Bei Brücke oder Spielstand ein abgeleitetes Verb `enthuellt` oder einen Merkzettel `gesehen` im Standard führen, mit Synchronisation über die Brücke. |
| BM8 | Durchreichen, Felder | Werkzeug-Ereignisse über `mit` sind in der App eine Entscheidung des Menschen (M5), im Standard nur ein Durchreichen. Dass ein Werkzeug einen Einsatzort **hat**, steht im Entwurf nicht (G2); ohne diesen bleibt jedes Werkzeug eines Museums auf Stufe 0. | `einsatz` (Orte, an denen ein Werkzeug zählt) als Feld des Werkzeugs aufnehmen, mit der Bedingung „bestätigt von der Lernenden“. |
