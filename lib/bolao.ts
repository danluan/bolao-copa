import { promises as fs } from "fs";
import path from "path";
import type {
  BolaoFile,
  DashboardData,
  EnrichedMatch,
  OfficialMatch,
  ParticipantDetail,
  Participant,
  RankingEntry,
  RawScore,
} from "./types";
import { fetchLiveScores, type LiveMatch } from "./live-scores";
import { calculatePoints, toScore } from "./scoring";

const rootDir = process.cwd();
const bolaoPath = path.join(rootDir, "bolao_copa_2026.json");

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

export async function readBolaoFile() {
  return readJsonFile<BolaoFile>(bolaoPath, {
    metadata: {
      arquivo_origem: "bolao_copa_2026.json",
      gerado_em: new Date().toISOString().slice(0, 10),
      abas_lidas: 0,
      total_participantes: 0,
      total_jogos: 0,
    },
    resultados_oficiais: [],
    participantes: [],
  });
}

function isDefinedMatch(match: OfficialMatch) {
  return Boolean(match.data && match.hora && match.time_a && match.time_b);
}

async function readOfficialMatches() {
  const bolao = await readBolaoFile();
  const baseMatches = bolao.resultados_oficiais.filter(isDefinedMatch);
  return {
    bolao,
    matches: baseMatches,
  };
}

function parseMatchDate(match: OfficialMatch) {
  if (!match.data) return null;
  return new Date(`${match.data}T${match.hora ?? "00:00"}:00-03:00`);
}

