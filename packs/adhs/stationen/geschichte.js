// Stationen der historischen Reise „geschichte“ (Heimat-Reise), chronologisch. Schema: docs/INHALT-SCHREIBEN.md.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'crichton': {
  id: 'crichton',
  title: 'Crichton 1798: Eine frühe Beschreibung',
  kind: 'person',
  journeys: ['geschichte'],
  year: 1798,
  yearLabel: '1798',
  icon: 'quill',
  teaser: 'Ein schottischer Arzt widmet der Aufmerksamkeit und ihren Störungen ein eigenes Kapitel, lange vor jeder Diagnoseliste.',
  text: [
    'Stell dir einen Arzt vor, der in seiner Praxis Menschen begegnet, die nicht bei der Sache bleiben können, obwohl sie es wollen. Alexander Crichton, Schotte und Arzt, schrieb darüber in seinem zweibändigen Werk „An Inquiry into the Nature and Origin of Mental Derangement“, erschienen 1798 in London. Im ersten Band steht ein Kapitel „Of Attention and its Diseases“.',
    'Crichton beginnt mit der Frage, was Aufmerksamkeit überhaupt ist, und beschreibt dann, wie sie gestört sein kann. Moderne Fachleute lesen darin Züge, die an die unaufmerksame Präsentation von ADHS erinnern. Von körperlicher Unruhe schreibt er nach heutigem Verständnis dagegen nicht.',
    'Ob Crichton dasselbe Muster meinte, das wir heute ADHS nennen, ist eine Deutung im Rückblick. Er kannte weder den Begriff noch Kriterien. Die Station zeigt etwas anderes: Dass Aufmerksamkeit versagen kann und dass das ein Thema für die Medizin ist, wurde schon Ende des 18. Jahrhunderts gesehen.'
  ],
  facts: [
    'Crichtons „An Inquiry into the Nature and Origin of Mental Derangement“ erschien 1798 in London in zwei Bänden.',
    'Das Kapitel „Of Attention and its Diseases“ steht im ersten Band.',
    'Die Verbindung zu ADHS ist eine spätere Deutung von Historikerinnen und Medizinern, nicht Crichtons eigene.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Crichton, A. (1798). An Inquiry into the Nature and Origin of Mental Derangement. London: T. Cadell Jr. & W. Davies (digitalisiert bei der Wellcome Collection).']
},

'zappelphilipp': {
  id: 'zappelphilipp',
  title: 'Der Zappel-Philipp (1845)',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1845,
  yearLabel: '1845',
  icon: 'book',
  teaser: 'Eine Kinderbuchfigur, die am Tisch nicht stillsitzt, wurde zum Bild für „unruhige Kinder“. Eine Diagnose war das nicht.',
  text: [
    'Am Familientisch rutscht Philipp auf dem Stuhl, kippelt, reißt am Tischtuch, bis alles auf dem Boden liegt. Die Geschichte vom „Zappel-Philipp“ stammt aus dem Bilderbuch des Frankfurter Arztes Heinrich Hoffmann, das 1845 erstmals erschien und später „Der Struwwelpeter“ hieß. Es war als abschreckende, komische Erziehungsgeschichte gedacht.',
    'Im Deutschen wird das Wort „Zappelphilipp“ bis heute für unruhige Kinder verwendet, oft mit dem Gedanken an ADHS. Ob Hoffmann ein solches Kind vor Augen hatte, lässt sich nicht sagen. Er wollte unterhalten und mahnen, nicht eine Störung beschreiben, und das Buch erzählt Unruhe als Ungezogenheit, die bestraft wird.',
    'Gerade das macht die Station lehrreich: Das Bild vom unartigen Kind hielt sich lange und prägt manchmal noch heute, wie über Betroffene gesprochen wird. Ob ein Kind sich nicht beherrschen will oder kann, ist eine Frage, die erst die spätere Forschung stellte.'
  ],
  facts: [
    'Heinrich Hoffmanns Bilderbuch erschien erstmals 1845 in Frankfurt am Main.',
    'Hoffmann war Arzt; der Titel „Der Struwwelpeter“ kam erst in späteren Ausgaben.',
    'Dass die Figur ADHS zeigt, ist eine spätere Zuschreibung ohne Beleg durch den Autor.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Hoffmann, H. (1845). Lustige Geschichten und drollige Bilder (später: Der Struwwelpeter). Frankfurt am Main: Literarische Anstalt Rütten & Loening (spätere Ausgaben).']
},

