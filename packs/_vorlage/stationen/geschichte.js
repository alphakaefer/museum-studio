// Muster-Stationen der historischen Reise „geschichte“. Historische Stationen brauchen year (Zahl, v. Chr. negativ) und yearLabel;
// die Reihenfolge in plan.json "orders" muss chronologisch sein.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'jemen-sufi': {
  id: 'jemen-sufi',
  title: 'Jemen: Wachbleiben für die Nacht',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1450,
  yearLabel: 'um 1450',
  icon: 'moon',
  teaser: 'Die ersten belegten Kaffeetrinker waren Gläubige, die nachts wach bleiben wollten.',
  text: [
    'Die frühesten verlässlichen Hinweise auf das Kaffeetrinken stammen aus dem Jemen und werden meist ins 15. Jahrhundert datiert. Dort tranken Anhänger sufischer Gemeinschaften ein Getränk aus den Kaffeefrüchten, um bei nächtlichen Gebeten und Zeremonien wach zu bleiben.',
    'Über den Hafen von Mokka am Roten Meer gelangte der Kaffee in die Welt. Der Name der Stadt lebt bis heute in „Mokka“ weiter. Lange hielt der Jemen ein faktisches Monopol, denn Kaffeepflanzen und fruchtbare Samen wurden nicht ohne Weiteres ausgeführt.',
    'Wie genau sich der Kaffee zuvor aus Äthiopien in den Jemen verbreitete, ist unklar. Die Quellenlage ist dünn, und vieles, was erzählt wird, stammt aus späteren Jahrhunderten. Das sollte man im Hinterkopf behalten, wenn Jahreszahlen allzu genau klingen.'
  ],
  facts: [
    'Erste verlässliche Belege für Kaffeetrinken stammen aus dem Jemen des 15. Jahrhunderts.',
    'Der Hafen Mokka am Roten Meer war lange ein wichtiger Umschlagplatz für Kaffee.',
    'Sufi-Gemeinschaften nutzten Kaffee, um bei nächtlichen Zeremonien wach zu bleiben.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Hattox, R. S. (1985). Coffee and Coffeehouses: The Origins of a Social Beverage in the Medieval Near East.']
},

'mekka-verbot': {
  id: 'mekka-verbot',
  title: 'Mekka 1511: Das erste Kaffeeverbot',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1511,
  yearLabel: '1511',
  icon: 'lock',
  teaser: 'Kaum hat sich Kaffee verbreitet, wird er verboten. Der Streit begleitet das Getränk seitdem.',
  text: [
    'Im Jahr 1511 ließ der Stadtverwalter von Mekka, Khair Beg, Kaffeeausschank verbieten. Er sah in den Zusammenkünften in Kaffeehäusern eine Gefahr für Ordnung und Sitte, und Rechtsgelehrte diskutierten, ob das Getränk berauschend und damit verboten sei.',
    'Das Verbot hielt nicht lange. Der Sultan in Kairo, dem Mekka damals unterstand, soll es aufgehoben haben, und der Kaffee blieb. Spätere Herrscher erließen immer wieder ähnliche Verbote, etwa im Osmanischen Reich, mit wechselndem Erfolg.',
    'Das Muster wiederholt sich in Europa: Ein neues Genussmittel verändert, wo und wie Menschen zusammenkommen, und weckt Misstrauen bei Obrigkeiten. Kaffeehäuser waren Orte, an denen Menschen miteinander sprachen, Neuigkeiten austauschten und mitunter Politik diskutierten.'
  ],
  facts: [
    'Der Stadtverwalter Khair Beg ließ 1511 den Kaffeeausschank in Mekka verbieten.',
    'Das Verbot wurde nach kurzer Zeit auf Anordnung aus Kairo aufgehoben.',
    'Auch später gab es immer wieder Verbote von Kaffee und Kaffeehäusern.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Hattox, R. S. (1985). Coffee and Coffeehouses: The Origins of a Social Beverage in the Medieval Near East.']
},

