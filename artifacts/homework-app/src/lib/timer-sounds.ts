export const TIMER_SOUNDS = [
  { id: "bell", labelAr: "جرس كلاسيكي", labelEn: "Classic Bell" },
  { id: "chime", labelAr: "رنين ناعم", labelEn: "Soft Chime" },
  { id: "gong", labelAr: "قرع عميق", labelEn: "Deep Gong" }
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

    if (id === "bell") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
      
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 1);
      
      setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} }, 1100);
    } else if (id === "chime") {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc.type = "sine";
      osc2.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc2.frequency.setValueAtTime(1600, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      
      osc.connect(gain);
      osc2.connect(gain);
      osc.start(); osc2.start();
      osc.stop(ctx.currentTime + 1.5);
      osc2.stop(ctx.currentTime + 1.5);
      
      setTimeout(() => { try { osc.disconnect(); osc2.disconnect(); gain.disconnect(); } catch (e) {} }, 1600);
    } else if (id === "gong") {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 2);
      
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 2);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.5);
      
      osc.connect(filter);
      filter.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 2.5);
      
      setTimeout(() => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch (e) {} }, 2600);
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
