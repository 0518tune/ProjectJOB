/* =========================================================
 * ProjectJOB — 인게임 연출 시퀀스 시스템 (Direction Runtime)
 * ---------------------------------------------------------
 * [설계 의도]
 *   퀘스트 한 컷의 "연출"을 코드가 아니라 데이터(큐시트)로 기술한다.
 *   기획자는 아래 DIRECTION_PRESETS 테이블에 프리셋을 한 줄 추가하고,
 *   기획자 데이터 존(index.html)의 시나리오 행에 `연출:'프리셋ID'` 만
 *   적으면 카메라 워크 · 캐릭터 동선 · 감정 모션이 그대로 재생된다.
 *
 * [구조]
 *   CAMERA_SHOTS      샷(카메라 위치/피사체/화각) 정의 테이블
 *   ACTOR_MARKS       무대 위 스탠딩 마크(위치) 정의 테이블
 *   DIRECTION_PRESETS 연출 프리셋 = 큐시트(시간축 이벤트 목록)
 *   Director          큐시트를 실제 3D 무대에 재생하는 런타임
 *   DirectionPicker   연출 지정이 없는 컷에 톤 기반으로 프리셋 자동 배정
 *
 * [큐 스키마] — 모든 큐는 t(초, 컷 시작 기준)를 가진다
 *   { t, 샷:'투샷',  전환:0.9, 이징:'easeOut' }   카메라 샷 전환
 *   { t, 흔들림:0.6, 지속:0.4 }                    카메라 셰이크(강도 0~1)
 *   { t, 화각:30, 전환:0.8 }                       렌즈(줌)
 *   { t, 배우:'npc', 마크:'좌측', 전환:0.9, 걷기:true }  캐릭터 동선
 *   { t, 배우:'pc',  회전:-20, 전환:0.5 }          캐릭터 방향 전환(도)
 *   { t, 배우:'pc',  모션:'기쁨' }                  감정 모션(1회성)
 *   { t, 화면:'플래시' | '암전' }                   화면 전환 효과
 * ========================================================= */
'use strict';

/* ---------------------------------------------------------
 * 1. 카메라 샷 테이블
 *    pos  : 카메라 위치 [x, y, z]
 *    look : 바라보는 지점 [x, y, z]
 *    fov  : 세로 화각(작을수록 망원/압축감, 클수록 광각/개방감)
 * ------------------------------------------------------- */
/* ※ 수치는 실제 무대 뷰포트(약 3.1:1의 가로로 긴 레터박스 프레임)에서
 *   한 샷씩 렌더해 확인하며 맞춘 값이다. 세로 화각(fov)이 프레임 높이를
 *   결정하므로, 프레임이 낮은 이 무대에서는 look 지점의 y를 인물 머리보다
 *   살짝 높게 잡아야 머리 위 여백(헤드룸)이 확보된다. */
