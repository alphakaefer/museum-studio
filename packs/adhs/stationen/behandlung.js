// Stationen der Reise „behandlung“ (Heimat-Reise). Schema: docs/INHALT-SCHREIBEN.md.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'diagnose-weg': {
  id: 'diagnose-weg',
  title: 'Wie eine Abklärung abläuft',
  kind: 'methode',
  journeys: ['behandlung'],
  icon: 'clipboard',
  teaser: 'Kein Bluttest, kein Hirnscan: Eine Abklärung ist ein Gespräch, viele Beobachtungen und das Ausschließen anderer Gründe.',
  text: [
    'Eine Mutter sitzt mit ihrem Sohn im Wartezimmer, in der Tasche das Zeugnis und zwei Briefe der Lehrerin. Drinnen wird die Ärztin vieles fragen: wie die Schwangerschaft und die ersten Jahre verliefen, wie es zu Hause und in der Schule geht, seit wann etwas auffällt. Dazu kommen Fragebögen für Eltern und Lehrkräfte, Gespräche mit dem Kind selbst und eine körperliche Untersuchung.',
    'Eine Diagnose entsteht nicht aus einem einzelnen Messwert. Die Handbücher verlangen, dass die Merkmale über längere Zeit bestehen, schon in der Kindheit begonnen haben, in mehr als einem Lebensbereich auftreten und im Alltag deutlich belasten. Fachleute prüfen außerdem, ob etwas anderes die Beobachtungen besser erklärt: Hörprobleme, Schlafmangel, Angst, Depression, Autismus oder eine schwierige Lebenslage. Blutwerte oder EEG dienen eher dem Ausschluss solcher Gründe als dem Nachweis von ADHS.',
    'Bei Erwachsenen kommt die Rückschau dazu: Wie war die Schulzeit, was erinnern Eltern oder alte Zeugnisse? Online-Tests können eine Abklärung nicht ersetzen, auch dieses Museum bietet keinen an. Wer sich wiedererkennt, ist beim Hausarzt, bei Fachpraxen oder Beratungsstellen besser aufgehoben.'
  ],
  facts: [
    'Es gibt keinen Labortest und keine Bildgebung, die ADHS im Einzelfall nachweist.',
    'Die Handbücher verlangen Beginn in der Kindheit (DSM-5: vor dem 12. Lebensjahr) und Beeinträchtigung in mehr als einem Lebensbereich.',
    'Fragebögen unterstützen die Einschätzung, ersetzen aber nicht das Gespräch mit Fachleuten.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  blog: [],
  further: [
    'American Psychiatric Association (2022). Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition, Text Revision (DSM-5-TR). APA Publishing.',
    'AWMF: S3-Leitlinie ADHS im Kindes-, Jugend- und Erwachsenenalter, Registernummer 028-045 (register.awmf.org).'
  ]
},

