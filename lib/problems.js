export const PROBLEM_OPTIONS = [
  "Screen",
  "Battery",
  "Charging",
  "Speaker/Mic",
  "Camera",
  "Software",
  "Other",
];

export function parseProblems(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  const seen = new Set();
  const items = [];
  for (const item of raw) {
    const next = String(item || "").trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    items.push(next);
  }
  return items;
}

export function joinProblems(value) {
  return parseProblems(value).join(", ");
}

export function normalizeProblems(value, allowed = PROBLEM_OPTIONS) {
  const allowedSet = new Set(allowed);
  return parseProblems(value).filter((item) => allowedSet.has(item));
}

export function hasProblem(value, problem) {
  return parseProblems(value).includes(problem);
}

export function formatProblemPhrase(value) {
  const items = parseProblems(value).map((item) => item.toLowerCase());
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
