# Bolao Copa 2026

Aplicacao web em Next.js para acompanhar o bolao atual, placares oficiais e ranking geral.

## Como rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Dados

- `bolao_copa_2026.json`: importacao original da planilha.

A aplicacao exibe os jogos ja definidos da fase de 16 avos de final. Placar nao e editado manualmente: o ranking e recalculado a partir dos placares retornados pelo provedor automatico e dos palpites dos participantes.

## Placar ao vivo

Por padrao, a aplicacao consulta automaticamente o scoreboard publico da ESPN para a competicao `fifa.world`, que retorna placar, status e relogio do jogo sem chave de API.

Opcionalmente, para usar API-FOOTBALL/API-SPORTS como provedor, crie um `.env` com:

```bash
API_FOOTBALL_KEY=sua_chave
API_FOOTBALL_LEAGUE_ID=1
API_FOOTBALL_SEASON=2026
```

O adaptador fica isolado em `lib/live-scores.ts`. A FIFA e a fonte oficial de conferencia do calendario, mas nao ha documentacao publica estavel de API oficial da FIFA neste projeto.

## Pontuacao

- 9 pontos: placar exato.
- 7 pontos: resultado correto com um dos placares exato.
- 5 pontos: resultado correto.
- 2 pontos: um placar exato, mas sem acertar o resultado.
- 0 pontos: demais casos ou jogo sem resultado.
