# Zwei Testthemen: Tschechisch A1–A2 und ADHS

Dieses Dokument bereitet zwei neue Museen vor und sagt ehrlich, was vom Spielplan (einer in Entwicklung befindlichen Mechanik für Freischalten, Rhythmus und Fortschritt) dafür schon nutzbar ist.
Stand: 9. Oktober 2026.

## So startest du (ohne Terminal-Fragen, mit fertigen Antworten)

Die Antworten für beide Themen liegen als Konfiguration in `docs/beispiele/`. Mit Terminal:

```bash
git clone https://github.com/alphakaefer/museum-studio.git && cd museum-studio
npm run setup -- --config=docs/beispiele/tschechisch.json --dry-run   # Probelauf, legt nichts an
npm run setup -- --config=docs/beispiele/tschechisch.json --yes       # legt packs/tschechisch/ an
npm run setup -- --config=docs/beispiele/adhs.json --yes              # legt packs/adhs/ an
```

Das Onboarding schreibt je Paket `BRIEFING.md` (der Auftrag) und `ARBEITSSTAND.md` und druckt am Ende einen Prompt. Diesen Prompt gibst du einer KI im Ordner `museum-studio` (Claude Code, Codex, Gemini, Cursor …).
Sie plant zuerst Reisen und Stationen und zeigt dir den **Plan zur Freigabe**, ehe Texte entstehen (`docs/AGENTEN.md`). Ohne Terminal: `onboarding.html` per Doppelklick öffnen und die Werte aus den beiden Dateien übernehmen, oder einer KI sagen „Lies AGENTS.md und baue ein Museum zu …“.
Anpassen kannst du alles in den JSON-Dateien (Zielgruppe, Skin, Anschauung, heikle Themen).

## Wie viel vom Spielplan ist schon nutzbar?

**Kurz: für die Laufzeit noch nichts, als Planungsrahmen schon einiges.**

- Der Spielplan ist ein Prototyp außerhalb dieses Repos. Berechnung und Prüfung der Regeln sind gebaut und getestet, die Anbindung an die Oberfläche des Museums (Gesperrtes angedeutet, Enthüllung im Moment, eine nächste Aufgabe im Eingang) ist **nicht fertig** und nicht in `museum-studio`. Ein neues Paket kann den Spielplan heute also nicht einschalten.
- Was du heute schon bekommst, sind die Bausteine des Frameworks: Reisen, Stationen, Reisepass mit Stempeln, Abbildungen und Exponate (`MUSEUM.viz`). Das reicht für beide Themen als „Lernmuseum ohne Freischalten“.
- Als **Gedankengerüst** lässt sich der Spielplan schon in der Planung nutzen. Bitte die KI im Arbeitsstand der Pakete (`packs/<id>/ARBEITSSTAND.md`) je Reise festhalten: eine Etappe (Entdecken, Onboarding, Aufbau, Endspiel), die Fähigkeiten als „Ich kann …“-Sätze, was kritisch, wesentlich oder optional ist, und welche Stationen man später wiedersehen sollte. Das kostet nichts und lässt sich später in einen Spielplan überführen.

| Baustein | Tschechisch A1–A2 | ADHS | Heute im Framework? |
|---|---|---|---|
| Etappen je Reise (Heldenreise) | gut: vom ersten Satz zum Alltagsgespräch | gut: vom Verstehen zum eigenen Alltag | nur als Reihenfolge der Reisen |
| Fähigkeiten „Ich kann …“ | sehr gut: die Kannbeschreibungen A1 und A2 des Referenzrahmens sind genau das | vorsichtig: Verstehen und Einordnen ja, kein „Ich kann meine ADHS regeln“ | nur im Text und im Arbeitsstand |
| Gewicht (kritisch, wesentlich, optional) | sehr gut: Kernwortschatz gegen Randvokabeln | gut: Kernbefunde gegen Vertiefung | nur im Plan notiert |
| Wiedersehen nach Abständen (Karteikarten) | sehr gut: Wörter und Satzmuster brauchen Wiederholung | nur sparsam | ein eigenes Exponat (Karteikasten im Browser) wäre ohne Spielplan möglich |
| Freischalten, Enthüllung, nächste Aufgabe | möglich, aber für Lernende am Anfang eher hinderlich | nur mit „Freiem Zugang“ | nein |
| Pausen kosten nichts, keine Serien | wichtig für Lernmotivation | besonders wichtig | gilt schon: das Museum zählt keine Serien |

## Was bei den Themen besonders zu beachten ist

