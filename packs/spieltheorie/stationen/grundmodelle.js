// Stationen der Reise „grundmodelle“ (Heimat-Reise). Schema: docs/INHALT-SCHREIBEN.md.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'normalform': {
  id: 'normalform',
  title: 'Die Auszahlungsmatrix: Ein Spiel auf einem Blatt',
  kind: 'methode',
  journeys: ['grundmodelle'],
  icon: 'grid',
  teaser: 'Vier Felder, zwei Zahlen pro Feld: Mehr braucht es nicht, um eine strategische Lage genau zu beschreiben.',
  text: [
    'Zwei Bäckereien liegen an derselben Straße. Jede entscheidet über Nacht, ob sie morgen ihre Brötchen für 40 oder für 30 Cent verkauft, und keine weiß, was die andere tut. Alles, was daran strategisch ist, passt auf ein Blatt: Die Zeilen sind die Optionen der einen, die Spalten die der anderen, und in jedem der vier Felder stehen zwei Zahlen, der Gewinn der ersten und der Gewinn der zweiten.',
    'Diese Tabelle heißt Auszahlungsmatrix, ihre Form „Normalform“. Sie verlangt drei Angaben: wer mitspielt, was jeder wählen kann (die Strategien) und was am Ende für jeden herauskommt (die Auszahlungen). „Auszahlung“ meint dabei Nutzen, nicht zwingend Geld: Auch Ruhe, Ansehen oder ein gutes Gewissen können eine Zahl bekommen.',
    'Die Tabelle ist eine bewusste Vereinfachung. Sie nimmt an, dass alle gleichzeitig wählen und die Zahlen kennen. Auf den nächsten Stationen prüfst du, was sich aus ihr ablesen lässt, angefangen bei der Frage, ob eine Wahl in jedem Fall die bessere ist.'
  ],
  facts: [
    'Ein Spiel mit zwei Spielern und je zwei Strategien hat vier Ergebnisfelder.',
    'Die Normalform beschreibt Entscheidungen, die gleichzeitig oder ohne Kenntnis der anderen Wahl fallen; Züge nacheinander zeichnet man als Baum.',
    'Auszahlungen sind Nutzenwerte; es kommt oft nur auf ihre Rangfolge an, nicht auf die genaue Zahl.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Osborne, M. J. (2004). An Introduction to Game Theory. Oxford University Press.', 'Holler, M. J. & Illing, G. (2009). Einführung in die Spieltheorie. Springer.']
},

'dominanz': {
  id: 'dominanz',
  title: 'Dominante Strategien: Wenn die Wahl leichtfällt',
  kind: 'konzept',
  journeys: ['grundmodelle'],
  icon: 'target',
  teaser: 'Manchmal ist eine Option gegen alles besser, was der andere tun kann. Dann musst du ihn gar nicht durchschauen.',
  text: [
    'Zurück zu den beiden Bäckereien. Setzt der Rivale den Preis hoch an, gewinnst du mit dem niedrigen Preis Kundschaft. Setzt er ihn niedrig an, hältst du mit dem niedrigen Preis mit und bleibst im Geschäft. In beiden Fällen ist „niedrig“ für dich besser. Eine solche Strategie heißt streng dominant: Sie zahlt sich gegen jede Wahl des anderen am meisten aus.',
    'Das Schöne daran: Du brauchst weder zu raten, was der andere vorhat, noch ihm Rationalität zu unterstellen. Gibt es für jeden Spieler eine dominante Strategie, ist das Spiel gelöst. Lässt sich wenigstens eine Option als dominierte (also immer schlechtere) streichen, wird die Tabelle kleiner, und man prüft sie erneut. Dieses schrittweise Streichen verlangt allerdings, dass jeder weiß, dass auch der andere so denkt.',
    'Die meisten Spiele sind nicht so freundlich: Oft hängt die beste Wahl davon ab, was der andere tut. Dann braucht man einen schwächeren, aber allgemeineren Begriff.'
  ],
  facts: [
    'Streng dominant: gegen jede Wahl der anderen die höhere Auszahlung.',
    'Schwach dominant: nie schlechter, in mindestens einem Fall besser.',
    'Das wiederholte Streichen dominierter Strategien setzt voraus, dass allen bekannt ist, dass alle rational handeln.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Dixit, A. & Nalebuff, B. (1991). Thinking Strategically. W. W. Norton.']
},

