// Stationen der Reise „verstehen“ (Heimat-Reise). Schema: docs/INHALT-SCHREIBEN.md.
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

'praesentationen': {
  id: 'praesentationen',
  title: 'Zwei Kinder, zwei Arten, nicht anzukommen',
  kind: 'konzept',
  journeys: ['verstehen'],
  icon: 'child',
  teaser: 'Das eine Kind schaut aus dem Fenster, das andere klettert auf den Tisch. Beide können ADHS haben. Wie geht das?',
  text: [
    'In der dritten Reihe starrt Lena aus dem Fenster. Sie hat die Aufgabe gehört, aber sie ist längst woanders, und ihr Heft bleibt leer. Zwei Bänke weiter wippt Jonas auf dem Stuhl, ruft die Antwort in den Raum und steht schon wieder. Beide fallen auf, auf sehr verschiedene Weise, und beide können dieselbe Diagnose haben.',
    'Die Handbücher beschreiben zwei Merkmalsbereiche: Unaufmerksamkeit und Desorganisation einerseits, Hyperaktivität und Impulsivität andererseits. Das DSM-5 unterscheidet davon ausgehend drei „Präsentationen“: überwiegend unaufmerksam, überwiegend hyperaktiv-impulsiv und kombiniert. Der Begriff „Präsentation“ ist mit Absicht gewählt, denn das Bild kann sich im Lauf des Lebens verschieben.',
    'Wichtig ist, was hier nicht steht: Die Station ist keine Checkliste, und aus einem Bild lässt sich nichts ablesen. Ob jemand ADHS hat, klärt eine gründliche Untersuchung, kein Vergleich mit einer Beschreibung. Wie es sich im Alltag anfühlt, zeigt die Reise „Alltag“.'
  ],
  facts: [
    'Das DSM-5 kennt drei Präsentationen: überwiegend unaufmerksam, überwiegend hyperaktiv-impulsiv, kombiniert.',
    'Jeder der zwei Merkmalsbereiche umfasst im DSM-5 neun Beschreibungen.',
    'Die Präsentation kann sich im Lauf des Lebens ändern.'
  ],
  quote: null,
  myth: null,
  cross: {},
  blog: [],
  further: [
    'American Psychiatric Association (2022). Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition, Text Revision (DSM-5-TR). APA Publishing.'
  ]
},

'kontinuum': {
  id: 'kontinuum',
  title: 'Eine Grenze mitten im Kontinuum',
  kind: 'konzept',
  journeys: ['verstehen'],
  icon: 'scale',
  teaser: 'Jeder kennt Tage, an denen die Gedanken abdriften. Die Frage ist, wo „normal“ endet und eine Diagnose beginnt.',
  text: [
    'Du suchst zum dritten Mal deine Schlüssel und hast vergessen, warum du ins Zimmer gegangen bist. Solche Momente kennen alle. Mal sind sie selten, mal alltäglich, und dazwischen gibt es jede Abstufung. Genau so verstehen viele Forschende Aufmerksamkeit und Impulskontrolle: als Merkmale, die in der Bevölkerung fließend verteilt sind, nicht als Schalter mit Ja oder Nein.',
    'Eine Diagnose setzt trotzdem eine Linie. Sie liegt aber nicht bei einem Messwert, denn es gibt keinen Bluttest und keine Messung, die ADHS beweist. Die Linie ergibt sich aus Konvention und Beeinträchtigung: Wie viele Merkmale in welcher Stärke den Alltag spürbar behindern. Dass die Grenze mitgestaltet wird, ist bei vielen Diagnosen so, etwa bei Bluthochdruck.',
    'Daraus folgt zweierlei. Menschen knapp unter der Linie können Unterstützung brauchen, und Menschen knapp darüber sind nicht „ganz anders“. Wo die Grenze liegen sollte, ist eine der großen Streitfragen, der die Reise „Behandlung“ nachgeht.'
  ],
  facts: [
    'Für ADHS gibt es keinen Labortest und keine Messung, die allein eine Diagnose stellt.',
    'Die Diagnosegrenze beruht auf Merkmalszahl und Beeinträchtigung, nicht auf einem Messwert.',
    'Auch bei Bluthochdruck legen Fachgesellschaften die Grenze per Konvention fest.'
  ],
  quote: null,
  myth: null,
  cross: {},
  blog: [],
  further: [
    'American Psychiatric Association (2022). Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition, Text Revision (DSM-5-TR). APA Publishing.'
  ]
},

