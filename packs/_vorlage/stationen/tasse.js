// Muster-Stationen der Reise „tasse“ (Heimat-Reise = erster Eintrag in "journeys").
// Schema: docs/INHALT-SCHREIBEN.md (Datenformat: docs/ARCHITEKTUR.md, Abschnitt 3.4). Jede Station nur einmal im ganzen Paket.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'kaffeepflanze': {
  id: 'kaffeepflanze',
  title: 'Die Kaffeepflanze: Eine Frucht mit zwei Samen',
  kind: 'konzept',
  journeys: ['tasse'],
  icon: 'seed',
  teaser: 'Was als braune Bohne im Regal liegt, ist der Kern einer roten Frucht, die an einem Strauch wächst.',
  text: [
    'Kaffee wächst nicht als Bohne, sondern als Kirsche. Die Pflanzen gehören zur Gattung Coffea, immergrünen Sträuchern und kleinen Bäumen aus den Tropen. Ihre weißen, stark duftenden Blüten halten nur kurz, danach reifen die Früchte heran. Reif sind sie meist leuchtend rot, manche Sorten werden gelb.',
    'Im Inneren der Kaffeekirsche liegen in der Regel zwei Samen, die sich mit ihren flachen Seiten berühren. Das sind die „Bohnen“, obwohl sie botanisch mit Hülsenfrüchten nichts zu tun haben. Ein junger Strauch trägt meist erst nach drei bis vier Jahren zum ersten Mal Früchte.',
    'Die Gattung umfasst über hundert Arten, wirtschaftlich spielen aber nur zwei eine große Rolle, die auf der nächsten Station vorgestellt werden. Dass Kaffee ein Obst-Nebenprodukt ist, überrascht viele: Das Fruchtfleisch ist essbar, wird aber meist nur als Abfall oder als Rohstoff für Tees und Zusätze verwendet.'
  ],
  facts: [
    'Die Gattung Coffea umfasst über hundert beschriebene Arten.',
    'Eine Kaffeekirsche enthält meist zwei Samen, selten nur einen („Perlbohne“).',
    'Ein Kaffeestrauch trägt in der Regel nach drei bis vier Jahren erstmals Früchte.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Clifford, M. N. & Willson, K. C. (Hrsg.) (1985). Coffee: Botany, Biochemistry and Production of Beans and Beverage.']
},

'kaldi-legende': {
  id: 'kaldi-legende',
  title: 'Kaldi und die tanzenden Ziegen',
  kind: 'mythos',
  journeys: ['tasse', 'geschichte'],
  year: 1671,
  yearLabel: '1671',
  icon: 'question',
  teaser: 'Ein Ziegenhirte beobachtet seine Tiere und entdeckt den Kaffee. Eine schöne Geschichte, aber keine belegte.',
  text: [
    'Die bekannteste Entstehungsgeschichte des Kaffees geht so: Ein äthiopischer Ziegenhirte namens Kaldi bemerkt, dass seine Tiere nach dem Fressen bestimmter roter Beeren aufgedreht umhertollen. Er probiert selbst, wird munter und erzählt es einem Mönch, der daraus ein Getränk bereitet, um nachts wach zu bleiben.',
    'Als Erklärung taugt das wenig. Die erste bekannte schriftliche Fassung wird meist auf das Jahr 1671 datiert, also weit nach den ersten belegten Kaffeetrinkern im Jemen. Die Geschichte erzählt also eher, was spätere Zeiten sich über die Herkunft des Getränks vorstellten, als was damals geschah.',
    'Wahr ist immerhin, dass die Wildform des Arabica-Kaffees im Hochland des heutigen Äthiopien zu Hause ist. Wer wann zum ersten Mal die Früchte kochte oder die Samen röstete, wissen wir nicht. Legenden dieser Art verraten viel über die Wirkung, die man dem Kaffee zuschrieb: Wachheit, fast schon etwas Magisches.'
  ],
  facts: [
    'Die Kaldi-Erzählung ist erst im 17. Jahrhundert schriftlich überliefert.',
    'Arabica-Kaffee stammt ursprünglich aus dem Hochland Äthiopiens.',
    'Die ersten sicher belegten Kaffeetrinker lebten im 15. Jahrhundert im Jemen.'
  ],
  quote: null,
  myth: {
    glaube: 'Ein Ziegenhirte namens Kaldi hat den Kaffee entdeckt, weil seine Ziegen munter wurden.',
    wahrheit: 'Die Geschichte ist erst über zweihundert Jahre nach den ersten belegten Kaffeetrinkern aufgeschrieben worden und gilt als Legende. Belegt ist nur die äthiopische Herkunft der Pflanze.'
  },
  cross: {
    'geschichte': 'Hier zeigt sich, wie spät und wie ausgeschmückt Herkunftsgeschichten oft entstehen, ein guter Gegenpol zu den belegten Stationen der Geschichte des Kaffees.'
  },
  exhibit: null,
  further: ['Pendergrast, M. (2010). Uncommon Grounds: The History of Coffee and How It Transformed Our World.']
},