'gefangenendilemma': {
  id: 'gefangenendilemma',
  title: 'Das Gefangenendilemma: Warum zwei Vernünftige verlieren',
  kind: 'konzept',
  journeys: ['grundmodelle', 'kooperation', 'geschichte'],
  year: 1950,
  yearLabel: '1950',
  icon: 'lock',
  teaser: 'Zwei Verdächtige verraten sich gegenseitig, obwohl beide besser fahren würden, wenn sie schwiegen.',
  text: [
    'Zwei Verdächtige sitzen in getrennten Zellen. Schweigen beide, bekommen sie je ein Jahr. Verrät einer den anderen, geht er frei, und der Schweiger bekommt drei Jahre. Verraten sich beide, sind es je zwei. Was soll man tun? Egal, was der andere macht: Verrat ist für dich besser (frei statt ein Jahr, zwei statt drei). Also verraten beide, und jeder sitzt zwei Jahre, obwohl Schweigen beiden nur ein Jahr gebracht hätte.',
    'Das Spiel stammt aus dem Jahr 1950: Die Mathematiker Merrill Flood und Melvin Dresher entwarfen es bei der RAND Corporation, Albert Tucker erzählte es danach mit der Gefängnisgeschichte weiter. Das Muster steckt in Rüstungswettläufen, Preiskriegen und Doping: Was für den Einzelnen vernünftig ist, kann für alle zusammen schlecht sein.',
    'Ein Naturgesetz ist das nicht. Im Labor kooperieren viele Menschen trotzdem, und die nächsten Stationen zeigen, unter welchen Umständen das gelingt.'
  ],
  facts: [
    'Merrill Flood und Melvin Dresher entwickelten das Spiel 1950 bei der RAND Corporation.',
    'Albert Tucker erfand die Gefängnisgeschichte und den Namen für einen Vortrag vor Stanforder Psychologen (1950).',
    'Im Test bei RAND spielten Armen Alchian und John Williams 100 Runden und kooperierten dabei oft.'
  ],
  quote: null,
  myth: null,
  cross: {
    kooperation: 'Hier beginnt die Frage der Reise: Was ändert sich, wenn das Dilemma für viele Menschen oder in vielen Runden gespielt wird?',
    geschichte: 'Es entsteht 1950, im selben Jahr wie Nashs Gleichgewicht, und zeigt sofort, dass ein Gleichgewicht für alle schlecht sein kann.'
  },
  exhibit: null,
  further: ['Poundstone, W. (1992). Prisoner’s Dilemma. Doubleday.', 'Kuhn, S. (2019). Prisoner’s Dilemma. Stanford Encyclopedia of Philosophy.']
},

