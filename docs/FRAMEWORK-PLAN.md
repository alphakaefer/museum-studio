# Museum Studio – Bauplan (verbindlich für alle, die daran arbeiten)

Arbeitsname **Museum Studio**: ein Framework, das ein vernetztes Wissensgebiet als begehbares Museum darstellt.
**Reisen** (wie U-Bahn-Linien) führen durch **Stationen** (kleine Lektionen). Wo eine Station zu mehreren Reisen gehört,
kann man **umsteigen**. Entstanden aus dem Gehirnmuseum (Psychologie, Neurobiologie, Philosophie des Geistes).
Das Gehirnmuseum bleibt das Referenz-Paket; das Framework muss auch Organisationsentwicklung, Quantenphysik, Kosmologie,
Spieltheorie, Zukunftsforschung usw. tragen, ohne dass jemand Engine-Code anfassen muss.

## Grundsätze (unverändert aus dem Gehirnmuseum)
Statische Seite, kein Frontend-Framework, keine externen Requests (DSGVO), klassische `<script>`-Tags (läuft per Doppelklick
über `file://`), Namespace `window.MUSEUM`, localStorage nur mit Präfix `gm:`, hell/dunkel, Handy bis Desktop.
Neu: ein kleiner Node-Zusammenbau (`tools/build.mjs`) erzeugt aus Engine + Paket + Skin eine fertige statische Seite in `dist/<paket>/`.
Der Zusammenbau braucht nur Node (keine npm-Abhängigkeiten).

## Verzeichnisse
```
engine/js/*.js, engine/css/*.css   Alles, was für JEDES Wissensgebiet gilt. Kein Fachbezug, keine Reise-IDs, keine Fachtexte.
themes/<id>/theme.css, theme.json  Skins (Themes): Aussehen. Austauschbar je Paket und zur Laufzeit umschaltbar.
packs/<id>/                        Ein Wissensgebiet (Inhalt). Siehe unten.
tools/                             build.mjs, new-pack.mjs, derive-pack.mjs, check-*.mjs, layout-map.mjs
docs/                              Dokumentation (ARCHITEKTUR, AGENTEN, DESIGNER, INHALT-SCHREIBEN, ENGINE-WUENSCHE)
dist/                              Ausgabe (nicht im Repo)
```

## Paketformat `packs/<id>/`
| Datei | Zweck |
|---|---|
| `pack.json` | Metadaten und Wortschatz (unten) |
| `plan.json` | Stationsplan: `journeys[{id,typ,name}]`, `stations[{id,title,kind,journeys[],year?,exhibit?,why}]`, `orders{journeyId:[stationIds]}` (Wahrheit für Reihenfolge und Kreuzungen) |
| `journeys.js` | Reise-Daten (Name, Kurzname, Tagline, Intro, Outro, Icon, **`color:{light,dark}`**) |
| `stationen/*.js` | Stationstexte, `MUSEUM.addStations({...})` (Schema in docs/ARCHITEKTUR.md) |
| `material.js` | optional: Verweise auf weiterführende Quellen je Station (nur Titel + Link) |
| `exhibits/*.js`, `visuals/*.js` | optional: interaktive Exponate und Abbildungen je Station |
| `layout.js` | erzeugt: Netzplan-Layout (`node tools/layout-map.mjs <paket>`) |
| `quellen.txt` | optional: erlaubte Links (Prüfskript `check-data` verwirft andere) |

`pack.json` (alle Texte, die bisher fest im Code standen, gehören hierher; Engine hat deutsche Standardwerte als Rückfall):
`id`, `title` (Museumsname), `eyebrow` (Zeile über dem Titel), `tagline` (Untertitel der Eingangshalle), `lang`, `defaultSkin`,
`vocab` (`journey`/`journeys`/`station`/`stations`/`interchange`/`passport`/`grandTour` … Einzahl und Mehrzahl),
`journeyTypes` (`{funktional:'…', historisch:'…'}`; Reisen mit `typ:'historisch'` und Jahreszahlen erscheinen im Zeitstrahl, **keine fest eingebauten Reise-IDs**),
`kinds` (optional: Beschriftungen der Stationsarten), `footer` (Hinweis/Disclaimer-HTML-frei), `license`, `credits`, `exhibits` (IDs),
`limits` (optional: Mindest-/Höchstzahl Stationen je Reise für die Prüfung, Standard 11–28).

