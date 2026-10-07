# Museum Studio – Anleitung für Gestalter

Für alle, die ein neues Aussehen („Skin“) entwerfen. Du brauchst CSS und einen Texteditor, kein JavaScript und keinen Eingriff in die Engine.
Alle Aussagen stützen sich auf den Code: `engine/css/engine.css`, `engine/js/*.js`, `tools/build.mjs` und die vier mitgelieferten Skins unter `themes/`.
Das Gerüst, Datenformate und Laufzeit-API stehen in `docs/ARCHITEKTUR.md`.

Inhalt

1. Was ein Skin ist
2. Dateien eines Skins (`theme.css`, `theme.json`, `README.md`)
3. Neuen Skin anlegen, Schritt für Schritt
4. Die Token-Tabelle
5. Komponenten-Klassen, auf die Skins zugreifen
6. Besonderheiten (dunkle Flächen, Reisefarben, Karten-Optionen, Modus)
7. Gestaltungsprinzipien
8. Prüfablauf und Screenshot-Checkliste
9. Die mitgelieferten Skins
10. Icons und Illustrationen
11. Wunschliste und Grenzen
12. Ideen für weitere Skins

---

## 1. Was ein Skin ist

Ein Skin ist ein Ordner `themes/<id>/` mit einer CSS-Datei. Er verändert das Aussehen des gesamten Museums, den Inhalt nie: Dieselben Reisen, Stationen und Exponate erscheinen im Look von Herbarium, Bauhaus-Plakat oder Terminalfenster.
Der Zusammenbau (`node tools/build.mjs <paket> --skins=…`) bindet Skins ein; die Seite setzt `data-skin="<id>"` auf `<html>` und merkt sich die Wahl der Besucher im Browser (`gm:skin`).
Sind zwei oder mehr Skins eingebunden, erscheint in der Kopfleiste ein Umschalter „Aussehen“. Jeder Skin muss hell **und** dunkel funktionieren (außer `mode` legt etwas anderes fest).

**Ein guter Skin ist keine Farbpalette, sondern ein Standpunkt.** Er entscheidet über Schrift, Rundungen, Linienarten, Dichte, Ornament und die Anmutung des Netzplans. Ein Skin, der nur Farben tauscht, ist ein Farbschema; dafür genügen die Tokens (Abschnitt 4).
Die vier mitgelieferten Skins (Abschnitt 9) zeigen die Spannweite: Referenz „halle“ ohne Eingriffe, „kabinett“ organisch, „ma“ streng flächig, „quelltext“ als Terminal.

## 2. Dateien eines Skins

```
themes/<id>/
├─ theme.css      Pflicht. Alle Regeln hinter html[data-skin="<id>"]
├─ theme.json     empfohlen. Name, Beschreibung, Kartenoptionen, Modus
└─ README.md      empfohlen. Idee, verwendete Tokens, bekannte Grenzen
```

Der Build kopiert den **ganzen Ordner** nach `dist/<paket>/skins/<id>/` (Dateien, deren Name mit `.` beginnt, nicht). Ein Skin gilt als vorhanden, sobald `theme.css` existiert.
Zusätzliche Dateien (z. B. ein SVG-Muster) liegen im selben Ordner und werden in `theme.css` mit relativer `url(...)` angesprochen; bisher nutzt das keiner der mitgelieferten Skins.
Von außen laden darf ein Skin nichts (keine Google Fonts, keine CDN-Bilder).

### `theme.css`

Pflichtregel: **jede Regel beginnt mit `html[data-skin="<id>"]`.** Das gibt die nötige Spezifität gegenüber `engine.css` und den Ansichts-Styles, und es isoliert Skins voneinander (alle eingebundenen Skins liegen gleichzeitig in der Seite).
Aufbau, wie ihn die Skins `kabinett`, `ma` und `quelltext` verwenden:

1. Tokens, die nicht vom Modus abhängen (Schriften, Rundungen, Schatten, `--grain`, `--j-rundreise`).
2. Tokens hell.
3. Tokens für `.gm-dark` (immer dunkle Flächen).
4. Tokens dunkel bei Systemeinstellung (`@media (prefers-color-scheme: dark)` mit `:not([data-theme="light"])`).
5. Tokens dunkel bei Umschalter (`[data-theme="dark"]`).
6. Strukturelles CSS: Grundlagen, Buttons, Kopf, Eingang, Karten, Station, Fuß, Feinschliff der Ansichten, `prefers-reduced-motion`.

### `theme.json`

```json
{
  "id": "kabinett",
  "name": "Kabinett",
  "description": "Herbarium und Naturforscher-Kabinett: Papier, Tinte, Antiqua, Initialen, Etikett-Kästen und feine Doppellinien.",
  "fonts": ["IM Fell English", "Iowan Old Style", "Palatino Linotype", "Georgia"],
  "map": { "lines": "smooth", "nodes": "icons" },
  "mode": "both"
}
```

| Feld | Wirkung |
|---|---|
| `id` | Muss dem Ordnernamen entsprechen. Maßgeblich ist der Ordnername (der Build nimmt ihn als ID und warnt bei Abweichung; `tools/check-skin.mjs` meldet einen Fehler) |
| `name` | Anzeigename im Umschalter und in der Ansage „Aussehen: …“. Fehlt er, steht dort die ID |
| `description` | Zweite Zeile des Eintrags im Umschalter (`.gm-skin-desc`) |
| `fonts` | Nur Information für Menschen (Wunschschrift zuerst, dann die Rückfälle). Weder Build noch Engine werten es aus, der Build übernimmt es nicht in `data/skins.js`; `check-skin` prüft nur, dass es eine Liste von Texten ist. Die Schriften selbst stehen in `--font-*` in `theme.css` |
| `map.lines` | `"octilinear"` (Standard) oder `"smooth"`: Form der Linien im Netzplan (Abschnitt 6.3). Jeder andere Wert gilt als `octilinear` |
| `map.nodes` | `"icons"` (Standard) oder `"shapes"`: Haltepunkte als Reise-Icons bzw. geometrische Formen (Abschnitt 6.3). Jeder andere Wert gilt als `icons` |
| `mode` | `"both"` (Standard): hell und dunkel, Besucher dürfen wechseln. `"light"` oder `"dark"`: der Skin erzwingt diese Darstellung (`data-theme`), solange er aktiv ist, und der Darstellungs-Knopf wird ausgeblendet (sobald die Skin-Umschaltung eingebunden ist, also bei mindestens zwei Skins). Jeder andere Wert gilt als `both` |

`node tools/check-skin.mjs <skin>` (oder `--all`) prüft die Form: `theme.json` gültig (id = Ordnername, mode, map), jeder Selektor in `theme.css` beginnt mit `html[data-skin="<id>"]`, keine `@import`, keine externen URLs, keine festen Reise-IDs (Warnung). Es prüft **nicht** Kontrast oder Aussehen; dafür bleibt die Sichtprüfung (Abschnitt 8).

### `README.md`

Eine kurze Beschreibung für die, die den Skin später pflegen: Idee in einem Satz, welche Tokens er setzt, was er bewusst nicht tut, bekannte Grenzen (z. B. „Schrift X ist nicht eingebettet“). Vorbilder: `themes/*/README.md`.

---

## 3. Neuen Skin anlegen, Schritt für Schritt

1. **Verzeichnis kopieren.** Am einfachsten von `themes/ma/` oder `themes/kabinett/` (vollständige Token-Blöcke). Für einen Start ohne Altlasten: `themes/halle/` kopieren und die Token-Blöcke aus Abschnitt 4 selbst ergänzen.
   ```bash
   cp -r themes/ma themes/blaupause
   ```
2. **IDs ersetzen.** In `theme.css` jedes `html[data-skin="ma"]` durch `html[data-skin="blaupause"]` (Suchen und Ersetzen), in `theme.json` `id` und `name`, im `README.md` den Titel. Nichts anderes darf noch auf den alten Skin verweisen (zum Beispiel die Variablen `--ma-red` umbenennen oder löschen).
3. **Tokens setzen** (Abschnitt 4). Erst die Farben für **hell**, dann dunkel. Alle drei Dunkel-Blöcke (`.gm-dark`, System, Umschalter) müssen dieselben Werte tragen; vergisst du einen, sieht der Skin je nach Einstellung verschieden aus.
   Kontrast sofort prüfen (Abschnitt 7).
