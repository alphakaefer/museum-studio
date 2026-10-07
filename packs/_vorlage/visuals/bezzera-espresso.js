/* Abbildung „bezzera-espresso“ (Muster, gebaut mit dem Baukasten MUSEUM.viz): zwei Zubereitungen im Vergleich, Größe für Größe als Balken.
   Idee: Man wählt, was man vergleicht; die Balken wachsen um. So wird aus „schnell, mit Druck“ ein Unterschied, den man sieht. */
(function () {
  'use strict';
  var V = MUSEUM.viz;
  // Typische Richtwerte (Rezepte schwanken): [Espresso, Filterkaffee]
  var GROESSEN = {
    zeit:  { label: 'Brühzeit', unit: 's', max: 300, werte: [30, 240] },
    druck: { label: 'Druck, mit dem das Wasser durch das Mehl gepresst wird', unit: 'bar', max: 10, werte: [9, 0] },
    menge: { label: 'Getränk im Becher', unit: 'ml', max: 250, werte: [30, 200] }
  };

  V.visual('bezzera-espresso', {
    alt: 'Balkenvergleich von Espresso und Filterkaffee. Wählbar sind Brühzeit (Espresso etwa 30 Sekunden, Filter etwa 240), Druck (Espresso etwa 9 bar, Filter keiner) und Menge im Becher (Espresso etwa 30 Milliliter, Filter etwa 200).',
    caption: 'Typische Richtwerte zur Veranschaulichung; Rezepte und Maschinen weichen ab. Neun bar und rund eine halbe Minute stehen im Text.',
    build: function (box) {
      var g = GROESSEN.zeit;
      var bars = V.bars({
        series: [{ name: 'Espresso' }, { name: 'Filterkaffee' }],
        groups: [{ label: g.label, values: g.werte }],
        max: g.max, unit: g.unit, label: 'Vergleich Espresso und Filterkaffee'
      });
      var wahl = V.choice({
        label: 'Was vergleichen?',
        options: [{ value: 'zeit', label: 'Zeit' }, { value: 'druck', label: 'Druck' }, { value: 'menge', label: 'Menge' }],
        value: 'zeit',
        onChange: function (k) { var x = GROESSEN[k]; bars.set([x.werte], { max: x.max, unit: x.unit, labels: [x.label] }); }
      });
      box.appendChild(wahl.el);
      box.appendChild(bars.el);
    }
  });
})();