'kaffeehaus-oxford': {
  id: 'kaffeehaus-oxford',
  title: 'Oxford 1650: Das Kaffeehaus kommt nach England',
  kind: 'ort',
  journeys: ['geschichte'],
  year: 1650,
  yearLabel: '1650',
  icon: 'house',
  teaser: 'Für einen Penny Eintritt und eine Tasse bekam man Gespräche. Kaffeehäuser wurden zu Orten des Austauschs.',
  text: [
    'Quellen nennen das Jahr 1650 für das erste Kaffeehaus in England, in Oxford. Wenige Jahre später, 1652, folgte eines in London. Aus dem Osmanischen Reich und über den Handel mit Venedig war das Getränk nach Europa gekommen, zuerst als Kuriosität.',
    'Kaffeehäuser waren anders als Wirtshäuser: Es gab meist keinen Alkohol, man blieb nüchtern, las Zeitungen und redete über Handel, Wissenschaft und Politik. Später wurde gern gesagt, man habe dort für einen Penny „Bildung“ bekommen, daher der Spitzname „Penny Universities“.',
    'Wie stark diese Orte die Aufklärung wirklich beförderten, ist unter Historikern Thema von Diskussionen. Fest steht, dass sie neue Formen der Öffentlichkeit schufen: Man traf sich, ohne Mitglied einer Gilde oder eines Hofes zu sein.'
  ],
  facts: [
    'Das erste englische Kaffeehaus wird meist auf 1650 in Oxford datiert, ein Londoner folgte 1652.',
    'In Kaffeehäusern wurde meist kein Alkohol ausgeschenkt, man las dort Zeitungen und diskutierte.',
    'Der Spitzname „Penny Universities“ stammt aus späteren Erzählungen.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Cowan, B. (2005). The Social Life of Coffee: The Emergence of the British Coffeehouse.']
},

'lloyds-coffee-house': {
  id: 'lloyds-coffee-house',
  title: 'Lloyd’s Coffee House: Wo Versicherung begann',
  kind: 'ort',
  journeys: ['geschichte'],
  year: 1688,
  yearLabel: '1688',
  icon: 'compass',
  teaser: 'Aus einem Londoner Kaffeehaus, in dem man Schiffsnachrichten tauschte, wurde ein Weltmarkt für Versicherungen.',
  text: [
    'Das Kaffeehaus von Edward Lloyd in London ist seit den späten 1680er Jahren belegt, meist wird 1688 genannt. Es lag nahe am Hafen und wurde ein Treffpunkt für Kapitäne, Reeder und Kaufleute, die Nachrichten über Schiffe und Ladungen austauschten.',
    'Wer ein Schiff oder seine Fracht absichern wollte, fand hier Menschen, die für eine Prämie einen Teil des Risikos übernahmen. Solche Zusammenkünfte entwickelten sich im Lauf der Zeit zu einem Versicherungsmarkt. Aus dem Namen wurde die spätere Institution Lloyd’s of London.',
    'Das Kaffeehaus war dabei weniger Ursache als Bühne: Entscheidend waren Informationen, Vertrauen und Regeln. Aber der Ort zeigt, wie ein Getränk Räume schafft, in denen sich Handel und Wissen verdichten.'
  ],
  facts: [
    'Edward Lloyds Kaffeehaus in London ist seit den späten 1680er Jahren belegt.',
    'Dort trafen sich Kaufleute, Reeder und Kapitäne, um Schiffsnachrichten und Risiken zu besprechen.',
    'Aus diesem Umfeld entwickelte sich der Versicherungsmarkt Lloyd’s of London.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Cowan, B. (2005). The Social Life of Coffee: The Emergence of the British Coffeehouse.']
},

'bach-kaffeekantate': {
  id: 'bach-kaffeekantate',
  title: 'Bachs Kaffeekantate: Eine Tochter will ihren Kaffee',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1734,
  yearLabel: 'um 1734',
  icon: 'wave',
  teaser: 'Johann Sebastian Bach vertonte einen Familienstreit um den Kaffee, halb Scherz, halb Gesellschaftsbild.',
  text: [
    'Um 1734 entstand in Leipzig die weltliche Kantate „Schweigt stille, plaudert nicht“, heute als Kaffeekantate (BWV 211) bekannt. Der Text stammt von Picander, die Musik von Johann Sebastian Bach. Aufgeführt wurde sie wohl im Leipziger Zimmermannschen Kaffeehaus, wo das Collegium Musicum regelmäßig spielte.',
    'Die Handlung ist ein kleines Theaterstück: Vater Schlendrian verbietet seiner Tochter Lieschen den Kaffee, sie aber schwärmt für das Getränk und will sich nicht fügen. Am Ende verspricht der Vater ihr einen Ehemann, doch Lieschen setzt durch, dass sie ihren Kaffee auch weiter trinken darf.',
    'Das Stück zeigt, wie fest Kaffee im 18. Jahrhundert schon im Alltag angekommen war. Zugleich spielt es mit den Vorurteilen jener Zeit: Wer Kaffee trank, galt in manchen Kreisen als zügellos. Bach gestaltet daraus eine heitere, genau gearbeitete Musik.'
  ],
  facts: [
    'Die Kaffeekantate trägt die Nummer BWV 211 im Werkverzeichnis von Bach.',
    'Der Text stammt von Picander (Christian Friedrich Henrici).',
    'Die Uraufführung fand vermutlich im Leipziger Zimmermannschen Kaffeehaus statt.'
  ],
  quote: { text: 'Ei! wie schmeckt der Coffee süße, lieblicher als tausend Küsse, milder als Muskatenwein.', who: 'Picander (Text), Johann Sebastian Bach (Musik)', src: 'Kaffeekantate BWV 211, um 1734' },
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Wolff, C. (2000). Johann Sebastian Bach: The Learned Musician.']
},