'beeintraechtigung': {
  id: 'beeintraechtigung',
  title: 'Anders reicht nicht: Wann Beeinträchtigung zählt',
  kind: 'konzept',
  journeys: ['verstehen'],
  icon: 'puzzle',
  teaser: 'Wer sich schlecht konzentrieren kann, hat noch kein ADHS. Entscheidend ist, was im Leben dadurch auf der Strecke bleibt.',
  text: [
    'Ein Vater erzählt, sein Sohn „vergisst ständig alles“. In der Schule läuft es gut, im Sportverein auch, nur zu Hause herrscht Chaos, seit die Eltern sich trennen. Fachleute würden hier nicht vorschnell an ADHS denken, sondern erst einmal fragen, was sich wann verändert hat. Genau dafür gibt es Kriterien.',
    'Nach dem DSM-5 genügen Symptome allein nicht. Mehrere müssen schon vor dem zwölften Lebensjahr bestanden haben, über mindestens sechs Monate, in zwei oder mehr Lebensbereichen wie Familie, Schule oder Arbeit. Sie müssen die Leistungsfähigkeit oder das Miteinander deutlich beeinträchtigen. Und sie dürfen nicht besser durch etwas anderes erklärt sein, etwa Angst, Depression, Schlafmangel oder eine Belastung.',
    'Diese Hürden sollen vor beiden Fehlern schützen: dass normale Schwankungen zur Krankheit erklärt werden, und dass echte Not übersehen wird. Welche anderen Erklärungen häufig mitspielen, zeigt die Station zu den Begleiterkrankungen.'
  ],
  facts: [
    'Das DSM-5 verlangt mehrere Merkmale vor dem 12. Lebensjahr; im DSM-IV galt noch das siebte.',
    'Die Beeinträchtigung muss in mindestens zwei Lebensbereichen auftreten, etwa zu Hause und in der Schule.',
    'Andere Erklärungen müssen geprüft sein; die Merkmale dürfen nicht besser durch eine andere Störung erklärt werden.'
  ],
  quote: null,
  myth: null,
  cross: {},
  blog: [],
  further: [
    'American Psychiatric Association (2022). Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition, Text Revision (DSM-5-TR). APA Publishing.'
  ]
},

'haeufigkeit': {
  id: 'haeufigkeit',
  title: 'Wie viele Menschen sind betroffen?',
  kind: 'konzept',
  journeys: ['verstehen'],
  icon: 'group',
  teaser: 'Von etwa 5 von 100 Kindern ist die Rede. Hinter der Zahl steckt, wie unterschiedlich Studien zählen.',
  text: [
    'Stell dir eine Schulklasse mit 25 Kindern vor. Rechnerisch hätten ein bis zwei von ihnen ADHS, wenn man den weltweiten Durchschnitt nimmt. Dieser stammt aus einer Auswertung von Polanczyk und Kollegen, die 2007 über 100 Studien zu Kindern und Jugendlichen zusammenfasste und auf etwa 5,3 Prozent kam.',
    'Bei Erwachsenen unterscheidet eine Meta-Analyse von Song und Kollegen (2021) zwei Zahlen: etwa 2,6 Prozent mit ADHS, das schon in der Kindheit begann, und etwa 6,8 Prozent mit heutigen Symptomen über der Schwelle. Zwischen den Zahlen liegen Welten, weil es auf die Definition ankommt.',
    'Studien zählen sehr unterschiedlich: nach Fragebogen oder Interview, mit oder ohne Beeinträchtigung, nach den Eltern oder der Lehrkraft. Die Autoren der Auswertung von 2014 fanden, dass solche Unterschiede der Methode die Spanne der Zahlen fast ganz erklären, nicht Länder oder Jahre. Was das für den Streit um die Diagnosehäufigkeit heißt, folgt in der Reise „Behandlung“.'
  ],
  facts: [
    'Weltweit etwa 5,3 Prozent der Kinder und Jugendlichen (Polanczyk u. a. 2007, über 100 Studien).',
    'Erwachsene: etwa 2,6 Prozent mit seit der Kindheit bestehendem ADHS, etwa 6,8 Prozent mit Symptomen (Song u. a. 2021).',
    'Die Spanne der Schätzungen hängt stark von der Methode ab, nicht von Weltregion oder Studienjahr.'
  ],
  quote: null,
  myth: null,
  cross: {},
  blog: [],
  further: [
    'Polanczyk, G. u. a. (2007). The worldwide prevalence of ADHD: a systematic review and metaregression analysis. American Journal of Psychiatry 164.',
    'Song, P. u. a. (2021). The prevalence of adult attention-deficit hyperactivity disorder: a global systematic review and meta-analysis. Journal of Global Health 11.'
  ]
},