'anpassungen': {
  id: 'anpassungen',
  title: 'Anpassungen: Struktur, Nachteilsausgleich, Arbeitsplatz',
  kind: 'methode',
  journeys: ['behandlung', 'alltag'],
  icon: 'toolbox',
  teaser: 'Manchmal hilft nicht ein Mittel gegen die Unruhe, sondern ein anderer Platz im Klassenraum oder im Büro.',
  text: [
    'Ein Schüler bekommt die Klassenarbeit in einem ruhigen Nebenraum und eine Pause in der Mitte. Der Stoff ist derselbe, die Bewertung auch, nur die Umgebung ist angepasst. Genau das meint ein Nachteilsausgleich: gleiche Anforderungen, andere Bedingungen. Ähnlich im Beruf: feste Abläufe, schriftliche Absprachen statt mündlicher Zurufe, ein Platz ohne Durchgangsverkehr.',
    'Die Leitlinien sehen solche Veränderungen der Umgebung als festen Teil der Behandlung. Die britische NICE-Leitlinie empfiehlt bei Schulkindern, zunächst Anpassungen zu versuchen und zu prüfen, bevor Medikamente erwogen werden, wenn die Beeinträchtigung dann bleibt. Dazu gehören klare Strukturen, überschaubare Aufgaben und zeitnahe Rückmeldungen.',
    'Ehrlich gesagt: Viele dieser Maßnahmen sind plausibel und werden von Betroffenen oft als Entlastung erlebt, einzeln untersucht sind aber nur wenige. In Deutschland regeln Landesrecht, Schulen und Arbeitgeber die Einzelheiten unterschiedlich, und ob etwas gewährt wird, hängt vom Einzelfall und von Gutachten ab. Wie sich das im Schul- und Berufsalltag anfühlt, steht in der Reise „Alltag“.'
  ],
  facts: [
    'Nachteilsausgleich verändert Bedingungen einer Prüfung (Zeit, Raum, Pausen), nicht die inhaltlichen Anforderungen.',
    'NICE (NG87, 2018) nennt Anpassungen der Umgebung als ersten Schritt, bevor bei Schulkindern Medikamente erwogen werden.',
    'Für viele Einzelmaßnahmen im Klassenraum und im Betrieb fehlen gute Vergleichsstudien.'
  ],
  quote: null,
  myth: null,
  cross: {
    alltag: 'Hier erlebst du dieselben Anpassungen von der anderen Seite: wie Schule, Familie und Betrieb mit ihnen den Alltag tatsächlich verändern.'
  },
  exhibit: null,
  blog: [],
  further: [
    'National Institute for Health and Care Excellence (2018). Attention deficit hyperactivity disorder: diagnosis and management (NG87). NICE.'
  ]
},

