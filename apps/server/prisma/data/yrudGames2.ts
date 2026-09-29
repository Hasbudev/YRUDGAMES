// Yrud Games 2 — the six manches, as laid out in the organisers' rules doc:
//   1 Quizz mécaniques — each clan picks a category (6 pts on its own, 3 on others)
//   2 Stat slider      — stop the cursor on the stat's max (6 / 3 / 1 pts)
//   3 Vrai ou Faux     — plus 3 hot-potato bombs (−20 for the clan holding one)
//   4 Le Navidex       — free text; each question's fastest finder steals 5 pts
//   5 Blind Test       — per-question points from the doc
//   6 Chasse-Taupes
// They replace manches 1 to 6 of a bank with prisma/replaceRounds.ts.
import type { QuestionMetadata } from "@yrud/shared";
//
// `verify` marks a question whose answer key isn't certain: the replace
// script lists them and refuses to write until each `verify` is resolved
// (fix correctIndex if needed, then delete the field) or --allow-unverified
// is passed. Nothing else in here needs a second look.

export interface NewQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
  // Overrides the manche's points for this one question.
  points?: number;
  // Image shown with the question — a /public path.
  mediaUrl?: string;
  // Blind test clip, a filename under apps/web/public/blindtest.
  audioFile?: string;
  // Free-text question: players type the answer instead of picking one;
  // `choices` then holds only the answer shown at reveal.
  acceptedAnswers?: string[];
  // Chasse-taupes: how long the game lasts.
  whackDurationMs?: number;
  // Anything else stored as-is in Question.metadata (category, slider, bomb...).
  meta?: QuestionMetadata;
  verify?: string;
}

// Points not set by the rules doc are a flat +1, no penalty, no combo. Every
// manche sets `ownScoring` so nothing is inherited from the Yrud Games 1 bank.
export interface RoundScoring {
  points: number;
  wrongPoints: number;
  blankPoints?: number;
  comboThreshold?: number;
  comboBonus?: number;
  // Seconds to answer; omitted = the server default (20 s).
  timeLimitSec?: number;
}

export interface NewRound {
  roundIndex: number;
  roundLabel: string;
  theme?: "trivia" | "ost" | "whack" | "slider";
  scoring: RoundScoring;
  // Use `scoring` even if the bank already has this manche, instead of
  // inheriting the old manche's scoring.
  ownScoring?: boolean;
  questions: NewQuestion[];
}

const FLAT: RoundScoring = { points: 1, wrongPoints: 0 };

// --- Manche 1 : Quizz mécaniques -------------------------------------------

// Three groups of five; the clans pick one each (last clan in the standings
// first). A right answer is worth 6 in your clan's category, 3 elsewhere.
const CATEGORIES = ["Force Z", "Dynamax / Gigamax", "1G"];
const CATEGORY_POINTS = { own: 6, other: 3 };

