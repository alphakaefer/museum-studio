// Stationen der Reise „gehirn“ (Heimat-Reise). Schema: docs/INHALT-SCHREIBEN.md.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'aufmerksamkeit-typen': {
  id: 'aufmerksamkeit-typen',
  title: 'Aufmerksamkeit ist kein einzelner Schalter',
  kind: 'konzept',
  journeys: ['gehirn'],
  icon: 'eye',
  teaser: 'Wach sein, hinschauen, sich nicht ablenken lassen: Das Gehirn löst das mit unterschiedlichen Systemen.',
  text: [
    'Du sitzt im Zug und liest. Ein Handy klingelt, du hebst den Kopf, siehst, dass es nicht deins ist, und kehrst zur Seite zurück. In diesen paar Sekunden ist mehr passiert, als „aufgepasst“ zu haben: Du warst wach genug, um zu lesen, hast dich einem Reiz zugewandt und dich dann bewusst wieder gegen ihn entschieden.',
    'Die Hirnforscher Michael Posner und Steven Petersen beschrieben dafür seit 1990 drei Teilsysteme: Wachsamkeit (bereit sein), Orientierung (die Aufmerksamkeit auf etwas lenken) und exekutive Kontrolle (Ablenkung unterdrücken, Konflikte auflösen). Jedes stützt sich auf andere Netzwerke und andere Botenstoffe. Es ist ein Modell, kein Schaltplan; spätere Arbeiten haben es verfeinert.',
    'Für ADHS ist das nützlich, weil die Diagnose kein einzelnes „Aufmerksamkeitsorgan“ meint. Menschen mit ADHS können über Stunden in etwas versinken, das sie fesselt, und scheitern an einer Routineaufgabe. Wo genau es hakt, kann sich von Person zu Person und von Tag zu Tag unterscheiden.'
  ],
  facts: [
    'Posner und Petersen veröffentlichten ihr Modell der Aufmerksamkeitssysteme 1990 im Annual Review of Neuroscience.',
    'Das Modell unterscheidet Wachsamkeit, Orientierung und exekutive Kontrolle.',
    'Die Teilsysteme werden mit unterschiedlichen Hirnnetzwerken in Verbindung gebracht.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Posner, M. I. & Petersen, S. E. (1990). The attention system of the human brain. Annual Review of Neuroscience, 13, 25–42.', 'Petersen, S. E. & Posner, M. I. (2012). The attention system of the human brain: 20 years after. Annual Review of Neuroscience, 35, 73–89.']
},

'exekutive': {
  id: 'exekutive',
  title: 'Exekutive Funktionen: Die Zentrale hinter der Stirn',
  kind: 'konzept',
  journeys: ['gehirn', 'alltag'],
  icon: 'gear',
  teaser: 'Planen, Merken, Bremsen: Wie das Gehirn Handlungen organisiert und warum das bei ADHS nicht immer reibungslos läuft.',
  text: [
    'Ein Frühstück klingt einfach: Wasser aufsetzen, Brot holen, nebenbei an die Brotdose denken, und wenn das Kind etwas fragt, den Faden nicht verlieren. Dahinter stecken Fähigkeiten, die man als exekutive Funktionen zusammenfasst. Dazu zählen das Arbeitsgedächtnis (Dinge kurz im Kopf behalten), Hemmung (einen Impuls zurückhalten) und kognitive Flexibilität (umschalten, wenn sich etwas ändert).',
    'Der Psychologe Russell Barkley schlug 1997 ein einflussreiches Modell vor: Eine gestörte Impulshemmung beeinträchtige in der Folge die übrigen exekutiven Leistungen. Das Modell prägte die Forschung, wird aber auch kritisiert. Studien finden bei Gruppen mit ADHS im Mittel schwächere Leistungen, doch die Effekte sind mäßig, und nicht jeder Mensch mit ADHS ist in Tests auffällig.',
    'Exekutive Funktionen reifen bis ins junge Erwachsenenalter und hängen von Schlaf, Stress und Interesse ab. Das erklärt, warum dieselbe Person an einem Tag glänzt und am nächsten scheitert. Wie sich das im Alltag zeigt, begegnet dir auf der Reise „Alltag“.'
  ],
  facts: [
    'Barkley veröffentlichte sein Hemmungsmodell der ADHS 1997 im Psychological Bulletin.',
    'Zu den Kernfunktionen zählen Arbeitsgedächtnis, Hemmung und kognitive Flexibilität.',
    'In Tests sind Gruppenunterschiede meist mäßig; nicht jede Person mit ADHS fällt auf.'
  ],
  quote: null,
  myth: null,
  cross: {
    alltag: 'Im Alltag sind es genau diese Funktionen, an denen Morgenroutine, Hausaufgaben und Terminplanung hängen; hier siehst du, wie sich das konkret anfühlt.'
  },
  exhibit: null,
  further: ['Barkley, R. A. (1997). Behavioral inhibition, sustained attention, and executive functions: Constructing a unifying theory of ADHD. Psychological Bulletin, 121(1), 65–94.']
},