4. **Hell und dunkel entscheiden.** Soll der Skin nur in einem Modus existieren, setze `"mode": "light"` bzw. `"dark"` in `theme.json`, lass dann die Blöcke des anderen Modus weg und setze trotzdem `.gm-dark` (der Pass-Deckel ist immer dunkel).
5. **Struktur-CSS schreiben** (Abschnitt 5). Beginne mit den Flächen, die am meisten Charakter tragen: Schrift (`--font-*`), Buttons (`.gm-btn`), Eingang (`.gm-hero*`), Reisekarten (`.gm-card`), Station (`.gm-st-*`). Danach Feinschliff.
6. **Fonts-Regel.** In `--font-display` und `--font-ui` die Wunschschrift an erster Stelle, danach ein vollständiger Systemschriften-Stack, zum Schluss die generische Familie:
   ```css
   --font-display: "IM Fell English", "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
   ```
   Keine `@import` und keine `<link>`-Dateien zu Fremdservern (Datenschutz, Offline-Betrieb). Ohne installierte Wunschschrift greift die nächste im Stack; **der Skin muss mit dem Rückfall gut aussehen**.
   Eine Schrift mitzuliefern (`@font-face` mit einer Datei im Skin-Ordner) ist technisch möglich, weil der Build den Ordner kopiert; keiner der mitgelieferten Skins tut es, und Lizenz sowie Dateigröße wären zu klären.
7. **Bauen.** Mit deinem Skin und, zum Vergleichen, mit `halle`:
   ```bash
   node tools/build.mjs beispiel-gehirn --skins=halle,blaupause --default-skin=blaupause
   ```
   Der Zielordner `dist/beispiel-gehirn/` wird dabei ersetzt. (`--skins=all` bindet alle Skins aus `themes/` ein.) Für Zeitstrahl und Zitat zusätzlich das Muster `_vorlage` bauen:
   ```bash
   node tools/build.mjs _vorlage --skins=halle,blaupause --default-skin=blaupause
   ```
8. **Ansehen.** `dist/<paket>/index.html` im Browser öffnen (Doppelklick genügt). Wechsel zwischen den Skins über „Aussehen“ in der Kopfleiste; hell/dunkel über den Knopf daneben. Browser-Entwicklerwerkzeuge: Breite 360 px, 820 px und volle Breite.
   Beim Verändern von `theme.css` den Skin neu bauen (der Build kopiert nur) und die Seite neu laden.
9. **Rauchtest.**
   ```bash
   node tools/smoke.mjs beispiel-gehirn --skins=blaupause --shots=/pfad/zu/screenshots
   ```
   Er meldet Konsolenfehler, Seitenfehler und horizontales Scrollen und schreibt Screenshots (Details und Checkliste: Abschnitt 8). Er prüft nicht, ob etwas gut aussieht oder lesbar ist.
10. **README schreiben**, Skin committen (`themes/<id>/`).

---

## 4. Die Token-Tabelle

Tokens sind CSS-Variablen auf `<html>`. Die Engine definiert Standardwerte in `engine/css/engine.css` (Abschnitt „1. Tokens“); ein Skin überschreibt sie mit `html[data-skin="<id>"] { … }`.
Jedes Modul der Seite, auch die Ansichten Karte, Zeitstrahl, Pass, Suche, Reise-Modus und alle Exponate, färbt sich **nur über diese Tokens**. Wer sie sauber setzt, bekommt das gesamte Museum mitgefärbt.

**Farben** (je Modus setzen; Standardwerte der Engine zur Orientierung)

| Token | Zweck | Engine hell | Engine dunkel | Regel |
|---|---|---|---|---|
| `--bg` | Seitenhintergrund | `#F6F2EA` | `#0E1420` | Grundfläche; auch Farbe der „Löcher“ in Netzplan-Ringen |
| `--bg-2` | Karten, Panels, Eingabeflächen | `#FFFFFF` | `#161E2E` | von `--bg` unterscheidbar, aber verwandt |
| `--bg-3` | vertiefte Flächen (Schiene des Reise-Modus, Stationskasten „Umsteigen“, Leisten) | `#ECE6DA` | `#1E2838` | dunkler als `--bg` (hell) bzw. heller (dunkel) |
| `--ink` | Fließtext, Überschriften | `#1B2230` | `#ECE8DF` | Kontrast auf `--bg`, `--bg-2`, `--bg-3` mindestens 4,5:1, besser 7:1 |
| `--ink-2` | gedämpfter Text (Einleitungen, Beschriftungen) | `#5C6577` | `#A3ABBB` | mindestens 4,5:1 auf `--bg`, `--bg-2` und `--bg-3` |
| `--ink-3` | Hinweise, Platzhalter, Nebensächliches | `#7B8497` | `#8089A0` | mindestens 4,5:1 anstreben. Der Engine-Wert hell erreicht nur etwa 3,4:1 auf `--bg`; die mitgelieferten Skins heben ihn auf über 4,5:1 |
| `--line` | Linien, Ränder, Trenner | `#D9D2C3` | `#2C3850` | dekorativ; Ränder, die ein Bedienelement erkennbar machen, brauchen besser `--ink-3` oder `--accent` (3:1) |
| `--accent` | Hauptakzent: Primär-Buttons, Fokus, aktive Zustände, Fortschritt | `#05749E` | `#46B3DB` | mindestens 3:1 gegen `--bg` (Fokusring, Grafik), als Text 4,5:1 |
| `--link` | Links, Eyebrow-Überschriften | `#045E80` | `#46B3DB` | 4,5:1 gegen `--bg`, `--bg-2`, `--bg-3` (Linktext) |
| `--warm` | „Museumslicht“: Highlights, Leuchtpunkte, Warm-Buttons, Skip-Link | `#FCB300` | `#FCB300` | kein Fließtext darauf ohne `--on-warm`; mit Leuchtkraft gegen `--bg` abwägen |
| `--ok` / `--warn` / `--bad` | Rückmeldung (Erfolg, Hinweis, Fehler/Zurücksetzen) | `#2F8F5B` / `#C77700` / `#C0392B` | `#57C58A` / `#F0A93B` / `#F06A5B` | als Text mindestens 4,5:1; Bedeutung nie nur über die Farbe |
| `--on-accent` | Text und Icons **auf** `--accent` | `#FFFFFF` | `#0A1018` | mindestens 4,5:1 gegen `--accent` |
| `--on-warm` | Text auf `--warm` | `#1B2230` | `#1B2230` | mindestens 4,5:1 gegen `--warm` |
| `--accent-soft` | zarter Akzentton: Hover-Flächen, ausgewählte Zeilen | `rgba(5,116,158,.1)` | `rgba(70,179,219,.14)` | halbtransparent, abgeleitet von `--accent` |
| `--glass` | halbtransparenter Grund der Kopfleiste und von Overlays | `rgba(246,242,234,.82)` | `rgba(14,20,32,.78)` | gleiche Farbe wie `--bg`, mit Alpha |
| `--hero-bg` | Grund des Eingangs und Füllung des Signet-Rings | `#0B1020` | `#0B1020` (die Engine setzt es nur in `:root`) | in Skins mit hellem Eingang gleich `--bg` des Modus |

**Form, Schrift, Fläche** (meist modusunabhängig)

| Token | Zweck | Engine |
|---|---|---|
| `--radius`, `--radius-sm`, `--radius-lg` | Eckenradien (Karten, kleine Elemente, große Rahmen wie Karte und Pass) | `14px`, `8px`, `22px` |
| `--shadow`, `--shadow-lg` | Schatten für Karten bzw. Panels und Overlays; `none` ist erlaubt | zweistufig, modusabhängig |
| `--grain` | Hintergrundtextur des `<body>` (`background: var(--bg) var(--grain)`); `none` schaltet sie ab | feines SVG-Rauschen, modusabhängig |
| `--font-display` | Überschriften, große Zahlen, Zitate | Iowan/Palatino/Georgia-Stack |
| `--font-ui` | Fließtext und Bedienelemente | System-Sans-Stack |
| `--gutter`, `--maxw` | seitlicher Abstand (`clamp(1rem, 4vw, 2rem)`) und maximale Inhaltsbreite (`76rem`) | siehe `engine.css` |
| `--ease` | Easing-Kurve der Übergänge | `cubic-bezier(.2,.7,.2,1)` |
| `--j-rundreise` | Farbe der virtuellen „Großen Rundreise“ (hat keine Paketfarbe) | `var(--accent)`; alle Skins setzen es ebenso |

