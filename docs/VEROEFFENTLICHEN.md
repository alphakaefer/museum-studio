# Veröffentlichen

Ein fertiges Museum ist eine rein statische Seite (`dist/<paket>/`): Sie braucht nur einen Webspace, keine Datenbank, kein PHP. Drei Wege.

**Vorher:** `node tools/check-pack.mjs <paket>` muss grün sein. **Impressum und Datenschutz:** Öffentliche Seiten in Deutschland brauchen ein Impressum. Es gehört in `pack.json` unter `footer` (zum Beispiel als Spalte „Rechtliches“ mit einem Link) oder, wenn es nicht im öffentlichen Repository stehen soll, in `packs/<paket>/pack.local.json` (wird beim Bauen eingemischt und ist per `.gitignore` vom Repository ausgeschlossen). Erfinde kein Impressum und keine Anschrift.

## a) GitHub Pages ohne Terminal

Die Datei `.github/workflows/pages.yml` baut bei jedem Push auf `main` alle Pakete unter `packs/` (Namen, die mit `_` beginnen, werden ausgelassen) mit `--skins=all`, erzeugt eine Übersichtsseite (`tools/build-index.mjs`) und veröffentlicht alles über GitHub Pages. Adresse danach: `https://<konto>.github.io/<repository>/` (Übersicht) und `…/<paket>/` (ein Museum).

Einmalig im eigenen Repository:
1. **Eigene Kopie anlegen:** auf der Repository-Seite „Use this template“ → „Create a new repository“ (setzt voraus, dass der Eigentümer des Originals das Repository als Vorlage freigegeben hat, siehe unten). Alternativ „Fork“.
2. **Einstellungen → Pages → Build and deployment → Source: „GitHub Actions“.**
3. Das fertige Paket (`packs/<id>/`) hochladen oder von der KI committen lassen, auf `main` pushen. Der Reiter „Actions“ zeigt den Fortschritt; nach ein bis zwei Minuten ist die Seite da.

Hinweise: Pakete in `.gitignore` (zum Beispiel `packs/gehirn/`) und `pack.local.json` kommen nicht ins Repository und damit auch nicht auf Pages. Ein Impressum muss also in `pack.json` `footer` stehen. Das Repository (und damit die Seite) ist bei kostenlosen Konten öffentlich.

**To-do für den Eigentümer des Originals (`alphakaefer/museum-studio`):** In *Settings → General* den Haken **„Template repository“** setzen, damit „Use this template“ erscheint. Für das eigene Original zusätzlich *Settings → Pages → Source: GitHub Actions*.

## b) Eigener Webspace per rsync/SSH

```bash
node tools/build.mjs <paket> --skins=all
rsync -avz --delete dist/<paket>/ benutzer@server.example:/pfad/zum/webroot/<paket>/
```
Das Impressum der eigenen Domain steht in `packs/<paket>/pack.local.json` (nicht im Repository), zum Beispiel:
```json
{ "footer": { "columns": [ { "title": "Rechtliches", "paragraphs": ["[Impressum und Datenschutz](https://www.beispiel.de/impressum)"] } ] } }
```
Gebaut wird danach wie oben; die Meldung „pack.local.json eingemischt“ bestätigt es.

## c) Beliebiger Webspace per Upload

1. `node tools/build.mjs <paket> --skins=all` (oder die KI bauen lassen).
2. Den **gesamten Ordner `dist/<paket>/`** per FTP oder Dateimanager des Anbieters in einen Ordner des Webspace hochladen (der Inhalt von `dist/<paket>/`, mit `index.html` obenauf).
3. Die Adresse des Ordners aufrufen. Es sind nur statische Dateien, kein Server-Programm nötig; ein Doppelklick auf `index.html` funktioniert auch lokal.
