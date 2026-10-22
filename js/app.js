/* =========================================================
 * ProjectJOB — Game State Machine & UI Controller (Phase 3)
 * ---------------------------------------------------------
 * data.js(30개 직업/퀘스트/테마) · csv.js(대량 데이터) ·
 * avatar.js(캐릭터) · room.js(룸 빌더)와 분리된 엔진 코드입니다.
 * ========================================================= */

/* ---------------------------------------------------------
 * 1. 영속 상태 (localStorage) — v3 스키마 + v2 마이그레이션
 * ------------------------------------------------------- */
const Storage = {
  KEY: 'projectjob_save_v3',
  LEGACY_V2: 'projectjob_save_v2',

  defaults() {
    return {
      avatar: { created: false, skin: 0, hair: 0, hairColor: 0, outfit: 0, costume: null },
      records: {},        // jobId -> 최근 기록 (앨범용)
      history: [],        // 전체 지원 이력 (시간순)
      unlocked: [],       // 가구/장식/테마/코스튬 id 통합
      room: { theme: 'theme_default', size: 5, wall: 0, walls: { 0: {}, 1: {}, 2: {}, 3: {} } },
      nickname: '탐험가' + String(Math.floor(Math.random() * 900) + 100),
      gold: 0,
      sincerity: 100,
      resignCount: 0,
      clears: 0,          // 완주 누적
      deepCount: 0,       // 심화 클리어 누적
      adGate: {},         // jobId -> 재취업 광고 게이트 만료 ts
      settings: { mode: 'light' },
      board: { date: '', jobIds: [], rerolls: 3 }, // 오늘의 3개 직업 매칭
      quests: [],         // 달성한 히든 퀘스트 id
      // 소셜: 친구/공개 설정 + 내 친구 코드 + 한 줄 공지 + 방명록(내 방 댓글) + sent(내가 친구 방에 남긴 댓글)
      social: { friends: [], private: false, myCode: '', notice: '', guestbook: [], sent: {} },
    };
  },

  load() {
    const d = this.defaults();
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          ...d, ...p,
          avatar: { ...d.avatar, ...p.avatar },
          room: { ...d.room, ...p.room, walls: (p.room && p.room.walls) || d.room.walls },
          settings: { ...d.settings, ...p.settings },
          board: { ...d.board, ...p.board },
          social: { ...d.social, ...p.social },
        };
      }
      const v2 = localStorage.getItem(this.LEGACY_V2);
      if (v2) return this.migrateV2(JSON.parse(v2), d);
    } catch (e) {
      console.warn('세이브 로드 실패, 새로 시작합니다.', e);
    }
    return d;
  },

  migrateV2(v2, d) {
    const s = { ...d };
    s.records = v2.records || {};
    s.history = Object.values(s.records);
    s.unlocked = v2.unlocked || [];
    s.nickname = v2.nickname || d.nickname;
    s.gold = v2.gold || 0;
    s.sincerity = v2.sincerity != null ? v2.sincerity : 100;
    s.resignCount = v2.resignCount || 0;
    s.adGate = v2.adGate || {};
    s.settings = { ...d.settings, ...v2.settings };
    s.room.theme = THEMES.some((t) => t.id === (v2.room && v2.room.theme)) ? v2.room.theme : 'theme_default';
    s.clears = s.history.filter((r) => !r.resigned && r.completed >= r.total).length;
    s.deepCount = s.history.filter((r) => r.deep).length;
    this.save(s);
    return s;
  },

  save(state) {
    localStorage.setItem(this.KEY, JSON.stringify(state));
  },
};

let SAVE = Storage.load();

/* ---------------------------------------------------------
 * 2. 성향 벡터 & 유사도 (AI 추천)
 * ------------------------------------------------------- */
const Similar = {
  jobVec(job) {
    if (job._vec) return job._vec;
    let v = { ...(job.traitProfile || {}) };
    if (!Object.keys(v).length) {
      // traitProfile이 없으면(CSV 직업) 시나리오 선택지에서 자동 추출
      for (const mode of Object.values(job.modes)) {
        for (const sc of mode.scenarios) {
          for (const ch of sc.choices) {
            for (const [k, val] of Object.entries(ch.effects.traits || {})) {
              if (val > 0) v[k] = (v[k] || 0) + val;
            }
          }
        }
      }
    }
    job._vec = v;
    return v;
  },

  cos(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let dot = 0, na = 0, nb = 0;
    for (const k of keys) {
      const x = a[k] || 0, y = b[k] || 0;
      dot += x * y; na += x * x; nb += y * y;
    }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  },

  userVec() {
    const v = {};
    for (const h of SAVE.history) {
      for (const [k, val] of Object.entries((h.stats && h.stats.traits) || {})) {
        if (val > 0) v[k] = (v[k] || 0) + val;
      }
    }
    return Object.keys(v).length ? v : null;
  },

  /** 현재 보드 3개 중 추천 인덱스 (-1이면 추천 없음) */
  recommendIdx(jobIds) {
    const uv = this.userVec();
    if (!uv) return -1;
    let best = -1, bestSim = 0.15;
    jobIds.forEach((id, i) => {
      const job = findJob(id);
      if (!job) return;
      const sim = this.cos(uv, this.jobVec(job));
      if (sim > bestSim) { bestSim = sim; best = i; }
    });
    return best;
  },

  /** 과거에 해본 직업 중 가장 유사한 것 → {name, pct} */
  similarPlayed(job) {
    let best = null, bestSim = 0.35;
    for (const playedId of Object.keys(SAVE.records)) {
      if (playedId === job.id) continue;
      const played = findJob(playedId);
      if (!played) continue;
      const sim = this.cos(this.jobVec(job), this.jobVec(played));
      if (sim > bestSim) { bestSim = sim; best = { name: played.name, pct: Math.round(sim * 100) }; }
    }
    return best;
  },
};

/* ---------------------------------------------------------
 * 2.5 100점 만점 취업 점수 산정
 *     완주율 40 + 성과 35 + 멘탈 관리 15 + 끈기 10 (+심화 5)
 * ------------------------------------------------------- */
const Score = {
  compute(r) {
    const completed = r.completed || 0;
    const total = r.total || 1;
    if (!completed) return 0;
    const s = r.stats || { performance: 0, stress: 0, patience: 0 };
    const comp = completed / total;
    const perf = Math.min(1, (s.performance || 0) / (completed * 2));
    const calm = Math.min(1, Math.max(0, 1 - (s.stress || 0) / (completed * 2.5)));
    const pat = Math.min(1, (s.patience || 0) / (completed * 1.5));
    let score = comp * 40 + perf * 35 + calm * 15 + pat * 10;
    if (r.deep) score += 5;
    if (r.resigned && completed < 3) score = Math.min(score, 25); // 조기 퇴사 상한
    return Math.max(0, Math.min(100, Math.round(score)));
  },
  /** 과거(점수 없던 시절) 기록도 동일 공식으로 환산 */
  of(h) { return h.score != null ? h.score : this.compute(h); },
};

/* ---------------------------------------------------------
 * 3. 게임 엔진
 * ------------------------------------------------------- */
const Engine = {
  run: null,

  startRun(jobId) {
    const job = findJob(jobId);
    const mode = SAVE.settings.mode;
    this.run = {
      job, mode,
      scenarios: job.modes[mode].scenarios,
      index: 0, phase: 'narration', nIdx: 0,
      stats: { performance: 0, stress: 0, patience: 0, traits: {} },
      log: [],
    };
    const sc = this.run.scenarios[0];
    if (!sc.narration || !sc.narration.length) this.run.phase = 'choices';
    return this.run;
  },

  get scenario() { return this.run.scenarios[this.run.index]; },

  advanceNarration() {
    const r = this.run;
    if (r.nIdx < this.scenario.narration.length - 1) r.nIdx += 1;
    else r.phase = 'choices';
  },

  /** 선택 적용 → 즉시 넘어가지 않고 'feedback' 단계로 전환 (NPC 실시간 피드백 연출) */
  applyChoice(choiceIdx) {
    const r = this.run;
    const sc = this.scenario;
    const choice = sc.choices[choiceIdx];
    const fx = choice.effects;
    r.stats.performance += fx.performance || 0;
    r.stats.stress += fx.stress || 0;
    r.stats.patience += fx.patience || 0;
    for (const [k, v] of Object.entries(fx.traits || {})) {
      r.stats.traits[k] = (r.stats.traits[k] || 0) + v;
    }
    r.log.push({ q: sc.q, choiceText: choice.text });
    r.lastChoice = choice;
    r.phase = 'feedback';
    return fx;
  },

  /** 피드백 확인 후 [다음] → 다음 시나리오로 진행 */
  proceed() {
    const r = this.run;
    r.lastChoice = null;
    r.index += 1;
    if (r.index < r.scenarios.length) {
      const next = r.scenarios[r.index];
      r.phase = next.narration && next.narration.length ? 'narration' : 'choices';
      r.nIdx = 0;
    }
  },

  get isFinished() { return this.run && this.run.index >= this.run.scenarios.length; },

  finishRun(resigned) {
    const { job, mode, index, stats, log, scenarios } = this.run;
    const completed = index;
    const total = scenarios.length;
    const ctx = { completed: Math.max(1, completed), mode };
    const isQuitterPenalty = resigned && completed < 3;
    const isFullClear = !resigned && completed >= total;

    let title;
    if (isQuitterPenalty) title = job.quitterTitle;
    else title = job.titles.find((t) => t.cond(stats, ctx)) || job.defaultTitle;

    const rewards = [];
    let gold = 0, sincerityDelta = 0;
    const deep = mode === 'realistic' && isFullClear && job.deepCond(stats, ctx);

    if (isQuitterPenalty) {
      sincerityDelta = -7;
      SAVE.sincerity = Math.max(0, SAVE.sincerity + sincerityDelta);
      SAVE.resignCount += 1;
    } else {
      gold = MODES[mode].gold;
      if (resigned) gold = Math.floor(gold / 2);
      const item = mode === 'light' ? job.decor : job.furniture;
      if (!SAVE.unlocked.includes(item.id)) {
        SAVE.unlocked.push(item.id);
        rewards.push({ kind: mode === 'light' ? 'decor' : 'furniture', ...item });
      }
      if (deep) gold += 100; // 심화 보너스 (테마는 히든 퀘스트로 이동)
      // 성공 엔딩 완주 → 캐릭터 코스튬 해금
      if (isFullClear && title.type === 'success' && job.costume && !SAVE.unlocked.includes(job.costume.id)) {
        SAVE.unlocked.push(job.costume.id);
        rewards.push({ kind: 'costume', ...job.costume });
      }
    }
    SAVE.gold += gold;
    if (isFullClear) SAVE.clears += 1;
    if (deep) SAVE.deepCount += 1;

    if (isQuitterPenalty || title.type === 'alt') {
      SAVE.adGate[job.id] = Date.now() + 5 * 60 * 1000;
    }

    const score = Score.compute({ completed, total, stats, deep, resigned });
    const record = {
      jobId: job.id, mode, score,
      titleId: title.id, titleName: title.name, titleDesc: title.desc,
      type: title.type, resigned, completed, total, stats, log, deep,
      date: new Date().toISOString(),
    };
    SAVE.records[job.id] = record;
    SAVE.history.push(record);

    /* --- 히든 퀘스트 판정 --- */
    const newQuests = [];
    for (const q of QUESTS) {
      if (!SAVE.quests.includes(q.id) && q.cond(SAVE)) {
        SAVE.quests.push(q.id);
        if (q.reward && !SAVE.unlocked.includes(q.reward)) SAVE.unlocked.push(q.reward);
        newQuests.push(q);
      }
    }

    Storage.save(SAVE);
    const result = { job, mode, title, record, rewards, gold, sincerityDelta, isQuitterPenalty, newQuests };
    this.run = null;
    return result;
  },
};

/* ---------------------------------------------------------
 * 4. 타자기(Typewriter) 연출
 * ------------------------------------------------------- */
const Type = {
  timer: null, el: null, full: '', html: null, active: false,

  start(el, text, html = null) {
    this.stop();
    this.el = el; this.full = text; this.html = html; this.active = true;
    el.textContent = '';
    let i = 0;
    this.timer = setInterval(() => {
      i += 1;
      el.textContent = this.full.slice(0, i);
      if (i >= this.full.length) this.finish();
    }, 26);
  },

  finish() {
    clearInterval(this.timer);
    if (this.el) {
      // 타이핑 완료 시 전문 용어 하이라이트 적용
      if (this.html) this.el.innerHTML = this.html;
      else this.el.textContent = this.full;
    }
    this.active = false;
  },

  stop() {
    clearInterval(this.timer);
    this.active = false;
  },
};

/* ---------------------------------------------------------
 * 4.5 전문 용어 하이라이트 & 툴팁 (TERMS 사전 기반)
 * ------------------------------------------------------- */
