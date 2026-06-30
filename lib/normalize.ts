export function normalizeName(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return teamAliases[normalized] ?? normalized;
}

export function sameTeam(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  return left.length > 0 && right.length > 0 && (left === right || left.includes(right) || right.includes(left));
}

const teamAliases: Record<string, string> = {
  "africa do sul": "south africa",
  brasil: "brazil",
  japao: "japan",
  alemanha: "germany",
  paraguai: "paraguay",
  holanda: "netherlands",
  marrocos: "morocco",
  "cost do marf": "ivory coast",
  "costa do marfim": "ivory coast",
  noruega: "norway",
  franca: "france",
  suecia: "sweden",
  mexico: "mexico",
  equador: "ecuador",
  inglaterra: "england",
  congo: "congo dr",
  belgica: "belgium",
  senegal: "senegal",
  "estados unidos": "united states",
  bosnia: "bosnia herzegovina",
  "bosnia herzegovina": "bosnia herzegovina",
  espanha: "spain",
  austria: "austria",
  portugal: "portugal",
  croacia: "croatia",
  suica: "switzerland",
  argelia: "algeria",
  australia: "australia",
  egito: "egypt",
  argentina: "argentina",
  "cabo verde": "cape verde",
  colombia: "colombia",
  gana: "ghana",
};
