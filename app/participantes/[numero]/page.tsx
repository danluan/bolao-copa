import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleDot, Clock3, Target, Trophy } from "lucide-react";
import { getParticipantDetail } from "@/lib/bolao";
import { flagForTeam } from "@/lib/flags";
import type { EnrichedMatch, ParticipantGuessDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabel: Record<EnrichedMatch["status"], string> = {
  finished: "Finalizado",
  live: "Ao vivo",
  scheduled: "Agendado",
  pending: "A definir",
};

function scoreValue(value: number | null) {
  return value === null ? "-" : String(value);
}

function guessScoreText(guess: ParticipantGuessDetail) {
  return `${scoreValue(guess.palpite_placar_a_num)} x ${scoreValue(guess.palpite_placar_b_num)}`;
}

function officialScoreText(guess: ParticipantGuessDetail) {
  if (guess.oficial_placar_a_num === null || guess.oficial_placar_b_num === null) return "n x d";
  return `${guess.oficial_placar_a_num} x ${guess.oficial_placar_b_num}`;
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function matchIdText(guess: Pick<ParticipantGuessDetail, "jogo_id" | "jogo_fifa">) {
  return guess.jogo_fifa ? `Jogo ${guess.jogo_id} · ${guess.jogo_fifa}` : `Jogo ${guess.jogo_id}`;
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

export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  const numeroTabela = Number(numero);

  if (!Number.isInteger(numeroTabela)) {
    notFound();
  }

  const detail = await getParticipantDetail(numeroTabela);
  if (!detail) {
    notFound();
  }

  const { participant, guesses } = detail;

  return (
    <main className="app-shell participant-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={18} />
        Voltar ao dashboard
      </Link>

      <section className="participant-header">
        <div>
          <span className="eyebrow">Previsoes do participante</span>
          <h1>{participant.nome}</h1>
          <p>{detail.sourceNotice}</p>
        </div>

        <div className="participant-meta">
          <span>{participant.aba}</span>
          <span>Tabela {participant.numero_tabela}</span>
          <span>Atualizado {formatGeneratedAt(detail.metadata.generatedAt)}</span>
        </div>
      </section>

      <section className="participant-stats" aria-label="Resumo do participante">
        <article className="stat-card">
          <div className="stat-icon">
            <Trophy size={20} />
          </div>
          <span>Posicao</span>
          <strong>{participant.position}</strong>
        </article>
        <article className="stat-card leader">
          <div className="stat-icon">
            <Target size={20} />
          </div>
          <span>Pontos</span>
          <strong>{participant.pontos}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <span>Placares exatos</span>
          <strong>{participant.exatos}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon">
            <CircleDot size={20} />
          </div>
          <span>Resultados</span>
          <strong>{participant.acertosResultado}</strong>
        </article>
      </section>

      <section className="panel guesses-panel">
        <div className="panel-heading guesses-heading">
          <div>
            <span className="eyebrow">Jogos</span>
            <h2>Palpites e pontuacao</h2>
          </div>
          <span className="updated">{guesses.length} jogos</span>
        </div>

        <div className="guess-list">
          {guesses.map((guess) => (
            <article className={`guess-row ${guess.status}`} key={guess.jogo_id}>
              <div className="match-meta">
                <span className="match-id">{matchIdText(guess)}</span>
                <span>{guess.grupo ?? "Sem fase"}</span>
                <span>
                  <Clock3 size={14} />
                  {guess.displayDate} · {guess.displayTime}
                </span>
              </div>

              <div className="guess-teams">
                <strong>
                  <TeamName name={guess.time_a} />
                </strong>
                <span>vs</span>
                <strong>
                  <TeamName name={guess.time_b} />
                </strong>
              </div>

              <div className="guess-scores">
                <div>
                  <span>Palpite</span>
                  <strong>{guessScoreText(guess)}</strong>
                </div>
                <div>
                  <span>Resultado</span>
                  <strong>{officialScoreText(guess)}</strong>
                </div>
              </div>

              <div className="guess-result">
                <strong>{guess.pontuacao_recalculada}</strong>
                <span>pontos</span>
                <em className={`status-pill ${guess.status}`}>{statusLabel[guess.status]}</em>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
