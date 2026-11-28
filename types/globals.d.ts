/** Safari before 14.1 exposes Web Audio under a prefixed name. */
interface Window {
  webkitAudioContext?: typeof AudioContext;
}