const Terms = {
  _re: undefined,

  regex() {
    if (this._re === undefined) {
      const keys = Object.keys(TERMS)
        .sort((a, b) => b.length - a.length)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
      this._re = keys.length ? new RegExp(keys.join('|'), 'g') : null;
    }
    return this._re;
  },

  /** 텍스트 속 전문 용어를 <span class="term">으로 감싼 HTML 반환 */
  highlight(text) {
    if (!text) return '';
    const re = this.regex();
    if (!re) return String(text);
    return String(text).replace(re, (m) => `<span class="term" data-term="${m}">${m}</span>`);
  },

  /** 전역 툴팁 바인딩 (호버 + 클릭 모두 지원) */
  bind() {
    const tip = document.querySelector('#term-tip');
    const show = (el) => {
      const term = el.dataset.term;
      if (!TERMS[term]) return;
      tip.innerHTML = `<b>💡 ${term}</b>${TERMS[term]}`;
      tip.classList.remove('hidden');
      const r = el.getBoundingClientRect();
      const left = Math.min(window.innerWidth - 262, Math.max(12, r.left));
      tip.style.left = left + 'px';
      if (r.bottom > window.innerHeight - 150) {
        tip.style.top = '';
        tip.style.bottom = (window.innerHeight - r.top + 8) + 'px';
      } else {
        tip.style.bottom = '';
        tip.style.top = (r.bottom + 8) + 'px';
      }
    };
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest && e.target.closest('.term');
      if (t) show(t);
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest && e.target.closest('.term')) tip.classList.add('hidden');
    });
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('.term');
      if (t) show(t); else tip.classList.add('hidden');
    }, true);
  },
};

/* ---------------------------------------------------------
 * 5. UI 컨트롤러
 * ------------------------------------------------------- */
const $ = (sel) => document.querySelector(sel);
const todayStr = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD

const UI = {
  currentTab: 'jobs',
  _locked: false,
  _questQueue: [],
  _albumQuery: '',
  _albumCompact: false,
  _histSort: 'new',
  _dirKey: null,      // 현재 연출이 걸린 컷 키 (job|index|phase) — 중복 재생 방지
  _dirPreset: null,   // 현재 재생 중인 연출 프리셋 ID
  _dirNote: false,    // 기획 패널 표시 여부
  _panelTab: 'cue',   // 기획 패널 탭: cue | data | flow

  init() {
    CSVLoader.restore();
    Terms.bind();
    this.ensureBoard();
    this.scheduleMidnightReset();
    this.bindTabs();
    this.bindKeys();
    this.bindSfxHover();
    this.renderHeader();
    this.renderAll();
    // 캐릭터 만들기는 타이틀 화면을 닫은 직후에 첫 화면으로 띄운다 (TitleScreen.hide).
    // init 시점에 열면 타이틀 뒤에 가려진 채로 떠 있게 된다.
  },

  /* ------------ 키보드 조작 (잡보드 WASD/방향키·R 리롤 · 시나리오 1~3·Enter) ------------ */
  _sel: 1, // 잡보드에서 현재 서 있는 길 (0~2)

  bindKeys() {
    document.addEventListener('keydown', (e) => {
      if ((e.target && e.target.closest && e.target.closest('input,textarea,select')) || e.altKey || e.ctrlKey || e.metaKey) return;
      // 오프닝/타이틀 화면이 떠 있는 동안에는 게임 조작키를 받지 않는다
      if (typeof TitleScreen !== 'undefined' && TitleScreen.visible) return;
      if (document.getElementById('opening')) return;
      const k = e.key.toLowerCase();
      // 모달이 열려 있으면 Esc 닫기만 허용
      if (!$('#modal-backdrop').classList.contains('hidden')) {
        if (k === 'escape') this.closeModal();
        return;
      }
      // 게임(시나리오) 진행 중: 1~3 선택 · Enter 다음
      if (Engine.run) {
        const r = Engine.run;
        if (r.phase === 'choices' && ['1', '2', '3'].includes(e.key)) {
          e.preventDefault();
          if (Engine.scenario.choices[+e.key - 1]) this.choose(+e.key - 1);
        } else if (k === 'enter' || k === ' ') {
          e.preventDefault();
          if (r.phase === 'narration') this.nextNarration();
          else if (r.phase === 'feedback') this.afterFeedback();
        }
        return;
      }
      // 잡보드: WASD/방향키 이동 · Enter/W 입장 · R 리롤
      if (this.currentTab !== 'jobs') return;
      if (k === 'r') { e.preventDefault(); this.reroll(); return; }
      if (['a', 'arrowleft'].includes(k)) { e.preventDefault(); this.moveSel(-1); }
      else if (['d', 'arrowright'].includes(k)) { e.preventDefault(); this.moveSel(1); }
      else if (['w', 'arrowup', 'enter'].includes(k)) { e.preventDefault(); this.enterSel(); }
      else if (['s', 'arrowdown'].includes(k)) { e.preventDefault(); this.moveSel(0); } // 제자리 점프(위치 확인)
    });

    // 내레이션 · 피드백: 무대나 대화창 아무 곳이나 눌러도 다음으로 (버튼 · 용어 · 기획 패널은 제외)
    document.addEventListener('click', (e) => {
      const r = Engine.run;
      if (!r || (r.phase !== 'narration' && r.phase !== 'feedback')) return;
      const t = e.target;
      if (!t.closest || !t.closest('#game-frame .cine-stage, #game-frame .dialogue-box')) return;
      if (t.closest('button, a, .term')) return;
      if (r.phase === 'narration') this.nextNarration();
      else this.afterFeedback();
    });

    // 창 크기가 바뀌면 무대 높이를 다시 맞춘다
    window.addEventListener('resize', () => { if (Engine.run && !this._dirNote) this.applyPanelLayout(); });
  },

  /** 잡보드에서 좌우 이동 — 아바타가 선택한 트랙 입구로 걸어감 */
  moveSel(dir) {
    if (this._locked || Engine.run) return;
    const max = (SAVE.board.jobIds || []).length - 1;
    if (max < 0) return;
    this._sel = Math.min(max, Math.max(0, this._sel + dir));
    Scene3D.Board.previewWalk(this._sel);
  },

  enterSel() {
    if (this._locked || Engine.run) return;
    if (SAVE.board.jobIds[this._sel]) this.pickPath(this._sel);
  },

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  /** existingIds를 유지한 채 n개가 될 때까지 채운다.
   * 1순위: 미체험 직업 중 랜덤. 2순위(미체험 직업이 부족할 때만): 이미 체험한 직업도
   * 허용해 재도전 슬롯으로 채운다 — 잡보드가 절대 빈 슬롯 없이 항상 3개를 유지하게 한다. */
  fillJobSlots(existingIds, n) {
    const all = getAllJobs().map((j) => j.id);
    const played = new Set(Object.keys(SAVE.records));
    const ids = existingIds.slice();
    let pool = this.shuffle(all.filter((id) => !played.has(id) && !ids.includes(id)));
    while (ids.length < n && pool.length) ids.push(pool.shift());
    if (ids.length < n) {
      pool = this.shuffle(all.filter((id) => !ids.includes(id)));
      while (ids.length < n && pool.length) ids.push(pool.shift());
    }
    return ids;
  },

  /* ------------ 데일리 보드 & 자정 초기화 ------------ */
  ensureBoard(force = false) {
    if (force || SAVE.board.date !== todayStr()) {
      SAVE.board = { date: todayStr(), jobIds: this.pick3(), rerolls: 3 };
      Storage.save(SAVE);
      return;
    }
    // 이미 플레이한 직업은 보드에서 즉시 제거하고 새 직업으로 충원 (부족하면 재도전 슬롯으로 항상 3개 유지)
    const played = new Set(Object.keys(SAVE.records));
    const keep = SAVE.board.jobIds.filter((id) => !played.has(id) && findJob(id));
    if (keep.length !== SAVE.board.jobIds.length || keep.length < 3) {
      SAVE.board.jobIds = this.fillJobSlots(keep, 3);
      Storage.save(SAVE);
    }
  },

  pick3() {
    // 한 번이라도 플레이한 직업은 우선순위에서 밀리지만, 미체험 직업이 3개 미만이면
    // 재도전 슬롯으로 채워 잡보드가 항상 3개를 보여주게 한다.
    return this.fillJobSlots([], 3);
  },

  scheduleMidnightReset() {
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    setTimeout(() => {
      this.ensureBoard(true);
      this.toast('🌙 자정이 지났어요! 잡보드와 리롤 횟수가 초기화되었습니다.');
      if (this.currentTab === 'jobs' && !Engine.run) this.renderJobBoard();
      this.scheduleMidnightReset();
    }, mid - now);
  },

  reroll() {
    if (Engine.run) return;
    if (SAVE.board.rerolls > 0) {
      SAVE.board.rerolls -= 1;
      SAVE.board.jobIds = this.pick3();
      Storage.save(SAVE);
      this.fx('fx-dim');
      this.renderJobBoard();
      this.toast(`🔄 새로운 직업 3개가 도착했어요! (남은 리롤 ${SAVE.board.rerolls}회)`);
    } else {
      this.showAdModal({
        title: '📺 광고 시청 후 리롤 충전',
        desc: '오늘의 무료 리롤을 모두 사용했어요.<br/>짧은 광고를 보면 <b>리롤 3회</b>가 충전됩니다!',
        cta: '리롤 3회 충전받기',
        onDone: () => {
          SAVE.board.rerolls = 3;
          Storage.save(SAVE);
          this.renderJobBoard();
          this.toast('✅ 리롤 3회가 충전되었어요!');
        },
      });
    }
  },

  /* ------------ 공용: 광고 시뮬레이션 모달 ------------ */
  showAdModal({ title, desc, cta, onDone }) {
    $('#modal-content').innerHTML = `
      <div class="text-center">
        <h3 class="text-xl font-extrabold text-slate-800 mb-2">${title}</h3>
        <p class="text-sm text-slate-500 mb-4">${desc}</p>
        <div class="relative h-36 rounded-2xl overflow-hidden mb-4 flex items-center justify-center ad-shimmer">
          <div class="text-center text-white">
            <p class="text-3xl mb-1">🧃</p>
            <p class="text-sm font-extrabold drop-shadow">가상의 이온음료 "일하자몬" 광고 (목업)</p>
            <p class="text-[11px] opacity-80">지친 직장인의 원픽! 일하자몬~</p>
          </div>
          <span id="ad-count" class="absolute top-2.5 right-3 text-xs font-black bg-black/50 text-white px-2 py-1 rounded-full">5</span>
        </div>
        <button id="ad-done-btn" disabled
          class="w-full py-3 rounded-xl font-bold bg-slate-200 text-slate-400 transition mb-2 cursor-not-allowed">광고 시청 중…</button>
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">다음에 할게요</button>
      </div>`;
    this.openModal();

    let left = 5;
    clearInterval(this._adTimer);
    this._adTimer = setInterval(() => {
      left -= 1;
      const cnt = $('#ad-count');
      if (!cnt) { clearInterval(this._adTimer); return; }
      cnt.textContent = String(left);
      if (left <= 0) {
        clearInterval(this._adTimer);
        const btn = $('#ad-done-btn');
        btn.disabled = false;
        btn.textContent = '✅ ' + (cta || '계속하기');
        btn.className = 'w-full py-3 rounded-xl font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition mb-2';
        btn.onclick = () => { this.closeModal(); onDone(); };
      }
    }, 1000);
  },

  /* ------------ 화면 전환 이펙트 ------------ */
  fx(cls) {
    const el = $('#screen-fx');
    el.className = '';
    void el.offsetWidth; // 애니메이션 재시작
    el.classList.add(cls);
    setTimeout(() => (el.className = ''), 650);
  },

  /* ------------ 탭 ------------ */
  bindTabs() {
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
  },

  /** 선택지/잡보드 노드/탭 hover 시 짧은 효과음 (전역 위임 — 매 렌더마다 재바인딩 불필요) */
  bindSfxHover() {
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest && e.target.closest('.choice-btn, .road-3d-label, .tab-btn');
      if (t && t !== this._lastHoverEl) { this._lastHoverEl = t; SFX.hover(); }
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest && e.target.closest('.choice-btn, .road-3d-label, .tab-btn');
      if (t && t === this._lastHoverEl && (!e.relatedTarget || !t.contains(e.relatedTarget))) this._lastHoverEl = null;
    });
  },

  switchTab(tab) {
    if (Engine.run && tab !== 'jobs') {
      this.toast('근무 중에는 자리를 비울 수 없어요! (사직서 제출은 가능)');
      return;
    }
    if (tab !== 'jobs') Scene3D.Board.pause(); // 다른 탭에서는 3D 렌더 루프를 멈춰 자원 절약
    this.currentTab = tab;
    document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
    document.querySelectorAll('[data-tab]').forEach((b) => {
      // 색/모양은 코지 테마의 .tab-btn / .tab-on 이 담당한다 (index.html 테마 레이어)
      b.className = 'tab-btn flex-1 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5'
        + (b.dataset.tab === tab ? ' tab-on' : '');
    });
    this.renderAll();
  },

  renderAll() {
    this.renderJobBoard();
    this.renderHistory();
    RoomUI.render();
    this.renderAnalysis();
    this.renderAlbum();
  },

  renderHeader() {
    $('#gold-display').innerHTML = `${Icons.svg('coin', { size: 15 })}<span>${SAVE.gold}G</span>`;
    $('#avatar-btn').innerHTML = AvatarSVG.render(SAVE.avatar, 30);
  },

  toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('opacity-0', 'translate-y-2');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('opacity-0', 'translate-y-2'), 2600);
  },

  /* ==================== Tab 1: 잡보드 (삼갈래길) ==================== */
  renderJobBoard() {
    const stage = $('#road-wrap');
    const game = $('#game-view');
    if (Engine.run) {
      stage.classList.add('hidden');
      game.classList.remove('hidden');
      this.renderGame();
      return;
    }
    stage.classList.remove('hidden');
    game.classList.add('hidden');

    this.ensureBoard(); // 플레이한 직업은 즉시 새 직업으로 교체

    const mode = MODES[SAVE.settings.mode];
    const other = MODES[SAVE.settings.mode === 'light' ? 'realistic' : 'light'];
    const ids = SAVE.board.jobIds;

    if (!ids.length) {
      stage.innerHTML = `
        <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
          <p class="text-5xl mb-3">🎉</p>
          <p class="font-extrabold text-slate-700 mb-1">모든 직업을 경험했어요!</p>
          <p class="text-sm text-slate-400">지원 이력 탭에서 재취업하거나, 설정에서 CSV로 새 직업을 추가해 보세요.</p>
        </div>`;
      return;
    }

    /* --- 연출 배지 다각화: 추천🌟 / 새로운 도전🚀 / 흥미진진🔍 --- */
    const uv = Similar.userVec();
    let recIdx = -1, novIdx = -1;
    if (uv) {
      recIdx = Similar.recommendIdx(ids);
      let minSim = Infinity;
      ids.forEach((id, i) => {
        const job = findJob(id);
        if (!job || i === recIdx) return;
        const sim = Similar.cos(uv, Similar.jobVec(job));
        if (sim < minSim) { minSim = sim; novIdx = i; }
      });
    } else {
      novIdx = ids.length > 1 ? 1 : 0; // 데이터가 없으면 가운데 길에 도전 배지
    }
    const badgeFor = (i) => {
      if (SAVE.records[ids[i]]) return { t: '재도전 🔁', bg: 'linear-gradient(90deg,#a855f7,#6366f1)' };
      if (i === recIdx) return { t: '추천 🌟', bg: 'linear-gradient(90deg,#f59e0b,#f43f5e)' };
      if (i === novIdx) return { t: '새로운 도전 🚀', bg: 'linear-gradient(90deg,#6366f1,#0ea5e9)' };
      return { t: '흥미진진 🔍', bg: 'linear-gradient(90deg,#10b981,#14b8a6)' };
    };

    /* 3D 갈림길 씬에 얹을 직업 정보 라벨 (기존 road-plate/path-badge 마크업 재사용) */
    this._sel = Math.min(this._sel, ids.length - 1);
    const jobsArr = ids.map(findJob);
    const labelsHtml = ids.map((id, i) => {
      const job = findJob(id);
      if (!job) return '';
      const sim = Similar.similarPlayed(job);
      const gated = SAVE.adGate[id] && Date.now() < SAVE.adGate[id];
      const badge = badgeFor(i);
      return `
        <div class="path-badge" style="background:${badge.bg}">${badge.t}</div>
        <div class="road-plate" style="border-color:${job.color}">
          <p class="text-[15px] font-black text-slate-800 leading-tight flex items-center justify-center gap-1">${Icons.forJob(job, { size: 15, color: job.color })} ${job.name}</p>
          <p class="text-[11px] font-bold text-slate-500 leading-tight mt-0.5">${mode.emoji} <span class="ep-word">에피소드 </span>${job.modes[SAVE.settings.mode].scenarios.length}개${gated ? ' · 📺' : ''}</p>
          ${sim ? `<p class="text-[11px] font-bold text-indigo-500 leading-tight">🔗 ${sim.pct}% 유사</p>` : ''}
          <div class="road-enter">▶ 입장하기</div>
        </div>`;
    });

    stage.innerHTML = `
      <!-- 모드/리롤 컨트롤 바 -->
      <div class="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100 mb-2.5 flex-wrap gap-2.5">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="text-2xl shrink-0">${mode.emoji}</span>
          <div class="min-w-0">
            <p class="text-sm font-black text-slate-800 leading-tight">${mode.label}</p>
            <p class="text-[11px] text-slate-500 leading-tight max-w-md truncate" title="${mode.desc}">${mode.desc}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="UI.setMode('${other.key}')" class="board-btn board-btn-ghost">${other.emoji} ${other.short} 모드</button>
          <button onclick="UI.reroll()" class="board-btn ${SAVE.board.rerolls > 0 ? 'board-btn-leaf' : 'board-btn-honey'}">
            ${SAVE.board.rerolls > 0 ? `🔄 리롤 ${SAVE.board.rerolls}/3` : '📺 광고 보고 충전'}
          </button>
        </div>
      </div>

      <!-- 삼갈래길 3D 스테이지 -->
      <div class="road-stage" id="road-stage">
        <div id="road-3d-mount" style="position:absolute;inset:0;"></div>
        <p class="road-hint">⌨️ <b>A/D·←→</b> 이동 · <b>W/Enter</b> 입장 · <b>R</b> 리롤 <span class="opacity-70">(카드를 눌러도 돼요)</span></p>
      </div>`;

    Scene3D.Board.mount($('#road-3d-mount'), jobsArr, this._sel, labelsHtml, (i) => this.pickPath(i));
  },

  setMode(mode) {
    SAVE.settings.mode = mode;
    Storage.save(SAVE);
    this.renderJobBoard();
    this.toast(`${MODES[mode].emoji} ${MODES[mode].label}로 전환했어요!`);
  },

  /* --- 삼갈래길: 길 선택 → 걷기 → 입사 --- */
  pickPath(i) {
    if (this._locked || Engine.run) return;
    const jobId = SAVE.board.jobIds[i];
    if (SAVE.adGate[jobId] && Date.now() < SAVE.adGate[jobId]) {
      const job = findJob(jobId);
      this.showAdModal({
        title: '📺 광고 시청 후 입사하기',
        desc: `최근에 <b>${job.name}</b>을(를) 떠났군요.<br/>짧은 광고를 보고 나면 다시 도전할 수 있어요!`,
        cta: '시청 완료! 입사하기',
        onDone: () => {
          delete SAVE.adGate[jobId];
          Storage.save(SAVE);
          this.walkTo(i);
        },
      });
      return;
    }
    this.walkTo(i);
  },

  walkTo(i) {
    this._locked = true;
    Scene3D.Board.walkPlayerTo(i, 1250);
    setTimeout(() => {
      this._locked = false;
      this.fx('fx-flash');
      Engine.startRun(SAVE.board.jobIds[i]);
      this.renderJobBoard();
    }, 1250);
  },

  /* --- 커리어 인텔리전스 --- */
  careerHtml(job) {
    const c = job.career;
    const stars = '★'.repeat(c.outlook) + '☆'.repeat(5 - c.outlook);
    return `
      <div class="text-left bg-sky-50 border border-sky-100 rounded-2xl p-4">
        <p class="text-xs font-black text-sky-600 mb-2.5">📊 커리어 인텔리전스 — ${job.name}</p>
        <div class="flex flex-col gap-2 text-xs">
          <div><p class="font-bold text-slate-600">📜 필요 자격/자격증</p><p class="text-slate-500 mt-0.5">${Terms.highlight(c.certs)}</p></div>
          <div><p class="font-bold text-slate-600">⚖️ 시장 경쟁률</p><p class="text-slate-500 mt-0.5">${Terms.highlight(c.competition)}</p></div>
          <div><p class="font-bold text-slate-600">🔭 미래 전망 <span class="text-amber-500">${stars}</span></p><p class="text-slate-500 mt-0.5">${Terms.highlight(c.outlookText || '')}</p></div>
          <div><p class="font-bold text-slate-600">💰 평균 연봉</p><p class="text-slate-500 mt-0.5">${c.salary}</p></div>
          <div><p class="font-bold text-slate-600">🎤 면접 팁</p><p class="text-slate-500 mt-0.5">${Terms.highlight(c.interviewTip)}</p></div>
        </div>
      </div>`;
  },

  showCareer(jobId) {
    const job = findJob(jobId);
    $('#modal-content').innerHTML = `
      <div>
        <div class="text-center mb-3"><span class="inline-flex items-center justify-center w-14 h-14 rounded-2xl" style="background:${job.color}1c;color:${job.color}">${Icons.forJob(job, { size: 28, color: job.color })}</span></div>
        ${this.careerHtml(job)}
        <button onclick="UI.closeModal()" class="mt-4 w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">닫기</button>
      </div>`;
    this.openModal();
  },

  /* ==================== 게임 뷰 (비주얼 노벨 + NPC 동석 + 타자기) ==================== */
  /** 단계 라벨: 초반은 실무 투입, 이후는 돌발상황·딜레마 돌파 */
  stageOf(index, total) {
    const introSteps = total >= 5 ? 2 : 1;
    return index < introSteps
      ? { label: '실무 투입', emoji: '🛠️', color: '#0ea5e9', desc: '이 직업이 실제로 어떤 일을 하는지 부딪혀 보는 단계예요' }
      : { label: '딜레마 돌파', emoji: '⚡', color: '#8b5cf6', desc: '이 직업의 돌발상황과 냉혹한 딜레마를 겪는 단계예요' };
  },

  /** 시나리오별 출연 NPC (지정이 없으면 기본 캐스팅 순환) */
  npcFor(sc, index) {
    return (sc && sc.npc) || NPC_CAST[index % NPC_CAST.length];
  },

  /** 선택에 대한 NPC 실시간 피드백 대사 (직업 전용 팩 → 범용 순) */
  feedbackLine(choice, fx) {
    if (choice.fb) return choice.fb;
    const r = Engine.run;
    if (r && typeof BESPOKE_FB !== 'undefined' && BESPOKE_FB[r.job.id]) {
      const row = (BESPOKE_FB[r.job.id][r.mode] || [])[r.index];
      const i = Engine.scenario.choices.indexOf(choice);
      if (row && row[i]) return row[i];
    }
    const p = fx.performance || 0, st = fx.stress || 0, pa = fx.patience || 0;
    if (p >= 2 && st >= 2) return '대단한 승부수예요! 성과는 확실한데… 몸도 좀 챙기면서 해요. 😅';
    if (p >= 2) return '오, 이 감각! 기대 이상인데요? 성과가 눈에 띄게 올랐어요. 👏';
    if (st >= 2) return '허억, 그 방법은 꽤 고될 텐데… 그래도 책임감 하나는 인정할게요. 💦';
    if (pa >= 2) return '급하지 않게 차근차근. 이런 진득함이 실무에서 제일 무서운 무기예요.';
    return '나쁘지 않은 선택이에요. 당신다운 방식이네요. 다음 상황으로 가볼까요?';
  },

  renderGame() {
    const r = Engine.run;
    const { job, mode, index } = r;
    const sc = Engine.scenario;
    const total = r.scenarios.length;
    const pct = Math.round((index / total) * 100);
    const modeInfo = MODES[mode];
    const stage = this.stageOf(index, total);
    const npc = this.npcFor(sc, index);
    const isNarration = r.phase === 'narration';
    const isFeedback = r.phase === 'feedback';

    const prevLines = (sc.narration || [])
      .slice(0, isNarration ? r.nIdx : (sc.narration || []).length)
      .map((line) => `<p class="text-sm leading-relaxed text-slate-500">${Terms.highlight(line)}</p>`)
      .join('');

    let bodyHtml;
    if (isNarration) {
      bodyHtml = `
        <div class="min-h-[56px] flex flex-col gap-1.5 justify-center">
          ${prevLines}
          <p class="text-[15px] leading-relaxed text-slate-700 font-medium"><span id="type-line"></span><span class="type-caret"></span></p>
        </div>
        <button onclick="UI.nextNarration()" class="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-slate-600 hover:text-slate-800 transition">
          <span class="text-xs">계속 읽기</span><span class="cine-hint">아무 곳이나 클릭 · Enter</span><span class="next-caret">▼</span>
        </button>`;
    } else if (isFeedback) {
      /* --- 선택 즉시 피드백 연출: NPC 대사 + 스탯 변동 --- */
      const choice = r.lastChoice;
      const fx2 = choice.effects;
      const chips = [];
      let delay = 0;
      const chip = (html, cls) => chips.push(`<span class="stat-chip text-[11px] font-black px-2.5 py-1 rounded-full ${cls}" style="animation-delay:${(delay += 90)}ms">${html}</span>`);
      for (const [k, label] of Object.entries(STAT_LABELS)) {
        const v = fx2[k] || 0;
        if (!v) continue;
        const bad = k === 'stress' ? v > 0 : v < 0;
        chip(`${label} ${v > 0 ? '+' : ''}${v}`, bad ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-600');
      }
      for (const [k, v] of Object.entries(fx2.traits || {})) {
        if (v) chip(`#${TRAIT_LABELS[k] || k} ${v > 0 ? '+' : ''}${v}`, 'bg-indigo-100 text-indigo-600');
      }
      bodyHtml = `
        <div class="flex flex-col gap-1 mb-2 opacity-50"><p class="text-xs text-slate-500">→ ${Terms.highlight(choice.text)}</p></div>
        <p class="text-[15px] leading-relaxed text-slate-700 font-medium">"${Terms.highlight(this.feedbackLine(choice, fx2))}"</p>
        <div class="flex gap-1.5 flex-wrap justify-center my-2.5">${chips.join('') || '<span class="text-xs text-slate-400">스탯 변동 없음</span>'}</div>
        <button onclick="UI.afterFeedback()" class="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-slate-600 hover:text-slate-800 transition">
          <span class="text-xs">계속</span><span class="cine-hint">아무 곳이나 클릭 · Enter</span><span class="next-caret">▼</span>
        </button>`;
    } else {
      // 이미 읽은 상황은 두 줄로 접어 선택지가 한 화면에 다 들어오게 한다 (전문은 title로)
      const recap = (sc.narration || []).join(' ');
      bodyHtml = `
        ${recap ? `<p class="text-[13px] leading-relaxed text-slate-500 opacity-70 mb-1.5 line-clamp-2" title="${recap.replace(/"/g, '&quot;')}">${Terms.highlight(recap)}</p>` : ''}
        <h3 class="text-[16px] font-extrabold text-slate-800 leading-snug mb-2 fade-up">${Terms.highlight(sc.q)}</h3>
        <div class="flex flex-col gap-2">
          ${sc.choices
            .map(
              (c, i) => `
            <button onclick="UI.choose(${i}, event)" data-choice
              class="choice-btn choice-card fade-up" style="animation-delay:${i * 90}ms">
              <span class="choice-num">${i + 1}</span>
              <span class="text-[14px] leading-snug font-medium text-slate-700">${Terms.highlight(c.text)}</span>
            </button>`
            )
            .join('')}
        </div>
        <p class="text-center text-[11px] text-slate-400 mt-2">💡 정답은 없어요 · ⌨️ <b>1·2·3</b> 키로도 선택 · <b class="text-emerald-600">초록 용어</b>를 누르면 뜻이 보여요</p>`;
    }

    /* 화자 표시 — 피드백 컷은 NPC, 그 외에는 상황 내레이션 */
    const speaker = isFeedback
      ? { name: npc.name, color: npc.color }
      : { name: '📍 상황', color: '#9a6b43' };

    $('#game-view').innerHTML = `
      <div id="game-frame" class="max-w-2xl mx-auto flex flex-col${isNarration || isFeedback ? ' is-advance' : ''}">
        <!-- 퀘스트 바 -->
        <div class="quest-bar shrink-0">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl shrink-0" style="background:${job.color}22;color:${job.color}">${Icons.forJob(job, { size: 16, color: job.color })}</span>
          <div class="min-w-0">
            <p class="text-[13px] font-extrabold text-slate-800 leading-tight truncate">${job.name}의 하루 <span class="text-[10px] align-middle px-1.5 py-0.5 rounded-full bg-white/70" title="${modeInfo.label}">${modeInfo.emoji} ${modeInfo.short}</span></p>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="quest-pill" style="background:${stage.color}" title="${stage.desc}">${stage.emoji} ${stage.label}</span>
              <span class="text-[10px] font-black text-slate-500">EP ${index + 1} / ${total}</span>
            </div>
          </div>
          <div class="ml-auto flex gap-1.5 shrink-0">
            ${mode === 'realistic' ? `<button onclick="UI.showCareer('${job.id}')" title="직업 정보" class="text-xs font-bold px-2 py-1 rounded-lg bg-white text-sky-600 border-2 border-slate-200 transition">📊</button>` : ''}
            <button onclick="UI.confirmResign()" class="text-xs font-bold px-2 py-1 rounded-lg bg-white text-rose-500 border-2 border-rose-200 transition">📄 사직서</button>
          </div>
        </div>
        <div class="quest-progress shrink-0 mx-3"><div class="ep-progress-fill h-full transition-all duration-500" style="width:${pct}%;background:linear-gradient(90deg, ${job.color}bb, ${job.color})"></div></div>

        <!-- ═══ 시네마틱 무대: 연출 시퀀스가 카메라·동선을 조종하는 곳 ═══ -->
        <div class="cine-stage shrink-0" style="height:clamp(190px, 33vh, 330px);">
          <div id="scenario-3d-mount" style="position:absolute;inset:0;"></div>
          <div class="cine-vignette"></div>
          <div class="cine-letterbox top"></div>
          <div class="cine-letterbox bottom"></div>
          <div class="cine-nameplate" style="left:16px;background:${npc.color}">${npc.name}</div>
          <div class="cine-nameplate" style="right:16px;background:#8a5f3c">${SAVE.nickname}</div>
          <div id="reaction-text" class="absolute text-sm font-bold opacity-0 z-10" style="top:52px;right:18px"></div>
          <button id="dir-note-btn" onclick="UI.toggleDirNote()" title="연출 큐시트 · 퀘스트 데이터 테이블 · 에피소드 흐름 보기"
            class="stage-btn absolute z-10 ${this._dirNote ? 'on' : ''}" style="bottom:22px;right:16px">🧰 기획 패널</button>
        </div>

        <!-- ═══ 대화 상자 ═══ -->
        <div class="dialogue-box shrink-0 mx-2">
          <span class="dialogue-speaker" style="background:${speaker.color}">${speaker.name}</span>
          <div class="dlg-scroll overflow-y-auto" style="max-height:36vh;min-height:0;">${bodyHtml}</div>
        </div>
        <div id="dir-note-slot" class="mx-2">${this.dirNoteHtml()}</div>
      </div>`;

    // 3D 무대: innerHTML이 매 렌더마다 새로 그려지므로, NPC/직업이 그대로면 기존 씬의
    // 캔버스만 새 컨테이너에 재부착하고(깜빡임/idle 애니메이션 끊김 방지),
    // NPC나 직업이 바뀐 경우에만 씬을 새로 만든다.
    const stageKey = job.id + '|' + npc.name;
    const mount = $('#scenario-3d-mount');
    if (this._stageKey !== stageKey || !Scene3D.Stage.reattach(mount)) {
      Scene3D.Stage.mount(mount, npc, job);
      this._stageKey = stageKey;
      this._dirKey = null; // 무대가 새로 서면 연출도 처음부터 다시 건다
    }

    // 이 컷의 연출 큐시트 재생 (같은 컷을 다시 그릴 때는 중복 재생하지 않는다)
    this.playDirection(sc, r);
    this.applyPanelLayout(); // 패널이 열린 상태로 리렌더된 경우 레이아웃 유지

    if (isNarration) {
      const line = sc.narration[r.nIdx];
      Type.start($('#type-line'), line, Terms.highlight(line));
    }
  },

  /* ==================== 연출 시퀀스 연동 ==================== */

  /**
   * 현재 컷(에피소드 index + 진행 단계 phase)에 배정된 연출 프리셋을 재생한다.
   * 내레이션 줄 넘김처럼 컷이 그대로인 리렌더에서는 재생하지 않는다.
   */
  playDirection(sc, r, opts = {}) {
    if (typeof Director === 'undefined') return;
    const key = `${r.job.id}|${r.index}|${r.phase}`;
    if (!opts.force && this._dirKey === key) return;
    this._dirKey = key;

    this._dirPreset = r.phase === 'feedback'
      ? DirectionPicker.pickFeedback((r.lastChoice && r.lastChoice.effects) || {})
      : DirectionPicker.pick(sc, { index: r.index, total: r.scenarios.length, phase: r.phase });

    Director.play(this._dirPreset, opts);
    const slot = $('#dir-note-slot');
    if (slot) slot.innerHTML = this.dirNoteHtml();
  },

  /** 기획 패널 토글 — 리렌더 없이 해당 노드만 갈아끼운다(타이핑 연출 보존) */
  toggleDirNote() {
    this._dirNote = !this._dirNote;
    const slot = $('#dir-note-slot');
    if (slot) slot.innerHTML = this.dirNoteHtml();
    const btn = $('#dir-note-btn');
    if (btn) btn.classList.toggle('on', this._dirNote);
    this.applyPanelLayout();
    if (this._dirNote && slot) setTimeout(() => slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    SFX.click();
  },

  /** 기획 패널이 열리면 무대/대화창을 줄여 16:9 셸 안에 패널까지 함께 들어가게 한다.
   * (리렌더 대신 스타일만 바꿔 타이핑 연출을 끊지 않는다. 무대 축소는 ResizeObserver가
   *  받아 3D 카메라 비율을 알아서 다시 맞춘다.) */
  applyPanelLayout() {
    const on = this._dirNote;
    const stage = document.querySelector('.cine-stage');
    const dlg = document.querySelector('.dialogue-box .dlg-scroll');
    if (stage) stage.style.height = on ? 'clamp(118px, 19vh, 205px)' : 'clamp(190px, 33vh, 330px)';
    if (dlg) dlg.style.maxHeight = on ? '19vh' : '36vh';
    if (!on) this.fitStage();
  },

  /** 셸 안에 남은 높이를 재서 무대를 줄인다 — 대화창(특히 선택지 3개)이 스크롤 없이 다 보이게.
   * 16:9 셸에서 HUD 헤더가 약 190px을 차지해, 무대 기본 높이(33vh)를 그대로 두면 선택지가 잘렸다. */
  fitStage() {
    const stage = document.querySelector('.cine-stage');
    const frame = $('#game-frame');
    const scroller = $('#game-scroll');
    if (!stage || !frame || !scroller) return;
    const header = scroller.querySelector('header');
    const main = scroller.querySelector('main');
    const cs = main ? getComputedStyle(main) : null;
    const pad = cs ? parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) : 40;
    const avail = scroller.clientHeight - (header ? header.offsetHeight : 0) - pad;
    const others = frame.offsetHeight - stage.offsetHeight;
    stage.style.height = Math.max(120, Math.min(stage.offsetHeight, avail - others)) + 'px';
    // 아주 낮은 창에서 그래도 넘치면 대화창 하단이 보이도록 맞춘다
    const box = document.querySelector('.dialogue-box');
    if (box) box.scrollIntoView({ block: 'nearest' });
  },

  /** 큐 한 줄을 사람이 읽는 문장으로 (연출 노트 표시용) */
  cueLabel(c) {
    const bits = [];
    if (c.샷) bits.push(`카메라 → <b>${c.샷}</b>`);
    if (c.화각 !== undefined) bits.push(`화각 ${c.화각}°`);
    if (c.흔들림 !== undefined) bits.push(`셰이크 ${c.흔들림}`);
    if (c.배우) {
      const who = c.배우 === 'npc' ? 'NPC' : '나';
      if (c.마크) bits.push(`${who} 동선 → <b>${c.마크}</b>${c.걷기 ? ' (도보)' : ''}`);
      if (c.회전 !== undefined) bits.push(`${who} 회전 ${c.회전}°`);
      if (c.모션) bits.push(`${who} 모션 「<b>${c.모션}</b>」`);
    }
    if (c.화면) bits.push(`화면 ${c.화면}`);
    return bits.join(' · ');
  },

  /* ---------- 기획 패널 (연출 큐시트 · 퀘스트 데이터 · 에피소드 흐름) ---------- */

  /** 패널 탭 전환 — 리렌더 없이 슬롯만 갈아끼운다(타이핑 연출 보존) */
  setPanelTab(tab) {
    this._panelTab = tab;
    const slot = $('#dir-note-slot');
    if (slot) slot.innerHTML = this.dirNoteHtml();
    SFX.click();
  },

  exportQuestCSV() {
    if (!Engine.run) return;
    QuestTable.download(Engine.run.job, Engine.run.mode);
    this.toast('📄 퀘스트 데이터를 CSV로 내보냈어요!');
  },

  dirNoteHtml() {
    if (!this._dirNote || !Engine.run || typeof Director === 'undefined') return '';
    const tab = this._panelTab || 'cue';
    const TABS = [['cue', '🎬 연출 큐시트'], ['data', '🗂 퀘스트 데이터'], ['flow', '🔀 에피소드 흐름']];
    const tabsHtml = TABS
      .map(([k, label]) => `<button class="dn-tab ${tab === k ? 'on' : ''}" onclick="UI.setPanelTab('${k}')">${label}</button>`)
      .join('');
    const body = tab === 'data' ? this.panelDataHtml()
      : tab === 'flow' ? this.panelFlowHtml()
      : this.panelCueHtml();
    return `
      <div class="dir-note mt-2 fade-up">
        <div class="dn-tabs">
          ${tabsHtml}
          <span class="dn-meta ml-auto">기획자 패널 · 실데이터 기준</span>
        </div>
        <div class="dn-body">${body}</div>
      </div>`;
  },

  /** ① 이 컷에 적용된 연출 프리셋의 의도 + 큐시트 전문 */
  panelCueHtml() {
    const id = this._dirPreset || '기본_투샷';
    const p = Director.preset(id);
    const auto = !(Engine.scenario && Engine.scenario.cue)
      ? ' · <span style="color:#e8a33d">자동 배정</span>'
      : ' · <span style="color:#cfe4bd">데이터 지정</span>';
    const cues = p.큐시트
      .map((c) => `<div class="dir-cue">· <span class="dir-t">${(c.t || 0).toFixed(1)}s</span> ${this.cueLabel(c)}</div>`)
      .join('');
    return `
      <b>🎬 「${p.이름}」</b> <span style="opacity:.6">${id}${auto}</span>
      <div style="opacity:.85;margin:3px 0 6px">의도 — ${p.의도}</div>
      ${cues}`;
  },

  /** ② 퀘스트 데이터 테이블 (스키마 + 실제 값 + CSV 내보내기 + 자동 점검) */
  panelDataHtml() {
    const { job, mode, index } = Engine.run;
    const rows = QuestTable.rows(job, mode);
    const sum = QuestTable.summary(job, mode);
    const issues = QuestDoctor.check(job, mode);

    const numCell = (v, inverse) => {
      if (!v) return '<span class="dn-zero">0</span>';
      const bad = inverse ? v > 0 : v < 0;
      return `<span class="${bad ? 'dn-neg' : 'dn-pos'}">${v > 0 ? '+' : ''}${v}</span>`;
    };
    const head = QuestTable.SCHEMA.map((c) => `<th title="${c.desc}">${c.label}</th>`).join('');
    const body = rows.map((r) => `
      <tr class="${r._epIndex === index ? 'dn-now' : ''}">
        ${QuestTable.SCHEMA.map((c) => {
          const v = r[c.key];
          if (c.signed) return `<td class="dn-num">${numCell(v, c.inverse)}</td>`;
          if (c.num) return `<td class="dn-num">${v}</td>`;
          return `<td class="${c.wide ? 'dn-wide' : ''}" title="${String(v).replace(/"/g, '&quot;')}">${v}</td>`;
        }).join('')}
      </tr>`).join('');

    const issueHtml = issues.length
      ? issues.slice(0, 6).map((f) => `<div class="${f.level === 'warn' ? 'dn-warn' : 'dn-info'}">${f.level === 'warn' ? '⚠️' : 'ℹ️'} <b>${f.where}</b> ${f.msg} <span style="opacity:.75">→ ${f.fix}</span></div>`).join('')
      : '<div class="dn-ok">✅ 자동 점검 통과 — 비어 있는 칸이나 무의미한 분기가 없습니다.</div>';

    return `
      <div class="dn-kv">
        <span>직업 <b>${job.id}</b></span>
        <span>모드 <b>${mode}</b></span>
        <span>에피소드 <b>${sum.episodes}</b></span>
        <span>선택지/분기 <b>${sum.choices}</b></span>
        <span>연출 종류 <b>${sum.cueKinds}</b></span>
        <span>연출 직접지정률 <b>${sum.cueAuthoredRate}%</b></span>
        <span>성향태그 커버리지 <b>${sum.traitCoverage}%</b></span>
        <button class="dn-btn" onclick="UI.exportQuestCSV()">⬇ CSV 내보내기</button>
      </div>
      <div style="margin-bottom:6px;border-bottom:1px solid rgba(111,74,44,.6);padding-bottom:6px">
        <b>🩺 데이터 자동 점검</b> <span class="dn-meta">(${issues.length}건)</span>
        ${issueHtml}
      </div>
      <div class="dn-meta" style="margin-bottom:3px">컬럼명에 마우스를 올리면 스키마 설명이 나옵니다 · 현재 컷은 강조 표시</div>
      <div style="overflow-x:auto"><table class="dn-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  },

  /** ③ 에피소드 흐름 — 컷 노드 그래프 + 엔딩 분기 */
  panelFlowHtml() {
    const { job, mode, index } = Engine.run;
    const nodes = QuestFlow.nodes(job, mode);
    const endings = QuestFlow.endings(job, mode);

    const nodeHtml = nodes.map((n) => `
      <div class="dn-node ${n.index === index ? 'dn-now' : ''}">
        <div><b>EP${n.step}</b> <span style="color:${n.tone.color};font-weight:900">${n.tone.label}</span></div>
        <div class="dn-meta">${n.stage}</div>
        <div class="dn-meta">🗣 ${n.npc}</div>
        <div class="dn-meta">분기 ${n.choices}</div>
        <div style="color:#cfe4bd">🎬 ${n.cue}${n.cueAuto ? ' <span class="dn-meta">(자동)</span>' : ''}</div>
      </div>`).join('<div class="dn-arrow">▶</div>');

    const endHtml = endings.map((e) => `
      <div class="dn-node dn-end">
        <div><b style="color:${e.color}">${e.type === 'quit' ? '🚪' : e.type === 'deep' ? '🏆' : e.type === 'success' ? '🌟' : '🍀'} ${e.name}</b></div>
        <div class="dn-meta">${e.desc}</div>
      </div>`).join('');

    const tense = nodes.filter((n) => n.tone.key === 'tense').length;
    const cueKinds = new Set(nodes.map((n) => n.cue)).size;

    return `
      <div class="dn-kv">
        <span>총 <b>${nodes.length}</b>컷</span>
        <span>고비 컷 <b>${tense}</b></span>
        <span>연출 종류 <b>${cueKinds}</b>/${nodes.length}</span>
        <span>엔딩 분기 <b>${endings.length}</b></span>
      </div>
      <div style="overflow-x:auto"><div class="dn-flow">${nodeHtml}<div class="dn-arrow">▶</div>
        <div class="dn-node dn-end" style="border-style:dashed"><div><b>판정</b></div><div class="dn-meta">완주 여부 · 누적 스탯으로<br/>엔딩 분기</div></div>
      </div></div>
      <div style="margin-top:7px"><b>엔딩 분기</b></div>
      <div style="overflow-x:auto;margin-top:3px"><div class="dn-flow">${endHtml}</div></div>`;
  },

  nextNarration() {
    if (this._locked) return;
    if (Type.active) { Type.finish(); return; } // 타이핑 중 → 즉시 완성
    Engine.advanceNarration();
    this.renderGame();
  },

  choose(idx, event) {
    if (this._locked || Engine.run.phase !== 'choices') return;
    const btn = event && event.currentTarget;
    const fx = Engine.applyChoice(idx);
    SFX.click();

    const proceed = () => {
      // 내 캐릭터 리액션 연출과 함께 피드백 화면으로 전환
      this.renderGame();
      let reaction;
      if ((fx.stress || 0) >= 2) reaction = { kind: 'stress', cls: 'text-rose-500', text: '💦 스트레스가…!' };
      else if ((fx.performance || 0) >= 2) reaction = { kind: 'performance', cls: 'text-amber-500', text: '✨ 훌륭한 성과!' };
      else reaction = { kind: 'default', cls: 'text-indigo-400', text: '🍀 나다운 선택!' };
      const rt = $('#reaction-text');
      Scene3D.Stage.react(reaction.kind);
      if (rt) { rt.textContent = reaction.text; rt.className = 'absolute top-2 right-4 text-sm font-bold fade-up z-10 ' + reaction.cls; }
      if ((fx.stress || 0) >= 2) { this.shakeShell(); SFX.warn(); }
      else if ((fx.performance || 0) >= 2) SFX.success();
      else SFX.pop();
      const burst = this.resultBurstFor(fx, reaction.kind);
      this.showResultBurst(burst.title, burst.detail, burst.bg);
    };

    if (btn) {
      this.spawnRipple(event, btn);
      this.spawnStatPopups(fx, btn);
      btn.classList.add('choice-selected');
      document.querySelectorAll('[data-choice]').forEach((b) => { b.disabled = true; });
      setTimeout(proceed, 260);
    } else {
      proceed();
    }
  },

  /** 선택지 클릭 좌표 기반 리플 이펙트 */
  spawnRipple(event, el) {
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.4;
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (event.clientX - r.left - size / 2) + 'px';
    span.style.top = (event.clientY - r.top - size / 2) + 'px';
    el.appendChild(span);
    setTimeout(() => span.remove(), 600);
  },

  /** 선택 즉시 버튼 위로 "+2 성과" 등이 둥실 떠오르는 스탯 팝업 (고정 오버레이라 화면 재렌더에 영향받지 않음) */
  spawnStatPopups(fx, originEl) {
    const layer = $('#screen-fx');
    if (!layer) return;
    const r = originEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + 8;
    const items = [];
    for (const [k, label] of Object.entries(STAT_LABELS)) {
      const v = fx[k] || 0;
      if (!v) continue;
      const bad = k === 'stress' ? v > 0 : v < 0;
      items.push({ text: `${label} ${v > 0 ? '+' : ''}${v}`, color: bad ? '#f43f5e' : '#10b981' });
    }
    for (const [k, v] of Object.entries(fx.traits || {})) {
      if (v) items.push({ text: `#${TRAIT_LABELS[k] || k} ${v > 0 ? '+' : ''}${v}`, color: '#818cf8' });
    }
    items.forEach((it, i) => {
      const el = document.createElement('span');
      el.className = 'stat-float';
      el.textContent = it.text;
      el.style.color = it.color;
      el.style.left = (cx + (i - (items.length - 1) / 2) * 58) + 'px';
      el.style.top = cy + 'px';
      el.style.animationDelay = (i * 80) + 'ms';
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1500 + i * 80);
    });
  },

  /** 리액션 종류(kind)에 맞는 즉각 결과 배너용 타이틀/대표 스탯 계산 */
  resultBurstFor(fx, kind) {
    const KIND_META = {
      performance: { title: '✨ 훌륭한 판단!', bg: 'linear-gradient(135deg,#f59e0b,#f43f5e)' },
      stress: { title: '💦 만만치 않네요', bg: 'linear-gradient(135deg,#fb7185,#ef4444)' },
      default: { title: '🍀 나다운 선택', bg: 'linear-gradient(135deg,#6fa85c,#c98a3c)' },
    };
    const meta = KIND_META[kind] || KIND_META.default;
    let best = null;
    for (const [k, label] of Object.entries(STAT_LABELS)) {
      const v = fx[k] || 0;
      if (v && (!best || Math.abs(v) > Math.abs(best.v))) best = { label, v };
    }
    for (const [k, v] of Object.entries(fx.traits || {})) {
      if (v && (!best || Math.abs(v) > Math.abs(best.v))) best = { label: '#' + (TRAIT_LABELS[k] || k), v };
    }
    const detail = best ? `${best.label} ${best.v > 0 ? '+' : ''}${best.v}` : '경험치 획득!';
    return { title: meta.title, detail, bg: meta.bg };
  },

  /** 선택 직후 1.5초간 노출되는 짧고 강렬한 결과 배너 */
  showResultBurst(title, detail, bg) {
    const shell = $('#game-shell');
    const layer = $('#screen-fx');
    if (!shell || !layer) return;
    const r = shell.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'result-burst';
    el.style.left = (r.left + r.width / 2) + 'px';
    el.style.top = (r.top + r.height * 0.3) + 'px';
    el.style.background = bg;
    el.innerHTML = `<div class="rb-title">${title}</div><div class="rb-detail">${detail}</div>`;
    layer.appendChild(el);
    setTimeout(() => {
      el.classList.add('result-burst-out');
      setTimeout(() => el.remove(), 300);
    }, 1200);
  },

  /** 드라마틱한 순간(고스트레스 선택·조기 퇴사 등) 게임 셸 전체 흔들림 */
  shakeShell() {
    const shell = $('#game-shell');
    if (!shell) return;
    shell.classList.remove('shell-shake');
    void shell.offsetWidth;
    shell.classList.add('shell-shake');
    setTimeout(() => shell.classList.remove('shell-shake'), 550);
  },

  /** 피드백 확인 → 다음 에피소드 또는 결과 */
  afterFeedback() {
    if (this._locked || !Engine.run || Engine.run.phase !== 'feedback') return;
    Engine.proceed();
    if (Engine.isFinished) {
      const result = Engine.finishRun(false);
      Scene3D.Stage.dispose(); this._stageKey = null; Director.stop(); this._dirKey = null;
      this.fx('fx-flash');
      this.showResult(result);
      this.renderHeader();
      this.renderAll();
    } else {
      this.fx('fx-dim');
      this.renderGame();
    }
  },

  confirmResign() {
    const { index } = Engine.run;
    const penalty = index < 3;
    $('#modal-content').innerHTML = `
      <div class="text-center">
        <div class="text-5xl mb-3">📄</div>
        <h3 class="text-xl font-extrabold text-slate-800 mb-2">사직서를 제출할까요?</h3>
        <p class="text-sm text-slate-500 mb-1">현재까지 완료한 시나리오: <b>${index}개</b></p>
        ${
          penalty
            ? `<div class="text-sm text-rose-500 font-bold mb-5 bg-rose-50 rounded-xl p-3">⚠️ 조기 퇴사 페널티<br/>
                <span class="text-xs font-medium text-rose-400">성실함 지수 -7 영구 감소 · 조기 퇴사 횟수 기록<br/>보상 없음 · 재취업 시 광고 시청 필요</span></div>`
            : '<p class="text-sm text-emerald-600 font-bold mb-5">3개 이상 완료 — 정상 평가를 받습니다. (보상 골드는 절반)</p>'
        }
        <div class="flex gap-3">
          <button onclick="UI.closeModal()" class="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">계속 일하기</button>
          <button onclick="UI.doResign()" class="flex-1 py-3 rounded-xl font-bold bg-rose-500 text-white hover:bg-rose-600 transition">제출하기</button>
        </div>
      </div>`;
    this.openModal();
  },

  doResign() {
    if (Engine.run && Engine.run.phase === 'feedback') Engine.proceed(); // 방금 답한 에피소드는 완료로 인정
    const result = Engine.finishRun(true);
    Scene3D.Stage.dispose(); this._stageKey = null; Director.stop(); this._dirKey = null;
    if (result.isQuitterPenalty) this.shakeShell();
    this.showResult(result);
    this.renderHeader();
    this.renderAll();
  },

  /* --- 결과 모달 --- */
  showResult(result) {
    const { job, mode, title, record, rewards, gold, sincerityDelta, isQuitterPenalty, newQuests } = result;
    this._questQueue.push(...newQuests);
    const success = title.type === 'success';
    if (gold > 0) SFX.coin();
    if (success) SFX.success(); else if (!isQuitterPenalty) SFX.pop();
    const face = success ? job.emojiSuccess : job.emojiAlt;
    const maxStat = Math.max(3, record.completed * 2.5);

    const statRows = Object.entries(STAT_LABELS)
      .map(([k, label]) => {
        const v = record.stats[k];
        const pct = Math.min(100, Math.round((v / maxStat) * 100));
        const color = k === 'stress' ? '#cf5f77' : '#6fa85c';
        return `
          <div class="flex items-center gap-2 text-xs">
            <span class="w-14 text-slate-500 font-bold">${label}</span>
            <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${color}"></div></div>
            <span class="w-6 text-right font-bold text-slate-600">${v}</span>
          </div>`;
      })
      .join('');

    const topTraits = Object.entries(record.stats.traits)
      .sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, v]) => v > 0)
      .map(([k]) => `<span class="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 font-bold">#${TRAIT_LABELS[k] || k}</span>`)
      .join(' ');

    const rewardHtml = [
      gold > 0
        ? `<div class="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <span class="text-2xl">💰</span>
            <div class="text-left"><p class="text-xs font-bold text-amber-600">골드 획득 ${record.deep ? '(🌟 심화 보너스 +100G 포함)' : ''}</p><p class="text-sm font-extrabold text-slate-700">+${gold}G</p></div>
          </div>`
        : '',
      ...rewards.map((r) => {
        const label = r.kind === 'costume' ? '🧥 성공 엔딩 · 캐릭터 코스튬' : r.kind === 'decor' ? '🎈 라이트 완주 · 마이룸 장식' : '🎯 리얼 완주 · 마이룸 가구';
        return `
        <div class="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <span class="text-2xl">${r.emoji}</span>
          <div class="text-left">
            <p class="text-xs font-bold text-amber-600">${label}</p>
            <p class="text-sm font-extrabold text-slate-700">${r.name}${r.kind === 'costume' ? ' <button onclick="UI.closeModal();UI.showAvatarCustomizer()" class="text-[10px] font-bold text-violet-500 underline ml-1">입어보기</button>' : ''}</p>
          </div>
        </div>`;
      }),
      sincerityDelta < 0
        ? `<div class="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
            <span class="text-2xl">📉</span>
            <div class="text-left"><p class="text-xs font-bold text-rose-500">성실함 지수 ${sincerityDelta} (현재 ${SAVE.sincerity})</p><p class="text-[11px] text-rose-400">조기 퇴사 누적 ${SAVE.resignCount}회 — 프로필에 기록됩니다.</p></div>
          </div>`
        : '',
    ].join('');

    $('#modal-content').innerHTML = `
      <div class="text-center">
        <div class="text-6xl mb-3 ${success ? 'anim-glow' : 'anim-pop'}">${face}</div>
        <p class="text-xs font-bold tracking-widest uppercase ${success ? 'text-emerald-500' : 'text-violet-500'} mb-1">
          ${isQuitterPenalty ? 'EARLY RESIGNATION' : success ? 'CAREER COMPLETE' : 'UNCONVENTIONAL PATH'}
        </p>
        <h3 class="text-2xl font-black text-slate-800 mb-1">「${title.name}」</h3>
        <p class="text-[11px] text-slate-400 mb-2">${MODES[mode].emoji} ${MODES[mode].short} 모드 · ${record.resigned ? `중도 퇴사 (${record.completed}/${record.total})` : '완주'}</p>
        <p class="text-sm text-slate-500 leading-relaxed mb-3">${title.desc}</p>
        <div class="inline-block px-6 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 mb-3">
          <p class="text-3xl font-black text-indigo-600">${record.score}<span class="text-sm font-bold text-slate-400"> / 100점</span></p>
          <p class="text-[10px] font-bold text-slate-400">종합 취업 점수 ${record.score >= 80 ? '· 명예의 전당 도전!' : ''}</p>
        </div>
        <div class="flex justify-center gap-1.5 mb-4">${topTraits}</div>
        <div class="bg-slate-50 rounded-2xl p-4 flex flex-col gap-2 mb-4">${statRows}</div>
        <div class="flex flex-col gap-2 mb-4">${rewardHtml || '<p class="text-xs text-slate-400">획득한 보상이 없습니다.</p>'}</div>
        ${mode === 'realistic' && !isQuitterPenalty ? `<div class="mb-4">${this.careerHtml(job)}</div>` : ''}
        <button onclick="UI.closeModal(); UI.switchTab('album')" class="w-full py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition mb-2">앨범에서 확인하기</button>
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">닫기</button>
      </div>`;
    this.openModal();
  },

  /* --- 히든 퀘스트 달성 팝업 --- */
  showQuestPopup(q) {
    const theme = THEMES.find((t) => t.id === q.reward);
    $('#modal-content').innerHTML = `
      <div class="text-center">
        <div class="text-6xl mb-3 anim-glow">${q.icon}</div>
        <p class="text-xs font-bold tracking-widest uppercase text-amber-500 mb-1">HIDDEN QUEST CLEAR!</p>
        <h3 class="text-2xl font-black text-slate-800 mb-1">「${q.name}」</h3>
        <p class="text-sm text-slate-500 mb-4">${q.desc} — 달성!</p>
        ${theme ? `
          <div class="rounded-2xl overflow-hidden border-2 border-amber-300 mb-4">
            <div class="h-20" style="background:${theme.bg}"></div>
            <div class="p-3 bg-amber-50">
              <p class="text-xs font-bold text-amber-600">🎨 배경 테마 해금!</p>
              <p class="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">${Icons.forTheme(theme.id, { size: 15 })} ${theme.name}</p>
            </div>
          </div>` : ''}
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-amber-400 text-white hover:bg-amber-500 transition">멋진데?</button>
      </div>`;
    this.openModal();
  },

  /* ==================== Tab 2: 지원 이력 (정렬 + 명예의 전당 + 가이드북) ==================== */
  setHistSort(v) {
    this._histSort = v;
    this.renderHistory();
  },

  /** 최고 점수 TOP 3 — 정렬 필터와 무관하게 최상단 고정 */
  renderHallOfFame() {
    const el = $('#hall-of-fame');
    if (!el) return;
    const best = {}; // jobId -> 최고 기록
    for (const h of SAVE.history) {
      const sc = Score.of(h);
      if (!best[h.jobId] || sc > best[h.jobId].score) best[h.jobId] = { score: sc, h };
    }
    const top = Object.values(best).sort((a, b) => b.score - a.score).slice(0, 3);
    if (!top.length) { el.innerHTML = ''; return; }
    const medals = ['🥇', '🥈', '🥉'];
    const ranks = ['1st', '2nd', '3rd'];
    el.innerHTML = `
      <div class="rounded-3xl border-2 border-amber-200 bg-gradient-to-b from-amber-50/80 to-white p-3.5">
      <p class="text-xs font-black text-amber-500 tracking-widest uppercase mb-2">👑 명예의 전당 — 점수 TOP 3 고정 구역</p>
      <div class="grid grid-cols-3 gap-2.5">
        ${top
          .map((t, i) => {
            const job = findJob(t.h.jobId);
            if (!job) return '';
            return `
            <button onclick="UI.showGuidebook('${job.id}')" class="rank-card rounded-2xl p-3 text-center" title="${job.name} 가이드북 열기">
              <p class="text-[9px] font-black text-amber-400 tracking-widest">${ranks[i]}</p>
              <p class="text-xl leading-none">${medals[i]}</p>
              <p class="my-1 flex items-center justify-center" style="color:${job.color}">${Icons.forJob(job, { size: 24, color: job.color })}</p>
              <p class="text-[11px] font-extrabold text-slate-700 truncate">${job.name}</p>
              <p class="text-lg font-black text-amber-500">${t.score}<span class="text-[10px] text-amber-400">점</span></p>
            </button>`;
          })
          .join('')}
      </div>
      </div>`;
  },

  renderHistory() {
    this.renderHallOfFame();
    const list = $('#history-list');
    if (!SAVE.history.length) {
      list.innerHTML = '<p class="text-center text-sm text-slate-400 py-10">아직 지원 이력이 없어요.<br/>잡보드에서 첫 직업에 도전해 보세요!</p>';
      return;
    }

    const sort = this._histSort || 'new';
    const sel = $('#hist-sort');
    if (sel) sel.value = sort;
    const arr = SAVE.history.map((h, i) => ({ h, i }));
    arr.sort((a, b) => {
      if (sort === 'old') return a.i - b.i;
      if (sort === 'high') return Score.of(b.h) - Score.of(a.h) || b.i - a.i;
      if (sort === 'low') return Score.of(a.h) - Score.of(b.h) || b.i - a.i;
      return b.i - a.i; // 최신순
    });

    list.innerHTML = arr
      .map(({ h }) => {
        const job = findJob(h.jobId);
        if (!job) return '';
        const d = new Date(h.date);
        const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        const quitter = h.resigned && h.completed < 3;
        const score = Score.of(h);
        const scoreColor = score >= 80 ? 'text-amber-500' : score >= 50 ? 'text-indigo-500' : 'text-slate-400';
        const status = quitter
          ? '<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-500">조기 퇴사</span>'
          : h.resigned
          ? `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">중도 퇴사 ${h.completed}/${h.total}</span>`
          : `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">완주${h.deep ? ' 🌟' : ''}</span>`;
        return `
        <div onclick="UI.showGuidebook('${h.jobId}')" role="button"
          class="flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-200 hover:-translate-y-0.5 transition">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style="background:${job.color}22;color:${job.color}">${Icons.forJob(job, { size: 22, color: job.color })}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-extrabold text-slate-700 truncate">${job.name} <span class="text-[10px] font-medium text-slate-400">${MODES[h.mode] ? MODES[h.mode].emoji : ''} ${dateStr}</span></p>
            <p class="text-[11px] text-slate-400 truncate">「${h.titleName}」</p>
          </div>
          <div class="text-center shrink-0 w-12">
            <p class="text-base font-black ${scoreColor}">${score}</p>
            <p class="text-[9px] font-bold text-slate-300">점수</p>
          </div>
          ${status}
          <button onclick="event.stopPropagation(); UI.rehire('${h.jobId}')" class="text-[11px] font-bold px-3 py-2 rounded-xl bg-violet-500 text-white hover:bg-violet-600 transition shrink-0">📺 재취업</button>
        </div>`;
      })
      .join('');
  },

  /** 직업 가이드북 — 현실 스펙/자격증/전망 백과사전 */
  showGuidebook(jobId) {
    const job = findJob(jobId);
    if (!job) return;
    const rec = SAVE.records[jobId];
    const myBest = SAVE.history.filter((h) => h.jobId === jobId).reduce((m, h) => Math.max(m, Score.of(h)), 0);
    $('#modal-content').innerHTML = `
      <div>
        <div class="text-center mb-3">
          <span class="inline-flex items-center justify-center w-16 h-16 rounded-2xl" style="background:${job.color}1c;color:${job.color}">${Icons.forJob(job, { size: 32, color: job.color })}</span>
          <p class="text-xs font-bold tracking-widest uppercase text-sky-500 mt-2">Job Guidebook</p>
          <h3 class="text-xl font-black text-slate-800">${job.name}</h3>
          <p class="text-xs text-slate-400 mt-1">${job.desc}</p>
        </div>
        ${rec ? `
        <div class="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 mb-3">
          <div><p class="text-[10px] font-bold text-slate-400">나의 최근 칭호</p><p class="text-sm font-extrabold text-slate-700">「${rec.titleName}」</p></div>
          <div class="text-right"><p class="text-[10px] font-bold text-slate-400">최고 점수</p><p class="text-lg font-black ${myBest >= 80 ? 'text-amber-500' : 'text-indigo-500'}">${myBest}점</p></div>
        </div>` : ''}
        ${this.careerHtml(job)}
        <div class="flex gap-2 mt-4">
          <button onclick="UI.closeModal()" class="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">닫기</button>
          ${rec ? `<button onclick="UI.closeModal(); UI.rehire('${job.id}')" class="flex-1 py-3 rounded-xl font-bold bg-violet-500 text-white hover:bg-violet-600 transition">📺 재취업 도전</button>` : ''}
        </div>
      </div>`;
    this.openModal();
  },

  /** 이력에서 재취업 — 반드시 광고 게이트를 거침 */
  rehire(jobId) {
    if (Engine.run) return;
    const job = findJob(jobId);
    this.showAdModal({
      title: '📺 광고 시청 후 입사하기',
      desc: `<b>${job.name}</b>에 다시 도전합니다.<br/>재취업에는 광고 시청이 필요해요!`,
      cta: '시청 완료! 입사하기',
      onDone: () => {
        delete SAVE.adGate[jobId];
        Storage.save(SAVE);
        Engine.startRun(jobId);
        this.fx('fx-flash');
        this.switchTab('jobs');
      },
    });
  },

  /* ==================== Tab 4: 나의 종합 성향 검사 결과 ==================== */
  renderAnalysis() {
    const view = $('#analysis-view');
    if (!view) return;
    const hist = SAVE.history;

    if (!hist.length) {
      view.innerHTML = `
        <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
          <p class="text-5xl mb-3">🧠</p>
          <p class="font-extrabold text-slate-700 mb-1">아직 분석할 데이터가 없어요</p>
          <p class="text-sm text-slate-400 mb-4">직업을 플레이할 때마다 선택 데이터가 쌓이고,<br/>이곳에 나만의 성향 검사 결과지가 만들어져요.</p>
          <button onclick="UI.switchTab('jobs')" class="px-5 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition text-sm">💼 첫 직업 체험하러 가기</button>
        </div>`;
      return;
    }

    /* --- 플레이 데이터 집계 --- */
    const traits = {};
    for (const h of hist) {
      for (const [k, v] of Object.entries((h.stats && h.stats.traits) || {})) {
        if (v > 0) traits[k] = (traits[k] || 0) + v;
      }
    }
    const successCnt = hist.filter((h) => h.type === 'success').length;
    const clearCnt = hist.filter((h) => !h.resigned && h.completed >= h.total).length;
    const avgScore = Math.round(hist.reduce((a, h) => a + Score.of(h), 0) / hist.length);
    const successRate = Math.round((successCnt / hist.length) * 100);

    /* --- 종합 성향 타입 문장 --- */
    const PERSONA = {
      analytical: ['데이터로 판단하는', '분석가'],
      perfection: ['완벽주의 성향이 강한', '장인'],
      creativity: ['아이디어가 넘치는', '크리에이터'],
      teamwork: ['사람을 모으고 이끄는', '리더'],
      risk: ['기회에 몸을 던지는', '도전가'],
      patience: ['묵묵히 끝까지 완주하는', '마라토너'],
      speed: ['속도로 승부하는', '스프린터'],
      modern: ['새로운 기술을 먼저 시도하는', '얼리어답터'],
      eco: ['자연과 지속가능함을 아끼는', '자연주의자'],
    };
    const sorted = Object.entries(traits).sort((a, b) => b[1] - a[1]);
    const t1 = sorted[0] && sorted[0][0];
    const t2 = (sorted[1] && sorted[1][0]) || t1;
    const persona = t1
      ? `당신은 <b class="text-indigo-600">${PERSONA[t1][0]}</b> <b class="text-indigo-600">${PERSONA[t2][1]} 타입</b>입니다.`
      : '아직 뚜렷한 성향이 나타나지 않았어요. 조금 더 플레이해 보세요!';
    const personaSub = t1
      ? `플레이 중 <b>#${TRAIT_LABELS[t1]}</b> 성향의 선택이 가장 많았고, <b>#${TRAIT_LABELS[t2]}</b> 성향이 그 뒤를 잇습니다.`
      : '';

    /* --- 성향 스탯 차트 (6축) --- */
    const AXES = [
      ['도전정신', 'risk', '#f43f5e'],
      ['안정·꼼꼼함', 'perfection', '#10b981'],
      ['리더십·협업', 'teamwork', '#f59e0b'],
      ['끈기', 'patience', '#8b5cf6'],
      ['분석력', 'analytical', '#0ea5e9'],
      ['창의력', 'creativity', '#ec4899'],
    ];
    const axMax = Math.max(1, ...AXES.map(([, k]) => traits[k] || 0));
    const bars = AXES.map(([label, k, color], i) => {
      const v = traits[k] || 0;
      const pct = Math.round((v / axMax) * 100);
      return `
        <div class="flex items-center gap-2.5 text-xs">
          <span class="w-20 text-slate-500 font-bold shrink-0">${label}</span>
          <div class="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="trait-bar h-full rounded-full" style="width:${pct}%;background:${color};animation-delay:${i * 110}ms"></div>
          </div>
          <span class="w-7 text-right font-black" style="color:${color}">${v}</span>
        </div>`;
    }).join('');

    /* --- 추천 직업 TOP 3 & 주의 직업 (유사도 기반) --- */
    const uv = Similar.userVec();
    const scoredJobs = getAllJobs().map((j) => ({ j, sim: uv ? Similar.cos(uv, Similar.jobVec(j)) : 0 }));
    let rec = scoredJobs.filter((x) => !SAVE.records[x.j.id]).sort((a, b) => b.sim - a.sim).slice(0, 3);
    if (rec.length < 3) rec = rec.concat(scoredJobs.filter((x) => SAVE.records[x.j.id]).sort((a, b) => b.sim - a.sim).slice(0, 3 - rec.length));
    const caution = scoredJobs.slice().sort((a, b) => a.sim - b.sim).slice(0, 2);

    const recHtml = rec.map((x, i) => `
      <div class="flex items-center gap-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3">
        <span class="text-lg font-black text-emerald-400 w-5">${i + 1}</span>
        <span class="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style="background:${x.j.color}1c;color:${x.j.color}">${Icons.forJob(x.j, { size: 18, color: x.j.color })}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-extrabold text-slate-700">${x.j.name} <span class="text-[10px] font-black text-emerald-500">적합도 ${Math.round(x.sim * 100)}%</span></p>
          <p class="text-[11px] text-slate-400 truncate">${x.j.desc}</p>
        </div>
        ${!SAVE.records[x.j.id] ? `<button onclick="UI.showGuidebook('${x.j.id}')" class="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 shrink-0">가이드북</button>` : ''}
      </div>`).join('');

    const cautionHtml = caution.map((x) => `
      <div class="flex items-center gap-3 bg-rose-50/60 border border-rose-100 rounded-2xl p-3">
        <span class="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 grayscale" style="background:${x.j.color}1c;color:${x.j.color}">${Icons.forJob(x.j, { size: 18, color: x.j.color })}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-extrabold text-slate-600">${x.j.name} <span class="text-[10px] font-black text-rose-400">적합도 ${Math.round(x.sim * 100)}%</span></p>
          <p class="text-[11px] text-slate-400">현재 성향과는 거리가 있어요. 도전한다면 각오가 필요!</p>
        </div>
      </div>`).join('');

    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

    view.innerHTML = `
      <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <!-- 결과지 레터헤드 -->
        <div class="px-6 py-5 text-white" style="background:linear-gradient(120deg,#6fa85c,#9a6b43)">
          <p class="text-[10px] font-black tracking-[0.25em] uppercase opacity-80">ProjectJOB Career Report</p>
          <h2 class="text-xl font-black mt-0.5">🧠 나의 종합 성향 검사 결과지</h2>
          <p class="text-[11px] opacity-80 mt-1">${SAVE.nickname} 님 · 검사일 ${dateStr} · 누적 플레이 데이터 ${hist.length}건 기반</p>
        </div>

        <div class="p-5 md:p-6">
          <!-- 요약 타일 -->
          <div class="grid grid-cols-4 gap-2 mb-5">
            <div class="bg-slate-50 rounded-2xl p-3 text-center"><p class="text-lg font-black text-slate-700">${hist.length}</p><p class="text-[10px] font-bold text-slate-400">플레이 횟수</p></div>
            <div class="bg-slate-50 rounded-2xl p-3 text-center"><p class="text-lg font-black text-indigo-600">${avgScore}</p><p class="text-[10px] font-bold text-slate-400">평균 점수</p></div>
            <div class="bg-slate-50 rounded-2xl p-3 text-center"><p class="text-lg font-black text-emerald-500">${successRate}%</p><p class="text-[10px] font-bold text-slate-400">성공 엔딩률</p></div>
            <div class="bg-slate-50 rounded-2xl p-3 text-center"><p class="text-lg font-black text-amber-500">${clearCnt}</p><p class="text-[10px] font-bold text-slate-400">완주 횟수</p></div>
          </div>

          <!-- 종합 성향 -->
          <div class="rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 p-4 mb-5 text-center">
            <p class="text-[10px] font-black tracking-widest uppercase text-indigo-400 mb-1">Overall Personality</p>
            <p class="text-base md:text-lg font-bold text-slate-700 leading-relaxed">${persona}</p>
            ${personaSub ? `<p class="text-[11px] text-slate-400 mt-1.5">${personaSub}</p>` : ''}
          </div>

          <!-- 성향 스탯 차트 -->
          <p class="text-xs font-black text-slate-500 uppercase tracking-wider mb-2.5">📊 성향 스탯 분석</p>
          <div class="flex flex-col gap-2.5 bg-slate-50 rounded-2xl p-4 mb-5">${bars}</div>

          <!-- 추천 직업 TOP 3 -->
          <p class="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2.5">💚 나에게 맞는 추천 직업 TOP 3</p>
          <div class="flex flex-col gap-2 mb-5">${recHtml || '<p class="text-xs text-slate-400">추천할 직업이 없어요.</p>'}</div>

          <!-- 주의 직업 -->
          <p class="text-xs font-black text-rose-500 uppercase tracking-wider mb-2.5">⚠️ 주의해야 할 직업</p>
          <div class="flex flex-col gap-2 mb-4">${cautionHtml}</div>

          <p class="text-[10px] text-slate-300 text-center">* 본 결과는 게임 내 선택 데이터를 기반으로 한 시뮬레이션이며, 플레이할수록 정확해집니다.</p>
        </div>
      </div>`;
  },

  /* ==================== Tab 5: 앨범 (검색 + 간략히 보기) ==================== */
  albumSearch(q) {
    this._albumQuery = q.trim().toLowerCase();
    this.renderAlbum();
  },

  toggleCompact() {
    this._albumCompact = !this._albumCompact;
    this.renderAlbum();
  },

  renderAlbum() {
    /* 프로필 카드 */
    const s = SAVE.sincerity;
    const sColor = s >= 80 ? '#10b981' : s >= 50 ? '#f59e0b' : '#f43f5e';
    const done = Object.keys(SAVE.records).length;
    const questHtml = QUESTS.map((q) => {
      const doneQ = SAVE.quests.includes(q.id);
      return `<span class="text-base ${doneQ ? '' : 'grayscale opacity-35'}" title="${doneQ ? q.name + ' (달성)' : '히든 퀘스트: ???'}">${q.icon}</span>`;
    }).join(' ');

    $('#album-profile').innerHTML = `
      <div class="flex items-center gap-4">
        <button onclick="UI.showAvatarCustomizer()" class="shrink-0 hover:scale-105 transition" title="캐릭터 수정">${AvatarSVG.render(SAVE.avatar, 52)}</button>
        <div class="flex-1 min-w-0">
          <p class="font-extrabold text-slate-800">${SAVE.nickname} <button onclick="UI.showAvatarCustomizer()" class="text-[10px] font-bold text-indigo-400 hover:text-indigo-600">✏️ 꾸미기</button></p>
          <p class="text-[11px] text-slate-400">경험 ${done}/${getAllJobs().length} · 누적 ${SAVE.history.length}회 · 💰 ${SAVE.gold}G · 퀘스트 ${questHtml}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <span class="text-[11px] font-bold text-slate-500 whitespace-nowrap">성실함 지수</span>
            <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full transition-all" style="width:${s}%;background:${sColor}"></div></div>
            <span class="text-[11px] font-black" style="color:${sColor}">${s}</span>
          </div>
        </div>
        <div class="text-center px-3 py-2 rounded-xl ${SAVE.resignCount > 0 ? 'bg-rose-50' : 'bg-slate-50'}">
          <p class="text-lg font-black ${SAVE.resignCount > 0 ? 'text-rose-500' : 'text-slate-400'}">${SAVE.resignCount}</p>
          <p class="text-[10px] font-bold text-slate-400">조기 퇴사</p>
        </div>
      </div>`;

    /* 그리드 (검색 + 간략히 보기) */
    const q = this._albumQuery;
    const compact = this._albumCompact;
    const jobs = getAllJobs().filter((job) => {
      if (!q) return true;
      const rec = SAVE.records[job.id];
      return job.name.toLowerCase().includes(q) || (rec && rec.titleName.toLowerCase().includes(q));
    });

    const grid = $('#album-grid');
    grid.className = compact
      ? 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2'
      : 'grid grid-cols-2 md:grid-cols-3 gap-4';

    $('#compact-btn').textContent = compact ? '🔍 크게 보기' : '📦 간략히 보기';

    grid.innerHTML = jobs
      .map((job) => {
        const rec = SAVE.records[job.id];
        if (compact) {
          if (!rec) return `<div class="aspect-square rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-lg grayscale opacity-40" title="${job.name} 미경험">🔒</div>`;
          const success = rec.type === 'success';
          return `<button onclick="UI.showAlbumDetail('${job.id}')" title="${job.name} — ${rec.titleName}"
            class="aspect-square rounded-xl flex flex-col items-center justify-center border transition hover:-translate-y-0.5 ${success ? 'bg-emerald-50 border-emerald-200' : 'bg-violet-50 border-violet-200'}">
            <span class="text-xl leading-none">${success ? job.emojiSuccess : job.emojiAlt}</span>
            ${rec.deep ? '<span class="text-[9px]">🌟</span>' : ''}
          </button>`;
        }
        if (!rec) {
          return `
          <div class="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 aspect-square">
            <span class="text-4xl grayscale opacity-40">🔒</span>
            <p class="text-sm font-bold text-slate-400">???</p>
            <p class="text-[11px] text-slate-300">${job.name} 미경험</p>
          </div>`;
        }
        const success = rec.type === 'success';
        return `
        <button onclick="UI.showAlbumDetail('${job.id}')"
          class="relative rounded-2xl p-5 flex flex-col items-center justify-center gap-2 aspect-square border-2 transition hover:-translate-y-1 hover:shadow-md ${
            success ? 'bg-emerald-50 border-emerald-200' : 'bg-violet-50 border-violet-200'
          }">
          <span class="absolute top-2.5 right-2.5 text-[9px] font-black px-2 py-0.5 rounded-full ${success ? 'bg-emerald-500 text-white' : 'bg-violet-500 text-white'}">${success ? '성공적 커리어' : '다채로운 결과'}</span>
          ${rec.deep ? '<span class="absolute top-2.5 left-2.5 text-sm" title="심화 클리어">🌟</span>' : ''}
          <span class="text-4xl ${success ? '' : 'wobble'}">${success ? job.emojiSuccess : job.emojiAlt}</span>
          <p class="text-sm font-extrabold text-slate-700 text-center leading-tight">「${rec.titleName}」</p>
          <p class="text-[11px] text-slate-400">${job.name}</p>
        </button>`;
      })
      .join('') || '<p class="col-span-full text-center text-sm text-slate-400 py-8">검색 결과가 없어요 🔍</p>';

    $('#album-progress').textContent = `${done} / ${getAllJobs().length}`;
  },

  showAlbumDetail(jobId) {
    const job = findJob(jobId);
    const rec = SAVE.records[jobId];
    const success = rec.type === 'success';
    const d = new Date(rec.date);
    const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const modeInfo = MODES[rec.mode] || MODES.light;

    const logHtml = rec.log
      .map(
        (l, i) => `
      <div class="text-left bg-slate-50 rounded-xl p-3">
        <p class="text-[11px] font-bold text-slate-400 mb-1">EP${i + 1}. ${l.q}</p>
        <p class="text-xs font-bold text-indigo-600">→ ${l.choiceText}</p>
      </div>`
      )
      .join('');

    $('#modal-content').innerHTML = `
      <div class="text-center">
        <span class="text-5xl">${success ? job.emojiSuccess : job.emojiAlt}</span>
        <h3 class="text-xl font-black text-slate-800 mt-2">「${rec.titleName}」</h3>
        <p class="text-xs text-slate-400 mb-1">${job.name} · ${modeInfo.emoji} ${modeInfo.short} · ${dateStr} · ${rec.resigned ? `중도 퇴사 (${rec.completed}/${rec.total})` : '완주'} ${rec.deep ? '· 🌟심화' : ''}</p>
        <span class="inline-block text-[10px] font-black px-2.5 py-1 rounded-full mb-2 ${success ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'}">${success ? '🏅 성공적 커리어' : '🎨 다채로운 결과'}</span>
        <p class="text-sm text-slate-500 leading-relaxed mb-4">${rec.titleDesc}</p>
        <p class="text-xs font-bold text-slate-400 text-left mb-2">📜 선택의 기록</p>
        <div class="flex flex-col gap-2 max-h-48 overflow-y-auto mb-4 pr-1">${logHtml || '<p class="text-xs text-slate-400">기록 없음 (즉시 퇴사)</p>'}</div>
        ${rec.mode === 'realistic' ? `<div class="mb-4">${this.careerHtml(job)}</div>` : ''}
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">닫기</button>
      </div>`;
    this.openModal();
  },

  /* ==================== 캐릭터 커스터마이징 ==================== */
  showAvatarCustomizer(firstRun = false) {
    this._draft = { ...SAVE.avatar };
    this.renderCustomizer(firstRun);
    this.openModal();
  },

  renderCustomizer(firstRun = false) {
    const d = this._draft;
    const swatch = (list, key, isColor = true, names = null) =>
      list
        .map(
          (v, i) => `
      <button onclick="UI.pickAvatar('${key}',${i})" title="${names ? names[i] : ''}"
        class="w-8 h-8 rounded-full border-2 transition ${d[key] === i ? 'border-indigo-500 ring-2 ring-indigo-200 scale-110' : 'border-slate-200 hover:border-indigo-300'}"
        style="${isColor ? `background:${v}` : ''}">${isColor ? '' : v}</button>`
        )
        .join('');

    const costumes = getAllJobs()
      .filter((j) => j.costume && SAVE.unlocked.includes(j.costume.id))
      .map((j) => j.costume);

    const costumeHtml =
      `<button onclick="UI.pickAvatar('costume',null)"
        class="px-2.5 py-1.5 rounded-xl border-2 text-[11px] font-bold transition ${!d.costume ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}">👕 기본 의상</button>` +
      costumes
        .map(
          (c) => `
      <button onclick="UI.pickAvatar('costume','${c.id}')"
        class="px-2.5 py-1.5 rounded-xl border-2 text-[11px] font-bold transition ${d.costume === c.id ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}">${c.emoji} ${c.name}</button>`
        )
        .join('');

    $('#modal-content').innerHTML = `
      <div>
        ${firstRun ? '<p class="text-xs font-bold tracking-widest uppercase text-indigo-500 text-center mb-1">Welcome to ProjectJOB!</p>' : ''}
        <h3 class="text-lg font-extrabold text-slate-800 text-center mb-3">${firstRun ? '나만의 캐릭터를 만들어 보세요!' : '🧑‍🎨 캐릭터 꾸미기'}</h3>
        <div class="flex justify-center mb-3 bg-gradient-to-b from-indigo-50 to-pink-50 rounded-2xl py-4">${AvatarSVG.render(d, 110)}</div>
        <div class="flex flex-col gap-3 mb-4">
          <div><p class="text-[11px] font-black text-slate-400 uppercase mb-1.5">피부</p><div class="flex gap-2 flex-wrap">${swatch(AvatarSVG.SKINS, 'skin', true, AvatarSVG.SKIN_NAMES)}</div></div>
          <div><p class="text-[11px] font-black text-slate-400 uppercase mb-1.5">헤어스타일</p><div class="flex gap-1.5 flex-wrap">${AvatarSVG.HAIRS.map((h, i) => `<button onclick="UI.pickAvatar('hair',${i})" class="px-2.5 py-1.5 rounded-xl border-2 text-[11px] font-bold transition ${d.hair === i ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}">${h}</button>`).join('')}</div></div>
          <div><p class="text-[11px] font-black text-slate-400 uppercase mb-1.5">머리 색</p><div class="flex gap-2 flex-wrap">${swatch(AvatarSVG.HAIR_COLORS, 'hairColor', true, AvatarSVG.HAIR_COLOR_NAMES)}</div></div>
          <div><p class="text-[11px] font-black text-slate-400 uppercase mb-1.5">기본 의상 색</p><div class="flex gap-2 flex-wrap">${swatch(AvatarSVG.OUTFITS, 'outfit', true, AvatarSVG.OUTFIT_NAMES)}</div></div>
          <div><p class="text-[11px] font-black text-slate-400 uppercase mb-1.5">코스튬 <span class="font-medium normal-case">(직업 성공 엔딩으로 해금)</span></p><div class="flex gap-1.5 flex-wrap">${costumeHtml}</div></div>
          <div><p class="text-[11px] font-black text-slate-400 uppercase mb-1.5">닉네임</p>
            <input id="nick-input" value="${SAVE.nickname}" maxlength="12"
              class="w-full text-sm font-bold border-2 border-slate-200 rounded-xl px-3 py-2 focus:border-indigo-300 outline-none"/></div>
        </div>
        <button onclick="UI.saveAvatar()" class="w-full py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition mb-2">${firstRun ? '이 모습으로 시작하기!' : '저장하기'}</button>
        ${firstRun ? '' : '<button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">취소</button>'}
      </div>`;
  },

  pickAvatar(key, val) {
    this._draft[key] = key === 'costume' ? (val === 'null' ? null : val) : val;
    const nick = $('#nick-input') ? $('#nick-input').value : SAVE.nickname;
    this.renderCustomizer(false);
    if ($('#nick-input')) $('#nick-input').value = nick;
  },

  saveAvatar() {
    const nick = ($('#nick-input').value || '').trim();
    if (nick) SAVE.nickname = nick;
    SAVE.avatar = { ...this._draft, created: true };
    Storage.save(SAVE);
    this.closeModal();
    this.renderHeader();
    if (!Engine.run) this.renderJobBoard();
    this.renderAlbum();
    this.toast('✨ 캐릭터가 저장되었어요!');
  },

  /* ==================== 공유 목업 ==================== */
  showShareMock() {
    const theme = RoomUI.activeTheme();
    const placed = Object.keys(RoomUI.wallItems())
      .map((id) => RoomUI.allItems().find((i) => i.id === id))
      .filter(Boolean)
      .map((i) => `<span class="text-2xl">${i.emoji}</span>`)
      .join('');
    const records = Object.values(SAVE.records);
    const badges = records
      .slice(0, 12)
      .map((r) => {
        const job = findJob(r.jobId);
        return job ? `<span class="text-lg" title="${r.titleName}">${r.type === 'success' ? job.emojiSuccess : job.emojiAlt}</span>` : '';
      })
      .join(' ');
    const fakeUrl = `projectjob.app/room/${SAVE.nickname}`;

    $('#modal-content').innerHTML = `
      <div>
        <p class="text-xs font-bold tracking-widest uppercase text-indigo-500 mb-1 text-center">Public Profile Preview</p>
        <h3 class="text-lg font-extrabold text-slate-800 mb-4 text-center">다른 플레이어에게 이렇게 보여요</h3>
        <div class="rounded-2xl border border-slate-200 overflow-hidden mb-4">
          <div class="relative h-32" style="background:${theme.bg}">
            <div class="absolute bottom-2 left-3">${AvatarSVG.render(SAVE.avatar, 40)}</div>
            <div class="absolute bottom-2 right-3 flex gap-2">${placed || '<span class="text-xs text-white/80 bg-black/20 px-2 py-1 rounded-full">텅 빈 방</span>'}</div>
          </div>
          <div class="p-4 bg-white">
            <p class="font-extrabold text-slate-800">${SAVE.nickname}</p>
            <p class="text-xs text-slate-400 mb-1">직업 ${records.length}개 경험 · 성실함 ${SAVE.sincerity} · 퀘스트 ${SAVE.quests.length}/${QUESTS.length}</p>
            <div class="flex gap-1 flex-wrap">${badges || '<span class="text-xs text-slate-400">아직 획득한 배지가 없어요</span>'}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5 mb-4">
          <span class="text-xs font-mono text-slate-500 flex-1 truncate">🔗 ${fakeUrl}</span>
          <button onclick="UI.toast('링크가 복사되었어요! (목업)')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800">복사</button>
        </div>
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">닫기</button>
      </div>`;
    this.openModal();
  },

  /* ==================== 설정 ==================== */
  showSettings() {
    const mode = SAVE.settings.mode;
    $('#modal-content').innerHTML = `
      <div>
        <h3 class="text-lg font-extrabold text-slate-800 mb-4">⚙️ 설정</h3>

        <button onclick="UI.showAvatarCustomizer()" class="w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-slate-200 hover:border-indigo-300 transition mb-4">
          <span class="shrink-0">${AvatarSVG.render(SAVE.avatar, 34)}</span>
          <span class="text-left"><p class="text-sm font-extrabold text-slate-700">캐릭터 꾸미기</p><p class="text-[11px] text-slate-400">피부/헤어/의상/코스튬 언제든 변경</p></span>
        </button>

        <p class="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">게임 모드</p>
        <div class="flex flex-col gap-2 mb-5">
          ${Object.values(MODES)
            .map(
              (m) => `
            <button onclick="UI.setModeFromSettings('${m.key}')"
              class="text-left p-3.5 rounded-2xl border-2 transition ${mode === m.key ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'}">
              <p class="text-sm font-extrabold text-slate-700">${m.emoji} ${m.label} ${mode === m.key ? '<span class="text-indigo-500 text-xs">· 사용 중</span>' : ''}</p>
              <p class="text-[11px] text-slate-400 mt-0.5">${m.desc}</p>
            </button>`
            )
            .join('')}
        </div>
        ${Engine.run ? '<p class="text-[11px] text-amber-500 font-bold mb-4">⚠️ 진행 중인 근무에는 적용되지 않고, 다음 취업부터 적용돼요.</p>' : ''}

        <p class="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">직업 데이터 불러오기 (CSV)</p>
        <p class="text-[11px] text-slate-400 mb-2">표준 18열 CSV로 직업을 대량 등록. 현재 CSV 직업: <b>${CSVLoader.imported.length}개</b> · 내장 직업: <b>${JOBS.length}개</b></p>
        <textarea id="csv-input" rows="4" placeholder="ID,Job_Name,Emoji,Mode,Scenario_Step,…"
          class="w-full text-[11px] font-mono border-2 border-slate-200 rounded-xl p-2.5 mb-2 focus:border-indigo-300 outline-none resize-y"></textarea>
        <div class="flex gap-2 mb-5">
          <button onclick="document.querySelector('#csv-input').value = SAMPLE_CSV; UI.toast('샘플 CSV(카페 마스터)를 채웠어요!')"
            class="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">🧪 샘플</button>
          <button onclick="UI.importCSV()" class="flex-1 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 text-white hover:bg-cyan-600 transition">📥 불러오기</button>
          <button onclick="CSVLoader.clear(); UI.ensureBoard(true); UI.renderAll(); UI.showSettings(); UI.toast('CSV 직업을 모두 삭제했어요.')"
            class="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-rose-500 hover:bg-rose-50 transition">🗑️ 삭제</button>
        </div>

        <button onclick="UI.resetAll()" class="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-500 hover:bg-rose-100 transition mb-2">⚠️ 전체 데이터 초기화</button>
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">닫기</button>
      </div>`;
    this.openModal();
  },

  setModeFromSettings(mode) {
    SAVE.settings.mode = mode;
    Storage.save(SAVE);
    if (!Engine.run) this.renderJobBoard();
    this.showSettings();
  },

  importCSV() {
    const text = $('#csv-input').value.trim();
    if (!text) { this.toast('CSV 내용을 붙여넣어 주세요!'); return; }
    try {
      const n = CSVLoader.importText(text);
      this.ensureBoard(true);
      this.renderAll();
      this.showSettings();
      this.toast(`✅ CSV에서 직업 ${n}개를 불러왔어요!`);
    } catch (e) {
      this.toast('❌ CSV 형식 오류: ' + e.message);
    }
  },

  resetAll() {
    $('#modal-content').innerHTML = `
      <div class="text-center">
        <div class="text-5xl mb-3">⚠️</div>
        <h3 class="text-xl font-extrabold text-slate-800 mb-2">정말 초기화할까요?</h3>
        <p class="text-sm text-slate-500 mb-5">모든 기록·보상·마이룸·캐릭터·CSV 데이터가 삭제됩니다.<br/>되돌릴 수 없어요!</p>
        <div class="flex gap-3">
          <button onclick="UI.showSettings()" class="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">취소</button>
          <button onclick="localStorage.clear(); location.reload()" class="flex-1 py-3 rounded-xl font-bold bg-rose-500 text-white hover:bg-rose-600 transition">초기화</button>
        </div>
      </div>`;
  },

  /* ==================== 공용 모달 ==================== */
  openModal() {
    $('#modal-backdrop').classList.remove('hidden');
    requestAnimationFrame(() => $('#modal-backdrop').classList.remove('opacity-0'));
  },

  closeModal() {
    clearInterval(this._adTimer);
    $('#modal-backdrop').classList.add('hidden', 'opacity-0');
    // 대기 중인 히든 퀘스트 팝업 표시
    if (this._questQueue.length) {
      const q = this._questQueue.shift();
      setTimeout(() => { this.fx('fx-flash'); this.showQuestPopup(q); RoomUI.render(); }, 250);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => UI.init());
