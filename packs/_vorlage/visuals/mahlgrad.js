/* Abbildung „mahlgrad“ (Muster, gebaut mit dem Baukasten MUSEUM.viz): ein abstrakter Zusammenhang, den man verstellen kann.
   Idee: Zwei Regler (Mahlgrad, Brühzeit), eine Kurve, ein Zielbereich, ein Satz Auswertung. Wer am Regler zieht, sieht, warum „fein“ nicht „stark“ heißt. */
(function () {
  'use strict';
  var V = MUSEUM.viz;

  // Schematisches Modell (keine Messwerte): der Auszug nähert sich einem Höchstwert; feiner gemahlen geht es schneller.
  function auszug(sekunden, mahlgrad) {
    var k = 0.0104 * Math.pow(1.35, mahlgrad - 5);
    return 28 * (1 - Math.exp(-k * sekunden));
  }
  function urteil(e) {
    if (e < 18) return { text: 'dünn, eher sauer', tone: 'warn' };
    if (e > 22) return { text: 'bitter, herb', tone: 'bad' };
    return { text: 'ausgewogen', tone: 'good' };
  }

  V.visual('mahlgrad', {
    alt: 'Kurve: Wie viel Prozent der Kaffeemasse ins Wasser übergehen, aufgetragen über die Brühzeit in Sekunden. Die Kurve steigt zuerst steil und flacht dann ab. Ein grün hinterlegter Bereich zwischen 18 und 22 Prozent markiert den Richtwert. Mit den Reglern Mahlgrad und Brühzeit wandert ein markierter Punkt auf der Kurve.',
    caption: 'Schematisches Modell zur Veranschaulichung, keine Messwerte. Nur der Richtwert von 18 bis 22 Prozent stammt aus dem Text.',
    build: function (box) {
      var plot = V.plot({
        label: 'Auszug über die Brühzeit',
        xDomain: [0, 300], yDomain: [0, 30], xTicks: [0, 60, 120, 180, 240, 300],
        xLabel: 'Brühzeit in Sekunden', yLabel: 'Auszug in % der Kaffeemasse',
        series: [{ name: 'Auszug bei deinem Mahlgrad', f: function (t, p) { return auszug(t, p.mahlgrad); } }],
        controls: [
          { key: 'mahlgrad', label: 'Mahlgrad', min: 1, max: 10, step: 1, value: 5, ends: ['grob', 'fein'] },
          { key: 'zeit', label: 'Brühzeit', min: 20, max: 300, step: 5, value: 120, unit: 's' }
        ],
        marks: function (p) {
          var e = auszug(p.zeit, p.mahlgrad);
          return { bands: [{ y0: 18, y1: 22, tone: 'ok', label: 'Richtwert 18 bis 22 %' }], vlines: [{ x: p.zeit }], points: [{ x: p.zeit, y: e, label: V.fmt(e, 1) + ' %' }] };
        },
        readout: function (p) {
          var e = auszug(p.zeit, p.mahlgrad), u = urteil(e);
          return [{ label: 'Auszug', value: e, unit: '%', digits: 1, tone: u.tone }, { label: 'Im Becher', value: u.text, tone: u.tone }];
        },
        describe: function (p) {
          var e = auszug(p.zeit, p.mahlgrad);
          return 'Bei Mahlgrad ' + p.mahlgrad + ' von 10 und ' + p.zeit + ' Sekunden gehen etwa ' + V.fmt(e, 1) + ' Prozent in den Becher: ' + urteil(e).text + '.';
        }
      });
      box.appendChild(plot.el);
    }
  });
})();
