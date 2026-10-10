# Museum Studio – Architektur

Für Entwickler. Diese Datei beschreibt, was im Code tatsächlich steht (Stand: Engine `engine/js/*.js`, Zusammenbau `tools/build.mjs`,
Prüfwerkzeuge `tools/check-*.mjs`). Wer Inhalte schreibt, liest `docs/AGENTEN.md` und `docs/INHALT-SCHREIBEN.md`; wer Skins baut, liest `docs/DESIGNER.md`.
Das Ziel des Projekts steht in `docs/FRAMEWORK-PLAN.md`.

Inhalt

1. Grundsätze
2. Verzeichnisbaum
3. Datenformate (`pack.json`, `plan.json`, `journeys.js`, Stationen, `material.js`, `layout.js`, Exponate und Abbildungen)
4. Build-Pipeline
5. Laufzeit-API
6. Vokabular-Schlüssel
7. Prüfwerkzeuge
8. Was noch fest im Code steht, und wie man es auslagert
9. Erweiterungspunkte
10. Entwurfsentscheidungen

---

## 1. Grundsätze

- **Statisch.** Das Ergebnis ist ein Ordner aus HTML, CSS und JavaScript. Er läuft per Doppelklick (`file://`) und auf jedem Webspace.
  Es gibt keinen Server, keine Datenbank, kein Frontend-Framework und keine Abhängigkeiten zur Laufzeit.
- **Keine externen Abrufe.** Weder Schriften noch Skripte noch Bilder werden von Dritten geladen; die Seite sendet nichts.
  Schriften sind Systemschriften-Stacks. Links zu weiterführenden Quellen sind gewöhnliche Anker (`target="_blank" rel="noopener"`), keine Abrufe.
- **Klassische `<script>`-Tags, keine ES-Module.** Jede Engine-Datei ist ein `(function () { 'use strict'; … })();`. Alles hängt am Namespace `window.MUSEUM`
  (in den Dateien als `var M = window.MUSEUM = window.MUSEUM || {}`). Begründung in Abschnitt 10.
- **Daten sind Skripte.** Weil `fetch()` unter `file://` nicht funktioniert, liefert der Zusammenbau auch `pack.json` und `plan.json` als Skriptdateien aus
  (`data/pack.js`, `data/orders.js`). Stationen, Reisen, Material und Layout sind ohnehin `.js`-Dateien, die sich selbst am Namespace anmelden.
- **Persistenz nur `localStorage`, Schlüsselpräfix `gm:`**, jeder Zugriff in `try/catch`, mit Speicher-Rückfall im RAM (`sget`/`sset` in `core.js`).
  Die Seite muss ohne Speicher voll funktionieren (privater Modus). Verwendete Schlüssel:

  | Schlüssel | Inhalt | Schreibt |
  |---|---|---|
  | `gm:theme` | `"auto"`, `"light"` oder `"dark"` | `core.js` (`MUSEUM.theme`) |
  | `gm:skin` | Skin-ID | `core.js` (`MUSEUM.skin`) |
  | `gm:visited` | Liste besuchter Stations-IDs | `core.js` (`MUSEUM.store`) |
  | `gm:stamps` | Liste der Reise-IDs mit Stempel | `core.js` (`MUSEUM.store`) |
  | `gm:stampdates`, `gm:passseen` | Stempeldatum, „eingeschlagen“ gezeigte Stempel | `passport.js` |
  | `gm:searchgroup` | Gruppierung der Suchtreffer (`reise` oder `art`) | `search.js` |
  | `gm:kartenmodus2`, `gm:karte-gruppe-<gruppe>` | Modus und eingeklappte Legendengruppen der Karte | `map.js` |
  | `gm:zeitMode` | Darstellung des Zeitstrahls | `timeline.js` |

  Der Reisepass-Reset (`MUSEUM.store.reset()`) leert nur `gm:visited` und `gm:stamps`; `passport.js` leert zusätzlich seine beiden Schlüssel.
- **Barrierefrei und responsiv.** Tastaturbedienung, sichtbarer Fokus, `aria-*`, Kontrast AA, `prefers-reduced-motion` (`MUSEUM.reducedMotion()`),
  Handy ab 360 px, kein horizontaler Seiten-Scroll (der Rauchtest prüft das, Abschnitt 7).
- **Keine Fachbezüge in `engine/`.** Reise-IDs, Stations-IDs und Fachtexte stehen nur im Paket. Reisefarben erzeugt der Zusammenbau aus `journeys.js`.
  Ausnahmen, die noch im Code stehen (z. B. Epochennamen im Zeitstrahl, Skins mit Gehirnmuseum-Reise-IDs), listet Abschnitt 8.

---

## 2. Verzeichnisbaum

```
museum-studio/
├─ README.md
├─ engine/                       Alles, was für jedes Wissensgebiet gilt
│  ├─ index.template.html        Seitengerüst mit {{PLATZHALTERN}}
│  ├─ css/engine.css             Tokens (hell/dunkel), Grundlagen, gemeinsame Komponenten
│  ├─ css/exhibits.css           Styles des Abbildungs-Baukastens (Präfix gx-, nur Tokens); Exponate dürfen weiter eigene Styles mitbringen
│  └─ js/
│     ├─ core.js                 Namespace, Wortschatz, Store, Theme, Skins, Graph (finalize), Rundreise, Suchindex,
│     │                          Station-Renderer, Overlays, Router, Stationspanel, Ersatz-Reisemodus
│     ├─ icons.js                MUSEUM.icons (SVG-Iconset)
│     ├─ viz.js                  MUSEUM.viz: Baukasten für Abbildungen und Exponate (freiwillig), lädt vor den Paket-Abbildungen
│     ├─ hero.js                 Canvas im Eingang
│     ├─ map.js                  Ansicht „Karte“ (Netzplan); injiziert eigene Styles (#gm-karte-style)
│     ├─ journey.js              Reise-Modus (Vollbild #reise); injiziert eigene Styles
│     ├─ timeline.js             Ansicht „Zeitstrahl“ (#gm-zeit-style)
│     ├─ passport.js             Ansicht „Reisepass“ (#gm-pass-style)
│     ├─ search.js               Suche als Overlay (#gm-suche-style)
│     └─ app.js                  Start in fester Reihenfolge, Eingang, Skin- und Theme-Knopf, Fuß, Tastenkürzel
├─ themes/<id>/                  Skins: theme.css, theme.json, README.md  (halle, kabinett, ma, quelltext)
├─ packs/<id>/                   Wissensgebiete (Inhalt)
│  ├─ _vorlage/                  kleines, vollständiges Muster („Kaffee“)
│  ├─ beispiel-gehirn/           Auszug aus dem Gehirnmuseum mit Exponaten und Abbildungen
│  └─ <id>/
│     ├─ pack.json  plan.json  journeys.js        Pflicht
│     ├─ stationen/*.js                           Pflicht (Stationstexte)
│     ├─ material.js  layout.js                   optional (layout.js fehlt anfangs, siehe layout-map)
│     ├─ exhibits/<exponat-id>.js                 optional
│     ├─ visuals/<station-id>.js                  optional
│     ├─ quellen.txt                              optional (erlaubte Links; ältere Pakete: blog-urls.txt)
│     └─ ARBEITSSTAND.md  FAKTENCHECK.md          Übergabe und Faktencheck (Vorlagen in _vorlage/; new-pack legt ARBEITSSTAND.md an)
├─ tools/
│  ├─ build.mjs                  Zusammenbau
│  ├─ new-pack.mjs               neues Paket aus Rümpfen
│  ├─ derive-pack.mjs            kleineres Paket aus einem größeren ableiten
│  ├─ layout-map.mjs (+ layout-sa.c)   Netzplan-Layout berechnen
│  ├─ check-lib.mjs              gemeinsame Helfer (kein eigener Befehl)
│  ├─ check-plan.mjs  check-data.mjs  check-material.mjs  check-pack.mjs   Prüfungen
│  ├─ check-skin.mjs             Skin-Prüfung (theme.json, Selektoren, keine externen URLs)
│  ├─ list-icons.mjs             gültige Icon-Schlüssel
│  └─ smoke.mjs                  Browser-Rauchtest (Playwright)
├─ docs/                         diese Dokumentation (AGENTEN, INHALT-SCHREIBEN, DESIGNER, ENGINE-WUENSCHE, …)
└─ dist/<paket>/                 Ausgabe des Zusammenbaus (steht in .gitignore)
```

`packs/gehirn/` (das vollständige Gehirnmuseum) steht ebenfalls in `.gitignore` und ist nicht Teil des Repositorys.

---

## 3. Datenformate

Felder, deren Name mit `_` beginnt (z. B. `_hinweis`), sind Kommentare. Die Prüfungen ignorieren sie (`findTodos` überspringt sie), der Zusammenbau reicht sie unverändert durch.
Das Muster `packs/_vorlage/` ist die beste Referenz; `packs/beispiel-gehirn/` zeigt ein größeres Paket.

### 3.1 `pack.json`

Quelle der Standardwerte: `core.js` (`VOCAB`, `KIND`, `typeLabel`, `renderFooter` in `app.js`) und `tools/build.mjs`.
„Pflicht“ nach `check-pack`; der Zusammenbau selbst verlangt nur `title`.

