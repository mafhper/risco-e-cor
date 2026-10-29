// Parental gate: a navigation barrier for adults (not authentication).
export const GATE_HOLD_MS = 2000;

export type GateChallenge = { a: number; b: number };

/** Two-digit + one-digit sum, e.g. 12 + 7. */
export function makeChallenge(rand: () => number = Math.random): GateChallenge {
  const a = 11 + Math.floor(rand() * 79); // 11..89
  const b = 3 + Math.floor(rand() * 7); // 3..9
  return { a, b };
}

export const isCorrect = (c: GateChallenge, answer: string) =>
  answer.trim() !== "" && Number(answer) === c.a + c.b;
