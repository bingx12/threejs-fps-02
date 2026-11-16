// Sound, synthesised with WebAudio: no audio files, no network. Gunshots are a
// noise burst through a low-pass plus a thump; the rest are small oscillators
// and filtered noise. Distance attenuates by 1 / (1 + d / 18).
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 0.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
    }
    return !!ctx;
  }

  function noise(dur, freq, gain, when = 0, type = 'lowpass', q = 1) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, gain, type = 'sine', slideTo = null, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function at(dist) {
    return dist == null ? 1 : Math.max(0.08, 1 / (1 + dist / 18));
  }

  return {
    unlock() { ensure(); },
    shot(kind, dist) {
      const v = at(dist);
      if (kind === 'dmr12') {
        noise(0.22, 900, 0.9 * v);
        tone(160, 0.18, 0.5 * v, 'sine', 55);
      } else if (kind === 'ar77') {
        noise(0.13, 1400, 0.7 * v);
        tone(190, 0.1, 0.35 * v, 'sine', 70);
      } else if (kind === 'vk9') {
        noise(0.09, 1800, 0.55 * v);
        tone(220, 0.07, 0.25 * v, 'sine', 90);
      } else {
        noise(0.11, 1600, 0.6 * v);
        tone(200, 0.08, 0.3 * v, 'sine', 80);
      }
    },
    dryFire() { tone(1200, 0.03, 0.08, 'square'); },
    reload() {
      tone(900, 0.04, 0.12, 'square');
      tone(700, 0.04, 0.12, 'square', null, 0.28);
      tone(1100, 0.04, 0.14, 'square', null, 0.62);
    },
    hit(kill) {
      tone(kill ? 1500 : 1100, 0.06, 0.16, 'sine');
      if (kill) tone(1900, 0.08, 0.14, 'sine', null, 0.06);
    },
    hurt() {
      noise(0.18, 500, 0.35, 0, 'lowpass');
      tone(120, 0.18, 0.3, 'sine', 60);
    },
    step() { noise(0.07, 3000, 0.05, 0, 'highpass'); },
    plantBeep(final) {
      tone(final ? 1600 : 1000, final ? 0.3 : 0.08, 0.2, 'sine');
    },
    explosion(dist) {
      const v = at(dist);
      noise(0.9, 300, 1.0 * v);
      tone(90, 0.8, 0.7 * v, 'sine', 28);
    },
    flash() {
      noise(0.5, 6000, 0.5, 0, 'highpass');
      tone(2400, 0.3, 0.12, 'sine', 900);
    },
    roundWin() {
      tone(523, 0.14, 0.2, 'triangle');
      tone(659, 0.14, 0.2, 'triangle', null, 0.14);
      tone(784, 0.28, 0.22, 'triangle', null, 0.28);
    },
    roundLose() {
      tone(392, 0.16, 0.18, 'triangle');
      tone(330, 0.16, 0.18, 'triangle', null, 0.16);
      tone(262, 0.34, 0.2, 'triangle', null, 0.32);
    },
    buy() { tone(880, 0.06, 0.14, 'sine'); tone(1320, 0.08, 0.12, 'sine', null, 0.06); },
    denied() { tone(220, 0.12, 0.16, 'square'); },
    click() { tone(1000, 0.03, 0.1, 'sine'); },
  };
}
