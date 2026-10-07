// Stationen der Reise „kooperation“ (Heimat-Reise). Schema: docs/INHALT-SCHREIBEN.md.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'oeffentliche-gueter': {
  id: 'oeffentliche-gueter',
  title: 'Trittbrettfahrer: Das Dilemma mit vielen',
  kind: 'konzept',
  journeys: ['kooperation'],
  icon: 'group',
  teaser: 'Alle profitieren vom gemeinsamen Topf, jeder spart sich gern seinen Beitrag. Im Labor lässt sich das nachspielen.',
  text: [
    'Ein Gedankenspiel: Vier Personen bekommen je 20 Euro. Jede kann beliebig viel in einen gemeinsamen Topf einzahlen, der Topf wird verdoppelt und gleichmäßig verteilt. Für die Gruppe lohnt sich jeder Euro: Er wird zu zwei. Für dich allein bringt er nur 50 Cent zurück. Egoistisch betrachtet ist Einzahlen ein Verlust, also zahlt der „Rechner“ nichts ein, und genau das tun alle: Das Gefangenendilemma für Gruppen.',
    'Im Labor sieht man ein anderes Bild. Viele zahlen zu Beginn erhebliche Beträge ein, doch bei Wiederholungen sinken die Beiträge, auch weil viele nur geben wollen, wenn die anderen es ebenfalls tun. Ernst Fehr und Simon Gächter zeigten 2000, dass die Beiträge hoch bleiben, wenn Teilnehmer Trittbrettfahrer gegen eigene Kosten bestrafen dürfen. Viele tun das, obwohl es ihnen nichts bringt.',
    'Dieselbe Struktur steckt in Steuern, Klimaschutz und Gruppenarbeiten. Ob Strafen der beste Weg ist, bleibt umstritten.'
  ],
  facts: [
    'In vielen Versuchen sinken die Beiträge bei Wiederholung des Spiels (Überblick: Ledyard, 1995).',
    'Fehr und Gächter (American Economic Review, 2000): Mit Bestrafungsmöglichkeit blieben die Beiträge hoch.',
    'Im Beispiel bringt jeder eingezahlte Euro der Gruppe 2 Euro, dem Einzahler selbst nur 0,50 Euro.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Fehr, E. & Gächter, S. (2000). Cooperation and Punishment in Public Goods Experiments. American Economic Review, 90(4), 980–994.']
},

'allmende-tragoedie': {
  id: 'allmende-tragoedie',
  title: 'Die Tragödie der Allmende: Hardin 1968',
  kind: 'ereignis',
  journeys: ['kooperation', 'geschichte'],
  year: 1968,
  yearLabel: '1968',
  icon: 'tree',
  teaser: 'Eine Weide für alle wird überweidet, weil jeder an sich denkt. Ein Aufsatz machte das zum Sinnbild.',
  text: [
    'Auf einer Gemeindewiese darf jeder Hirte Vieh weiden lassen. Eine zusätzliche Kuh bringt dem Besitzer den vollen Gewinn, die Schäden der Überweidung tragen aber alle. Also stellt jeder noch eine Kuh dazu, bis die Wiese kahl ist. Garrett Hardin machte dieses Bild 1968 in der Zeitschrift „Science“ unter dem Titel „The Tragedy of the Commons“ berühmt, anknüpfend an einen Gedanken von William Forster Lloyd (1833).',
    'Hardin zog daraus weitreichende Schlüsse, unter anderem zur Bevölkerungspolitik und zu „gegenseitigem Zwang, gegenseitig vereinbart“. Der Aufsatz prägte die Umweltdebatte, wurde aber auch scharf kritisiert. Sein Beispiel beschreibt eine Wiese, auf die jeder ohne Regeln zugreift, und eine solche offen zugängliche Ressource ist etwas anderes als eine von einer Gemeinschaft verwaltete Allmende. Hardin räumte das später ein.',
    'Gerade diese Unterscheidung wurde zum Ausgangspunkt von Elinor Ostroms Forschung.'
  ],
  facts: [
    'Garrett Hardin: „The Tragedy of the Commons“, Science, Band 162, 13. Dezember 1968.',
    'Hardin bezog sich auf einen Vortrag des Ökonomen William Forster Lloyd von 1833.',
    'Hardin stellte 1998 klar, dass seine Aussage für unverwaltete Gemeingüter gilt.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Auf dem Zeitstrahl markiert 1968 den Moment, in dem das Gefangenendilemma in der Umwelt- und Ressourcenpolitik ankommt.'
  },
  exhibit: null,
  further: ['Hardin, G. (1968). The Tragedy of the Commons. Science, 162(3859), 1243–1248.']
},