**Tokens, die dir gehören nicht, die du aber liest**

| Token | Wer setzt es | Hinweis |
|---|---|---|
| `--j-<reise-id>` | der Build (`css/journey-colors.css`) aus `color` in `journeys.js` | Reisefarben, hell und dunkel; **nie überschreiben** (die Skins kennen die IDs des Pakets nicht) |
| `--jp-1` … `--jp-12` | der Build | Positionsfarben (die k-te Farbe der Reihenfolge, zyklisch); das Signet nutzt `--jp-1`, `--jp-3`, `--jp-5` |
| `--jc` | die Engine, lokal und inline | Reisefarbe des Elements: auf `.gm-station`, `.gm-card`, `.gm-chip`, `.gm-tr-btn`, Panel-Schaltflächen u. a. Skins lesen sie (`var(--jc)`), um Balken, Rahmen und Medaillen in Reisefarbe zu halten |
| `--header-h` | `app.js` (misst die Kopfleiste) | für Sprungmarken und Eingangshöhe |
| `--sbw` | Overlay-Verwaltung | Breite der Scrollleiste bei Scroll-Sperre |
| `--hero-stripes`, `--hero-stripes-h` | `app.js` (`renderEmblem`) | fertiger `linear-gradient` mit einem Streifen je Reise, Gesamthöhe; Standardfüllung von `.gm-hero::after` |
| `--hero-bar`, `--hero-bar-hard` | `app.js` (`renderEmblem`) | waagerechter Verlauf (`90deg`) mit einem Abschnitt je Reise: weich ineinander (`--hero-bar`) oder in harten, gleich breiten Blöcken (`--hero-bar-hard`). Für Skins, die den Reisestreifen als Balken zeichnen |

**Pflicht pro Modus.** Jeder Token-Block sollte mindestens setzen: `--bg --bg-2 --bg-3 --ink --ink-2 --ink-3 --line --accent --link --warm --ok --warn --bad --on-accent --on-warm --accent-soft --glass --hero-bg` und `color-scheme: light|dark`
(damit Formularfelder und Scrollleisten nativ passen). Genau diese Liste tragen die Blöcke in `themes/kabinett/theme.css`; zusätzliche Skin-eigene Variablen (`--ma-red`, `--sx-key`, …) sind erlaubt.

**Warum drei Dunkel-Blöcke?** Die Engine wählt den Modus auf drei Wegen: System (`prefers-color-scheme` ohne `data-theme`), Umschalter (`data-theme="dark"`) und feste dunkle Flächen (`.gm-dark`). CSS kann diese Wege nicht in einer Regel verbinden;
darum steht dieselbe Palette dreimal. Beim Ändern alle drei anpassen.

---

## 5. Komponenten-Klassen, auf die Skins zugreifen

Alle Klassen tragen das Präfix `gm-`. Die Liste stammt aus `engine/css/engine.css` und aus den Stellen im Code, die sie erzeugen (`index.template.html`, `app.js`, `core.js`); sie ist gruppiert wie die Skins sie anfassen.
Zustandsklassen stehen hinter dem Punkt: `.gm-card.is-tool` meint die Klasse `is-tool` am Element `.gm-card`.

### 5.1 Rahmen

| Klasse | Beschreibung |
|---|---|
| `body` | Hintergrund `var(--bg) var(--grain)`, Schrift `--font-ui`, 1 rem / 1,6 |
| `.gm-skip` | „Zum Inhalt springen“ (nur bei Fokus sichtbar) |
| `.gm-container` | Inhaltsbreite mit Seitenrändern (`--gutter`, `--maxw`) |
| `.gm-section` | Abschnitt mit großem vertikalem Abstand |
| `.gm-header` (`#kopf`) | feste Kopfleiste, `--glass`, Unterkante. `[data-tone="dark"]` solange der Eingang darunter liegt, sonst `auto` |
| `.gm-header-in` | innere Zeile der Kopfleiste |
| `.gm-brand`, `.gm-brand-mark`, `.gm-brand-ring`, `.gm-brand-name` | Marke: Signet (SVG, Fäden in `--jp-1/3/5`), Ring, Museumsname |
| `.gm-tabs`, `.gm-tab` | Tabs Karte, Zeitstrahl, Reisepass; `[aria-current="page"]` ist die aktive, `::after` der Strich darunter |
| `.gm-actions` | rechte Gruppe der Kopfleiste |
| `.gm-search-btn`, `.gm-search-label`, `.gm-kbd` | Suchknopf mit Beschriftung und Tastenkürzel-Plakette |
| `.gm-skin`, `.gm-skin-btn`, `.gm-skin-label`, `.gm-skin-menu`, `.gm-skin-h`, `.gm-skin-item`, `.gm-skin-name`, `.gm-skin-desc` | Skin-Umschalter und sein Menü (`.gm-skin-item[aria-pressed="true"]` ist der aktive) |
| `.gm-iconbtn` | runder Icon-Knopf (Darstellung, Schließen, Pfeile) |
| `.gm-halle` | Block mit den Ansichten (Karte, Zeitstrahl, Reisepass), erscheint nach den Reisekarten |
| `.gm-view`, `.gm-view-head`, `.gm-view-title`, `.gm-view-lead`, `.gm-view-body`, `.gm-view-missing` | Hülle jeder Ansicht: Kopf (Eyebrow, Titel, Lead) und Inhaltsblock |
| `.gm-toast`, `.gm-overlay`, `.gm-noscript`, `.gm-sr` | Hinweisfeld, modale Ebene, Hinweis ohne JavaScript, nur für Screenreader sichtbar |
| `html.gm-lock`, `html.gm-ready` | Scroll-Sperre bei offenem Overlay; die Seite ist gestartet |

### 5.2 Hero (Eingang)

| Klasse | Beschreibung |
|---|---|
| `.gm-hero` (`#eingang`) | der Eingang: Mindesthöhe `min(100svh, 58rem)`, rückt unter die Kopfleiste. Hintergrund `--hero-bg`; `::after` ist der Reisestreifen am Fuß (Höhe `--hero-stripes-h`, Füllung `--hero-stripes`, seitlich ausgeblendet) |
| `.gm-hero-canvas` | Neuronen-Canvas (`hero.js`); Skins mit ruhigem Grund blenden ihn aus (`display: none`) |
| `.gm-hero-vignette` | dunkle Abschattung über dem Canvas (ebenfalls ausblendbar) |
| `.gm-hero-in` | zentrierte Inhaltsspalte |
| `.gm-emblem`, `.gm-emblem-ring` | Signet aus einem Faden je Reise (SVG), Ring in `--warm` |
| `.gm-hero-eyebrow`, `.gm-hero-title`, `.gm-hero-claim` | Zeile über dem Titel, Titel (h1, standardmäßig Versalien mit Leuchten), Untertitel (kursiv). Die Engine setzt `data-len="long"` (ab 24 Zeichen) bzw. `"xlong"` (ab 34) am Titel; Skins mit sehr großer Schrift (`ma`) verkleinern damit. `.gm-brand-name` kürzt zu lange Namen mit „…“ |
| `.gm-hero-cta` | Reihe der drei Einstiegs-Buttons (`.gm-btn-warm`, zwei `.gm-btn-glass`) |
| `.gm-scrollcue` | „Eintreten“-Hinweis unten |

Achtung: Schriftfarben im Eingang (`#F3EFE6`, `#DDD7C9`, `#B9C3D6`) und die Glas-Buttons sind in der Engine **fest hell** codiert, weil der Eingang als dunkel gedacht ist.
Ein Skin mit hellem Eingang muss `.gm-hero-eyebrow`, `.gm-hero-title`, `.gm-hero-claim`, `.gm-scrollcue` und `.gm-btn-glass` umfärben (so tun es `kabinett`, `ma` und `quelltext`).