'nash-gleichgewicht': {
  id: 'nash-gleichgewicht',
  title: 'Das Nash-Gleichgewicht: Niemand will allein abweichen',
  kind: 'konzept',
  journeys: ['grundmodelle', 'geschichte'],
  year: 1950,
  yearLabel: '1950',
  icon: 'scale',
  teaser: 'Ein Zustand, in dem jeder genau das Beste tut, was er angesichts der anderen tun kann. Auch wenn es für alle schlecht ist.',
  text: [
    'Im Gefangenendilemma verraten sich beide. Würde einer allein zum Schweigen wechseln, ginge es ihm schlechter. Genau das macht den Zustand zu einem Nash-Gleichgewicht: Eine Kombination von Strategien, bei der keiner durch einseitiges Abweichen gewinnt. Jeder spielt die beste Antwort auf das, was die anderen spielen.',
    'John Nash zeigte 1950, dass jedes Spiel mit endlich vielen Spielern und Strategien mindestens ein solches Gleichgewicht besitzt, wenn man gemischte Strategien zulässt. Das machte den Begriff zum Standardwerkzeug: Er verallgemeinert Dominanz und lässt sich auf Märkte, Verhandlungen und Biologie anwenden.',
    'Der Begriff hat Grenzen. Viele Spiele haben mehrere Gleichgewichte, und er sagt nicht, welches die Spieler erreichen. Er sagt auch nicht, wie sie dorthin finden, und im Experiment spielen Menschen oft anders. Er ist eine Prüfung auf Stabilität, keine Vorhersage.'
  ],
  facts: [
    'John Nash promovierte 1950 in Princeton bei Albert W. Tucker.',
    'Nash bewies die Existenz in „Equilibrium points in n-person games“ (1950) und „Non-cooperative games“ (1951).',
    'Der Beweis nutzt gemischte Strategien; in reinen Strategien muss es kein Gleichgewicht geben.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Auf dem Zeitstrahl ist 1950 das Schlüsseljahr: Nashs Aufsatz erweitert die Spieltheorie von Nullsummen- und Koalitionsspielen auf beliebige Interessenlagen.'
  },
  exhibit: null,
  further: ['Nash, J. F. (1951). Non-Cooperative Games. Annals of Mathematics, 54(2), 286–295.']
},

'mythos-gleichgewicht': {
  id: 'mythos-gleichgewicht',
  title: 'Mythos: Ein Gleichgewicht ist das Beste für alle',
  kind: 'mythos',
  journeys: ['grundmodelle'],
  icon: 'question',
  teaser: 'Das Wort „Gleichgewicht“ klingt nach Ausgewogenheit. Mit Gerechtigkeit oder Effizienz hat es nichts zu tun.',
  text: [
    'Im Alltag bedeutet Gleichgewicht etwas Gutes: Waage, Balance, Ruhe. In der Spieltheorie meint es nur, dass niemand allein etwas ändern will. Zwei Tankstellen, die sich ständig im Preis unterbieten, können in einem Gleichgewicht stecken, obwohl beide ohne den Preiskampf mehr verdienen würden.',
    'Dazu kommen zwei weitere Missverständnisse. Erstens ist das Gleichgewicht oft nicht eindeutig: Bei der Hirschjagd lohnt es sich, gemeinsam den Hirsch zu jagen oder allein einen Hasen, beides ist stabil, und das eine ist für beide besser. Zweitens ist es keine Prognose. Es sagt, was sich nicht von selbst auflöst, nicht, was Menschen tun werden.',
    'Wer das Konzept für ein Gütesiegel hält, übersieht den Kern der Spieltheorie: Gerade die Lücke zwischen Stabilität und Wohlstand macht Regeln, Verträge und Vertrauen so wertvoll.'
  ],
  facts: [
    'Das Gefangenendilemma hat ein einziges Nash-Gleichgewicht, und beide Spieler stehen darin schlechter da als bei Kooperation.',
    'Bei der Hirschjagd sind „beide Hirsch“ und „beide Hase“ Gleichgewichte; das erste ist für beide besser.',
    'Die Hirschjagd geht auf ein Gleichnis von Jean-Jacques Rousseau zurück (1755).'
  ],
  quote: null,
  myth: {
    glaube: 'Ein Nash-Gleichgewicht ist das beste Ergebnis oder sagt zuverlässig voraus, was Menschen tun.',
    wahrheit: 'Es bedeutet nur, dass keiner allein profitabel abweichen kann. Es kann für alle schlecht sein, es gibt oft mehrere, und Menschen spielen im Labor häufig anders.'
  },
  cross: {},
  exhibit: null,
  further: ['Skyrms, B. (2004). The Stag Hunt and the Evolution of Social Structure. Cambridge University Press.']
},