### Tschechisch A1–A2
- **Üben statt lesen.** Sprachenlernen lebt von Übung. Die Anschauung ist auf „zentral“ gestellt (etwa die Hälfte der Stationen mit Abbildung oder Exponat). Denkbar sind Karteikarten mit Wiederholungsabständen, Lückentexte, Zuordnung, Satzbau per Antippen und Aussprachehilfen.
- **Hören und Sprechen.** Ohne externe Abrufe und ohne Audiodateien bleibt nur die Sprachausgabe des Browsers (Web Speech API). Ob eine tschechische Stimme da ist, hängt vom Gerät ab. Das muss getestet und im Museum als „kann fehlen“ gekennzeichnet werden. Eigene Audioaufnahmen wären möglich, brauchen aber Sprecherinnen oder Sprecher und Rechte.
- **Zeichen.** Die tschechischen Buchstaben (ř, ů, ě, č, š, ž, ď, ť, ň) müssen in allen vier Skins sichtbar sein; die Systemschriften decken sie ab, das sollte der Rauchtest trotzdem prüfen.
- **Fachliche Prüfung.** Beispielsätze, Beugung und Aussprachehinweise lassen sich mit Websuche nur teilweise prüfen. Ehrlicher ist: Faktencheck-Stufe „Selbstprüfung“ angeben und eine Muttersprachlerin oder einen Muttersprachler gegenlesen lassen, bevor das Museum öffentlich geht.
- **Maßstab.** Der Rahmen sind die Kannbeschreibungen des Gemeinsamen europäischen Referenzrahmens für A1 und A2 (Europarat). Reisen entlang solcher Kompetenzen (sich vorstellen, einkaufen, Orientierung, Essen bestellen, Termine) sind didaktisch klarer als nach Grammatik sortierte.
- **Offene Frage für den Test:** Gehört eine Reise „Wie lerne ich?“ (Wiederholen, Aussprache, Lernstrategien) dazu? Sie wäre ein natürlicher Ort für das Wiedersehen.

### ADHS
- **Heikles Thema (Gesundheit).** Bildung, keine Beratung, keine Diagnosehilfe, keine Behandlungsempfehlung für den Einzelfall. Exponate dürfen nichts diagnostizieren (kein Screening-Fragebogen mit Auswertung). Im Fuß steht ein Hinweis auf Hilfsangebote; die Telefonseelsorge-Nummern gelten nur für Deutschland.
- **Fair darstellen.** Zwischen dem medizinischen Modell und der Sicht der Neurodiversität, bei Diagnosehäufigkeit, Medikation und Ursachen gibt es echte Meinungsverschiedenheiten. Alle Positionen mit Stärken und Schwächen nennen, nichts als Wahrheit setzen, Mythen als solche kennzeichnen (z. B. „ADHS kommt von falscher Erziehung“).
- **Quellenlage.** Verlässlich sind Leitlinien (in Deutschland die S3-Leitlinie), die diagnostischen Handbücher (ICD-11, DSM-5-TR) und Übersichtsarbeiten. Der Faktencheck muss hier „unabhängig geprüft“ erreichen, nicht „aus dem Gedächtnis“.
- **Zielgruppe und Ton.** Betroffene, Angehörige und Lehrkräfte brauchen verschiedene Töne. Das Onboarding steht auf „gemischt“; die KI sollte im Plan sagen, ob sie Reisen nach Zielgruppe teilt. Stigmatisierende Sprache vermeiden.
- **Spielmechanik mit Vorsicht.** Eine Aufgabe statt einer Liste, keine Serien, Pausen kostenlos und ein Freier Zugang passen gut zu einem aufmerksamkeitsfreundlichen Museum. Zwang, Wartezeiten und Belohnungsdruck können dagegen das Gegenteil bewirken. Falls der Spielplan später auf dieses Paket angewendet wird: Freier Zugang als Standard, nicht als Ausnahme.
- **Anschauung.** Auf „viel“ gestellt. Gute Kandidaten: wie Aufmerksamkeit und Arbeitsgedächtnis zusammenspielen, Zeitwahrnehmung, Ablenkung und Reize, Tagesabläufe. Immer als Veranschaulichung kennzeichnen, nie als Test der Besucherin oder des Besuchers.

## Vorschläge für den Plan (ungeprüft, der Agent entscheidet)

Diese Reisenideen sind Anregungen für das Gespräch mit dem Agenten, keine Vorgabe.

- **Tschechisch:** Ankommen und Aussprache · Sich vorstellen und Grundlagen des Gesprächs · Alltag (Einkaufen, Essen, Wege, Zeit) · Grammatik-Kern A1 bis A2 (Verb být, Geschlecht, die ersten Fälle) · Wie lerne ich? (Wiederholen, Hören, Strategien).
- **ADHS:** Was ist ADHS? (Kriterien, Formen) · Gehirn und Aufmerksamkeit (Forschungsstand, Grenzen) · Alltag in Schule, Beruf und Beziehungen · Diagnose und Behandlung (Leitlinie, Alternativen, Streit) · Mythen und Missverständnisse · Geschichte der Diagnose (eine historische Reise mit Zeitstrahl, falls der Agent sie trägt).

## Was wir mitnehmen sollten (für die nächste Runde)

- Das Spielplan-Prototyp bleibt pausiert, bis klar ist, welche Teile für Sprachenlernen und für ein sensibles Thema wie ADHS tragen. Beide Pakete sind ein guter Test, ob „Freischalten“ überhaupt gewollt ist oder ob Wiederholen und Freier Zugang genügen.
- Beim Test bitte notieren: Welche Frage im Onboarding war unklar? Hat der Plan deine Erwartung getroffen? Hat der Agent die Anschauungsquote erreicht? Wo fehlt ein Baustein in `MUSEUM.viz` (z. B. Karteikasten, Lückentext)? Das gehört in `docs/ENGINE-WUENSCHE.md`.