const MECHANICS: NewQuestion[] = [
  // Force Z
  {
    prompt: "Quel est l'effet de Parting Shot Z ?",
    choices: [
      "Baisse de 3 crans les stats du Pokémon adverse au lieu d'une",
      "Baisse de 2 crans les stats du Pokémon adverse au lieu d'une",
      "Soigne les altérations de statut du Pokémon qui va remplacer le lanceur sur le terrain",
      "Soigne tous les PV du Pokémon qui va remplacer le lanceur sur le terrain",
    ],
    correctIndex: 3, // Showdown: partingshot.zMove = healreplacement
  },
  {
    prompt: "En règle générale, à quelle puissance s'élèvera une capacité Z basée sur un move à 110 de puissance ?",
    choices: ["170", "175", "180", "185"],
    correctIndex: 3, // Z-move power table: 110 -> 185
  },
  {
    prompt: "Sous la force Z, laquelle de ces capacités d'OHKO est la plus puissante ?",
    choices: ["Guillotine", "Empal'Korne", "Abîme", "Glaciation"],
    correctIndex: 2, // answer key says Abîme (note: Showdown gives all four a 180 BP Z-move)
  },
  {
    prompt: "Sur quelle capacité se base la capacité Z signature Gare au Ronflex ?",
    choices: ["Damoclès", "Giga Impact", "Plaquage", "Bâillement"],
    correctIndex: 1,
  },
  {
    prompt: "Quel est le nom du Cristal Z de Raichu d'Alola ?",
    choices: ["Raichuzelite", "Alolazelite", "Aloraïzelite", "Alolaïzelite"],
    correctIndex: 2, // Aloraichium Z = Aloraïzélite
  },
  // Dynamax / Gigamax
  {
    prompt: "Quelle génération parmi ces 4 contient un Pokémon possédant une forme Gigamax ?",
    choices: ["3G", "4G", "5G", "6G"],
    correctIndex: 2, // Garbodor (Miasmax), Gen 5
  },
  {
    prompt: "De qui Corrosion Gmax est-il la capacité signature ?",
    choices: ["Melmetal", "Miasmax", "Pomdrapi", "Duralugon"],
    correctIndex: 2, // Corrosion G-Max = G-Max Tartness (Pomdrapi)
  },
  {
    prompt: "De quelle part des PV max les Restes soignent-ils les PV d'un Pokémon de niveau Dynamax 10 ?",
    choices: ["1/12", "1/16", "1/24", "1/32"],
    correctIndex: 3, // Leftovers heal 1/16 of the *undynamaxed* max HP (baseMaxhp); Dynamax level 10 doubles max HP -> 1/32
  },
  {
    prompt: "Laquelle de ces 4 attaques est la seule à fonctionner contre un Pokémon Dynamax ?",
    choices: ["Pied Voltige", "Ten-Danse", "Balayage", "Tacle Feu"],
    correctIndex: 0, // Ten-Danse (Entrainment), Balayage (Low Kick) and Tacle Feu (Heat Crash) all fail on a Dynamax
  },
  {
    prompt:
      "De combien de % un bonbon Dynamax augmente-t-il la base PV de votre Pokémon sous sa forme Dynamaxée ?",
    choices: ["2%", "5%", "10%", "20%"],
    correctIndex: 1, // +1 Dynamax level = +0.05x HP multiplier
  },
  // 1G — Questions Extinct
  {
    prompt:
      "Dans la première génération, avec quel montant de PV un Leveinard niveau 100 avec ses valeurs déterminantes à 15 ne peut-il pas se soigner grâce à E-Coque ?",
    choices: ["448", "255", "702", "191"],
    correctIndex: 0, // max HP 703; E-Coque fails when missing HP % 256 == 255 -> 703 - 255 = 448
  },
  {
    prompt: "Dans la première génération, quelle information est incorrecte ?",
    choices: [
      "On ne peut pas brûler un Pokémon de type Feu avec une attaque de type Feu.",
      "On ne peut pas paralyser un Pokémon de type Normal avec Plaquage.",
      "On ne peut pas geler un Pokémon de type Glace avec une attaque de type Glace.",
      "On ne peut pas paralyser un type Électrik.",
    ],
    correctIndex: 3,
  },
  {
    prompt: "Dans la première génération, quelle information est incorrecte ?",
    choices: [
      "Séisme ne touche pas un Pokémon qui utilise l'attaque Tunnel.",
      "Tornade est une attaque de type Normal.",
      "Déflagration a 30% de chance de brûler le Pokémon adverse.",
      "Poing Karaté est une attaque de type Normal.",
    ],
    correctIndex: 2, // answer key says Déflagration (note: Showdown gen 1 gives it a 30% burn chance)
  },
  {
    prompt: "Dans la première génération, quelle information sur l'attaque Buée Noire est incorrecte ?",
    choices: [
      "Elle enlève les Vampigraines.",
      "Elle enlève la confusion.",
      "Elle enlève le malus d'attaque du Pokémon attaquant s'il est brûlé.",
      "Elle échoue si le Pokémon attaquant est paralysé.",
    ],
    correctIndex: 3, // 1-3 confirmed by Showdown gen 1; Haze never fails because the user is paralyzed
  },
  {
    prompt: "En première génération, laquelle de ces informations est fausse ?",
    choices: [
      "Le type Poison est super efficace sur le type Insecte et vice versa.",
      "Le type Roche résiste au type Insecte.",
      "Le type Feu ne résiste pas au type Glace.",
      "Le type Spectre n'affecte pas le type Psy.",
    ],
    correctIndex: 1, // gen 1: Bug -> Rock is neutral
  },
];

