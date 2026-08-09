/* =========================================================
 * ProjectJOB — 퀘스트 데이터 구조화 · 흐름 점검 도구
 * ---------------------------------------------------------
 * [설계 의도]
 *   기획자 데이터 존(index.html)에 흩어져 있는 퀘스트 정의를
 *   "한 장의 데이터 테이블"로 평탄화해서, 인게임에서 바로
 *   ① 스키마와 실제 값을 확인하고(구조화)
 *   ② CSV로 빼서 스프레드시트에서 관리하고(유지·관리)
 *   ③ 에피소드 흐름과 데이터 결함을 점검한다(흐름 점검).
 *
 * [구조]
 *   QuestTable   퀘스트 → 행(row) 평탄화 + 스키마 + CSV 내보내기
 *   QuestFlow    에피소드 흐름(노드 그래프) + 엔딩 분기
 *   QuestDoctor  데이터/흐름 결함 자동 점검
 *
 *  세 모듈 모두 순수 함수라 엔진 상태에 의존하지 않는다.
 *  (job, mode)만 넘기면 어떤 직업이든 같은 결과를 낸다.
 * ========================================================= */
'use strict';

/* NPC 캐스팅 규칙은 app.js(UI.npcFor)와 동일해야 한다 — 여기서는 의존 없이 재현한다. */
function questNpcFor(sc, index) {
  return (sc && sc.npc) || NPC_CAST[index % NPC_CAST.length];
}

/** 이 컷에 실제로 걸리는 연출 프리셋 ID와, 그게 데이터 지정인지 자동 배정인지 */
function questCueOf(sc, index, total) {
  if (sc && sc.cue && typeof DIRECTION_PRESETS !== 'undefined' && DIRECTION_PRESETS[sc.cue]) {
    return { id: sc.cue, auto: false };
  }
  const id = typeof DirectionPicker !== 'undefined'
    ? DirectionPicker.pick(sc, { index, total, phase: 'narration' })
    : '기본_투샷';
  return { id, auto: true };
}

/** 에피소드 단계 라벨 — app.js(UI.stageOf)와 동일 규칙 */
function questStageOf(index, total) {
  return index < (total >= 5 ? 2 : 1) ? '실무 투입' : '딜레마 돌파';
}

/** effects → '#분석력+2 #끈기+1' 문자열 */
function traitsToText(fx) {
  return Object.entries((fx && fx.traits) || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `#${TRAIT_LABELS[k] || k}${v > 0 ? '+' : ''}${v}`)
    .join(' ');
}

/* ---------------------------------------------------------
 * 1. QuestTable — 퀘스트 데이터 테이블
 * ------------------------------------------------------- */