'belohnung-verzoegerung': {
  id: 'belohnung-verzoegerung',
  title: 'Warten ist schwer: Belohnung und Verzögerung',
  kind: 'konzept',
  journeys: ['gehirn'],
  icon: 'hourglass',
  teaser: 'Je länger eine Belohnung auf sich warten lässt, desto weniger zählt sie. Bei ADHS fällt dieser Wert oft schneller.',
  text: [
    'Dir werden zehn Euro heute oder elf Euro in einem Monat angeboten. Viele nehmen die zehn heute. Ökonomen und Psychologen nennen das Abwertung verzögerter Belohnungen: Je weiter eine Belohnung entfernt liegt, desto weniger zählt sie jetzt.',
    'Edmund Sonuga-Barke und Kollegen beschrieben seit den frühen 1990er-Jahren, dass Kinder mit ADHS Wartezeiten oft besonders ungern in Kauf nehmen. Im Doppelpfad-Modell von 2003 steht diese Abneigung gegen Verzögerung neben der Schwäche in der Impulskontrolle als zweiter möglicher Weg zu den Symptomen. Studien finden im Mittel steilere Abwertungskurven, doch die Unterschiede sind zwischen Personen groß, und das Modell erklärt nicht alle Fälle.',
    'Im Alltag kann das bedeuten: Die Hausaufgabe, die sich erst am Freitag lohnt, verliert gegen das Spiel, das sofort Rückmeldung gibt. Das hat wenig mit Willensschwäche zu tun. Wer Belohnung näher heranholt, etwa durch kleine Zwischenziele, macht Wartendes leichter erträglich.'
  ],
  facts: [
    'Sonuga-Barke und Kollegen beschrieben die Verzögerungsabneigung bei ADHS seit den frühen 1990er-Jahren.',
    'Das Doppelpfad-Modell erschien 2003 in Neuroscience & Biobehavioral Reviews.',
    'Die Abwertungskurve verzögerter Belohnungen verläuft in Modellen meist hyperbolisch.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Sonuga-Barke, E. J. S. (2003). The dual pathway model of AD/HD: an elaboration of neuro-developmental characteristics. Neuroscience & Biobehavioral Reviews, 27(7), 593–604.']
},

'dopamin': {
  id: 'dopamin',
  title: 'Botenstoffe: Dopamin und Noradrenalin',
  kind: 'konzept',
  journeys: ['gehirn', 'behandlung'],
  icon: 'synapse',
  teaser: 'Zwei Botenstoffe stehen im Mittelpunkt der Forschung. „Dopaminmangel“ ist trotzdem eine zu einfache Formel.',
  text: [
    'Zwischen zwei Nervenzellen liegt ein winziger Spalt, die Synapse. Die sendende Zelle gibt dort einen Botenstoff ab, die empfangende nimmt das Signal auf, und Transporter holen den Rest wieder in die Senderzelle zurück. Bei Dopamin und Noradrenalin, die unter anderem Motivation, Wachheit und Handlungssteuerung mitregeln, läuft vieles davon über diese Wiederaufnahme.',
    'Medikamente gegen ADHS setzen hier an: Methylphenidat blockiert die Transporter von Dopamin und Noradrenalin, Amphetamine wirken zusätzlich über die Freisetzung, Atomoxetin hemmt die Wiederaufnahme von Noradrenalin. Bildgebende Studien, etwa von Volkow und Kollegen 2009, fanden bei unbehandelten Erwachsenen mit ADHS Hinweise auf eine schwächere Aktivität im Dopamin-Belohnungssystem.',
    'Daraus wird gern „ADHS ist ein Dopaminmangel“. Das trägt nicht: Die Befunde sind uneinheitlich, betreffen Gruppen im Mittel, und dass ein Medikament über einen Botenstoff wirkt, beweist nicht, dass dort die Ursache liegt. Wie Medikamente im Einzelnen wirken und wo ihre Grenzen liegen, steht in der Reise „Behandlung“.'
  ],
  facts: [
    'Methylphenidat blockiert die Wiederaufnahme von Dopamin und Noradrenalin.',
    'Atomoxetin hemmt vor allem die Wiederaufnahme von Noradrenalin.',
    'Volkow und Kollegen berichteten 2009 in JAMA über Befunde zum Dopamin-Belohnungssystem bei Erwachsenen mit ADHS.'
  ],
  quote: null,
  myth: null,
  cross: {
    behandlung: 'Hier zeigt sich, warum Stimulanzien und Atomoxetin an Botenstoffen ansetzen und warum ihre Wirkung trotzdem keine Diagnose beweist.'
  },
  exhibit: null,
  further: ['Volkow, N. D. u. a. (2009). Evaluating dopamine reward pathway in ADHD: clinical implications. JAMA, 302(10), 1084–1091.', 'Thapar, A. & Cooper, M. (2016). Attention deficit hyperactivity disorder. The Lancet, 387, 1240–1250.']
},

