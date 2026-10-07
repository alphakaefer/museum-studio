/* Abbildung „koffein“ (Muster, gebaut mit dem Baukasten MUSEUM.viz): ein Zahlenwort („Halbwertszeit fünf Stunden“) wird zur Kurve.
   Idee: Tassen und Halbwertszeit verstellen, an der Marke „22 Uhr“ ablesen, wie viel noch wirkt. */
(function () {
  'use strict';
  var V = MUSEUM.viz, MG = 90;   // Milligramm je Tasse (Mitte der im Text genannten 80 bis 100)
  function rest(uhr, p) { return uhr < 8 ? NaN : p.tassen * MG * Math.pow(0.5, (uhr - 8) / p.hwz); }
  V.visual('koffein', {
    alt: 'Kurve: Koffeinmenge im Körper von acht Uhr morgens bis acht Uhr am Folgetag nach dem Kaffee um acht Uhr. Die Kurve fällt gleichmäßig, bei einer Halbwertszeit von fünf Stunden halbiert sie sich alle fünf Stunden. Eine Marke zeigt, wie viel um 22 Uhr noch übrig ist. Regler: Zahl der Tassen und Halbwertszeit.',
    caption: 'Stark vereinfachtes Modell: eine Aufnahme um 8 Uhr, 90 mg je Tasse, gleichmäßiger Abbau. Anflutung und persönliche Unterschiede fehlen.',
    build: function (box) {
      box.appendChild(V.plot({
        label: 'Koffein im Körper nach dem Morgenkaffee',
        xDomain: [8, 32], yDomain: [0, 360], xTicks: [8, 12, 16, 20, 24, 28, 32],
        xFormat: function (h) { return (h % 24) + ' Uhr'; }, xLabel: 'Uhrzeit', yLabel: 'Koffein in mg',
        series: [{ name: 'Koffein im Körper', f: rest, area: true }],
        controls: [
          { key: 'tassen', label: 'Tassen um 8 Uhr', min: 1, max: 4, step: 1, value: 2 },
          { key: 'hwz', label: 'Halbwertszeit', min: 3, max: 9, step: 0.5, value: 5, unit: 'h', ends: ['kurz', 'lang'] }
        ],
        marks: function (p) { return { vlines: [{ x: 22, label: '22 Uhr' }], points: [{ x: 22, y: rest(22, p), label: 'noch ' + V.fmt(rest(22, p), 0) + ' mg' }] }; },
        readout: function (p) { var r = rest(22, p); return [{ label: 'Um 22 Uhr noch im Körper', value: r, unit: 'mg', digits: 0 }, { label: 'Anteil der Menge', value: r / (p.tassen * MG) * 100, unit: '%', digits: 0 }]; },
        describe: function (p) { return p.tassen + ' Tassen um 8 Uhr, Halbwertszeit ' + V.fmt(p.hwz) + ' Stunden: um 22 Uhr sind noch etwa ' + V.fmt(rest(22, p), 0) + ' Milligramm übrig.'; }
      }).el);
    }
  });
})();
