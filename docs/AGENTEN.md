# Anleitung für KI-Agenten: ein neues Wissensgebiet einrichten

Diese Anleitung ist für Agenten (und Menschen), die das Framework mit einem neuen Thema füllen, zum Beispiel Quantenphysik,
Organisationsentwicklung oder Spieltheorie. Die **Engine wird dafür nicht angefasst.** Alles Fachliche steht in einem Paket
unter `packs/<id>/`. Wenn du glaubst, die Engine müsse geändert werden, trage es in `docs/ENGINE-WUENSCHE.md` ein (Vorlage dort) und mache mit dem Paket weiter.

Lies zuerst `README.md`, `docs/INHALT-SCHREIBEN.md` und das Muster-Paket `packs/_vorlage/`. Wenn du ein Beispiel für ein fertiges,
größeres Paket brauchst: `packs/beispiel-gehirn/`. Wer Datenformate im Detail braucht (alle `pack.json`-Felder, `plan.json`, Exponate): `docs/ARCHITEKTUR.md`, Abschnitt 3.

**Zählweise, überall in dieser Anleitung gleich:** *Station* heißt **eindeutige Station** (ein Eintrag in `plan.json` `stations`, egal auf wie vielen Reisen sie liegt).
*Mitgliedschaft* heißt: eine Station auf einer Reise (Summe der Längen der Listen in `orders`). Beispiel „spieltheorie“: 28 Stationen, 39 Mitgliedschaften, 10 Kreuzungen (Stationen auf mehr als einer Reise).
Die Grenzen „je Reise 11 bis 28“ zählen Mitgliedschaften einer Reise; „insgesamt höchstens rund 200“ zählt eindeutige Stationen.

## Das Ziel in einem Satz

Besucher gehen **Reisen** durch ein Fachgebiet, jede Reise besteht aus **Stationen** (je eine kleine, genaue Lektion),
und **dieselbe Station liegt auf mehreren Reisen**, sodass man umsteigen kann. Der Wert des Museums liegt in den Kreuzungen:
Man merkt, dass das Gebiet ein Netz ist und kein Inhaltsverzeichnis.

## Ablauf in acht Schritten

Arbeite in dieser Reihenfolge. Jeder Schritt endet mit einem Befehl, der grün sein muss, und mit einem Commit.

### 0. Rahmen klären
**Gibt es `packs/<id>/BRIEFING.md` (und `BRIEFING.json`)? Dann ist das der Auftrag.** Das Onboarding (`npm run setup`, siehe `docs/ONBOARDING.md`) hat Thema, Zielgruppe, Ton, Umfang, Reisevorschläge, heikle Themen, Quellen, Look und Lizenz bereits mit dem Auftraggeber geklärt,
`pack.json` ausgefüllt und das Gerüst angelegt. **Frage das nicht erneut**, sondern lies `BRIEFING.md` ganz (Sorgfaltsregeln und die Checkliste „Was der Agent liefern soll“ inklusive) und arbeite ab Schritt 1.
Was im Briefing fehlt oder dort als „Standardwert“ markiert ist, entscheidest du vorsichtig und trägst es in `ARBEITSSTAND.md` unter „Annahmen“ ein (die Onboarding-Annahmen stehen schon dort; „Bestätigt“ bleibt „offen“). Das Gerüst darfst du im Plan umbauen; der Auftrag (Umfang, Quellen, Sorgfalt) gilt.
Fehlt das Briefing, klärst du den Rahmen selbst, wie folgt.

Kläre in wenigen Sätzen und schreibe es in `packs/<id>/pack.json` und `packs/<id>/ARBEITSSTAND.md` (das legt `new-pack` an; Vorlage: `packs/_vorlage/ARBEITSSTAND.md`):
- Zielgruppe und Vorwissen (neugierige Laien? Studierende? Fachleute im Nachbargebiet?), Sprache, Ton.
- Umfang: **6 bis 16 Reisen, je 11 bis 28 Stationen auf einer Reise (Mitgliedschaften), insgesamt höchstens rund 200 eindeutige Stationen.** Lieber 6 sehr gute Reisen als 16 dünne.
- Welche Quellen sind erlaubt (eigene Texte des Auftraggebers, offene Quellen, nichts Fremdes kopieren). Link-Regeln: `blog` und `material.js` nur mit geprüften, öffentlichen https-Links (Titel + Link, nichts hineinkopieren);
  gibt es eine Datei `packs/<id>/quellen.txt` (eine erlaubte URL je Zeile), sind nur dort gelistete Links erlaubt (`check-data`/`check-material` erzwingen es). Rechte-Angaben eines Auftraggebers respektieren.
