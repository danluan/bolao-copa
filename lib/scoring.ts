import type { RawScore } from "./types";

export function toScore(value: RawScore): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.toLowerCase() === "n" || trimmed.toLowerCase() === "d") {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function outcome(a: number, b: number) {
  if (a > b) return "home";
  if (a < b) return "away";
  return "draw";
}

export function calculatePoints(
  guessA: RawScore,
  guessB: RawScore,
  officialA: RawScore,
  officialB: RawScore,
) {
  const gA = toScore(guessA);
  const gB = toScore(guessB);
  const oA = toScore(officialA);
  const oB = toScore(officialB);

  if (gA === null || gB === null || oA === null || oB === null) {
    return 0;
  }

  const exactA = gA === oA;
  const exactB = gB === oB;
  const sameOutcome = outcome(gA, gB) === outcome(oA, oB);

  if (exactA && exactB) return 9;
  if (sameOutcome && (exactA || exactB)) return 7;
  if (sameOutcome) return 5;
  if (exactA || exactB) return 2;
  return 0;
}
