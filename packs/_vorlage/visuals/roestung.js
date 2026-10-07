/* Abbildung „roestung“ (Muster, gebaut mit dem Baukasten MUSEUM.viz): ein Ablauf in Schritten.
   Idee: Vor und zurück durch die Röstung; die Bohne links ändert Farbe und Gewicht, der Text sagt, was gerade passiert. */
(function () {
  'use strict';
  var V = MUSEUM.viz;
  // Bohnenfarben gehören zum Inhalt (grün, gelb, braun), nicht zum Design; sie stehen auf neutralem Grund mit Rand in Tokenfarbe.
  var SCHRITTE = [
    { title: 'Rohkaffee', text: 'Grünlich, hart, grasiger Geruch. Noch kein Kaffeearoma.', farbe: '#7C8F52', gewicht: '0 %' },
    { title: 'Trocknen', text: 'Die Bohnen verlieren Wasser und werden gelb.', farbe: '#C9B45A', gewicht: 'beginnt' },
    { title: 'Bräunen', text: 'Zucker und Aminosäuren reagieren (Maillard-Reaktion), dazu kommt die Karamellisierung: Mehrere hundert Aromastoffe entstehen.', farbe: '#8A5A2B', gewicht: 'steigt' },
    { title: 'Erstes Knacken', text: 'Die Bohnen dehnen sich aus, Wasserdampf entweicht, man hört es knacken. Sie sind jetzt größer und poröser.', farbe: '#6B3F1D', gewicht: '12 bis 20 %' },
    { title: 'Hell oder dunkel?', text: 'Hell geröstet schmeckt meist fruchtiger und säurebetonter, dunkel bitterer und rauchiger. Der Koffeingehalt ändert sich kaum.', farbe: '#3B2412', gewicht: '12 bis 20 %' }
  ];
  V.visual('roestung', {
    alt: 'Ablauf der Röstung in fünf Schritten: Rohkaffee, Trocknen, Bräunen, erstes Knacken, hell oder dunkel. Eine Bohne wechselt dabei die Farbe von grün über gelb zu braun, der Gewichtsverlust steigt auf zwölf bis zwanzig Prozent.',
    caption: 'Schritte nach dem Text der Station; Temperaturen und Zeiten hängen von Röster und Sorte ab.',
    build: function (box) {
      var bean = V.s('ellipse', { cx: 45, cy: 45, rx: 28, ry: 36, fill: SCHRITTE[0].farbe, stroke: 'var(--ink-2)', 'stroke-width': 2.5 });
      var furche = V.s('path', { d: 'M45 12C38 30 52 60 45 78', fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2, 'stroke-linecap': 'round' });
      var svg = V.svg(90, 90, { label: 'Kaffeebohne im Verlauf der Röstung', 'class': 'gx-bean' });
      svg.style.width = '84px'; svg.style.flex = 'none';
      svg.appendChild(bean); svg.appendChild(furche);
      var gewicht = V.readout({ label: 'Gewichtsverlust', value: SCHRITTE[0].gewicht });
      var stepper = V.stepper({
        label: 'Ablauf der Röstung',
        steps: SCHRITTE,
        onStep: function (i, s) { bean.setAttribute('fill', s.farbe); gewicht.set(s.gewicht); }
      });
      box.appendChild(V.el('div', { style: { display: 'flex', gap: '16px', 'align-items': 'center', 'flex-wrap': 'wrap' } }, svg, gewicht.el));
      box.appendChild(stepper.el);
    }
  });
})();