'arabica-robusta': {
  id: 'arabica-robusta',
  title: 'Arabica und Robusta: Zwei Arten, zwei Charaktere',
  kind: 'konzept',
  journeys: ['tasse'],
  icon: 'leaf',
  teaser: 'Fast aller Kaffee der Welt stammt von zwei Pflanzenarten, die sich in Geschmack, Koffein und Anspruch unterscheiden.',
  text: [
    'Coffea arabica und Coffea canephora, im Handel „Robusta“ genannt, liefern zusammen fast den gesamten Kaffee der Welt. Arabica gilt als die feinere Art: Sie wächst meist in Höhenlagen, reift langsam und schmeckt oft fruchtiger, säurebetonter und milder. Sie ist allerdings anfälliger für Krankheiten und Hitze.',
    'Robusta kommt mit tieferen Lagen, mehr Wärme und mehr Schädlingen zurecht. Ihr Geschmack ist kräftiger, herber und oft erdig oder nussig, und die Bohnen enthalten deutlich mehr Koffein. Deshalb steckt Robusta in vielen Espressomischungen und in löslichem Kaffee.',
    'Was „besser“ ist, hängt vom Zweck ab. Ein sorgfältig angebauter Robusta kann überzeugen, ein schlecht verarbeiteter Arabica enttäuscht. Die Art sagt nur etwas über die Anlagen, nicht über das Ergebnis, denn Lage, Ernte und Röstung entscheiden mit.'
  ],
  facts: [
    'Arabica enthält grob 1 bis 1,5 Prozent Koffein, Robusta etwa 2 bis 2,5 Prozent.',
    'Arabica macht den größeren Teil der Weltproduktion aus, Robusta den Rest.',
    'Robusta ist widerstandsfähiger gegen Hitze und Krankheiten als Arabica.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Hoffmann, J. (2018). The World Atlas of Coffee. 2. Auflage.']
},

'palheta-brasilien': {
  id: 'palheta-brasilien',
  title: 'Palheta und der Weg nach Brasilien',
  kind: 'ereignis',
  journeys: ['tasse', 'geschichte'],
  year: 1727,
  yearLabel: '1727',
  icon: 'map',
  teaser: 'Wenige Samen und Setzlinge bringen Kaffee in ein Land, das später die halbe Welt damit versorgt.',
  text: [
    'Im Jahr 1727 reist der brasilianische Offizier Francisco de Melo Palheta in die Grenzregion zu Französisch-Guayana. Er kommt, so wird es überliefert, mit Kaffeesamen und Setzlingen zurück, und zwar mithilfe diplomatischen Geschicks. Über Details der Geschichte streiten Historiker, etwa über die oft erzählte Blumenstrauß-Version.',
    'Sicher ist: Von Pará im Norden breitete sich der Kaffeeanbau in Brasilien aus. Im 19. Jahrhundert wurde er zum Rückgrat der Wirtschaft, vor allem im Süden des Landes. Mitte des Jahrhunderts stammte rund die Hälfte des Weltkaffees aus Brasilien.',
    'Der Aufschwung hatte eine dunkle Seite. Die Plantagen beruhten über Jahrzehnte auf Sklavenarbeit; Brasilien schaffte die Sklaverei erst 1888 ab. Wer heute fragt, warum Kaffee so lange billig war, stößt hier auf eine der Ursachen.'
  ],
  facts: [
    'Der Überlieferung nach brachte Francisco de Melo Palheta 1727 Kaffeepflanzen nach Brasilien.',
    'Brasilien ist seit dem 19. Jahrhundert der größte Kaffeeproduzent der Welt.',
    'Die Sklaverei wurde in Brasilien erst 1888 abgeschafft.'
  ],
  quote: null,
  myth: null,
  cross: {
    'geschichte': 'Ein einzelnes Ereignis von 1727 verändert Landwirtschaft, Handel und Gesellschaft eines ganzen Kontinents, ein Wendepunkt in der Geschichte des Kaffees.'
  },
  exhibit: null,
  further: ['Topik, S. & Clarence-Smith, W. G. (Hrsg.) (2003). The Global Coffee Economy in Africa, Asia, and Latin America, 1500–1989.']
},

