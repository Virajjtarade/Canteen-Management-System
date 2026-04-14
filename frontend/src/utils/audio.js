function createOscillator(ctx, type, frequency, duration, startTime) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = frequency;
  o.connect(g);
  g.connect(ctx.destination);
  
  // Envelope for a clean sound without pops
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(0.1, startTime + 0.05); // Attack
  // Decay / Release based on duration
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  
  o.start(startTime);
  o.stop(startTime + duration + 0.1);
}

export function playCookBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    // High-pitched attention beep
    createOscillator(ctx, 'triangle', 880, 0.4, ctx.currentTime);
  } catch (e) { /* ignore */ }
}

export function playServerBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    // Double chime (Middle C -> E) simulating a service bell
    createOscillator(ctx, 'sine', 523.25, 0.3, ctx.currentTime);
    createOscillator(ctx, 'sine', 659.25, 0.4, ctx.currentTime + 0.25);
  } catch (e) { /* ignore */ }
}

export function playCustomerBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    // Pleasant ding-dong (A5 -> F#5) for a friendly notification
    createOscillator(ctx, 'sine', 880.0, 0.3, ctx.currentTime);
    createOscillator(ctx, 'sine', 739.99, 0.5, ctx.currentTime + 0.3);
  } catch (e) { /* ignore */ }
}