'bezzera-espresso': {
  id: 'bezzera-espresso',
  title: 'Bezzera und die erste Espressomaschine',
  kind: 'instrument',
  journeys: ['geschichte', 'tasse'],
  year: 1901,
  yearLabel: '1901',
  icon: 'gear',
  teaser: 'Wer Kaffee schneller servieren wollte, ließ Dampf und Druck die Arbeit übernehmen.',
  text: [
    'Schon 1884 ließ Angelo Moriondo in Turin eine Dampfmaschine für Kaffee patentieren. Luigi Bezzera in Mailand verbesserte das Prinzip und meldete 1901 ein Patent an: Heißes Wasser und Dampfdruck pressen das Wasser schnell durch gemahlenen Kaffee, ein Getränk pro Tasse in Sekunden statt in Minuten.',
    'Desiderio Pavoni erwarb die Rechte, und ab 1905 wurden die Maschinen in Serie gebaut. Der Druck war damals noch gering. Den dichten Schaum, die „Crema“, brachten erst Kolbenmaschinen nach dem Zweiten Weltkrieg, vor allem die Maschine von Achille Gaggia, ab etwa 1948.',
    'Heute pressen Espressomaschinen Wasser mit etwa neun bar durch fein gemahlenen Kaffee, in rund einer halben Minute. Das Ergebnis ist klein, konzentriert und die Grundlage für Cappuccino, Latte und viele andere Getränke.'
  ],
  facts: [
    'Angelo Moriondo ließ 1884 in Turin eine frühe Kaffee-Dampfmaschine patentieren.',
    'Luigi Bezzera meldete 1901 ein Patent an, Desiderio Pavoni baute die Maschinen ab 1905.',
    'Moderne Espressomaschinen arbeiten mit etwa neun bar Druck.'
  ],
  quote: null,
  myth: null,
  cross: {
    'tasse': 'Die Espressomaschine verbindet Geschichte und Handwerk: Druck, Mahlgrad und Zeit entscheiden über das Ergebnis, die Technik von 1901 prägt die Zubereitung bis heute.'
  },
  exhibit: null,
  further: ['Pendergrast, M. (2010). Uncommon Grounds: The History of Coffee and How It Transformed Our World.']
},

'roselius-koffeinfrei': {
  id: 'roselius-koffeinfrei',
  title: 'Roselius: Kaffee ohne Koffein',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1905,
  yearLabel: '1905',
  icon: 'flask',
  teaser: 'Aus einem Zufall mit nassen Bohnen wird ein Verfahren, das bis heute genutzt wird, in neuer Form.',
  text: [
    'Der Bremer Kaffeekaufmann Ludwig Roselius entwickelte um 1905 ein Verfahren, dem Kaffee das Koffein zu entziehen. Nach einer oft erzählten Geschichte war der Anlass, dass eine Ladung Kaffee bei der Überfahrt mit Meerwasser durchnässt wurde. Ob das so stimmt, lässt sich schwer prüfen.',
    'Die Bohnen werden dabei vor der Röstung gedämpft und mit einem Lösungsmittel behandelt, das das Koffein herauslöst. Roselius gründete die Kaffee-Handels-Aktien-Gesellschaft, daher der Markenname „Kaffee HAG“. Das erste Lösungsmittel wurde später aus gesundheitlichen Gründen aufgegeben.',
    'Heute nutzen Hersteller andere Mittel wie Kohlendioxid oder Wasser. Entkoffeinierter Kaffee enthält meist noch einen kleinen Rest Koffein. Er ist keine ganz koffeinfreie Alternative, aber eine, bei der man abends kaum etwas spürt.'
  ],
  facts: [
    'Ludwig Roselius aus Bremen entwickelte um 1905 ein Verfahren zur Entkoffeinierung.',
    'Der Markenname „Kaffee HAG“ steht für Kaffee-Handels-Aktien-Gesellschaft.',
    'Entkoffeinierter Kaffee enthält meist noch geringe Mengen Koffein.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Pendergrast, M. (2010). Uncommon Grounds: The History of Coffee and How It Transformed Our World.']
},

