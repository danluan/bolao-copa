"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  ListChecks,
  Medal,
  RefreshCw,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { flagForTeam } from "@/lib/flags";
import type { DashboardData, EnrichedMatch } from "@/lib/types";

type Props = {
  initialData: DashboardData;
};

type DashboardTab = "geral" | "ranking" | "jogos" | "regras";

const statusLabel: Record<EnrichedMatch["status"], string> = {
  finished: "Finalizado",
  live: "Ao vivo",
  scheduled: "Agendado",
  pending: "A definir",
};

const scoringRules = [
  {
    label: "Placar total",
    points: 9,
    description: "Acerta exatamente os gols dos dois times.",
    example: "Palpite Brasil 2 x 1 Japao; resultado Brasil 2 x 1 Japao.",
  },
  {
    label: "Resultado com um placar",
    points: 7,
    description: "Acerta vencedor ou empate e tambem os gols de um dos times.",
    example: "Palpite Brasil 2 x 0 Japao; resultado Brasil 2 x 1 Japao.",
  },
  {
    label: "Resultado",
    points: 5,
    description: "Acerta vencedor ou empate, sem acertar os gols dos dois times.",
    example: "Palpite Brasil 1 x 0 Japao; resultado Brasil 2 x 1 Japao.",
  },
  {
    label: "Um placar isolado",
    points: 2,
    description: "Acerta os gols de um time, mas erra o resultado da partida.",
    example: "Palpite Brasil 2 x 3 Japao; resultado Brasil 2 x 1 Japao.",
  },
  {
    label: "Erro total",
    points: 0,
    description: "Erra o resultado e tambem os gols dos dois times.",
    example: "Palpite Brasil 1 x 3 Japao; resultado Brasil 2 x 1 Japao.",
  },
];

const prizeRanges = [
  "Ate 30 participantes: 3 primeiros",
  "31 a 40 participantes: 4 primeiros",
  "41 a 50 participantes: 5 primeiros",
  "51 a 60 participantes: 6 primeiros",
  "Mais de 60 participantes: 7 primeiros",
];

function scoreText(match: EnrichedMatch) {
  const a = match.placar_a_num;
  const b = match.placar_b_num;
  if (a === null || b === null) return "n x d";
  return `${a} x ${b}`;
}

