// Texts for the app window, the page and the console, in English and
// Brazilian Portuguese.
// To add a language, add it to LANGS and give it a full copy of both tables.

export const LANGS = ["en", "pt-BR"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = { en: "English", "pt-BR": "Português (Brasil)" };

const en = {
  locale: "en-US",
  decimal: ".",
  title: "Match history",
  unranked: "Unranked",
  lead: (since: string, updated: string) => `runs saved since ${since} · last check ${updated}`,
  tip: "The game only shows your last ~10 runs. Keep the app open while you play (or open it at least every 10 runs) so none get lost; with it open, each run also gets its own MMR change.",
  accountWinRate: "Account win rate",
  winsInGames: (wins: number, games: number) => `${wins} wins in ${games} games, as in the in-game ranking`,
  rankedRuns: "Ranked runs",
  plusAbandoned: (n: number) => `+ ${n} abandoned`,
  avgBadges: "Average badges",
  last20: (x: string) => `last 20: ${x}`,
  tenBadges: "Runs with 10 badges",
  rankedUp: "Ranked up",
  rankedUpHint: "runs with 6+ badges",
  rankNet: "Rank gained/lost",
  rankNetHint: "sum of (badges − 5) per run",
  roundsWon: "Rounds won",
  roundsWonHint: "badges / rounds played",
  worstTitle: "Your worst comps",
  worstLead: (min: number) =>
    `The ones with the lowest average badges, with ${min}+ runs. A negative rank balance means the comp made you drop.`,
  noWorst: (min: number) => `No comp with ${min}+ runs yet.`,
  compsTitle: "Your comps",
  compsLead: "Grouped by 3 core Batomon.",
  trainerTitle: "By trainer",
  monsterTitle: "By Batomon",
  monsterLead: "Runs where the Batomon was in the final team.",
  mmrTitle: "MMR",
  chartEmpty: "The chart shows up after a few checks with your MMR changing.",
  chartLabel: (lo: number, hi: number) => `MMR from ${lo} to ${hi}`,
  dayTitle: "By day",
  runsTitle: "All runs",
  notEnough: "Not enough runs yet.",
  others: "Others (teams that showed up once)",
  thComp: "Comp",
  thRuns: "Runs",
  thAvgBadges: "Avg. badges",
  thTen: "10 badges",
  thUp: "Ranked up",
  thNet: "Rank +/−",
  thTrainer: "Trainer",
  thBatomon: "Batomon",
  thDay: "Day",
  thWhen: "When",
  thTeam: "Final team",
  thBadges: "Badges",
  thRank: "Rank",
  thLosses: "Losses",
  thRounds: "Rounds",
  abandoned: "Abandoned",
  footer: (at: string) =>
    `Generated ${at}. Data from the unofficial Batomon Showdown game API (berrymint). Fan-made tool, not affiliated with berrymint.`,

  // App window
  appTitle: "Batomon Match History",
  tabComps: "Best comps",
  tabTrainers: "Trainers",
  tabHistory: "My history",
  statusWatching: (last: string) => `Saving your runs while this window is open · last check ${last}`,
  statusChecking: "Checking your profile...",
  statusError: (msg: string, next: string) => `Could not reach the game API (${msg}). Trying again at ${next}.`,
  statusSetup: "Pick your account to start saving your runs.",
  checkNow: "Check now",
  toastRun: (trainer: string, badges: number, mmr: string) => `Run saved: ${trainer}, ${badges} badges${mmr}`,
  toastAbandoned: (trainer: string) => `Run saved: ${trainer}, abandoned`,
  metaTitle: "Best comps right now",
  metaLead: (runs: number, players: number, season: number, days: number, updated: string) =>
    `${runs} runs from the top ${players} players of season ${season}, last ${days} days · updated ${updated}`,
  metaMissing: "The stats could not be downloaded yet. Check your internet connection; the app tries again every 30 minutes.",
  metaHow:
    "Grouped by 3 core Batomon. Score: 70% share of 10-badge runs + 30% average badges. Only comps with 40+ runs from 25+ players get a tier.",
  regionAll: "All regions",
  regionLabel: "Region",
  regionHow:
    "The game does not record the region of a run, so it is worked out from the final team: Batomon found only in Pantra or only in Jinto. Batomon found in both count for neither.",
  filterLabel: "Filter by Batomon or trainer",
  filterPlaceholder: "e.g. Dracana, Gamer",
  noTier: "No tier yet (small sample)",
  noMatch: "No comp matches that.",
  thTier: "Tier",
  thTopTrainers: "Top trainers",
  thPlayers: "Players",
  thPlayRate: "Play rate",
  trainersTitle: "Trainers right now",
  trainersLead:
    "How each trainer does in the runs of the top players. \"Picked when offered\" counts every rank: how often players take the trainer when the game offers it.",
  thPickRate: "Picked when offered",
  thYou: "You (avg. badges)",
  youCell: (avg: string, runs: number) => `${avg} in ${runs} ${runs === 1 ? "run" : "runs"}`,
  setupTitle: "Welcome!",
  setupLead:
    "Type your in-game name (or your 15-character player ID) to find your account. Your runs are saved only on this computer.",
  setupSearch: "Search",
  setupShortcut: "Create a desktop shortcut",
  setupPick: "Click your account:",
  setupSaving: "Saving...",
  setupFailed: "Something went wrong:",

  // Console
  chooseLang: "Language / Idioma:",
  pickOption: "Type a number and press Enter: ",
  askName: "Your in-game name (or your 15-character player ID): ",
  tooShort: "Type at least 3 letters.",
  searching: "Searching (a name search can take up to a minute)...",
  noneFound: "No account found with that name. Check the spelling and try again.",
  foundMany: "Found these accounts:",
  pickAccount: "Type the number of your account, or just press Enter to search again: ",
  confirmAccount: (desc: string) => `Is this you?  ${desc}\n[Y/n] `,
  games: (n: number) => `${n} games`,
  noName: "(no name)",
  saved: (name: string) => `Account saved: ${name}`,
  askShortcut: "Create a desktop shortcut to open the app? [Y/n] ",
  shortcutCreated: (link: string) => `Shortcut created: ${link}`,
  shortcutOnlyWindows: "The desktop shortcut only works on Windows.",
  syncResult: (added: number, total: number) => `${added} new run(s), ${total} saved in total.`,
  runLine: (trainer: string, badges: number) => `${trainer}: ${badges} badges`,
  runAbandoned: (trainer: string) => `${trainer}: abandoned`,
  pageAt: (file: string) => `Page: ${file}`,
  dataAt: (dir: string) => `Your data is saved in ${dir}`,
  closing: "This window closes in 15 seconds (or press Enter).",
  pressEnter: "Press Enter to close.",
  apiDown: (msg: string) => `Could not reach the Batomon API (${msg}). Check your internet connection and try again.`,
  profileGone: (id: string) => `Profile ${id} was not found in the game API.`,
  noHistory: "There is no history yet. Run a sync first.",
  noConfig: "Pick your account first (run without arguments, or use: setup \"Your Name\").",
  imported: (n: number, file: string) => `Imported ${n} run(s) from ${file}.`,
  badFile: (file: string) => `${file} is not a history.json file.`,
  usage: `Usage: BatomonMatchHistory [command]
  (no command)        open the app window: saves your runs while it is open
                      and shows the best comps and trainers
  setup "Name" | ID   pick the account
  sync                fetch new runs and rebuild the page
  report              rebuild the page only
  open                open the page
  shortcut            create the desktop shortcut (Windows)
  lang en | pt-BR     change the language
  import <file>       merge a history.json from elsewhere`,
};

type Texts = typeof en;

const ptBR: Texts = {
  locale: "pt-BR",
  decimal: ",",
  title: "Histórico de partidas",
  unranked: "Sem rank",
  lead: (since, updated) => `runs guardadas desde ${since} · última consulta ${updated}`,
  tip: "O jogo só mostra as suas ~10 últimas runs. Deixe o app aberto enquanto joga (ou abra pelo menos a cada 10 runs) para nenhuma se perder; com ele aberto, cada run também ganha a sua variação de MMR.",
  accountWinRate: "Win rate da conta",
  winsInGames: (wins, games) => `${wins} vitórias em ${games} partidas, como no ranking do jogo`,
  rankedRuns: "Runs ranqueadas",
  plusAbandoned: (n) => `+ ${n} abandonadas`,
  avgBadges: "Média de insígnias",
  last20: (x) => `últimas 20: ${x}`,
  tenBadges: "Runs com 10 insígnias",
  rankedUp: "Subiu o rank",
  rankedUpHint: "runs com 6+ insígnias",
  rankNet: "Rank ganho/perdido",
  rankNetHint: "soma de (insígnias − 5) por run",
  roundsWon: "Rodadas ganhas",
  roundsWonHint: "insígnias / rodadas jogadas",
  worstTitle: "Suas piores comps",
  worstLead: (min) =>
    `As de menor média de insígnias, com ${min}+ runs. Saldo negativo de rank quer dizer que a comp te fez cair.`,
  noWorst: (min) => `Nenhuma comp com ${min}+ runs ainda.`,
  compsTitle: "Suas comps",
  compsLead: "Agrupadas por 3 Batomon centrais.",
  trainerTitle: "Por trainer",
  monsterTitle: "Por Batomon",
  monsterLead: "Runs em que o Batomon estava no time final.",
  mmrTitle: "MMR",
  chartEmpty: "O gráfico aparece depois de algumas consultas com o MMR mudando.",
  chartLabel: (lo, hi) => `MMR de ${lo} a ${hi}`,
  dayTitle: "Por dia",
  runsTitle: "Todas as runs",
  notEnough: "Ainda sem runs suficientes.",
  others: "Outras (times que apareceram 1 vez)",
  thComp: "Comp",
  thRuns: "Runs",
  thAvgBadges: "Média de insígnias",
  thTen: "10 insígnias",
  thUp: "Subiu rank",
  thNet: "Rank ganho/perdido",
  thTrainer: "Trainer",
  thBatomon: "Batomon",
  thDay: "Dia",
  thWhen: "Quando",
  thTeam: "Time final",
  thBadges: "Insígnias",
  thRank: "Rank",
  thLosses: "Derrotas",
  thRounds: "Rodadas",
  abandoned: "Abandonada",
  footer: (at) =>
    `Gerado em ${at}. Dados da API não oficial do Batomon Showdown (berrymint). Ferramenta feita por fã, sem ligação com a berrymint.`,

  appTitle: "Batomon Match History",
  tabComps: "Melhores comps",
  tabTrainers: "Trainers",
  tabHistory: "Meu histórico",
  statusWatching: (last) => `Salvando suas runs enquanto esta janela estiver aberta · última consulta ${last}`,
  statusChecking: "Consultando seu perfil...",
  statusError: (msg, next) => `Não consegui acessar a API do jogo (${msg}). Tento de novo às ${next}.`,
  statusSetup: "Escolha sua conta para começar a salvar suas runs.",
  checkNow: "Atualizar agora",
  toastRun: (trainer, badges, mmr) => `Run salva: ${trainer}, ${badges} insígnias${mmr}`,
  toastAbandoned: (trainer) => `Run salva: ${trainer}, abandonada`,
  metaTitle: "Melhores comps agora",
  metaLead: (runs, players, season, days, updated) =>
    `${runs} runs dos top ${players} jogadores da temporada ${season}, últimos ${days} dias · atualizado ${updated}`,
  metaMissing: "Ainda não consegui baixar as estatísticas. Confira sua internet; o app tenta de novo a cada 30 minutos.",
  metaHow:
    "Agrupadas por 3 Batomon centrais. Nota: 70% taxa de runs com 10 insígnias + 30% média de insígnias. Só ganham tier as comps com 40+ runs de 25+ jogadores.",
  regionAll: "Todas as regiões",
  regionLabel: "Região",
  regionHow:
    "O jogo não registra a região da run, então ela é deduzida do time final: Batomon que só aparecem em Pantra ou só em Jinto. Os que aparecem nas duas não contam.",
  filterLabel: "Filtrar por Batomon ou trainer",
  filterPlaceholder: "ex.: Dracana, Gamer",
  noTier: "Sem tier ainda (amostra pequena)",
  noMatch: "Nenhuma comp com isso.",
  thTier: "Tier",
  thTopTrainers: "Trainers mais usados",
  thPlayers: "Jogadores",
  thPlayRate: "Uso",
  trainersTitle: "Trainers agora",
  trainersLead:
    "Como cada trainer se sai nas runs dos melhores jogadores. \"Escolhido quando oferecido\" conta todos os ranks: quantas vezes os jogadores pegam o trainer quando o jogo oferece.",
  thPickRate: "Escolhido quando oferecido",
  thYou: "Você (média de insígnias)",
  youCell: (avg, runs) => `${avg} em ${runs} ${runs === 1 ? "run" : "runs"}`,
  setupTitle: "Boas-vindas!",
  setupLead:
    "Digite seu nome no jogo (ou o seu ID de jogador de 15 caracteres) para achar sua conta. Suas runs ficam salvas só neste computador.",
  setupSearch: "Procurar",
  setupShortcut: "Criar atalho na área de trabalho",
  setupPick: "Clique na sua conta:",
  setupSaving: "Salvando...",
  setupFailed: "Algo deu errado:",

  chooseLang: "Language / Idioma:",
  pickOption: "Digite um número e aperte Enter: ",
  askName: "Seu nome no jogo (ou o seu ID de jogador de 15 caracteres): ",
  tooShort: "Digite pelo menos 3 letras.",
  searching: "Procurando (a busca por nome pode levar até um minuto)...",
  noneFound: "Nenhuma conta com esse nome. Confira como está escrito e tente de novo.",
  foundMany: "Achei estas contas:",
  pickAccount: "Digite o número da sua conta, ou só aperte Enter para procurar de novo: ",
  confirmAccount: (desc) => `É você?  ${desc}\n[S/n] `,
  games: (n) => `${n} partidas`,
  noName: "(sem nome)",
  saved: (name) => `Conta salva: ${name}`,
  askShortcut: "Criar um atalho na área de trabalho para abrir o app? [S/n] ",
  shortcutCreated: (link) => `Atalho criado: ${link}`,
  shortcutOnlyWindows: "O atalho na área de trabalho só funciona no Windows.",
  syncResult: (added, total) => `${added} run(s) nova(s), ${total} guardadas no total.`,
  runLine: (trainer, badges) => `${trainer}: ${badges} insígnias`,
  runAbandoned: (trainer) => `${trainer}: abandonada`,
  pageAt: (file) => `Página: ${file}`,
  dataAt: (dir) => `Seus dados ficam em ${dir}`,
  closing: "Esta janela fecha em 15 segundos (ou aperte Enter).",
  pressEnter: "Aperte Enter para fechar.",
  apiDown: (msg) => `Não consegui acessar a API do Batomon (${msg}). Confira sua internet e tente de novo.`,
  profileGone: (id) => `O perfil ${id} não foi encontrado na API do jogo.`,
  noHistory: "Ainda não há histórico. Faça um sync antes.",
  noConfig: "Escolha a conta antes (rode sem argumentos, ou use: setup \"Seu Nome\").",
  imported: (n, file) => `Importadas ${n} run(s) de ${file}.`,
  badFile: (file) => `${file} não é um arquivo history.json.`,
  usage: `Uso: BatomonMatchHistory [comando]
  (sem comando)       abre a janela do app: salva suas runs enquanto estiver
                      aberta e mostra as melhores comps e trainers
  setup "Nome" | ID   escolhe a conta
  sync                busca as runs novas e gera a página
  report              só gera a página de novo
  open                abre a página
  shortcut            cria o atalho na área de trabalho (Windows)
  lang en | pt-BR     troca o idioma
  import <arquivo>    junta um history.json de outro lugar`,
};

export const TEXTS: Record<Lang, Texts> = { en, "pt-BR": ptBR };

export function isLang(value: unknown): value is Lang {
  return LANGS.includes(value as Lang);
}

/** Language guess from the system, used as the default choice. */
export function systemLang(): Lang {
  const locale = process.env.LANG ?? Intl.DateTimeFormat().resolvedOptions().locale ?? "";
  return locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}