'anbaugebiete': {
  id: 'anbaugebiete',
  title: 'Der Kaffeegürtel: Wo Kaffee wächst',
  kind: 'ort',
  journeys: ['tasse'],
  icon: 'compass',
  teaser: 'Kaffee wächst fast nur zwischen den Wendekreisen, und Herkunft prägt den Geschmack.',
  text: [
    'Kaffee braucht milde Temperaturen, ausreichend Regen und möglichst keinen Frost. Deshalb liegen fast alle Anbaugebiete zwischen dem nördlichen und dem südlichen Wendekreis, im sogenannten Kaffeegürtel. Er reicht von Mittel- und Südamerika über Ostafrika bis nach Südostasien.',
    'Brasilien liefert seit langem den größten Anteil der Weltproduktion. Vietnam ist vor allem als Erzeuger von Robusta bekannt, Kolumbien und Äthiopien für Arabica. Die Höhe spielt eine große Rolle: In höheren, kühleren Lagen reifen die Früchte langsamer, was oft zu einem komplexeren Geschmack führt.',
    'Boden, Klima und Verarbeitung ergeben zusammen die „Herkunft“ im Geschmack. Im Hochland von Äthiopien schmeckt Kaffee oft blumig oder fruchtig, in Brasilien eher nussig und schokoladig. Das sind Tendenzen, keine Regeln, denn auch innerhalb eines Landes unterscheiden sich Lagen und Betriebe stark.'
  ],
  facts: [
    'Fast der gesamte Kaffee wächst zwischen dem nördlichen und dem südlichen Wendekreis.',
    'Brasilien ist seit Langem der größte Erzeuger, Vietnam der größte Robusta-Erzeuger.',
    'Höhere Lagen bringen die Früchte oft langsamer zur Reife.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Hoffmann, J. (2018). The World Atlas of Coffee. 2. Auflage.']
},

'ernte-aufbereitung': {
  id: 'ernte-aufbereitung',
  title: 'Ernte und Aufbereitung: Von der Kirsche zum Rohkaffee',
  kind: 'methode',
  journeys: ['tasse'],
  icon: 'hand',
  teaser: 'Bevor eine Bohne geröstet wird, muss sie aus der Frucht gelöst und getrocknet werden, auf verschiedenen Wegen.',
  text: [
    'Kaffeekirschen an einem Strauch reifen nicht gleichzeitig. Beim selektiven Pflücken erntet man von Hand nur die reifen Früchte und geht mehrmals durch die Reihen. Beim Abstreifen oder maschinell erntet man alles auf einmal, schneller und billiger, aber mit mehr unreifen Früchten in der Ernte.',
    'Danach muss das Fruchtfleisch weg. Bei der trockenen („natürlichen“) Aufbereitung trocknen die ganzen Kirschen in der Sonne, und die Bohnen nehmen dabei viel Fruchtaroma auf. Bei der nassen („gewaschenen“) Aufbereitung entfernt man das Fruchtfleisch früh und trocknet die Bohnen in ihrer Pergamenthülle, was meist klarere, säurebetonte Aromen ergibt.',
    'Am Ende steht der Rohkaffee mit einer Restfeuchte von etwa zehn bis zwölf Prozent. Er hält sich monatelang und riecht noch kaum nach Kaffee. Dieser Geruch entsteht erst bei der Röstung.'
  ],
  facts: [
    'Beim selektiven Pflücken werden nur reife Kirschen von Hand geerntet.',
    'Natürliche Aufbereitung trocknet die ganze Kirsche, gewaschene löst das Fruchtfleisch vorher ab.',
    'Rohkaffee wird auf etwa 10 bis 12 Prozent Restfeuchte getrocknet.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Hoffmann, J. (2018). The World Atlas of Coffee. 2. Auflage.']
},

'roestung': {
  id: 'roestung',
  title: 'Die Röstung: Wo das Aroma entsteht',
  kind: 'methode',
  journeys: ['tasse'],
  icon: 'flask',
  teaser: 'Aus grünen, fast geruchlosen Samen werden in wenigen Minuten hunderte Aromastoffe.',
  text: [
    'Rohkaffee ist grünlich, hart und riecht grasig. Beim Rösten bei grob 180 bis 240 Grad Celsius laufen in zehn bis zwanzig Minuten viele chemische Reaktionen ab. Die Bohnen verlieren Wasser, verlieren zwölf bis zwanzig Prozent ihres Gewichts und werden größer und poröser. Zuerst werden sie gelb, dann braun.',
    'Zwei Vorgänge prägen das Aroma: die Maillard-Reaktion, bei der Zucker und Aminosäuren reagieren, und die Karamellisierung. Dabei entstehen mehrere hundert Aromastoffe. Ein erstes hörbares Knacken zeigt, dass sich die Bohnen ausdehnen und Wasserdampf entweicht.',
    'Helle Röstungen schmecken meist fruchtiger und säurebetonter, dunkle bitterer und rauchiger. Der Koffeingehalt ändert sich beim Rösten kaum. Dass dunkler Kaffee „stärker“ sei, bezieht sich auf den Geschmack, nicht auf die Wirkung.'
  ],
  facts: [
    'Beim Rösten verlieren die Bohnen etwa 12 bis 20 Prozent ihres Gewichts, vor allem Wasser.',
    'Maillard-Reaktion und Karamellisierung erzeugen mehrere hundert Aromastoffe.',
    'Der Koffeingehalt bleibt beim Rösten weitgehend erhalten.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Rao, S. (2014). The Coffee Roaster’s Companion.']
},

