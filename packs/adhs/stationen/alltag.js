// Stationen der Reise „alltag“ (Heimat-Reise). Schema: docs/INHALT-SCHREIBEN.md.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'morgen': {
  id: 'morgen',
  title: 'Der Morgen: Schuhe, Schlüssel, Schultasche',
  kind: 'konzept',
  journeys: ['alltag'],
  icon: 'sun',
  teaser: 'Ein Morgen besteht aus dutzenden kleinen Schritten, und jeder braucht einen Moment Aufmerksamkeit.',
  text: [
    'Es ist 7:40 Uhr. Die Schuhe stehen im Flur, der Schlüssel liegt irgendwo, die Schultasche ist gepackt, aber das Mäppchen fehlt. Auf dem Weg zum Mäppchen fällt dir das Handy auf, das noch lädt, und plötzlich stehst du im Wohnzimmer und weißt nicht mehr, was du eigentlich holen wolltest. Jeder kennt solche Minuten. Bei manchen Menschen sind sie jeden Tag der Normalfall.',
    'Ein Morgen ist eine Kette aus vielen kleinen Schritten, die man ohne Nachdenken erledigen soll. Genau dafür braucht es Aufmerksamkeit, Arbeitsgedächtnis und die Fähigkeit, sich nicht von Nebensachen wegziehen zu lassen. Unter den Merkmalen, die das Diagnosehandbuch DSM-5 nennt, stehen darum Alltagsdinge wie häufiges Verlieren von Gegenständen und Vergesslichkeit bei täglichen Aufgaben. Entscheidend ist nicht ein einzelner schlechter Morgen, sondern dass es über Monate in mehreren Lebensbereichen auftritt und spürbar belastet.',
    'Wie stark ein Morgen entgleist, hängt auch von der Umgebung ab: von festen Plätzen für Dinge, von Zeitdruck, von Schlaf. Die Frage ist darum nie nur „Wer ist schuld?“, sondern auch „Wo bricht die Kette?“. Wie das Gehirn solche Ketten organisiert, zeigt die Station zu den exekutiven Funktionen.'
  ],
  facts: [
    'Das DSM-5 zählt Verlieren von Gegenständen und Vergesslichkeit im Alltag zu den Merkmalen der Unaufmerksamkeit.',
    'Für eine Diagnose müssen Beschwerden über mindestens sechs Monate und in mindestens zwei Lebensbereichen bestehen.',
    'Einzelne chaotische Morgen sind kein Hinweis auf ADHS; Dauer, Ausmaß und Beeinträchtigung zählen.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['AWMF (2017/2018). S3-Leitlinie ADHS bei Kindern, Jugendlichen und Erwachsenen, AWMF-Register-Nr. 028-045.', 'Barkley, R. A. (1997). Behavioral inhibition, sustained attention, and executive functions. Psychological Bulletin, 121(1), 65–94.']
},