'still': {
  id: 'still',
  title: 'George Still 1902: „Mangel an moralischer Kontrolle“',
  kind: 'person',
  journeys: ['geschichte'],
  year: 1902,
  yearLabel: '1902',
  icon: 'speech',
  teaser: 'Der Moment, der oft als Anfang genannt wird, und warum Stills Wortwahl heute irritiert.',
  text: [
    'Im März 1902 steht der Kinderarzt George Frederic Still vor Kolleginnen und Kollegen des Royal College of Physicians in London. In drei Vorträgen, den Goulstonian Lectures, berichtet er von Kindern, die sich nicht steuern können, die aggressiv oder unruhig sind, obwohl sie von normaler Intelligenz scheinen. Veröffentlicht wurden die Vorträge im „Lancet“.',
    'Still sprach von einem „Defekt der moralischen Kontrolle“ und meinte damit, dass Kinder ihr Handeln nicht am Wohl aller ausrichten können. Er sah darin nicht bloß schlechte Erziehung, sondern eine Veranlagung. Das war damals ein wichtiger Schritt weg vom Vorwurf an die Eltern.',
    'Heute klingt „moralisch“ nach Schuld, und genau das wollen Fachleute vermeiden. Historiker nennen Stills Vorträge oft einen wissenschaftlichen Ausgangspunkt der ADHS-Geschichte. Ob seine Fälle alle ADHS im heutigen Sinn waren, ist offen, denn seine Gruppe war gemischt.'
  ],
  facts: [
    'Stills Goulstonian Lectures fanden am 4., 6. und 11. März 1902 in London statt.',
    'Sie erschienen 1902 im „Lancet“ unter dem Titel „Some abnormal psychical conditions in children“.',
    'Still verstand „moralische Kontrolle“ als Steuerung des Handelns im Sinne des Wohls aller.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Still, G. F. (1902). Some abnormal psychical conditions in children: The Goulstonian Lectures. The Lancet, 1, 1008 ff.']
},

'bradley': {
  id: 'bradley',
  title: 'Bradley 1937: Ein Zufallsfund',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1937,
  yearLabel: '1937',
  icon: 'pill',
  teaser: 'Ein Mittel gegen Kopfschmerzen verändert in einer Kinderklinik das Verhalten mancher Kinder: der Beginn der Medikation.',
  text: [
    'Nach einer Untersuchung der Gehirnflüssigkeit litten Kinder oft unter schlimmen Kopfschmerzen. Der amerikanische Arzt Charles Bradley versuchte deshalb im Emma Pendleton Bradley Home in East Providence, Rhode Island, das Mittel Benzedrin. Gegen die Kopfschmerzen half es kaum. Aber Lehrkräfte bemerkten, dass bei manchen Kindern Konzentration und Schulleistungen besser wurden.',
    'Bradley beobachtete das genauer. 1937 veröffentlichte er im „American Journal of Psychiatry“ seine Ergebnisse an 30 Kindern: Bei 14 verbesserte sich die Schulleistung deutlich, in der Woche mit Benzedrin. Das war ein Zufallsfund und keine moderne Studie ohne Vergleichsgruppe nach heutigen Maßstäben.',
    'Zunächst blieb das Echo gering, Berichte sprechen von Jahrzehnten, in denen die Beobachtung kaum beachtet wurde. Später wurden stimulierende Mittel zum Kern der medikamentösen Behandlung, mit Studien, die weit strenger sind.'
  ],
  facts: [
    'Bradleys Bericht erschien 1937 im American Journal of Psychiatry.',
    'Er behandelte 30 Kinder im Emma Pendleton Bradley Home; bei 14 stieg die Schulleistung deutlich.',
    'Benzedrin wurde ursprünglich gegen Kopfschmerzen nach der Untersuchung der Gehirnflüssigkeit gegeben.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Bradley, C. (1937). The behavior of children receiving benzedrine. American Journal of Psychiatry, 94, 577-585.']
},