| Feld | Typ | Pflicht | Standard, wenn es fehlt | Wirkung |
|---|---|---|---|---|
| `id` | Text | ja (`check-pack`) | – | muss dem Ordnernamen entsprechen; Kleinbuchstaben, Ziffern, Bindestriche (führender `_` nur für Vorlagen) |
| `title` | Text | ja (auch Build) | Build bricht ab | Museumsname, **Richtwert ≈ 24 Zeichen, `check-pack` warnt ab 30** (Untertitel gehört in `eyebrow`/`tagline`): Marke in der Kopfleiste, Titel im Eingang, `{title}` in Texten, Stempel- und Pass-Beschriftungen (Großbuchstaben) |
| `tagline` | Text | ja (`check-pack`) | `''` | Untertitel im Eingang; `{n}` darin wird zur Reisezahl als Wort (siehe 5.1). Auch Wert von `vocab.heroClaim`, falls dort nichts steht |
| `lang` | Text | ja (`check-pack`) | `'de'` | `lang`-Attribut von `<html>` (Template und `app.js`), `og:locale` |
| `eyebrow` | Text | empfohlen | `''` | Zeile über dem Titel im Eingang (Wert von `vocab.heroEyebrow`) |
| `pageTitle` | Text | nein | `title` | `<title>` der Seite und Open-Graph-Titel; Rückfall-Titel, wenn keine Ansicht oder Station offen ist |
| `description` | Text | nein | aus `title`, `eyebrow`, `tagline` zusammengesetzt | `<meta name="description">`, Open Graph, Twitter-Karte |
| `author` | Text | nein | kein Tag | `<meta name="author">` |
| `defaultSkin` | Text | empfohlen | erster eingebundener Skin | Aussehen beim ersten Besuch; muss unter den eingebundenen Skins sein, sonst nimmt der Build den ersten (mit `--default-skin=` erzwungen: Fehler) |
| `vocab` | Objekt | empfohlen | deutsche Standardwerte | überschreibt Wörter und Sätze der Oberfläche (Liste in Abschnitt 6). Werte müssen nichtleerer Text sein |
| `journeyTypes` | Objekt | nein | „Funktionale/Historische Reisen“ | Beschriftung der beiden Reisetypen: Text (nur Mehrzahl) oder `{ pl, sg, sub }` je Typ (`funktional`, `historisch`) |
| `kinds` | Objekt | nein | siehe 3.4 | je Stationsart Text oder `{ label, icon }`; Schlüssel nur aus den sieben Arten |
| `footer` | Text oder Objekt | nein | Datenschutz-Hinweis aus `vocab` | Entweder reiner Text (eine Spalte mit der Überschrift `vocab.footNoteTitle`, „Hinweis“; Leerzeile = neuer Absatz) oder `{ columns: [{ title, paragraphs: [Text], classes: [null \| 'gm-foot-help', …] }] }`. Text ohne HTML, Links als `[Text](https://…)` (erlaubt: `http(s):`, `tel:`, `mailto:`, `#`) |
| `license`, `credits` | Text (`credits` auch Liste) | empfohlen | keine Zeile | je ein Absatz `.gm-foot-legal` in der letzten Fußspalte (nur Texte werden gerendert) |
| `grandTour` | Objekt | nein | automatisch | Steuerung der Großen Rundreise, siehe 5.3 |
| `exhibits` | Liste von IDs | nein | `[]` | IDs der Exponate; `check-plan` verlangt, dass jede ID genau einer Station zugewiesen ist. Bestimmt außerdem die Ladereihenfolge der Dateien in `exhibits/` |
| `stationFiles` | Liste von Dateinamen ohne `.js` | nein (nicht nötig; `new-pack` setzt es nicht) | alphabetisch | Ladereihenfolge der Dateien in `stationen/` (nur wichtig, wenn eine Datei vor einer anderen laden muss; Stationen sind unabhängig voneinander); Dateien, die nicht aufgeführt sind, werden trotzdem eingebunden (hinten) |
| `limits` | `{ min, max, minCrossJourneys, visualShare }` | nein | `min` 11, `max` 28, `minCrossJourneys` abgeleitet, `visualShare` 0,3 | Grenzen für `check-plan`: Stationen je Reise und Mindestzahl anderer Reisen, die jede Reise kreuzt; `visualShare` (0 bis 1): Mindestanteil der Stationen mit Abbildung oder Exponat, den `check-pack` als Warnung prüft |
| `requireVisualPlan` | `true` / `false` | nein | `false` | `true`: jede Station in `plan.json` braucht das Feld `visual` (Fehler, wenn es fehlt). `new-pack` und das Onboarding setzen `true`; Pakete ohne `visual`-Felder melden nur eine Gesamtwarnung „Anschauung nicht geplant“ |

Beispiel (gekürzt, nach `packs/_vorlage/pack.json` und `packs/beispiel-gehirn/pack.json`):

```json
{
  "id": "kaffee",
  "title": "Kaffee-Museum",
  "tagline": "Zwei Reisen durch Anbau, Handwerk und Geschichte des Kaffees",
  "lang": "de",
  "defaultSkin": "halle",
  "vocab": { "journey": "Reise", "journeys": "Reisen", "station": "Station", "stations": "Stationen" },
  "journeyTypes": { "funktional": { "pl": "Funktionale Reisen", "sg": "Funktionale Reise", "sub": "Wege durch Themen" } },
  "exhibits": [],
  "limits": { "min": 11, "max": 28 },
  "footer": { "columns": [ { "title": "Hinweis", "paragraphs": ["Bildung, keine Beratung."] } ] },
  "license": "Inhalte: CC BY 4.0, Code: MIT"
}
```

### 3.2 `plan.json`

Der Stationsplan ist die Wahrheit über Reihenfolge und Kreuzungen. Der Zusammenbau macht daraus nur `data/orders.js` (`MUSEUM.data.orders = plan.orders`) und zählt Stationen für den Bericht;
alles andere dient den Prüfungen und `layout-map.mjs`. Die Engine liest Reise-Metadaten aus `journeys.js`, nicht aus `plan.json`.

```json
{
  "journeys":  [ { "id": "tasse", "typ": "funktional", "name": "Von der Pflanze zur Tasse" } ],
  "stations":  [ { "id": "kaldi-legende", "title": "Kaldi und die tanzenden Ziegen", "kind": "mythos",
                   "journeys": ["tasse", "geschichte"], "why": "Ein Satz: warum die Station hier steht.",
                   "year": 1671, "yearLabel": "1671", "exhibit": "stroop" } ],
  "orders":    { "tasse": ["kaffeepflanze", "kaldi-legende"], "geschichte": ["jemen-sufi", "kaldi-legende"] }
}
```

Regeln (alle von `check-plan.mjs` erzwungen):

- Reise: `id` (Kleinbuchstaben, Ziffern, Bindestriche), `typ` (`funktional` oder `historisch`), `name`; jede Reise hat einen Eintrag in `orders` und umgekehrt.
- Station: `id` (gleiche Regel, keine Umlaute), `title`, `kind` (eine der sieben Arten), `why` (Pflicht), `journeys` (nichtleer; **die erste ist die Heimat-Reise**).
  `journeys` einer Station muss mit den Reisen übereinstimmen, in deren `orders` sie steht (`orders` ist die Wahrheit).
- `year` (Zahl, nicht 0, vor Christus negativ) und `yearLabel` sind Pflicht, sobald die Station auf einer historischen Reise liegt. `exhibit` ist optional.
- `visual` (Anschauungsplan, von `check-pack` geprüft): `{ "kind": "abbildung" | "exponat" | "keine", "idea": "ein Satz: was sieht oder tut man?", "reason": "bei keine: warum nicht" }`. `abbildung` erwartet `visuals/<station-id>.js`, `exponat` das Feld `exhibit` samt `exhibits/<id>.js`. Bei `requireVisualPlan: true` ist die Entscheidung für jede Station Pflicht; Warnungen für zu geringen Anteil (`limits.visualShare`) und für Geplantes, das noch nicht gebaut ist; Zusammenfassung „Anschauung: X geplant, Y gebaut“.
- `orders`: je Reise eine Liste von Stations-IDs ohne Dubletten; Länge zwischen `limits.min` und `limits.max`; historische Reisen strikt chronologisch nach `year`.
- Jedes Exponat aus `pack.json` gehört genau einer Station, und jede Station mit `exhibit` nennt ein Exponat aus `pack.json`.
- Netz: Jede Reise kreuzt mindestens `need` andere Reisen, mit `need = limits.minCrossJourneys`, sonst 4 bei ab 6 Reisen, sonst 1. Der Reise-Graph muss zusammenhängend sein.
- Keine Stationen, die in keiner `orders`-Liste stehen (Waisen).

### 3.3 `journeys.js`

Reise-Daten, Datei-Reihenfolge = Anzeigereihenfolge. Die Datei wird vom Build in einer Sandbox ausgeführt (`vm`), um die Farben zu lesen, und danach unverändert in den Seitenaufbau kopiert.

```js
(function(){'use strict';
window.MUSEUM=window.MUSEUM||{};
MUSEUM.data=MUSEUM.data||{};
MUSEUM.data.journeys=[
{ id:'tasse', typ:'funktional', name:'Von der Pflanze zur Tasse', kurz:'Zur Tasse',
  tagline:'Was passiert, bevor der Kaffee im Becher dampft',
  intro:'2–3 Sätze Einladung.', outro:'1–2 Sätze Ausblick.',
  color:{ light:'#8A4B1F', dark:'#D9A066' },
  icon:'seed' }
];
})();
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | wie in `plan.json`. **`rundreise` ist reserviert** (virtuelle Große Rundreise, `core.js` überschreibt sie) |
| `typ` | ja | `funktional` oder `historisch`. Historische Reisen erscheinen im Zeitstrahl und in der zweiten Kartengruppe; fehlen sie ganz, entfällt der Zeitstrahl-Tab |
| `name`, `kurz` | ja | `name` einmalig im Paket; `kurz` (Warnung ab 24 Zeichen) steht in Chips |
| `tagline` | ja | höchstens 70 Zeichen (Fehler bei mehr) |
| `intro`, `outro` | ja | Einleitung und Ausblick im Reise-Modus |
| `icon` | ja | Schlüssel aus `engine/js/icons.js` |
| `color` | ja | `{ light, dark }`, je `#RRGGBB`. `light` auf hellem Grund (Warnung unter 3:1 gegen `#F6F2EA`), `dark` auf dunklem (3:1 gegen `#0E1420`); gleiche `light`-Werte zweier Reisen warnen. Fehlt oder ist ein Wert ungültig, erzeugt der Build eine Ersatzfarbe aus dem Goldenen Winkel (`hsl((i·137,508) mod 360, 58 %, 40 %)` hell, `…70 %, 66 %` dunkel) |
| `tool` | nein | `true`: „Werkzeug-Reise“, die für alle anderen gilt. Die Karte bekommt die Klasse `is-tool` und die Plakette `vocab.toolBadge`; sonst keine Wirkung |