- Gibt es heikle Stellen (Gesundheit, Politik, Religion, Gewalt)? Dann gilt Abschnitt „Heikle Themen“ unten.
- **Museumsname kurz halten: etwa 24 Zeichen** (`check-pack` warnt ab 30). Der Name steht in Kopfleiste und als große Überschrift im Eingang; lange Namen brechen um oder werden abgeschnitten.
  Den Untertitel setzt du in `eyebrow` (Zeile über dem Titel) und `tagline`, nicht in `title`. Also „Spieltheorie“ als `title`, „Wie Entscheidungen aufeinander treffen“ in `eyebrow`/`tagline`.
- Pflichtfelder von `pack.json` und was jedes bewirkt: `docs/ARCHITEKTUR.md`, Abschnitt 3.1 (u. a. `stationFiles`: optionale Ladereihenfolge der Dateien in `stationen/`; fehlt es, werden alle Dateien alphabetisch eingebunden, es ist also nicht nötig).
Gerüst anlegen: `node tools/new-pack.mjs <id> --title="…" --journeys=<n> [--historical=<m>] [--stations=<s>]` (die letzten `m` Reisen sind historisch; Rümpfe stehen in `stationen/<reise-id>.js`, je Reise `s` Stationen, Standard 11; das Onboarding ruft das für dich auf).

**Wenn niemand antwortet (autonomer Lauf).** Warte nicht auf den Auftraggeber. Triff die Entscheidung selbst, **schreibe sie in `ARBEITSSTAND.md` unter „Annahmen“ ausdrücklich als Annahme** (Datum, Entscheidung, Begründung, „Bestätigt: offen“) und arbeite weiter.
Wähle im Zweifel die vorsichtigere Variante (kleiner Umfang, neutraler Ton, nur offene Quellen, keine historische Reise). Annahmen, die den Inhalt stark lenken (Zielgruppe, Schulenauswahl, Umfang), gehören auch in deinen Abschlussbericht.
Der Auftraggeber kann sie später bestätigen oder umwerfen; was nicht festgehalten ist, kann er nicht prüfen.

### 1. Reisen finden
Eine Reise ist **eine Frage oder ein Weg**, kein Kapitel. Gute Reisen haben einen Titel, der etwas verspricht
(„Wie funktioniert das Gehirn?“, „Wann kooperieren Egoisten?“), und eine Tagline, die neugierig macht.
Zwei Sorten:
- **Funktionale Reisen** (`typ:'funktional'`): ein Teilgebiet, eine Fähigkeit, ein Problem. Reihenfolge nach Verständnis (vom Einfachen zum Schwierigen, vom Phänomen zur Erklärung).
- **Historische Reisen** (`typ:'historisch'`): Entwicklung über Zeit, Stationen mit Jahreszahl, strikt chronologisch. Sie erscheinen im Zeitstrahl.
  Nur anlegen, wenn die Geschichte selbst etwas erklärt (Irrtümer, Wendepunkte). Maximal 3; weniger ist oft besser.
  Der Zeitstrahl passt seine Achse den Jahren der historischen Reisen an (Puffer davor und dahinter, Epochennamen nur dort, wo Stationen liegen); Jahre zwischen −1700 und 2027 sind möglich.
Prüfe: Würde jemand die Reise von vorne bis hinten gehen wollen? Gibt es einen Bogen mit Anfang, Wendung, offener Frage am Ende?
Überschneidungen zwischen Reisen sind **gewollt**. Teste: Fallen dir für jede Reise mindestens drei Stationen ein, die auch auf einer anderen liegen könnten?

