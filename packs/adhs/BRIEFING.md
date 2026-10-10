# Auftrag: ADHS verstehen (`packs/adhs`)

Dieser Auftrag entstand am 2026-10-10 im Onboarding (Terminal: `node tools/onboarding.mjs`, Browser: `onboarding.html`). Er ersetzt **Schritt 0** von `docs/AGENTEN.md` (Rahmen klären): Die Fragen sind beantwortet, bitte nicht erneut stellen, sondern abarbeiten. Maschinenlesbar: `BRIEFING.json`.
Was als *Standardwert* gekennzeichnet ist, hat der Auftraggeber nicht ausdrücklich entschieden; halte es in `ARBEITSSTAND.md` als Annahme fest. Fehlt etwas ganz, entscheide vorsichtig und trage es als Annahme ein.
Gibt es `packs/adhs/` noch nicht, lege es an: `BRIEFING.json` im Repository-Stamm speichern und `node tools/onboarding.mjs --config=BRIEFING.json --yes` ausführen (legt das Paket mit **leerem Plan** an). Ohne Werkzeuge: `docs/ONBOARDING.md`, Abschnitt „Ohne Werkzeuge“.

## Thema

- **Name:** ADHS verstehen  (ID `adhs`)
- **Untertitel / Leitfrage:** Aufmerksamkeit, Alltag und was die Forschung weiß
- **Thema:** ADHS bei Kindern und Erwachsenen: wie das Gehirn Aufmerksamkeit steuert, wie sich ADHS im Alltag zeigt, was Forschung und Leitlinien zu Diagnose und Behandlung sagen, verbreitete Mythen und die Sicht der Neurodiversität. Bildung, keine Beratung und keine Diagnosehilfe.
- In `pack.json` sind `title`, `eyebrow`, `tagline` vorbefüllt; `eyebrow` darfst du schärfen.

## Zielgruppe, Sprache, Ton

- **Zielgruppe:** Gemischtes Publikum. Der Einstieg jeder Station ist für Laien verständlich (Szene, Bild), die Tiefe darunter trägt auch Fachleute; Fachwörter werden erklärt, aber nicht weggelassen.
- **Sprache der Inhalte:** Deutsch (`de`).
- **Anrede:** du. Durchgehend, auch in Intro, Outro, Teasern, Fuß. Ton: warm, klar, neugierig; kein Belehren.

## Umfang und Aufbau

- **Die Zahlen entscheidest du**, fachlich nach Thema und Zielgruppe (`docs/AGENTEN.md`, Schritt 1 und 2). Der Auftraggeber hat bewusst keine Anzahl von Reisen oder Stationen vorgegeben. Leitplanken des Frameworks: bis zu 16 Reisen (lieber wenige gute als viele dünne), je Reise 11 bis 28 Stationen, insgesamt höchstens rund 200 eindeutige Stationen; Kreuzungen müssen echt sein.
- **Größenordnung (Wunsch, unverbindlich):** keiner, der Agent entscheidet.
- **Geschichte als eigene Reise:** Der Agent entscheidet. Entscheide fachlich, ob eine historische Reise etwas beiträgt (nur wenn die Geschichte selbst etwas erklärt: Wendepunkte, Irrtümer; höchstens 3), und begründe die Entscheidung im Plan.
- **Freigabe vor dem Schreiben:** Zeige dem Auftraggeber zuerst den **Plan** (Reisen mit Leitfrage und Tagline, Stationen je Reise, Kreuzungen, geplante Anschauung, jeweils mit kurzer fachlicher Begründung) und schreibe erst Texte, wenn er ihn freigegeben hat. Antwortet niemand (autonomer Lauf), halte den Plan als Annahme in `ARBEITSSTAND.md` fest und arbeite weiter.
- **Gerüst:** Das Onboarding legt keine Stub-Reisen an. `plan.json` ist leer (`journeys:[]`, `stations:[]`, `orders:{}`), `check-pack` meldet „Plan noch leer“, bis du Schritt 1 und 2 erledigt hast. `limits` in `pack.json` stehen auf den Standardwerten (je Reise 11 bis 28 Stationen).

## Reisen

Keine Vorgaben: **mache Vorschläge** für die Reisen (jede als Frage oder Weg, mit Tagline) und lege sie im Plan zur Freigabe vor.

## Sorgfaltsregeln

- **Heikle Themen:** Gesundheit (Krankheit, Therapie, Psyche).
- Immer: Fakten belegbar halten (Zahlen, Jahre, Zitate nicht aus dem Gedächtnis), Zuschreibungen prüfen, Darstellung fair (AGENTEN.md, Regeln und „Typische Fehler“), Faktencheck in `FAKTENCHECK.md`. Nichts erfinden.
- **Gesundheit:**
  - Keine Diagnosen, keine Therapie- oder Dosierungsempfehlungen, keine Heilversprechen. Es wird erklärt, nicht beraten.
  - Studienaussagen mit Stichprobe, Jahr und Einschränkung nennen; Korrelation nicht als Ursache darstellen; populäre Irrtümer als Mythos-Station mit „Wahrheit“ behandeln.
  - Den Hinweistext im Fuß (`pack.json` `footer`) passend zum Inhalt formulieren bzw. die vorbereitete Fassung prüfen; vor der Veröffentlichung kontrollieren, ob die Hilfsnummer für das Zielland stimmt.
