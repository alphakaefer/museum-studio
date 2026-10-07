# Stationen schreiben

Eine Station ist **eine kleine, genaue Lektion**: ein Experiment, eine Person, ein Konzept, ein Ereignis, eine Methode, ein Irrtum.
Lesezeit etwa eine Minute. Sie soll neugierig machen, etwas Konkretes zeigen und einen Umstieg anbieten.

## Aufbau einer Station (Schema)

```js
MUSEUM.addStations({
'ankereffekt': {
  id:'ankereffekt',                       // = Schlüssel; Kleinbuchstaben, Ziffern, Bindestrich
  title:'Ankereffekt: Zahlen, die festhalten',
  kind:'konzept',                         // konzept | person | ereignis | methode | mythos | instrument | ort
  journeys:['verzerrung','diagnostik'],   // wie in plan.json; die ERSTE ist die Heimat-Reise
  year:1974, yearLabel:'1974',            // Pflicht, wenn die Station auf einer historischen Reise liegt; v. Chr. negativ, Ungefähres: yearLabel:'um 100 n. Chr.'
  icon:'anchor',                          // gültige Schlüssel: node tools/list-icons.mjs [suchwort]
  teaser:'Schon eine Zufallszahl zieht deine Schätzung in ihre Richtung. Probier es unten selbst aus.',   // ≤ 140 Zeichen
  text:[ 'Absatz 1 …', 'Absatz 2 …', 'Absatz 3 …' ],      // 2–4 Absätze, zusammen 90–200 Wörter, Ziel unter 190
  facts:[ 'Kurzer, belegbarer Fakt …', '…' ],               // 2–4, je ≤ 160 Zeichen
  quote:null,                             // { text, who, src } nur mit Beleg, sonst null
  myth:null,                              // Pflicht bei kind:'mythos': { glaube, wahrheit }
  cross:{ diagnostik:'Warum man hier umsteigt: ein konkreter Satz.' },   // ein Eintrag für JEDE andere Reise der Station
  exhibit:null,                           // ID eines Exponats (pack.json "exhibits" UND plan.json "exhibit" müssen dasselbe sagen), höchstens eine Station je Exponat
  blog:[],                                // optional: [{ t:'Titel', u:'https://…' }]
  further:[ 'Autor (Jahr). Titel. Verlag.' ]   // 1–3 reale Lesetipps
}
});
```

## So liest sich eine gute Station

Vorbild (gekürzt, aus dem Beispielpaket): 
> *Tversky und Kahneman ließen Versuchspersonen an einem Glücksrad drehen, das heimlich nur bei 10 oder bei 65 stehen blieb. Danach sollten sie schätzen, wie hoch der Anteil afrikanischer Staaten in den Vereinten Nationen ist. Die Gruppe mit der 10 schätzte im Median 25 Prozent, die Gruppe mit der 65 schätzte 45. Das Rad hatte mit der Frage nichts zu tun.*

Was daran funktioniert:
1. **Der erste Satz ist ein Bild oder eine Szene**, keine Definition. Erst die Geschichte, dann der Begriff.
2. **Konkrete Zahlen und Namen**, die stimmen (und im Faktencheck geprüft sind).
3. **Der zweite Absatz benennt das Phänomen und seine Grenzen** („wird bis heute diskutiert“, „ließ sich replizieren“).
4. **Der letzte Absatz öffnet den Umstieg:** Er verweist darauf, wo das Thema woanders wiederkehrt, oder lädt zum Exponat ein.
5. **Ton:** Du-Ansprache (oder die im Paket gewählte Form), warm, klug, nie belehrend. Ein trockener Humor ist erlaubt, Ironie auf Kosten Betroffener nicht.
6. **Typografie:** deutsche Anführungszeichen „…“, Gedankenstrich –, Mittelpunkt ·, keine Doppelleerzeichen.

## Felder im Detail

**`teaser`** weckt Neugier, verrät aber nicht alles. Er erscheint auf Karten und in der Suche. Keine Frage-Teaser im Stil von „Wusstest du schon?“.

**`facts`**: kurz, überprüfbar, jeder für sich verständlich. Keine Wiederholung des Texts. Lieber Zahl, Datum, Name, Ort.

**`quote`**: nur wörtlich belegte Zitate mit Quelle (Werk, Jahr). Im Zweifel `null`. Übersetzungen als solche kenntlich machen. Berühmte „Zitate“ sind oft falsch zugeschrieben.

**`myth`**: Bei `kind:'mythos'` zeigt die Karte „Was man glaubte“ gegen „Was wir heute wissen“. Beides in 1–2 Sätzen, `wahrheit` mit dem heutigen Stand (und wo er unsicher ist, sagt es das).