Die Engine ergänzt zur Laufzeit eine virtuelle Reise `rundreise` (`typ:'rundreise'`, `virtual:true`), siehe 5.3.

### 3.4 Stationen (`stationen/*.js`)

Jede Datei registriert mit `MUSEUM.addStations({ '<id>': { … } })`. `addStations` setzt `id` auf den Schlüssel (und warnt bei Abweichung). Jede Station darf im Paket nur einmal vorkommen.

```js
'kaldi-legende': {
  id: 'kaldi-legende',
  title: 'Kaldi und die tanzenden Ziegen',   // "Haupttitel: Untertitel": der Teil nach ": " wird als Untertitel abgesetzt
  kind: 'mythos',
  journeys: ['tasse', 'geschichte'],
  year: 1671, yearLabel: '1671',
  icon: 'question',
  teaser: '…', text: ['…', '…'], facts: ['…', '…'],
  quote: null,
  myth: { glaube: '…', wahrheit: '…' },
  cross: { geschichte: 'Ein konkreter Satz, warum man hier umsteigt.' },
  exhibit: null,
  blog: [],
  further: ['Autor (Jahr). Titel.']
}
```

| Feld | Pflicht (nach `check-data`) | Laufzeit |
|---|---|---|
| `id` | ja, gleich dem Schlüssel | – |
| `title` | ja | Rückfall: die ID |
| `kind` | ja; gleich dem Plan | `konzept`, `person`, `ereignis`, `methode`, `mythos`, `instrument`, `ort`. Setzt Icon und Beschriftung der Art (Überschreibung über `pack.kinds`); unbekannte Art wird wie `konzept` dargestellt. Das Attribut `data-kind` am `.gm-station` erlaubt Skins, nach Art zu gestalten |
| `journeys` | ja; identisch (inkl. Reihenfolge) mit dem Plan | die erste ist die Heimat-Reise; bestimmt die Akzentfarbe `--jc` |
| `year`, `yearLabel` | ja, wenn der Plan ein Jahr hat | `yearLabel` ist der angezeigte Text; ohne ihn zeigt der Renderer `year` (negativ: „… v. Chr.“) |
| `icon` | ja | Schlüssel aus `icons.js`; Rückfall auf das Icon der Art |
| `teaser` | ja, höchstens 140 Zeichen | Leitsatz unter dem Titel, auf Karten und in der Suche |
| `text` | ja: 2 bis 4 Absätze, zusammen 90 bis 200 Wörter | Fließtext. Beginnt der erste Absatz mit einem Buchstaben, bekommt `.gm-st-body` die Klasse `has-dc` (Initiale) |
| `facts` | ja: 2 bis 4 Einträge, je höchstens 160 Zeichen | „Auf einen Blick“ |
| `quote` | `null` oder `{ text, who, src }` (alle drei) | fehlt das Feld ganz: Warnung |
| `myth` | Pflicht bei `kind:'mythos'`: `{ glaube, wahrheit }` | umdrehbare Karte „Mythos-Check“ |
| `cross` | Pflicht: ein Satz (mindestens 20 Zeichen) für **jede** Reise außer der Heimat-Reise | Text der Umstiegs-Schaltflächen |
| `exhibit` | gleich dem Plan | ID eines Exponats; ohne Datei zeigt die Station „in Vorbereitung“ |
| `blog` | optional: höchstens 3 `{ t, u }` mit https-URL | Verweise; gegen `quellen.txt` geprüft, falls vorhanden |
| `further` | ja: 1 bis 3 Texte | „Lesetipps“ |

Die Engine normalisiert in `MUSEUM.finalize()`: `text`, `facts`, `further`, `blog` werden zu Listen, `cross` zu einem Objekt, und `station.order[reiseId]` bekommt den Index in der Reise.
Fehlende Zuordnungen werden nicht abgebrochen, sondern als `console.warn("[Museum Studio] …")` gemeldet und ergänzt (die Prüfwerkzeuge sind die strenge Instanz).
Schreibregeln und Stil: `docs/INHALT-SCHREIBEN.md`.

### 3.5 `material.js` (optional)

```js
MUSEUM.material = { 'ankereffekt': [ { t: 'Titel des Beitrags', u: 'https://…', thema: 'optional' } ] };
```

Weiterführende Verweise je Station, nur Titel und Link. Der Renderer hängt sie unter der Überschrift `vocab.moreOnline` an die `blog`-Links der Station (Dubletten nach URL werden ausgelassen).
`check-material` verlangt: Station steht im Plan, höchstens 3 Links, `t` und `u` vorhanden, https-URL, keine Dubletten, nicht zusätzlich im `blog`-Feld, nur erlaubte Felder (`t`, `u`, `thema`),
und mit `quellen.txt` nur dort gelistete Links. Mit `--register=<datei>` oder der Umgebungsvariable `WISSENSREGISTER` gelten zusätzlich die strengen Regeln eines externen Wissensregisters.

### 3.6 `layout.js` (erzeugt)

Wird von `node tools/layout-map.mjs <paket>` geschrieben und nicht von Hand geändert:

```js
window.MUSEUM=window.MUSEUM||{};MUSEUM.mapLayout={ SEED:{ 'stations-id':[x,y], … }, BEND:{ 'idA|idB':[x,y] }, cell:48, W:9, H:9 };
```

`SEED`: Position je Station in Rastereinheiten (acht Richtungen). `BEND`: Knickpunkt für Abschnitte, die nicht geradlinig verlaufen; der Schlüssel ist `idA|idB` mit der alphabetisch kleineren ID zuerst.
`cell`: Rasterweite in Pixeln. `W`/`H`: Rastergröße. Ohne `layout.js` (oder ohne `SEED`) rechnet `map.js` zur Laufzeit ein Kräfte-Layout (`forceLayout`), die Linien sind dann weiche Kurven.
`check-pack` warnt, wenn `layout.js` fehlt oder nicht mehr zu `plan.json` passt, und nennt den Befehl zum Neuberechnen.

### 3.7 Exponate und Abbildungen

**Exponat** (`exhibits/<id>.js`, bei Bedarf in `pack.json` unter `exhibits` und im Plan der Station als `exhibit`):

```js
MUSEUM.exhibits.stroop = {
  title: 'Stroop-Test', blurb: 'Kurzbeschreibung für die Tafel',
  mount: function (container, ctx) { /* baut sich in container auf; ctx = { station, journeyId } */ return function destroy() {}; }
};
```

- Der Kern zeigt eine „Tafel“ (`.gm-plaque`) mit Titel, Beschreibung und der Schaltfläche „`{exhibit}` starten“. Erst der Klick ruft `mount`; „beenden“ ruft die zurückgegebene Funktion
  (Rückgabe: Funktion oder Objekt mit `destroy()`). Beim Schließen der Station wird `destroy` ebenfalls aufgerufen (`MUSEUM.ui.destroyStation`).
- Fehler in `mount` werden abgefangen und als Hinweis angezeigt. Fehlt `MUSEUM.exhibits[id]`, steht „in Vorbereitung“.
- Konventionen der Beispiel-Exponate: eigene Styles als `<style data-gx="<id>">` mit Präfix `gx-` (einmal in `<head>`), nur Tokens für Farben (Ausnahme: Reizfarben, die Teil des Versuchs sind),
  Tastaturbedienung, nichts wird gesendet, Eingaben bleiben lokal.
- Die Dateien in `exhibits/` werden alle eingebunden (Reihenfolge: zuerst `pack.exhibits`, dann der Rest). `check-pack` warnt, wenn eine Datei nicht in `pack.json` steht.

**Abbildung** (`visuals/<station-id>.js`; geplant im Plan-Feld `visual`, siehe 3.2):

```js
MUSEUM.visuals['beck'] = { alt: 'Beschreibung für Screenreader', caption: 'Bildunterschrift (optional)',
  mount: function (holder, ctx) { /* ctx = { station } */ return function destroy() {}; } };
```

Der Kern rendert nach dem ersten Absatz einer Station ein `<figure class="gm-st-figure" data-visual="<id>">` mit der Bühne `.gm-fig-stage` (`role="group"`, `aria-label` = `alt`) und ruft `mount` sofort.
Maßgeblich für die Zuordnung ist der Schlüssel `MUSEUM.visuals[<station-id>]`; `check-pack` verlangt zusätzlich, dass der Dateiname eine Stations-ID aus `plan.json` ist (Warnung).
Abbildungen erscheinen nicht in der kompakten Stationsdarstellung (`compact:true`). Farben nur über Tokens, damit sie in jedem Skin und in beiden Modi lesbar bleiben.

**Baukasten `MUSEUM.viz`** (`engine/js/viz.js`, Styles `engine/css/exhibits.css`, Präfix `gx-`). Freiwillig: Registrierung und Mountvertrag bleiben `MUSEUM.visuals[<id>]` bzw. `MUSEUM.exhibits[<id>]`. Der Baukasten lädt vor den Paketdateien und liefert fertige, tastaturbedienbare, token-gefärbte Bausteine,
damit Abbildungen zusammengesteckt statt von Null programmiert werden: `el`/`s`/`svg` (Grundlagen), `slider`, `toggle`, `choice`, `button`, `readout`, `legend`, `scale`/`axis`/`ticks`, `matrix` (n×m-Tabelle mit Hervorhebung und Auswahl),
`plot` (Kurven mit Reglern, Marken, Bändern), `bars` (Balken, vergleichend, animiert), `graph` (Knoten und Kanten), `stepper` (Schrittfolge), `figure`, `animate` (respektiert reduzierte Bewegung), `rng`, `visual`/`exhibit` (Registrierung mit automatischem Aufräumen).
Jeder Baustein ist am Kopf der Datei mit Optionen beschrieben; Muster: `packs/_vorlage/visuals/`. Zeichnungen messen ihre Pixelbreite und rechnen neu (Text bleibt am Handy lesbar). Test: `tools/viz-test.mjs` (alle Bausteine in allen Skins bedienen); `tools/smoke.mjs` hängt außerdem jede Abbildung eines Pakets einmal ein.