'elterntraining': {
  id: 'elterntraining',
  title: 'Elterntraining und Psychoedukation',
  kind: 'methode',
  journeys: ['behandlung'],
  icon: 'family',
  teaser: 'Bei jungen Kindern setzen Leitlinien zuerst bei den Eltern an. Das ist kein Vorwurf, sondern ein Werkzeugkasten.',
  text: [
    'Abends um sieben endet der Tag oft im Streit: Jacke, Zähneputzen, Hausaufgaben, jedes Mal dasselbe Tauziehen. Im Elterntraining üben Eltern in Gruppen oder Einzelstunden Dinge wie klare Anweisungen, verlässliche Abläufe, Lob für Gelungenes und ruhige Reaktionen auf Regelbruch. Dazu gehört Psychoedukation, also schlicht Wissen: Was steckt hinter dem Verhalten, und was lässt sich erwarten?',
    'Ein Training sagt nicht, dass Erziehung die Ursache wäre. Es geht darum, einem Kind mit schwerer Selbststeuerung den Alltag durch passende Rahmen leichter zu machen. Die britische NICE-Leitlinie nennt Elterntraining bei Vorschulkindern als ersten Schritt; die deutsche S3-Leitlinie stellt bei jüngeren Kindern ebenfalls Maßnahmen mit den Bezugspersonen in den Vordergrund.',
    'Was die Studien zeigen, ist differenziert: Eine Übersichtsarbeit von Daley und Kollegen (2018) fand bei Urteilen von Personen, die nicht wussten, wer trainiert wurde, vor allem Vorteile für das Erziehungsverhalten und für Verhaltensprobleme, weniger für die Kernsymptome selbst. Der Nutzen liegt also im Miteinander. Was bei älteren Kindern hinzukommt, behandelt die Station zur Studie MTA.'
  ],
  facts: [
    'Elterntraining ist in NICE NG87 bei Vorschulkindern die erste empfohlene Maßnahme.',
    'Verblindete Auswertungen zeigen Nutzen für Erziehungsverhalten und Verhaltensprobleme, weniger für Kernsymptome (Daley u. a. 2018).',
    'Psychoedukation vermittelt Wissen über ADHS an Betroffene und Familien und gehört in Leitlinien zu jeder Behandlung.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  blog: [],
  further: [
    'Daley, D. u. a. (2018). Practitioner Review: Current best practice in the use of parent training and other behavioural interventions in the treatment of children and adolescents with ADHD. Journal of Child Psychology and Psychiatry, 59(9).'
  ]
},

'medikation-wirkung': {
  id: 'medikation-wirkung',
  title: 'Medikamente: Was Studien zur Wirkung zeigen',
  kind: 'konzept',
  journeys: ['behandlung'],
  icon: 'pill',
  teaser: 'Viele Studien, kurze Dauer, ein Streit um die Qualität: Was über die Wirkung von ADHS-Medikamenten wirklich bekannt ist.',
  text: [
    'Stell dir ein Heft vor, in dem eine Lehrerin jede Woche bewertet, wie gut ein Kind bei der Sache bleibt, und Eltern ihre eigenen Eindrücke danebenschreiben. Solche Urteile sammeln die Studien, in denen Medikamente gegen Scheinpräparate antreten. Eine große Auswertung von Cortese und Kollegen (2018) verglich in einer Netzwerk-Metaanalyse mehrere Wirkstoffe: 81 Studien mit Kindern und Jugendlichen, 51 mit Erwachsenen.',
    'Das Ergebnis, grob: Stimulanzien wie Methylphenidat und Amphetamine verbessern die Kernsymptome kurzfristig deutlich; Nicht-Stimulanzien wie Atomoxetin und Guanfacin wirken ebenfalls, tendenziell schwächer. Abwägend sahen die Autoren Methylphenidat bei Kindern und Amphetamine bei Erwachsenen vorn. Die Wirkung hält an, solange die Mittel genommen werden; Heilung bedeutet das nicht.',
    'Die Grenzen gehören dazu. Die meisten Studien dauern nur Wochen, und ein Cochrane-Review von 2015 stufte die Belege für Methylphenidat bei Kindern als sehr niedrig ein, was heftig diskutiert wurde: Kritiker halten die Bewertung für zu streng. Einigkeit besteht darin, dass Langzeitdaten fehlen. Was das fürs Abwägen bedeutet, steht in der nächsten Station.'
  ],
  facts: [
    'Die Netzwerk-Metaanalyse von Cortese u. a. (2018) umfasste 81 Studien mit Kindern und Jugendlichen und 51 mit Erwachsenen.',
    'Die Autoren sahen kurzfristig Methylphenidat bei Kindern und Amphetamine bei Erwachsenen als bevorzugte Wahl.',
    'Ein Cochrane-Review (Storebø u. a. 2015) bewertete die Beleglage zu Methylphenidat bei Kindern als sehr niedrig; das ist umstritten.',
    'Cortese u. a. forderten dringend Studien zu Langzeitwirkungen.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  blog: [],
  further: [
    'Cortese, S. u. a. (2018). Comparative efficacy and tolerability of medications for ADHD in children, adolescents, and adults: a systematic review and network meta-analysis. The Lancet Psychiatry, 5(9).',
    'Storebø, O. J. u. a. (2015). Methylphenidate for children and adolescents with attention deficit hyperactivity disorder. Cochrane Database of Systematic Reviews.'
  ]
},

'medikation-risiken': {
  id: 'medikation-risiken',
  title: 'Nebenwirkungen und Abwägen: Was man weiß und was nicht',
  kind: 'konzept',
  journeys: ['behandlung'],
  icon: 'scale',
  teaser: 'Appetit, Schlaf, Puls: Kurzfristig ist vieles gut bekannt. Bei langen Zeiträumen bleiben Lücken, und das gehört auf den Tisch.',
  text: [
    'In der Sprechstunde geht es selten nur um die Frage „Wirkt es?“, sondern auch um „Was kostet es?“. Häufig genannt werden bei Stimulanzien weniger Appetit, Einschlafprobleme, Bauch- und Kopfschmerzen sowie ein leicht erhöhter Puls und Blutdruck. Manche Menschen berichten, sich gedämpft zu fühlen; das gilt als mögliche Nebenwirkung, über die man mit der behandelnden Person spricht.',
    'Zu den Zeiträumen: Systematische Übersichten sehen Veränderungen von Herzfrequenz und Blutdruck meist als klein und ohne auffällige schwere Herzereignisse, betonen aber, dass Langzeitdaten dünn sind. Bei Wachstum sind die Befunde uneinheitlich, und eine europäische Expertengruppe verlangt, Nebenwirkungen während einer Behandlung systematisch zu beobachten.',
    'Abwägen heißt deshalb nicht Ja oder Nein im Allgemeinen, sondern Nutzen und Belastung im Einzelfall, gemeinsam mit Fachleuten und mit regelmäßigen Kontrollen. Hier steht bewusst nichts zu Dosierung oder Auswahl, das gehört in ärztliche Hände. Zu den bekanntesten Sorgen rund um Ritalin gehört die nächste Station.'
  ],
  facts: [
    'Häufige kurzfristige Nebenwirkungen von Stimulanzien: weniger Appetit, Schlafprobleme, Kopf- und Bauchschmerzen.',
    'Herzfrequenz und Blutdruck steigen im Mittel leicht; schwere Herzereignisse wurden in Übersichten kaum berichtet.',
    'Die europäische ADHD-Leitliniengruppe hält Langzeitsicherheit für nicht ausreichend geklärt und fordert systematische Kontrolle.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  blog: [],
  further: [
    'Cortese, S. u. a. (2018). Comparative efficacy and tolerability of medications for ADHD in children, adolescents, and adults. The Lancet Psychiatry, 5(9).'
  ]
},

'mythos-ritalin': {
  id: 'mythos-ritalin',
  title: 'Mythos: Ritalin macht süchtig und verändert die Persönlichkeit',
  kind: 'mythos',
  journeys: ['behandlung'],
  icon: 'exclamation',
  teaser: 'Zwei Sorgen halten sich hartnäckig. Was zu Abhängigkeit, Missbrauch und Persönlichkeit belegt ist und wo es Grenzen gibt.',
  text: [
    'Auf dem Schulhof und in Foren wird es oft erzählt: Wer als Kind Ritalin nimmt, wird später süchtig, und aus dem Kind wird jemand anderes. Beide Sorgen haben einen wahren Kern, der Rest ist ungenau. Methylphenidat ist ein Stimulans und unterliegt in Deutschland dem Betäubungsmittelrecht. Es wird außerdem missbraucht, etwa als Lernhilfe oder Aufputschmittel, oft in hohen Mengen oder ohne ärztliche Begleitung.',
    'Für Menschen, die es verschrieben bekommen, ist das Bild anders. Studien deuten insgesamt nicht darauf hin, dass die Behandlung das Risiko späterer Suchterkrankungen erhöht; ob sie es senkt, ist uneinheitlich und umstritten. Zur Persönlichkeit: Ein gedämpftes, „flaches“ Gefühl kennen manche als Nebenwirkung, die man ansprechen sollte. Belastbare Belege für eine dauerhafte Veränderung der Persönlichkeit gibt es nicht.',
    'Entscheidend bleibt der Rahmen: ärztliche Verordnung, Kontrolle, offene Gespräche über Wirkungen. Das Wort Mythos meint hier nicht, dass nichts dran sei, sondern dass „süchtig“ und „verändert“ als Pauschalaussagen nicht tragen.'
  ],
  facts: [
    'Methylphenidat fällt in Deutschland unter das Betäubungsmittelrecht und wird mit besonderem Rezept verordnet.',
    'Übersichten finden insgesamt kein erhöhtes Risiko späterer Suchterkrankungen durch die ärztliche Behandlung.',
    'Für eine dauerhafte Persönlichkeitsveränderung durch Verordnung gibt es keine belastbaren Belege.'
  ],
  quote: null,
  myth: {
    glaube: 'Ritalin macht Kinder süchtig und verändert ihre Persönlichkeit.',
    wahrheit: 'Bei ärztlich verordneter Einnahme zeigen Studien insgesamt kein erhöhtes späteres Suchtrisiko; Missbrauch außerhalb der Verordnung kommt vor. Eine dauerhafte Persönlichkeitsveränderung ist nicht belegt, ein gedämpftes Gefühl ist als Nebenwirkung bekannt.'
  },
  cross: {},
  exhibit: null,
  blog: [],
  further: [
    'Storebø, O. J. u. a. (2015). Methylphenidate for children and adolescents with attention deficit hyperactivity disorder. Cochrane Database of Systematic Reviews.'
  ]
},

'ohne-medikament': {
  id: 'ohne-medikament',
  title: 'Was ohne Tabletten hilft: Training, Bewegung, Diäten, Neurofeedback',
  kind: 'konzept',
  journeys: ['behandlung'],
  icon: 'leaf',
  teaser: 'Viele Wege klingen gut. Wie stark die Belege wirklich sind, unterscheidet sich von Ansatz zu Ansatz erheblich.',
  text: [
    'Im Regal der Buchhandlung stehen Diätratgeber, Gehirntraining und Apps, und bei der Nachbarin hilft angeblich Sport. Verständlich, denn viele wünschen sich Wege ohne Medikamente. Die Prüfung ist nur nicht ganz einfach: Wenn Eltern wissen, dass ihr Kind trainiert wird, sehen sie leicht Fortschritte. Deshalb zählen Urteile von Personen, die das nicht wissen.',
    'Eine Übersicht von Sonuga-Barke und Kollegen (2013) prüfte genau das. Bei solchen „wahrscheinlich verblindeten“ Urteilen blieben nur ein kleiner Effekt von Omega-Fettsäuren und ein etwas größerer beim Verzicht auf künstliche Farbstoffe, bei kleinen, uneinheitlichen Studien. Kognitives Training und Neurofeedback zeigten dort keinen eindeutigen Effekt auf die Kernsymptome. Spätere Auswertungen sind ähnlich zurückhaltend, ob Neurofeedback wirkt, ist weiter umstritten.',
    'Für Bewegung gibt es Hinweise auf Nutzen bei Aufmerksamkeit und Wohlbefinden, die Studien sind aber klein. Verhaltenstherapie hilft bei Alltagsproblemen und Familien. Leitlinien empfehlen deshalb meist Elterntraining, Anpassungen und Psychotherapie als Standard, Diäten nicht pauschal.'
  ],
  facts: [
    'Sonuga-Barke u. a. (2013) werteten 54 Studien zu Diäten, Training, Neurofeedback und Verhaltensinterventionen aus.',
    'Bei wahrscheinlich verblindeten Urteilen blieben nur Fettsäuren und Farbstoffverzicht mit kleinen Effekten.',
    'Zu Neurofeedback und kognitivem Training fehlen belastbare Belege für Effekte auf Kernsymptome.'
  ],
  quote: null,
  myth: null,
  cross: {},
  exhibit: null,
  blog: [],
  further: [
    'Sonuga-Barke, E. J. S. u. a. (2013). Nonpharmacological interventions for ADHD: Systematic review and meta-analyses of randomized controlled trials. American Journal of Psychiatry, 170(3).'
  ]
},

'ueberdiagnose': {
  id: 'ueberdiagnose',
  title: 'Zu viel oder zu wenig diagnostiziert?',
  kind: 'konzept',
  journeys: ['behandlung', 'verstehen'],
  icon: 'scale',
  teaser: 'Beide Vorwürfe haben Zahlen hinter sich. Warum Über- und Unterdiagnose zugleich möglich sind.',
  text: [
    'Zwei Kinder in derselben Klasse: Das eine ist im Dezember geboren, das andere im Januar, ein knappes Jahr Altersunterschied. Das jüngere hat es beim Stillsitzen schwerer und fällt eher auf. In einer finnischen Registerstudie (Sayal u. a. 2017) bekamen relativ jüngere Kinder eher die Diagnose ADHS. Das ist ein Hinweis auf Fehldiagnosen, wenn Reife mit Störung verwechselt wird.',
    'Dem steht eine zweite Beobachtung gegenüber. Die Zahl der Diagnosen stieg in vielen Ländern, die in Studien mit einheitlichen Kriterien gemessene Häufigkeit aber kaum (Polanczyk u. a. 2014). Ein Teil des Anstiegs kann auf mehr Aufmerksamkeit und Wissen beruhen. Zugleich bleiben viele Betroffene unerkannt, etwa Mädchen, Frauen und Erwachsene.',
    'Beides kann gleichzeitig stimmen: Wo Aufmerksamkeit groß ist, wird mancher Reifeunterschied als ADHS gedeutet, wo Wissen fehlt, bleibt anderes unentdeckt. Wer die Schwelle senkt, gewinnt Treffer und verliert Genauigkeit. Eine Entscheidung ohne Kosten gibt es nicht, das zeigt auch die Reise „Verstehen“.'
  ],
  facts: [
    'Sayal u. a. (2017, Finnland): Relativ jüngere Kinder einer Klassenstufe erhielten häufiger eine ADHS-Diagnose.',
    'Polanczyk u. a. (2014): Bei einheitlicher Methodik stieg die gemessene Häufigkeit über drei Jahrzehnte kaum.',
    'Über- und Unterdiagnose können in derselben Bevölkerung nebeneinander auftreten.'
  ],
  quote: null,
  myth: null,
  cross: {
    verstehen: 'Hier siehst du, warum diese Frage an der Grenze zwischen normaler Vielfalt und Beeinträchtigung hängt: Wo man eine Schwelle zieht, entscheidet über Zahl und Fehlerart.'
  },
  exhibit: null,
  blog: [],
  further: [
    'Sayal, K. u. a. (2017). Relative age within the school year and diagnosis of attention-deficit hyperactivity disorder: a nationwide population-based study. The Lancet Psychiatry, 4(11).',
    'Polanczyk, G. V. u. a. (2014). ADHD prevalence estimates across three decades: an updated systematic review and meta-regression analysis. International Journal of Epidemiology, 43(2).'
  ]
},

'mta': {
  id: 'mta',
  title: 'Die MTA-Studie: Medikation oder Verhaltenstherapie?',
  kind: 'ereignis',
  journeys: ['behandlung', 'geschichte'],
  year: 1999,
  yearLabel: '1999',
  icon: 'flask',
  teaser: 'Die größte Vergleichsstudie ihrer Zeit: 579 Kinder, vier Wege. Und eine Nachbeobachtung, die manches relativierte.',
  text: [
    'Sechs Standorte in den USA, 579 Kinder zwischen sieben und knapp zehn Jahren mit kombiniertem ADHS, und ein einfacher Plan: Das Los entscheidet, welche Behandlung jedes Kind bekommt. Zur Wahl standen sorgfältig geführte Medikation, intensive Verhaltenstherapie mit Eltern, Schule und Kind, beides zusammen oder die übliche Versorgung vor Ort. Die Ergebnisse nach 14 Monaten erschienen 1999 im Fachblatt Archives of General Psychiatry.',
    'Am besten schnitten die beiden Gruppen mit Medikation ab; die Verhaltenstherapie allein lag dahinter, aber vor wenig. Die Kombination brachte bei den Kernsymptomen keinen klaren Vorsprung vor der Medikation allein, zeigte aber Vorteile in einigen anderen Bereichen und bei der Zufriedenheit der Eltern.',
    'Entscheidend ist die Nachbeobachtung. Nach 36 Monaten ließen sich die Unterschiede zwischen den Gruppen statistisch nicht mehr nachweisen (Jensen u. a. 2007). Das heißt nicht, dass Medikamente nichts bringen: Danach wurde nicht mehr kontrolliert behandelt. Es zeigt aber, wie schwer Langzeitwirkungen zu belegen sind. Wo die Studie in der Geschichte der Diagnose steht, zeigt der Zeitstrahl.'
  ],
  facts: [
    'Die MTA-Studie schloss 579 Kinder im Alter von 7 bis 9,9 Jahren mit kombiniertem ADHS ein.',
    'Vier Gruppen: Medikation, Verhaltenstherapie, Kombination, übliche Versorgung; die Ergebnisse nach 14 Monaten erschienen 1999.',
    'Nach 36 Monaten bestanden keine statistisch gesicherten Unterschiede zwischen den Ausgangsgruppen mehr (Jensen u. a. 2007).'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Auf dem Zeitstrahl ist die MTA-Studie der Punkt, an dem Behandlungsansätze in einem großen Vergleich direkt gegeneinander antraten und Fachleute lernten, Kurz- und Langzeitwirkung zu trennen.'
  },
  exhibit: null,
  blog: [],
  further: [
    'MTA Cooperative Group (1999). A 14-month randomized clinical trial of treatment strategies for attention-deficit/hyperactivity disorder. Archives of General Psychiatry, 56(12).',
    'Jensen, P. S. u. a. (2007). 3-year follow-up of the NIMH MTA study. Journal of the American Academy of Child and Adolescent Psychiatry, 46(8).'
  ]
},

'leitlinien': {
  id: 'leitlinien',
  title: 'Leitlinien: NICE 2018 und die deutsche S3-Leitlinie',
  kind: 'ereignis',
  journeys: ['behandlung', 'geschichte'],
  year: 2018,
  yearLabel: '2018',
  icon: 'book',
  teaser: 'Wie aus tausenden Studien Empfehlungen werden, und warum Länder zu verschiedenen Akzenten kommen.',
  text: [
    'Ein Ausschuss aus Ärztinnen, Psychologen, Betroffenen und Fachleuten sitzt über Studienlisten und fragt bei jeder Behandlung: Wie sicher ist der Nutzen, was kostet er, was sagen Betroffene? Das Ergebnis ist eine Leitlinie. Im März 2018 veröffentlichte das britische NICE seine Leitlinie NG87 zur Diagnose und Behandlung von ADHS; sie wurde später ergänzt.',
    'In Deutschland gibt es die S3-Leitlinie der AWMF, in der Fachgesellschaften gemeinsam Empfehlungen zu Vorbeugung, Diagnostik und Behandlung für Kinder, Jugendliche und Erwachsene formulieren. Beide Dokumente setzen bei jüngeren Kindern auf Information und Maßnahmen mit Bezugspersonen, sehen Medikamente bei Bedarf als Teil eines Gesamtplans und verlangen gemeinsame Entscheidungen. Im Detail unterscheiden sie sich in Stufen, Alter und Gewichtung.',
    'Eine Leitlinie ist keine Vorschrift für den Einzelfall. Sie fasst den Stand des Wissens zu einem Zeitpunkt zusammen und wird überarbeitet; den aktuellen Wortlaut findest du bei den Herausgebern. Wie sich die Beschreibungen der Diagnose selbst gewandelt haben, zeigt die Reise „Geschichte“.'
  ],
  facts: [
    'NICE veröffentlichte NG87 „ADHD: diagnosis and management“ im März 2018.',
    'Die deutsche S3-Leitlinie trägt die AWMF-Registernummer 028-045 und gilt für Kinder, Jugendliche und Erwachsene.',
    'Leitlinien werden überarbeitet; maßgeblich ist die jeweils aktuelle Fassung.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Im Zeitstrahl zeigt 2018, wie sich Behandlung von Einzelmeinung zu geprüfter, öffentlich nachlesbarer Empfehlung entwickelte, mit Evidenzstufen statt Autorität.'
  },
  exhibit: null,
  blog: [],
  further: [
    'National Institute for Health and Care Excellence (2018). Attention deficit hyperactivity disorder: diagnosis and management (NG87). NICE.',
    'AWMF: S3-Leitlinie ADHS im Kindes-, Jugend- und Erwachsenenalter, Registernummer 028-045.'
  ]
},

'icd11': {
  id: 'icd11',
  title: 'ICD-11: Ein Regelwerk der WHO',
  kind: 'ereignis',
  journeys: ['behandlung', 'geschichte'],
  year: 2022,
  yearLabel: '2022',
  icon: 'map',
  teaser: 'Zwei Handbücher, ein Muster: Wie die Weltgesundheitsorganisation ADHS beschreibt und worin sie vom DSM abweicht.',
  text: [
    'Für Abrechnung, Statistik und Forschung braucht jedes Gesundheitssystem eine gemeinsame Sprache. Die Weltgesundheitsorganisation pflegt sie in der „Internationalen Klassifikation der Krankheiten“. Deren elfte Fassung, ICD-11, trat am 1. Januar 2022 in Kraft. ADHS steht dort unter den neuronalen Entwicklungsstörungen, mit dem Code 6A05.',
    'Die Beschreibung ähnelt dem US-Handbuch DSM-5-TR: anhaltende Unaufmerksamkeit und/oder Hyperaktivität und Impulsivität, die im Alltag klar belasten. Drei Präsentationen werden unterschieden: überwiegend unaufmerksam, überwiegend hyperaktiv-impulsiv und kombiniert. Die ICD-11 benennt den Beginn weicher, meist in früher bis mittlerer Kindheit, das DSM-5 verlangt Merkmale vor dem 12. Lebensjahr.',
    'Die ältere ICD-10 sprach noch von hyperkinetischen Störungen mit engeren Anforderungen. Wann und wie die ICD-11 in der deutschen Praxis eingeführt wird, hängt von nationalen Regeln ab. Wie die Namen und Kriterien über die Jahrzehnte wechselten, siehst du auf dem Zeitstrahl.'
  ],
  facts: [
    'ICD-11 trat am 1. Januar 2022 in Kraft; ADHS trägt dort den Code 6A05.',
    'ICD-11 kennt die Präsentationen überwiegend unaufmerksam, überwiegend hyperaktiv-impulsiv und kombiniert.',
    'Die ICD-10 verwendete den Begriff hyperkinetische Störungen.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Im Zeitstrahl markiert 2022 einen vorläufigen Endpunkt: Hyperaktivität und Unaufmerksamkeit stehen unter einem Code, statt in getrennten Kästen wie in älteren Fassungen.'
  },
  exhibit: null,
  blog: [],
  further: [
    'World Health Organization (2022). ICD-11 for Mortality and Morbidity Statistics, Eintrag 6A05 „Attention deficit hyperactivity disorder“ (icd.who.int).'
  ]
},

'neurodiversitaet': {
  id: 'neurodiversitaet',
  title: 'Neurodiversität: Eine andere Sicht und ihre Kritik',
  kind: 'konzept',
  journeys: ['behandlung', 'geschichte'],
  year: 1998,
  yearLabel: '1998',
  icon: 'infinity',
  teaser: 'Störung oder Vielfalt? Zwei Sichtweisen, die nicht ganz gegeneinanderstehen, und was jede übersieht.',
  text: [
    'Ein Netzwerk, in dem sich autistische Menschen austauschten, suchte in den 1990ern ein Wort für das, was sie verband: ein anderes Gehirn, nicht unbedingt ein kaputtes. 1998 gebrauchten der Journalist Harvey Blume in einem Zeitschriftenartikel und die Soziologin Judy Singer in ihrer Abschlussarbeit das Wort „Neurodiversität“. Wer es zuerst prägte, ist unter Fachleuten umstritten; es entstand aus einer Gemeinschaft, nicht aus einer einzelnen Person.',
    'Die Sicht fasst Unterschiede in Aufmerksamkeit, Denken und Wahrnehmen als Teil menschlicher Vielfalt und fragt, was an Schule und Arbeit Menschen ausgrenzt. Sie hat vielen Stigma genommen und Anpassungen politisch begründet. Kritisch gefragt wird, ob sie Menschen mit starker Beeinträchtigung und hohem Hilfebedarf übergeht und ob Behandlung dadurch in Misskredit gerät. Das medizinische Modell wiederum kann Leiden übersehen, das aus der Umgebung kommt.',
    'Viele Fachleute und Betroffene verbinden beides: Unterstützung dort, wo jemand leidet, und weniger Abwertung dort, wo es nur anders ist. Wie diese Haltungen seit den 1990er-Jahren die Diskussion verändert haben, zeigt der Zeitstrahl.'
  ],
  facts: [
    'Singer schrieb 1998 eine Abschlussarbeit zu autistischen Netzwerken; im selben Jahr erschien Blumes Artikel über Neurodiversität.',
    'Die Urheberschaft des Wortes ist umstritten; es entstand in Online-Gemeinschaften autistischer Menschen.',
    'Auf ADHS wurde das Konzept später angewandt; die Debatte, ob es für alle Betroffenen passt, dauert an.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Im Zeitstrahl steht 1998 für einen Wechsel der Perspektive: Erstmals sprachen Betroffene selbst über ihre Unterschiede, statt nur beschrieben zu werden.'
  },
  exhibit: null,
  blog: [],
  further: [
    'Sonuga-Barke, E. & Thapar, A. (2021). The neurodiversity concept: is it helpful for clinicians and scientists? The Lancet Psychiatry, 8(7).',
    'Chapman, R. (2023). Empire of Normality: Neurodiversity and Capitalism. Pluto Press.'
  ]
}

});
})();