**`cross`**: ein Satz je anderer Reise der Station, der **konkret** sagt, was dort mit dieser Station geschieht.
Schlecht: „Auch in der Reise B wichtig.“ Gut: „In der Diagnostik wird derselbe Effekt gefährlich: Ein erster Eindruck verankert alle weiteren Urteile.“

**`kind`**: Art der Station, bestimmt Icon-Farbe und Beschriftung. Gilt branchenübergreifend: `konzept` (Idee, Begriff, Modell), `person`, `ereignis` (Wendepunkt, Studie, Experiment-Ereignis),
`methode` (Verfahren, Technik), `mythos` (Irrtum/Fehlvorstellung mit Korrektur), `instrument` (Test, Messgerät, Apparat), `ort` (Institution, Ort, Gebiet).
Die Beschriftungen kann `pack.json` unter `kinds` ändern (z. B. `instrument` → „Experiment“).

**`year`**: nur bei Stationen auf historischen Reisen Pflicht. Das Jahr, in dem das Ereignis stattfand (nicht das der späteren Veröffentlichung, außer die Veröffentlichung ist das Ereignis).
Ungefähres Datum: `yearLabel:'um 1250'`.

## Länge und Maß
- Text: 90–200 Wörter (Ziel unter 190), 2–4 Absätze. Unter 90 und über 200 meldet `check-data` als Fehler, mit der Wortzahl je Absatz.
- Reise: 11–28 Stationen je Reise, gezählt als Mitgliedschaften (in `pack.json` `limits` anpassbar, begründet). Insgesamt höchstens rund 200 *eindeutige* Stationen (Zählweise: `docs/AGENTEN.md`).
- Teaser ≤ 140 Zeichen, Fakt ≤ 160 Zeichen, `cross`-Satz ≥ 20 Zeichen und ein vollständiger Satz.

## Abbildungen und Exponate (geplant für jede Station)
Jede Station bekommt in `plan.json` ein Feld `visual`: Was kann man hier sehen oder ausprobieren? (`abbildung`, `exponat` oder `keine` mit Begründung; Anleitung: `docs/AGENTEN.md`, Schritt 2b „Anschauung planen“, mit Katalog der Muster und Faustregeln: mindestens 30 % der Stationen, bei abstrakten Themen mehr.)
Der Text darf auf die Anschauung bauen („Zieh unten am Regler“), muss aber ohne sie verständlich bleiben.

Eine Abbildung (`packs/<id>/visuals/<station-id>.js`) erscheint nach dem ersten Absatz der Station und zeigt, was Text schlecht zeigt:
eine optische Täuschung, eine Kurve, eine Anatomie, ein Schema. **Wenn im ersten Absatz ein Phänomen steht, das man sehen muss, braucht die Station eine Abbildung.**
Ein Exponat (`packs/<id>/exhibits/<id>.js`) lässt Besucher etwas selbst ausprobieren. Beide sind reines DOM/SVG/Canvas, ohne externe Abrufe, mit Tastaturbedienung,
Farben nur über Tokens (`var(--ink)`, `var(--accent)`, …), damit sie in jedem Skin und in hell und dunkel lesbar bleiben.
Muster: `packs/_vorlage/visuals/` (gebaut mit dem Baukasten `MUSEUM.viz`: Kurve mit Reglern, Balkenvergleich, Schrittfolge, Tabelle) und `packs/beispiel-gehirn/visuals/` sowie `.../exhibits/` (von Hand gebaut). Der Baukasten ist freiwillig, spart aber viel Arbeit; Übersicht am Kopf von `engine/js/viz.js`.

**Exponat-Schnittstelle in Kürze** (ausführlich: `docs/ARCHITEKTUR.md` 3.7, minimales Beispiel: `docs/AGENTEN.md`, Schritt 4): Datei `exhibits/<id>.js` mit
`MUSEUM.exhibits['<id>'] = { title, blurb, mount(container, ctx) }`; `mount` gibt eine `destroy`-Funktion zurück. Drei Stellen nennen dieselbe ID: `pack.json` `exhibits`, `plan.json` (`"exhibit"` bei der Station) und die Stationsdatei (`exhibit:'<id>'`). `check-pack` meldet Abweichungen.

## Checkliste vor dem Commit
- [ ] Erster Satz = Szene, nicht Definition.
- [ ] Jede Zahl, jedes Jahr, jeder Name stimmt (oder ist abgeschwächt).
- [ ] Kritische Einordnung, wo das Thema umstritten ist.
- [ ] Für jede andere Reise ein konkreter `cross`-Satz.
- [ ] Keine Textblöcke aus Quellen übernommen.
- [ ] Die Station hat ihre geplante Abbildung oder ihr Exponat (oder die Verschiebung steht in `ARBEITSSTAND.md`).
- [ ] `node tools/check-data.mjs <paket> <datei>` grün.
