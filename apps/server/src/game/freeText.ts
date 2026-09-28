// Matching for free-text answers (a blind test "pas de proposition" question):
// case, accents, spaces and punctuation don't matter, and a long answer
// tolerates a couple of typos so "Jaramanca" still counts.

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

function allowedTypos(answer: string): number {
  if (answer.length >= 8) return 2;
  if (answer.length >= 5) return 1;
  return 0;
}

export function matchesFreeText(input: string, accepted: string[]): boolean {
  const guess = normalize(input);
  if (!guess) return false;
  return accepted.some((answer) => {
    const target = normalize(answer);
    return target.length > 0 && distance(guess, target) <= allowedTypos(target);
  });
}