'melitta-filter': {
  id: 'melitta-filter',
  title: 'Melitta Bentz und der Papierfilter',
  kind: 'instrument',
  journeys: ['geschichte'],
  year: 1908,
  yearLabel: '1908',
  icon: 'lightbulb',
  teaser: 'Eine Hausfrau aus Dresden fand, dass Kaffeesatz in der Tasse nicht sein muss, und löste das Problem mit Löschpapier.',
  text: [
    'Um 1900 gab es Kaffee meist aus Kannen, in denen der Satz mitkochte, oder aus Stoffbeuteln, die sich schwer reinigen ließen. Melitta Bentz aus Dresden suchte nach einer besseren Lösung. Sie durchlöcherte einen Messingtopf, legte Löschpapier aus dem Schulheft ihres Sohnes hinein und goss Kaffee und heißes Wasser darüber.',
    'Das Ergebnis war klar und ohne Satz. 1908 ließ sie ihre Erfindung schützen und gründete noch im selben Jahr ein Unternehmen. Der Papierfilter ersetzte nach und nach Beutel und Kocher und wurde in vielen Haushalten zum Standard.',
    'Das Prinzip ist bis heute dasselbe: Der Filter hält Feststoffe und einen Teil der Öle zurück. Das macht den Kaffee klarer und milder als etwa aus der Stempelkanne. Was als Haushaltsproblem begann, wurde zum Produkt für Millionen.'
  ],
  facts: [
    'Melitta Bentz aus Dresden ließ 1908 den Kaffeefilter schützen.',
    'Der erste Filter bestand aus einem durchlöcherten Messingtopf und Löschpapier.',
    'Papierfilter halten Feststoffe und einen Teil der Kaffeeöle zurück.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Pendergrast, M. (2010). Uncommon Grounds: The History of Coffee and How It Transformed Our World.']
},

'fairtrade-siegel': {
  id: 'fairtrade-siegel',
  title: 'Fairtrade: Ein Siegel für gerechtere Preise',
  kind: 'ereignis',
  journeys: ['geschichte', 'tasse'],
  year: 1988,
  yearLabel: '1988',
  icon: 'flag',
  teaser: 'Die Idee: Wer Kaffee anbaut, soll davon leben können. Ein Siegel soll das für Käufer sichtbar machen.',
  text: [
    'Kaffee ist eine der meistgehandelten Rohwaren der Welt, und seine Preise schwanken stark. Viele Kleinbauern leben in Armut, wenn die Preise fallen. In den 1980er Jahren entstand die Idee, ein Siegel zu schaffen, das Käufern zeigt, dass Produzenten einen Mindestpreis und eine Prämie für Gemeinschaftsprojekte erhalten.',
    '1988 führte die Organisation Max Havelaar in den Niederlanden das erste solche Siegel ein. Der erste Kaffee, der es trug, kam nach Angaben der Organisation von einer Genossenschaft aus Mexiko. Später folgten ähnliche Siegel in vielen Ländern.',
    'Wie viel das bewirkt, ist umstritten. Studien finden Vorteile für Mitglieder, aber auch Grenzen: Nicht jeder Betrieb kann teilnehmen, und Zertifizierung kostet Geld. Das Siegel ist ein Baustein, kein Ersatz für faire Handelsregeln.'
  ],
  facts: [
    '1988 führte Max Havelaar in den Niederlanden das erste Fairtrade-Siegel ein.',
    'Das erste Siegelprodukt war Kaffee aus Mexiko.',
    'Fairtrade sichert Produzenten einen Mindestpreis und eine Prämie für Gemeinschaftsprojekte.'
  ],
  quote: null,
  myth: null,
  cross: {
    'tasse': 'Hinter jeder Tasse steht ein Anbaubetrieb; das Siegel verbindet die Frage nach Anbau und Ernte mit der Frage, was die Menschen dort verdienen.'
  },
  exhibit: null,
  further: ['Luttinger, N. & Dicum, G. (2006). The Coffee Book: Anatomy of an Industry from Crop to the Last Drop.']
}

});
})();