---

## 4. Build-Pipeline

```
node tools/build.mjs <paket> [--out=dist/<paket>] [--skins=all|a,b|none] [--default-skin=id]
```

- `<paket>`: Ordnername unter `packs/` oder ein Pfad. Der Zielordner (Standard `dist/<paket>`) **wird vor dem Bauen gelöscht** (`fs.rmSync`).
- `--skins`: `all`, eine kommagetrennte Liste oder `none`. Ohne Angabe wird nur `pack.defaultSkin` eingebunden (falls er unter `themes/` existiert, sonst Warnung und kein Skin).
  Ein Skin zählt, wenn `themes/<id>/theme.css` existiert. Unbekannte Namen in der Liste sind ein Fehler.
- Nur Node-Standardbibliothek (`fs`, `path`, `vm`), keine `npm`-Pakete.

Ablauf und Ergebnis:

1. `pack.json`, `plan.json`, `journeys.js` lesen (Fehler: Abbruch mit Meldung). `journeys.js` läuft in einer `vm`-Sandbox; erwartet wird `MUSEUM.data.journeys` als Liste.
2. Reisefarben bestimmen (Ersatzfarben, siehe 3.3).
3. Ausgabe nach `<out>/`:

| Datei | Inhalt |
|---|---|
| `index.html` | aus `engine/index.template.html`; Platzhalter siehe unten |
| `css/engine.css`, `css/exhibits.css` | unverändert aus `engine/css/` |
| `css/journey-colors.css` | **erzeugt**: `--j-<id>` je Reise (hell in `:root`, dunkel unter `prefers-color-scheme: dark` mit `:root:not([data-theme="light"])`, unter `:root[data-theme="dark"]`, `.gm-hero`, `.gm-dark`, `.gm-header[data-tone="dark"]`), außerdem `--jp-1` … `--jp-12` als Positionsfarben (`--jp-k` = Farbe der Reise `(k-1) mod Anzahl`) |
| `skins/<id>/…` | der ganze Ordner `themes/<id>/` (alle Dateien, außer solchen, deren Name mit `.` beginnt), also auch `theme.json` und `README.md` |
| `js/*.js` | die neun Engine-Dateien |
| `data/pack.js` | `MUSEUM.pack = { …pack.json… }` |
| `data/skins.js` | `MUSEUM.skins = [{ id, name, description, map:{lines,nodes}, mode }]`. `id` ist der Ordnername, `name` Rückfall die ID, `map` mit Normalisierung (`lines` nur `smooth` oder sonst `octilinear`; `nodes` nur `shapes` oder sonst `icons`), `mode` nur `light`/`dark`, sonst `both`. Die Felder `fonts` und `id` aus `theme.json` werden nicht übernommen |
| `data/orders.js` | `MUSEUM.data.orders = { reiseId: [stationsIds] }` aus `plan.orders` |
| `data/journeys.js` | Kopie von `journeys.js` |
| `data/stationen/*.js` | Kopien der Stationsdateien |
| `data/material.js`, `data/layout.js` | Kopien, falls vorhanden |
| `data/exhibits/*.js`, `data/visuals/*.js` | Kopien, falls vorhanden |

**Platzhalter im Template** (jeder andere `{{NAME}}` bricht den Build ab): `LANG`, `HTML_ATTRS` (immer leer), `PAGE_TITLE`, `TITLE`, `DESCRIPTION`, `AUTHOR_META`, `OG_LOCALE`, `FAVICON`,
`SKIN_IDS` (JSON-Liste), `DEFAULT_SKIN` (JSON-Text), `STYLES`, `SCRIPTS`. Das Favicon ist ein eingebettetes SVG-Signet aus den Dunkel-Farben der Reisen 1, 3 und 5 (Index 0, 2, 4, rundum modulo Reisezahl).
Das Template enthält außerdem ein kleines Inline-Skript, das **vor** dem ersten Anstrich `data-theme` (aus `gm:theme`) und `data-skin` (aus `gm:skin`, sonst Standard-Skin, sonst erster Skin) auf `<html>` setzt, damit nichts aufblitzt.

**Reihenfolge der Stylesheets:** `css/engine.css`, `css/exhibits.css`, `css/journey-colors.css`, dann `skins/<id>/theme.css` in der Reihenfolge der eingebundenen Skins.
(Die Ansichten fügen ihre eigenen `<style>`-Blöcke beim Mounten in `<head>` ein; Skin-Regeln gewinnen über die Spezifität von `html[data-skin="…"]`.)

**Reihenfolge der Skripte** (so in `index.html`):

```
data/pack.js → data/skins.js → js/core.js → js/icons.js → data/journeys.js → data/stationen/*.js
→ data/material.js → data/layout.js → data/orders.js → data/exhibits/*.js → data/visuals/*.js
→ js/hero.js → js/map.js → js/journey.js → js/timeline.js → js/passport.js → js/search.js → js/app.js
```

`pack.js` und `skins.js` stehen vor `core.js`, damit `MUSEUM.pack` und `MUSEUM.skins` beim Laden von `core.js` schon vorhanden sind (`core.js` liest `M.pack.kinds` beim Laden). `app.js` startet am Ende bei `DOMContentLoaded`
(sofern nicht `window.MUSEUM_MANUAL_START = true` gesetzt ist; dann ruft die Seite selbst `MUSEUM.app.start()`).

Startreihenfolge in `app.js`: `finalize()` → `skin.init()` → `theme.init()` → Texte einsetzen (`data-t`, `data-pack`, Fuß, Signet) → Theme- und Skin-Knopf → Icons einsetzen (`data-icon`) → Zahlen und Reisekarten → Kopfleiste → Suche → Hero →
`mountViews()` → `nav.start()` → Tastenkürzel → Klasse `gm-ready` auf `<html>` (der Rauchtest wartet darauf).

Die Zeile am Ende des Builds nennt Pakete, Stationen, Reisen, Kreuzungen, Skins (Standard mit `*`) und Dateizahlen.

---

## 5. Laufzeit-API

Alles am Namespace `window.MUSEUM` (hier `MUSEUM`). Die Kopfkommentare von `core.js`, `map.js`, `journey.js`, `timeline.js`, `passport.js`, `search.js`, `hero.js` und `icons.js` sind die Detailreferenz.

### 5.1 Wortschatz: `MUSEUM.t`, `tl`, `tn`, `typeLabel`

- `MUSEUM.t(key, vars?)`: Text zum Schlüssel. Suchreihenfolge: `pack.vocab[key]` → für `heroEyebrow` und `heroClaim` die Felder `pack.eyebrow` und `pack.tagline` → Standardwert aus `VOCAB` in `core.js`.
  Unbekannter Schlüssel: der Schlüssel selbst. Platzhalter `{name}`: zuerst `vars`, dann `{title}` (Museumsname), `{n}` (Anzahl der Reisen als Wort mit großem Anfang: „Drei“, bis 20; ab 21 Ziffern),
  `{nl}` (wie `{n}`, klein), `{count}` (Ziffer), zuletzt jeder andere Wortschatz-Schlüssel (rekursiv, z. B. `{networkMap}`). Unbekannte Platzhalter bleiben stehen.
- `MUSEUM.tl(key, vars?)`: wie `t`, erster Buchstabe klein (Satzmitte).
- `MUSEUM.tn(n, one, many)`: Zahl plus Wort, `MUSEUM.tn(3, 'station', 'stations')` → „3 Stationen“.
- `MUSEUM.typeLabel(typ, form?)`: Name eines Reisetyps; `form` ist `'pl'` (Standard), `'sg'` oder `'sub'`. Quelle: `pack.journeyTypes[typ]` (Text zählt als `pl`),
  sonst „Funktionale/Historische“ + `t('journeys')` bzw. `t('journey')`; `sub`: „Wege durch Themen“ / „Wege durch die Zeit“.
- `MUSEUM.numWord(n)`, `MUSEUM.kinds` (Arten mit `label` und `icon`, aus `KIND` und `pack.kinds`).

HTML-Attribute, die `app.js` beim Start auswertet: `data-t="<schlüssel>"` (Textinhalt), `data-t-aria` (`aria-label`), `data-pack="<feld>"` (Feld aus `pack.json`), `data-typ-label`, `data-count`, `data-count-typ`, `data-icon` mit `data-size`.

### 5.2 Store, Navigation, Router

**`MUSEUM.store`**: `isVisited(id)`, `markVisited(id)`, `visitedCount()`, `progress(reiseId)` → `{done,total}`, `stamps()`, `addStamp(reiseId)`, `get(key, def)`, `set(key, value)` (Präfix `gm:` automatisch),
`reset()`, `onChange(fn)` → Funktion zum Abmelden. Eine Station gilt als besucht, wenn sie wirklich sichtbar ist (Prüfung alle 700 ms, höchstens 40 Versuche; nicht bei `compact`). Ist eine Reise (auch die Große Rundreise) vollständig besucht, wird ihr Stempel vergeben.

**`MUSEUM.nav`**: `start()` (ruft `app.js`), `openStation(id, reiseId?)`, `openJourney(id, startIndex?)`, `openView('karte'|'zeitstrahl'|'reisepass')`, `closeOverlay()`, `current()` → `{ view, journey, station }`, `onChange(fn)`.

**Hash-Routen** (`parseHash` in `core.js`):

