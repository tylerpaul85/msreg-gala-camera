// Synthesized authentic 1970s Polaroid Land / OneStep camera acoustics using Web Audio API

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
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.025);

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

    for (let i = 0; i < 7; i++) {
      const toothTime = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440 + i * 45, toothTime);
      osc.frequency.exponentialRampToValueAtTime(90, toothTime + 0.02);

      gain.gain.setValueAtTime(0.18, toothTime);
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
 * Iconic Xenon Flash Inverter Charging Whine (1970s/80s electronic strobe)
 * Rising high-pitch tone from ~1.2kHz to ~4.6kHz over 2 seconds
 */
export function playFlashChargingWhine(isMuted: boolean = false): () => void {
  if (isMuted) return () => {};

  try {
    const ctx = getAudioContext();
    if (!ctx) return () => {};
    const now = ctx.currentTime;
    const duration = 2.1;

    // High frequency charging oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Secondary oscillator for the converter harmonics/whine
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(4500, now + duration);

    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(2200, now);
    osc2.frequency.exponentialRampToValueAtTime(9000, now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.2);
    gain.gain.setValueAtTime(0.08, now + duration - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.03, now + 0.3);
    gain2.gain.setValueAtTime(0.03, now + duration - 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration);
    osc2.stop(now + duration);

    // Return a stop function if user snaps early
    return () => {
      try {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        setTimeout(() => {
          osc.stop();
          osc2.stop();
        }, 60);
      } catch {}
    };
  } catch (err) {
    console.warn("Flash audio bypass:", err);
    return () => {};
  }
}

/**
 * Authentic Polaroid Camera Shutter & Electric Motor Drive Sound
 * Real Polaroid (SX-70 / 600 / OneStep) sound breakdown:
 * 1. Shutter trip: Fast mechanical solenoid "KA-CHIK" (0-60ms)
 * 2. Instant electric motor spin-up (60-700ms):
 *    - Gritty DC motor whine with gear train harmonics (240Hz-310Hz)
 *    - Mechanical gear teeth friction noise (bandpassed noise)
 *    - Chemical pod breaking "squish-roll" transient at 180ms
 * 3. Final mechanical roller latch release "CLACK-TINK" at 720ms
 */
