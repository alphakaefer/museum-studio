// Reise-Daten (Name, Texte, Icon, Farbe). Die Reihenfolge hier ist die Anzeigereihenfolge.
// typ:'historisch' = Zeitstrahl-Reise (Stationen mit Jahr, chronologisch); typ:'funktional' = Wege durch ein Thema.
// color: hell = Farbe auf hellem Grund (Kontrast ≥ 3:1), dunkel = aufgehellte Variante für dunklen Grund. Je Reise gut unterscheidbar.
// icon: ein Schlüssel aus engine/js/icons.js. tagline ≤ 70 Zeichen, kurz ≤ 14 Zeichen.
(function(){'use strict';
window.MUSEUM=window.MUSEUM||{};
MUSEUM.data=MUSEUM.data||{};
MUSEUM.data.journeys=[
{ id:'tasse', typ:'funktional', name:'Von der Pflanze zur Tasse', kurz:'Zur Tasse',
  tagline:'Was passiert, bevor der Kaffee im Becher dampft',
  intro:'Du folgst einer Bohne von der Kaffeekirsche bis in die Tasse. Unterwegs lernst du, wo Kaffee wächst, warum Röstung und Mahlgrad so viel ausmachen und was das Koffein eigentlich im Kopf tut.',
  outro:'Vom Strauch bis zur Tasse sind es viele Entscheidungen. Welche davon schmeckst du wirklich, und welche redest du dir nur ein?',
  color:{ light:'#8A4B1F', dark:'#D9A066' },
  icon:'seed' },
{ id:'geschichte', typ:'historisch', name:'Kaffee in der Geschichte', kurz:'Geschichte',
  tagline:'Fünf Jahrhunderte Kaffee zwischen Legende und Alltag',
  intro:'Von nächtlichen Gebeten im Jemen über Londoner Kaffeehäuser bis zum Fairtrade-Siegel: Du gehst die Geschichte des Getränks in der richtigen Reihenfolge ab und erfährst, was belegt ist und was nur gut erzählt wird.',
  outro:'Aus einem Getränk für wache Nächte wurde ein Weltmarkt. Bleibt die Frage, wer an diesem Markt heute gerecht beteiligt ist.',
  color:{ light:'#1F6F82', dark:'#5FB4C4' },
  icon:'hourglass' }
];
})();
