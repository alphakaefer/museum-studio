# AGENTS.md – Anweisungen für KI-Agenten

Dieses Repository ist **Museum Studio**: ein freies Framework (Code MIT, Beispielinhalte CC BY 4.0), das ein vernetztes Wissensgebiet als begehbares Museum zeigt.
Besucher gehen **Reisen** (wie U-Bahn-Linien) durch **Stationen** (kleine Lektionen); wo eine Station auf mehreren Reisen liegt, kann man umsteigen. Inhalte liegen in **Paketen** unter `packs/<id>/`, die Engine (`engine/`) und die Looks (`themes/`) bleiben unverändert.
Lies bei Bedarf `README.md`. Anleitung zum Befüllen: `docs/AGENTEN.md`.

## Wenn jemand ein neues Museum bauen will

Dann führst **du** das Onboarding als freundlichen Dialog. Die Person ist meist Laie und hat kein Terminal geöffnet; **du führst die Befehle selbst aus**.

### 1. Dialog führen
- Einfaches Deutsch, kein Fachjargon (nicht „Skin“, „Paket-ID“, „Engine“ sagen, sondern „Aussehen“, „technischer Name“ …). Kurze Blöcke, höchstens drei bis vier Fragen auf einmal.
- Zu jeder Frage einen **Vorschlag nennen**, den man mit „passt“ übernehmen kann. Frage **nie nach Zahlen** (Anzahl Reisen oder Stationen): Das entscheidest du fachlich nach Thema und Zielgruppe.
- Die Fragen, Standardwerte und Prüfregeln stehen in `tools/onboarding-fragen.json` (einzige Quelle). Lies die Datei und stelle genau diese Fragen, in diesen Blöcken:
  1. **Worum geht es?** Museumsname (kurz, etwa bis 24 Zeichen), technischer Name (ID; schlage ihn aus dem Namen vor), Untertitel oder Leitfrage, Thema in ein bis zwei Sätzen.
  2. **Für wen?** Zielgruppe (Laien, Studierende, Fachleute, gemischt), Sprache, Anrede (du/Sie).
  3. **Aufbau:** „Soll die Geschichte des Fachs eine eigene Reise bekommen?“ (Ja / Der Agent entscheidet / Nein), Größenordnung als bloßer Wunsch (kompakt / mittel / umfassend / Agent entscheidet), optional Reisenamen oder Themenideen.
  4. **Aussehen und Anschauung:** Look (aus `themes/`), Umschaltung für Besucher, wie wichtig Anschauung ist (zentral / viel / etwas / wenig).
  5. **Sorgfalt und Quellen:** heikle Themen (Gesundheit, Politik/Weltanschauung, Religion, Gewalt/Trauma oder keine), Quellenregeln (offene Quellen, eigene Texte des Auftraggebers, eigene Domain für Weiterlesen-Links, mit Nachfrage nach der Adresse).
  6. **Urheber, Lizenz, Impressum:** Urheber/Credits, Lizenz, Impressums-Link (optional).
- **Lizenz: nur freie Lizenzen** anbieten, jeweils mit einem Satz: CC BY 4.0 (Standard; frei nutzbar mit Namensnennung), CC BY-SA 4.0 (wie CC BY, Bearbeitungen unter derselben Lizenz), CC0 1.0 (gemeinfrei gewidmet). „Alle Rechte vorbehalten“ oder andere unfreie Lizenzen gehen nicht; erkläre das freundlich.
- Fasse am Ende alle Antworten in einer kurzen Liste zusammen und frage „Passt das?“.

### 2. Paket anlegen (selbst ausführen)
1. Schreibe die Antworten als JSON-Datei (Felder wie in `tools/onboarding-fragen.json`, Beispiel: `docs/ONBOARDING.md`), zum Beispiel nach `/tmp/museum-antworten.json` oder `BRIEFING.json` im Repository-Stamm.
2. Probelauf: `node tools/onboarding.mjs --config=<datei> --dry-run`. Wird ein Wert abgelehnt (zum Beispiel vergebene ID, unfreie Lizenz), erkläre es der Person und frage neu.
3. Anlegen: `node tools/onboarding.mjs --config=<datei> --yes`. Das erzeugt `packs/<id>/` mit `pack.json`, leerem `plan.json`, `BRIEFING.md`, `BRIEFING.json`, `ARBEITSSTAND.md`. Es überschreibt nie ein bestehendes Paket.
4. Sage der Person, wo das Paket liegt (vollständiger Pfad), dass es noch leer ist und wie es weitergeht.

### 3. Danach arbeiten
- Lies `packs/<id>/BRIEFING.md` (das ist der Auftrag; Schritt 0 von `docs/AGENTEN.md` ist damit erledigt) und arbeite `docs/AGENTEN.md` ab Schritt 1 ab.
- **Plan zur Freigabe:** Entscheide Zahl und Zuschnitt der Reisen und Stationen fachlich nach Thema und Zielgruppe und zeige der Person den **Plan** (Reisen mit Leitfrage, Stationen, Kreuzungen, geplante Anschauung, kurze Begründung). **Schreibe erst Texte, wenn der Plan freigegeben ist.**
- Prüfen und bauen: `node tools/check-pack.mjs <id>`, `node tools/layout-map.mjs <id>`, `node tools/build.mjs <id> --skins=all`. Ergebnis: `dist/<id>/index.html` (Doppelklick genügt). Veröffentlichen: `docs/VEROEFFENTLICHEN.md`.
- Committe nach jedem Schritt, halte `ARBEITSSTAND.md` aktuell, benenne Annahmen offen.

### Wenn du keine Befehle ausführen kannst (reiner Chat)
Führe den Dialog trotzdem. Dann lege die Dateien **von Hand** an, nach der Beschreibung in `docs/ONBOARDING.md`, Abschnitt „Ohne Werkzeuge“: Liefere den Inhalt jeder Datei als **eigenen Codeblock mit dem Zielpfad** darüber (`packs/<id>/pack.json`, `plan.json`, `journeys.js`, `BRIEFING.md`, später `stationen/*.js`) und erkläre in einem Satz, dass die Person sie in diesen Ordner legen soll. Auch hier: erst den Plan zeigen, nach Freigabe die Texte liefern.
Wer keinen Zugriff auf das Repository hat, kann stattdessen `onboarding.html` im Browser öffnen und den dort erzeugten Prompt einfügen.

## Regeln (immer)
- **Engine (`engine/`) und Looks (`themes/`) nicht anfassen.** Wünsche an die Engine nur in `docs/ENGINE-WUENSCHE.md` notieren.
- **Nichts erfinden:** keine Personen, Jahre, Zahlen, Studien, Zitate, Links; Unsicheres weglassen oder kennzeichnen. Mehrere Positionen fair darstellen.
- **Nur freie Lizenzen** (CC BY 4.0, CC BY-SA 4.0, CC0 1.0); nichts Fremdes kopieren.
- **Kein Impressum und keine Anschrift erfinden.** Impressum/Datenschutz gehören in `pack.json` `footer` oder (nicht im Repo) `packs/<id>/pack.local.json`; öffentliche Seiten in Deutschland brauchen eines.
- Keine Tracker, keine externen Abrufe in den Seiten. Bestehende Pakete nie überschreiben.
- Alle Details und Qualitätstore: `docs/AGENTEN.md`.
