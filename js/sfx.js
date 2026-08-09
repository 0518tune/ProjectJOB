/* =========================================================
 * ProjectJOB — 절차적 효과음(SFX) 모듈
 * ---------------------------------------------------------
 * 외부 오디오 파일 없이 Web Audio API 오실레이터로 짧은
 * UI 효과음을 즉석 합성한다. 브라우저 자동재생 정책 때문에
 * AudioContext는 첫 사용자 제스처(클릭 등) 시점에 지연 생성한다.
 * ========================================================= */

const SFX = {
  _ctx: null,
  _muted: false,

  _ac() {
    if (this._muted) return null;
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this._ctx = new AC();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },

  /** tone(주파수 Hz, 길이 s, 파형, 게인, 시작지연 s) 하나를 재생 */
  _tone(freq, dur, type = 'sine', gain = 0.12, delay = 0) {
    const ctx = this._ac();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  hover() { this._tone(720, 0.05, 'sine', 0.045); },
  click() { this._tone(320, 0.09, 'triangle', 0.09); this._tone(540, 0.07, 'triangle', 0.06, 0.02); },
  select() { this._tone(480, 0.12, 'square', 0.05); },
  coin() {
    this._tone(880, 0.08, 'square', 0.08);
    this._tone(1320, 0.14, 'square', 0.07, 0.06);
  },
  success() {
    [660, 880, 1108].forEach((f, i) => this._tone(f, 0.16, 'triangle', 0.08, i * 0.07));
  },
  warn() {
    this._tone(220, 0.14, 'sawtooth', 0.07);
    this._tone(180, 0.18, 'sawtooth', 0.06, 0.08);
  },
  pop() { this._tone(900, 0.06, 'sine', 0.05); },

  setMuted(m) { this._muted = m; },
};
