// Texts for the page and the console, in English and Brazilian Portuguese.
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
  tip: "The game only shows your last ~10 runs. Open the shortcut at least every 10 runs so none get lost, and between runs to see the MMR of each one.",
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

  // Console
  chooseLang: "Language / Idioma:",
  pickOption: "Type a number and press Enter: ",
  askName: "Your in-game name (or your 15-character player ID): ",
  tooShort: "Type at least 3 letters.",
  searching: "Searching...",
  noneFound: "No account found with that name. Check the spelling and try again.",
  foundMany: "Found these accounts:",
  pickAccount: "Type the number of your account, or just press Enter to search again: ",
  confirmAccount: (desc: string) => `Is this you?  ${desc}\n[Y/n] `,
  games: (n: number) => `${n} games`,
  noName: "(no name)",
  saved: (name: string) => `Account saved: ${name}`,
  askShortcut: "Create a desktop shortcut? Click it before (and after) playing to update your history. [Y/n] ",
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
  (no command)        first-time setup if needed, then sync and open the page
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
  tip: "O jogo só mostra as suas ~10 últimas runs. Abra o atalho pelo menos a cada 10 runs para nenhuma se perder, e entre uma run e outra para ver o MMR de cada uma.",
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

  chooseLang: "Language / Idioma:",
  pickOption: "Digite um número e aperte Enter: ",
  askName: "Seu nome no jogo (ou o seu ID de jogador de 15 caracteres): ",
  tooShort: "Digite pelo menos 3 letras.",
  searching: "Procurando...",
  noneFound: "Nenhuma conta com esse nome. Confira como está escrito e tente de novo.",
  foundMany: "Achei estas contas:",
  pickAccount: "Digite o número da sua conta, ou só aperte Enter para procurar de novo: ",
  confirmAccount: (desc) => `É você?  ${desc}\n[S/n] `,
  games: (n) => `${n} partidas`,
  noName: "(sem nome)",
  saved: (name) => `Conta salva: ${name}`,
  askShortcut: "Criar um atalho na área de trabalho? Clique nele antes (e depois) de jogar para atualizar o histórico. [S/n] ",
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
  (sem comando)       configura na primeira vez, depois atualiza e abre a página
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