### 5.3 Allgemein

| Klasse | Beschreibung |
|---|---|
| `.gm-btn` | Basisknopf (Pille, 44 px hoch, Rahmen 1,5 px). Varianten: `.gm-btn-primary` (`--accent`), `.gm-btn-warm` (`--warm`), `.gm-btn-ghost` (Rahmen, transparent), `.gm-btn-quiet` (unterstrichener Text), `.gm-btn-glass` (halbtransparent, für dunklen Grund) |
| `.gm-chip`, `.gm-chip-dot` | Reise-Chip (Pille in Reisefarbe `--jc`, `.is-active` hervorgehoben) und sein Icon-Punkt; als `<button>` anklickbar |
| `.gm-ico`, `.gm-icon` | Hülle und SVG von Icons (immer `currentColor`) |
| `.gm-eyebrow` | Zeile über Überschriften (Versalien, gesperrt, `--link`) |
| `.gm-h2`, `.gm-h3`, `.gm-section-lead` | Abschnittsüberschriften und Einleitungstext |
| `.gm-how`, `.gm-steps`, `.gm-step`, `.gm-step-ico` | Abschnitt „So funktioniert das Museum“ mit drei Schritten |
| `.gm-stats`, `.gm-stat` (`dt`, `dd`) | Zahlenreihe (Reisen, Stationen, Kreuzungen, Exponate); `dd` ist die große Zahl |

### 5.4 Reisekarten

| Klasse | Beschreibung |
|---|---|
| `.gm-trips`, `.gm-trips-h`, `.gm-trips-n` | Abschnitt „Reiseführer“, Gruppenüberschrift („Funktionale Reisen …“), Zähler |
| `.gm-cards` | Raster der Karten |
| `.gm-card` | eine Reisekarte (`article`, `--jc` = Reisefarbe, `data-journey`). `::before` ist der Farbbalken oben. `.is-tool`: Werkzeug-Reise |
| `.gm-card-top`, `.gm-card-ico`, `.gm-card-count`, `.gm-card-badge`, `.gm-card-title`, `.gm-card-tag`, `.gm-card-foot`, `.gm-card-prog` | Kopfzeile, Reise-Icon, Zahlen (Stationen, Kreuzungen), Plakette „Werkzeug“, Titel (h4), Tagline, Fußzeile mit Fortschrittstext |
| `.gm-strip`, `.gm-dot` | Punktband mit einem Punkt je Station (`.is-x` Kreuzung, `.is-seen` besucht) |

### 5.5 Station

Die Station ist ein `<article class="gm-station">` mit `data-kind`, `data-id`, `data-journey` und `--jc`; sie erscheint im Panel, im Reise-Modus und in der Suche (kompakt: `.is-compact`).

| Klasse | Beschreibung |
|---|---|
| `.gm-station` | Hülle; Attribut `data-kind` erlaubt Gestaltung nach Art (`konzept`, `person`, `ereignis`, `methode`, `mythos`, `instrument`, `ort`) |
| `.gm-st-head`, `.gm-st-medal`, `.gm-st-headtext` | Kopf; Medaille mit Icon der Station; `.gm-st-head::after` ist der Balken in `--jc` unter dem Kopf |
| `.gm-st-eyebrow`, `.gm-st-kind`, `.gm-st-year`, `.gm-st-seen` | Zeile über dem Titel: Art mit Icon, Jahr, Häkchen „Besucht“ |
| `.gm-st-title`, `.gm-st-main`, `.gm-st-sub` | Titel (h2) mit Haupt- und Untertitel (Teil nach „: “) |
| `.gm-st-chips` | Liste der Reise-Chips |
| `.gm-st-lead` | Teaser unter dem Kopf |
| `.gm-st-body` (`.has-dc`) | Fließtext; `.has-dc` heißt: erster Absatz beginnt mit einem Buchstaben, geeignet für eine Initiale (`p:first-child::first-letter`) |
| `.gm-st-figure`, `.gm-fig-stage` | Abbildung nach dem ersten Absatz und ihre Bühne |
| `.gm-st-facts`, `.gm-st-factlist`, `.gm-fact`, `.gm-fact-n`, `.gm-fact-t` | „Auf einen Blick“: nummerierte Faktenkarten |
| `.gm-st-quote` (`blockquote`, `figcaption`, `.gm-q-who`, `cite`) | Zitat mit Urheber und Quelle |
| `.gm-st-myth`, `.gm-flip`, `.gm-flip-inner`, `.gm-flip-face`, `.gm-flip-front`, `.gm-flip-back`, `.gm-flip-label`, `.gm-flip-text`, `.gm-flip-stamp`, `.gm-flip-tick`, `.gm-flip-bar`, `.gm-flip-btn` | Mythos-Karte zum Umdrehen (`[data-flipped="true"]`): Vorderseite „was man glaubte“, Rückseite „heute wissen wir“, Stempel „Irrtum?“, Haken |
| `.gm-st-exhibit`, `.gm-stage`, `.gm-plaque`, `.gm-plaque-info`, `.gm-plaque-eyebrow`, `.gm-plaque-title`, `.gm-plaque-blurb`, `.gm-plaque-actions`, `.gm-stage-mount`, `.gm-stage-end`, `.gm-stage-note`, `.gm-plinth` | Exponat: Tafel mit Titel und Start-Knopf, Bühne (`.is-running` am Elternteil, solange es läuft), Sockel |
| `.gm-st-transfer`, `.gm-tr-lead`, `.gm-tr-list` (`.is-many`), `.gm-tr-btn` (`.is-next`, `.is-go`), `.gm-tr-ico`, `.gm-tr-text`, `.gm-tr-name`, `.gm-tr-why`, `.gm-tr-next`, `.gm-tr-go` | Kasten „Hier umsteigen“ mit einer Schaltfläche je anderer Reise (Farbe `--jc` der Zielreise) |
| `.gm-st-more`, `.gm-st-morecol`, `.gm-st-links`, `.gm-st-refs`, `.gm-st-h` | Fuß der Station: Weiterlesen-Links, Lesetipps; `.gm-st-h` ist die kleine Zwischenüberschrift aller Stationsabschnitte |
| `.gm-swap-in` | kurze Einblendung beim Stationswechsel im Panel |

### 5.6 Panel und Fuß

| Klasse | Beschreibung |
|---|---|
| `.gm-panel` (`#stationspanel`) | Stationspanel; `.is-open`, `.is-closing`. Rechts als Schublade, auf kleinen Bildschirmen als Bottom-Sheet |
| `.gm-panel-backdrop`, `.gm-panel-sheet`, `.gm-panel-grab`, `.gm-panel-bar`, `.gm-panel-ctx`, `.gm-panel-pos`, `.gm-panel-steps`, `.gm-panel-step`, `.gm-panel-close`, `.gm-panel-scroll`, `.gm-panel-cont` | Hintergrund, Blatt, Ziehgriff, Kopfzeile (Reise-Chip und Position „Station 3 von 12“, Pfeile, Schließen), Scrollbereich, „Reise ab hier fortsetzen“ |
| `.gm-footer`, `.gm-footer-grid`, `.gm-foot-col`, `.gm-foot-h`, `.gm-foot-help`, `.gm-foot-legal` | Fuß mit Spalten; `.gm-foot-help` ist die hervorgehobene Hilfe-Spalte (aus `pack.footer.columns[].classes`); `.gm-foot-legal` Lizenz und Nachweise |

### 5.7 Reise-Modus und die Ansichten

Diese Teile bringen ihre eigenen Styles mit (Skripte `journey.js`, `map.js`, `timeline.js`, `passport.js`, `search.js` fügen beim Laden einen `<style>`-Block in `<head>` ein). Sie nutzen ausschließlich Tokens und Reisefarben.
Skins erreichen sie über die Präfixe, mit Spezifität über `html[data-skin="…"]`:

| Präfix | Bereich | Von den Skins gestaltet |
|---|---|---|
| `.gm-reise-*` (Wurzel `.gm-reise-root`), Ersatz `.gm-rf-*` | Reise-Modus: Vollbild mit Linienschiene, Karten, Abschlusskarte mit Stempel | selten |
| `.gm-karte-*`, `.gm-rv-*` | Karte: Leiste, Legende, Netzplan (`.gm-karte-svg`), Hinweiskarte (`.gm-karte-card`), Ringansicht der Reisen (`.gm-rv-*`) | Schrift im SVG, Rundungen |
| `.gm-zeit-*` | Zeitstrahl: Bahnen, Epochenbänder, Lineal, Vorschau | Schrift im SVG |
| `.gm-pass-*` | Reisepass: Deckel (`.gm-pass-cover`, zusätzlich `.gm-dark`), Stempelkarten (`.gm-pass-card`), Empfehlungen, Gruppen | Deckel, Karten |
| `.gm-suche-*` | Suche: Panel (`.gm-suche-panel`), Eingabefeld (`.gm-suche-input`), Filter, Treffer | Panel, Eingabefeld |

Einige Module legen eigene, überschreibbare Variablen an (nicht von den mitgelieferten Skins genutzt): Karte `--gk-paper`, `--gk-core`, `--gk-go`, `--gk-on`, `--gk-spark-edge`, `--gk-h` (auf `.gm-karte`, `.gm-karte-stage`, `.gm-rv-plan`);
Zeitstrahl `--zeit-bg` (auf `.gm-zeit`); Reise-Modus `--rail-bg`, `--railw` (auf `.gm-reise-root`). Ein Überschreiben (`html[data-skin="x"] .gm-karte { --gk-paper: … }`) gewinnt über die Spezifität. Diese Namen sind Modul-Innenleben und können sich ändern (Abschnitt 11).

---

## 6. Besonderheiten

### 6.1 Immer dunkle Flächen: `.gm-dark`, Hero, Kopfleiste über dem Eingang

Die Engine definiert in `engine.css` die dunklen Tokens zusätzlich auf `.gm-hero`, `.gm-dark` und `.gm-header[data-tone="dark"]` (und auf `:root[data-theme="dark"]`). Damit bleiben diese Flächen unabhängig vom Modus dunkel (Museum bei Nacht).

- **`.gm-dark`** trägt nur der Deckel des Reisepasses (`.gm-pass-cover`). Jeder Skin muss einen eigenen dunklen Token-Block `html[data-skin="<id>"] .gm-dark { … }` liefern; sonst erscheint der Deckel in der blauen Standard-Dunkelpalette der Engine.
- **`.gm-hero` und `.gm-header[data-tone="dark"]`** sind in der Engine dunkel. Die Skins `kabinett`, `ma` und `quelltext` nehmen die beiden Selektoren in ihren **Hell-Block** auf (und in beide Dunkel-Blöcke), damit der Eingang dem Modus folgt (heller Eingang im Hellmodus).
  Wer einen immer dunklen Eingang will (wie `halle`), nimmt die beiden Selektoren **nicht** auf, setzt aber in einem eigenen Block `html[data-skin="<id>"] .gm-hero, html[data-skin="<id>"] .gm-header[data-tone="dark"] { … dunkle Palette … }`.
  Der Grund für das Auflisten: Die Engine-Regel trifft das Element direkt und würde sonst die vom `<html>`-Element geerbten Skin-Tokens überstimmen.
- `data-tone` wechselt zwischen `dark` (Eingang liegt unter der Kopfleiste) und `auto` (sonst), nach Scrollposition (`app.js`, `bindHeader`).

### 6.2 Reisefarben `--j-*` und `--jp-n` gehören dem Paket

`css/journey-colors.css` (vom Build erzeugt, vor den Skins geladen) setzt `--j-<id>` je Reise: hell in `:root`, dunkel unter denselben Selektoren wie die dunklen Tokens (System-Dunkel, `data-theme="dark"`, `.gm-hero`, `.gm-dark`, `.gm-header[data-tone="dark"]`).
Skins **lesen** die Farben (`var(--jc)`, `var(--jp-1)`) und überschreiben sie nie, schon weil sie die Reise-IDs des jeweiligen Pakets nicht kennen. Konsequenzen für das Design:

- Jede Reisefarbe muss auf `--bg`, `--bg-2` und `--bg-3` deiner Palette tragen (Linien, Balken, Punkte: mindestens 3:1). Das prüft der Paketautor nur gegen `#F6F2EA` und `#0E1420` (`check-pack`); **gegen deine Palette prüfst du selbst**. Wähle Hintergründe, die den Reisefarben Luft lassen (sehr gesättigte oder sehr dunkle Gründe der Skin-Palette fallen auf).
- Text steht nie direkt auf Reisefarbe, sondern in `--ink` auf einer nur leicht eingefärbten Fläche (so machen es Chips, Karten und Stempel in der Engine).
- Kenne die Grenze: Auf `.gm-hero` und `.gm-header[data-tone="dark"]` liegen immer die **Dunkel-Varianten** der Reisefarben (aufgehellt für dunklen Grund), auch wenn dein Skin dort hell ist. Das betrifft das Signet, den Reisestreifen und Fäden im Eingang. Prüfe Kontrast und Wirkung im hellen Eingang; im Zweifel den Eingang dunkel lassen oder das Signet (`.gm-emblem`) zurücknehmen.
- `--j-rundreise` (die Große Rundreise) setzen die Skins auf `var(--accent)`.
- **Reisestreifen im Eingang:** Nie Reise-IDs eines Pakets fest eintragen (`var(--j-verzerrung)` ist in jedem anderen Paket undefiniert, und der Streifen entfiele). Nimm `background: var(--hero-bar, var(--accent))` (weicher Balken), `var(--hero-bar-hard, var(--accent))` (harte Blöcke) oder lass den Engine-Standard (`--hero-stripes`, feine Linien am Fuß). Wer eigene Verläufe baut, nutzt die Positionsfarben `var(--jp-1)`…`var(--jp-6)`. `tools/check-skin.mjs` meldet feste Reise-IDs.

### 6.3 Karten-Optionen in `theme.json`: `map.lines` und `map.nodes`

Nur der Netzplan (`map.js`) liest sie, über `MUSEUM.skin.map()`; der Wert des aktiven Skins gilt sofort nach dem Wechsel.

| Option | Wert | Wirkung |
|---|---|---|
| `lines` | `"octilinear"` (Standard) | Linien laufen auf dem Raster in acht Richtungen (waagerecht, senkrecht, 45°); Ecken sind eng gerundet (Radius 17 Einheiten). Der klassische Netzplan-Look |
| `lines` | `"smooth"` | gleiche Führung, aber Knicke **zwischen** Haltepunkten werden großzügig gerundet (Radius 56 statt 17); an Haltepunkten bleibt die enge Rundung. Wirkt organischer, wie gezeichnete Wege |
| `nodes` | `"icons"` (Standard) | Reise-Icons und Leuchtpunkte als Haltepunkte, Kreise mit Ringen |
| `nodes` | `"shapes"` | Haltepunkte als geometrische Formen: Kreis, Quadrat, Dreieck, Raute, Fünfeck, Sechseck, dann wieder von vorn. Die Form hängt an der Reise (ihrer Nummer), nicht an der Station. Wirkt technisch und gibt neben der Farbe einen zweiten Unterscheidungskanal |

`lines` wirkt nur, wenn das Paket eine `layout.js` hat (oktilineares Layout). Ohne sie rechnet die Karte ein Kräfte-Layout mit weichen Kurven, unabhängig von `lines`.

### 6.4 Darstellungsmodus erzwingen

`"mode": "light"` oder `"dark"` in `theme.json` erzwingt `data-theme` und blendet den Darstellungs-Knopf aus (bei mehreren eingebundenen Skins). Der Skin muss dann nur diesen Modus gut gestalten; `.gm-dark` bleibt trotzdem nötig.

### 6.5 Fokus, Bewegung, Druck

