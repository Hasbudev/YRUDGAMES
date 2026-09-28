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
  "Première épreuve : le Quizz mécaniques. Chaque clan choisira sa catégorie, en commençant par le plus minable.",
  "Inclinez-vous, ou tremblez. Les deux me conviennent très bien.",
  "Que les Yrud Games... commencent.",
];

// Keyed by roundIndex — one short jab plus the manche's name, in whatever
// order the bank happens to use them (roundIndex isn't assumed to be 1-5,
// it's just whatever the bank's questions carry).
const ROUND_INTRO_LINES: Record<number, string[]> = {
  2: [
    "Vous respirez encore ? Impressionnant.",
    "Manche 2 : Jusqu'où peut monter un Pokémon dans une stat précise. Un curseur défile, arrêtez-le pile sur la bonne valeur.",
    "Pile, j'ai dit. Et ne comptez pas sur moi pour vous faciliter la tâche.",
  ],
  3: [
    "Bien. La marge d'erreur s'est réduite. L'espoir aussi.",
    "Manche 3 : Vrai ou Faux. Et pour pimenter, une bombe. Répondez juste pour la refiler à un autre clan.",
    "Quand elle explose, tout le clan qui la tient perd 20 points. Trois bombes. Amusez-moi.",
  ],
  4: [
    "Vous avez parcouru toutes ces routes, paraît-il. Prouvez-le.",
    "Manche 4 : Le Navidex. Un Pokémon a disparu de chaque route. Écrivez son nom, en français ou en anglais.",
    "Le meilleur de la manche volera 5 points à qui il veut. Oui, j'encourage la trahison.",
  ],
  5: [
    "Un peu de musique, pour ceux qui commencent à s'ennuyer. Moi le premier.",
    "Manche 5 : Blind Test Musical. Si vous ne reconnaissez pas ces thèmes, avez-vous seulement une âme ?",
    "Ouvrez vos oreilles. C'est le seul organe qui vous servira ici.",
  ],
  6: [
    "Assez réfléchi. Voyons si vos doigts sont moins lents que vos cerveaux.",
    "Manche 6 : La Chasse-Taupes. Tapez mes Taupiqueur. Remysse rapporte gros, Tchoupi vous coûtera cher.",
    "Rudy vous donnera un coup de pouce. Artymasion vous donnera son avis. Personne ne le lui a demandé.",
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
    "Les épreuves sont terminées. Vos petits cerveaux et vos petits doigts ont fait ce qu'ils ont pu.",
    `Il ne reste que deux prétendants dignes de mon attention : ${player1Name} et ${player2Name}.`,
    "Un seul sortira vivant de mon arène. Enfin... façon de parler.",
    "Que la Bataille Finale commence.",
  ];
}