'fokalpunkte': {
  id: 'fokalpunkte',
  title: 'Fokalpunkte: Wo treffen wir uns in New York?',
  kind: 'konzept',
  journeys: ['grundmodelle', 'geschichte'],
  year: 1960,
  yearLabel: '1960',
  icon: 'compass',
  teaser: 'Wenn mehrere Lösungen gleich gut sind, entscheidet das Auffällige, und das lässt sich nicht berechnen.',
  text: [
    'Du sollst morgen einen Fremden in New York treffen. Weder Ort noch Uhrzeit sind abgesprochen, und ihr könnt nicht miteinander reden. Wohin gehst du? Thomas Schelling stellte diese Frage seinen Studenten. Auffällig viele nannten dieselbe Antwort: den Auskunftsschalter unter der Uhr im Grand Central, und zwar mittags.',
    'Mathematisch ist jeder Ort ein Gleichgewicht, solange der andere ihn auch wählt. Dass sich trotzdem viele treffen, liegt an einem Fokalpunkt: einer Option, die durch Kultur, Gewohnheit oder Einzigartigkeit hervorsticht. Schelling beschrieb das 1960 in „The Strategy of Conflict“. Dort zeigt er auch, dass man eine Lage verändern kann, indem man sich bindet oder Drohungen glaubwürdig macht.',
    'Das Konzept erklärt, warum wir bei Verabredungen oft ohne Worte zurechtkommen und warum Verhandlungen an runden Zahlen oder alten Grenzen hängen bleiben. Zugleich zeigt es eine Grenze der reinen Rechnung: Was auffällt, hängt von Menschen ab.'
  ],
  facts: [
    'Thomas Schelling veröffentlichte „The Strategy of Conflict“ 1960 bei Harvard University Press.',
    'Schelling erhielt 2005 gemeinsam mit Robert Aumann den Wirtschaftsnobelpreis.',
    'Koordinationsspiele haben mehrere Gleichgewichte; welches gewählt wird, entscheidet oft ein gemeinsamer Bezugspunkt.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Mit Schellings Buch von 1960 öffnet sich die Spieltheorie für Politik und Alltag: Abschreckung, Verhandlung und Verabredung werden zu Spielen.'
  },
  exhibit: null,
  further: ['Schelling, T. C. (1960). The Strategy of Conflict. Harvard University Press.']
},

'minimax-nullsumme': {
  id: 'minimax-nullsumme',
  title: 'Nullsummenspiele und der Minimax-Satz',
  kind: 'konzept',
  journeys: ['grundmodelle', 'geschichte'],
  year: 1928,
  yearLabel: '1928',
  icon: 'shield',
  teaser: 'Wo der Gewinn des einen der Verlust des anderen ist, gibt es eine klare beste Vorsicht.',
  text: [
    'Beim Duell, beim Schach oder beim Pokern um einen festen Topf gewinnt einer, was der andere verliert. Solche Spiele heißen Nullsummenspiele: Die Auszahlungen addieren sich zu null. Hier gibt es keinen Grund zur Zusammenarbeit, und eine vorsichtige Regel liegt nahe: Wähle die Strategie, deren schlechtester Ausgang noch am besten ist.',
    'John von Neumann bewies, dass sich dabei etwas Bemerkenswertes ergibt: Wenn beide Seiten Strategien mischen dürfen, trifft der beste schlechteste Fall des einen genau auf den schlechtesten besten Fall des anderen. Es gibt einen festen Wert des Spiels, den sich jeder sichern kann. Das ist der Minimax-Satz, vorgetragen 1926 und 1928 veröffentlicht.',
    'Nullsummenspiele sind im Leben selten. Handel, Arbeitsteilung und Zusammenarbeit lassen beide gewinnen. Gerade deshalb brauchte die Spieltheorie später Begriffe wie das Nash-Gleichgewicht, die mit gemeinsamen und gegensätzlichen Interessen zugleich zurechtkommen.'
  ],
  facts: [
    'Von Neumann trug den Satz 1926 in Göttingen vor; „Zur Theorie der Gesellschaftsspiele“ erschien 1928 in den Mathematischen Annalen.',
    'Im Nullsummenspiel ist der Wert des Spiels der Betrag, den sich jeder Spieler mit der besten vorsichtigen Strategie sichern kann.',
    'Der Satz gilt für Zwei-Personen-Spiele mit endlich vielen Strategien und gemischten Strategien.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Auf dem Zeitstrahl ist 1928 der erste vollständige Beweis des Minimax-Satzes, der Startpunkt der Entwicklung vom Gesellschaftsspiel zum Fach.'
  },
  exhibit: null,
  further: ['von Neumann, J. (1928). Zur Theorie der Gesellschaftsspiele. Mathematische Annalen, 100, 295–320.']
},