// --- Manche 2 : Jusqu'où peut monter un Pokémon dans une stat précise --------

// A cursor sweeps the brief's 41-value window; the player stops it on the
// stat's maximum at level 100 (31 IV, 252 EV, favourable nature).
const STAT_LIMITS: { stat: string; pokemon: string; species: string; low: number; high: number; max: number }[] = [
  { stat: "Vitesse", pokemon: "Dracolosse", species: "Dragonite", low: 260, high: 300, max: 284 },
  { stat: "Attaque", pokemon: "Crocorible", species: "Krookodile", low: 330, high: 370, max: 366 },
  { stat: "Attaque Spéciale", pokemon: "Roserade", species: "Roserade", low: 345, high: 385, max: 383 },
  { stat: "Défense Spéciale", pokemon: "Hariyama", species: "Hariyama", low: 230, high: 270, max: 240 },
  { stat: "PV", pokemon: "Wailord", species: "Wailord", low: 518, high: 558, max: 544 },
  { stat: "Défense", pokemon: "Lippoutou", species: "Jynx", low: 178, high: 218, max: 185 },
  { stat: "Attaque", pokemon: "Limonde", species: "Stunfisk", low: 222, high: 262, max: 254 },
  { stat: "Attaque Spéciale", pokemon: "Alakazam", species: "Alakazam", low: 379, high: 419, max: 405 },
  { stat: "Défense", pokemon: "Motisma-Eau", species: "Rotom-Wash", low: 321, high: 361, max: 344 },
  { stat: "Défense Spéciale", pokemon: "Katagami", species: "Kartana", low: 149, high: 189, max: 177 },
];

function statQuestion(s: (typeof STAT_LIMITS)[number]): NewQuestion {
  return {
    prompt: `Jusqu'où peut monter la stat ${s.stat} de ${s.pokemon} au niveau 100 ?`,
    choices: [],
    correctIndex: s.max,
    meta: { slider: { pokemon: s.pokemon, species: s.species, stat: s.stat, low: s.low, high: s.high } },
  };
}

// --- Manche 3 : Vrai ou Faux -------------------------------------------------

const TRUE_FALSE: { statement: string; answer: boolean }[] = [
  {
    statement:
      "Lors de l'énigme de la saison Yrud 1, un immense crétin a décidé de submit Hoopa en réponse alors même qu'un joueur de son clan lui avait donné la réponse 1 min plus tard.",
    answer: true,
  },
  {
    statement:
      "Shykimi a réussi l'exploit de perdre au premier tour de la consolante du tournoi TCG alors qu'il avait fini les poules en 3-0.",
    answer: true,
  },
  {
    statement:
      "Lors de la saison Fan club, où il fallait centrer son équipe autour d'un dresseur emblématique de la saga ou de la RPPLF, Patatex et Remysse ont décidé de centrer leur équipe autour de Juyen.",
    answer: false,
  },
  {
    statement:
      "Lors de la saison des territoires, Rudy a pu faire appel à Primo Kyogre pour rivaliser face au Méga Rayquaza de Loam.",
    answer: false, // c'était Kyogre simple
  },
  {
    statement: "Corvaillus n'est jamais sorti du top 10 des usages RPPLF depuis juin 2024.",
    answer: false,
  },
  {
    statement: "Lucio Cerra a remporté le tournoi qui avait été fait pour inaugurer la méta RPPLF 7G.",
    answer: true,
  },
  {
    statement: "Juyen a pour habitude d'appeler ses Simularbre « Roger Tronc ».",
    answer: false,
  },
  {
    statement:
      "Le nom du journal qui a retracé les événements de la saison Rocket avait pour nom « Ze Skander Telegraph ».",
    answer: false,
  },
  {
    statement:
      "Skander a déjà fait perdre un titre de maître RPPLF à Juyen en forfeitant par erreur le match de maître de Juyen.",
    answer: true,
  },
  {
    statement:
      "Lors de l'aventure 2G, Serigne a réussi l'exploit de capturer Entei, Suicune et Raikou, faisant preuve d'une chance extraordinaire.",
    answer: false,
  },
];