function formatDate(match: OfficialMatch) {
  if (!match.data) return "Data indefinida";
  const date = parseMatchDate(match);
  if (!date || Number.isNaN(date.getTime())) return match.data;

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getStatus(match: OfficialMatch, live?: LiveMatch): EnrichedMatch["status"] {
  if (live?.status === "live") return "live";
  if (live?.status === "finished") return "finished";

  const scoreA = live?.placar_a ?? toScore(match.placar_a);
  const scoreB = live?.placar_b ?? toScore(match.placar_b);
  if (scoreA !== null && scoreB !== null) return "finished";

  return match.time_a && match.time_b ? "scheduled" : "pending";
}

function enrichMatch(match: OfficialMatch, live?: LiveMatch): EnrichedMatch {
  const placarA = live?.placar_a ?? toScore(match.placar_a);
  const placarB = live?.placar_b ?? toScore(match.placar_b);
  const isLive = live?.status === "live";

  return {
    ...match,
    placar_a_num: placarA,
    placar_b_num: placarB,
    status: getStatus(match, live),
    minuto: isLive ? live.minuto : null,
    clock: isLive ? (live.clock ?? (live.minuto ? `${live.minuto}'` : null)) : live?.clock ?? null,
    isLive,
    displayDate: formatDate(match),
    displayTime: match.hora ?? "--:--",
    sourceLabel: live ? "automatico" : "agenda",
  };
}

function currentScoreForMatch(match: OfficialMatch, liveScores: Map<number, LiveMatch>) {
  const live = liveScores.get(match.jogo_id);
  return {
    a: live?.placar_a ?? toScore(match.placar_a),
    b: live?.placar_b ?? toScore(match.placar_b),
  };
}

function rankParticipants(participants: Participant[], matches: OfficialMatch[], liveScores: Map<number, LiveMatch>) {
  const matchById = new Map(matches.map((match) => [match.jogo_id, match]));

  const previous = [...participants]
    .sort((a, b) => b.pontuacao_total - a.pontuacao_total || a.nome.localeCompare(b.nome))
    .map((participant, index, ordered) => {
      const previousWithSamePoints = ordered.findIndex((entry) => entry.pontuacao_total === participant.pontuacao_total);
      return [participant.numero_tabela, previousWithSamePoints + 1 || index + 1] as const;
    });
  const previousByTable = new Map(previous);

  const entries = participants.map((participant) => {
    let pontos = 0;
    let exatos = 0;
    let acertosResultado = 0;
    let jogosPontuados = 0;
    let ultimoJogoPontuado: number | null = null;

    for (const guess of participant.palpites) {
      const official = matchById.get(guess.jogo_id);
      if (!official) continue;

      const score = currentScoreForMatch(official, liveScores);
      const points = calculatePoints(guess.palpite_placar_a, guess.palpite_placar_b, score.a, score.b);
      pontos += points;

      if (points > 0) {
        jogosPontuados += 1;
        ultimoJogoPontuado = guess.jogo_id;
      }

      if (points === 9) {
        exatos += 1;
      }

      if (points >= 5) {
        acertosResultado += 1;
      }
    }

    return {
      position: 0,
      previousPosition: previousByTable.get(participant.numero_tabela) ?? null,
      numero_tabela: participant.numero_tabela,
      nome: participant.nome,
      aba: participant.aba,
      pontos,
      pontosPlanilha: participant.pontuacao_total,
      exatos,
      acertosResultado,
      jogosPontuados,
      variacao: null,
      ultimoJogoPontuado,
    } satisfies RankingEntry;
  });

  entries.sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome));

  return entries.map((entry, index, ordered) => {
    const tiedIndex = ordered.findIndex((candidate) => candidate.pontos === entry.pontos);
    const position = tiedIndex + 1 || index + 1;
    return {
      ...entry,
      position,
      variacao: entry.previousPosition === null ? null : entry.previousPosition - position,
    };
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  const { bolao, matches } = await readOfficialMatches();
  const live = await fetchLiveScores(matches);
  const enrichedMatches = matches.map((match) => enrichMatch(match, live.scores.get(match.jogo_id)));
  const ranking = rankParticipants(bolao.participantes, matches, live.scores);

  const jogosAoVivo = enrichedMatches.filter((match) => match.status === "live").length;
  const jogosFinalizados = enrichedMatches.filter((match) => match.status === "finished").length;
  const jogosPendentes = enrichedMatches.filter((match) => match.status !== "finished" && match.status !== "live").length;

  return {
    metadata: {
      ...bolao.metadata,
      total_jogos: matches.length,
      generatedAt: new Date().toISOString(),
      liveProvider: live.provider,
      liveEnabled: live.enabled,
    },
    summary: {
      participantes: bolao.participantes.length,
      jogos: matches.length,
      jogosFinalizados,
      jogosAoVivo,
      jogosPendentes,
      lider: ranking[0] ?? null,
    },
    matches: enrichedMatches.sort((a, b) => a.jogo_id - b.jogo_id),
    ranking,
  };
}

export async function getParticipantDetail(numeroTabela: number): Promise<ParticipantDetail | null> {
  const { bolao, matches } = await readOfficialMatches();
  const participant = bolao.participantes.find((entry) => entry.numero_tabela === numeroTabela);
  if (!participant) return null;

  const live = await fetchLiveScores(matches);
  const ranking = rankParticipants(bolao.participantes, matches, live.scores);
  const rankingEntry = ranking.find((entry) => entry.numero_tabela === participant.numero_tabela);
  if (!rankingEntry) return null;

  const matchById = new Map(matches.map((match) => [match.jogo_id, match]));

  return {
    metadata: {
      ...bolao.metadata,
      total_jogos: matches.length,
      generatedAt: new Date().toISOString(),
      liveProvider: live.provider,
      liveEnabled: live.enabled,
    },
    participant: rankingEntry,
    guesses: participant.palpites
      .map((guess) => {
        const official = matchById.get(guess.jogo_id);
        const score = official
          ? currentScoreForMatch(official, live.scores)
          : { a: guess.oficial_placar_a, b: guess.oficial_placar_b };
        const enriched = official ? enrichMatch(official, live.scores.get(guess.jogo_id)) : null;

        return {
          ...guess,
          oficial_placar_a: score.a,
          oficial_placar_b: score.b,
          palpite_placar_a_num: toScore(guess.palpite_placar_a),
          palpite_placar_b_num: toScore(guess.palpite_placar_b),
          oficial_placar_a_num: toScore(score.a),
          oficial_placar_b_num: toScore(score.b),
          pontuacao_recalculada: calculatePoints(guess.palpite_placar_a, guess.palpite_placar_b, score.a, score.b),
          status: enriched?.status ?? "pending",
          displayDate:
            enriched?.displayDate ??
            formatDate({
              ...guess,
              placar_a: guess.oficial_placar_a,
              placar_b: guess.oficial_placar_b,
            }),
          displayTime: enriched?.displayTime ?? guess.hora ?? "--:--",
          sourceLabel: enriched?.sourceLabel ?? "planilha",
        };
      })
      .sort((a, b) => a.jogo_id - b.jogo_id),
  };
}