'gemischte-strategien': {
  id: 'gemischte-strategien',
  title: 'Gemischte Strategien: Warum Zufall klug sein kann',
  kind: 'konzept',
  journeys: ['grundmodelle'],
  icon: 'dice',
  teaser: 'Beim Elfmeter wäre berechenbar zu sein ein Fehler. Gute Spieler würfeln gewissermaßen.',
  text: [
    'Beim Elfmeter schießt der Schütze links oder rechts, der Torwart springt links oder rechts. Trifft der Torwart die richtige Ecke, hält er meist, sonst trifft der Schütze. Wer immer links schießt, wird nach ein paar Spielen durchschaut. Es gibt hier kein Gleichgewicht in reinen Strategien: Zu jeder festen Wahl gibt es eine bessere Antwort.',
    'Die Lösung ist eine gemischte Strategie: Man wählt jede Option mit einer bestimmten Wahrscheinlichkeit. Sie ist so gewählt, dass dem Gegner nichts bleibt, was er ausnutzen könnte, er ist gleichgültig zwischen seinen Optionen. Bei Stein, Schere, Papier ist das Drittel für jede Figur. Der Ökonom Ignacio Palacios-Huerta wertete 2003 gut 1.400 Elfmeter aus Spanien, Italien und England aus und fand, dass Profis recht nahe an einer solchen Mischung spielen. Kovash und Levitt (2009) fanden bei Baseball und American Football dagegen systematische Abweichungen.',
    'Das heißt nicht, dass jeder würfelt. Menschen sind schlechte Zufallsgeneratoren, und oft ist die Mischung eher die Quote vieler Spieler als der Plan eines einzelnen.'
  ],
  facts: [
    'Bei Stein, Schere, Papier besteht das Gleichgewicht darin, jede Figur mit Wahrscheinlichkeit 1/3 zu wählen.',
    'Palacios-Huerta untersuchte Elfmeter aus europäischen Ligen („Professionals Play Minimax“, Review of Economic Studies, 2003).',
    'In einer gemischten Gleichgewichtsmischung ist der Gegner zwischen seinen Optionen indifferent.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Palacios-Huerta, I. (2003). Professionals Play Minimax. Review of Economic Studies, 70(2), 395–415.']
},

'rueckwaertsinduktion': {
  id: 'rueckwaertsinduktion',
  title: 'Spielbaum und Rückwärtsinduktion: Vom Ende her denken',
  kind: 'methode',
  journeys: ['grundmodelle'],
  icon: 'ladder',
  teaser: 'Bei Zügen nacheinander löst man das Spiel vom letzten Zug her. So gewinnt man ein einfaches Zahlenspiel ohne Mühe.',
  text: [
    'Ein kleines Spiel für zwei: Abwechselnd addiert jeder eine Zahl von 1 bis 10 zu einer Summe, die bei null beginnt. Wer genau 100 erreicht, gewinnt. Wer sollte beginnen? Denk vom Ende her. Wer 89 erreicht, gewinnt, denn der andere kann höchstens auf 99 kommen, und du schließt mit 100 ab. Aber ebenso gilt: 78, 67, 56, 45, 34, 23, 12 und 1 sind die Siegfelder. Wer beginnt und 1 sagt, gewinnt bei richtigem Spiel immer.',
    'Diese Methode heißt Rückwärtsinduktion. Man zeichnet das Spiel als Baum, betrachtet die letzten Entscheidungen, wählt dort jeweils die beste Option und arbeitet sich zum Anfang zurück. Harold Kuhn formalisierte 1953 die „extensive Form“, die solche Spiele beschreibt.',
    'Die Methode setzt voraus, dass alle fehlerfrei rechnen und das auch voneinander glauben. Im Labor zeigt sich, dass Menschen oft weniger weit vorausdenken, als es die Theorie annimmt.'
  ],
  facts: [
    'In diesem Spiel sind 1, 12, 23, 34, 45, 56, 67, 78 und 89 die Gewinnzahlen; sie unterscheiden sich um 11.',
    'Harold W. Kuhn formalisierte 1953 die extensive Form für Spiele mit Zügen nacheinander.',
    'Rückwärtsinduktion liefert in endlichen Spielen mit perfekter Information stets ein Gleichgewicht.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Kuhn, H. W. (1953). Extensive Games and the Problem of Information. In: Contributions to the Theory of Games II. Princeton University Press.']
},