export function playPolaroidShutterSound(isMuted: boolean = false) {
  if (isMuted) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // ── 1. Solenoid Shutter Snap: "KA-CHIK" (0ms - 55ms) ──
    // Click 1 (Blade open)
    const click1 = ctx.createOscillator();
    const clickGain1 = ctx.createGain();
    click1.type = "sine";
    click1.frequency.setValueAtTime(800, now);
    click1.frequency.exponentialRampToValueAtTime(120, now + 0.03);
    clickGain1.gain.setValueAtTime(0.5, now);
    clickGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    click1.connect(clickGain1);
    clickGain1.connect(ctx.destination);
    click1.start(now);
    click1.stop(now + 0.04);

    // Click 2 (Blade close - 22ms later)
    const click2 = ctx.createOscillator();
    const clickGain2 = ctx.createGain();
    click2.type = "triangle";
    click2.frequency.setValueAtTime(620, now + 0.022);
    click2.frequency.exponentialRampToValueAtTime(100, now + 0.055);
    clickGain2.gain.setValueAtTime(0.45, now + 0.022);
    clickGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    click2.connect(clickGain2);
    clickGain2.connect(ctx.destination);
    click2.start(now + 0.022);
    click2.stop(now + 0.06);

    // Metallic shutter strike noise
    const snapBufSize = ctx.sampleRate * 0.05;
    const snapBuf = ctx.createBuffer(1, snapBufSize, ctx.sampleRate);
    const snapData = snapBuf.getChannelData(0);
    for (let i = 0; i < snapBufSize; i++) snapData[i] = Math.random() * 2 - 1;
    const snapNoise = ctx.createBufferSource();
    snapNoise.buffer = snapBuf;
    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = "bandpass";
    snapFilter.frequency.value = 3200;
    snapFilter.Q.value = 4.0;
    const snapNoiseGain = ctx.createGain();
    snapNoiseGain.gain.setValueAtTime(0.4, now);
    snapNoiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    snapNoise.connect(snapFilter);
    snapFilter.connect(snapNoiseGain);
    snapNoiseGain.connect(ctx.destination);
    snapNoise.start(now);
    snapNoise.stop(now + 0.05);

    // ── 2. The Iconic Electric Gear Motor & Rollers: "KZZZZZZH-WHURRRRR" (65ms - 720ms) ──
    const motorStart = now + 0.065;
    const motorDuration = 0.68; // ~680ms motor run

    // Motor fundamental tone
    const motor1 = ctx.createOscillator();
    const motor2 = ctx.createOscillator();
    const motorGain = ctx.createGain();

    motor1.type = "sawtooth";
    motor1.frequency.setValueAtTime(260, motorStart);
    // Slight motor pitch sag as rollers engage the stiff film card
    motor1.frequency.linearRampToValueAtTime(245, motorStart + 0.15);
    motor1.frequency.linearRampToValueAtTime(280, motorStart + motorDuration * 0.7);
    motor1.frequency.linearRampToValueAtTime(250, motorStart + motorDuration);

    motor2.type = "square";
    motor2.frequency.setValueAtTime(520, motorStart);
    motor2.frequency.linearRampToValueAtTime(490, motorStart + 0.15);
    motor2.frequency.linearRampToValueAtTime(560, motorStart + motorDuration * 0.7);
    motor2.frequency.linearRampToValueAtTime(500, motorStart + motorDuration);

    // Filter to give that authentic plastic/metal gearbox resonance
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = "bandpass";
    motorFilter.frequency.setValueAtTime(1100, motorStart);
    motorFilter.Q.value = 2.5;

    motorGain.gain.setValueAtTime(0.001, motorStart);
    motorGain.gain.linearRampToValueAtTime(0.35, motorStart + 0.04);
    motorGain.gain.setValueAtTime(0.32, motorStart + motorDuration - 0.08);
    motorGain.gain.exponentialRampToValueAtTime(0.001, motorStart + motorDuration);

    motor1.connect(motorFilter);
    motor2.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(ctx.destination);

    motor1.start(motorStart);
    motor2.start(motorStart);
    motor1.stop(motorStart + motorDuration);
    motor2.stop(motorStart + motorDuration);

    // Gritty gear-teeth friction noise (continuous roller mechanical texture)
    const gearBufSize = ctx.sampleRate * motorDuration;
    const gearBuf = ctx.createBuffer(1, gearBufSize, ctx.sampleRate);
    const gearData = gearBuf.getChannelData(0);
    for (let i = 0; i < gearBufSize; i++) {
      // Modulate noise to mimic spinning gear teeth
      const mod = Math.sin(i / 18) * 0.5 + 0.5;
      gearData[i] = (Math.random() * 2 - 1) * mod;
    }

    const gearNoise = ctx.createBufferSource();
    gearNoise.buffer = gearBuf;
    const gearFilter = ctx.createBiquadFilter();
    gearFilter.type = "bandpass";
    gearFilter.frequency.value = 1600;
    gearFilter.Q.value = 2.0;

    const gearGain = ctx.createGain();
    gearGain.gain.setValueAtTime(0.001, motorStart);
    gearGain.gain.linearRampToValueAtTime(0.25, motorStart + 0.05);
    gearGain.gain.setValueAtTime(0.22, motorStart + motorDuration - 0.08);
    gearGain.gain.exponentialRampToValueAtTime(0.001, motorStart + motorDuration);

    gearNoise.connect(gearFilter);
    gearFilter.connect(gearGain);
    gearGain.connect(ctx.destination);
    gearNoise.start(motorStart);
    gearNoise.stop(motorStart + motorDuration);

    // ── 3. Chemical Pod Crush Transient at ~200ms: "CRUNCH-POP" ──
    const podTime = motorStart + 0.16;
    const podOsc = ctx.createOscillator();
    const podGain = ctx.createGain();
    podOsc.type = "triangle";
    podOsc.frequency.setValueAtTime(140, podTime);
    podOsc.frequency.exponentialRampToValueAtTime(40, podTime + 0.08);
    podGain.gain.setValueAtTime(0.3, podTime);
    podGain.gain.exponentialRampToValueAtTime(0.001, podTime + 0.08);
    podOsc.connect(podGain);
    podGain.connect(ctx.destination);
    podOsc.start(podTime);
    podOsc.stop(podTime + 0.09);

    // ── 4. Final Film Release Latch Clunk at ~750ms: "CHUNK" ──
    const latchTime = motorStart + motorDuration;
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = "sine";
    latchOsc.frequency.setValueAtTime(320, latchTime);
    latchOsc.frequency.exponentialRampToValueAtTime(60, latchTime + 0.05);
    latchGain.gain.setValueAtTime(0.4, latchTime);
    latchGain.gain.exponentialRampToValueAtTime(0.001, latchTime + 0.06);
    latchOsc.connect(latchGain);
    latchGain.connect(ctx.destination);
    latchOsc.start(latchTime);
    latchOsc.stop(latchTime + 0.07);
  } catch (err) {
    console.warn("Audio shutter effect bypassed:", err);
  }
}