const CAMERA_SHOTS = {
  와이드:      { id: 'wide',        pos: [0, 1.9, 4.7],      look: [0, 1.18, 0],     fov: 39, 의도: '공간 전체를 보여주는 설정샷. 컷의 시작/마무리에 사용.' },
  투샷:        { id: 'twoshot',     pos: [0, 1.5, 4.1],      look: [0, 1.05, 0],     fov: 38, 의도: '두 인물을 동등하게 담는 기본 대화샷.' },
  타이트투샷:  { id: 'tight2s',     pos: [0, 1.45, 3.1],     look: [0, 1.15, 0],     fov: 34, 의도: '투샷보다 한 발 다가선 밀착 대화샷. 몰입 상승.' },
  클로즈업_상대:{ id: 'cu_npc',     pos: [-0.4, 1.7, 2.55],  look: [-0.85, 1.62, 0], fov: 29, 의도: 'NPC 얼굴 클로즈업. 대사에 무게가 실릴 때.' },
  클로즈업_나: { id: 'cu_pc',       pos: [0.4, 1.7, 2.55],   look: [0.85, 1.62, 0],  fov: 29, 의도: '플레이어 클로즈업. 선택의 무게를 체감시킬 때.' },
  오버숄더_상대:{ id: 'os_npc',     pos: [-2.2, 1.8, 1.9],   look: [0.85, 1.35, 0],  fov: 32, 의도: 'NPC 어깨 너머로 나를 본다. 추궁·압박 상황.' },
  오버숄더_나: { id: 'os_pc',       pos: [2.2, 1.8, 1.9],    look: [-0.85, 1.35, 0], fov: 32, 의도: '내 어깨 너머로 NPC를 본다. 관찰·경청 상황.' },
  로우앵글:    { id: 'low',         pos: [0, 0.6, 3.5],      look: [0, 1.2, 0],      fov: 34, 의도: '아래에서 올려다본다. 결단·각오의 순간을 크게.' },
  하이앵글:    { id: 'high',        pos: [0, 3.2, 3.2],      look: [0, 0.7, 0],      fov: 40, 의도: '위에서 내려다본다. 무력감·전체 조망.' },
  측면:        { id: 'side',        pos: [3.6, 1.72, 2.9],   look: [-0.15, 1.2, 0],  fov: 30, 의도: '옆에서 두 사람의 거리감을 보여준다.' },
};

/* ---------------------------------------------------------
 * 2. 스탠딩 마크 테이블 (무대 바닥 좌표 [x, z])
 *    캐릭터 동선은 좌표를 직접 쓰지 않고 마크 이름으로 지시한다.
 *    → 무대 크기가 바뀌어도 큐시트를 고칠 필요가 없다.
 * ------------------------------------------------------- */
const ACTOR_MARKS = {
  좌측:     [-0.85, 0],
  우측:     [0.85, 0],
  좌측깊게: [-1.35, -0.5],
  우측깊게: [1.35, -0.5],
  좌측앞:   [-0.5, 0.55],
  우측앞:   [0.5, 0.55],
  중앙:     [0, 0.1],
  중앙뒤:   [0, -0.8],
};

/* ---------------------------------------------------------
 * 3. 연출 프리셋 테이블 ★ 기획자 편집 구역 ★
 *    id      : 시나리오 행의 `연출:` 값으로 쓰는 키
 *    이름/의도: 기획 문서용 메타(연출 노트 패널에 그대로 노출된다)
 *    태그    : 자동 배정(DirectionPicker)이 참고하는 분위기 태그
 *    큐시트  : 시간축 이벤트 목록
 * ------------------------------------------------------- */