'glaubwuerdige-drohung': {
  id: 'glaubwuerdige-drohung',
  title: 'Glaubwürdige Drohungen und das teilspielperfekte Gleichgewicht',
  kind: 'konzept',
  journeys: ['grundmodelle', 'geschichte'],
  year: 1965,
  yearLabel: '1965',
  icon: 'exclamation',
  teaser: 'Eine Drohung, die zu erfüllen dem Drohenden selbst schadet, beeindruckt niemanden. Selten machte das präzise.',
  text: [
    'Ein Platzhirsch-Händler droht jedem Neuling: „Kommst du in meine Stadt, starte ich einen Preiskrieg.“ Steigt jemand trotzdem ein, was dann? Ein Preiskrieg kostet auch den Händler Geld, friedliche Teilung wäre für ihn besser. Der Neuling weiß das und kommt. Die Drohung war leer.',
    'Rechnet man das als Tabelle, scheint „Neuling bleibt draußen, Platzhirsch würde kämpfen“ ein Nash-Gleichgewicht, denn gekämpft wird ja nie. Reinhard Selten sah, dass dies nur auf einer unglaubwürdigen Ankündigung ruht. Er forderte 1965, dass eine Strategie auch in jedem Teil des Spiels, den man erreicht, die beste Antwort sein muss. Dieses „teilspielperfekte“ Gleichgewicht wirft leere Drohungen heraus und entspricht bei perfekter Information der Rückwärtsinduktion.',
    'In der Praxis machen Menschen Drohungen glaubwürdig, indem sie sich binden, durch Verträge, Kosten, die sich nicht rückgängig machen lassen, oder einen Ruf.'
  ],
  facts: [
    'Reinhard Selten führte das Konzept 1965 in einem Aufsatz über ein Oligopolmodell mit Nachfrageträgheit ein.',
    'Selten erhielt 1994 gemeinsam mit Nash und Harsanyi den Wirtschaftsnobelpreis.',
    'Teilspielperfekte Gleichgewichte sind immer auch Nash-Gleichgewichte, aber nicht umgekehrt.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Auf dem Zeitstrahl ist 1965 die erste große Verfeinerung nach Nash: Aus dem Gleichgewicht wird eines, das Glaubwürdigkeit verlangt, und Selten erhält dafür 1994 den Nobelpreis.'
  },
  exhibit: null,
  further: ['Selten, R. (1965). Spieltheoretische Behandlung eines Oligopolmodells mit Nachfrageträgheit. Zeitschrift für die gesamte Staatswissenschaft, 121, 301–324 und 667–689.']
},