'verlauf-reifung': {
  id: 'verlauf-reifung',
  title: 'Wächst es sich raus? Verlauf und Reifung',
  kind: 'konzept',
  journeys: ['verstehen', 'gehirn'],
  icon: 'path',
  teaser: 'Mit dem Alter ändert sich viel, aber selten alles. Warum die Antwort auf „raus gewachsen?“ davon abhängt, was man misst.',
  text: [
    'Der Junge, der mit acht nicht stillsitzen konnte, sitzt mit sechzehn ruhig im Unterricht. Heißt das, dass es vorbei ist? Eine Meta-Analyse von Faraone, Biederman und Mick (2006) zeigte, dass die Antwort an der Definition hängt: Erfüllen mit 25 noch etwa 15 Prozent die vollen Kriterien, so haben bei etwa 65 Prozent noch Beschwerden bestanden, wenn Teilremission mitzählt.',
    'Meist lässt die Hyperaktivität nach, Unaufmerksamkeit und Organisationsprobleme bleiben häufiger. Die große MTA-Studie fand 2022 bei Sibley und Kollegen, dass Beschwerden oft zeitweise verschwinden und wiederkehren: Nur etwa 9 Prozent hatten bis zum Alter von rund 25 Jahren eine dauerhafte Remission, rund 90 Prozent hatten weiter Restsymptome.',
    'Eine Erklärung für Teile des Verlaufs liefert die Hirnreifung. Shaw und Kollegen fanden 2007, dass die Hirnrinde bei Kindern mit ADHS im Mittel etwa drei Jahre später ihre maximale Dicke erreicht, besonders im Stirnhirn. Das ist eine Deutung, kein Beweis. Und ein anderer Verlauf heißt nicht, dass nichts zu tun wäre.'
  ],
  facts: [
    'Vollständige Kriterien erfüllen mit 25 etwa 15 Prozent, mit Teilremission etwa 65 Prozent (Faraone u. a. 2006).',
    'In der MTA-Studie hatten nur 9,1 Prozent bis etwa 25 dauerhaft keine Symptome (Sibley u. a. 2022).',
    'Die Hirnrinde erreicht ihre maximale Dicke im Mittel mit 10,5 statt 7,5 Jahren (Shaw u. a. 2007).'
  ],
  quote: null,
  myth: null,
  cross: {
    gehirn: 'Hier zeigt die Bildgebung, wo die verzögerte Reifung der Hirnrinde sitzt und wie weit sie den Verlauf erklären kann.'
  },
  blog: [],
  further: [
    'Faraone, S. V., Biederman, J. und Mick, E. (2006). The age-dependent decline of ADHD: a meta-analysis of follow-up studies. Psychological Medicine 36.',
    'Sibley, M. H. u. a. (2022). Variable patterns of remission from ADHD in the Multimodal Treatment Study of ADHD. American Journal of Psychiatry 179.'
  ]
},