'ostrom-gemeingueter': {
  id: 'ostrom-gemeingueter',
  title: 'Elinor Ostrom: Gemeingüter ohne Tragödie',
  kind: 'person',
  journeys: ['kooperation'],
  icon: 'person',
  teaser: 'Schweizer Alpweiden, spanische Bewässerung: Viele Gemeinschaften regeln gemeinsame Ressourcen seit Jahrhunderten.',
  text: [
    'Im Schweizer Dorf Törbel werden die Alpweiden seit Jahrhunderten gemeinsam genutzt, und die Regeln sind alt: Jeder darf nur so viele Kühe auf die Alp treiben, wie er im Winter durchfüttern kann. Elinor Ostrom sammelte solche Fälle aus aller Welt, von japanischen Dorfwäldern bis zu spanischen Bewässerungsgenossenschaften. Ihr Befund: Wo die Nutzer sich kennen, miteinander reden und selbst Regeln setzen, funktionieren Gemeingüter oft über Generationen.',
    'In „Governing the Commons“ (1990) beschreibt sie Merkmale solcher Systeme, etwa klare Grenzen, Regeln, die zur Lage passen, Kontrolle durch die Nutzer, abgestufte Sanktionen und Wege zur Konfliktlösung. 2009 erhielt sie dafür als erste Frau den Wirtschaftsnobelpreis, gemeinsam mit Oliver Williamson.',
    'Ein Patentrezept ist das nicht: Große, anonyme oder schnell wechselnde Gruppen scheitern häufiger, und manche Gemeinschaften zerbrechen. Ostrom zeigte aber, dass die Wahl nicht nur zwischen Staat und Markt besteht.'
  ],
  facts: [
    'Elinor Ostrom (1933–2012) erhielt 2009 den Wirtschaftsnobelpreis, gemeinsam mit Oliver E. Williamson.',
    '„Governing the Commons“ erschien 1990 bei Cambridge University Press.',
    'Ostrom nannte Gestaltungsprinzipien erfolgreicher Gemeingut-Regime, darunter klare Grenzen und abgestufte Sanktionen.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Ostrom, E. (1990). Governing the Commons. Cambridge University Press.', 'Ostrom, E. (1999). Die Verfassung der Allmende. Mohr Siebeck.']
},

'axelrod-turniere': {
  id: 'axelrod-turniere',
  title: 'Axelrods Turniere: Wer gewinnt, wenn alle mehrfach spielen?',
  kind: 'ereignis',
  journeys: ['kooperation', 'geschichte'],
  year: 1980,
  yearLabel: '1980',
  icon: 'chess',
  teaser: 'Fachleute schickten Programme in ein Dilemma-Turnier. Gewonnen hat das einfachste.',
  text: [
    'Der Politologe Robert Axelrod lud 1980 Fachleute ein, Computerprogramme für ein wiederholtes Gefangenendilemma einzureichen. 14 Programme traten, zusammen mit einem Zufallsspieler, jeweils 200 Runden gegeneinander an. Pro Runde gab es 3 Punkte für beidseitige Kooperation, 1 für beidseitigen Verrat, 5 für den Verräter und 0 für den Betrogenen.',
    'Gewonnen hat das einfachste Programm, nur fünf Zeilen Fortran: Tit for Tat von Anatol Rapoport, es kooperiert zuerst und wiederholt dann, was der andere zuletzt tat. Auch in einem zweiten Turnier mit 62 Einsendungen, bei dem alle das Ergebnis kannten, siegte es. Axelrods Deutung: Erfolgreich waren „nette“ Strategien, die nie als Erste verraten, aber sich wehren und vergeben.',
    'Die Aussagekraft ist begrenzt: Das Ergebnis hängt davon ab, welche Programme mitspielen, und spätere Forschung fand Strategien, die bei Fehlern oder in Evolutionssimulationen besser abschneiden.'
  ],
  facts: [
    'Das erste Turnier hatte 14 Einsendungen plus einen Zufallsspieler, gespielt wurden 200 Runden je Paarung.',
    'Das zweite Turnier hatte 62 Einsendungen; Tit for Tat gewann erneut.',
    'Axelrod und Hamilton veröffentlichten 1981 „The Evolution of Cooperation“ in Science; Axelrods Buch erschien 1984.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Auf dem Zeitstrahl bringen die Turniere 1980 die Spieltheorie in die Computer-Ära und machen Kooperation zu einem experimentell prüfbaren Thema.'
  },
  exhibit: null,
  further: ['Axelrod, R. (1984). The Evolution of Cooperation. Basic Books.']
},