'default-mode': {
  id: 'default-mode',
  title: 'Abschweifen: Das Ruhe-Netzwerk',
  kind: 'konzept',
  journeys: ['gehirn'],
  icon: 'network',
  teaser: 'Wenn der Kopf nichts tun muss, wird ein bestimmtes Netzwerk aktiv. Bei ADHS könnte es sich schlechter abschalten lassen.',
  text: [
    'Du starrst aus dem Fenster, und plötzlich bist du in einem Gespräch von gestern. Im Hirnscanner zeigt sich dabei ein typisches Muster: Bestimmte Regionen sind aktiver, wenn man gerade keine Aufgabe löst. Marcus Raichle und Kollegen beschrieben es 2001 als „Ruhezustand“ des Gehirns; heute spricht man vom Default-Mode-Netzwerk.',
    'Edmund Sonuga-Barke und Francisco Castellanos vermuteten 2007, bei ADHS schalte sich dieses Netzwerk bei Aufgaben nicht zuverlässig ab und störe dann als „Hintergrundrauschen“ die Aufgabennetzwerke. Einzelne Studien stützen das, aber die Befunde sind nicht einheitlich, die Unterschiede sind klein, und was das Netzwerk im Alltag leistet, ist Gegenstand laufender Forschung.',
    'Wichtig zur Einordnung: Auch Menschen ohne ADHS schweifen ab, und Tagträumen kann Ideen und Erinnerungen verbinden. Das Ruhe-Netzwerk ist also keine Fehlfunktion, sondern ein normaler Teil des Gehirns. Fraglich ist nur, ob und wie sich sein Zusammenspiel mit dem Aufgabennetzwerk bei ADHS unterscheidet.'
  ],
  facts: [
    'Raichle und Kollegen beschrieben 2001 in PNAS einen „Grundzustand“ der Hirnaktivität.',
    'Die Hypothese zu ADHS stammt von Sonuga-Barke und Castellanos (2007).',
    'Die Befunde dazu sind uneinheitlich; die Hypothese gilt als nicht abschließend belegt.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Raichle, M. E. u. a. (2001). A default mode of brain function. PNAS, 98(2), 676–682.', 'Sonuga-Barke, E. J. S. & Castellanos, F. X. (2007). Spontaneous attentional fluctuations in impaired states and pathological conditions. Neuroscience & Biobehavioral Reviews, 31(7), 977–986.']
},

