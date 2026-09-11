export const TIMER_SOUNDS = [
  { id: "chime", labelAr: "نسمة هادئة", labelEn: "Gentle breeze" },
  { id: "wood", labelAr: "نقرة خشبية", labelEn: "Soft wood" },
  { id: "breeze", labelAr: "رنين دافئ", labelEn: "Warm chime" },
] as const;

let audioCtx: AudioContext | null = null;

export function initAudioContext() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

export function playTimerSound(id: string, volume: number) {
  if (volume <= 0) return;
  
  const ctx = initAudioContext();
  if (!ctx) return;

  try {
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);

    if (id === "wood") {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.42);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume * 0.32, ctx.currentTime + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.48);
      
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      
      setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} }, 550);
    } else if (id === "breeze") {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc.type = "sine";
      osc2.type = "sine";
      osc.frequency.setValueAtTime(392, ctx.currentTime);
      osc2.frequency.setValueAtTime(523.25, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume * 0.22, ctx.currentTime + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
      
      osc.connect(gain);
      osc2.connect(gain);
      osc.start(); osc2.start();
      osc.stop(ctx.currentTime + 1.85);
      osc2.stop(ctx.currentTime + 1.85);
      
      setTimeout(() => { try { osc.disconnect(); osc2.disconnect(); gain.disconnect(); } catch (e) {} }, 1950);
    } else {
      const frequencies = [440, 554.37, 659.25];
      frequencies.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        const start = ctx.currentTime + index * 0.18;
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, start);
        noteGain.gain.setValueAtTime(0, start);
        noteGain.gain.linearRampToValueAtTime(volume * 0.16, start + 0.07);
        noteGain.gain.exponentialRampToValueAtTime(0.001, start + 0.85);
        osc.connect(noteGain);
        noteGain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.9);
        setTimeout(() => { try { osc.disconnect(); noteGain.disconnect(); } catch (e) {} }, 1400);
      });
      gain.disconnect();
    }
  } catch (e) {
    // ignore audio failure
  }
}

export function playControlSound(type: "start" | "pause", volume: number) {
  if (volume <= 0) return;
  const ctx = initAudioContext();
  if (!ctx) return;
  try {
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.3;
    gain.connect(ctx.destination);
    
    const osc = ctx.createOscillator();
    osc.type = "sine";
    if (type === "start") {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    } else {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    }
    gain.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} }, 200);
  } catch (e) {}
}

export function playMilestoneSound(type: "warning" | "tick", volume: number) {
  if (volume <= 0) return;
  const ctx = initAudioContext();
  if (!ctx) return;
  try {
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.4;
    gain.connect(ctx.destination);
    
    const osc = ctx.createOscillator();
    osc.type = type === "warning" ? "triangle" : "sine";
    
    if (type === "warning") {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume * 0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} }, 500);
    } else {
      osc.frequency.setValueAtTime(783.99, ctx.currentTime);
      gain.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} }, 150);
    }
  } catch (e) {}
}

export function playLapSound(volume: number) {
  if (volume <= 0) return;
  const ctx = initAudioContext();
  if (!ctx) return;
  try {
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.4;
    gain.connect(ctx.destination);
    
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(volume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} }, 150);
  } catch (e) {}
}