'mahlgrad': {
  id: 'mahlgrad',
  title: 'Mahlgrad und Extraktion: Warum fein nicht gleich stark ist',
  kind: 'konzept',
  journeys: ['tasse'],
  icon: 'gear',
  teaser: 'Wie fein Kaffee gemahlen wird, entscheidet, wie viel das Wasser herauslöst, und damit über bitter oder sauer.',
  text: [
    'Beim Brühen löst heißes Wasser Stoffe aus dem Kaffeemehl. Je feiner das Mehl, desto größer ist die Oberfläche und desto schneller geht es. Zu fein oder zu lange: Es werden auch bittere Stoffe herausgelöst, der Kaffee schmeckt herb und trocken. Zu grob oder zu kurz: Der Kaffee schmeckt dünn und sauer, weil Wichtiges fehlt.',
    'Fachleute sprechen von Über- und Unterextraktion. Als Richtwert gelten 18 bis 22 Prozent der Kaffeemasse, die ins Getränk übergehen. Daran lässt sich das Rezept justieren: Mahlgrad, Wassertemperatur, Zeit und Menge hängen zusammen.',
    'Kaffee verliert nach dem Mahlen schnell Aroma, weil die Oberfläche groß ist und Aromastoffe verfliegen. Darum lohnt es sich, Bohnen erst kurz vor dem Brühen zu mahlen. Wichtiger als jede Regel ist, zu probieren und eine Stellschraube nach der anderen zu ändern.'
  ],
  facts: [
    'Als Richtwert gelten 18 bis 22 Prozent der Kaffeemasse, die in die Tasse gelangen.',
    'Zu feine oder zu lange Extraktion macht Kaffee bitter, zu grobe macht ihn sauer und dünn.',
    'Gemahlener Kaffee verliert sein Aroma deutlich schneller als ganze Bohnen.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Rao, S. (2010). Everything but Espresso: Professional Coffee Brewing Techniques.']
},

'koffein': {
  id: 'koffein',
  title: 'Koffein: Wie ein Molekül wach hält',
  kind: 'konzept',
  journeys: ['tasse'],
  icon: 'brain',
  teaser: 'Koffein macht nicht munter, es verdeckt Müdigkeit. Das ist ein feiner Unterschied.',
  text: [
    'Im Gehirn sammelt sich über den Tag ein Botenstoff namens Adenosin an. Er bindet an Rezeptoren und signalisiert Müdigkeit. Koffein ähnelt Adenosin in seiner Form, setzt sich an dieselben Rezeptoren und blockiert sie, ohne sie zu aktivieren. Die Müdigkeit ist damit nicht verschwunden, nur das Signal kommt gedämpft an.',
    'Koffein wird nach der Aufnahme innerhalb von etwa einer halben bis einer Stunde im Blut wirksam. Die Halbwertszeit liegt bei gesunden Erwachsenen im Mittel bei etwa fünf Stunden, mit großen Unterschieden. Wer abends noch Kaffee trinkt, schläft deshalb oft schlechter.',
    'Als Orientierung nennt die Europäische Behörde für Lebensmittelsicherheit für gesunde Erwachsene bis zu 400 Milligramm pro Tag als unbedenklich, für Schwangere 200 Milligramm. Eine Tasse Filterkaffee enthält je nach Zubereitung grob 80 bis 100 Milligramm. Das ist Allgemeinwissen, keine persönliche Beratung.'
  ],
  facts: [
    'Koffein blockiert Adenosin-Rezeptoren im Gehirn und dämpft so das Müdigkeitssignal.',
    'Die Halbwertszeit von Koffein beträgt bei gesunden Erwachsenen im Mittel etwa fünf Stunden.',
    'Die EFSA nennt für gesunde Erwachsene bis zu 400 mg Koffein pro Tag als unbedenklich.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Weinberg, B. A. & Bealer, B. K. (2001). The World of Caffeine: The Science and Culture of the World’s Most Popular Drug.']
}

});
})();
