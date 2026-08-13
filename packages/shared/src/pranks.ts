// Registry of Yrud's "interrupt" gags. Adding a future prank is a new entry
// here (drives the admin button + overlay text/timing) — the client's
// PrankOverlay falls back to a generic jumpscare treatment for any id it
// doesn't have bespoke art for yet, so no new plumbing is required.
export interface PrankDefinition {
  id: string;
  label: string; // admin console button text
  announceTexts: string[]; // one is picked at random each time the prank fires
  durationMs: number;
}

export const PRANK_REGISTRY: PrankDefinition[] = [
  {
    id: "zeratchoupi",
    label: "Frayeur ZeraTchoupi",
    announceTexts: [
      "AHAH T’AS LE BIDE DE PIERRE MÉNÈS HUMOUR",
      ".....MAGICARPE !.....",
      "Et en fait Zeraora il.... 2 SEC ANNA JE PARLE",
      "Attends faut demander à remysse et Pata mdrr",
      "Qui gagne combat de Sumo Obelix vs Pierre Menès ? Match nul car ils sont tous les deux français mais en tout cas Zeraora doit bien les electrocuter la graisse c'est conducteur",
      "Ohhhh calmes toi tête d'enclume 🤣",
      "Suce un Schtroumpf !",
      "T’es mon fidèle destrier je suis Shrek et t’es l’âne !",
    ],
    // Some lines are full sentences, not a one-word shout — long enough to
    // actually read, though click-to-dismiss is always there too.
    durationMs: 3500,
  },
];

export function getPrankDefinition(id: string): PrankDefinition | undefined {
  return PRANK_REGISTRY.find((p) => p.id === id);
}

// Server-owned randomness (matches the rest of the app's "server picks,
// clients just render" rule) — picks the line everyone sees for one trigger.
export function pickPrankText(prank: PrankDefinition): string {
  return prank.announceTexts[Math.floor(Math.random() * prank.announceTexts.length)];
}