### 2. Stationsplan (`plan.json`) zuerst, Texte danach
Lege ALLE Stationen als Plan an, bevor du einen Absatz schreibst: `id` (kleinbuchstaben-mit-bindestrich), `title`, `kind`,
`journeys` (die erste ist die Heimat-Reise), `year` und `yearLabel` (Pflicht bei Stationen auf historischen Reisen), `why` (ein Satz: warum diese Station, was lernt man),
und `exhibit` (optional: ID eines Exponats, siehe unten). Dazu `orders`: die Reihenfolge je Reise. Danach plane die **Kreuzungen** bewusst:
- Ab 6 Reisen sollte jede Reise Kreuzungen zu mindestens 4 anderen haben (bei weniger Reisen zu mindestens einer, siehe `limits.minCrossJourneys`), das Netz muss zusammenhängen (keine Insel).
- Eine Station gehört nur dann zu mehreren Reisen, wenn der Zusammenhang **echt** ist und sich in einem Satz begründen lässt.
  Keine Alibi-Kreuzungen. Typische echte Kreuzungen: dasselbe Experiment, dieselbe Person in zwei Rollen, dasselbe Konzept in zwei Anwendungen, ein Irrtum und seine Korrektur.
- **Heimat-Reise** (die erste in `journeys`) bestimmt, in welcher Datei die Station steht (`stationen/<heimat-reise>.js`) und welche Akzentfarbe sie bekommt. Faustregel: die Reise, deren Leitfrage die Station am meisten beantwortet.
  Liegt eine Station auf einer funktionalen **und** einer historischen Reise, ist die **funktionale** meist die richtige Heimat (die historische zeigt nur, wann es geschah);
  ist die Station selbst ein Wendepunkt der Geschichte (z. B. ein Beweis von 1950, ein Skandal), darf die historische Heimat sein. `check-plan` lässt beides zu; entscheide nach der Faustregel und halte es im Plan einheitlich.
  Die Aufteilung nach Heimat-Reise macht Dateien ungleich groß (z. B. 12, 11 und 5 Stationen); das ist normal.
- **Exponate** (interaktive Stücke) gehören an genau eine Station. Dazu drei Einträge, die zusammenpassen müssen: die ID in `pack.json` `exhibits`, `"exhibit":"<id>"` bei der Station in `plan.json`
  und `exhibit:'<id>'` in der Stationsdatei; die Datei selbst liegt in `exhibits/<id>.js` (Schnittstelle unten). `check-pack` meldet jede Abweichung und sagt, was zu ergänzen ist.
- **Icons** (`icon` bei Reisen und Stationen): `node tools/list-icons.mjs` listet alle gültigen Schlüssel nach Gruppen, `node tools/list-icons.mjs <suchwort>` filtert. Du musst `engine/js/icons.js` nicht lesen.
Prüfen: `node tools/check-plan.mjs <id>`. Erst weiter, wenn grün. **Zeige den Plan dem Auftraggeber**, bevor du viel Text schreibst; ist niemand erreichbar, halte den Plan als Annahme in `ARBEITSSTAND.md` fest und schreibe weiter.

### 3. Reise-Daten und Farben (`journeys.js`)
Name, Kurzname (≤ 14 Zeichen empfohlen, Warnung ab 24), Tagline (≤ 70), Intro (2–3 Sätze), Outro (1–2 Sätze, eine offene Frage), Icon (`node tools/list-icons.mjs`), `color:{light,dark}`.
Farben: gut unterscheidbar nebeneinander (auch für Farbfehlsichtigkeit nie das einzige Merkmal, der Name steht immer daneben),
hell mindestens 3:1 zum hellen Hintergrund, dunkel mindestens 3:1 zum dunklen (Prüfwerte von `check-pack`, das darunter warnt; mehr ist besser).

### 4. Stationen schreiben
Schema und Stilregeln: `docs/INHALT-SCHREIBEN.md`. Kurzfassung: 2–4 Absätze, 90–200 Wörter (Ziel unter 190), 2–4 Fakten (je ≤ 160 Zeichen), Teaser ≤ 140 Zeichen,
ein Satz `cross` für JEDE andere Reise der Station, Zitate nur, wenn du sie belegen kannst (sonst `null`), Mythos-Stationen mit `myth`.
Mehrere Agenten dürfen parallel schreiben, **eine Datei je Reise** (`stationen/<reise-id>.js`, enthält die Stationen, deren Heimat-Reise sie ist), niemand schreibt in fremde Dateien.
Nach jeder Datei: `node tools/check-data.mjs <id> packs/<id>/stationen/<reise-id>.js`. Die Meldungen nennen Station, Feld und Länge (z. B. „facts[1] ist 171 Zeichen lang“).