function sourceText(data: DashboardData) {
  if (data.metadata.liveEnabled) {
    return `${data.metadata.liveProvider} ativa`;
  }

  return "Planilha local";
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function prizeSlots(participants: number) {
  if (participants <= 30) return 3;
  if (participants <= 40) return 4;
  if (participants <= 50) return 5;
  if (participants <= 60) return 6;
  return 7;
}

function parseMatchStart(match: EnrichedMatch) {
  if (!match.data) return null;
  const parsed = new Date(`${match.data}T${match.hora ?? "00:00"}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function matchStatusText(match: EnrichedMatch) {
  if (match.isLive) return match.clock ? `Ao vivo · ${match.clock}` : "Ao vivo";
  return statusLabel[match.status];
}

function matchIdText(match: Pick<EnrichedMatch, "jogo_id" | "jogo_fifa">) {
  return match.jogo_fifa ? `Jogo ${match.jogo_id} · ${match.jogo_fifa}` : `Jogo ${match.jogo_id}`;
}

function TeamName({ name }: { name: string | null }) {
  const flag = flagForTeam(name);

  return (
    <span className="team-name">
      {flag && (
        <span className="team-flag" aria-hidden="true">
          {flag}
        </span>
      )}
      <span>{name ?? "A definir"}</span>
    </span>
  );
}

function MatchSummaryCard({
  match,
  title,
}: {
  match: EnrichedMatch | null;
  title: string;
}) {
  return (
    <article className={`summary-match-card ${match?.status ?? "pending"}`}>
      <span className="eyebrow">{title}</span>
      {match ? (
        <>
          <div className="summary-scoreline">
            <strong>
              <TeamName name={match.time_a} />
            </strong>
            <span>{scoreText(match)}</span>
            <strong>
              <TeamName name={match.time_b} />
            </strong>
          </div>
          <div className="summary-match-meta">
            <span>{matchIdText(match)}</span>
            <span>{match.displayDate}</span>
            <span>{match.displayTime}</span>
            <span>{matchStatusText(match)}</span>
          </div>
        </>
      ) : (
        <p>Nenhum jogo encontrado.</p>
      )}
    </article>
  );
}

export default function Dashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | EnrichedMatch["status"]>("todos");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("geral");

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/bolao", { cache: "no-store" });
      setData((await response.json()) as DashboardData);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const interval = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredMatches = useMemo(() => {
    return data.matches.filter((match) => {
      const text = `${match.time_a ?? ""} ${match.time_b ?? ""} ${match.grupo ?? ""}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesStatus = statusFilter === "todos" || match.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [data.matches, query, statusFilter]);

  const paidPositions = prizeSlots(data.summary.participantes);
  const topRanking = useMemo(() => data.ranking.filter((entry) => entry.position <= 10), [data.ranking]);
  const liveMatch = useMemo(() => data.matches.find((match) => match.status === "live") ?? null, [data.matches]);
  const currentOrLastMatch = useMemo(() => {
    if (liveMatch) return liveMatch;

    return [...data.matches]
      .filter((match) => match.status === "finished")
      .sort((a, b) => (parseMatchStart(b)?.getTime() ?? 0) - (parseMatchStart(a)?.getTime() ?? 0))[0] ?? null;
  }, [data.matches, liveMatch]);
  const nextMatch = useMemo(() => {
    const afterCurrent = currentOrLastMatch ? parseMatchStart(currentOrLastMatch)?.getTime() ?? 0 : 0;
    return (
      [...data.matches]
        .filter((match) => match.status === "scheduled" || match.status === "pending")
        .sort((a, b) => (parseMatchStart(a)?.getTime() ?? 0) - (parseMatchStart(b)?.getTime() ?? 0))
        .find((match) => (parseMatchStart(match)?.getTime() ?? 0) >= afterCurrent) ??
      [...data.matches]
        .filter((match) => match.status === "scheduled" || match.status === "pending")
        .sort((a, b) => (parseMatchStart(a)?.getTime() ?? 0) - (parseMatchStart(b)?.getTime() ?? 0))[0] ??
      null
    );
  }, [currentOrLastMatch, data.matches]);

  return (
    <main className="app-shell">
      <section className="hero">
        <Image src="/stadium-dashboard.png" alt="" fill priority sizes="100vw" className="hero-image" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div>
            <span className="eyebrow">Copa do Mundo 2026</span>
            <h1>Bolão</h1>
            <p>{data.sourceNotice}</p>
          </div>
          <button className="icon-button hero-refresh" onClick={refresh} aria-label="Atualizar dados">
            <RefreshCw size={18} className={refreshing ? "spin" : ""} />
          </button>
        </div>
      </section>

      <section className="stats-grid" aria-label="Resumo do bolao">
        <article className="stat-card leader">
          <div className="stat-icon">
            <Trophy size={20} />
          </div>
          <span>Lider</span>
          <strong>{data.summary.lider?.nome ?? "--"}</strong>
          <small>{data.summary.lider ? `${data.summary.lider.pontos} pontos` : "Sem ranking"}</small>
        </article>
        <article className="stat-card">
          <div className="stat-icon">
            <Users size={20} />
          </div>
          <span>Participantes</span>
          <strong>{data.summary.participantes}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon live">
            <Activity size={20} />
          </div>
          <span>Ao vivo</span>
          <strong>{data.summary.jogosAoVivo}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon">
            <Check size={20} />
          </div>
          <span>Finalizados</span>
          <strong>{data.summary.jogosFinalizados}</strong>
        </article>
      </section>

      <nav className="dashboard-tabs" aria-label="Abas do bolao">
        <button className={activeTab === "geral" ? "active" : ""} onClick={() => setActiveTab("geral")}>
          <ListChecks size={18} />
          Geral
        </button>
        <button className={activeTab === "ranking" ? "active" : ""} onClick={() => setActiveTab("ranking")}>
          <Trophy size={18} />
          Ranking
        </button>
        <button className={activeTab === "jogos" ? "active" : ""} onClick={() => setActiveTab("jogos")}>
          <Activity size={18} />
          Jogos
        </button>
        <button className={activeTab === "regras" ? "active" : ""} onClick={() => setActiveTab("regras")}>
          <BookOpen size={18} />
          Regras
        </button>
      </nav>

      {activeTab === "geral" && (
        <section className="overview-grid">
          <div className="panel top-ranking-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Top 10</span>
                <h2>Ranking resumido</h2>
              </div>
              <span className="updated">Atualizado {formatGeneratedAt(data.metadata.generatedAt)}</span>
            </div>

            <div className="top-ranking-list">
              {topRanking.map((entry) => (
                <Link
                  className="top-ranking-row ranking-row-link"
                  href={`/participantes/${entry.numero_tabela}`}
                  key={entry.numero_tabela}
                  aria-label={`Ver palpites de ${entry.nome}`}
                >
                  <div className={`position ${entry.position <= paidPositions ? "prize-position" : ""}`}>
                    {entry.position}
                  </div>
                  <div className="participant">
                    <strong>{entry.nome}</strong>
                    <span>{entry.position <= paidPositions ? "Faixa de premiacao" : "Top 10"}</span>
                  </div>
                  <div className="points">
                    <strong>{entry.pontos}</strong>
                    <span>pontos</span>
                  </div>
                  <ChevronRight className="row-link-icon" size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <aside className="overview-matches">
            <MatchSummaryCard match={currentOrLastMatch} title={liveMatch ? "Jogo atual" : "Ultimo jogo"} />
            <MatchSummaryCard match={nextMatch} title="Proximo jogo" />
          </aside>
        </section>
      )}

      {activeTab === "ranking" && (
        <section className="content-grid">
          <div className="panel ranking-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Ranking geral</span>
                <h2>Classificacao recalculada</h2>
              </div>
              <span className="updated">Atualizado {formatGeneratedAt(data.metadata.generatedAt)}</span>
            </div>

            <div className="ranking-list">
              {data.ranking.map((entry) => (
                <Link
                  className="ranking-row ranking-row-link"
                  href={`/participantes/${entry.numero_tabela}`}
                  key={entry.numero_tabela}
                  aria-label={`Ver palpites de ${entry.nome}`}
                >
                  <div className={`position ${entry.position <= paidPositions ? "prize-position" : ""}`}>
                    {entry.position}
                  </div>
                  <div className="participant">
                    <strong>{entry.nome}</strong>
                    <span>
                      {entry.aba} · {entry.exatos} placares exatos · {entry.acertosResultado} resultados
                    </span>
                  </div>
                  <div className="points">
                    <strong>{entry.pontos}</strong>
                    <span>
                      {entry.variacao === null ? "novo" : entry.variacao > 0 ? `+${entry.variacao}` : entry.variacao}
                    </span>
                  </div>
                  <ChevronRight className="row-link-icon" size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <aside className="panel side-panel">
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">Fonte automatica</span>
                <h2>Mata-mata</h2>
              </div>
              <Activity size={20} />
            </div>

            <div className="source-stack">
              <div>
                <span>Provedor ativo</span>
                <strong>{data.metadata.liveProvider}</strong>
              </div>
              <div>
                <span>Jogos definidos</span>
                <strong>{data.summary.jogos}</strong>
              </div>
              <div>
                <span>Atualizacao</span>
                <strong>a cada 30s</strong>
              </div>
            </div>

            <div className="rules-note">
              <Medal size={18} />
              <span>Placares nao sao editados manualmente. O ranking usa o placar automatico encontrado para cada jogo.</span>
            </div>
          </aside>
        </section>
      )}

      {activeTab === "jogos" && (
        <section className="panel matches-panel">
          <div className="panel-heading matches-heading">
            <div>
              <span className="eyebrow">Jogos</span>
              <h2>Resultados oficiais</h2>
            </div>
            <div className="filters">
              <label className="search-box">
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar time ou fase" />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "todos" | EnrichedMatch["status"])}
              >
                <option value="todos">Todos</option>
                <option value="live">Ao vivo</option>
                <option value="finished">Finalizados</option>
                <option value="scheduled">Agendados</option>
                <option value="pending">A definir</option>
              </select>
            </div>
          </div>

          <div className="match-list">
            {filteredMatches.map((match) => (
              <article className={`match-card ${match.status}`} key={match.jogo_id}>
                <div className="match-meta">
                  <span className="match-id">{matchIdText(match)}</span>
                  <span>{match.grupo ?? "Sem fase"}</span>
                  <span>
                    <Clock3 size={14} />
                    {match.displayDate} · {match.displayTime}
                  </span>
                </div>

                <div className="scoreline">
                  <strong>
                    <TeamName name={match.time_a} />
                  </strong>
                  <div className="score">
                    <span>{scoreText(match)}</span>
                    {match.isLive && (
                      <em>
                        <CircleDot size={11} />
                        {match.clock ?? (match.minuto ? `${match.minuto}'` : "live")}
                      </em>
                    )}
                  </div>
                  <strong>
                    <TeamName name={match.time_b} />
                  </strong>
                </div>

                <div className="match-actions">
                  <span className={`status-pill ${match.status}`}>{statusLabel[match.status]}</span>
                  <span className="source-pill">{match.sourceLabel}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "regras" && (
        <section className="panel rules-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Regulamento</span>
              <h2>Regras de pontuacao e premiacao</h2>
            </div>
            <ListChecks size={22} />
          </div>

          <div className="rules-grid">
            <div className="rules-section">
              <h3>Pontuacao por jogo</h3>
              <div className="scoring-list">
                {scoringRules.map((rule) => (
                  <article className="scoring-rule" key={rule.points}>
                    <div className="rule-points">{rule.points}</div>
                    <div>
                      <strong>{rule.label}</strong>
                      <p>{rule.description}</p>
                      <span>{rule.example}</span>
                    </div>
                  </article>
                ))}
              </div>
              <div className="rules-note compact-note">
                <Medal size={18} />
                <span>
                  Os pontos nao sao cumulativos. Cada jogo vale apenas uma pontuacao: 9, 7, 5, 2 ou 0.
                </span>
              </div>
            </div>

            <div className="rules-section">
              <h3>Resultado considerado</h3>
              <p>
                A pontuacao usa o placar final incluindo prorrogacao, quando houver. Disputa de penaltis nao entra na
                contagem do placar.
              </p>

              <h3>Premiacao</h3>
              <div className="prize-highlight">
                <span>Faixa atual</span>
                <strong>{prizeSlots(data.summary.participantes)} premiados</strong>
                <small>{data.summary.participantes} participantes inscritos</small>
              </div>
              <ul className="prize-list">
                {prizeRanges.map((range) => (
                  <li key={range}>{range}</li>
                ))}
              </ul>
              <p>
                Em caso de empate, soma-se a premiacao das colocacoes correspondentes ao grupo empatado e divide-se
                igualmente entre os participantes empatados.
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
