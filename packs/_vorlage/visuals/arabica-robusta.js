/* Abbildung „arabica-robusta“ (Muster, gebaut mit dem Baukasten MUSEUM.viz): Vergleichstabelle mit Hervorhebung.
   Idee: Zwei Arten, drei Merkmale; per Auswahl wird eine Zeile hervorgehoben, damit man gezielt vergleicht. */
(function () {
  'use strict';
  var V = MUSEUM.viz;
  V.visual('arabica-robusta', {
    alt: 'Vergleichstabelle von Arabica und Robusta in drei Zeilen: Koffein (Arabica 1 bis 1,5 Prozent, Robusta 2 bis 2,5 Prozent), Lage (Arabica meist in Höhenlagen, Robusta auch tiefer) und Geschmack (Arabica fruchtiger und milder, Robusta kräftiger und herber).',
    caption: 'Tendenzen, keine Regeln; Lage, Ernte und Röstung entscheiden mit.',
    build: function (box) {
      var m = V.matrix({
        label: 'Arabica und Robusta im Vergleich',
        rows: ['Koffein', 'Lage', 'Geschmack'], cols: ['Arabica', 'Robusta'],
        cells: [['1 bis 1,5 %', '2 bis 2,5 %'], ['meist in der Höhe', 'auch in tieferen Lagen'], ['fruchtiger, milder', 'kräftiger, herber']],
        highlight: [{ r: 0, tone: 'accent' }]
      });
      var wahl = V.choice({
        label: 'Hervorheben',
        options: [{ value: 0, label: 'Koffein' }, { value: 1, label: 'Lage' }, { value: 2, label: 'Geschmack' }, { value: -1, label: 'nichts' }],
        value: 0,
        onChange: function (r) { m.highlight(r < 0 ? [] : [{ r: r, tone: 'accent' }]); }
      });
      box.appendChild(wahl.el);
      box.appendChild(m.el);
    }
  });
})();