**Exponat-Schnittstelle (Kurzfassung).** Ein Exponat ist eine Datei `exhibits/<id>.js`, die sich in `MUSEUM.exhibits` anmeldet. Der Kern zeigt eine Tafel mit Titel und Beschreibung und ruft `mount` erst beim Klick auf „starten“:
```js
(function(){ 'use strict';
MUSEUM.exhibits['muenzwurf'] = {
  title: 'Münzwurf',                       // Titel auf der Tafel
  blurb: 'Wirf zehnmal und sieh, wie schief Zufall aussieht.',   // ein bis zwei Sätze
  mount: function (container, ctx) {       // ctx = { station, journeyId }
    var b = document.createElement('button');
    b.textContent = 'Werfen';
    b.addEventListener('click', function(){ b.textContent = Math.random() < .5 ? 'Kopf' : 'Zahl'; });
    container.appendChild(b);
    return function destroy() { container.innerHTML = ''; };   // Aufräumen: Timer, Listener, Canvas
  }
};
})();
```
Regeln: `mount` baut sich nur in `container` auf und gibt eine Funktion (oder ein Objekt mit `destroy()`) zurück; Farben nur über Tokens (`var(--ink)`, `var(--accent)`, `var(--bg-2)`, `var(--line)` …), eigene Styles als `<style data-gx="<id>">` mit Präfix `gx-`;
Tastaturbedienung; keine externen Abrufe, nichts wird gesendet. Fehler in `mount` fängt der Kern ab, `tools/smoke.mjs` startet jedes Exponat einmal und meldet Konsolenfehler.
Vollständige Beispiele: `packs/beispiel-gehirn/exhibits/`; Details: `docs/ARCHITEKTUR.md` 3.7.

### 5. Faktencheck (Pflicht; die Prüfstufe wird ehrlich benannt)
Jede Zahl, jedes Jahr, jede Zuschreibung („X hat Y gezeigt“), jedes Zitat, jede Stichprobengröße, jeden Superlativ prüft jemand **Station für Station mit Quellen** (Websuche, Primärquellen, Fachliteratur, Fachgesellschaften).
Ergebnis je Station: bestätigt / korrigiert (mit Quelle) / abgeschwächt / gestrichen. Was sich nicht belegen lässt, wird gestrichen oder vorsichtig formuliert („nach heutigem Stand“, „vermutlich“).

**Drei Prüfstufen** (trage die erreichte Stufe je Station in `FAKTENCHECK.md` und je Reise in `ARBEITSSTAND.md` ein):
1. **Unabhängig geprüft:** ein anderer Agent oder Mensch als der Autor, mit Quellen. Das ist der Standard, wenn du Unteragenten starten kannst (Briefing unten; ein Prüfauftrag je Heimat-Reise-Datei, **schneide ihn nach Station, nicht nach Datei**, weil Kreuzungsstationen mehrere Reisen berühren: jede Station genau einem Prüfer zuweisen).
2. **Selbstprüfung:** derselbe Agent prüft seine Texte in einem **getrennten Durchgang** mit Quellen (frische Suche je Behauptung, nicht aus dem Schreibfluss; zuerst alle Behauptungen als Liste herausziehen, dann je Behauptung suchen).
   Das ist der Weg, wenn es keine Unteragenten gibt. Es ist schwächer als Stufe 1, weil dieselben Denkfehler zweimal passieren können; sage das offen.
3. **Gedächtnis:** nicht mit Quellen geprüft. Nur für Unstrittiges (Allgemeinwissen) vertretbar und immer als solche Stufe vermerkt. Nie für Zahlen, Zitate, Zuschreibungen.

**Veröffentlichung nur mit Hinweis auf die Stufe.** Ein Paket, das nicht überall Stufe 1 erreicht, wird mit dem ausdrücklichen Satz übergeben, welche Stufe gilt (im Abschlussbericht, in `ARBEITSSTAND.md` und in `credits` bzw. `footer` oder `FAKTENCHECK.md`, z. B.
„Faktencheck: Selbstprüfung mit Quellen, noch nicht unabhängig geprüft“). Stufe 3 darf nicht veröffentlicht werden, ohne dass der Auftraggeber es weiß.

**Vorlage für `packs/<id>/FAKTENCHECK.md`** (auch als Datei in `packs/_vorlage/FAKTENCHECK.md`), eine Zeile je Station (die beiden Zeilen sind **erfundene Beispielzeilen** zur Form, keine Prüfergebnisse):

