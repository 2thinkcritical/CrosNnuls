/** Public browser settings from docs/config.js. Blank values mean standalone play. */
interface TicTacToeConfig {
  readonly WORKER_URL: string;
  readonly BOT_USERNAME: string;
}

interface Window {
  TICTACTOE_CONFIG?: TicTacToeConfig;
  webkitAudioContext?: typeof AudioContext;
}
