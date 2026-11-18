/* Einstellungen der Landingpage – hier ohne Programmierkenntnisse anpassbar. */
window.HB_CONFIG = {
  /* Bedienung der Geschichte:
     "szenen" – jede Scroll-/Wischbewegung startet eine vollständige Szene (Standard)
     "film"   – Szenen 1–3 laufen beim ersten Besuch automatisch ab   (Vergleich: index.html?modus=film)
     "scroll" – alle Szenen direkt an die Scrollposition gekoppelt     (Vergleich: index.html?modus=scroll) */
  introMode: "szenen",

  /* E-Mail-Adresse für das Kontaktformular (öffnet das E-Mail-Programm des Besuchers).
     Leer lassen, solange keine Adresse feststeht. */
  contactEmail: "",

  /* Szene 1 – Ebenen-Modus:
     Sobald eine leere Altstadtstraße (ohne Kutsche) vorliegt, hier den Pfad eintragen,
     z. B. "assets/img/s1-strasse-leer.webp". Dann fährt die freigestellte Kutsche mit
     drehenden Rädern durch die Straße. Solange der Wert leer ist, erzählt die Szene mit
     Kamerafahrt und Überblendung. Zum Testen: index.html?ebenen=test */
  streetPlate: "assets/img/s1-strasse-leer.webp",
  /* Seitenverhältnis des Straßenbildes (Breite / Höhe) – Panorama wird mitgeschwenkt */
  streetRatio: 2300 / 666,

  /* Position der Fahrbahn im Straßenbild (Prozent von oben) und Endposition der Kutsche
     (Prozent von links), nur für den Ebenen-Modus. */
  streetLevel: 97,
  coachStop: 44,
  /* Breite der Kutsche in Prozent der Bildbreite (Ebenen-Modus) */
  coachWidth: 52,
  /* … im Hochformat (Smartphone) */
  coachWidthPortrait: 22,

  /* Galopp-Prototyp: Bildfolge der Pferde (8 Einzelbilder nebeneinander). Leer = ruhende Pferde der Kutsche. */
  horseSprite: "assets/img/c-galopp-sprite.webp",
  horseFrames: 8,

  /* Szene 2: geschlossener Umschlag, der sich beim Siegel öffnet. Leer = sofort offener Umschlag. */
  closedEnvelope: "assets/img/c-umschlag-zu.webp"
};