| Station (ID) | Prüfstufe | Ergebnis | Was geändert wurde | Quelle(n) | Geprüft von / Datum |
|---|---|---|---|---|---|
| `ankereffekt` | unabhängig geprüft | korrigiert | Median 25 % statt 45 % bei Glücksrad 10 | Tversky & Kahneman (1974), Science 185 | Prüfer-Agent B, 2026-01-12 |
| `kaldi-legende` | Selbstprüfung | abgeschwächt | „im 9. Jh.“ → „der Legende nach“ | Weinberg & Bealer (2001) | Autor-Agent, getrennter Durchgang |

Ergebnis: `bestätigt`, `korrigiert`, `abgeschwächt` oder `gestrichen`. Über der Tabelle: Gesamtstufe des Pakets, offene Zweifel, was **nicht** prüfbar war.

### 6. Verweise auf weiterführende Quellen (optional)
`material.js`: nur **Titel + Link** auf Quellen, die du geprüft hast und die öffentlich sind. Nichts hineinkopieren.
Wenn der Auftraggeber ein eigenes Register/Blog hat, respektiere dessen Rechte-Angaben (nur öffentlich Freigegebenes verlinken).
`check-material.mjs <id>` prüft die Form.

### 7. Layout, Bau, Rauchtest
```
node tools/layout-map.mjs <id>        # Netzplan-Layout berechnen (schreibt packs/<id>/layout.js)
node tools/check-pack.mjs <id>        # alle Prüfungen
node tools/build.mjs <id> --skins=all # erzeugt dist/<id>/
node tools/smoke.mjs <id>             # Browser-Rauchtest: Ansichten, Größen, Skins, hell/dunkel, jedes Exponat (braucht Playwright, siehe README)
```
Die Screenshots liegen standardmäßig in `dist/<id>/_shots/`. Sieh dir Netzplan, Zeitstrahl, drei Stationen und Handy selbst an. Ein grüner Test ersetzt das Hinsehen nicht.
Kannst du keine Bilder ansehen oder Playwright nicht installieren, halte das in `ARBEITSSTAND.md` fest („Sichtprüfung offen“).

### 8. Übergabe
Halte `packs/<id>/ARBEITSSTAND.md` aktuell (Stand, Annahmen, Fortschritt je Reise, Offenes, bekannte Schwächen, nächste Schritte) und **committe nach jedem Schritt** (pushe, wenn ein Remote eingerichtet ist und du es darfst).
Sitzungen und Nutzungslimits brechen unvermittelt ab; was nicht im Repository liegt, ist verloren.

## Verbindliche Regeln

1. **Nichts erfinden.** Keine Personen, Jahre, Zahlen, Studien, Zitate, Links. Unsicheres weglassen oder als unsicher kennzeichnen.
2. **Kritisch einordnen**, wo ein Gebiet umstritten ist (Replikationskrise, Interpretationsstreit, unbewiesene Modelle, überholte Theorien).
   Mythen und Irrtümer als solche kennzeichnen (`kind:'mythos'`), mit „Was man glaubte / Was wir heute wissen“.
3. **Mehrere Positionen fair darstellen.** Wo Schulen oder Weltanschauungen konkurrieren (Interpretationen der Quantenmechanik, ökonomische Schulen, Management-Moden),
   nicht eine Seite als Wahrheit setzen; Stärken und Schwächen jeder Position nennen; Wortwahl neutral. Lies deinen Text, als wärst du Anhänger der Gegenseite.
4. **Eigene Formulierungen.** Keine Textblöcke aus Quellen übernehmen. Kurze, belegte Zitate sind erlaubt (Quelle angeben).
5. **Anschaulich statt Lexikon.** Jede Station hat ein konkretes Bild, ein Experiment, eine kleine Geschichte oder ein Beispiel; der Einstieg ist ein Haken, kein Definitionssatz.
6. **Jeder Umstieg wird begründet** (`cross`, ein konkreter Satz).
7. **Keine Heilsversprechen, keine Beratung im Einzelfall** (Gesundheit, Recht, Geld). Bildung, keine Handlungsanweisung.
8. **Datenschutz:** keine externen Abrufe in die Seite, keine Tracker, keine eingebetteten Fremdinhalte. Schriften sind Systemschriften.
9. **Engine nicht anfassen**; Wünsche in `docs/ENGINE-WUENSCHE.md` (Vorlage dort).
10. **Kleine Schritte, oft committen.** Eine Reise, ein Commit.

