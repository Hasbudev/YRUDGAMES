// Yrud's dialogue lines for every scripted cold-open moment — the opening
// monologue, each per-manche transition, and the final-battle announcement.
// All in the same over-the-top, self-worshipping register as his actual
// Discord announcement for the event ("Moi Yrud, héritier d'Yrud Deuzétwal,
// empereur légitime, maître suprême des combats Pokémon...").

export const INTRO_LINES = [
  "Ah. Vous voilà enfin devant Moi.",
  "Yrud, héritier d'Yrud Deuzétwal. Empereur légitime. Maître suprême des combats Pokémon.",
  "Et, pour ceux qui suivraient pas... centuple lauréat du concours Mister Rapepolofia.",
  "Ce soir, dans mon arène, vous allez souffrir pour mon divertissement personnel.",
  "Des quiz, des bagarres, des taunts humiliants en direct... le programme complet.",
  "Inclinez-vous, ou tremblez. Les deux me conviennent très bien.",
  "Que les Yrud Games... commencent.",
];

// Keyed by roundIndex — one short jab plus the manche's name, in whatever
// order the bank happens to use them (roundIndex isn't assumed to be 1-5,
// it's just whatever the bank's questions carry).
const ROUND_INTRO_LINES: Record<number, string[]> = {
  2: [
    "Vous respirez encore ? Impressionnant.",
    "Manche 2 : Géographe Pokémon. Si vous ne savez même pas où vous habitez, ça va être compliqué.",
    "Que la seconde humiliation commence.",
  ],
  3: [
    "Bien. La marge d'erreur s'est réduite. L'espoir aussi.",
    "Manche 3 : L'Expert Strat. Ici, on sépare les vrais dresseurs des touristes.",
    "Amusez-moi.",
  ],
  4: [
    "Un peu de musique, pour ceux qui commencent à s'ennuyer. Moi le premier.",
    "Manche 4 : Blind Test Musical. Si vous ne reconnaissez pas ces thèmes, avez-vous seulement une âme ?",
    "Ouvrez vos oreilles. C'est le seul organe qui vous servira ici.",
  ],
  5: [
    "Assez perdu de temps avec la culture générale. Parlons de moi.",
    "Manche 5 : Le Quiz d'Yrud. Cette manche, c'est mon autobiographie sous forme de questions.",
    "Priez pour vous en souvenir.",
  ],
};

// Any roundIndex not scripted above (a custom bank, a 6th manche, etc.)
// still gets a Yrud moment instead of silently reusing another one's lines.
export function roundIntroLines(roundIndex: number, roundLabel?: string): string[] {
  const scripted = ROUND_INTRO_LINES[roundIndex];
  if (scripted) return scripted;
  const label = roundLabel ?? `Manche ${roundIndex}`;
  return [`Manche suivante : ${label}.`, "Essayez de ne pas me décevoir davantage."];
}

// The final battle's two contenders, named live from the top two scorers.
export function combatLines(player1Name: string, player2Name: string): string[] {
  return [
    "Le quiz est terminé. Vos petits cerveaux ont fait ce qu'ils ont pu.",
    `Il ne reste que deux prétendants dignes de mon attention : ${player1Name} et ${player2Name}.`,
    "Un seul sortira vivant de mon arène. Enfin... façon de parler.",
    "Que la Bataille Finale commence.",
  ];
}