| Hash | Wirkung |
|---|---|
| `#/` oder leer | Eingang |
| `#/karte`, `#/reisepass` | Ansicht |
| `#/zeitstrahl` | Ansicht, nur wenn es historische Reisen gibt (sonst Eingang) |
| `#/reise/<reiseId>` | Reise-Modus mit Einführung; `rundreise` ist die virtuelle Große Rundreise |
| `#/reise/<reiseId>/<stationsId>` | Reise-Modus an dieser Station |
| `#/station/<stationsId>` | Stationspanel (Schublade bzw. Bottom-Sheet) |
| alles, was nicht mit `#/` beginnt | wird ignoriert (Anker wie `#so-funktioniert` bleiben normale Sprungmarken) |

Unbekannte Reisen oder Stationen zeigen einen Hinweis und setzen die Adresse zurück. Schließen eines Overlays: war es per Hash-Wechsel geöffnet, geht `history.back()`, sonst wird die Adresse ersetzt.
Die Hash-Wörter (`karte`, `zeitstrahl`, `reisepass`, `reise`, `station`) sind fest im Code (Abschnitt 8).

**Overlays** (`MUSEUM.ui.overlay`): `open(el, { onClose, focus, returnFocus })`, `close(el, { returnFocus, restoreFocus })`, `isOpen()`. Verwaltet `inert` für die übrigen Regionen
(`#kopf`, `#main`, `#fuss`, `#stationspanel`, `#reise`, `#suche-overlay`), Scroll-Sperre (Klasse `gm-lock` auf `<html>`, Variable `--sbw`), Fokus-Rückgabe und Escape.

**Tastenkürzel** (`app.js`): `/` und Strg/Cmd+K öffnen die Suche (außer beim Tippen in Feldern); `g` und dann innerhalb von 1,2 s `k`, `z` oder `p` öffnen Karte, Zeitstrahl, Reisepass.

### 5.3 Daten und Graph

`MUSEUM.finalize()` (wiederholbar) baut aus `MUSEUM.data.journeys`, `MUSEUM.data.stations` und `MUSEUM.data.orders`:

- `MUSEUM.data.journeyById`, `MUSEUM.data.orders` (bereinigt: nur vorhandene Stationen und Reisen, keine Dubletten; Rohdaten in `MUSEUM.data.ordersRaw`), `station.order[reiseId]`
- `MUSEUM.crossings`: Stationen mit mindestens zwei bekannten Reisen
- `MUSEUM.neighbors(id)` → je Reise `{ journey, index, total, prev, next }`
- `MUSEUM.searchIndex`: je Station `{ id, title, teaser, kind, journeys, year, nTitle, nTeaser, nBody, nMeta }` mit normalisierten Texten; `MUSEUM.norm(s)` faltet Groß-/Kleinschreibung, Akzente, `ß`→`ss` und `ae/oe/ue`→`a/o/u`
- `MUSEUM.hasTimeline()`: gibt es eine Reise mit `typ:'historisch'`?
- **Große Rundreise**: eine virtuelle Reise `MUSEUM.data.journeyById.rundreise` (`typ:'rundreise'`, `virtual:true`, `icon:'compass'`, Felder `legs[]`, `onward[]`, `steps[{station, via, next, hint}]`) und
  `MUSEUM.data.orders.rundreise`. Sie entsteht nur bei mindestens zwei Reisen mit Stationen. Verfahren: Tiefensuche über die Reisen (Nachbarn nach Warnsdorff geordnet, Budget 60 000 Schritte; erst vollständig mit gewünschtem Ende, dann vollständig, dann längster Weg),
  danach Strahlsuche (Breite 60) über die Umsteigestationen. `MUSEUM.rundreiseStep(stationsId)` liefert den passenden Schritt. Steuerung über `pack.grandTour`:
  `{ start: <reiseId>, end: [<stationsIds, bevorzugtes Ende>], openEnd: <stationsId der offenen Frage>, tagline, intro, outro, outroOpen }`; Standardtexte kommen aus `vocab` (`tourTagline`, `tourIntro`, `tourOutro`, `tourHint*`).

Farben: `MUSEUM.colorOf(reiseId)` liest die aktuelle CSS-Variable `--j-<id>` (zwischengespeichert, beim Wechsel von Theme oder Skin geleert); Rückfall `var(--j-<id>)`.

### 5.4 Ereignisse

`CustomEvent` auf `document`, Daten in `event.detail`:

| Ereignis | `detail` | Wann |
|---|---|---|
| `gm:station-open` | `{ id, journeyId }` | Station im Panel oder im Reise-Modus geöffnet |
| `gm:journey-open` | `{ id, index }` | Reise-Modus geöffnet |
| `gm:visited` | `{ id }` bzw. `{ id:null, reset:true }` | Station als besucht erfasst; Reset |
| `gm:stamp` | `{ journey }` | neuer Stempel |
| `gm:theme` | `{ mode, effective }` | Darstellung gewechselt (`mode`: `auto`/`light`/`dark`; `effective`: `light`/`dark`) |
| `gm:skin` | `{ id, skin }` | Skin gewechselt (nicht beim ersten Setzen) |

### 5.5 Theme und Skins

- `MUSEUM.theme`: `get()` (`auto|light|dark`), `effective()` (`light|dark`), `set(mode)`, `cycle()` (auto → light → dark → auto), `init()`. Setzt `data-theme` auf `<html>` (bei `auto` wird das Attribut entfernt, es gilt `prefers-color-scheme`) und die `theme-color`-Metas.
- `MUSEUM.skins`: Array aus `data/skins.js`. `MUSEUM.skin`: `list()`, `get()` (ID), `current()` (Eintrag), `set(id)` (merkt die Wahl in `gm:skin`, setzt `data-skin`, feuert `gm:skin`), `init()` (Reihenfolge: gespeicherte Wahl → `pack.defaultSkin` → erster Skin; ohne Skins entfällt `data-skin`),
  `map()` → `{ lines, nodes }` (Rückfall `octilinear`/`icons`).
- Skins mit `mode:'light'` oder `'dark'` erzwingen die Darstellung (`data-theme`), solange sie aktiv sind; `app.js` blendet dann den Darstellungs-Knopf aus (im Code der Skin-Umschaltung; also nur, wenn mindestens zwei Skins eingebunden sind). Die Skin-Umschaltung selbst erscheint nur bei mindestens zwei eingebundenen Skins.

Alles Weitere für Gestalter: `docs/DESIGNER.md`.

### 5.6 Ansichten

`MUSEUM.views.<name> = { mount(el), show(), hide() }` mit den festen Namen `karte`, `zeitstrahl`, `reisepass`
(Liste `VIEWS` in `core.js`; der Zeitstrahl nur, wenn `hasTimeline()`). Der Kern legt für jede Ansicht einen Abschnitt an (`<section class="gm-view" id="ansicht-<name>" data-view="<name>">` mit Kopf aus
`vocab.hall`, `viewXxxTitle`, `viewXxxLead` und dem leeren Block `.gm-view-body`) und ruft `mount(el)` genau einmal mit diesem Block (`mountViews()` beim Start, sonst spätestens beim ersten Zeigen), danach `show()` und `hide()` bei jedem Wechsel.
Die Ansicht setzt keine eigene h1/h2-Hauptüberschrift. Ausnahmen beim Mounten werden abgefangen. Die mitgelieferten Ansichten bieten zusätzlich die optionalen Methoden `focusStation(id)` und `highlightJourney(id|null)` (innere Hilfen, etwa für Sprünge aus der Suche in der Karte); der Kern ruft sie nicht auf, sie gehören **nicht** zum Vertrag, und eigene Ansichten müssen sie nicht bereitstellen.

Weitere Module: `MUSEUM.journey = { open(id, startIndex), close(), goTo(index), currentIndex() }` (Index −1 ist die Einführung, Index = Anzahl die Abschlusskarte mit Stempel; fehlt das Modul, springt ein Ersatz im Kern ein),
`MUSEUM.hero = { start(canvas), stop(), stats() }`, `MUSEUM.search = { open(q?), close(), isOpen(), setQuery(q) }`.

### 5.7 Station rendern, UI-Helfer

- `MUSEUM.ui.renderStation(station, opts)` → `<article class="gm-station">`; `opts`: `journeyId`, `compact`, `headingLevel`, `onChip(jid, st)`, `onTransfer(jid, st)`, `hideTransfer`, `markVisited:false`.
  `MUSEUM.ui.destroyStation(article)` beendet Exponate und Abbildungen.
- `MUSEUM.ui.journeyChip(reiseId, { active, onClick })`, `MUSEUM.ui.icon(key, size, cls)`, `MUSEUM.el(tag, attrs, …kinder)` (DOM-Helfer; `attrs`: `class`, `dataset`, `on`, `html`, `text`, `style`), `MUSEUM.esc(text)`,
  `MUSEUM.announce(text)` (aria-live), `MUSEUM.toast(text)`, `MUSEUM.reducedMotion()`, `MUSEUM.addStations(obj)`.

### 5.8 Exponate und Abbildungen registrieren

Siehe 3.7: `MUSEUM.exhibits[id]` und `MUSEUM.visuals[stationsId]`. Beide Dateien sind klassische Skripte und melden sich selbst an; sie müssen nach `core.js` laufen (der Build garantiert das).

### 5.9 Icons

`MUSEUM.icons.svg(key, { size = 24, cls = '' })` → SVG-String (`viewBox 0 0 24 24`, `stroke="currentColor"`, `stroke-width="1.6"`, runde Enden und Ecken, `aria-hidden`). Unbekannter Schlüssel: ein Kreis als Rückfall.
`MUSEUM.icons.keys` (Liste, derzeit 94), `MUSEUM.icons.has(key)`. Der Kern ergänzt die drei Hilfsicons `check`, `palette`, `external` (nur über `MUSEUM.ui.icon`, 1,8 Strichstärke).