- **Hinweistext im Fuß** (`pack.json` `footer`): aus den heiklen Themen ableiten; vor der Veröffentlichung gegenlesen. Das Onboarding-Werkzeug bereitet ihn vor.

## Quellen

- Nur offene, frei zugängliche Quellen und eigene Formulierungen; nichts Fremdes kopieren, Weiterlesen-Hinweise nur auf real existierende Werke.
- Link-Regeln: nur geprüfte, öffentliche https-Links, Titel plus Link, nichts hineinkopieren (AGENTEN.md, Schritt 0).

## Look und Bau

- **Standard-Look:** Halle: Das heutige Aussehen des Museums: Museum bei Nacht, tiefes Tintenblau, warmes Licht. Referenz-Skin.
- **Umschaltung für Besucher:** ja, alle Looks einbinden. Bau: `node tools/build.mjs adhs --skins=all`.
- **Anschauung: Viel** (etwa 35 % der Stationen). Rechne nach dem Plan die **Mindestzahl** aus (Anteil mal Zahl eindeutiger Stationen, aufgerundet): so viele Stationen brauchen eine Abbildung oder ein Exponat (`pack.json` `limits.visualShare` = 0.35, `requireVisualPlan`: true). Jede Station bekommt in `plan.json` ein Feld `visual` (abbildung | exponat | keine mit Begründung); `docs/AGENTEN.md`, Schritt 2b „Anschauung planen“, und der Baukasten `MUSEUM.viz` (Muster: `packs/_vorlage/visuals/`). Je abstrakter eine Station, desto eher gehört eine Abbildung dazu.

## Lizenz, Credits, Rechtliches

- **Lizenz der Inhalte:** CC BY 4.0 (in `pack.json` `license` eingetragen; der Code von Museum Studio bleibt MIT). Es gelten nur freie Lizenzen; füge keine Inhalte mit unfreier Lizenz ein.
- **Credits:** Karl Hosang.
- **Impressum/Datenschutz:** kein Link angegeben (vor einer öffentlichen Veröffentlichung klären; in Deutschland ist ein Impressum Pflicht). Erfinde kein Impressum und keine Anschrift.

## Was der Agent liefern soll

Arbeite `docs/AGENTEN.md` ab Schritt 1 ab (Schritt 0 ist durch diesen Auftrag erledigt) und committe nach jedem Schritt.

- [ ] Plan (Schritt 1 und 2): Reisen mit Namen, Tagline, Intro, Outro, Icon, Farben in `journeys.js`; Stationen, Kreuzungen und Reihenfolgen in `plan.json` (Netz zusammenhängend, Umfang nach Thema und Zielgruppe entschieden und begründet); `node tools/check-plan.mjs adhs` grün
- [ ] **Plan dem Auftraggeber zur Freigabe zeigen, bevor Stationstexte entstehen** (oder, wenn niemand antwortet, als Annahme in `ARBEITSSTAND.md` festhalten)
- [ ] Stationstexte in `stationen/*.js` (90 bis 200 Wörter, Teaser, Fakten, `cross` je andere Reise; `node tools/check-data.mjs adhs <datei>` je Datei grün)
- [ ] Anschauung geplant (`visual` bei JEDER Station in `plan.json`) und gebaut: Mindestzahl siehe oben, sonst bewusst verschoben und in `ARBEITSSTAND.md` dokumentiert; `check-pack` zeigt „Anschauung: X geplant, Y gebaut“
- [ ] `pack.json` geprüft: alle Platzhalter weg, Fußhinweise passen zum Inhalt
- [ ] Sorgfaltsregeln zu den heiklen Themen eingehalten und im Abschlussbericht ausdrücklich bestätigt (welche Positionen/Aspekte fehlen bewusst?)
- [ ] Faktencheck durchgeführt und in `FAKTENCHECK.md` festgehalten (Stufe je Reise ehrlich angeben: unabhängig, Selbstprüfung, Gedächtnis)
- [ ] Layout berechnet: `node tools/layout-map.mjs adhs`
- [ ] Gesamtprüfung grün: `node tools/check-pack.mjs adhs`
- [ ] Gebaut: `node tools/build.mjs adhs --skins=all` (Ergebnis in `dist/adhs/index.html`); wenn Playwright vorhanden ist: `npm run smoke -- adhs --quick`
- [ ] `ARBEITSSTAND.md` aktuell (Rahmen, Annahmen mit „Bestätigt: offen“, Entscheidungen, Fortschritt, Offenes, bekannte Schwächen)
- [ ] Abschlussbericht: was steht, was ist geprüft, welche Annahmen den Inhalt stark lenken, was bewusst fehlt