'tit-for-tat': {
  id: 'tit-for-tat',
  title: 'Tit for Tat: Nett, vergeltend, nachsichtig, klar',
  kind: 'konzept',
  journeys: ['kooperation'],
  icon: 'link',
  teaser: 'Eine Regel in einem Satz hat Axelrods Turniere gewonnen. Sie hat aber eine Schwäche.',
  text: [
    'Die Strategie passt auf einen Bierdeckel: Beginne mit Kooperation. Danach tu in jeder Runde, was der andere in der Runde davor getan hat. Axelrod fasste ihren Erfolg in vier Eigenschaften: Sie ist nett (nie als Erste Verrat), vergeltend (Verrat wird sofort beantwortet), nachsichtig (nach einer Kooperation ist alles vergessen) und klar (andere durchschauen sie schnell).',
    'Eigenartig: Tit for Tat gewinnt nie eine einzelne Partie. Im besten Fall endet sie unentschieden, sonst liegt sie knapp zurück. Sie siegt, weil sie mit kooperierenden Partnern viele Punkte holt und sich nicht ausbeuten lässt.',
    'Die Schwäche zeigt sich bei Missverständnissen: Ein einziger Fehler löst eine Kette gegenseitiger Vergeltung aus. In Simulationen mit Fehlern schnitten großzügigere Strategien besser ab, etwa „Tit for Tat mit Vergebung“ oder die von Nowak und Sigmund 1993 untersuchte „Pavlov“-Regel. Es gibt keine Strategie, die immer die beste ist, das hängt von den anderen ab.'
  ],
  facts: [
    'Tit for Tat stammt von Anatol Rapoport und kooperiert in der ersten Runde.',
    'Tit for Tat erzielt in keiner Paarung mehr Punkte als der Partner.',
    'Nowak und Sigmund beschrieben 1993 in Nature die Strategie Win-Stay, Lose-Shift („Pavlov“).'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: 'dilemma-turnier',
  further: ['Nowak, M. & Sigmund, K. (1993). A strategy of win-stay, lose-shift that outperforms tit-for-tat in the Prisoner’s Dilemma game. Nature, 364, 56–58.']
},

'evolutionaer-stabile-strategie': {
  id: 'evolutionaer-stabile-strategie',
  title: 'Evolutionär stabile Strategien: Falke und Taube',
  kind: 'konzept',
  journeys: ['kooperation', 'geschichte'],
  year: 1973,
  yearLabel: '1973',
  icon: 'dna',
  teaser: 'Tiere rechnen nicht. Trotzdem verhalten sie sich, als hätten sie ein Spiel gelöst.',
  text: [
    'Zwei Hirsche streiten um ein Weibchen. Meist brüllen und mustern sie sich, selten kämpfen sie bis zur Verletzung. Warum? John Maynard Smith und George Price übertrugen 1973 die Spieltheorie auf die Biologie. Die Spieler sind Tiere, die Strategien sind vererbt, und die Auszahlung ist die Zahl der Nachkommen.',
    'Im Falke-Taube-Modell kämpft ein Falke immer, eine Taube weicht aus. Sind die Kosten einer Verletzung höher als der Wert der Beute, setzt sich keine der beiden Strategien allein durch: Es stellt sich ein Mischungsverhältnis ein, in dem Falken genau im Verhältnis von Beutewert zu Verletzungskosten vorkommen. Eine solche Strategie nennt Maynard Smith „evolutionär stabil“: Eine kleine Zahl Abweichler hat gegen sie keinen Vorteil.',
    'Das Konzept braucht weder Nachdenken noch Absicht, nur Selektion. Es ist stark in der Verhaltensbiologie, bleibt aber ein Modell: Wirkliche Populationen sind selten so einfach.'
  ],
  facts: [
    'Maynard Smith und Price: „The Logic of Animal Conflict“, Nature, Band 246, 1973.',
    'Maynard Smith veröffentlichte 1982 „Evolution and the Theory of Games“.',
    'Im Falke-Taube-Spiel mit Beutewert V und Verletzungskosten C > V liegt der stabile Falkenanteil bei V/C.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Auf dem Zeitstrahl wird die Spieltheorie 1973 zum Werkzeug der Biologie: Aus Nutzen wird Fortpflanzungserfolg, aus Rationalität wird Selektion.'
  },
  exhibit: null,
  further: ['Maynard Smith, J. (1982). Evolution and the Theory of Games. Cambridge University Press.']
},

'ultimatum-spiel': {
  id: 'ultimatum-spiel',
  title: 'Das Ultimatum-Spiel: Wann lehnst du Geld ab?',
  kind: 'instrument',
  journeys: ['kooperation'],
  icon: 'cards',
  teaser: 'Du bekommst 2 von 10 Euro angeboten. Nimmst du? Viele nicht, obwohl 2 Euro besser sind als nichts.',
  text: [
    'Zwei Personen sollen zehn Euro teilen. Die erste schlägt eine Aufteilung vor, die zweite nimmt an oder lehnt ab. Bei Ablehnung gehen beide leer aus. Rein rechnerisch sollte die zweite jeden Betrag über null annehmen, die erste also fast nichts anbieten (das folgt aus der Rückwärtsinduktion).',
    'Werner Güth und seine Kollegen ließen das 1982 in Köln spielen. Das Ergebnis passte nicht zur Rechnung: Die Anbietenden boten im Schnitt etwa ein Drittel der Summe, und sehr niedrige Angebote wurden häufig abgelehnt. Spätere Versuche in vielen Ländern fanden dasselbe Grundmuster, auch wenn Höhe und Ablehnung schwanken. Eine große Studie in 15 kleinen Gesellschaften (Henrich u. a., 2001) fand deutliche Unterschiede zwischen den Kulturen (mittlere Angebote von etwa 26 bis 58 Prozent).',
    'Wie ist das zu deuten? Vielleicht lehnen Menschen Unfaires ab (Fairnesspräferenz), vielleicht bieten Anbieter viel, weil sie Ablehnung fürchten, vielleicht wirken Normen. Wahrscheinlich spielt alles mit.'
  ],
  facts: [
    'Güth, Schmittberger und Schwarze veröffentlichten das Experiment 1982 im Journal of Economic Behavior & Organization.',
    'In vielen Wiederholungen werden Angebote deutlich unter etwa 20 Prozent der Summe häufig abgelehnt.',
    'Henrich u. a. (2001) testeten ultimatum-ähnliche Spiele in 15 kleinen Gesellschaften und fanden große kulturelle Unterschiede.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Güth, W., Schmittberger, R. & Schwarze, B. (1982). An experimental analysis of ultimatum bargaining. Journal of Economic Behavior & Organization, 3(4), 367–388.']
},

'homo-oeconomicus': {
  id: 'homo-oeconomicus',
  title: 'Mythos: Der Mensch ist der Homo oeconomicus',
  kind: 'mythos',
  journeys: ['kooperation'],
  icon: 'mask',
  teaser: 'Der Ökonom hält angeblich alle für kühle Rechner. Was behauptet das Modell wirklich, und was sagen Experimente?',
  text: [
    'In vielen Lehrbüchern kommt ein Wesen vor, das seine Vorteile kennt, nur an sich denkt und fehlerfrei rechnet: der Homo oeconomicus. Die Kritik ist alt und oft berechtigt: Im Ultimatum-Spiel, in Gruppenversuchen und im Alltag handeln Menschen großzügiger, nachtragender und weniger konsequent.',
    'Die Verteidiger setzen dagegen: Das Modell ist ein Werkzeug, keine Menschenbeschreibung. Milton Friedman argumentierte 1953, entscheidend sei, ob die Vorhersagen stimmen, nicht ob die Annahmen realistisch sind. Und „rational“ heißt nicht „egoistisch“: Auch wer Fairness schätzt, kann widerspruchsfrei entscheiden. Neuere Modelle bauen Fairness in die Auszahlungen ein, zum Beispiel Fehr und Schmidt 1999.',
    'Eine dritte Gruppe, um Gerd Gigerenzer, hält die Messlatte selbst für falsch: Einfache Faustregeln seien oft klüger als komplizierte Rechnungen. So bleibt das Modell nützlich, wo Anreize und Wettbewerb stark wirken, und irreführend, wo Normen und Gefühle tragen.'
  ],
  facts: [
    'Der Begriff „Homo oeconomicus“ ist ein Modellbegriff des 19. Jahrhunderts, kein Menschenbild der Spieltheorie selbst.',
    'Friedman verteidigte unrealistische Annahmen 1953 in „The Methodology of Positive Economics“.',
    'Fehr und Schmidt (1999) schlugen ein Modell vor, in dem Menschen Ungleichheit ungern haben.'
  ],
  quote: null,
  myth: {
    glaube: 'Die Wirtschaftswissenschaft behauptet, alle Menschen seien rationale Egoisten.',
    wahrheit: 'Das Modell ist eine Vereinfachung, deren Treffsicherheit je nach Lage schwankt. Experimente zeigen Fairness und Kooperation, moderne Modelle bauen das ein; ob Menschen „rational“ sind, ist nach wie vor umstritten.'
  },
  cross: {},
  exhibit: null,
  further: ['Henrich, J. u. a. (2001). In Search of Homo Economicus. American Economic Review, 91(2), 73–78.', 'Gigerenzer, G. & Selten, R. (Hrsg.) (2001). Bounded Rationality: The Adaptive Toolbox. MIT Press.']
},

'verlustaversion': {
  id: 'verlustaversion',
  title: 'Verlustaversion: Warum Verlieren mehr wehtut',
  kind: 'konzept',
  journeys: ['kooperation'],
  icon: 'scale',
  teaser: 'Hundert Euro verlieren schmerzt stärker, als hundert Euro gewinnen freut. Die Theorie dahinter ist umstritten.',
  text: [
    'Ich biete dir eine Münzwette: Bei Zahl verlierst du 100 Euro, bei Kopf gewinnst du 150. Rechnerisch ist das ein guter Deal. Die meisten lehnen trotzdem ab. Daniel Kahneman und Amos Tversky erklärten das 1979 mit der Prospect-Theorie: Menschen bewerten Gewinne und Verluste relativ zu einem Bezugspunkt, und Verluste wiegen schwerer als gleich große Gewinne, etwa doppelt so schwer.',
    'Die Theorie erklärt viele Beobachtungen, etwa, warum manche Anleger an verlustbringenden Aktien hängen. Kahneman erhielt 2002 den Wirtschaftsnobelpreis für seine Arbeiten dieser Art (Tversky starb 1996). Sie gilt als einflussreichste Alternative zur Erwartungsnutzentheorie von von Neumann und Morgenstern, wenn es darum geht, Verhalten zu beschreiben, nicht es zu bewerten.',
    'Kritik gibt es auch: Der Faktor ist je nach Studie unterschiedlich groß, und Gal und Rucker (2018) meinen, vieles lasse sich ohne eigenen Verlustaversions-Mechanismus erklären. Die Debatte läuft weiter.'
  ],
  facts: [
    'Kahneman und Tversky: „Prospect Theory“, Econometrica, Band 47, 1979.',
    'Tversky und Kahneman (1992) schätzten den Verlustaversions-Faktor auf etwa 2,25.',
    'Daniel Kahneman erhielt 2002 den Wirtschaftsnobelpreis.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Kahneman, D. (2012). Schnelles Denken, langsames Denken. Siedler.']
},

'nudging': {
  id: 'nudging',
  title: 'Nudging: Anstupsen mit Absicht',
  kind: 'methode',
  journeys: ['kooperation'],
  icon: 'footprint',
  teaser: 'Wer die Voreinstellung ändert, ändert Entscheidungen. Wie groß der Effekt wirklich ist, wird heftig diskutiert.',
  text: [
    'Ein Unternehmen meldet neue Beschäftigte automatisch zur Altersvorsorge an. Wer nicht will, kann austreten. Madrian und Shea (2001) fanden in einem US-Betrieb, dass die Teilnahme der erst kürzlich Eingestellten von 37 auf 86 Prozent stieg. Richard Thaler und Cass Sunstein nennen solche Eingriffe „Nudges“ (Anstupser) und sprechen von „libertärem Paternalismus“: Die Wahl bleibt frei, die Umgebung lenkt sanft.',
    'Der Gedanke begeisterte Regierungen, es entstanden „Nudge-Units“. Doch die Bilanz ist durchwachsen. Eine Auswertung von DellaVigna und Linos (2022) fand in Studien der Nudge-Units einen durchschnittlichen Effekt von 1,4 Prozentpunkten, in Fachzeitschriften waren es 8,7. Eine Reanalyse von Maier u. a. (2022) fand nach Korrektur der Publikationsverzerrung keine Belege für Nudging; die Autoren der Originalstudie widersprachen in einer Replik.',
    'Dazu kommt die Frage, wer entscheiden darf, wohin angestupst wird.'
  ],
  facts: [
    'Thaler und Sunstein veröffentlichten „Nudge“ 2008; Thaler erhielt 2017 den Wirtschaftsnobelpreis.',
    'DellaVigna und Linos (Econometrica, 2022): im Mittel 1,4 Prozentpunkte in Nudge-Unit-Studien gegenüber 8,7 in Fachzeitschriften.',
    'Mertens u. a. (PNAS, 2022) berichteten einen kleinen bis mittleren Nudge-Effekt; Maier u. a. fanden nach Korrektur der Publikationsverzerrung keinen.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Thaler, R. H. & Sunstein, C. R. (2008). Nudge. Yale University Press.', 'DellaVigna, S. & Linos, E. (2022). RCTs to Scale. Econometrica, 90(1), 81–116.']
},

'replikation-kritik': {
  id: 'replikation-kritik',
  title: 'Verhaltensökonomik auf dem Prüfstand',
  kind: 'konzept',
  journeys: ['kooperation'],
  icon: 'magnifier',
  teaser: 'Halten die berühmten Experimente einer zweiten Prüfung stand? Die Bilanz ist besser als ihr Ruf, aber nicht makellos.',
  text: [
    'Seit etwa 2011 steht die Psychologie wegen misslungener Wiederholungen in der Kritik. Auch die experimentelle Ökonomik wurde getestet: Camerer und Kollegen wiederholten 2016 achtzehn Laborexperimente aus zwei führenden Zeitschriften. Elf davon, also etwa 61 Prozent, bestätigten sich, und die gefundenen Effekte waren im Schnitt kleiner als in den Originalen.',
    'Das Bild ist uneinheitlich. Manche Befunde wie das Grundmuster des Ultimatum-Spiels gelten als weitgehend stabil, bei anderen, etwa der Größe der Verlustaversion oder dem Effekt von Nudges, streiten Fachleute. Gerd Gigerenzer kritisiert zudem das ganze Forschungsprogramm der „Denkfehler“: Dass Menschen von einer Norm abweichen, beweise nicht, dass sie unvernünftig seien. Verteidiger entgegnen, dass die Abweichungen systematisch und vorhersagbar sind.',
    'Eine faire Zusammenfassung: Die Verhaltensökonomik hat das Menschenbild der Spieltheorie erweitert, aber keine fertige Gegentheorie geliefert.'
  ],
  facts: [
    'Camerer u. a. (Science, 2016) replizierten 11 von 18 Laborexperimenten aus American Economic Review und Quarterly Journal of Economics.',
    'Die Replikationseffekte waren im Mittel kleiner als in den Originalstudien (rund zwei Drittel der Originalgröße).',
    'Gigerenzer kritisierte das Programm „Heuristics and Biases“ von Kahneman und Tversky, u. a. 1996 in Psychological Review.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Camerer, C. F. u. a. (2016). Evaluating replicability of laboratory experiments in economics. Science, 351(6280), 1433–1436.']
}

});
})();