**Icon ergänzen:** In `engine/js/icons.js` im Objekt `D` einen Eintrag hinzufügen. Der Wert ist der Inhalt des SVG **ohne** `<svg>`-Hülle, gezeichnet im 24er-Raster mit Linien (Fläche nur sparsam mit `fill="currentColor"`);
die Hilfen `dot(x, y, r)` und `mirror(inner)` stehen in der Datei bereit. Danach erkennt `check-data` den Schlüssel automatisch (`iconKeys()` führt `icons.js` aus). Icons sind global für alle Pakete und Skins;
es gibt keine Registrierung zur Laufzeit (Vorschlag in Abschnitt 8). Stilregeln: `docs/DESIGNER.md`.

---

## 6. Vokabular-Schlüssel

Alle Schlüssel mit Standardtext aus `VOCAB` in `engine/js/core.js`. Jeder lässt sich in `pack.json` unter `vocab` überschreiben (nichtleerer Text; `{…}`-Platzhalter siehe 5.1).
`heroEyebrow` kommt zusätzlich aus `pack.eyebrow`, `heroClaim` aus `pack.tagline`, wenn `vocab` sie nicht setzt.

**Grundwörter**

| Schlüssel | Standard |
|---|---|
| `journey` / `journeys` | Reise / Reisen |
| `station` / `stations` | Station / Stationen |
| `interchange` / `interchanges` | Kreuzung / Kreuzungen |
| `transfer` | Umsteigen |
| `passport` | Reisepass |
| `grandTour` / `grandTourShort` | Große Rundreise / Rundreise |
| `networkMap` | Netzplan |
| `timeline` | Zeitstrahl |
| `exhibit` / `exhibits` | Exponat / Exponate |
| `museum` | Museum |
| `hall` | Halle |
| `toolBadge` | Werkzeug für alle {journeys} |
| `moreOnline` | Weiterlesen |
| `histKurzSuffix` | (leer); gemeinsame Endung der Kurznamen, die `map.js` in der Karte weglässt (z. B. „-Geschichte“) |

**Ansichten und Rundreise**

| Schlüssel | Standard |
|---|---|
| `viewMapTitle` / `viewMapLead` | Der {networkMap} / Alle {journeys} auf einen Blick. Wo sich Linien berühren, kannst du umsteigen. |
| `viewTimelineTitle` / `viewTimelineLead` | Der {timeline} / Die historischen {journeys} nebeneinander. Such dir ein Jahr, eine Idee oder einen Irrtum aus. |
| `viewPassportTitle` / `viewPassportLead` | Dein {passport} / Stempel, Fortschritt und Vorschläge für die nächste Fahrt. Alles bleibt in deinem Browser. |
| `tourTagline` | Eine Fahrt durch alle {journeys}, von Kreuzung zu Kreuzung |
| `tourIntro` | Statt einer Linie von Anfang bis Ende nimmst du die Abkürzungen: … (Langtext, siehe Quelltext) |
| `tourOutro` | Du hast alle {journeys} berührt. Am Ende bleiben Fragen offen, und jede Reise lässt sich jetzt Station für Station vertiefen. |
| `tourHintStart` | Einstieg: Du beginnst auf der Reise „{name}“. (Variable `name`) |
| `tourHintTransfer` | Kreuzung: Hier steigst du von „{from}“ in „{to}“ um. (Variablen `from`, `to`) |
| `tourHintEnd` | Endstation: Hier lässt dich die Rundreise mit einer offenen Frage zurück. |

**Eingang und Seitengerüst**

| Schlüssel | Standard |
|---|---|
| `skipLink` | Zum Inhalt springen |
| `brandAria` | {title}, zurück zum Eingang |
| `tabMap` | Karte |
| `heroEyebrow` | (leer; `pack.eyebrow`) |
| `heroClaim` | {n} {journeys} – und die Orte, an denen sie sich kreuzen. (`pack.tagline`) |
| `ctaTour` / `ctaMap` / `ctaTimeline` | {grandTour} starten / {networkMap} öffnen / {timeline} |
| `enter` | Eintreten |
| `howEyebrow` / `howTitle` / `howLead` | Orientierung / So funktioniert das {museum} / Stell dir {title} wie ein U-Bahn-Netz vor. … |
| `step1Title` / `step1Text` | 1 · {journey} wählen / {n} Linien führen durch die Themen. … |
| `step2Title` / `step2Text` | 2 · {stations} besuchen / Jede {station} ist ein kleiner Raum: … |
| `step3Title` / `step3Text` | 3 · An {interchanges} umsteigen / Liegt eine {station} auf mehreren Linien, … |
| `statsLabel` | Das {museum} in Zahlen |
| `tripsEyebrow` / `tripsTitle` | Reiseführer / {n} {journeys} zur Auswahl |
| `hallLabel` | Halle: {networkMap}, {timeline} und {passport} |
| `footNoteTitle` | Hinweis (Überschrift der Fußspalte, wenn `pack.footer` ein reiner Text ist) |
| `footPrivacyTitle` / `footPrivacyText` / `footIcons` | Standard-Fußspalte (Datenschutz-Hinweis, Icons selbst gezeichnet); entfällt, sobald `pack.footer` gesetzt ist (Text oder `columns`; `footIcons` gehört zur Standardspalte) |
| `newTab` | ` (öffnet in neuem Tab)` (nur Links im Fußtext; Links in Stationen tragen den Hinweis fest im Code) |
| `skinLabel` / `skinHint` | Aussehen / Aussehen der Seite wählen |

Die vollständigen Langtexte der Schlüssel `tourIntro`, `howLead`, `step*Text` und `footPrivacyText` stehen in `engine/js/core.js` (Objekt `VOCAB`); sie sind hier gekürzt, damit die Tabelle lesbar bleibt.

---

## 7. Prüfwerkzeuge

Alle Befehle: `node tools/<name>.mjs <paket>`; `<paket>` ist der Ordnername unter `packs/` (mit Pfadtrenner: ein Pfad). Exit-Code 1 bei Fehlern, Warnungen allein sind kein Fehler. Nur Node ≥ 18, keine Pakete.

| Befehl | Prüft |
|---|---|
| `check-plan.mjs <paket>` | `plan.json`: Struktur, ID-Format, doppelte IDs, `kind`, `why`, `journeys`; Reisen gegen `orders`; Stationszahl je Reise gegen `limits`; Waisen; Übereinstimmung `journeys` ↔ `orders`; `year` und `yearLabel` bei historischen Reisen; chronologische Reihenfolge; Exponate (in `pack.json`, genau einer Station, keine verwaisten); Kreuzungs-Mindestzahl und Zusammenhang des Reise-Graphen |
| `check-data.mjs <paket> [datei …]` | `stationen/*.js` gegen `plan.json`: Ladefehler, Dubletten, `TODO`-Platzhalter, `journeys`/`kind`/`year` wie im Plan, `exhibit` zwischen Plan, Station und `pack.json` (mit Hinweis, wo zu ergänzen ist), Icon-Schlüssel, `teaser` (Länge), Absatzzahl, **Wortzahl 90–200** (Fehler außerhalb, mit Wörtern je Absatz), `facts` (Eintrag und Länge je Fakt), `quote`, `myth` bei Mythen, `cross` je Nebenreise (≥ 20 Zeichen), `blog` (https, höchstens 3, gegen `quellen.txt`), `further`; Warnungen für gerade Anführungszeichen und doppelte Leerzeichen |
| `check-material.mjs <paket> [--register=datei]` | `material.js` (optional): Station im Plan, höchstens 3 Links, https-URLs, Dubletten, nicht im `blog`-Feld, `quellen.txt`; mit Register zusätzlich Titel, Rechte, Stand, Typ |
| `check-pack.mjs <paket>` | **alles**: `pack.json` (Pflichtfelder, `id` = Ordnername, `lang`, `footer`-Form, `stationFiles` gegen vorhandene Dateien, `vocab`, `journeyTypes`, `exhibits`, `limits`, `kinds`, `grandTour` gegen den Plan, `TODO`), ruft `check-plan`, `check-data`, `check-material` auf, prüft `journeys.js` (Felder, Typen, Tagline-Länge, Icon, `color`, Kontrast der Reisefarben gegen `#F6F2EA`/`#0E1420` mit Schwelle 3:1, doppelte Farben, Abgleich mit dem Plan), Exponat- und Abbildungsdateien (Syntax, Registrierung), den Anschauungsplan (`visual` je Station, `limits.visualShare`, geplant gegen gebaut, Hinweise auf Zahlenlast ohne Abbildung), `layout.js` (vorhanden, `SEED`, aktuell) |
| `check-skin.mjs <skin>` / `--all` | `themes/<id>/`: `theme.json` gültig (`id` = Ordnername, `mode`, `map`, `fonts` als Liste), `theme.css` mit `html[data-skin="<id>"]` vor **jedem** Selektor, keine `@import`, keine externen URLs, Warnung bei festen Reise-IDs (`var(--j-<id>)`) |
| `viz-test.mjs [paket]` | Browser-Test des Baukastens `MUSEUM.viz`: baut das Paket in einen temporären Ordner, hängt alle Bausteine ein, bedient sie (Klick, Tasten), meldet Konsolenfehler, Überbreite und fehlende Reaktion; je Skin hell/Desktop, dunkel/Handy und einmal mit reduzierter Bewegung (braucht Playwright, gemeinsame Suche in `tools/pw-lib.mjs`) |
| `smoke.mjs <paket> [--skins=a,b\|all] [--quick] [--shots=ordner] [--viewports=desktop,tablet,phone] [--themes=light,dark] [--dist=ordner]` | Browser-Rauchtest, siehe unten |
| `list-icons.mjs [suchwort]` | listet die Icon-Schlüssel aus `engine/js/icons.js` nach Gruppen (gültige Werte für `icon`) |

