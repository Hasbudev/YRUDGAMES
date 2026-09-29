// Lightweight synthesized SFX so the spectacle beats have sound before real
// audio assets exist. Swap for Howler-loaded clips once Rudy provides real SFX/OST.

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType, startGain = 0.15, delay = 0) {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const startAt = audioCtx.currentTime + delay;
  gain.gain.setValueAtTime(startGain, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

export function playCorrect() {
  tone(660, 0.12, "sine", 0.15, 0);
  tone(990, 0.18, "sine", 0.15, 0.08);
}

export function playWrong() {
  tone(220, 0.25, "sawtooth", 0.12, 0);
  tone(140, 0.3, "sawtooth", 0.1, 0.05);
}

export function playElimination() {
  tone(440, 0.15, "square", 0.1, 0);
  tone(330, 0.15, "square", 0.1, 0.08);
  tone(180, 0.35, "square", 0.12, 0.16);
}

export function playTaunt() {
  tone(520, 0.2, "triangle", 0.14, 0);
  tone(390, 0.25, "triangle", 0.14, 0.1);
}

// Placeholder "OST clip" — a short synthesized motif standing in for a real
// licensed audio clip (Question.mediaUrl, once Rudy provides one).
export function playMelody(notes: { freq: number; durationMs: number }[]) {
  let delay = 0;
  for (const note of notes) {
    tone(note.freq, note.durationMs / 1000, "sine", 0.18, delay);
    delay += note.durationMs / 1000;
  }
}

export function playPrankSting() {
  tone(80, 0.4, "sawtooth", 0.22, 0);
  tone(1200, 0.08, "square", 0.16, 0);
  tone(900, 0.1, "square", 0.14, 0.06);
}

export function playCrit() {
  tone(1200, 0.06, "square", 0.16, 0);
  tone(1600, 0.08, "square", 0.16, 0.05);
  tone(900, 0.2, "sawtooth", 0.14, 0.1);
}

export function playDuelHit() {
  tone(700, 0.1, "sine", 0.16, 0);
  tone(1000, 0.08, "sine", 0.12, 0.05);
}

export function playDuelMiss() {
  tone(200, 0.3, "sawtooth", 0.15, 0);
}

export function playDuelWin() {
  tone(523, 0.15, "sine", 0.16, 0);
  tone(659, 0.15, "sine", 0.16, 0.12);
  tone(784, 0.25, "sine", 0.16, 0.24);
}

// Chasse-taupes tap — short, so rapid taps don't pile into mush.
export function playWhack(good: boolean) {
  if (good) tone(880, 0.07, "square", 0.08, 0);
  else tone(180, 0.15, "sawtooth", 0.1, 0);
}

// Robotic "Google Translate" voice — the browser's own speech synthesis,
// preferring a Google French voice (Chrome's "Google français") when there
// is one. Silently does nothing on a browser without speech synthesis.
// Browsers load their voice list lazily — ask for it early so the first
// line doesn't go out before the French voice is known.
if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();

export function speakFrench(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("fr"));
  utterance.voice = voices.find((v) => /google/i.test(v.name)) ?? voices[0] ?? null;
  utterance.rate = 1;
  utterance.pitch = 1;
  synth.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