- Die Engine setzt einen Fokusring (`:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px }`; im Eingang und in der dunklen Kopfleiste `#7FD0F0`). Skins dürfen ihn umgestalten (so tun es alle drei), **nie entfernen**.
  `[tabindex="-1"]:focus` ist absichtlich ohne Ring (programmatischer Fokus auf Überschriften).
- Bewegung: Alles, was sich bewegt, steht in `@media (prefers-reduced-motion: no-preference)` bzw. wird für `reduce` abgeschaltet. Deine eigenen Übergänge (`transform`, Animationen) gehören in dieselbe Logik (Beispiel am Ende von `themes/ma/theme.css`).
- Die Engine hat eine Druckregel (`@media print`); Skins ändern sie nicht.

---

## 7. Gestaltungsprinzipien

1. **Der Skin muss zum Inhalt passen, nicht nur Farben tauschen.** Frage zuerst: Wie sähe das Wissensgebiet aus, wenn es ein Gegenstand wäre (Herbar, Plakat, Terminal, Schulwandkarte)? Dann entscheide Schrift, Dichte, Ränder, Ornament und Linienart des Netzplans zusammen.
   Ein Skin soll sich in Screenshots auf den ersten Blick von „halle“ unterscheiden, auch ohne Farbe.
2. **Systemschriften-Stacks mit Wunschschrift an erster Stelle.** Die Wunschschrift steht vorn, danach vollständige Rückfälle (siehe Schritt 6). Der Skin muss mit dem Rückfall tragfähig sein; prüfe ihn, indem du die Wunschschrift aus dem Stack streichst.
3. **Kontrast AA.** Text mindestens 4,5:1 (großer Text 3:1), Bedienelemente und Grafik gegen Nachbarflächen mindestens 3:1. Prüfen kannst du mit dem Hilfswerkzeug des Repositorys (WCAG-Formel):
   ```bash
   node -e "import('./tools/check-lib.mjs').then(m => console.log(m.contrast('#1B2230', '#F6F2EA').toFixed(1)))"
   ```
   Ausgabe ist das Kontrastverhältnis (hier 14,3). Prüfe jedes Paar aus der Token-Tabelle in **beiden** Modi: `--ink`, `--ink-2`, `--ink-3` und `--link` auf `--bg`, `--bg-2`, `--bg-3`; `--on-accent` auf `--accent`; `--on-warm` auf `--warm`; `--accent` gegen `--bg`.
4. **Fokus sichtbar.** Auf jeder Fläche: Hell, dunkel, im Eingang, im Pass-Deckel, auf farbigen Flächen. Tab durch die ganze Seite und achte darauf, dass du jederzeit siehst, wo du bist.
5. **`prefers-reduced-motion` respektieren.** Keine neuen Dauerbewegungen ohne Abschaltung; nichts blinkt ohne Ausnahme für reduzierte Bewegung (der Skin „quelltext“ lässt den Cursor nur bei erlaubter Bewegung blinken).
6. **Handy ab 360 px.** Kein horizontaler Seiten-Scroll (der Rauchtest meldet ihn): lange Wörter, Tabellen, Monospace-Schriften, breite Ornamente und negative Ränder kontrollieren. Tippflächen mindestens 44 × 44 px (Engine-Standard).
   Breakpoints in `engine.css`: 900, 860, 640 und 560 px; folge ihnen, statt neue zu erfinden.
7. **Farbe trägt nie allein die Information.** Chips, Karten und Stempel nennen auch den Reisenamen; Mythen sind zusätzlich gestrichelt, besuchte Stationen zusätzlich mit Häkchen. Behalte diese Zweitkanäle bei.
8. **Nichts von außen.** Keine fremden Schriften, Bilder oder Skripte; Muster als Data-URI (wie `--grain`) oder als Datei im Skin-Ordner.
9. **Behalte die Lesbarkeit der Stationstexte.** Zeilenlänge 45 bis 75 Zeichen, Zeilenhöhe um 1,6, ausreichend große Schrift; die Stationen sind der Kern.
10. **Weniger Selektoren, mehr Tokens.** Je mehr du über Tokens löst, desto stabiler ist der Skin gegen spätere Änderungen an den Ansichten.

---

## 8. Prüfablauf und Screenshot-Checkliste

**Befehle**

Vor allem: `node tools/check-skin.mjs <id>` (Form), und baue ein Paket mit **40 Zeichen langem Museumsnamen** (Kopie von `_vorlage` mit langem `title`): Eingang und Kopfleiste dürfen bei 390 px nicht horizontal scrollen und nichts Wichtiges abschneiden.

```bash
# bauen (Zielordner wird ersetzt); zum Vergleich "halle" mit einbinden
node tools/build.mjs beispiel-gehirn --skins=halle,<id> --default-skin=<id>
node tools/build.mjs _vorlage        --skins=halle,<id> --default-skin=<id>   # hat eine historische Reise: Zeitstrahl, Zitat

# automatischer Rauchtest (Playwright + Chromium nötig)
node tools/smoke.mjs beispiel-gehirn --skins=<id> --shots=<ordner>
node tools/smoke.mjs _vorlage        --skins=<id> --shots=<ordner>
```

`smoke.mjs` testet Desktop 1280, Tablet 820 und Handy 390, jeweils hell und dunkel, und meldet Konsolenfehler, Seitenfehler, fehlgeschlagene Anfragen und horizontales Scrollen. Optionen: `--quick` (nur Desktop hell), `--viewports=desktop,phone`, `--themes=dark`.
Seine Screenshots heißen `<skin>-<viewport>-<modus>-<name>.png`, mit den Namen `1-eingang`, `2a-netzplan-reisen`, `2b-netzplan-gesamtnetz`, `2c-netzplan-liste`, `3-zeitstrahl`, `4a-reise-einfuehrung`, `4b-reise-station`, `5-station`, `5b-rundreise`, `6-reisepass`, `8-suche`, `9-umschaltung-zu-<skin>`.
Der Eingang wird nur für Desktop/hell als ganze Seite aufgenommen und zeigt dann auch den Fuß. Der Test öffnet die erste Station der ersten Reise; **Zitat, Mythos und Exponat prüfst du von Hand** (Hash-Adresse in die Adresszeile):

| Was | Paket | Adresse |
|---|---|---|
| Zitat | `_vorlage` | `#/station/bach-kaffeekantate` |
| Mythos (umdrehbare Karte) | `_vorlage` oder `beispiel-gehirn` | `#/station/kaldi-legende` bzw. `#/station/phrenologie` |
| Exponat (Stroop-Test) | `beispiel-gehirn` | `#/station/stroop` |
| Abbildung | `beispiel-gehirn` | `#/station/phrenologie` oder `#/station/beck` |
| Zeitstrahl | `_vorlage` | `#/zeitstrahl` |

**Checkliste: jeder Punkt in hell und dunkel, Desktop (1280) und Handy (≤ 390 px)**

1. Eingang: Titel, Signet, Einstiegs-Buttons, Reisestreifen, Fokusring im Eingang, Kopfleiste über dem Eingang und nach dem Scrollen.
2. Zahlen und „So funktioniert das Museum“, Reisekarten (Hover, Fokus, besucht/unbesucht, Werkzeug-Karte falls vorhanden).
3. Netzplan, **drei Modi**: Reisen (Ringansicht), Gesamtnetz (Zoom, Beschriftung), Liste. Linienart (`lines`) und Haltepunkte (`nodes`) wirken sichtbar; Legende, Hinweiskarte.
4. Zeitstrahl (Paket `_vorlage`): Bahnen, Epochenbänder, Jahreslineal, Mythos-Markierung, Vorschau.
5. Reise-Modus: Einführung, eine Station, Schiene und Fortschritt, Abschluss mit Stempel.
6. Station: Kopf mit Medaille, Titel mit Untertitel, Teaser, Fließtext mit Initiale, Fakten, **Zitat**, **Mythos-Karte** (beide Seiten), **Exponat** (Tafel, laufend), Abbildung, Umsteigen-Kasten, Links und Lesetipps. Als Panel (Schublade) und als Bottom-Sheet auf dem Handy.
7. Reisepass: Deckel (`.gm-dark`), Stempel, Fortschritt, Empfehlungen, besuchte Stationen, Zurücksetzen.
8. Suche: leer, mit Treffern, ohne Treffer, Fokus im Eingabefeld, Filter nach Art.
9. Fuß: alle Spalten, die Hilfe-Spalte, Lizenz und Nachweise.
10. Skin-Umschalter: Menü offen, aktiver Eintrag erkennbar, Wechsel von und zu `halle`.
11. Querschnitt: Tastatur-Durchlauf (Tab) mit sichtbarem Fokus; **reduzierte Bewegung** (Betriebssystem oder Entwicklerwerkzeuge); Schrift 200 % vergrößert; Rückfallschrift (Wunschschrift aus dem Stack gestrichen); kein horizontaler Scroll bei 360 px.