**`smoke.mjs`** öffnet `dist/<paket>/index.html` per `file://` mit Playwright (das Paket muss vorher gebaut sein). Es gibt keine festen Pfade:
Playwright wird in `$PLAYWRIGHT_MODULE_DIR`, im Repository, in `$NODE_PATH` und im globalen npm-Ordner gesucht; das Chromium ist `$CHROMIUM_PATH` oder der von Playwright installierte Browser. Fehlt etwas, nennt das Skript den Installationsbefehl
(`mkdir -p ~/pw && cd ~/pw && npm init -y && npm i playwright && npx playwright install chromium`, dann `PLAYWRIGHT_MODULE_DIR=~/pw node tools/smoke.mjs <paket>`).
Besucht: Eingang, Karte in allen drei Modi (Reisen, Gesamtnetz, Liste), Zeitstrahl (falls vorhanden), Reise (Einführung und Station), Station im Panel, Große Rundreise, Reisepass, Suche, Skin-Umschaltung, und **jedes Exponat**
(Station öffnen, Exponat starten = `mount`, kurz laufen lassen, beenden = `destroy`; in Desktop/hell). Je Skin, je Viewport (Desktop 1280, Tablet 820, Handy 390), hell und dunkel.
Gemeldet werden Konsolenfehler, Warnungen mit `[Museum Studio]` (auch Fehler in `mount`, die der Kern abfängt), Seitenfehler, fehlgeschlagene Anfragen, horizontales Scrollen, falsch gesetzter Skin, fehlende oder überzählige Skin-Umschaltung, Suche ohne Treffer,
ein Exponat, das nichts zeichnet oder dessen Start fehlschlägt. Screenshots landen standardmäßig in `dist/<paket>/_shots/` (ein Neubau löscht den Ordner; `--shots=<ordner>` ändert das). `--quick` prüft nur Desktop und hell.

Der Rauchtest prüft **keinen Kontrast, keine Tastaturbedienung und kein Aussehen**; dafür sind die Screenshots und eine Sichtprüfung da (Checkliste in `docs/DESIGNER.md`).

Weitere Werkzeuge:

- `node tools/new-pack.mjs <id> --title="…" [--journeys=3] [--historical=0]` legt `packs/<id>/` an (`pack.json`, `plan.json`, `journeys.js`, `ARBEITSSTAND.md`, Stationsrümpfe in `stationen/<reise-id>.js` nach Heimat-Reise; zwei bis acht Reisen mit je 11 Stationen und Kreuzungen zwischen Nachbarreisen; die letzten `--historical` Reisen (0 bis 3) sind historisch, mit Platzhalter-Jahren). Jede auszufüllende Stelle beginnt mit `TODO` (z. B. „TODO: ersetze diesen Absatz …“), `check-pack` meldet sie als Fehler. Nicht gebrauchte Rümpfe löscht man in `plan.json` und in den Stationsdateien.
- `node tools/derive-pack.mjs <quelle> <ziel-id> --journeys=a,b,c [--title="…"] [--force]` leitet ein kleineres Paket ab (nur gewählte Reisen und ihre Stationen, ohne Material und `blog`-Verweise, neues Layout, anschließend `check-pack`).
- `node tools/layout-map.mjs <paket> [--multi=N] [--iters=N] [--seed=N] [--no-write] [--svg=datei] [--out=datei] [--apply=datei] [--js]` berechnet `layout.js` (Stress-Layout als Start, dann Annealing auf dem Raster; deterministisch).
  Der schnelle Kern `tools/layout-sa.c` wird bei Bedarf mit `gcc` gebaut, sonst läuft eine JavaScript-Variante (`--js` erzwingt sie).

---

## 8. Was noch fest im Code steht

Die Engine hat keine Fachbezüge mehr, aber sie ist noch nicht mehrsprachig. Ehrliche Liste des Rests:

1. **Übrige deutsche Oberflächensätze.** Nur ein Teil der Texte läuft über `MUSEUM.t` (die Schlüssel in Abschnitt 6). Fest im Code stehen zum Beispiel:
   - `core.js`: Beschriftungen der Mythen-Karte („Mythos-Check“, „Damals geglaubt“, „Weit verbreitet geglaubt“, „Heute wissen wir“, „Irrtum?“, „Karte umdrehen“), „Auf einen Blick“, „Lesetipps“, „Besucht“,
     „Zurück“/„Weiter“/„Einführung“, „… von …“ in Positionsangaben, Fehler- und Hinweissätze, die Arten-Beschriftungen als Rückfall.
   - `app.js`: Beschriftungen des Darstellungs-Knopfs („automatisch (nach System)“, „hell“, „dunkel“), Fortschrittstexte der Reisekarten („Noch nicht besucht“, „… von … besucht“, „Alle … besucht“, „antreten“).
   - `index.template.html`: `aria-label`s („Ansichten“, „Suche öffnen“, „Darstellung wechseln“), „Suche“, der `noscript`-Hinweis.
   - `map.js` („Gesamtnetz“, „Als Liste“, Legende, Hinweise), `journey.js` („Etappe … von …“, „Nächster Halt“, „Endstation“, „Noch einmal von vorn“), `timeline.js` („Springe zu“, Hinweis zur Zeitachse),
     `passport.js` („NOCH OFFEN“, Pass-Beschriftungen), `search.js` („Nach Art filtern“, Treffertexte).
2. **Epochen und Zeitachse.** `timeline.js` enthält die sieben Epochen (Antike … Gegenwart) mit Namen und Spannen und eine stückweise Skala (`FULL_SEGS`, absolut −1700 bis 2027), deutsche Jahreszusätze („v. Chr.“ auch in `core.js`).
   **Die Achse passt sich dem Paket an:** `setupAxis` nimmt die Jahre aller Stationen der historischen Reisen (samt Zeitspannen in `yearLabel`), legt einen Puffer von etwa 6 % (mindestens 12 Jahre, auf Zehner gerundet) davor und dahinter, schneidet die Skala auf diesen Bereich zu (schmale Zeiträume werden auf eine Mindestbreite gedehnt) und zeigt Epochen am Rand nur, wenn Stationen darin liegen; Sprungmarken und Bänder folgen daraus.
   Umfasst ein Paket (fast) die ganze Spanne (wie das Gehirnmuseum, −1600 bis 2023), bleibt die Standardachse unverändert. Grenzen: Epochen und Skala sind weiter Ideengeschichte der Neuzeit (Epochennamen und Dichte sind fest); Jahre außerhalb von −1700 bis 2027 (Kosmologie) gehen nicht. Eigene Epochen und Segmente je Paket stehen als Entwurf in Abschnitt „Mehrsprachigkeit“, Punkt 4.
3. **Stationsarten.** Die sieben Arten (`konzept`, `person`, `ereignis`, `methode`, `mythos`, `instrument`, `ort`) sind in `core.js` (`KIND`) und `tools/check-lib.mjs` (`KINDS`) fest. Beschriftung und Icon lassen sich über `pack.kinds` ändern, neue Arten nicht.
4. **Reisetypen.** `funktional` und `historisch` sind fest: im Template (zwei Kartengruppen), in `app.js`, `map.js`, `passport.js`, `timeline.js`, `journey.js`, `check-plan.mjs`, `check-pack.mjs`. Nur die Beschriftung ist über `journeyTypes` änderbar.
5. **Hash-Routen.** `karte`, `zeitstrahl`, `reisepass`, `reise`, `station` sind deutsche Wörter im Code (`parseHash`, `VIEWS`, `data-view`). Gespeicherte Lesezeichen hängen daran.
6. **Genus und Grammatik.** Viele Sätze setzen Wortschatz-Wörter in feste Satzbausteine ein, mit festen Artikeln: „Diese `{station}` ist noch nicht eingerichtet“, „Nächste `{station}`“, „auf dieser `{journey}`“, „eine `{interchange}`“,
   „der `{grandTour}`“. Ändert ein Paket das Wort in ein anderes Genus oder Numerus (z. B. Station → „Halt“, männlich), stimmt der Artikel nicht mehr. Plural- und Kasusformen gibt es nicht (nur `…`/`…s` als getrennte Schlüssel). `numWord` liefert nur deutsche Zahlwörter.
7. **Suche.** `MUSEUM.norm` ist auf Deutsch zugeschnitten (`ß`, `ae/oe/ue`).
8. **Hero.** `hero.js` zeichnet ein festes „Museum bei Nacht“ (Neuronen). Die Skins `kabinett`, `ma` und `quelltext` enthalten keine Reise-IDs mehr: Der Reisestreifen am Fuß des Eingangs (`.gm-hero::after`) nutzt die Variablen `--hero-bar` / `--hero-bar-hard`, die `app.js` (`renderEmblem`) aus den tatsächlichen Reisen setzt (siehe `docs/DESIGNER.md`). `tools/check-skin.mjs` meldet feste Reise-IDs in Skins.
9. **Feste Farben.** `THEME_BG` in `core.js` und die `theme-color`-Metas im Template (`#F6F2EA`, `#0E1420`), Hero-Textfarben und Glas-Schaltflächen in `engine.css` (feste helle Werte, weil der Eingang als dunkel gedacht ist).
10. **Rauchtest-Umgebung.** `tools/smoke.mjs` braucht Playwright mit Chromium; Pfade sind über Umgebungsvariablen einstellbar (Abschnitt 7).

### Entwurfsvorschlag: Mehrsprachigkeit (nicht umgesetzt)

Ziel: eine zweite Sprache soll nur Daten brauchen, keinen Engine-Code.

1. **Texte inventarisieren und auslagern.** Jede feste Zeichenkette bekommt einen Schlüssel in einer Tabelle `MUSEUM.strings` (Datei `engine/i18n/de.js`, vom Build vor `core.js` eingebunden); `MUSEUM.t` löst dann in der Reihenfolge `pack.vocab` → `MUSEUM.strings` der Paketsprache → Deutsch auf.
   Die Schlüssel von Abschnitt 6 bleiben unverändert. Umbau Datei für Datei; ein kleines Skript, das Zeichenketten mit Umlauten in `M.el(...)`-Aufrufen findet, liefert die Arbeitsliste.