'begleiter': {
  id: 'begleiter',
  title: 'Selten allein: Begleiterkrankungen',
  kind: 'konzept',
  journeys: ['verstehen'],
  icon: 'link',
  teaser: 'Oft kommt zu ADHS noch etwas dazu: Angst, Lernprobleme, schlechter Schlaf. Das macht die Abklärung heikel.',
  text: [
    'Mia ist zwölf, kommt morgens kaum aus dem Bett und fürchtet sich vor Klassenarbeiten. In der Abklärung zeigt sich: Sie hat Aufmerksamkeitsprobleme, aber auch eine Angststörung und eine Lese-Rechtschreib-Schwäche. Das ist keine Ausnahme, sondern eher die Regel.',
    'Studien finden bei Kindern mit ADHS gehäuft weitere Störungen: Lernstörungen, Angst, Depression, Autismus-Spektrum-Störung, Tic-Störungen, Störungen des Sozialverhaltens und Schlafprobleme. Einer US-Auswertung (Danielson u. a. 2018) zufolge hatte etwa ein Drittel der Kinder mit ADHS keine weitere Diagnose, die übrigen mindestens eine. Genaue Anteile hängen stark davon ab, wo und wie gezählt wird.',
    'Das hat zwei Folgen. Zum einen muss eine Abklärung gründlich sein, denn dieselben Beschwerden können andere Ursachen haben oder zusätzlich da sein. Zum anderen ist Behandlung nicht nur „gegen ADHS“: Wer auch unter Angst oder Schlafmangel leidet, braucht dafür eigene Hilfe.'
  ],
  facts: [
    'Häufige Begleiter sind Lernstörungen, Angst, Depression, Autismus-Spektrum-Störung, Tics und Schlafprobleme.',
    'In einer US-Auswertung hatten etwa zwei Drittel der Kinder mit ADHS mindestens eine weitere Diagnose.',
    'Die Anteile schwanken je nach Land, Stichprobe und Erhebung stark.'
  ],
  quote: null,
  myth: null,
  cross: {},
  blog: [],
  further: [
    'Danielson, M. L. u. a. (2018). Prevalence of parent-reported ADHD diagnosis and associated treatment among U.S. children and adolescents, 2016. Journal of Clinical Child & Adolescent Psychology 47.'
  ]
},

'mythos-zucker': {
  id: 'mythos-zucker',
  title: 'Mythos: Zucker macht Kinder hyperaktiv',
  kind: 'mythos',
  journeys: ['verstehen'],
  icon: 'flask',
  teaser: 'Nach der Geburtstagsfeier rasen die Kinder. Doch in Versuchen mit Placebo ändert Zucker ihr Verhalten kaum.',
  text: [
    'Geburtstagsfeier, Kuchen, Limonade. Eine Stunde später toben die Kinder durchs Haus, und jeder weiß, woran es liegt. Man hat diese Annahme oft in Studien geprüft, in denen weder Kinder noch Eltern wussten, ob Zucker oder ein Süßstoff gegeben wurde.',
    'Eine Meta-Analyse von Wolraich, Wilson und White (1995) fasste 23 solcher Versuche zusammen und fand keinen Einfluss von Zucker auf Verhalten oder Denkleistung der Kinder. Ein kleiner Effekt bei einzelnen Kindern lässt sich nicht ganz ausschließen.',
    'Interessant ist die Erwartung. In einer Studie von Hoover und Milich (1994) bekamen alle Jungen einen Süßstoff, doch einem Teil der Mütter sagte man, ihr Sohn habe viel Zucker gehabt. Diese Mütter hielten die Jungen für hyperaktiver, hielten sie körperlich enger und neigten zu mehr Kritik. Wer ein Kind für aufgedreht hält, sieht es so.'
  ],
  facts: [
    'Wolraich u. a. (1995) fassten 23 placebokontrollierte Versuche zusammen und fanden keinen Effekt auf Verhalten oder Denken.',
    'In der Studie von Hoover und Milich (1994) bekamen alle 35 Jungen Aspartam, nicht Zucker.',
    'Mütter, denen „Zucker“ genannt wurde, bewerteten ihre Söhne als hyperaktiver.'
  ],
  quote: null,
  myth: {
    glaube: 'Zucker macht Kinder aufgedreht und kann ADHS auslösen oder verschlimmern.',
    wahrheit: 'In placebokontrollierten Versuchen verändert Zucker das Verhalten von Kindern nicht messbar; die Erwartung der Erwachsenen verändert dagegen, was sie wahrnehmen.'
  },
  cross: {},
  blog: [],
  further: [
    'Wolraich, M. L., Wilson, D. B. und White, J. W. (1995). The effect of sugar on behavior or cognition in children: a meta-analysis. JAMA 274.',
    'Hoover, D. W. und Milich, R. (1994). Effects of sugar ingestion expectancies on mother-child interactions. Journal of Abnormal Child Psychology 22.'
  ]
},

