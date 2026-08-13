import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BANK_NAME = "Placeholder Mix (all themes)";

// Placeholder content — swap for Rudy's real questions via the admin tools
// later. UI/instructions are in French for the RPPLF community; Pokémon
// species and move names stay in English (matches Showdown and how this
// competitive community actually talks), while types/stats/generic game
// vocabulary are translated.
const TRIVIA_QUESTIONS = [
  {
    prompt: "Quel type inflige des dégâts super efficaces aux Pokémon de type Dragon ?",
    choices: ["Feu", "Fée", "Combat", "Sol"],
    correctIndex: 1,
  },
  {
    prompt: "Quel est le numéro Pokédex officiel de Pikachu ?",
    choices: ["#001", "#025", "#133", "#150"],
    correctIndex: 1,
  },
  {
    prompt: "Quelle statistique détermine si un Pokémon attaque en premier ?",
    choices: ["Attaque", "Défense", "Vitesse", "Attaque Spéciale"],
    correctIndex: 2,
  },
  {
    prompt: "Hydro Pump, l'attaque de Yrud, est de quel type ?",
    choices: ["Eau", "Glace", "Électrik", "Dragon"],
    correctIndex: 0,
  },
  {
    prompt: "Quelle pierre évolutive transforme Eevee en Vaporeon ?",
    choices: ["Pierre Foudre", "Pierre Feu", "Pierre Eau", "Pierre Plante"],
    correctIndex: 2,
  },
  {
    prompt: "Combien de Pokémon compte une équipe standard en combat simple sur Showdown ?",
    choices: ["3", "4", "6", "8"],
    correctIndex: 2,
  },
  {
    prompt: "Quelle météo augmente la puissance des attaques de type Feu ?",
    choices: ["Pluie", "Tempête de sable", "Soleil", "Grêle"],
    correctIndex: 2,
  },
  {
    prompt: "Quel statut inflige l'attaque Toxic ?",
    choices: ["Poison", "Poison Grave", "Brûlure", "Paralysie"],
    correctIndex: 1,
  },
];

// Simple note names -> frequencies (Hz) for building short synthesized motifs.
const NOTE = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
};

function motif(freqs: number[], durationMs = 220) {
  return freqs.map((freq) => ({ freq, durationMs }));
}

// "Guess the OST" — real audio clips come later via Question.mediaUrl; for now
// each question gets a short synthesized motif (Web Audio) so the round is
// fully playable without licensed audio assets.
const OST_QUESTIONS = [
  {
    prompt: "Devine l'ambiance : quel est ce morceau ?",
    choices: ["Thème de route", "Combat d'Arène", "Fanfare de victoire", "Centre Pokémon"],
    correctIndex: 0,
    notes: motif([NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5]),
  },
  {
    prompt: "À quelle scène appartient cette mélodie ?",
    choices: ["Combat de rival", "Rencontre sauvage", "Combat d'Arène", "Conseil des 4"],
    correctIndex: 2,
    notes: motif([NOTE.A4, NOTE.A4, NOTE.C5, NOTE.B4, NOTE.A4], 160),
  },
  {
    prompt: "Ce petit air triomphant joue après...",
    choices: ["Avoir capturé un Pokémon", "Avoir gagné un combat", "Être entré dans une ville", "Être monté de niveau"],
    correctIndex: 1,
    notes: motif([NOTE.C5, NOTE.G4, NOTE.E5, NOTE.G5], 180),
  },
  {
    prompt: "Calme et douillet — où entendrait-on ça ?",
    choices: ["Centre Pokémon", "Grotte", "Repaire de la Team Rocket", "Zone Safari"],
    correctIndex: 0,
    notes: motif([NOTE.E4, NOTE.G4, NOTE.C5, NOTE.G4], 260),
  },
  {
    prompt: "Tendu et en boucle — c'est probablement...",
    choices: ["Thème de Surf", "Rencontre légendaire", "Thème du vélo", "Centre Pokémon"],
    correctIndex: 1,
    notes: motif([NOTE.D4, NOTE.F4, NOTE.A4, NOTE.D4, NOTE.F4], 150),
  },
];

