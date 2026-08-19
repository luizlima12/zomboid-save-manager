import type { CharacterPosition } from "@/lib/types";

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readCharacterPosition(
  x: unknown,
  y: unknown,
  z: unknown,
): CharacterPosition | undefined {
  const position = {
    x: toFiniteNumber(x),
    y: toFiniteNumber(y),
    z: toFiniteNumber(z),
  };

  if (
    position.x === undefined ||
    position.y === undefined ||
    position.z === undefined
  ) {
    return undefined;
  }

  return position as CharacterPosition;
}
