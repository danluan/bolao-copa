import type { OfficialMatch } from "./types";
import { sameTeam } from "./normalize";
import { toScore } from "./scoring";

type ApiFootballFixture = {
  fixture: {
    date: string;
    status: {
      short: string;
      elapsed: number | null;
    };
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

export type LiveMatch = {
  jogo_id: number;
  placar_a: number | null;
  placar_b: number | null;
  status: "finished" | "live" | "scheduled";
  minuto: number | null;
  clock: string | null;
};

const liveStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);
const finishedStatuses = new Set(["FT", "AET", "PEN"]);

function statusFromApi(short: string) {
  if (finishedStatuses.has(short)) return "finished" as const;
  if (liveStatuses.has(short)) return "live" as const;
  return "scheduled" as const;
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function findLocalMatch(remote: ApiFootballFixture, matches: OfficialMatch[]) {
  const remoteDate = dateOnly(remote.fixture.date);

  return matches.find((match) => {
    const direct = sameTeam(match.time_a, remote.teams.home.name) && sameTeam(match.time_b, remote.teams.away.name);
    const inverted = sameTeam(match.time_a, remote.teams.away.name) && sameTeam(match.time_b, remote.teams.home.name);
    const sameDate = !match.data || !remoteDate || match.data === remoteDate;
    return (direct || inverted) && sameDate;
  });
}

type EspnCompetitor = {
  homeAway: "home" | "away";
  score?: string;
  team: {
    displayName: string;
    shortDisplayName?: string;
  };
};

type EspnEvent = {
  date: string;
  status: {
    displayClock?: string;
    type: {
      state: "pre" | "in" | "post";
      completed: boolean;
      name: string;
      description: string;
    };
  };
  competitions: Array<{
    competitors: EspnCompetitor[];
  }>;
};

function statusFromEspn(event: EspnEvent) {
  if (event.status.type.completed || event.status.type.state === "post") return "finished" as const;
  if (event.status.type.state === "in") return "live" as const;
  return "scheduled" as const;
}

function uniqueMatchDates(matches: OfficialMatch[]) {
  const dates = new Set<string>();

  for (const match of matches) {
    if (!match.data || !match.time_a || !match.time_b) continue;
    dates.add(match.data.replaceAll("-", ""));
  }

  return [...dates].sort();
}

function findLocalEspnMatch(event: EspnEvent, matches: OfficialMatch[]) {
  const competitors = event.competitions[0]?.competitors ?? [];
  const home = competitors.find((competitor) => competitor.homeAway === "home");
  const away = competitors.find((competitor) => competitor.homeAway === "away");
  if (!home || !away) return null;

  const remoteDate = dateOnly(event.date);

  return matches.find((match) => {
    const direct = sameTeam(match.time_a, home.team.displayName) && sameTeam(match.time_b, away.team.displayName);
    const inverted = sameTeam(match.time_a, away.team.displayName) && sameTeam(match.time_b, home.team.displayName);
    const sameDate = !match.data || !remoteDate || match.data === remoteDate;
    return direct || inverted || (sameDate && (direct || inverted));
  });
}

async function fetchEspnScores(matches: OfficialMatch[]) {
  const scores = new Map<number, LiveMatch>();
  const dates = uniqueMatchDates(matches);

  await Promise.all(
    dates.map(async (date) => {
      const url = new URL("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard");
      url.searchParams.set("dates", date);
      url.searchParams.set("limit", "20");

      const response = await fetch(url, {
        next: {
          revalidate: 20,
        },
      });

      if (!response.ok) return;

      const body = (await response.json()) as { events?: EspnEvent[] };

      for (const event of body.events ?? []) {
        const localMatch = findLocalEspnMatch(event, matches);
        if (!localMatch) continue;

        const competitors = event.competitions[0]?.competitors ?? [];
        const home = competitors.find((competitor) => competitor.homeAway === "home");
        const away = competitors.find((competitor) => competitor.homeAway === "away");
        if (!home || !away) continue;

        const inverted =
          sameTeam(localMatch.time_a, away.team.displayName) && sameTeam(localMatch.time_b, home.team.displayName);
        const status = statusFromEspn(event);
        const homeScore = status === "scheduled" ? null : toScore(home.score ?? null);
        const awayScore = status === "scheduled" ? null : toScore(away.score ?? null);

        scores.set(localMatch.jogo_id, {
          jogo_id: localMatch.jogo_id,
          placar_a: inverted ? awayScore : homeScore,
          placar_b: inverted ? homeScore : awayScore,
          status,
          minuto: null,
          clock: event.status.displayClock ?? null,
        });
      }
    }),
  );

  return scores;
}

export async function fetchLiveScores(matches: OfficialMatch[]): Promise<{
  provider: string;
  enabled: boolean;
  scores: Map<number, LiveMatch>;
}> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const league = process.env.API_FOOTBALL_LEAGUE_ID ?? "1";
  const season = process.env.API_FOOTBALL_SEASON ?? "2026";

  if (!apiKey) {
    const espnScores = await fetchEspnScores(matches);

    return {
      provider: "ESPN public scoreboard",
      enabled: true,
      scores: espnScores,
    };
  }

  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("league", league);
  url.searchParams.set("season", season);

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
    next: {
      revalidate: 30,
    },
  });

  if (!response.ok) {
    return {
      provider: "API-FOOTBALL indisponivel",
      enabled: false,
      scores: new Map(),
    };
  }

  const body = (await response.json()) as { response?: ApiFootballFixture[] };
  const scores = new Map<number, LiveMatch>();

  for (const fixture of body.response ?? []) {
    const localMatch = findLocalMatch(fixture, matches);
    if (!localMatch) continue;

    const inverted =
      sameTeam(localMatch.time_a, fixture.teams.away.name) && sameTeam(localMatch.time_b, fixture.teams.home.name);

    scores.set(localMatch.jogo_id, {
      jogo_id: localMatch.jogo_id,
      placar_a: inverted ? toScore(fixture.goals.away) : toScore(fixture.goals.home),
      placar_b: inverted ? toScore(fixture.goals.home) : toScore(fixture.goals.away),
      status: statusFromApi(fixture.fixture.status.short),
      minuto: fixture.fixture.status.elapsed,
      clock: fixture.fixture.status.elapsed ? `${fixture.fixture.status.elapsed}'` : null,
    });
  }

  return {
    provider: "API-FOOTBALL / API-SPORTS",
    enabled: true,
    scores,
  };
}