'mythos-erziehung': {
  id: 'mythos-erziehung',
  title: 'Mythos: Schlechte Erziehung und Faulheit',
  kind: 'mythos',
  journeys: ['verstehen'],
  icon: 'family',
  teaser: 'Ein Kind, das nicht hört, und Eltern, die sich Blicke gefallen lassen müssen. Warum Schuld hier die falsche Frage ist.',
  text: [
    'Im Supermarkt wirft sich ein Kind auf den Boden. Die Blicke gehen nicht zum Kind, sondern zu den Eltern. Wer ein Kind mit ADHS erzieht, kennt dieses Urteil: zu nachgiebig, zu chaotisch, zu wenig Grenzen. Und die Kinder und Erwachsenen selbst hören: „Du musst dich nur zusammenreißen.“',
    'Nach heutigem Stand ist das nicht die Ursache. Zwillingsstudien schätzen die Erblichkeit im Mittel auf rund 74 Prozent (Faraone und Larsson 2019). Die Zahl beschreibt Gruppen und sagt nichts über den Einzelfall, zeigt aber, dass Gene eine große Rolle spielen. Erziehung ist nicht bedeutungslos: Sie beeinflusst, wie Kinder mit ihren Schwierigkeiten zurechtkommen, und Elterntrainings können Verhalten verbessern.',
    'Eltern verursachen ADHS also nicht, und sie sind der wichtigste Teil der Hilfe. Das Bild vom „Faulen“ ist ebenso schief. Wer sich über Jahre anstrengt und trotzdem scheitert, ist nicht faul. Er hat Schwierigkeiten mit Steuerung, die Willen allein nicht behebt.'
  ],
  facts: [
    'Die Erblichkeit von ADHS liegt in Zwillingsstudien im Mittel bei etwa 74 Prozent (Faraone und Larsson 2019).',
    'Erblichkeit beschreibt Unterschiede in Gruppen und sagt nichts über einen einzelnen Menschen aus.',
    'Elterntrainings gehören in Leitlinien zu den Behandlungsbausteinen bei Kindern.'
  ],
  quote: null,
  myth: {
    glaube: 'ADHS entsteht durch schlechte Erziehung; wer Probleme hat, ist faul oder undiszipliniert.',
    wahrheit: 'Nach heutigem Stand verursacht Erziehung ADHS nicht; Gene tragen viel bei. Erziehung kann den Verlauf aber beeinflussen, und Elterntrainings helfen.'
  },
  cross: {},
  blog: [],
  further: [
    'Faraone, S. V. und Larsson, H. (2019). Genetics of attention deficit hyperactivity disorder. Molecular Psychiatry 24.'
  ]
},

