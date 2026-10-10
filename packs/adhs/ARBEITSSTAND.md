# Arbeitsstand: ADHS verstehen (`packs/adhs`)

Diese Datei ist die Übergabe an den nächsten Agenten oder Menschen. Sie gehört zum Paket und wird nach **jedem Schritt** aktualisiert und mitcommittet.
Was nicht hier oder im Repository steht, ist nach einem Sitzungsabbruch verloren. Vorlage: `packs/_vorlage/ARBEITSSTAND.md`. Der Auftrag steht in `BRIEFING.md` (maschinenlesbar: `BRIEFING.json`).

**Stand:** 2026-10-10, Schritte 0 bis 3 und 2b erledigt (Plan, Anschauungsplan, journeys.js, pack.json); als Nächstes Schritt 4 (Stationen schreiben, Anschauung bauen). Plan als Annahme freigegeben (niemand erreichbar).

## Rahmen (Schritt 0, aus dem Onboarding)
- Zielgruppe und Vorwissen: Gemischt (leicht einsteigen, in der Tiefe anspruchsvoll)
- Ton und Ansprache: du-Anrede, Deutsch, warm und klar
- Umfang: nicht vorgegeben (Agent entscheidet). Größenordnung als Wunsch: Der Agent entscheidet. Geschichte als eigene Reise: Der Agent entscheidet
- Erlaubte Quellen: Offene, frei zugängliche Quellen
- Heikle Themen (und Umgang damit): Gesundheit, Sorgfaltsregeln in BRIEFING.md

## Annahmen
Alles, was nicht ausdrücklich vom Auftraggeber stammt. Jede Annahme mit Datum und Begründung, damit der Auftraggeber sie später bestätigen oder umwerfen kann.

| Datum | Annahme | Begründung | Bestätigt? |
|---|---|---|---|
| 2026-10-10 | **Annahme:** Impressum und Datenschutz (optional) = (kein Link) | Im Onboarding mit Enter übernommen, nicht ausdrücklich gewählt. | offen |
| 2026-10-10 | **Annahme:** Umfang (Zahl der Reisen und Stationen) entscheidet der Agent nach Thema und Zielgruppe | Das Onboarding fragt bewusst keine Zahlen ab; der Plan wird dem Auftraggeber zur Freigabe gezeigt. | offen |
| 2026-10-10 | **Annahme:** `eyebrow` („Ein vernetztes Museum“) und `tagline` stammen aus den Antworten | Der Agent darf sie schärfen. | offen |
| 2026-10-10 | **Annahme:** Der Fußhinweis in `pack.json` ist aus den Antworten zu „heikle Themen“ erzeugt (gesundheit) | Muss vor der Veröffentlichung gegengelesen werden; die Telefonseelsorge-Nummern gelten für Deutschland. | offen |
| 2026-10-10 | **Annahme:** Reisenamen: Vorschläge macht der Agent | Keine Vorgaben im Onboarding. | offen |

## Entscheidungen
- 5 Reisen, 53 Stationen, 12 Kreuzungen, 22 Stationen mit Abbildung oder Exponat (42 %): Was ist ADHS (13 Stationen), Gehirn (12), Alltag (13), Diagnose/Behandlung/Streit (14), historische Reise zur Diagnose (13). Die 5. Reise trägt, weil sich Namen und Kriterien (Still, DSM-II bis DSM-5, ICD-11, MTA, NICE) wirklich gewandelt haben; sie zeigt, dass Diagnosen Konventionen sind.
- Heimat: funktionale Reise, außer bei reinen Wendepunkten der Geschichte (Crichton, Still, Bradley, DSM-II/III/IV, DSM-5).
- Mythen (kind mythos): Zucker, Erziehung/Faulheit, Modediagnose, nur Kinder, „kaputtes Gehirn“, Superkraft, Ritalin.
- Bewusst nicht im Plan: Screening mit Auswertung, Dosierung, Empfehlungen für den Einzelfall. Exponate (klick-streuung, zehn-sekunden) zeigen nur, dass jeder Mensch schwankt, ohne Ergebnis.
- Jahre mit Prüfauftrag für den Faktencheck: 1798 Crichton, 1845 Struwwelpeter, 1902 Still, 1937 Bradley, 1968/1980/1987/1994 DSM, 1998 Neurodiversität (Singer, Blume), 1999 MTA (579 Kinder, 14 Monate, Search bestätigt), 2013 DSM-5, 2018 NICE NG87, 2021 Konsens (208 Aussagen, Faraone u. a., NBR 128), 2022 ICD-11 (Inkrafttreten noch zu prüfen). Die S3-Leitlinie (AWMF 028-045, derzeit Version 2.0): Jahr nicht belegt, im Text nur nennen, wenn geprüft.
- Offene Angaben vor Veröffentlichung: Impressum (Pflicht in Deutschland), Hilfsnummer im Fuß geprüft für Deutschland.

## Fortschritt je Reise
| Reise | Plan | Texte | Faktencheck (Stufe) | Bemerkung |
|---|---|---|---|---|
| | | | | |

Faktencheck-Stufen: **unabhängig geprüft** (anderer Agent oder Mensch, mit Quellen), **Selbstprüfung** (derselbe Agent im getrennten Durchgang mit Quellen), **Gedächtnis** (nicht belegt). Details: `docs/AGENTEN.md`, Schritt 5.

## Offen
- [x] Reisen und Plan (Schritt 1 und 2); Freigabe: offen (als Annahme)
- [x] Anschauung geplant (Schritt 2b, 22 Stationen); bauen offen, Mindestzahl 19
- [ ] Impressum/Datenschutz-Link klären (im Onboarding keiner angegeben)

## Bekannte Schwächen
-

## Wünsche an die Engine
Nur Verweise; Wünsche selbst stehen in `docs/ENGINE-WUENSCHE.md`.

## Nächste Schritte
1. `BRIEFING.md` lesen, dann `docs/AGENTEN.md` ab Schritt 1.
2. Plan zeigen (Freigabe) oder als Annahme festhalten, dann Stationen schreiben.