2. **Ganze Sätze statt Bausteine.** Aus „`'Diese ' + t('station') + ' ist noch nicht eingerichtet.'`“ wird der Schlüssel `stationMissing: 'Diese {station} ist noch nicht eingerichtet.'`. Pakete in anderen Sprachen oder mit anderem Genus überschreiben den ganzen Satz in `vocab`.
   Zusätzlich optional `vocab.<wort>$gender` für Systeme, die den Artikel selbst bilden. Plural: Schlüssel `stations` bleibt ein getrenntes Wort; für Sprachen mit mehreren Pluralformen eine Form `{n, plural, one{…} other{…}}` über `Intl.PluralRules(pack.lang)`.
3. **Zahlen, Daten, Jahre.** `numWord` und Jahresformate (`v. Chr.`) über `Intl` bzw. Tabellen je Sprache; `norm()` je Sprache (`pack.lang`) mit eigener Faltungsliste.
4. **Epochen und Zeitachse als Paketdaten.** `pack.timeline = { min, max, epochs: [{ id, name, short, from, to, range }], segments: [{ from, to, d }] }`, mit den heutigen Werten als Standard.
5. **Routen mit Aliasen.** Die Hash-Wörter bleiben die Kanonform; `pack.routes` kann lesbare Aliase ergänzen (`#/map` → `#/karte`), damit Lesezeichen gültig bleiben.
6. **Template.** `aria-label`s und `noscript` über `data-t-aria` und Platzhalter im Build (`{{T:schluessel}}`), damit auch das Gerüst die Sprache kennt.
7. **Prüfung.** `check-pack` meldet fehlende Schlüssel einer Sprachtabelle gegenüber Deutsch.

---

## 9. Erweiterungspunkte

**Neuer Skin.** Ein Ordner `themes/<id>/` mit `theme.css`, `theme.json` und `README.md`; der Build erkennt ihn automatisch (`--skins=<id>`). Keine Engine-Änderung. Vollständige Anleitung: `docs/DESIGNER.md`.

**Neuer Netzplan-Zeichner.** Die Karte ist eine Ansicht mit dem Vertrag aus 5.6 (`MUSEUM.views.karte = { mount, show, hide }`). Ein anderer Zeichner liest `MUSEUM.data` (Reisen, Stationen, `orders`), `MUSEUM.crossings`, optional `MUSEUM.mapLayout` und `MUSEUM.skin.map()`,
zeichnet in den übergebenen Block und öffnet Stationen über `MUSEUM.nav.openStation(id, reiseId)`; Besuchsstand über `MUSEUM.store`, Farben über `var(--j-<id>)`, Styles mit eigenem Präfix und nur Tokens. Heute ersetzt man dafür die Datei `engine/js/map.js`,
weil der Build nur die feste Liste `ENGINE_JS` kopiert und `map.js` seine Ansicht beim Laden anmeldet (spätere Registrierungen überschreiben frühere). Sauberer wäre eine Paket- oder Skin-Option `scripts: [...]`, die der Build nach den Engine-Skripten einfügt (Vorschlag).

**Neue Reisetypen.** Heute nicht über Daten möglich (Abschnitt 8, Punkt 4). Der Umbau berührt: das Template (Kartengruppen `#reisen-<typ>`), `app.js` (`hydrateText`, `renderWords`, `renderCards`), `map.js` und `passport.js` (Gruppen, Legende),
`journey.js` (Bezeichnung), `core.js` (`typeLabel`, `hasTimeline`), die Prüfungen `check-plan.mjs` und `check-pack.mjs`. Vorschlag: eine Typ-Tabelle in `pack.json` (`journeyTypes[typ] = { pl, sg, sub, timeline: bool }`), aus der Template-Gruppen, Legende und die Prüfung abgeleitet werden.

**Neue Stationsarten.** Heute nicht möglich (Punkt 3); Vorschlag: `pack.kinds` darf neue Schlüssel mit `{ label, icon }` anlegen, `KINDS` in `check-lib.mjs` wird dann aus `pack.json` gelesen.

**Neues Icon.** Abschnitt 5.9.

**Neue Ansicht.** `VIEWS` in `core.js` ist fest (drei Ansichten) und braucht passende Tabs im Template; keine Registrierung zur Laufzeit.

---

## 9b. Spielplan (optional)

Ein Paket mit `packs/<id>/spielplan.json` bekommt die Mechanik für Freischalten, Rhythmus und Fortschritt; ohne die Datei ändert sich nichts (alles Neue hängt an `MUSEUM.data.spielplan`). Bedienung: `docs/SPIELPLAN.md`; Entscheidungen: `docs/spielplan-auslegung.md`.

- **Dateien:** `engine/js/spielplan.js` (reine Regelrechnung und Brücke mit lokalem Speicher, Präfix `gm:sp:`), `engine/js/spiel.js` (Anbindung ans Museum, `window.MUSEUM.spiel`), `engine/css/spiel.css`, `engine/js/spielplan-adapter.js` (xAPI und SCORM, vom Museum nie geladen).
  Werkzeuge: `tools/spielplan-aus-plan.mjs` (Generator), `tools/check-spielplan.mjs`, `tools/spielplan-test.mjs`, `tools/yaml-lite.mjs`.
- **Datenfluss:** Oberfläche (Station geöffnet, Karte, Exponat, Reisepass-Stempel) löst Ereignisse mit Einheiten-IDs aus (`inhalt/<id>`, `episode/<id>`, …) -> `MUSEUM.spiel.melde` -> Regelrechnung -> `zugang()`, `naechsteAufgabe()` und die Rückmeldung am Ort. Nur Kennungen, nie Eingaben; nichts wird gesendet.
- **API:** `MUSEUM.spiel` mit `aktiv`, `stand()`, `melde(verb, objekt, opts)`, `bei(...)`, `zugang(einheitId)`, `naechsteAufgabe()`, `frei`, `setFrei(b)`; Kopfkommentar in `engine/js/spiel.js`.
- **Build:** nur mit `spielplan.json` werden `data/spielplan.js`, `js/spielplan.js`, `js/spiel.js` und `css/spiel.css` eingebunden; sonst ist die Ausgabe unverändert.

## 10. Entwurfsentscheidungen

- **Warum klassische Skripte statt ES-Module?** Die Seite soll per Doppelklick laufen. Browser laden Module unter `file://` nicht (CORS-Sperre für `file://`-Ursprünge), `fetch()` ebenso nicht. Darum sind alle Dateien klassische Skripte,
  Daten stehen als Skriptdateien vor den Modulen, und die Reihenfolge der `<script>`-Tags (Abschnitt 4) ist der Ersatz für `import`. Der Preis: ein globaler Namespace und eine feste Ladereihenfolge, die der Build verwaltet.
- **Warum gibt es einen Build, aber keinen für Besucher?** Der Node-Schritt arbeitet nur für Autorinnen und Autoren: er kombiniert eine Engine mit beliebig vielen Paketen und Skins, erzeugt die Reisefarben, die Reihenfolgen und die Skin-Liste und setzt das Template zusammen.
  Das Ergebnis ist gewöhnliches HTML, CSS und JavaScript; Besucher brauchen weder Node noch einen Server noch ein Netz, und es gibt keine Abhängigkeiten, die veralten oder nachgeladen werden. Eine Laufzeit-Lösung ohne Build (Pakete per `fetch()` laden) wäre unter `file://` nicht möglich.
- **Warum wird das Netzplan-Layout vorab berechnet?** Ein ordentlicher Linienplan (acht Richtungen, wenige Kreuzungen und Knicke) entsteht durch eine lange Optimierung (Annealing), die Sekunden bis Minuten dauert und mit einem Kern in C schneller läuft.
  Das gehört nicht in den Browser des Besuchers: Das Ergebnis wäre bei jedem Aufruf zu langsam und, auf schwachen Geräten, schlechter. Vorab berechnet ist es deterministisch (geseedet), reproduzierbar, im Paket versioniert (`layout.js`)
  und kostet beim Besuch nichts. Der Laufzeit-Rückfall (`forceLayout` in `map.js`) bleibt für Pakete ohne `layout.js`, ist aber sichtbar schlechter; `check-pack` weist darauf hin.
- **Warum Skins als reines CSS hinter `html[data-skin="<id>"]`?** Alle gewählten Skins sind eingebunden und lassen sich ohne Neuladen umschalten; das Präfix gibt die nötige Spezifität gegenüber `engine.css` und den injizierten Ansichts-Styles und isoliert Skins voneinander.
  Skins brauchen kein JavaScript. Die einzigen Skin-Daten, die die Engine liest, stehen in `theme.json` (`map`, `mode`).
- **Warum kommen Reisefarben aus dem Paket?** Die Engine darf keine Reise-IDs kennen. Der Build übersetzt `journeys.js` in CSS-Variablen; Ansichten und Skins lesen nur `var(--j-<id>)` bzw. die Positionsfarben `--jp-<n>`.
- **Warum ein Wortschatz statt fester Wörter?** Dasselbe Gerüst trägt Gebiete, in denen „Reise“ und „Station“ falsch klingen („Pfad“, „Halt“). `M.t` mit Platzhaltern lässt Pakete die Wörter tauschen, ohne Code zu ändern. Die Grenzen (Genus, Rest-Sätze) stehen offen in Abschnitt 8.
- **Warum Store im `localStorage` mit RAM-Rückfall?** Besuchsstand und Stempel sind ein Komfort, keine Pflicht: Die Seite muss in privaten Fenstern und bei gesperrtem Speicher funktionieren. Darum jeder Zugriff in `try/catch`, Schlüsselpräfix `gm:` und ein Spiegel im Arbeitsspeicher.
- **Warum Stylesheets in den Ansichts-Modulen?** Jede Ansicht ist eine abgeschlossene Datei, die ihre Styles einmal in `<head>` einfügt (Präfixe `gm-karte-`, `gm-reise-`, `gm-zeit-`, `gm-pass-`, `gm-suche-`); das hält Module unabhängig und isoliert testbar,
  bedeutet aber, dass Skins diese Teile nur über Tokens und gezielte Selektoren erreichen (Abschnitt „Wunschliste“ in `docs/DESIGNER.md`).
