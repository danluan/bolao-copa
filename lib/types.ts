export type RawScore = number | string | null;

export type OfficialMatch = {
  jogo_id: number;
  jogo_fifa?: string | null;
  linha_excel?: number | null;
  grupo?: string | null;
  data: string | null;
  hora: string | null;
  time_a: string | null;
  placar_a: RawScore;
  time_b: string | null;
  placar_b: RawScore;
  source?: "planilha" | "manual" | "api";
};

export type Guess = {
  jogo_id: number;
  jogo_fifa?: string | null;
  linha_excel?: number | null;
  grupo?: string | null;
  data: string | null;
  hora: string | null;
  time_a: string | null;
  palpite_placar_a: RawScore;
  time_b: string | null;
  palpite_placar_b: RawScore;
  oficial_placar_a: RawScore;
  oficial_placar_b: RawScore;
  pontuacao: number;
};

export type Participant = {
  numero_tabela: number;
  aba: string;
  nome: string;
  pontuacao_total: number;
  classificacao: string;
  palpites: Guess[];
};

export type BolaoFile = {
  metadata: {
    arquivo_origem: string;
    gerado_em: string;
    abas_lidas: number;
    total_participantes: number;
    total_jogos: number;
    observacao?: string;
  };
  resultados_oficiais: OfficialMatch[];
  participantes: Participant[];
};

export type MatchStatus = "finished" | "live" | "scheduled" | "pending";

export type EnrichedMatch = OfficialMatch & {
  placar_a_num: number | null;
  placar_b_num: number | null;
  status: MatchStatus;
  minuto: number | null;
  clock: string | null;
  isLive: boolean;
  displayDate: string;
  displayTime: string;
  sourceLabel: string;
};

export type RankingEntry = {
  position: number;
  previousPosition: number | null;
  numero_tabela: number;
  nome: string;
  aba: string;
  pontos: number;
  pontosPlanilha: number;
  exatos: number;
  acertosResultado: number;
  jogosPontuados: number;
  variacao: number | null;
  ultimoJogoPontuado: number | null;
};

export type ParticipantGuessDetail = Guess & {
  palpite_placar_a_num: number | null;
  palpite_placar_b_num: number | null;
  oficial_placar_a_num: number | null;
  oficial_placar_b_num: number | null;
  pontuacao_recalculada: number;
  status: MatchStatus;
  displayDate: string;
  displayTime: string;
  sourceLabel: string;
};

export type ParticipantDetail = {
  metadata: DashboardData["metadata"];
  participant: RankingEntry;
  guesses: ParticipantGuessDetail[];
};

export type DashboardData = {
  metadata: BolaoFile["metadata"] & {
    generatedAt: string;
    liveProvider: string;
    liveEnabled: boolean;
  };
  summary: {
    participantes: number;
    jogos: number;
    jogosFinalizados: number;
    jogosAoVivo: number;
    jogosPendentes: number;
    lider: RankingEntry | null;
  };
  matches: EnrichedMatch[];
  ranking: RankingEntry[];
};
