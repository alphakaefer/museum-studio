// Stationen der historischen Reise „geschichte“ (Heimat-Reise), chronologisch. Schema: docs/INHALT-SCHREIBEN.md.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'waldegrave-brief': {
  id: 'waldegrave-brief',
  title: 'Waldegraves Brief: Die erste gemischte Lösung',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1713,
  yearLabel: '1713',
  icon: 'scroll',
  teaser: 'Ein Brief über ein Kartenspiel enthält die früheste bekannte Lösung eines Zwei-Personen-Spiels durch Zufallsmischung.',
  text: [
    'Das Kartenspiel „Le Her“ spielten zwei Personen: Der erste darf seine Karte behalten oder mit dem Nachbarn tauschen, der zweite darf seine behalten oder gegen eine Karte vom Stapel tauschen. Der französische Mathematiker Pierre Rémond de Montmort hatte sich in einem Buch über Glücksspiele mit der Frage befasst, wie man es am besten spielt. Am 13. November 1713 antwortete ihm der in Paris lebende Brite Waldegrave mit einem überraschenden Vorschlag: Man solle manchmal so und manchmal anders spielen, mit festen Wahrscheinlichkeiten.',
    'Das ist die erste bekannte Lösung eines Spiels mit einer gemischten Strategie. Waldegrave sah den Haken selbst: Ein Zufallsentscheid, schrieb er sinngemäß, stehe nicht in den üblichen Regeln des Spiels. Er erweiterte den Gedanken nicht auf andere Spiele, und lange folgte nichts daraus.',
    'Erst in den 1920er-Jahren griffen Borel und von Neumann den Gedanken auf; von Neumann bewies 1928, dass solche Mischungen in jedem endlichen Zwei-Personen-Nullsummenspiel zum Ziel führen. Waldegraves Brief zeigt, wie früh die Grundidee der Spieltheorie im Kleinen auftauchte.'
  ],
  facts: [
    'Waldegraves Brief an Montmort trägt das Datum 13. November 1713.',
    'Er behandelte eine Zwei-Personen-Variante des Kartenspiels Le Her.',
    'Montmort leitete die Lösung an Nicolas Bernoulli weiter.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Bellhouse, D. R. & Fillion, N. (2015). Le Her and Other Problems in Probability Discussed by Bernoulli, Montmort and Waldegrave. Statistical Science, 30(1).']
},

'cournot-duopol': {
  id: 'cournot-duopol',
  title: 'Cournot: Zwei Unternehmen, ein Markt',
  kind: 'person',
  journeys: ['geschichte'],
  year: 1838,
  yearLabel: '1838',
  icon: 'pen',
  teaser: 'Ein französischer Mathematiker beschreibt 1838 ein Gleichgewicht, 112 Jahre bevor Nash seinen Namen daran hängt.',
  text: [
    'Zwei Besitzer von Mineralquellen verkaufen dasselbe Wasser. Jeder entscheidet, wie viel er anbietet; der Preis ergibt sich aus der Gesamtmenge. Antoine Augustin Cournot stellte sich 1838 in seinen „Recherches sur les principes mathématiques de la théorie des richesses“ die Frage, wohin das führt. Seine Antwort: Jeder wählt die Menge, die für ihn am besten ist, wenn er die Menge des anderen als gegeben nimmt. Das Ergebnis ist ein Zustand, in dem keiner allein etwas ändern will.',
    'Das ist ein Nash-Gleichgewicht, mehr als ein Jahrhundert vor von Neumann und Morgenstern. Heute heißt es Cournot-Gleichgewicht. Im einfachsten Modell liegen Menge und Gewinn zwischen Monopol und vollkommenem Wettbewerb: Die Anbieter verdienen mehr, als bei Konkurrenz um den Preis, aber weniger, als wenn sie sich absprächen.',
    'Das Buch fand zunächst wenig Beachtung. Erst später entdeckten Ökonomen, dass hier das Denken in Gegenzügen schon vorgeformt war.'
  ],
  facts: [
    'Cournots „Recherches sur les principes mathématiques de la théorie des richesses“ erschien 1838.',
    'Das Cournot-Gleichgewicht ist das Nash-Gleichgewicht eines Mengenwettbewerbs.',
    'Zwischen Cournots Buch und Nashs Aufsatz liegen 112 Jahre.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Cournot, A. A. (1838). Recherches sur les principes mathématiques de la théorie des richesses. Hachette.']
},