'mythos-modediagnose': {
  id: 'mythos-modediagnose',
  title: 'Mythos: ADHS ist eine Modediagnose von heute',
  kind: 'mythos',
  journeys: ['verstehen'],
  icon: 'exclamation',
  teaser: 'Mehr Diagnosen heißt nicht automatisch mehr Betroffene. Und doch ist auch die Sorge vor Überdiagnose nicht aus der Luft gegriffen.',
  text: [
    'Ein Satz fällt in vielen Elternabenden und Talkshows: „Früher gab es das nicht.“ Das stimmt so nicht. Schon 1902 beschrieb der britische Kinderarzt George Frederic Still in Vorlesungen Kinder mit mangelnder Selbstkontrolle, die man in der Schule schwer lenken konnte. Der Name war ein anderer, das Bild erkennbar.',
    'Auch die Zahlen sind weniger eindeutig, als es scheint. Die Auswertung von Polanczyk und Kollegen (2014) fand über drei Jahrzehnte keinen Anstieg der Kinder, die bei einheitlichen Kriterien die Diagnose erfüllen. Gleichzeitig stiegen Diagnosen: In den USA nach Xu und Kollegen (2018) von 6,1 Prozent (1997/98) auf 10,2 Prozent (2015/16). Besser erkannt, anders gezählt, leichter zugänglich: Das alles kann mitspielen.',
    'Die Sorge vor Überdiagnose ist trotzdem real. Studien aus mehreren Ländern zeigen, dass die jüngsten Kinder einer Klasse häufiger diagnostiziert werden, was für Fehleinschätzungen spricht. Beides stimmt: Das Phänomen ist alt, und nicht jede Diagnose trifft. Die Reise „Behandlung“ zeigt, wie der Streit geführt wird.'
  ],
  facts: [
    'George Frederic Still beschrieb 1902 Kinder mit mangelnder Selbstkontrolle in Vorlesungen, die in der Zeitschrift The Lancet erschienen.',
    'Bei einheitlichen Kriterien fanden Polanczyk u. a. (2014) keinen Anstieg über drei Jahrzehnte.',
    'Gemeldete Diagnosen stiegen in den USA von 6,1 auf 10,2 Prozent (Xu u. a. 2018).'
  ],
  quote: null,
  myth: {
    glaube: 'ADHS ist eine Erfindung unserer Zeit und wird heute viel zu oft diagnostiziert.',
    wahrheit: 'Ähnliche Muster sind seit über 100 Jahren beschrieben, die Häufigkeit bei gleichen Kriterien stieg kaum. Diagnosen nahmen aber zu, und Überdiagnose im Einzelfall wird ernsthaft diskutiert.'
  },
  cross: {},
  blog: [],
  further: [
    'Polanczyk, G. V. u. a. (2014). ADHD prevalence estimates across three decades: an updated systematic review and meta-regression analysis. International Journal of Epidemiology 43.',
    'Xu, G. u. a. (2018). Twenty-year trends in diagnosed ADHD among US children and adolescents, 1997–2016. JAMA Network Open 1.'
  ]
},

'mythos-nur-kinder': {
  id: 'mythos-nur-kinder',
  title: 'Mythos: ADHS gibt es nur bei Kindern',
  kind: 'mythos',
  journeys: ['verstehen'],
  icon: 'elder',
  teaser: 'Mit vierzig die Diagnose, nach Jahren des Sich-nicht-Verstehens: Das passiert öfter, als man denkt.',
  text: [
    'Eine Frau von 38 sitzt in der Sprechstunde. Ihr Sohn wurde gerade abgeklärt, und beim Lesen der Fragen denkt sie: Das bin ja ich. Sie hat Studium, Job und Kinder organisiert, aber um den Preis von ständiger Erschöpfung. Dass sie als Kind „nur verträumt“ galt, hat damals niemand eingeordnet.',
    'ADHS endet nicht automatisch mit dem Schulabschluss. Eine Meta-Analyse von Song und Kollegen (2021) schätzt, dass etwa 2,6 Prozent der Erwachsenen weltweit ein ADHS haben, das schon in der Kindheit begann. Eine europäische Konsensgruppe (Kooij u. a. 2019) hat Leitlinien für die Diagnose bei Erwachsenen vorgelegt. Das Bild ändert sich: Die Unruhe wird oft innerlicher, Probleme mit Organisation und Aufmerksamkeit bleiben.',
    'Ganz geklärt ist es nicht. Studien aus Neuseeland und Großbritannien fanden, dass viele Erwachsene mit ADHS-Symptomen als Kinder keine Auffälligkeiten hatten, was die Frage aufwirft, ob es immer in der Kindheit beginnt. Das Thema bleibt Gegenstand der Forschung.'
  ],
  facts: [
    'Etwa 2,6 Prozent der Erwachsenen weltweit haben ein seit der Kindheit bestehendes ADHS (Song u. a. 2021).',
    'Europäischer Konsens zu Diagnose und Behandlung bei Erwachsenen: Kooij u. a. (2019).',
    'Ob ADHS immer in der Kindheit beginnt, wird in Kohortenstudien diskutiert.'
  ],
  quote: null,
  myth: {
    glaube: 'ADHS ist eine Kinderkrankheit, die mit der Pubertät verschwindet.',
    wahrheit: 'Bei einem erheblichen Teil bleiben Beschwerden bis ins Erwachsenenalter bestehen; Erwachsene werden oft spät erkannt. Ob es auch erstmals im Erwachsenenalter beginnen kann, ist umstritten.'
  },
  cross: {},
  blog: [],
  further: [
    'Kooij, J. J. S. u. a. (2019). Updated European Consensus Statement on diagnosis and treatment of adult ADHD. European Psychiatry 56.',
    'Moffitt, T. E. u. a. (2015). Is adult ADHD a childhood-onset neurodevelopmental disorder? American Journal of Psychiatry 172.'
  ]
},