'zeitgefuehl': {
  id: 'zeitgefuehl',
  title: 'Zeit spüren: Warum „gleich“ schwerfällt',
  kind: 'konzept',
  journeys: ['alltag'],
  icon: 'clock',
  teaser: 'Fünf Minuten fühlen sich mal wie eine, mal wie fünfzehn an. Wie Zeitwahrnehmung und Planung zusammenhängen.',
  text: [
    '„Ich bin gleich fertig“, sagst du, und zwanzig Minuten später sitzt du noch da. Oder du rechnest für den Weg zwölf Minuten, brauchst aber dreißig, weil Schuhe, Schlüssel und ein verpasster Bus dazwischenkamen. Zeit lässt sich nicht sehen oder anfassen; das Gehirn muss sie schätzen, und das gelingt nicht jedem gleich gut.',
    'In der Forschung gibt es dazu zwei Fragen. Die erste betrifft das Spüren von Dauer: Schätzen, Abmessen, Vergleichen von Intervallen. Die zweite betrifft das Planen: Wie lange dauert etwas, und wann muss ich anfangen? Übersichtsarbeiten und Meta-Analysen berichten, dass Gruppen mit ADHD im Mittel ungenauer bei Zeitschätzung und Zeitreproduktion sind. Ob das eine eigene Kernstörung ist oder aus Aufmerksamkeit, Arbeitsgedächtnis und Belohnungsverarbeitung folgt, ist offen, und nicht jeder Mensch mit ADHD fällt in solchen Aufgaben auf.',
    'Für den Alltag zählt oft das Planen mehr als das Gefühl: Wer Zeit schlecht spürt, kann sie sichtbar machen, etwa mit Uhren, Timern und Zwischenzielen. Dazu passt eine kleine Übung: Schätze zehn Sekunden und sieh, wie weit du daneben liegst. Das ist Veranschaulichung, kein Test.'
  ],
  facts: [
    'Noreika, Falter und Rubia fassten 2013 Zeitverarbeitungs-Befunde bei ADHD in einer Übersicht zusammen (Neuropsychologia, Bd. 51).',
    'Eine Meta-Analyse von 2020 (Marx u. a., 55 Studien) fand bei ADHD ungenauere Zeitschätzung und Zeitproduktion.',
    'Ob Zeitprobleme eine eigene Kernstörung sind oder Folge anderer Funktionen, ist umstritten.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: 'zehn-sekunden',
  further: ['Noreika, V., Falter, C. M. & Rubia, K. (2013). Timing deficits in ADHD: Evidence from neurocognitive and neuroimaging studies. Neuropsychologia, 51(2), 235–266.']
},

'emotionen': {
  id: 'emotionen',
  title: 'Emotionen: Schnell hoch, schwer runter',
  kind: 'konzept',
  journeys: ['alltag'],
  icon: 'storm',
  teaser: 'Wut, Frust und Begeisterung kommen oft schnell und stark. Warum das Thema in der ADHS-Forschung umstritten ist.',
  text: [
    'Ein Kind verliert beim Spiel, und innerhalb von Sekunden fliegt das Brett durchs Zimmer. Eine Erwachsene bekommt eine knappe Mail und ist den halben Tag aufgewühlt. Später tut beides leid, und das macht es nicht leichter. Viele Betroffene beschreiben ihre Gefühle als schnell da und schwer wieder abzuschalten.',
    'Bemerkenswert: Diese emotionale Dysregulation gehört nicht zu den Kernkriterien im DSM-5. Sie wird aber häufig berichtet; eine Übersicht von Shaw und Kollegen (2014) nennt Schätzungen von etwa einem Viertel bis zur Hälfte bei Kindern und etwa einem Drittel bis zu zwei Dritteln bei Erwachsenen mit ADHD, je nach Definition. Faraone und Kollegen (2019) halten emotionale Impulsivität und mangelnde emotionale Selbstregulation für spezifisch genug, um sie eventuell als Merkmal aufzunehmen, Reizbarkeit dagegen nicht.',
    'Fachleute streiten also noch: Ist es ein Kernmerkmal, ein häufiger Begleiter oder ein Zeichen anderer Störungen wie Angst oder Depression? Für den Alltag heißt das: Gefühlsstürme sind kein Charakterfehler und keine Absicht, aber sie sind auch kein Beweis für ADHS. Wie sich das in Familie und Beziehung auswirkt, zeigen die nächsten Stationen.'
  ],
  facts: [
    'Emotionale Dysregulation steht nicht in den Kriterien des DSM-5 für ADHS.',
    'Shaw u. a. (2014, American Journal of Psychiatry) diskutieren drei Modelle für das Verhältnis von ADHS und Emotionsregulation.',
    'Faraone u. a. (2019) sehen emotionale Impulsivität als möglichen ADHS-spezifischen Aspekt, Reizbarkeit nicht.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Shaw, P., Stringaris, A., Nigg, J. & Leibenluft, E. (2014). Emotion dysregulation in ADHD. American Journal of Psychiatry, 171(3), 276–293.', 'Faraone, S. V. u. a. (2019). Practitioner Review: Emotional dysregulation in ADHD. Journal of Child Psychology and Psychiatry, 60(2), 133–150.']
},

'schule': {
  id: 'schule',
  title: 'Schule: Wenn Stillsitzen zur Hauptaufgabe wird',
  kind: 'ort',
  journeys: ['alltag'],
  icon: 'book',
  teaser: 'Fünfundvierzig Minuten Aufmerksamkeit auf Bestellung: Schule fordert genau das, was manchen Kindern am schwersten fällt.',
  text: [
    'Zweite Stunde, Mathe. Mia hört, was die Lehrerin sagt, und gleichzeitig die Uhr, den Radiergummi vom Nachbarn und den eigenen Gedanken an die Pause. Als die Aufgabe kommt, hat sie den Anfang der Erklärung verpasst. Die Lehrerin sieht ein Kind, das träumt. Mia fühlt sich, als würde sie den ganzen Vormittag gegen sich selbst arbeiten.',
    'Schule verlangt über Stunden Stillsitzen, Zuhören, Warten und Wechseln der Aufgaben, oft auf Zuruf. Für Kinder mit ADHS ist das anstrengend, und Leistung und Verhalten werden dabei leicht verwechselt: Ein Kind kann den Stoff verstehen und trotzdem schlechte Hefte abgeben. Zugleich wird nicht jedes unruhige Kind ein ADHS-Kind. Eine Studie von Todd Elder (2010) fand, dass die im Jahrgang Jüngsten häufiger diagnostiziert werden, was nahelegt, dass auch Vergleich und Erwartung die Einschätzung beeinflussen.',
    'Für Lehrkräfte heißt das: genau beobachten, nichts etikettieren, Eltern früh und wertschätzend ansprechen. Für Familien: Lehrerbeobachtungen sind eine wichtige Informationsquelle, ersetzen aber keine fachliche Abklärung. Was Schulen konkret ändern können, behandelt die Station zu Anpassungen.'
  ],
  facts: [
    'Elder (2010, Journal of Health Economics) fand bei den im Stichtagsjahr Jüngsten in US-Kindergärten häufiger ADHS-Diagnosen als bei den Ältesten.',
    'Elders Raten: etwa 8,4 Prozent bei Geburt im Monat vor dem Stichtag, 5,1 Prozent im Monat danach.',
    'Für eine Diagnose müssen Beschwerden in mehr als einem Lebensbereich auftreten, nicht nur in der Schule.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Elder, T. E. (2010). The importance of relative standards in ADHD diagnoses. Journal of Health Economics, 29(5), 641–656.', 'Evans, W. N., Morrill, M. S. & Parente, S. T. (2010). Measuring inappropriate medical diagnosis and treatment in survey data: The case of ADHD among school-age children. Journal of Health Economics, 29(5), 657–673.']
},

'familie': {
  id: 'familie',
  title: 'Familie: Wenn ein Kind den Takt vorgibt',
  kind: 'konzept',
  journeys: ['alltag'],
  icon: 'family',
  teaser: 'Hausaufgaben, Streit, schlechtes Gewissen: Wie ADHS ein ganzes Familiensystem prägen kann, ohne Schuldzuweisung.',
  text: [
    'Es ist Abend, die Hausaufgaben dauern wieder zwei Stunden, die kleine Schwester will Aufmerksamkeit, und der Vater hört sich zum dritten Mal sagen: „Jetzt setz dich endlich hin.“ Später liegt er wach und fragt sich, ob er etwas falsch macht. Das Kind spürt die Anspannung und fragt sich dasselbe über sich.',
    'Die Forschung beschreibt solche Muster nüchtern: Eine Meta-Analyse von Theule und Kollegen (2013) fand, dass Eltern von Kindern mit ADHS im Mittel mehr Erziehungsstress berichten als andere Eltern. Dabei wirken Kind und Eltern wechselseitig aufeinander; Eltern sind weder die Ursache von ADHS, noch sind sie Opfer. Auch Geschwister tragen mit, mal als Rücksichtnehmende, mal als Zielscheibe. Und weil ADHS familiär gehäuft auftritt, haben manche Eltern selbst ähnliche Schwierigkeiten.',
    'Hilfreich ist, was entlastet: klare Abläufe, überschaubare Aufgaben, gemeinsam gefundene Regeln, Pausen für die Eltern. Das ist keine Anleitung für den Einzelfall; Beratungsstellen und Fachleute können gezielt unterstützen. Wie Elterntraining in den Leitlinien eingeordnet wird, findest du in der Reise zur Behandlung.'
  ],
  facts: [
    'Theule u. a. (2013) werteten in einer Meta-Analyse Studien zu Erziehungsstress bei ADHS aus und fanden erhöhten Stress der Eltern.',
    'Eine Meta-Analyse von 2018 mit 43 Studien fand nach Interventionen für Kinder mit ADHS verringerten Erziehungsstress (moderate Effektgröße).',
    'Erziehung gilt nicht als Ursache von ADHS; Familienalltag und Symptome beeinflussen sich aber wechselseitig.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Theule, J. u. a. (2013). Parenting stress in families of children with ADHD: A meta-analysis. Journal of Emotional and Behavioral Disorders, 21(1), 3–17.']
},

'beziehungen': {
  id: 'beziehungen',
  title: 'Beziehungen: Zuhören, Zuspätkommen, Missverständnisse',
  kind: 'konzept',
  journeys: ['alltag'],
  icon: 'people',
  teaser: 'Dasselbe Verhalten kann gemeint sein als „Ich nehme dich nicht ernst“ oder als „Ich schaffe das gerade nicht“.',
  text: [
    'Jonas kommt zum dritten Mal zu spät zum Essen. Für Lea heißt das: Ich bin ihm nicht wichtig. Für Jonas heißt es: Ich habe die Zeit verloren und schäme mich, aber wenn ich es erkläre, klingt es nach Ausrede. Beide haben recht mit ihrem Gefühl, und beide missverstehen den anderen.',
    'In Beziehungen werden Merkmale, die von außen als Desinteresse gelesen werden, leicht persönlich genommen: das Abschweifen im Gespräch, das Vergessen von Absprachen, das Unterbrechen, die schnelle Gereiztheit. Von innen fühlt es sich oft anders an. Überblicksarbeiten, etwa von Wymbs und Kollegen (2021), berichten, dass Erwachsene mit ADHS im Mittel weniger Zufriedenheit in Partnerschaften und häufiger Trennungen angeben; die Forschung ist aber begrenzt, und viele Paare finden gute Wege.',
    'Was hilft, ist meist unspektakulär: Sichtbare Absprachen statt „Hab ich dir doch gesagt“, Zeit für Gespräche ohne Ablenkung, Humor und das Aussprechen, dass es um das Verhalten geht, nicht um den Wert des anderen. Die Umschaltbarkeit der Perspektive ist das Wichtigste, und sie gilt für beide Seiten.'
  ],
  facts: [
    'Wymbs u. a. (2021) fassten Forschung zu Partnerschaften bei ADHS zusammen: im Mittel geringere Zufriedenheit, mehr Trennungen.',
    'Die Befundlage zu Partnerschaften ist dünner als die zu Schule und Beruf; viele Studien sind klein oder Querschnitt.',
    'Beide Partner können von Paarberatung profitieren; Schuldzuweisungen an eine Seite helfen nicht.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Faraone, S. V. u. a. (2021). The World Federation of ADHD International Consensus Statement: 208 evidence-based conclusions about the disorder. Neuroscience & Biobehavioral Reviews, 128, 789–818.']
},

'beruf': {
  id: 'beruf',
  title: 'Beruf: Passung statt Dauerkampf',
  kind: 'konzept',
  journeys: ['alltag'],
  icon: 'toolbox',
  teaser: 'Manche Arbeitsumgebungen schlucken Energie, andere geben Halt. Was Studien zu Beruf und ADHS sagen.',
  text: [
    'Ein Großraumbüro, ständig neue Nachrichten, ein Chef, der Termine ändert: Für manche ist das ein normaler Dienstag, für andere die Summe aller Dinge, die sie nicht gut können. Dieselbe Person arbeitet im Rettungsdienst, in einer Werkstatt oder als Selbstständige vielleicht ohne Mühe, weil dort Abwechslung, Bewegung und klare Aufgaben vorhanden sind.',
    'Die Forschung zeigt hier Gruppenbefunde. Die WHO-Weltgesundheitsumfrage (de Graaf u. a. 2008) schätzte, dass Beschäftigte mit ADHS im Schnitt etwa 22 Tage im Jahr mehr an Arbeitsleistung einbüßen, und nur wenige waren in Behandlung. Solche Zahlen sind Durchschnitte aus Umfragen, keine Prognose für dich. Die Umstände zählen: Passung von Aufgabe, Umgebung und Unterstützung.',
    'Praktisch hilft, was ohnehin klug ist: klare Prioritäten, schriftliche Absprachen, ruhige Arbeitszeiten und Aufgaben mit Abwechslung. Wer eine Diagnose hat, kann Anpassungen am Arbeitsplatz besprechen; was das heißen kann, steht in der Station zu Anpassungen. Eine Rechtsberatung ersetzt sie nicht.'
  ],
  facts: [
    'In der WHO-Umfrage mit rund 7.000 Erwerbstätigen aus zehn Ländern waren Beschäftigte mit ADHS etwa 22 Tage pro Jahr stärker eingeschränkt (de Graaf u. a. 2008).',
    'Die Erhebung nutzte ein Screening und Selbstauskünfte, keine Einzeldiagnosen.',
    'Der Unterschied war in der Studie nicht an Beruf, Bildung, Alter oder Geschlecht gebunden.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['de Graaf, R. u. a. (2008). Occupational and Environmental Medicine, 65(12), 835–842: The prevalence and effects of adult ADHD on the performance of workers.']
},

'selbstwert': {
  id: 'selbstwert',
  title: 'Selbstbild und Stigma: Wenn Kritik zur Gewohnheit wird',
  kind: 'konzept',
  journeys: ['alltag'],
  icon: 'mirror',
  teaser: 'Wer jahrelang hört „Reiß dich zusammen“, lernt oft etwas Falsches über sich. Und Stigma hat reale Folgen.',
  text: [
    '„Du könntest, wenn du nur wolltest.“ Ein Kind hört diesen Satz hundertmal, von Lehrerin, Eltern, später von sich selbst. Irgendwann glaubt es ihn, und aus der Schwierigkeit wird eine Geschichte über den eigenen Charakter: faul, schusselig, anstrengend.',
    'Die Forschung zu Stigma bei ADHS (Mueller u. a. 2012) beschreibt Vorurteile gegenüber Kindern, Erwachsenen und Angehörigen und vermutet, dass sie ein unterschätzter Risikofaktor sind, etwa für Selbstwert, Wohlbefinden und die Bereitschaft, Hilfe zu suchen. Das betrifft auch Medikamente: Manche scheuen sie aus Sorge vor Vorurteilen, andere werden dafür verurteilt. Die Gründe sind selten rein sachlich.',
    'Das Gegenmittel ist keine Schönfärberei. Hilfreich sind genaue Erklärungen, die Schwierigkeit und Person trennen, und Umfelder, in denen Fehler nicht als Charakterbeweis gelten. Eine Diagnose kann dabei entlasten, weil sie Erleben einordnet; sie kann aber auch ein Etikett werden. Beides kommt vor.'
  ],
  facts: [
    'Mueller u. a. (2012) sichteten die Stigma-Forschung bei ADHS für Kinder, Erwachsene und Angehörige (ADHD Attention Deficit and Hyperactivity Disorders, Bd. 4).',
    'Die Autoren sehen Stigma als möglichen, bisher unterschätzten Einfluss auf Behandlung, Symptome und Wohlbefinden.',
    'Lebowitz (2016, Journal of Attention Disorders) gibt einen Überblick über Stigmatisierung von ADHS in der Entwicklung.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Mueller, A. K., Fuermaier, A. B. M., Koerts, J. & Tucha, L. (2012). Stigma in attention deficit hyperactivity disorder. ADHD Attention Deficit and Hyperactivity Disorders, 4(3), 101–114.', 'Lebowitz, M. S. (2016). Stigmatization of ADHD: A developmental review. Journal of Attention Disorders, 20(3), 199–205.']
},

'risiken': {
  id: 'risiken',
  title: 'Unfälle, Sucht, Abbruch: Risiken ernst nehmen, nicht dramatisieren',
  kind: 'konzept',
  journeys: ['alltag'],
  icon: 'shield',
  teaser: 'In großen Gruppen sind bestimmte Risiken erhöht. Das sagt nichts über den Einzelfall, und es gibt Schutz.',
  text: [
    'Ein Fahrradsturz, eine rote Ampel, eine Party, auf der „nur ein Bier“ nicht dabei bleibt: Impulsivität und Ablenkung zeigen sich auch dort, wo es gefährlich werden kann. Das ist ein heikles Thema, und es verlangt einen ruhigen Ton, weil es Menschen Angst machen kann.',
    'Große Registerstudien zeigen im Gruppendurchschnitt erhöhte Risiken. In Dänemark war die Sterblichkeit bei Menschen mit ADHS etwa doppelt so hoch wie ohne (Dalsgaard u. a. 2015), Unfälle waren die häufigste Todesursache; das absolute Risiko bleibt klein. Schwedische Daten fanden mehr schwere Verkehrsunfälle bei Erwachsenen mit ADHS (Chang u. a. 2014). Eine Meta-Analyse sieht auch ein erhöhtes Risiko für Substanzgebrauch (Lee u. a. 2011).',
    'Dem stehen Schutzfaktoren gegenüber: Unterstützung, Struktur, Behandlung. In der schwedischen Studie lag das Unfallrisiko von Männern in Zeiten mit Medikation niedriger (Vergleich innerhalb derselben Person); bei Frauen zeigte sich das nicht eindeutig, und Beobachtungsstudien beweisen keine Ursache. Risiko bedeutet: Hinschauen und unterstützen, nicht abstempeln.'
  ],
  facts: [
    'Dalsgaard u. a. (2015, Lancet): bereinigtes Sterblichkeitsverhältnis 2,07 bei ADHS in dänischen Registerdaten (32.061 mit ADHS).',
    'Chang u. a. (2014, JAMA Psychiatry): Erwachsene mit ADHS hatten ein Risiko schwerer Verkehrsunfälle von etwa dem 1,5-Fachen.',
    'Beobachtungsstudien zeigen Zusammenhänge, keine gesicherte Ursache; Aussagen gelten für Gruppen, nicht für Einzelne.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  further: ['Dalsgaard, S. u. a. (2015). Mortality in children, adolescents, and adults with attention deficit hyperactivity disorder. The Lancet, 385, 2190–2196.', 'Chang, Z. u. a. (2014). Serious transport accidents in adults with ADHD and the effect of medication. JAMA Psychiatry, 71(3), 319–325.']
},

'superkraft': {
  id: 'superkraft',
  title: 'Mythos: ADHS ist eine Superkraft (und das Gegenteil)',
  kind: 'mythos',
  journeys: ['alltag'],
  icon: 'lightbulb',
  teaser: 'Mal heißt es „Superkraft“, mal „kaputt“. Beide Erzählungen sind zu einfach, und die Wahrheit liegt dazwischen.',
  text: [
    'In Podcasts und sozialen Medien sagt jemand: „ADHS ist meine Superkraft, ich bin kreativ und ohne Angst.“ Im nächsten Beitrag steht, ADHS sei ein Defekt, der Leben zerstört. Beide Sätze werden geteilt, beide klingen überzeugt. Beide stimmen für manche Menschen etwas, und für viele nicht.',
    'Die Forschung zeigt ein nüchterneres Bild. Eine Übersicht zu Kreativität (Hoogman u. a. 2020, 31 Verhaltensstudien) fand bei Menschen mit diagnostizierter ADHS keinen klaren Vorteil im divergenten Denken; bei Menschen mit vielen ADHS-Merkmalen unterhalb der Diagnoseschwelle zeigte sich eher einer. Belege für besseres konvergentes Denken fehlten. Zugleich gilt: ADHS bringt für viele handfeste Beeinträchtigungen mit sich, die eine Diagnose überhaupt erst rechtfertigen.',
    'Stärken und Schwierigkeiten schließen sich nicht aus. Wer von „Superkraft“ spricht, kann Leid kleinreden; wer nur von „Defizit“ spricht, übersieht Fähigkeiten. Fair ist beides: nennen, was schwerfällt und was gelingt, und das Unterstützungsbedürfnis ernst nehmen.'
  ],
  facts: [
    'Hoogman u. a. (2020) sichteten 31 Verhaltensstudien zu Kreativität und ADHS (Neuroscience & Biobehavioral Reviews, Bd. 119).',
    'Divergentes Denken war eher bei hohen ADHS-Merkmalen ohne Diagnose erhöht, nicht bei klinischer ADHS.',
    'Für besseres konvergentes Denken fanden die Autoren keine Belege; viele Studien sind klein.'
  ],
  quote: null,
  myth: {
    glaube: 'ADHS ist eigentlich eine Gabe: Wer sie hat, ist automatisch kreativer, und Schwierigkeiten sind nur ein Missverständnis der Umgebung.',
    wahrheit: 'Die Befunde zeigen kein einheitliches Talent. ADHS bedeutet für viele echte Belastung; Stärken gibt es bei einzelnen Menschen, aber nicht zwangsläufig, und Kreativitätsvorteile sind eher bei Merkmalen unterhalb der Diagnose belegt.'
  },
  cross: {},
  exhibit: null,
  further: ['Hoogman, M. u. a. (2020). Creativity and ADHD: A review of behavioral studies, the effect of psychostimulants and neural underpinnings. Neuroscience & Biobehavioral Reviews, 119, 66–85.']
},

'maedchen-und-frauen': {
  id: 'maedchen-und-frauen',
  title: 'Mädchen und Frauen: Später und leiser erkannt',
  kind: 'konzept',
  journeys: ['alltag', 'verstehen'],
  icon: 'person',
  teaser: 'Das verträumte Mädchen in der Ecke fällt nicht auf, und wird oft erst als Erwachsene erkannt.',
  text: [
    'Zwei Kinder in derselben Klasse: Ben stört, steht auf, wird ermahnt. Lena sitzt still am Fensterplatz, die Gedanken woanders, und ihr Heft ist ein Chaos. Ben fällt auf, Lena nicht. Sie bekommt vielleicht den Ruf, „verträumt“ zu sein, und strengt sich im Stillen doppelt an, um nicht aufzufallen.',
    'In Kliniken werden deutlich mehr Jungen als Mädchen mit ADHS gesehen, bei Erwachsenen nähern sich die Zahlen an. Mehrere Erklärungen gelten als plausibel: Mädchen zeigen im Mittel häufiger unaufmerksame und weniger auffällige Formen, Lehrkräfte und Eltern bewerten sie anders, und Angst oder Depression können überdecken, was dahintersteckt. Wie groß der Anteil der Verzerrung ist, ist nicht genau bekannt. Frühe Forschung beruhte zudem überwiegend auf Jungen.',
    'Für Betroffene kann das heißen: jahrelang mit dem Gefühl, „sich mehr anstrengen zu müssen“, bevor die Frage nach ADHS fällt. Auch den Satz von der „Jungenkrankheit“ trägt die Evidenz nicht.'
  ],
  facts: [
    'In klinischen Stichproben sind Jungen mit ADHS deutlich häufiger als Mädchen; bei Erwachsenen ist das Verhältnis ausgeglichener.',
    'Mädchen zeigen im Mittel häufiger die vorwiegend unaufmerksame Form, die im Unterricht weniger auffällt.',
    'In der Dänemark-Studie (Dalsgaard u. a. 2015) war das Sterblichkeitsverhältnis bei Frauen 2,85, bei Männern 1,27.'
  ],
  quote: null,
  myth: null,
  cross: {
    verstehen: 'Hier trifft die Frage nach der Häufigkeit auf ihre Verzerrung: Wer wird überhaupt erkannt, und was sagen Diagnosezahlen über tatsächliche Verbreitung?'
  },
  exhibit: null,
  further: ['Faraone, S. V. u. a. (2021). The World Federation of ADHD International Consensus Statement. Neuroscience & Biobehavioral Reviews, 128, 789–818.', 'Dalsgaard, S. u. a. (2015). Mortality in children, adolescents, and adults with ADHD. The Lancet, 385, 2190–2196.']
}

});
})();