---

## 9. Die mitgelieferten Skins

Alle vier laufen hell und dunkel (`mode: "both"`). Ein Skin je Idee; die Grenzen stammen aus den `README.md` der Skins und aus der Prüfung des Codes.

**halle** (Standard, Referenz) – `map`: `octilinear` / `icons`
Das heutige Aussehen: „Museum bei Nacht“, tiefes Tintenblau, warmes Licht, Neuronen-Canvas im Eingang. `theme.css` setzt nur `color-scheme`; alle Tokens und Komponenten kommen aus `engine.css`. Der Skin ist der Regressionsmaßstab: Neue Engine-Änderungen werden zuerst an ihm geprüft.
Grenzen: keine; der Eingang ist in beiden Modi dunkel.

**kabinett** – `map`: `smooth` / `icons`
Herbarium und Naturforscher-Kabinett: Papier (hell) bzw. Moosgrün-Nacht (dunkel), Tinte, Antiqua-Stack (Wunschschrift „IM Fell English“), Initiale, Reisekarten als Etikett-Kästen („Tafel I, II …“ per CSS-Zähler), Doppellinien, ungleiche Eckenradien, Zierzeichen per `::before/::after`.
Grenzen: Zeitstrahl, Karte, Pass und Suche bekommen nur Token-Wirkung plus Rundungen und Schriftanpassungen im SVG (ihre Styles liegen in den Modulen). Der Pass-Deckel bleibt dunkel (Moosgrün). Der Eingang zeichnet kein Sternfeld (Canvas ausgeblendet). „IM Fell English“ ist nicht eingebettet; ohne Installation greift Palatino/Georgia.
Reisestreifen im Eingang mit festen Gehirnmuseum-IDs (Abschnitt 6.2).

**ma** – `map`: `octilinear` / `shapes`
Weißraum und Raster: Grotesk (Wunschschrift „Jost“), Primärakzente (Rot, Blau, Gelb; Tokens `--ma-red`, `--ma-blue`, `--ma-yellow`), große Zahlen, flache Flächen ohne Schatten und Rundungen (`--radius*: 0`, `--shadow*: none`, `--grain: none`), asymmetrischer Eingang mit kleingeschriebenem Titel und rotem Kreis.
Grenzen: Der Titel im Eingang wird per CSS kleingeschrieben (nur Hero und Markenname, nie Stationstitel). Die Ansichts-Module erhalten nur Tokens und wenige eckige Rahmen. Der Pass-Deckel ist immer dunkel. „Jost“ ist nicht eingebettet; Rückfall auf Systemschrift. Reisestreifen mit festen Gehirnmuseum-IDs.

**quelltext** – `map`: `octilinear` / `shapes`
Computer-Code: Monospace-Stack (Wunschschrift „JetBrains Mono“), dunkel zuerst (GitHub-Dunkel-Anmutung), hell als Papier-Variante. Eingang als Terminalfenster mit Prompt `$` und Blockcursor (blinkt nur bei erlaubter Bewegung), Zeilennummern an den Reisekarten (CSS-Zähler), `//`-Kommentare für Eyebrows, `#`-Überschriften, `> `-Zitate, `[1]`-Fakten, `git merge` für Umsteigen. Syntax-Tokens `--sx-key`, `--sx-str`, `--sx-num`, `--sx-cm`, `--sx-kw`.
Grenzen: Echte Hash-Kennungen sind per reinem CSS nicht möglich (nur Zähler). Monospace verbreitert Texte; Absätze sind auf 44 rem begrenzt. Der Pass-Deckel bleibt dunkel. „JetBrains Mono“ ist nicht eingebettet; Rückfall auf Menlo/Consolas/DejaVu Sans Mono. Reisestreifen mit festen Gehirnmuseum-IDs.

---

## 10. Icons und Illustrationen

**Wer zeichnet was.** Icons sind Teil der Engine (`engine/js/icons.js`, derzeit 94 Stück) und für alle Skins und Pakete gleich. Ein Skin bringt keine eigenen Icons mit; er färbt sie über `currentColor` und bestimmt per CSS Größe und Umgebung (Medaille, Chip, Karte).
Abbildungen (`packs/<id>/visuals/*.js`) und Exponate (`packs/<id>/exhibits/*.js`) gehören dem Paket.

**Stil der Icons**

- 24 × 24-Raster (`viewBox="0 0 24 24"`), Strichgrafik, `stroke="currentColor"`, **Strichstärke 1,6**, runde Enden und Ecken (`stroke-linecap="round"`, `stroke-linejoin="round"`), `fill="none"`.
  Einzelne Füllflächen (`fill="currentColor"`, z. B. Punkte, Pupillen) sparsam.
- Lesbar bei 20 px **und** bei 64 px. Etwa 2 px Rand zum Rasterrand lassen. Keine festen Farben, keine Verläufe, keine Texte.
- Einheitliche Bildsprache: Formen vereinfachen, Linien nicht überfrachten, Gewicht vergleichbar mit den vorhandenen Icons (Vorbilder: `brain`, `compass`, `hourglass`, `network`).
- Ein neues Icon ist ein Eintrag im Objekt `D` in `engine/js/icons.js` (Inhalt ohne `<svg>`-Hülle; Hilfsfunktionen `dot(x, y, r)` und `mirror(inner)` stehen bereit). Danach kennt `check-data` den Schlüssel. Zum Auflisten aller Schlüssel:
  ```bash
  node -e "import('./tools/check-lib.mjs').then(m => console.log([...m.iconKeys()].join(' ')))"
  ```
  Wer ein Icon ergänzt, schreibt es in einem Pull Request für die Engine, nicht in einen Skin.

**Illustrationen, Abbildungen, Exponate**