'unvollstaendige-information': {
  id: 'unvollstaendige-information',
  title: 'Unvollständige Information: Spielen, ohne den Gegner zu kennen',
  kind: 'konzept',
  journeys: ['grundmodelle'],
  icon: 'mask',
  teaser: 'Ist der Verkäufer ehrlich, bluffst du gegen einen Pokerprofi? Harsanyi machte Unwissen rechenbar.',
  text: [
    'Du willst einen Gebrauchtwagen kaufen. Der Verkäufer kennt den Zustand, du nicht. Nennt er einen hohen Preis, weil das Auto gut ist oder weil er dich ausnutzen will? Beim Poker weißt du nicht, ob die Gegenspielerin ein starkes Blatt hat. In solchen Spielen kennt ein Spieler die Auszahlungen der anderen nicht.',
    'John Harsanyi fand in den 1960er-Jahren einen Ausweg: Man behandelt die unbekannte Eigenschaft als „Typ“, den die Natur zufällig zuteilt. Jeder kennt seinen eigenen Typ und hat eine Vorstellung davon, wie wahrscheinlich die anderen Typen sind. Damit wird aus dem unbekannten Spiel ein bekanntes mit einem Zufallszug am Anfang. Solche Bayes-Spiele sind Grundlage für die Theorie von Auktionen, Verhandlungen und Verträgen.',
    'Die Methode zeigt auch, warum Reden zählt: Preise, Angebote und Zögern verraten etwas über den Typ und werden deshalb strategisch eingesetzt. Ob Menschen so konsequent Wahrscheinlichkeiten verrechnen, ist eine offene Frage.'
  ],
  facts: [
    'Harsanyi veröffentlichte „Games with incomplete information played by Bayesian players“ 1967 und 1968 in der Zeitschrift Management Science.',
    'Harsanyi erhielt 1994 gemeinsam mit Nash und Selten den Wirtschaftsnobelpreis.',
    'Bayes-Spiele modellieren Unwissen über Eigenschaften der anderen als Wahrscheinlichkeitsverteilung über Typen.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Gibbons, R. (1992). Game Theory for Applied Economists. Princeton University Press.']
},

'wiederholte-spiele': {
  id: 'wiederholte-spiele',
  title: 'Wiederholte Spiele: Der Schatten der Zukunft',
  kind: 'konzept',
  journeys: ['grundmodelle', 'kooperation'],
  icon: 'circle-arrows',
  teaser: 'Wer sich morgen wiedersieht, betrügt heute seltener. Das Gefangenendilemma verliert seinen Schrecken.',
  text: [
    'Auf dem Wochenmarkt kauft man beim Händler, den man kennt, und nicht beim Fremden. Der Stammhändler lässt dich nicht übers Ohr hauen, weil er dich morgen wieder sieht. Spieltheoretisch ist das ein wiederholtes Spiel: Dasselbe Spiel wird mehrmals gespielt, und die Wahl heute wirkt auf die Antworten von morgen.',
    'Das ändert die Rechnung. Ist die Zukunft wichtig genug, lohnt sich Zusammenarbeit, weil Verrat künftige Gewinne kostet. Der „Folk-Satz“ sagt, dass bei unbegrenzter Wiederholung und geduldigen Spielern sehr viele Ergebnisse stabil sind, auch Kooperation im Gefangenendilemma. Das Problem: Es gibt zu viele Gleichgewichte, und die Theorie wählt keines aus.',
    'Ist das Ende bekannt, bricht alles zusammen: In der letzten Runde lohnt Verrat, also auch in der vorletzten, und so fort. Im Labor kooperieren Menschen trotzdem lange, bis kurz vor dem Ende.'
  ],
  facts: [
    'Im endlich oft wiederholten Gefangenendilemma ist Verrat in jeder Runde das einzige Gleichgewichtsergebnis (Rückwärtsinduktion).',
    'Der Folk-Satz gilt für unendlich oft oder mit unbekanntem Ende wiederholte Spiele mit hinreichend geduldigen Spielern.',
    'Robert Axelrod machte die Formulierung „Schatten der Zukunft“ für den Einfluss kommender Runden bekannt.'
  ],
  quote: null,
  myth: null,
  cross: {
    kooperation: 'Hier beginnt das Rezept gegen das Dilemma: Axelrods Turniere und Tit for Tat sind genau Experimente mit wiederholten Gefangenendilemmata.'
  },
  exhibit: null,
  further: ['Mailath, G. J. & Samuelson, L. (2006). Repeated Games and Reputations. Oxford University Press.']
}

});
})();
