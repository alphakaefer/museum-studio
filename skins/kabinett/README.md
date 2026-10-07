# Skin „kabinett“

Idee: Herbarium und Naturforscher-Kabinett. Papier (hell) bzw. Moosgrün-Nacht (dunkel), Tinte, Antiqua-Stack (IM Fell English als Wunschschrift, sonst Iowan/Palatino/Georgia),
Initiale, Etikett-Kästen („Tafel I, II …“ per CSS-Zähler), Doppellinien, leicht organische Rundungen (ungleiche Eckenradien), Zierzeichen (❦) per `::before/::after`.
Netzplan: `smooth` / `icons`.

Tokens: `--bg --bg-2 --bg-3 --ink --ink-2 --ink-3 --line --accent --link --warm --on-accent --on-warm --accent-soft --glass --hero-bg --font-display --font-ui --radius* --shadow*`.
Journey-Farben (`--j-*`) bleiben unverändert.

Grenzen: Zeitstrahl, Karte, Pass und Suche bekommen nur Token-Wirkung plus wenige Rundungen (deren Styles kommen aus den Ansichts-Modulen).
Der Reisepass-Deckel bleibt (wie in der Engine) eine dunkle Fläche (`.gm-dark`), hier in Moosgrün. IM Fell English ist nicht eingebettet; ohne Installation greift Palatino/Georgia.
Die Hero-Fläche zeichnet kein Sternfeld (Canvas ausgeblendet).