// --- Manche 5 : Blind Test Musical -----------------------------------------

const WHERE = "De quel lieu vient ce thème ?";
const WHO = "À qui est associé ce thème ?";

const BLIND_TEST: NewQuestion[] = [
  { prompt: WHERE, audioFile: "yg2-01-Illumis.mp3", points: 1,
    choices: ["Unionpolis", "Volucité", "Safrania", "Illumis"], correctIndex: 3 },
  { prompt: WHO, audioFile: "yg2-02-Cynthia.wav", points: 1,
    choices: ["Goyah", "Cynthia", "Guajava", "Dianthéa"], correctIndex: 1 },
  { prompt: "Quel est ce thème de Surf ?", audioFile: "yg2-03-Surf3G.mp3", points: 2,
    choices: ["Surf Kanto", "Surf Johto", "Surf Hoenn", "Surf Sinnoh"], correctIndex: 2 },
  { prompt: WHO, audioFile: "yg2-04-TeamRocket.wav", points: 2,
    choices: ["Giovanni HGSS", "Sbire Rocket", "Hélio", "Sbire Galaxie"], correctIndex: 1 },
  { prompt: WHERE, audioFile: "yg2-05-CarminSurMer.mp3", points: 2,
    choices: ["Carmin sur Mer", "Poivressel", "Irisia", "Port-Tempères"], correctIndex: 0 },
  { prompt: "À quoi est associé ce thème ?", audioFile: "yg2-06-ParcNaturel.mp3", points: 2,
    choices: ["Shaymin", "Cresselia", "Darkrai", "Parc Naturel"], correctIndex: 3 },
  { prompt: WHO, audioFile: "yg2-07-TeamStar.wav", points: 2,
    choices: ["Champions Écarlate et Violet", "Team Star", "Nabil", "Clavel"], correctIndex: 1 },
  { prompt: WHERE, audioFile: "yg2-08-Renouet.mp3", points: 3,
    choices: ["Ogooesse", "Renouet", "Bourg Croquis SM", "Bourg-la-Reine"], correctIndex: 1 },
  { prompt: WHO, audioFile: "yg2-09-TeamAquaMagma.wav", points: 3,
    choices: ["Sbire Magma/Aqua", "Max", "Arthur", "Lance Team Rocket"], correctIndex: 0 },
  { prompt: "Quel est ce thème ?", audioFile: "yg2-10-EthernatosPhase3.mp3", points: 3,
    choices: ["Zacian/Zamazenta", "Éthernatos phase 1", "Éthernatos phase 2", "Éthernatos phase 3"], correctIndex: 3 },
  { prompt: WHERE, audioFile: "yg2-11-Route217.mp3", points: 4,
    choices: ["Lac Savoir", "Frimapic", "Route 217", "Route 214"], correctIndex: 2 },
  { prompt: WHERE, audioFile: "yg2-12-RanchDePoni.mp3", points: 4,
    choices: ["Bonville", "Ligue d'Alola", "Ranch de Poni", "Ekaeka"], correctIndex: 2 },
  { prompt: WHO, audioFile: "yg2-13-Cobaltium.wav", points: 4,
    choices: ["Jirachi", "Cresselia", "Lames de Justice", "Gardiens d'Alola"], correctIndex: 2 },
  { prompt: WHERE, audioFile: "yg2-14-Ludester.mp3", points: 4,
    choices: ["Ludester", "Plongée 3G", "Mont Mémoria", "Village Flottant"], correctIndex: 0 },
  {
    prompt: "De quel lieu vient ce thème ? Pas de proposition : écris ta réponse !",
    audioFile: "yg2-15-Jarramanca.mp3",
    points: 10,
    choices: ["Jarramanca / Cascarrafa"],
    correctIndex: 0,
    acceptedAnswers: ["Jarramanca", "Cascarrafa"],
  },
];