## Skins (Themes)
`themes/<id>/theme.css`: alle Regeln hinter `html[data-skin="<id>"]` (Tokens aus engine/css/engine.css überschreiben, plus Struktur-CSS).
`themes/<id>/theme.json`: `{ id, name, description, fonts:[], map:{ lines:'octilinear'|'smooth', nodes:'icons'|'shapes' }, mode:'both'|'light'|'dark' }`.
Der Build bindet alle gewünschten Skins ein (`--skins=all` oder Liste); die Engine setzt `data-skin`, merkt sich die Wahl in `gm:skin`
und zeigt eine Umschaltung (nur wenn mehr als ein Skin eingebunden ist). Jeder Skin muss hell UND dunkel (`data-theme`) bestehen,
außer `mode` sagt etwas anderes. Mitgelieferte Skins: `halle` (heutiges Aussehen, Standard), `kabinett` (organisch, historisch),
`ma` (Zen/Bauhaus, funktional), `quelltext` (Computer-Code). Referenz für die Anmutung: der veröffentlichte Entwurf „Themenproben“ in docs/themenproben.html.
Fonts: nur Systemschriften-Stacks (keine Google-Fonts-Abrufe in der Seite); Wunschschrift als erste Wahl im Stack, Systemschrift als Rückfall.

## Engine-Anforderungen (Pflichtenheft für den Umbau)
1. Keine Reise-IDs, Stationen-IDs oder Fachtexte in `engine/`. Alles Fachliche kommt aus Paket, Daten oder CSS-Tokens.
2. Reisefarben aus `journeys.js` (`color`), vom Build als `--j-<id>` in eine erzeugte CSS-Datei geschrieben (nicht mehr in engine.css).
3. Zeitstrahl: Bahnen = Reisen mit `typ:'historisch'` (Reihenfolge wie in `journeys.js`); ohne solche Reisen wird der Zeitstrahl-Tab ausgeblendet.
4. Netzplan-Layout nur aus `MUSEUM.mapLayout` (aus `layout.js`); ohne Layout rechnet die Engine das Kräfte-Layout (vorhandener Rückfall).
5. Hero (Eingang): Farben aus den Reisen, Texte aus `pack.json`.
6. Alle sichtbaren Wörter wie „Reise“, „Station“, „Umsteigen“, „Reisepass“, „Große Rundreise“ laufen über `MUSEUM.t('schlüssel')` mit deutschen Standardwerten; Pakete überschreiben über `vocab`.
   (Vollständige Mehrsprachigkeit ist NICHT Ziel dieser Stufe, aber die Tür muss offen sein: eine zweite Sprache soll nur Daten + `vocab` brauchen, ein Rest fester Texte ist dokumentiert.)
7. Exponate, Abbildungen, Material sind optional; fehlt etwas, bleibt die Seite voll funktionsfähig.
8. Regression: `node tools/build.mjs gehirn --skins=halle` muss dasselbe Museum erzeugen wie das heutige (205 Stationen, 16 Reisen, 118 Kreuzungen, keine Konsolenfehler, alle Ansichten wie zuvor).

## Qualitätstore (Befehle, die grün sein müssen)
`node tools/check-pack.mjs <paket>` (fasst check-plan, check-data, check-material zusammen), `node tools/build.mjs <paket>`, Playwright-Rauchtest
(`tools/smoke.mjs <paket>`: alle Ansichten, Desktop/Tablet/Handy, hell/dunkel, jeder Skin, keine Konsolenfehler, kein horizontales Scrollen).