const QuestTable = {
  /** 컬럼 스키마. label은 화면 표기, csv는 내보내기 헤더.
   * 순서는 "키 → 구조 → 수치 → 연출 → 문장" 으로 둔다.
   * 좁은 패널에서 가로 스크롤 없이도 기획 판단에 필요한 값이 먼저 보이게 하기 위함. */
  SCHEMA: [
    { key: 'questId',   label: 'QUEST_ID',    csv: 'QUEST_ID',    desc: '퀘스트 고유 키 (직업_모드_에피소드)' },
    { key: 'step',      label: 'STEP',        csv: 'STEP',        desc: '에피소드 순번', num: true },
    { key: 'choiceId',  label: 'CH',          csv: 'CHOICE_ID',   desc: '선택지 식별자 (A/B/C)' },
    { key: 'perf',      label: '성과',        csv: 'PERFORMANCE', desc: '성과 스탯 증감', num: true, signed: true },
    { key: 'stress',    label: '스트',        csv: 'STRESS',      desc: '스트레스 스탯 증감 (+가 나쁨)', num: true, signed: true, inverse: true },
    { key: 'pat',       label: '인내',        csv: 'PATIENCE',    desc: '인내심 스탯 증감', num: true, signed: true },
    { key: 'traits',    label: 'TRAITS',      csv: 'TRAITS',      desc: '성향 태그 증감 (성향 검사 결과지에 누적)' },
    { key: 'cue',       label: 'CUE_ID',      csv: 'CUE_ID',      desc: '연출 프리셋 ID (js/direction.js의 DIRECTION_PRESETS 키)' },
    { key: 'cueSrc',    label: 'SRC',         csv: 'CUE_SOURCE',  desc: '연출 출처 — 지정=데이터에 직접 기입, 자동=DirectionPicker가 톤으로 배정' },
    { key: 'stage',     label: 'STAGE',       csv: 'STAGE',       desc: '진행 단계 (실무 투입 / 딜레마 돌파)' },
    { key: 'speaker',   label: 'SPEAKER',     csv: 'SPEAKER',     desc: '해당 컷에 출연하는 NPC' },
    { key: 'choiceText',label: 'CHOICE_TEXT', csv: 'CHOICE_TEXT', desc: '선택지 문구', wide: true },
    { key: 'question',  label: 'QUESTION',    csv: 'QUESTION',    desc: '플레이어에게 던지는 질문', wide: true },
    { key: 'situation', label: 'SITUATION',   csv: 'SITUATION',   desc: '상황 내레이션', wide: true },
    { key: 'feedback',  label: 'FEEDBACK',    csv: 'FEEDBACK',    desc: '선택 직후 NPC 피드백 대사', wide: true },
  ],

  /** (job, mode) → 선택지 단위로 평탄화한 행 배열 */
  rows(job, mode) {
    const scenarios = ((job.modes || {})[mode] || {}).scenarios || [];
    const total = scenarios.length;
    const out = [];
    scenarios.forEach((sc, i) => {
      const npc = questNpcFor(sc, i);
      const cue = questCueOf(sc, i, total);
      const situation = (sc.narration || []).join(' ');
      (sc.choices || []).forEach((c, ci) => {
        const fx = c.effects || {};
        out.push({
          questId: `${job.id}_${mode}_ep${i + 1}`,
          step: i + 1,
          stage: questStageOf(i, total),
          speaker: npc.name,
          situation,
          question: sc.q || '',
          choiceId: 'ABC'[ci] || String(ci + 1),
          choiceText: c.text || '',
          perf: fx.performance || 0,
          stress: fx.stress || 0,
          pat: fx.patience || 0,
          traits: traitsToText(fx),
          feedback: c.fb || '(범용 피드백 사용)',
          cue: cue.id,
          cueSrc: cue.auto ? '자동' : '지정',
          _epIndex: i,
        });
      });
    });
    return out;
  },

  /** 한눈에 보는 집계 */
  summary(job, mode) {
    const rows = this.rows(job, mode);
    const eps = new Set(rows.map((r) => r.step)).size;
    const cues = new Set(rows.map((r) => r.cue)).size;
    const authored = rows.filter((r) => r.cueSrc === '지정').length;
    return {
      episodes: eps,
      choices: rows.length,
      branches: rows.length,             // 컷마다 선택지 수만큼 분기가 생긴다
      cueKinds: cues,
      cueAuthoredRate: rows.length ? Math.round((authored / rows.length) * 100) : 0,
      traitCoverage: rows.length ? Math.round((rows.filter((r) => r.traits).length / rows.length) * 100) : 0,
    };
  },

  toCSV(job, mode) {
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = this.SCHEMA.map((c) => c.csv).join(',');
    const body = this.rows(job, mode)
      .map((r) => this.SCHEMA.map((c) => esc(r[c.key])).join(','))
      .join('\n');
    return `${head}\n${body}`;
  },

  /** 엑셀이 한글을 깨뜨리지 않도록 BOM을 붙여 내려받는다 */
  download(job, mode) {
    const blob = new Blob(['﻿' + this.toCSV(job, mode)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quest_${job.id}_${mode}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

/* ---------------------------------------------------------
 * 2. QuestFlow — 에피소드 흐름 & 엔딩 분기
 * ------------------------------------------------------- */
const QuestFlow = {
  /** 에피소드 노드 목록 (톤은 선택지 수치에서 역산) */
  nodes(job, mode) {
    const scenarios = ((job.modes || {})[mode] || {}).scenarios || [];
    const total = scenarios.length;
    return scenarios.map((sc, i) => {
      let maxStress = 0, maxPerf = 0;
      (sc.choices || []).forEach((c) => {
        const fx = c.effects || {};
        maxStress = Math.max(maxStress, fx.stress || 0);
        maxPerf = Math.max(maxPerf, fx.performance || 0);
      });
      const tone = maxStress >= 2 ? { key: 'tense', label: '고비', color: '#e0798f' }
        : maxPerf >= 2 ? { key: 'active', label: '승부', color: '#e8a33d' }
        : { key: 'calm', label: '평온', color: '#8fbb72' };
      const cue = questCueOf(sc, i, total);
      return {
        index: i,
        step: i + 1,
        stage: questStageOf(i, total),
        npc: questNpcFor(sc, i).name,
        choices: (sc.choices || []).length,
        cue: cue.id,
        cueAuto: cue.auto,
        tone,
        maxStress,
        maxPerf,
      };
    });
  },

  /** 마지막 컷 이후의 판정 분기.
   * 조건식은 JobBinder(index.html)가 모든 직업에 동일하게 부여하는 규칙을 문장화한 것. */
  endings(job, mode) {
    const list = [];
    if (mode === 'realistic') {
      list.push({ type: 'deep', name: '히든 심층 엔딩', desc: '완주 + 성과 매우 높고 스트레스 낮음', color: '#c98a3c' });
    }
    const ok = (job.titles || [])[0];
    if (ok) list.push({ type: 'success', name: ok.name, desc: '완주 + 성과 ≥ 컷수×1.1, 스트레스 ≤ 컷수×1.8', color: '#6fa85c' });
    if (job.defaultTitle) list.push({ type: 'alt', name: job.defaultTitle.name, desc: '완주했지만 성공 조건 미달 (별종 루트)', color: '#7cb8d4' });
    if (job.quitterTitle) list.push({ type: 'quit', name: job.quitterTitle.name, desc: '3컷 미만에서 사직서 제출 (조기 퇴사)', color: '#cf5f77' });
    return list;
  },
};

/* ---------------------------------------------------------
 * 3. QuestDoctor — 데이터/흐름 자동 점검
 *    "돌려보지 않아도 보이는 문제"를 잡아 유지·관리 비용을 줄인다.
 * ------------------------------------------------------- */
const QuestDoctor = {
  check(job, mode) {
    const scenarios = ((job.modes || {})[mode] || {}).scenarios || [];
    const total = scenarios.length;
    const found = [];
    const add = (level, where, msg, fix) => found.push({ level, where, msg, fix });

    let prevCue = null;
    let tenseStreak = 0;

    scenarios.forEach((sc, i) => {
      const at = `EP${i + 1}`;
      const choices = sc.choices || [];

      if (!sc.q) add('warn', at, '질문(QUESTION)이 비어 있습니다.', '기획자 데이터 존의 `질문` 칸을 채우세요.');
      if (!(sc.narration || []).join('')) add('warn', at, '상황(SITUATION)이 비어 있습니다.', '`상황` 칸을 채우세요.');
      if (choices.length < 3) add('warn', at, `선택지가 ${choices.length}개뿐입니다.`, '분기 체감을 위해 3개를 권장합니다.');

      const noTrait = choices.every((c) => !traitsToText(c.effects));
      if (choices.length && noTrait) {
        add('warn', at, '성향 태그(#)가 붙은 선택지가 없습니다.', '성향 검사 결과지에 반영되지 않는 컷입니다. 점수 칸에 #태그를 추가하세요.');
      }

      const sigs = choices.map((c) => {
        const fx = c.effects || {};
        return `${fx.performance || 0}|${fx.stress || 0}|${fx.patience || 0}|${traitsToText(fx)}`;
      });
      if (sigs.length > 1 && new Set(sigs).size === 1) {
        add('warn', at, '모든 선택지의 효과 수치가 동일합니다.', '선택의 의미가 사라집니다. 최소 한 축은 다르게 주세요.');
      }

      const cue = questCueOf(sc, i, total).id;
      if (prevCue && cue === prevCue) {
        add('info', `EP${i}·EP${i + 1}`, `연출이 연속으로 「${cue}」입니다.`, '같은 그림이 반복되면 리듬이 단조로워집니다. 한쪽에 `연출:` 을 지정해 보세요.');
      }
      prevCue = cue;

      let maxStress = 0;
      choices.forEach((c) => { maxStress = Math.max(maxStress, (c.effects || {}).stress || 0); });
      tenseStreak = maxStress >= 2 ? tenseStreak + 1 : 0;
      if (tenseStreak === 3) {
        add('info', `EP${i - 1}~EP${i + 1}`, '고비 구간이 3연속입니다.', '숨 돌릴 컷을 사이에 넣으면 마지막 결단이 더 크게 느껴집니다.');
      }
    });

    // 마지막 컷은 결단 계열 연출로 닫히는 게 좋다
    if (total) {
      const lastCue = questCueOf(scenarios[total - 1], total - 1, total).id;
      const preset = typeof DIRECTION_PRESETS !== 'undefined' ? DIRECTION_PRESETS[lastCue] : null;
      const tags = (preset && preset.태그) || [];
      if (!tags.includes('결단') && !tags.includes('클라이맥스') && !tags.includes('마무리')) {
        add('info', `EP${total}`, `마지막 컷 연출이 「${lastCue}」입니다.`, '`결단_로우앵글`이나 `따뜻한_마무리`로 닫으면 마무리감이 살아납니다.');
      }
    }

    return found;
  },
};
