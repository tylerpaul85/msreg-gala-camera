// Synthesized authentic 1970s instant camera acoustics using Web Audio API

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Tactile analog switch / lever click
 */
export function playLeverClick(isMuted: boolean = false) {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.025);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  } catch (err) {
    console.warn("Audio bypass:", err);
  }
}

/**
 * Mechanical rotary ratcheting sound when film cartridge is loaded
 */
export function playWindingSound(isMuted: boolean = false) {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Series of 6 micro-ratchet teeth
    for (let i = 0; i < 6; i++) {
      const toothTime = now + i * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(500 + i * 40, toothTime);
      osc.frequency.exponentialRampToValueAtTime(100, toothTime + 0.02);

      gain.gain.setValueAtTime(0.15, toothTime);
      gain.gain.exponentialRampToValueAtTime(0.001, toothTime + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(toothTime);
      osc.stop(toothTime + 0.03);
    }
  } catch (err) {
    console.warn("Audio bypass:", err);
  }
}

/**
 * Iconic 1970s instant camera shutter & electric roller ejection motor sound:
 * 1. Shutter trip snap (0ms - 40ms)
 * 2. Mirror slap thud (50ms - 90ms)
 * 3. Electric gear motor whirr as film ejects through chemical rollers (100ms - 750ms)
 */
export function playShutterAndMotorSound(isMuted: boolean = false) {
  if (isMuted) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Shutter Trip Snap (Sine + Noise burst)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(360, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.04);
    gain1.gain.setValueAtTime(0.45, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.05);

    // Friction burst
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2200;
    filter.Q.value = 3.0;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.055);

    // 2. Mirror Slap Thud (at 60ms)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(160, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(45, now + 0.12);
    gain2.gain.setValueAtTime(0.4, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.14);

    // 3. Electric Roller Ejection Motor (120ms to 750ms)
    // Complex tone simulating tiny DC motor gearing + spreading rollers
    const motorTime = now + 0.12;
    const motorDuration = 0.65; // ~650ms ejection motor cycle

    const motorOsc1 = ctx.createOscillator();
    const motorOsc2 = ctx.createOscillator();
    const motorGain = ctx.createGain();

    motorOsc1.type = "sawtooth";
    motorOsc1.frequency.setValueAtTime(140, motorTime);
    motorOsc1.frequency.linearRampToValueAtTime(165, motorTime + motorDuration * 0.4);
    motorOsc1.frequency.linearRampToValueAtTime(130, motorTime + motorDuration);

    motorOsc2.type = "square";
    motorOsc2.frequency.setValueAtTime(280, motorTime);
    motorOsc2.frequency.linearRampToValueAtTime(330, motorTime + motorDuration * 0.4);
    motorOsc2.frequency.linearRampToValueAtTime(260, motorTime + motorDuration);

    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = "lowpass";
    motorFilter.frequency.setValueAtTime(800, motorTime);
    motorFilter.frequency.exponentialRampToValueAtTime(400, motorTime + motorDuration);

    motorGain.gain.setValueAtTime(0.001, motorTime);
    motorGain.gain.linearRampToValueAtTime(0.25, motorTime + 0.05);
    motorGain.gain.setValueAtTime(0.22, motorTime + motorDuration - 0.08);
    motorGain.gain.exponentialRampToValueAtTime(0.001, motorTime + motorDuration);

    motorOsc1.connect(motorFilter);
    motorOsc2.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(ctx.destination);

    motorOsc1.start(motorTime);
    motorOsc2.start(motorTime);
    motorOsc1.stop(motorTime + motorDuration);
    motorOsc2.stop(motorTime + motorDuration);
  } catch (err) {
    console.warn("Audio shutter effect bypassed:", err);
  }
}
