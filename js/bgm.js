/* =========================================================
 * ProjectJOB — 절차적 배경음악(BGM) 모듈
 * ---------------------------------------------------------
 * 외부 음원 없이 Web Audio API로 잔잔한 배경음을 합성한다.
 *  · 패드: 4마디 코드 진행(Cmaj7 → Am7 → Fmaj7 → G6), 마디당 4.8초
 *  · 멜로디: 펜타토닉 음을 마디마다 2~3개, 낮은 확률로 띄엄띄엄
 *  · 피드백 딜레이로 잔향을 만들고 로우패스로 고음을 깎는다
 * 브라우저 자동재생 정책 때문에 첫 클릭 · 키 입력 시점에 시작한다.
 * 켜짐/꺼짐은 localStorage('pj_bgm')에 저장한다. 기본값: 켜짐.
 * ========================================================= */

const BGM = {
  _ctx: null,
  _master: null,
  _bus: null,
  _timer: null,
  _bar: 0,
  _nextAt: 0,
  _on: true,
  _started: false,
  BAR_SEC: 4.8,
  VOLUME: 0.07,

  // 코드 진행 (Hz). 낮은 음역 위주로 쌓아 배경에 깔리게 한다.
  CHORDS: [
    [130.81, 196.0, 246.94, 329.63],   // Cmaj7
    [110.0, 164.81, 196.0, 261.63],    // Am7
    [87.31, 174.61, 220.0, 329.63],    // Fmaj7
    [98.0, 146.83, 196.0, 246.94],     // G6
  ],
  // 멜로디 후보 (C 메이저 펜타토닉, 한 옥타브 위)
  MELODY: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5],

  init() {
    try { this._on = localStorage.getItem('pj_bgm') !== 'off'; } catch (e) { /* 저장소 차단 시 기본값 */ }
    this._button();
    const kick = () => {
      if (this._on) this.start();
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    document.addEventListener('visibilitychange', () => {
      if (!this._ctx) return;
      if (document.hidden) this._ctx.suspend();
      else if (this._on) this._ctx.resume();
    });
  },

  _graph() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this._ctx = new AC());
    this._master = ctx.createGain();
    this._master.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    // 잔향: 짧은 피드백 딜레이 두 줄
    const dl = ctx.createDelay(1.0), fb = ctx.createGain(), wet = ctx.createGain();
    dl.delayTime.value = 0.42; fb.gain.value = 0.38; wet.gain.value = 0.35;
    this._bus = ctx.createGain();
    this._bus.connect(lp);
    lp.connect(this._master);
    lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(this._master);
    this._master.connect(ctx.destination);
    return true;
  },

  start() {
    if (!this._ctx && !this._graph()) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();
    const now = this._ctx.currentTime;
    this._master.gain.cancelScheduledValues(now);
    this._master.gain.setValueAtTime(this._master.gain.value, now);
    this._master.gain.linearRampToValueAtTime(this.VOLUME, now + 2.5);
    if (!this._started) {
      this._started = true;
      this._nextAt = now + 0.1;
      this._tick();
      this._timer = setInterval(() => this._tick(), 1000);
    }
  },

  stop() {
    if (!this._ctx) return;
    const now = this._ctx.currentTime;
    this._master.gain.cancelScheduledValues(now);
    this._master.gain.setValueAtTime(this._master.gain.value, now);
    this._master.gain.linearRampToValueAtTime(0, now + 0.8);
  },

  // 앞으로 6초 안에 시작할 마디를 미리 예약한다
  _tick() {
    const ctx = this._ctx;
    while (this._nextAt < ctx.currentTime + 6) {
      this._playBar(this._nextAt, this.CHORDS[this._bar % this.CHORDS.length]);
      this._nextAt += this.BAR_SEC;
      this._bar++;
    }
  },

  _playBar(t0, chord) {
    const dur = this.BAR_SEC + 1.2;           // 다음 마디와 살짝 겹쳐 끊김 없이
    chord.forEach((f, i) => {
      this._voice(f, t0, dur, 'sine', 0.22 - i * 0.03, 1.6);
      this._voice(f * 1.003, t0, dur, 'triangle', 0.05, 1.8);   // 살짝 어긋난 음으로 두께
    });
    const notes = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let k = 0; k < notes; k++) {
      if (Math.random() < 0.3) continue;      // 비워 두는 박자
      const f = this.MELODY[Math.floor(Math.random() * this.MELODY.length)];
      const at = t0 + 0.6 + k * (this.BAR_SEC / 3) + Math.random() * 0.3;
      this._voice(f, at, 2.2, 'sine', 0.09, 0.02);
    }
  },

  _voice(freq, t0, dur, type, gain, attack) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setTargetAtTime(0, t0 + dur - 1.2, 0.45);
    osc.connect(g).connect(this._bus);
    osc.start(t0);
    osc.stop(t0 + dur + 1.5);
  },

  toggle() {
    this._on = !this._on;
    try { localStorage.setItem('pj_bgm', this._on ? 'on' : 'off'); } catch (e) { /* 무시 */ }
    if (this._on) this.start(); else this.stop();
    this._label();
  },

  _button() {
    const b = document.createElement('button');
    b.id = 'bgm-toggle';
    b.type = 'button';
    b.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:9999;padding:7px 12px;border-radius:999px;' +
      'border:1px solid rgba(0,0,0,.12);background:rgba(255,255,255,.88);backdrop-filter:blur(6px);' +
      'font:600 12px/1 Pretendard,"Malgun Gothic",sans-serif;color:#333;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08)';
    b.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
    document.body.appendChild(b);
    this._btn = b;
    this._label();
  },

  _label() {
    if (!this._btn) return;
    this._btn.textContent = this._on ? '♪ 음악 켜짐' : '♪ 음악 꺼짐';
    this._btn.setAttribute('aria-pressed', String(this._on));
    this._btn.setAttribute('aria-label', this._on ? '배경 음악 끄기' : '배경 음악 켜기');
  },
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => BGM.init());
else BGM.init();