const DIRECTION_PRESETS = {

  기본_투샷: {
    이름: '기본 투샷', 태그: ['평온', '기본'],
    의도: '특별한 사건이 없는 일상 대화. 카메라는 개입하지 않고 두 사람을 나란히 담는다.',
    큐시트: [
      { t: 0.0, 샷: '투샷', 전환: 0.7, 이징: 'easeOut' },
      { t: 0.0, 배우: 'npc', 마크: '좌측', 회전: -28, 전환: 0.7 },
      { t: 0.0, 배우: 'pc', 마크: '우측', 회전: 28, 전환: 0.7 },
    ],
  },

  도입_와이드풀인: {
    이름: '도입 · 와이드 → 풀인', 태그: ['도입', '평온'],
    의도: '에피소드의 첫 컷. 넓게 열어 장소를 보여준 뒤 천천히 밀어 들어가 대화로 진입시킨다.',
    큐시트: [
      { t: 0.0, 샷: '와이드', 전환: 0.0 },
      { t: 0.0, 배우: 'npc', 마크: '좌측깊게', 회전: -20, 전환: 0.0 },
      { t: 0.0, 배우: 'pc', 마크: '우측깊게', 회전: 20, 전환: 0.0 },
      { t: 0.35, 배우: 'npc', 마크: '좌측', 회전: -28, 전환: 1.5, 걷기: true },
      { t: 0.35, 배우: 'pc', 마크: '우측', 회전: 28, 전환: 1.5, 걷기: true },
      { t: 0.5, 샷: '투샷', 전환: 1.7, 이징: 'easeInOut' },
    ],
  },

  등장_합류동선: {
    이름: '등장 · NPC 합류 동선', 태그: ['도입', '따뜻함'],
    의도: '먼저 서 있는 나에게 NPC가 걸어와 합류한다. 새 인물이 붙는 컷에서 관계의 시작을 보여준다.',
    큐시트: [
      { t: 0.0, 샷: '측면', 전환: 0.0 },
      { t: 0.0, 배우: 'pc', 마크: '우측', 회전: 15, 전환: 0.0 },
      { t: 0.0, 배우: 'npc', 마크: '중앙뒤', 회전: 0, 전환: 0.0 },
      { t: 0.3, 배우: 'npc', 마크: '좌측', 회전: -28, 전환: 1.4, 걷기: true },
      { t: 0.9, 샷: '투샷', 전환: 1.2, 이징: 'easeInOut' },
      { t: 1.7, 배우: 'npc', 모션: '끄덕' },
    ],
  },

  긴장_클로즈업: {
    이름: '긴장 · 상대 클로즈업', 태그: ['긴장', '딜레마'],
    의도: '상대의 한마디가 상황을 조이는 순간. 얼굴로 붙어 도망갈 공간을 없앤다.',
    큐시트: [
      { t: 0.0, 샷: '타이트투샷', 전환: 0.5, 이징: 'easeOut' },
      { t: 0.35, 배우: 'npc', 마크: '좌측앞', 회전: -38, 전환: 0.8, 걷기: true },
      { t: 0.6, 샷: '클로즈업_상대', 전환: 1.0, 이징: 'easeInOut' },
      { t: 1.4, 배우: 'npc', 모션: '고민' },
    ],
  },

  압박_오버숄더: {
    이름: '압박 · 오버숄더 추궁', 태그: ['긴장', '딜레마'],
    의도: '상대의 어깨 너머로 나를 본다. 카메라가 상대 편에 서면서 플레이어가 몰리는 느낌을 만든다.',
    큐시트: [
      { t: 0.0, 샷: '투샷', 전환: 0.4 },
      { t: 0.25, 배우: 'npc', 마크: '좌측앞', 회전: -55, 전환: 0.9, 걷기: true },
      { t: 0.4, 샷: '오버숄더_상대', 전환: 1.1, 이징: 'easeInOut' },
      { t: 1.3, 배우: 'pc', 모션: '움츠림' },
    ],
  },

  당황_흔들림: {
    이름: '당황 · 카메라 셰이크', 태그: ['돌발', '긴장'],
    의도: '사고·사고 직전의 돌발 상황. 셰이크로 리듬을 깨고 즉시 인물 반응으로 잇는다.',
    큐시트: [
      { t: 0.0, 샷: '타이트투샷', 전환: 0.25, 이징: 'easeOut' },
      { t: 0.1, 흔들림: 0.85, 지속: 0.5 },
      { t: 0.1, 배우: 'pc', 모션: '당황' },
      { t: 0.55, 샷: '클로즈업_나', 전환: 0.7, 이징: 'easeOut' },
      { t: 1.3, 샷: '투샷', 전환: 0.9, 이징: 'easeInOut' },
    ],
  },

  고민_등돌림: {
    이름: '고민 · 등 돌리고 사이드', 태그: ['고민', '딜레마'],
    의도: '결정을 앞두고 혼자 생각하는 컷. 인물이 상대에게서 물러서고 카메라는 옆으로 빠져 거리감을 만든다.',
    큐시트: [
      { t: 0.0, 샷: '투샷', 전환: 0.4 },
      { t: 0.2, 배우: 'pc', 마크: '우측깊게', 회전: 125, 전환: 1.1, 걷기: true },
      { t: 0.3, 샷: '측면', 전환: 1.3, 이징: 'easeInOut' },
      { t: 1.2, 배우: 'pc', 모션: '고민' },
      { t: 1.4, 배우: 'npc', 회전: -10, 전환: 0.6 },
    ],
  },

  결단_로우앵글: {
    이름: '결단 · 로우앵글', 태그: ['결단', '클라이맥스'],
    의도: '마지막 선택 직전. 아래에서 올려다보며 인물을 크게 만들고 각오를 시각화한다.',
    큐시트: [
      { t: 0.0, 샷: '타이트투샷', 전환: 0.5 },
      { t: 0.3, 배우: 'pc', 마크: '중앙', 회전: 0, 전환: 0.9, 걷기: true },
      { t: 0.3, 배우: 'npc', 마크: '좌측깊게', 회전: -15, 전환: 0.9, 걷기: true },
      { t: 0.5, 샷: '로우앵글', 전환: 1.2, 이징: 'easeInOut' },
      { t: 1.5, 배우: 'pc', 모션: '끄덕' },
    ],
  },

  무력감_하이앵글: {
    이름: '무력감 · 하이앵글', 태그: ['좌절', '고민'],
    의도: '어찌할 도리가 없는 상황. 위에서 내려다보며 인물을 작게 만들어 압박을 전한다.',
    큐시트: [
      { t: 0.0, 샷: '하이앵글', 전환: 1.0, 이징: 'easeInOut' },
      { t: 0.2, 배우: 'pc', 마크: '우측', 회전: 20, 전환: 0.8 },
      { t: 0.7, 배우: 'pc', 모션: '움츠림' },
      { t: 1.6, 샷: '투샷', 전환: 1.2, 이징: 'easeInOut' },
    ],
  },

  기쁨_점프: {
    이름: '기쁨 · 점프 & 팔로우', 태그: ['성과', '따뜻함'],
    의도: '성과가 터진 순간. 인물이 뛰고 카메라가 살짝 물러나 감정을 열어 준다.',
    큐시트: [
      { t: 0.0, 샷: '타이트투샷', 전환: 0.5, 이징: 'easeOut' },
      { t: 0.15, 배우: 'pc', 모션: '기쁨' },
      { t: 0.3, 배우: 'npc', 모션: '끄덕' },
      { t: 0.5, 샷: '와이드', 전환: 1.3, 이징: 'easeInOut' },
    ],
  },

  따뜻한_마무리: {
    이름: '따뜻한 마무리 · 풀백', 태그: ['마무리', '따뜻함'],
    의도: '컷을 닫는 연출. 두 사람이 나란히 정면을 보고 카메라가 뒤로 빠지며 여운을 남긴다.',
    큐시트: [
      { t: 0.0, 샷: '투샷', 전환: 0.5 },
      { t: 0.25, 배우: 'npc', 마크: '좌측앞', 회전: -8, 전환: 1.1, 걷기: true },
      { t: 0.25, 배우: 'pc', 마크: '우측앞', 회전: 8, 전환: 1.1, 걷기: true },
      { t: 0.8, 샷: '와이드', 전환: 1.6, 이징: 'easeInOut' },
      { t: 1.5, 배우: 'npc', 모션: '끄덕' },
      { t: 1.7, 배우: 'pc', 모션: '끄덕' },
    ],
  },
};