'konsens-2021': {
  id: 'konsens-2021',
  title: '208 Aussagen: Der internationale Konsens',
  kind: 'ereignis',
  journeys: ['verstehen', 'geschichte'],
  year: 2021, yearLabel: '2021',
  icon: 'checklist',
  teaser: 'Ein Papier, das aufschreibt, was die Forschung zu ADHS nach hohen Maßstäben als gesichert ansieht.',
  text: [
    'Irgendwann reichte es einer Gruppe von Forschenden: Zu ADHS kursierten so viele Behauptungen, dass Betroffene und Fachleute kaum noch wussten, was belegt war. 2021 veröffentlichte die World Federation of ADHD, geleitet von Stephen Faraone, ein Konsensdokument mit 208 Aussagen zu Wesen, Verlauf, Ursachen und Behandlung. Das Ziel war ausdrücklich, Fehlvorstellungen zu korrigieren, die Betroffene stigmatisieren.',
    'Die Hürde war hoch. Eingehen durften nur große Studien mit mehr als 2000 Teilnehmenden oder Meta-Analysen und Untersuchungen, die Veröffentlichungsverzerrung geprüft hatten. 80 Autorinnen und Autoren aus 27 Ländern stimmten den Aussagen zu, später schlossen sich mehrere hundert weitere an.',
    'Das Papier ist eine gute Landkarte, aber kein Gesetz. Es gibt den Stand der ausgewählten Studien wieder, und die Größenregel lässt kleinere, neuere Befunde draußen. Auch ein Konsens bildet Meinungen von Fachleuten ab. In dieser Reise ist es der Maßstab für die Frage: Was ist gesichert, was nicht?'
  ],
  facts: [
    'Faraone u. a. (2021): 208 empirisch gestützte Aussagen, erschienen in Neuroscience & Biobehavioral Reviews 128.',
    'Zustimmung von 80 Autorinnen und Autoren aus 27 Ländern auf 6 Kontinenten.',
    'Aufnahme nur bei Studien mit über 2000 Teilnehmenden oder Meta-Analysen mit Prüfung auf Publikationsverzerrung.'
  ],
  quote: null,
  myth: null,
  cross: {
    geschichte: 'Auf dem Zeitstrahl ist das Dokument der vorläufige Endpunkt einer langen Entwicklung: Nach über 200 Jahren wechselnder Namen wird der Wissensstand gebündelt.'
  },
  blog: [],
  further: [
    'Faraone, S. V. u. a. (2021). The World Federation of ADHD International Consensus Statement: 208 evidence-based conclusions about the disorder. Neuroscience & Biobehavioral Reviews 128.'
  ]
}

});
})();