'reaktionsvariabilitaet': {
  id: 'reaktionsvariabilitaet',
  title: 'Mal schnell, mal langsam: Schwankende Leistung',
  kind: 'instrument',
  journeys: ['gehirn'],
  icon: 'pulse',
  teaser: 'Bei ADHS schwankt die Reaktionszeit von Versuch zu Versuch im Mittel stärker. Unten siehst du deine eigene Streuung.',
  text: [
    'Drücke zwanzigmal so schnell wie möglich eine Taste, sobald ein Signal erscheint. Du wirst nicht zwanzigmal gleich schnell sein: Mal liegst du bei einer Viertelsekunde, mal deutlich darüber, manchmal ist ein Ausreißer dabei. Diese Schwankung von Versuch zu Versuch heißt in der Forschung intraindividuelle Variabilität.',
    'In Übersichtsarbeiten zeigt sich, dass Gruppen mit ADHS im Mittel stärker schwanken als Vergleichsgruppen, und zwar vor allem durch einzelne sehr langsame Antworten. Als Erklärung werden kurze Aufmerksamkeitslücken diskutiert, aber auch Schwankungen im Wachheitszustand. Der Gruppenunterschied ist robust, taugt aber nicht zur Diagnose: Die Verteilungen überlappen stark.',
    'Das Exponat zeigt deine Streuung nur als Punkte, ohne Auswertung und ohne Einstufung. Es misst nichts, was etwas über ADHS aussagt, und ersetzt keine fachliche Abklärung. Es zeigt etwas Einfaches: Jedes Gehirn schwankt.'
  ],
  facts: [
    'Intraindividuelle Variabilität bezeichnet die Schwankung der Reaktionszeit einer Person von Versuch zu Versuch.',
    'Eine Meta-Analyse von Kofler und Kollegen (2013) fand bei ADHS im Mittel stärkere Schwankungen als in Vergleichsgruppen.',
    'Die Verteilungen von Gruppen mit und ohne ADHS überlappen stark.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: 'klick-streuung',
  further: ['Kofler, M. J. u. a. (2013). Reaction time variability in ADHD: A meta-analytic review of 319 studies. Clinical Psychology Review, 33(6), 795–811.']
},

'schlaf-uhr': {
  id: 'schlaf-uhr',
  title: 'Schlaf und innere Uhr',
  kind: 'konzept',
  journeys: ['gehirn'],
  icon: 'moon',
  teaser: 'Späte Einschlafzeiten und unruhiger Schlaf sind bei ADHS häufig, und Müdigkeit kann selbst wie ADHS aussehen.',
  text: [
    'Es ist Mitternacht, du bist müde, aber hellwach. Morgens kommst du kaum aus dem Bett. Viele Menschen kennen das, bei Kindern und Erwachsenen mit ADHS ist es häufiger: Sie schlafen im Mittel später ein, schlafen öfter unruhig und gehören überdurchschnittlich oft zum „Abendtyp“, dessen innere Uhr später tickt.',
    'Der Zusammenhang geht wohl in beide Richtungen. Zu wenig Schlaf verschlechtert Aufmerksamkeit und Stimmung, kann also ADHS-ähnliche Beschwerden erzeugen oder verstärken. Umgekehrt kann Unruhe das Einschlafen erschweren, und Stimulanzien können den Schlaf beeinflussen. Übersichten diskutieren zudem Hinweise auf Unterschiede in der Melatoninrhythmik, hier ist die Forschung noch im Fluss.',
    'Praktisch heißt das: Bei einer Abklärung gehört Schlaf dazu, und manchmal bessert sich etwas, wenn man ihn ernst nimmt. Das ersetzt keine Behandlung der ADHS, kann aber eine sinnvolle Grundlage sein. Fachleute entscheiden das im Einzelfall.'
  ],
  facts: [
    'Schlafprobleme treten bei Menschen mit ADHS häufiger auf als in der Allgemeinbevölkerung.',
    'Ein spätes Chronotyp-Muster („Eule“) ist bei ADHS überdurchschnittlich verbreitet.',
    'Die Richtung des Zusammenhangs zwischen Schlaf und ADHS gilt als wechselseitig.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Bijlenga, D., Vollebregt, M. A., Kooij, J. J. S. & Arns, M. (2019). The role of the circadian system in the etiology and pathophysiology of ADHD. Sleep Medicine Reviews, 47, 99–108.']
},

'bildgebung': {
  id: 'bildgebung',
  title: 'Was Gehirnscans zeigen und was nicht',
  kind: 'methode',
  journeys: ['gehirn'],
  icon: 'magnifier',
  teaser: 'Gruppen mit und ohne ADHS unterscheiden sich im Scan im Mittel leicht. Für den Einzelfall sagt das fast nichts.',
  text: [
    'Ein Scan sieht beeindruckend aus: farbige Flecken auf einem Hirnschnitt. Die größte Auswertung von Gehirnvolumen bei ADHS, die ENIGMA-Studie von Martine Hoogman und Kollegen (2017), verglich 1713 Menschen mit ADHS und 1529 ohne, verteilt auf 23 Standorte. Ergebnis: Einige Hirnregionen, darunter Nucleus accumbens, Amygdala und Hippocampus, waren im Mittel etwas kleiner.',
    'Entscheidend sind zwei Wörter: im Mittel und etwas. Die Effekte waren klein, die Verteilungen überlappen stark, und viele Menschen mit ADHS liegen im Bereich der Vergleichsgruppe. Ein einzelner Scan kann deshalb keine ADHS feststellen oder ausschließen. Auch andere vorgeschlagene Marker, etwa ein Verhältnis bestimmter Hirnwellen im EEG, haben sich in größeren Übersichten nicht als verlässlich erwiesen.',
    'Bildgebung ist ein Werkzeug der Forschung. Sie hilft zu verstehen, wie sich Gruppen im Mittel unterscheiden, nicht, bei wem. Die Leitlinien raten nicht zu Bildgebung zur Diagnose.'
  ],
  facts: [
    'Hoogman und Kollegen werteten 2017 Daten von 1713 Menschen mit ADHS und 1529 ohne aus 23 Standorten aus.',
    'Gefunden wurden kleine mittlere Unterschiede, unter anderem in Accumbens, Amygdala und Hippocampus.',
    'Die Verteilungen überlappen stark; ein Scan allein erlaubt keine Diagnose.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Hoogman, M. u. a. (2017). Subcortical brain volume differences in participants with attention deficit hyperactivity disorder in children and adults: a cross-sectional mega-analysis. The Lancet Psychiatry, 4(4), 310–319.']
},

'erblichkeit': {
  id: 'erblichkeit',
  title: 'Gene: Wie viel erklärt Vererbung?',
  kind: 'konzept',
  journeys: ['gehirn'],
  icon: 'dna',
  teaser: 'Zwillingsstudien finden hohe Erblichkeit. Das heißt nicht, dass ein einzelnes Gen oder das Schicksal entscheidet.',
  text: [
    'Eineiige Zwillinge teilen ihr Erbgut, zweieiige im Mittel die Hälfte der Unterschiede. Wenn sich eineiige Zwillinge bei ADHS-Merkmalen deutlich ähnlicher sind als zweieiige, ist das ein Hinweis auf genetische Einflüsse. Zusammenfassungen von Zwillingsstudien kommen auf Schätzungen um 70 bis 80 Prozent, etwa 74 Prozent in einer Übersicht von Faraone und Larsson (2019).',
    'Erblichkeit beschreibt aber, wie viel der Unterschiede in einer Gruppe auf Gene zurückgeht, nicht, wie sicher es einen einzelnen Menschen trifft. Und es ist kein einzelnes Gen: 2019 fanden Demontis und Kollegen in einer Studie mit 20.183 Menschen mit ADHS und 35.191 Kontrollpersonen zwölf Genorte mit Verbindung zu ADHS, jeweils mit sehr kleinem Effekt. Ihre Befunde passen dazu, dass ADHS das Ende eines Kontinuums vererbbarer Merkmale ist.',
    'Hohe Erblichkeit heißt auch nicht, dass Umwelt keine Rolle spielt oder sich nichts ändern lässt. Ein Gentest für ADHS gibt es nicht.'
  ],
  facts: [
    'Zwillingsstudien schätzen die Erblichkeit von ADHS auf etwa 70 bis 80 Prozent; Faraone und Larsson (2019) nennen rund 74 Prozent.',
    'Demontis u. a. (2019) fanden in 20.183 Fällen und 35.191 Kontrollen zwölf unabhängige Genorte.',
    'Auf Basis aller Genvarianten liegt die erklärbare Streuung mit etwa 10 bis 28 Prozent niedriger als in Zwillingsstudien.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Faraone, S. V. & Larsson, H. (2019). Genetics of attention deficit hyperactivity disorder. Molecular Psychiatry, 24, 562–575.', 'Demontis, D. u. a. (2019). Discovery of the first genome-wide significant risk loci for attention deficit/hyperactivity disorder. Nature Genetics, 51, 63–75.']
},

'umwelt': {
  id: 'umwelt',
  title: 'Vor und nach der Geburt: Risikofaktoren',
  kind: 'konzept',
  journeys: ['gehirn'],
  icon: 'leaf',
  teaser: 'Frühgeburt, Rauchen in der Schwangerschaft, schwere Vernachlässigung: Was damit zusammenhängt, ist nicht immer Ursache.',
  text: [
    'Eine Mutter hat in der Schwangerschaft geraucht, ihr Kind hat später ADHS. Liegt es am Rauch? Genau hier zeigt sich das Problem solcher Zusammenhänge: Auch Gene werden weitergegeben, und ein Elternteil mit ADHS-Merkmalen raucht möglicherweise häufiger. Wenn Forschende Geschwister vergleichen, bei denen nur eine Schwangerschaft von Rauchen begleitet war, schwächt sich der Zusammenhang meist deutlich ab.',
    'Gut untersucht sind unter anderem Frühgeburt und sehr niedriges Geburtsgewicht, die mit häufigerem ADHS einhergehen, sowie schwere frühe Vernachlässigung, etwa in Heimen mit extremen Mängeln. Auch hier gilt: Die meisten Kinder mit solchen Erfahrungen entwickeln keine ADHS, und die meisten mit ADHS hatten keine dieser Erfahrungen.',
    'Umweltfaktoren wirken wahrscheinlich nicht allein, sondern im Zusammenspiel mit der genetischen Veranlagung. Der Sprung von „hängt zusammen“ zu „verursacht“ braucht mehr als eine Statistik. Und schuld, das gilt für alle Eltern, ist ein Wort, das hier nicht weiterhilft.'
  ],
  facts: [
    'Frühgeburt und sehr niedriges Geburtsgewicht sind mit häufigerer ADHS verbunden.',
    'Bei Zusammenhängen wie Rauchen in der Schwangerschaft schwächen Geschwistervergleiche den Effekt meist deutlich ab.',
    'Gene und Umwelt wirken wahrscheinlich zusammen.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Thapar, A. & Cooper, M. (2016). Attention deficit hyperactivity disorder. The Lancet, 387(10024), 1240–1250.']
},

'mythos-defekt': {
  id: 'mythos-defekt',
  title: 'Mythos: Das ADHS-Gehirn ist kaputt',
  kind: 'mythos',
  journeys: ['gehirn'],
  icon: 'brain',
  teaser: 'Gruppenunterschiede im Scan sind klein und keine Schäden. Von „kaputt“ zu sprechen, trifft weder die Forschung noch die Menschen.',
  text: [
    'Das Bild ist einprägsam: ein Gehirn mit Lücken, ein Schaden, den man im Scan sieht. In populären Darstellungen taucht es immer wieder auf. Es hält der Forschung nicht stand.',
    'Die großen Bildgebungsstudien finden kleine Unterschiede im Mittel zwischen Gruppen, bei viel Überlappung. Die Befunde sind mit Entwicklungsverzögerungen vereinbar, etwa einer Reifung der Hirnrinde, die in einer Studie von Philip Shaw und Kollegen (2007) bei Kindern mit ADHS im Mittel einige Jahre später ihren Höhepunkt erreichte, aber dem üblichen Muster folgte. Eine Schädigung oder einen Defekt belegt das nicht.',
    'Ob man ADHS als Störung oder als natürliche Variation versteht, ist eine Frage der Bewertung und wird unterschiedlich beantwortet: Die medizinische Sicht betont Beeinträchtigung und Hilfebedarf, die Neurodiversitätsbewegung betont Vielfalt. Beide Seiten bestreiten, dass ein Gehirn „kaputt“ ist. Wie sich diese Sichtweisen unterscheiden, steht in der Reise „Behandlung“.'
  ],
  facts: [
    'Shaw u. a. (2007) fanden bei Kindern mit ADHS eine im Mittel verzögerte, aber typisch verlaufende Reifung der Hirnrinde.',
    'In der ENIGMA-Studie waren Gruppenunterschiede im Gehirnvolumen klein, bei starker Überlappung.',
    'Gehirnscans werden nicht zur Diagnose einzelner Personen eingesetzt.'
  ],
  quote: null,
  myth: {
    glaube: 'Das Gehirn von Menschen mit ADHS ist beschädigt oder defekt, im Scan sieht man den Schaden.',
    wahrheit: 'Gefunden werden kleine Unterschiede im Gruppenmittel mit starker Überlappung, vereinbar mit anderer Reifung. Ein Defekt ist das nicht, und im Einzelfall zeigt ein Scan nichts.'
  },
  cross: {},
  exhibit: null,
  further: ['Shaw, P. u. a. (2007). Attention-deficit/hyperactivity disorder is characterized by a delay in cortical maturation. PNAS, 104(49), 19649–19654.']
}

});
})();