'theory-of-games': {
  id: 'theory-of-games',
  title: 'Von Neumann und Morgenstern: Das Buch von 1944',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1944,
  yearLabel: '1944',
  icon: 'book',
  teaser: 'Ein Mathematiker und ein Ökonom machen aus einer Idee ein ganzes Fach.',
  text: [
    'Der Mathematiker John von Neumann und der Ökonom Oskar Morgenstern trafen sich in Princeton. Morgenstern suchte eine Mathematik für das Zusammenspiel wirtschaftlicher Entscheidungen, von Neumann hatte 1928 eine Theorie der Gesellschaftsspiele geschrieben. Das gemeinsame Ergebnis erschien 1944 bei Princeton University Press: „Theory of Games and Economic Behavior“.',
    'Das Buch baut die Theorie der Nullsummenspiele aus, behandelt Spiele mit mehr als zwei Personen und Koalitionen und legt eine Axiomatik des Nutzens vor (in der zweiten Auflage 1947 im Anhang ausgearbeitet): Wer bestimmte Bedingungen an seine Entscheidungen erfüllt, verhält sich, als maximiere er einen erwarteten Nutzen. Diese „von-Neumann-Morgenstern-Nutzentheorie“ ist bis heute eine Grundlage der Entscheidungstheorie, auch wenn Experimente Abweichungen zeigen.',
    'Die Begeisterung war groß, die Erwartungen auch. Nicht alle wurden erfüllt: Die Konzentration auf Nullsummenspiele und Koalitionen passte schlecht zu vielen Konflikten, und die Weiterentwicklung kam von Nash und anderen.'
  ],
  facts: [
    '„Theory of Games and Economic Behavior“ erschien 1944 bei Princeton University Press.',
    'Die Herleitung der Erwartungsnutzentheorie aus Axiomen steht im Anhang der zweiten Auflage (1947).',
    'Oskar Morgenstern (1902–1977) stammte aus Görlitz und lehrte in Wien und Princeton.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['von Neumann, J. & Morgenstern, O. (1944). Theory of Games and Economic Behavior. Princeton University Press.']
},

'vickrey-auktion': {
  id: 'vickrey-auktion',
  title: 'Vickrey-Auktion: Ehrlich bieten lohnt sich',
  kind: 'konzept',
  journeys: ['geschichte', 'grundmodelle'],
  year: 1961,
  yearLabel: '1961',
  icon: 'ticket',
  teaser: 'Wer gewinnt, zahlt nur den zweithöchsten Preis. Damit ist Ehrlichkeit die beste Strategie.',
  text: [
    'Bei einer verdeckten Auktion schreibt jeder sein Gebot auf einen Zettel. Der Höchstbietende erhält den Zuschlag, zahlt aber nur das zweithöchste Gebot. Das wirkt wie ein Geschenk, ist aber ein kluger Trick. Angenommen, dir ist das Bild 100 Euro wert. Bietest du mehr, riskierst du, es teurer zu bezahlen als es dir wert ist. Bietest du weniger, verlierst du womöglich eine Auktion, die du bei 100 gewonnen hättest. Dein Gebot bestimmt nur, ob du gewinnst, nicht, was du zahlst. Ehrlich zu bieten ist daher eine (schwach) dominante Strategie.',
    'William Vickrey analysierte diese Auktionsform 1961 in „Counterspeculation, Auctions, and Competitive Sealed Tenders“. Für seine Arbeiten zu Anreizen bei ungleicher Information erhielt er 1996 den Wirtschaftsnobelpreis (mit James Mirrlees). Die Vickrey-Auktion ist ein früher Schritt zum Mechanismusdesign: Man legt Regeln so fest, dass Ehrlichkeit sich lohnt.',
    'Rein ist sie selten: Plattformen wie eBay arbeiten mit Höchstgeboten ähnlich, und Werbeauktionen im Internet nutzen Abwandlungen. Ehrliches Bieten ist dort nicht garantiert.'
  ],
  facts: [
    'William Vickrey veröffentlichte die Analyse 1961 im Journal of Finance.',
    'Vickrey erhielt 1996 gemeinsam mit James Mirrlees den Wirtschaftsnobelpreis.',
    'In der Vickrey-Auktion ist wahrheitsgemäßes Bieten eine schwach dominante Strategie.'
  ],
  quote: null,
  myth: null,
  cross: {
    grundmodelle: 'Hier trifft ein Auktionsformat auf den Begriff der Dominanz: Ehrlich zu bieten ist gegen jedes Gebot der anderen mindestens so gut wie jede Alternative.'
  },
  exhibit: null,
  further: ['Vickrey, W. (1961). Counterspeculation, Auctions, and Competitive Sealed Tenders. Journal of Finance, 16(1), 8–37.']
},

'nobelpreis-1994': {
  id: 'nobelpreis-1994',
  title: 'Nash, Harsanyi, Selten: Der Nobelpreis 1994',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1994,
  yearLabel: '1994',
  icon: 'star',
  teaser: 'Die Spieltheorie wird als Fach geehrt. Drei Köpfe, drei Heimatländer, ein Preis.',
  text: [
    'Im Oktober 1994 erhielten John Nash, John Harsanyi und Reinhard Selten den Preis der Schwedischen Reichsbank für Wirtschaftswissenschaften zum Gedenken an Alfred Nobel, kurz den Wirtschaftsnobelpreis. Die Begründung nannte ihre bahnbrechende Analyse von Gleichgewichten in nichtkooperativen Spielen.',
    'Jeder stand für einen Baustein: Nash für das Gleichgewicht von 1950, Harsanyi für Spiele mit unvollständiger Information, Selten für Verfeinerungen wie das teilspielperfekte Gleichgewicht. Nash hatte lange schwer mit einer psychischen Erkrankung zu kämpfen, sein Leben wurde später verfilmt. Der Preis war ein Signal an die Wirtschaftswissenschaft: Spieltheorie ist Kernhandwerk.',
    'Es folgten weitere Preise für das Fach: 1996 Vickrey und Mirrlees, 2005 Aumann und Schelling, 2007 Hurwicz, Maskin und Myerson für Mechanismusdesign, 2020 Milgrom und Wilson für Auktionstheorie.'
  ],
  facts: [
    'Der Preis 1994 ging an John F. Nash Jr., John C. Harsanyi und Reinhard Selten.',
    '2005 erhielten Robert Aumann und Thomas Schelling den Preis für ihre spieltheoretische Analyse von Konflikt und Kooperation.',
    '2007 wurden Hurwicz, Maskin und Myerson für die Grundlagen der Mechanismentheorie ausgezeichnet.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Nasar, S. (1998). A Beautiful Mind. Simon & Schuster.']
}

});
})();