- **Abbildungen müssen in allen Skins lesbar sein.** Seit dem Baukasten `MUSEUM.viz` (`engine/css/exhibits.css`, Präfix `gx-`) tragen Stationen oft Kurven, Tabellen, Balken und Netze; sie nutzen nur die Tokens `--bg-2`, `--bg-3`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--accent`, `--on-accent`, `--ok`, `--warn`, `--bad`, `--warm`, `--radius-sm`, `--font-ui`. Ein Skin, der diese Tokens sauber setzt, färbt sie mit. Prüfe in jedem Skin hell und dunkel: Achsenbeschriftung, Gitterlinien (`--line`) und Zielbänder (`--ok`) müssen sichtbar bleiben, Serienfarben (`--accent`, `--warn`, `--ok`, `--bad`) unterscheidbar sein. `node tools/viz-test.mjs` zeigt alle Bausteine in allen Skins (Bilder in einem temporären Ordner oder `--shots=`). Bricht ein Skin einen Baustein (z. B. unlesbare Ränder, weil `--bg-2` zu nah an `--bg-3` liegt), ist das ein Skin-Fehler.

- Nur **Tokens** für Farben: `var(--ink)`, `var(--ink-2)`, `var(--line)`, `var(--bg-2)`, `var(--accent)`, `var(--warm)`, Reisefarbe `var(--jc)`; als Rückfall den Engine-Wert, z. B. `var(--ink, #1B2230)`. So wirkt jeder Skin und jeder Modus, ohne dass die Abbildung ihn kennt.
  Ausnahme: Farben, die Teil des Inhalts sind (die Reizfarben im Stroop-Test sind fest und stehen auf einer immer dunklen „Vitrine“).
- Linienzeichnung mit `currentColor` bzw. Token-Strichen; Flächen flach; kein Text in Pixelgrafiken (Beschriftungen als SVG-`<text>` oder DOM, mit `alt` und `caption`).
- Skin-eigene Muster (z. B. Rauschen, Papierstruktur, Raster) als Data-URI-SVG in einer Variablen (`--grain` zeigt, wie) oder als Datei im Skin-Ordner; nie von außen.
- Zusätzliche, rein dekorative Zeichen (Schnörkel, Kennungen, Zähler) mit `::before`/`::after` und `content`, wie `kabinett` („❦“) und `quelltext` („$“, „##“) es tun. Dekor gehört in `aria-hidden`-taugliche Pseudo-Elemente, nie in den Inhalt.

---

## 11. Wunschliste und Grenzen

Heute stylen sich Karte, Zeitstrahl, Reisepass, Suche und Reise-Modus zum Teil in ihren eigenen JavaScript-Modulen (injizierte `<style>`-Blöcke). Skins erreichen sie über Tokens und über Selektoren mit Präfix; was sich darüber nicht lösen lässt, bleibt hässlich-neutral oder braucht zähe Überschreibungen.
Konkret fehlt:

- **Verlässliche Variablen für Ansichten.** Nur Einzelnes ist als Variable herausgeführt (`--gk-*`, `--zeit-bg`, `--rail-bg`, `--railw`; Abschnitt 5.7). Vorschlag: pro Ansicht eine kleine, **dokumentierte** Schnittstelle, die auf den Tokens aufbaut und mit Standardwerten startet:
  `--karte-bg`, `--karte-linienstaerke`, `--karte-halo`, `--zeit-bahn-hoehe`, `--pass-deckel-bg`, `--pass-stempel-form`, `--suche-panel-radius`, `--reise-schiene-breite`. Skins setzen sie dann in einem Block statt mit Selektorkämpfen.
- **Ansichts-Styles als Dateien.** Würden die CSS-Blöcke aus den Modulen in `engine/css/karte.css`, `zeitstrahl.css`, `reisepass.css`, `suche.css`, `reise.css` wandern und der Build sie vor die Skins stellen, gäbe es keinen Konflikt der Einfügereihenfolge, und Skins könnten sie gezielter überschreiben.
- **Beide Reisefarben-Varianten.** Der Build erzeugt nur `--j-<id>` (je Modus eine Variante). Für Skins mit hellem Eingang wären zusätzlich `--jl-<id>` und `--jd-<id>` (hell und dunkel, immer verfügbar) hilfreich, damit sie im hellen Eingang die hellen Reisefarben nehmen können (Abschnitt 6.2).
- **Skin-Prüfung, zweiter Teil.** `tools/check-skin.mjs` prüft Form und Selektoren (erledigt). Es fehlt noch eine Prüfung der Token-Blöcke auf Vollständigkeit und die Kontrastpaare aus Abschnitt 7 (die Hilfsfunktion `contrast` existiert in `tools/check-lib.mjs`).
- **Eigene Icons je Skin oder Paket.** `icons.js` hat keine Registrierung zur Laufzeit; ein `MUSEUM.icons.register(key, innerSvg)` würde Paketen und Skins erlauben, Icons mitzubringen.
- **Eingang.** `hero.js` zeichnet ein festes Neuronen-Feld. Skins blenden es aus oder lassen es; andere Motive (Raster, Sterne, Wellen) gäbe es nur als Alternative in `hero.js`.
- **Zeitstrahl-Epochen und Texte** sind Deutsch und fest (`docs/ARCHITEKTUR.md`, Abschnitt 8); Skins können sie nur ausblenden oder umformatieren.

---

## 12. Ideen für weitere Skins

Skizzen, nicht gebaut. Jede enthält Idee, Look und Karten-Optionen.

**Blaupause / technische Zeichnung** – Cyanotypie-Blau als Grund, weiße und hellblaue Linien, Millimeterraster als Hintergrund (Data-URI-SVG in `--grain`), Beschriftung in Versalien mit Schablonenschrift-Stack (z. B. „Share Tech“, „DIN“, Systemmonospace) und Maßpfeilen als Zierlinien.
Karten wie Planzeichnungen mit Schriftfeld (Titelblock) in der Ecke, Stationen als „Bauteile“ mit Positionsnummern. Netzplan `octilinear` / `shapes`: Linien exakt wie Konstruktionslinien, Haltepunkte als Symbole. `mode: "dark"` bietet sich an (Blaupause hat nur eine Seite); der Hellmodus wäre „Pauspapier“ (weiß mit blauen Linien).
Prüfen: Reisefarben auf sattem Blau haben es schwer; deshalb Reisefarben nur als Linie und Balken, Flächen in Weißtönen.

**Lehrtafel / Schulwandkarte** – Wie eine ausgezogene Wandtafel aus dem Klassenzimmer: Leinenpapier in Cremeweiß, kräftige Primärdruckfarben, Holzleiste oben und unten (Rand-Gradient), große Serifen-Überschrift („Caslon“-Anmutung), Stationen als nummerierte „Tafeln“ mit Lehrbuch-Kästen für Fakten.
Der Eingang ein Tafelkopf („Wandtafel Nr. 7“) mit Reisestreifen als Farbbalken. Netzplan `smooth` / `shapes`: weiche Linien wie auf Karten, Haltepunkte als Formen mit Legende. Hell zuerst, dunkel als „Kreidetafel“ (Schiefer, Kreideweiß, Pastell).
Prüfen: Cremeweiß und Reisefarben; Kreideton im Dunkelmodus mit genug Kontrast.

**Atlas / Kartografie** – Historischer Atlas: Pergamentgelb, Küstenlinien-Blau, Höhenlinien als Hintergrundmuster, Kompassrose als Eingangs-Signet (per CSS-Maske oder SVG im Skin-Ordner), Schrift als Antiqua mit Kapitälchen und Sperrung.
Reisen sind „Routen“ mit Längengrad-Skalen am Rand; Stationen heißen in der Beschriftung „Orte“ (über das Paket-`vocab`, nicht im Skin). Netzplan `smooth` / `icons`: geschwungene Routenlinien wie Handelswege, Icons als Kartensymbole.
Prüfen: Pergamentgelb gegen Reisefarben (Gelbtöne verschwinden), Höhenlinien nicht zu kontrastreich, damit der Text ruhig bleibt.

**Notizbuch** – Ein Skizzenbuch: gepunktetes oder kariertes Papier, Tinte, Textmarker-Akzente (Gelb als Unterstreichung statt Fläche), Washi-Tape-Streifen an den Kartenecken (Pseudo-Elemente), leicht gedrehte Karten (kleine `rotate`-Winkel, bei reduzierter Bewegung nur statisch), Handschrift-Stack („Segoe Print“, „Bradley Hand“, „Comic Sans MS“ nur als letzter Rückfall, besser eine ruhige Serif).
Fakten als Klebezettel, das Zitat als Randnotiz mit Pfeil. Netzplan `smooth` / `shapes`: Linien wie mit dem Stift gezogen, Haltepunkte als Kringel. Dunkel als „Notizbuch bei Lampenlicht“ (dunkles Papier, helle Stiftfarben).
Prüfen: Lesbarkeit der Handschrift-Stacks ist der Engpass; Fließtext bleibt in einer lesbaren Schrift, nur Überschriften und Randnotizen wirken handschriftlich.

**Neon-Nacht** – Stadt bei Nacht: fast schwarzer Grund, Leuchtschrift in Magenta, Cyan und Gelb, Ränder mit `box-shadow`-Glühen, Reisestreifen im Eingang als Leuchtröhren, Reisekarten als leuchtende Schilder.
`mode: "dark"` (ein Neon-Hell gibt es nicht). Netzplan `octilinear` / `icons`: Linien als Röhren mit Halo, Haltepunkte als Lampen. Das Glühen ist auf `prefers-reduced-motion` zu begrenzen (kein Flackern ohne Erlaubnis).
Prüfen: Fließtext ausschließlich in hellem, neutralem Weiß auf dunklem Grund (nie farbiger Leuchttext für Absätze), Glühen nicht auf Kosten der Lesbarkeit (Kontrast AA gilt unverändert), Fokusring in einer Farbe, die nicht im Glühen untergeht.