// "Which Pokémon has the higher stat" — real, well-known base stat gaps.
const STATS_QUESTIONS = [
  { pokemonA: "Jolteon", pokemonB: "Snorlax", stat: "Vitesse", correctIndex: 0 },
  { pokemonA: "Chansey", pokemonB: "Machamp", stat: "Attaque", correctIndex: 1 },
  { pokemonA: "Steelix", pokemonB: "Pikachu", stat: "Défense", correctIndex: 0 },
  { pokemonA: "Diglett", pokemonB: "Blissey", stat: "PV", correctIndex: 1 },
  { pokemonA: "Alakazam", pokemonB: "Geodude", stat: "Attaque Spéciale", correctIndex: 0 },
  { pokemonA: "Ferrothorn", pokemonB: "Deoxys (Forme Vitesse)", stat: "Défense Spéciale", correctIndex: 0 },
];

// Quick-fire questions for the 60-second speed round — short prompts, fast reads.
const SPEED_QUESTIONS = [
  { prompt: "Le Feu est efficace contre ?", choices: ["Plante", "Eau", "Roche"], correctIndex: 0 },
  { prompt: "L'Eau est efficace contre ?", choices: ["Plante", "Feu", "Électrik"], correctIndex: 1 },
  { prompt: "L'Électrik est faible contre ?", choices: ["Sol", "Vol", "Feu"], correctIndex: 0 },
  { prompt: "Type de départ : Charmander ?", choices: ["Plante", "Feu", "Eau"], correctIndex: 1 },
  { prompt: "Type de départ : Squirtle ?", choices: ["Eau", "Plante", "Feu"], correctIndex: 0 },
  { prompt: "Type de Pikachu ?", choices: ["Normal", "Électrik", "Psy"], correctIndex: 1 },
  { prompt: "Le Spectre est immunisé contre ?", choices: ["Normal", "Fée", "Ténèbres"], correctIndex: 0 },
  { prompt: "Couleur de la barre de PV pleine ?", choices: ["Rouge", "Jaune", "Vert"], correctIndex: 2 },
  { prompt: "Taille maximale d'une équipe ?", choices: ["4", "6", "8"], correctIndex: 1 },
  { prompt: "L'Acier résiste à ?", choices: ["Feu", "Normal", "Combat"], correctIndex: 1 },
  { prompt: "Le Dragon est faible contre ?", choices: ["Fée", "Eau", "Plante"], correctIndex: 0 },
  { prompt: "Le Psy est faible contre ?", choices: ["Insecte", "Combat", "Roche"], correctIndex: 0 },
  { prompt: "La Glace est efficace contre ?", choices: ["Feu", "Dragon", "Acier"], correctIndex: 1 },
  { prompt: "Le Poison est efficace contre ?", choices: ["Fée", "Spectre", "Acier"], correctIndex: 0 },
  { prompt: "La Roche résiste à ?", choices: ["Feu", "Eau", "Plante"], correctIndex: 0 },
];

async function main() {
  const existing = await prisma.questionBank.findFirst({ where: { name: BANK_NAME } });
  if (existing) {
    console.log(`"${BANK_NAME}" already seeded, skipping.`);
    return;
  }

  const questions = [
    ...TRIVIA_QUESTIONS.map((q) => ({
      theme: "trivia" as const,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex,
    })),
    ...OST_QUESTIONS.map((q) => ({
      theme: "ost" as const,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex,
      metadata: { notes: q.notes },
    })),
    ...STATS_QUESTIONS.map((q) => ({
      theme: "stats" as const,
      prompt: `Quel Pokémon a la meilleure statistique de ${q.stat} ?`,
      choices: [q.pokemonA, q.pokemonB],
      correctIndex: q.correctIndex,
      metadata: { stat: q.stat },
    })),
    ...SPEED_QUESTIONS.map((q) => ({
      theme: "speed" as const,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex,
    })),
  ].map((q, i) => ({ ...q, order: i }));

  await prisma.questionBank.create({
    data: {
      name: BANK_NAME,
      questions: { create: questions },
    },
  });

  console.log(`Seeded ${questions.length} placeholder questions across trivia/ost/stats/speed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