## Heikle Themen
Bei Gewalt, Krieg, Missbrauch, Suizid, Krankheit, Diskriminierung: sachlich und würdig schreiben, keine Details, die verletzen oder nachahmen lassen,
ein Hinweis auf Hilfsangebote in `pack.json.footer`, wenn Besucher betroffen sein können. Bei politischen oder religiösen Themen gilt Regel 3 besonders streng.

## Typische Fehler (aus dem Gehirnmuseum gelernt)
- **Zuschreibungen:** Berühmte Sätze stammen oft nicht von der berühmten Person („vom Kopf auf die Füße“ ist kein Marx-Zitat). Zitate immer an der Primärquelle belegen.
- **Zahlen:** Stichprobengrößen, Prozentwerte, Jahre aus der Erinnerung sind häufig falsch (Beispiele aus dem Faktencheck: 81 statt 100 Patienten, 124 statt 100 Unterzeichner, Rang „Mitläufer“ statt „Entlasteter“).
- **Die populäre Version statt der belegten:** Der berühmte Versuch lief anders ab, als im Lehrbuch steht. Prüfe, was wirklich gemessen wurde.
- **Falsche Chronologie** in historischen Reisen (Jahreszahl der Veröffentlichung statt der Entdeckung; ungefähre Datierung nicht als `um` gekennzeichnet).
- **Alibi-Kreuzungen** und `cross`-Sätze, die nur den Titel wiederholen.
- **Zu lange Texte.** Ziel unter 190 Wörtern, ab 201 meldet `check-data` einen Fehler. Wenn du mehr brauchst, sind es zwei Stationen.
- **Leerer Schluss:** Jede Reise braucht eine Outro-Frage, die über den Stoff hinausweist.
- **Weltanschauliche Schlagseite** ohne es zu merken (siehe Regel 3). Der Auftraggeber hat im Gehirnmuseum genau das bemerkt: eine Reise über die Philosophie des Geistes ließ Idealismus fast aus. Prüfe am Ende bewusst: Welche Schulen fehlen?

## Fertig ist ein Paket, wenn …
- [ ] `node tools/check-pack.mjs <id>` ohne Fehler (Warnungen begründet).
- [ ] Faktencheck ist in `FAKTENCHECK.md` dokumentiert, mit Prüfstufe je Station; bei Stufe 2 oder 3 steht der Hinweis in der Übergabe.
- [ ] `node tools/build.mjs <id> --skins=all` und `node tools/smoke.mjs <id>` ohne Fehler.
- [ ] Du hast Netzplan, Zeitstrahl (falls vorhanden), drei Stationen und die Handyansicht als Bild angesehen (oder die fehlende Sichtprüfung vermerkt).
- [ ] Jede Reise hat Intro, Outro, Farbe, Icon; jede Kreuzung eine Begründung.
- [ ] `packs/<id>/ARBEITSSTAND.md` ist aktuell (inkl. Annahmen), alles ist committet.

## Anhang: Briefings zum Kopieren

**Stationsautor** (je Reise ein Agent): „Du schreibst die Stationen der Reise `<reise>` im Paket `<id>`. Lies docs/INHALT-SCHREIBEN.md und packs/_vorlage/stationen/*.js.
Schreibe `packs/<id>/stationen/<reise>.js` für alle Stationen, deren erste Reise `<reise>` ist (Liste in plan.json; bei `new-pack` stehen dort schon Rümpfe). Halte Schema und Wortgrenzen ein, erfinde nichts,
schreibe für jede weitere Reise einer Station einen konkreten `cross`-Satz. Prüfe mit `node tools/check-data.mjs <id> packs/<id>/stationen/<reise>.js`. Committe.“

**Faktenprüfer**: „Prüfe die dir zugewiesenen Stationen (IDs: …) in `packs/<id>/stationen/<reise>.js` Satz für Satz mit Websuche gegen verlässliche Quellen (Primärquellen, Fachliteratur, Fachgesellschaften).
Prüfe besonders Jahre, Zahlen, Zuschreibungen, Zitate, Superlative. Korrigiere direkt in der Datei, schwäche Unsicheres ab, streiche Unbelegbares.
Schreibe pro Station eine Zeile in `packs/<id>/FAKTENCHECK.md` (Tabellenvorlage in Schritt 5): Prüfstufe „unabhängig geprüft“, Ergebnis (bestätigt / korrigiert / abgeschwächt / gestrichen), was geändert wurde, Quelle. Behalte Wortgrenzen bei und lasse `check-data` laufen.“