/* ---------------------------------------------------------
 * 4. Director — 큐시트 재생 런타임
 *    Scene3D.Stage.rig() 이 넘겨주는 논리 카메라/배우 핸들을
 *    시간축에 따라 보간(트윈)한다. 3D가 없는 환경에서는 조용히 무시.
 * ------------------------------------------------------- */
const Director = {
  presetId: null,   // 현재 재생 중인 프리셋 ID
  log: [],          // 실행된 큐 기록 (연출 노트 패널이 읽는다)
  _cues: null,
  _tweens: [],
  _raf: null,
  _t0: 0,
  _enabled: true,

  EASING: {
    linear: (p) => p,
    easeOut: (p) => 1 - Math.pow(1 - p, 3),
    easeIn: (p) => p * p * p,
    easeInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  },

  setEnabled(on) {
    this._enabled = !!on;
    if (!on) this.stop();
  },

  /** 프리셋 조회 (없는 ID는 기본 투샷으로 폴백) */
  preset(id) {
    return DIRECTION_PRESETS[id] || DIRECTION_PRESETS.기본_투샷;
  },

  /**
   * 큐시트 재생 시작.
   * @param {string} presetId  DIRECTION_PRESETS 키
   * @param {object} opts      { instant: true → 트윈 없이 최종 상태로 스냅 }
   */
  play(presetId, opts = {}) {
    const rig = (typeof Scene3D !== 'undefined' && Scene3D.Stage.rig) ? Scene3D.Stage.rig() : null;
    this.presetId = DIRECTION_PRESETS[presetId] ? presetId : '기본_투샷';
    this.log = [];
    this.stop();
    if (!rig || !this._enabled) return;

    const preset = this.preset(this.presetId);
    this._cues = preset.큐시트.map((c, i) => ({ ...c, _i: i, _fired: false }));
    this._t0 = performance.now();

    if (opts.instant) {
      // 트윈 없이 큐시트의 최종 상태만 즉시 적용 (탭 복귀·리렌더 시 깜빡임 방지)
      this._cues.forEach((c) => this._fire(c, rig, true));
      this._cues = null;
      return;
    }
    this._loop(rig);
  },

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._cues = null;
    this._tweens = [];
  },

  /** 재생 중 여부 */
  get playing() { return !!this._raf; },

  _loop(rig) {
    const tick = () => {
      const now = performance.now();
      const t = (now - this._t0) / 1000;

      if (this._cues) {
        for (const c of this._cues) {
          if (!c._fired && t >= (c.t || 0)) { c._fired = true; this._fire(c, rig, false); }
        }
      }
      // 진행 중인 트윈 갱신
      this._tweens = this._tweens.filter((tw) => {
        const p = tw.dur <= 0 ? 1 : Math.min(1, (now - tw.start) / (tw.dur * 1000));
        tw.apply(tw.ease(p), p);
        return p < 1;
      });

      const cuesDone = !this._cues || this._cues.every((c) => c._fired);
      if (cuesDone && !this._tweens.length) { this._raf = null; this._cues = null; return; }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  },

  /** 큐 하나를 실제 무대에 반영 */
  _fire(cue, rig, instant) {
    const dur = instant ? 0 : (cue.전환 !== undefined ? cue.전환 : 0.6);
    const ease = this.EASING[cue.이징] || this.EASING.easeInOut;
    const rec = { t: cue.t || 0, 내용: '', 원본: cue };

    /* --- 카메라 샷 전환 --- */
    if (cue.샷) {
      const shot = CAMERA_SHOTS[cue.샷];
      if (shot) {
        const cam = rig.cam;
        const from = { pos: cam.pos.slice(), look: cam.look.slice(), fov: cam.fov };
        this._tween(dur, ease, (e) => {
          for (let i = 0; i < 3; i++) {
            cam.pos[i] = from.pos[i] + (shot.pos[i] - from.pos[i]) * e;
            cam.look[i] = from.look[i] + (shot.look[i] - from.look[i]) * e;
          }
          cam.fov = from.fov + (shot.fov - from.fov) * e;
        });
        rec.내용 = `🎥 카메라 → ${cue.샷} (${dur}s)`;
      }
    }

    /* --- 렌즈(화각) 단독 조작 --- */
    if (cue.화각 !== undefined) {
      const cam = rig.cam;
      const f0 = cam.fov, f1 = cue.화각;
      this._tween(dur, ease, (e) => { cam.fov = f0 + (f1 - f0) * e; });
      rec.내용 += `${rec.내용 ? ' / ' : ''}🔍 화각 ${f0.toFixed(0)}° → ${f1}°`;
    }

    /* --- 카메라 셰이크 --- */
    if (cue.흔들림 !== undefined && !instant) {
      rig.shake(cue.흔들림, cue.지속 || 0.4);
      rec.내용 += `${rec.내용 ? ' / ' : ''}💥 셰이크 ${cue.흔들림}`;
    }

    /* --- 캐릭터 동선 / 방향 / 모션 --- */
    if (cue.배우) {
      const actor = rig.actors[cue.배우];
      if (actor) {
        const root = actor.root;
        if (cue.마크 && ACTOR_MARKS[cue.마크]) {
          const [tx, tz] = ACTOR_MARKS[cue.마크];
          const x0 = root.position.x, z0 = root.position.z;
          if (cue.걷기 && !instant) actor.walking = true;
          this._tween(dur, ease, (e, p) => {
            root.position.x = x0 + (tx - x0) * e;
            root.position.z = z0 + (tz - z0) * e;
            if (p >= 1) actor.walking = false;
          });
          rec.내용 += `${rec.내용 ? ' / ' : ''}🚶 ${cue.배우} 동선 → ${cue.마크}`;
        }
        if (cue.회전 !== undefined) {
          const r0 = root.rotation.y, r1 = (cue.회전 * Math.PI) / 180;
          this._tween(dur, ease, (e) => { root.rotation.y = r0 + (r1 - r0) * e; });
          rec.내용 += `${rec.내용 ? ' / ' : ''}↩️ ${cue.배우} 회전 ${cue.회전}°`;
        }
        if (cue.모션 && !instant) {
          rig.emote(cue.배우, cue.모션);
          rec.내용 += `${rec.내용 ? ' / ' : ''}🎭 ${cue.배우} 모션 「${cue.모션}」`;
        }
      }
    }

    /* --- 화면 효과 --- */
    if (cue.화면 && !instant && typeof UI !== 'undefined' && UI.fx) {
      UI.fx(cue.화면 === '플래시' ? 'fx-flash' : 'fx-dim');
      rec.내용 += `${rec.내용 ? ' / ' : ''}✨ 화면 ${cue.화면}`;
    }

    if (rec.내용) this.log.push(rec);
  },

  _tween(dur, ease, apply) {
    if (dur <= 0) { apply(1, 1); return; }
    this._tweens.push({ start: performance.now(), dur, ease, apply });
  },
};