// --- Manche 4 : Le Navidex --------------------------------------------------

// Each image shows a route's wild Pokémon with one replaced by a "?" — players
// type the missing one. French and English names both count.
const NAVIDEX: { route: string; fr: string; en: string }[] = [
  { route: "la Route 11 (Kalos)", fr: "Dedenne", en: "Dedenne" },
  { route: "la Route 11 (Alola, USUL)", fr: "Lampignon", en: "Shiinotic" },
  { route: "la Route 1 (Galar)", fr: "Hoothoot", en: "Hoothoot" },
  { route: "la Route 8 (Unys, N2B2)", fr: "Limonde", en: "Stunfisk" },
  { route: "la Route 207 (Sinnoh, BDSP)", fr: "Cerfrousse", en: "Stantler" },
  { route: "le Chenal 126 (Hoenn)", fr: "Coquiperl", en: "Clamperl" },
  { route: "la Route 6 (Kalos)", fr: "Venipatte", en: "Venipede" },
  { route: "le Chemin du défi (Alola, Soleil)", fr: "Magicarpe", en: "Magikarp" },
  { route: "la Mine de Galar", fr: "Chovsourir", en: "Woobat" },
  { route: "la Route 24 (Kanto, Rouge)", fr: "Chétiflor", en: "Bellsprout" },
];

export const YRUD_GAMES_2_ROUNDS: NewRound[] = [
  {
    roundIndex: 1,
    roundLabel: "Quizz Mécaniques",
    scoring: { ...FLAT, points: CATEGORY_POINTS.other },
    ownScoring: true,
    questions: MECHANICS.map((q, i) => ({
      ...q,
      meta: { category: CATEGORIES[Math.floor(i / 5)], categoryPoints: CATEGORY_POINTS },
    })),
  },
  {
    roundIndex: 2,
    roundLabel: "Jusqu'où peut monter un Pokémon dans une stat précise",
    theme: "slider",
    scoring: FLAT, // the slider scores by distance (shared/specialRounds.ts)
    ownScoring: true,
    questions: STAT_LIMITS.map(statQuestion),
  },
  {
    roundIndex: 3,
    roundLabel: "Vrai ou Faux",
    scoring: FLAT,
    ownScoring: true,
    questions: TRUE_FALSE.map((q) => ({
      prompt: q.statement,
      choices: ["Vrai", "Faux"],
      correctIndex: q.answer ? 0 : 1,
      meta: { bomb: { count: 3, penalty: 20 } },
    })),
  },
  {
    roundIndex: 4,
    roundLabel: "Le Navidex",
    // Typing a name takes longer than clicking a choice.
    scoring: { ...FLAT, timeLimitSec: 30 },
    ownScoring: true,
    questions: NAVIDEX.map((n, i) => ({
      prompt: `Quel Pokémon manque sur ${n.route} ?`,
      mediaUrl: `/quizz/images/yg2-navidex-${String(i + 1).padStart(2, "0")}.jpg`,
      choices: [n.fr],
      correctIndex: 0,
      acceptedAnswers: [...new Set([n.fr, n.en])],
      // The first player to find it steals 5 pts from whoever they want.
      meta: { steal: 5 },
    })),
  },
  {
    roundIndex: 5,
    roundLabel: "Blind Test Musical",
    theme: "ost",
    // Points are set per question; no penalty for a wrong pick.
    scoring: FLAT,
    ownScoring: true,
    questions: BLIND_TEST,
  },
  {
    roundIndex: 6,
    roundLabel: "La Chasse-Taupes",
    theme: "whack",
    // The moles carry their own points (packages/shared/src/whack.ts).
    scoring: FLAT,
    ownScoring: true,
    questions: [
      {
        prompt: "Tape les taupes le plus vite possible !",
        choices: [],
        correctIndex: 0,
        whackDurationMs: 60_000,
      },
    ],
  },
];
