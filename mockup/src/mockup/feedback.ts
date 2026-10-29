// Calm, local-only feedback: short tones (WebAudio), light vibration and
// optional spoken words. Everything respects the adult's master switches.
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, gain = 0.08) {
  if (typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch {
    /* audio unavailable */
  }
}

export const playPop = () => tone(660, 0, 0.12, 0.05);
export const playChime = () => {
  tone(523, 0, 0.5);
  tone(659, 0.12, 0.5);
  tone(784, 0.24, 0.7);
};
export const vibrate = (ms = 12) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};
export const say = (text: string) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
};