'dsm2': {
  id: 'dsm2',
  title: 'DSM-II 1968: Die hyperkinetische Reaktion',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1968,
  yearLabel: '1968',
  icon: 'clipboard',
  teaser: 'Zum ersten Mal steht ein Name im Handbuch der amerikanischen Psychiater: „Hyperkinetische Reaktion des Kindesalters“.',
  text: [
    'Das Handbuch ist dünn, die Einträge kurz. Im „Diagnostic and Statistical Manual“ der American Psychiatric Association erscheint 1968, in der zweiten Ausgabe, die „hyperkinetische Reaktion des Kindesalters“. Beschrieben wird sie über Überaktivität, Unruhe, Ablenkbarkeit und eine kurze Aufmerksamkeitsspanne.',
    'Der Name sagt viel über den Blick der Zeit: Er beschreibt eine „Reaktion“, nicht eine Störung, und er betrifft Kinder. Im Vordergrund steht die Bewegung, nicht die Aufmerksamkeit. Dass es das Muster auch bei Erwachsenen geben könnte, war hier noch kein Thema.',
    'Mit dem Eintrag bekam das Phänomen einen offiziellen Platz, und das erleichterte Forschung und Behandlung. Der Name sollte aber nicht der letzte bleiben.'
  ],
  facts: [
    'Die zweite Ausgabe des DSM erschien 1968.',
    'Sie nannte das Bild „Hyperkinetische Reaktion des Kindesalters“.',
    'Genannt werden Überaktivität, Unruhe, Ablenkbarkeit und kurze Aufmerksamkeitsspanne.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['American Psychiatric Association (1968). Diagnostic and Statistical Manual of Mental Disorders (2. Aufl., DSM-II). Washington, DC.']
},

'dsm3': {
  id: 'dsm3',
  title: 'DSM-III 1980: Aus Hyperaktivität wird Aufmerksamkeitsstörung',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1980,
  yearLabel: '1980',
  icon: 'layers',
  teaser: 'Der Fokus wandert von der Unruhe zur Aufmerksamkeit; 1987 kommt die Hyperaktivität in den Namen zurück.',
  text: [
    'Ein Jahrzehnt später sieht das Handbuch anders aus. Das DSM-III von 1980 führt erstmals genaue Kriterien auf und nennt das Bild „Aufmerksamkeitsdefizit-Störung“ (attention deficit disorder, ADD). Es gibt zwei Formen, mit Hyperaktivität und ohne.',
    'Damit rückt die Aufmerksamkeit in die Mitte. Fachleute hatten erkannt, dass Unaufmerksamkeit und Impulsivität das Bild stärker prägen als reine Bewegung. Die Form ohne Hyperaktivität wurde jedoch von Anfang an diskutiert.',
    'Schon die Überarbeitung, das DSM-III-R von 1987, änderte wieder: Sie nannte die Störung nun „Aufmerksamkeitsdefizit-Hyperaktivitätsstörung“ (ADHS) und fasste die Symptome in einer Liste zusammen. Die Namensleiste zeigt: Der Blick wechselte, das Muster blieb ansprechbar.'
  ],
  facts: [
    'Das DSM-III erschien 1980 und führte „Attention Deficit Disorder“ mit und ohne Hyperaktivität ein.',
    'Das DSM-III-R (1987) benannte die Störung in ADHD um.',
    'Das DSM-III war das erste DSM mit ausformulierten Kriterien je Diagnose.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['American Psychiatric Association (1980). Diagnostic and Statistical Manual of Mental Disorders (3. Aufl., DSM-III). Washington, DC.']
},

'dsm4': {
  id: 'dsm4',
  title: 'DSM-IV 1994: Drei Präsentationen',
  kind: 'ereignis',
  journeys: ['geschichte'],
  year: 1994,
  yearLabel: '1994',
  icon: 'grid',
  teaser: 'Das DSM-IV unterscheidet drei Typen von ADHS. Dieses Bild prägt bis heute, wie über ADHS gesprochen wird.',
  text: [
    'Zwei Kinder in derselben Klasse: Das eine kann nicht stillsitzen, das andere träumt aus dem Fenster. Beide können dieselbe Diagnose haben. Das DSM-IV von 1994 machte das sichtbar, indem es drei Typen nannte: überwiegend unaufmerksam, überwiegend hyperaktiv-impulsiv und kombiniert.',
    'Die Symptome standen in zwei Listen mit je neun Punkten, und die Beschwerden mussten vor dem siebten Lebensjahr beginnen. Diese Altersgrenze galt als Schwäche, vor allem für Erwachsene, die sich an ihre Kindheit nicht genau erinnern.',
    'Das DSM-5 sprach 2013 nicht mehr von Typen, sondern von Präsentationen, um zu betonen, dass sich das Bild im Leben ändern kann. Die drei Gesichter selbst blieben.'
  ],
  facts: [
    'Das DSM-IV erschien 1994 und unterschied kombinierten, unaufmerksamen und hyperaktiv-impulsiven Typ.',
    'Es verlangte Beginn der Symptome vor dem siebten Lebensjahr.',
    'Das DSM-5 ersetzte den Begriff „Typ“ durch „Präsentation“.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['American Psychiatric Association (1994). Diagnostic and Statistical Manual of Mental Disorders (4. Aufl., DSM-IV). Washington, DC.']
},

'dsm5': {
  id: 'dsm5',
  title: 'DSM-5: Kriterien für Erwachsene und späterer Beginn',
  kind: 'ereignis',
  journeys: ['geschichte', 'behandlung'],
  year: 2013,
  yearLabel: '2013',
  icon: 'checklist',
  teaser: 'Das DSM-5 hebt die Altersgrenze von 7 auf 12 Jahre und senkt die Schwelle für Erwachsene.',
  text: [
    'Eine Frau von 35 sucht eine Fachärztin auf, weil sie seit der Kindheit mit Konzentration und Chaos kämpft. Nach dem DSM-IV hätte sie sich beweisen müssen, dass vor dem siebten Geburtstag alles begann. Das DSM-5 von 2013 setzte die Grenze auf zwölf Jahre.',
    'Weitere Änderungen: Erwachsene und Jugendliche ab 17 brauchen fünf statt sechs Symptome in einem Bereich. Außerdem darf ADHS jetzt zusammen mit einer Autismus-Spektrum-Störung diagnostiziert werden, was vorher ausgeschlossen war. Die Typen heißen nun Präsentationen.',
    'Dahinter stand die Beobachtung, dass viele Betroffene die Schwelle nur knapp verpassten und trotzdem litten. Kritiker befürchten, dass die niedrigere Schwelle mehr Menschen ein Etikett gibt. Beide Sichten stehen auf der Reise Behandlung gegeneinander.'
  ],
  facts: [
    'Das DSM-5 erschien 2013 und verlegte den Symptombeginn von vor 7 auf vor 12 Jahre.',
    'Für Menschen ab 17 genügen fünf Symptome in einem Bereich, jüngere brauchen sechs.',
    'Seit dem DSM-5 darf ADHS gemeinsam mit einer Autismus-Spektrum-Störung diagnostiziert werden.'
  ],
  quote: null,
  myth: null,
  cross: {
    behandlung: 'Hier siehst du die Kriterien, die bei einer Abklärung tatsächlich geprüft werden, und den Streit, ob die gesenkte Schwelle zu mehr Diagnosen führt.'
  },
  exhibit: null,
  further: ['American Psychiatric Association (2013). Diagnostic and Statistical Manual of Mental Disorders (5. Aufl., DSM-5). Arlington, VA: APA Publishing.']
}

});
})();
