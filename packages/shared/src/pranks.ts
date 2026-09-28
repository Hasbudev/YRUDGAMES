// Registry of Yrud's "interrupt" gags. Adding a future prank is a new entry
// here (drives the admin button + overlay text/timing) — the client's
// PrankOverlay falls back to a generic jumpscare treatment for any id it
// doesn't have bespoke art for yet, so no new plumbing is required.
export interface PrankDefinition {
  id: string;
  label: string; // admin console button text
  announceTexts: string[]; // one is picked at random each time the prank fires
  // How long the prank takes over the screen — for a video prank, its
  // running time (the server also extends the live question's clock by this).
  durationMs: number;
  // A video under apps/web/public played full-screen instead of the sprite
  // jumpscare (e.g. "/pranks/tchoupu.mp4"). Its own audio is the sting, and
  // it carries no caption, so announceTexts is empty for these.
  videoUrl?: string;
  // An image that pops up over the game, with an audio clip playing under it
  // (both under apps/web/public). The prank closes itself when the audio
  // ends; like videoUrl ones it carries no caption, and durationMs should be
  // the clip's running time.
  imageUrl?: string;
  audioUrl?: string;
  // Small pixel-art sprite blown up to fill the screen (not a photo).
  bigSprite?: boolean;
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
  {
    id: "tchoupu",
    label: "Vidéo Tchoupu",
    announceTexts: [],
    // 6.7 s clip, plus a hair of margin so the server's timer extension
    // never ends up shorter than what players actually sit through.
    durationMs: 6800,
    videoUrl: "/pranks/tchoupu.mp4",
  },
  {
    id: "zeratchoupi-vocal",
    label: "Image + vocal ZeraTchoupi",
    announceTexts: [],
    // 14.7 s voice message, plus a hair of margin (same reasoning as above).
    durationMs: 14800,
    imageUrl: "/pranks/zeratchoupi-vocal.png",
    audioUrl: "/pranks/zeratchoupi-vocal.ogg",
  },
  {
    id: "tchoupi-geant",
    label: "Tchoupi géant + son",
    announceTexts: [],
    // 8 s sound, plus margin.
    durationMs: 8100,
    imageUrl: "/sprites/zeratchoupi.png",
    audioUrl: "/pranks/tchoupi-geant.ogg",
    bigSprite: true,
  },
  {
    id: "clip-twitch",
    label: "Clip Twitch (60 s)",
    announceTexts: [],
    // 60 s clip, plus margin. Everyone can click it away early.
    durationMs: 60100,
    videoUrl: "/pranks/clip-twitch.mp4",
  },
];

export function getPrankDefinition(id: string): PrankDefinition | undefined {
  return PRANK_REGISTRY.find((p) => p.id === id);
}

// Server-owned randomness (matches the rest of the app's "server picks,
// clients just render" rule) — picks the line everyone sees for one trigger.
export function pickPrankText(prank: PrankDefinition): string {
  if (prank.announceTexts.length === 0) return "";
  return prank.announceTexts[Math.floor(Math.random() * prank.announceTexts.length)];
}