/* ---------------------------------------------------------
 * 5. DirectionPicker — 연출 자동 배정
 *    시나리오 행에 `연출:`이 없어도 컷의 위치와 선택지 수치(톤)를 읽어
 *    어울리는 프리셋을 고른다. 기획자는 마음에 안 드는 컷만 명시하면 된다.
 * ------------------------------------------------------- */
const DirectionPicker = {
  /**
   * @param {object} sc     시나리오 객체 (choices/cue 포함)
   * @param {object} ctx    { index, total, phase }
   * @returns {string} 프리셋 ID
   */
  pick(sc, ctx) {
    if (sc && sc.cue && DIRECTION_PRESETS[sc.cue]) return sc.cue;

    const { index = 0, total = 5, phase = 'narration' } = ctx || {};
    const isFirst = index === 0;
    const isLast = index >= total - 1;

    // 선택지 수치의 최대 스트레스/성과로 컷의 톤을 추정한다.
    let maxStress = 0, maxPerf = 0;
    for (const c of (sc && sc.choices) || []) {
      const fx = c.effects || {};
      maxStress = Math.max(maxStress, fx.stress || 0);
      maxPerf = Math.max(maxPerf, fx.performance || 0);
    }

    if (phase === 'choices') {
      if (isLast) return '결단_로우앵글';
      if (maxStress >= 2) return '고민_등돌림';
      return '압박_오버숄더';
    }
    // 내레이션(상황 제시) 구간
    if (isFirst) return '도입_와이드풀인';
    if (isLast) return '결단_로우앵글';
    if (maxStress >= 2) return '당황_흔들림';
    if (maxPerf >= 2) return '긴장_클로즈업';
    return index % 2 === 0 ? '등장_합류동선' : '기본_투샷';
  },

  /** 선택 직후 피드백 컷의 연출 — 결과 톤에 따라 반응 연출을 고른다 */
  pickFeedback(fx) {
    if ((fx.stress || 0) >= 2) return '무력감_하이앵글';
    if ((fx.performance || 0) >= 2) return '기쁨_점프';
    return '따뜻한_마무리';
  },
};
