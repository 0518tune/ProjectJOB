/* =========================================================
 * ProjectJOB — CSV Data Loader (Phase 2)
 * ---------------------------------------------------------
 * 100개 이상의 직업을 코드 수정 없이 대량 등록하기 위한
 * 표준 CSV 스펙과 파서입니다. (설정 ⚙️ > 직업 데이터 불러오기)
 *
 * ── CSV 컬럼 스펙 (18열, 헤더 필수) ──────────────────────
 *  1 ID                : 직업 고유 영문 ID (예: chef)
 *  2 Job_Name          : 표시 이름 (예: 요리사)
 *  3 Emoji             : 대표 이모지
 *  4 Mode              : light | realistic
 *  5 Scenario_Step     : 1부터 시작하는 시나리오 순번
 *  6 Narration         : 나레이션. 여러 줄은 | 로 구분
 *  7 Question          : 질문
 *  8 Choice_A          : 선택지 A 텍스트
 *  9 Choice_A_Effects  : 효과 (예: performance:2;stress:1;traits.speed:2)
 * 10 Choice_B          : 선택지 B 텍스트
 * 11 Choice_B_Effects  : 효과
 * 12 Choice_C          : 선택지 C 텍스트 (없으면 빈칸)
 * 13 Choice_C_Effects  : 효과
 * 14 Certification_Info: 필요 자격/자격증 (직업당 1회만 기입해도 됨)
 * 15 Competition_Rate  : 경쟁률 정보
 * 16 Outlook_Rating    : 미래 전망 1~5
 * 17 Avg_Salary        : 평균 연봉
 * 18 Interview_Tip     : 면접 팁
 *
 * - 같은 ID의 행들이 하나의 직업으로 묶입니다.
 * - 쉼표가 들어가는 필드는 "큰따옴표"로 감싸세요.
 * - CSV로 등록된 직업의 칭호/보상은 엔진이 자동 생성합니다.
 * ========================================================= */

const CSVLoader = {
  IMPORT_KEY: 'projectjob_csv_v1',
  imported: [], // 파싱된 직업 객체 목록

  PALETTE: ['#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#14b8a6', '#a855f7'],

  /* --- 저수준 CSV 파서 (따옴표/이스케이프 지원) --- */
  parseText(text) {
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some((f) => f.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); if (row.some((f) => f.trim() !== '')) rows.push(row); }
    return rows;
  },

  /* --- 효과 문자열 파싱: "performance:2;traits.eco:1" --- */
  parseEffects(str) {
    const fx = { performance: 0, stress: 0, patience: 0, traits: {} };
    (str || '').split(';').forEach((pair) => {
      const [k, v] = pair.split(':').map((s) => s && s.trim());
      if (!k || v === undefined || isNaN(Number(v))) return;
      if (k.startsWith('traits.')) fx.traits[k.slice(7)] = Number(v);
      else if (k in fx) fx[k] = Number(v);
    });
    return fx;
  },

  /* --- CSV 텍스트 → 직업 객체 배열 --- */
  build(text) {
    const rows = this.parseText(text.trim());
    if (rows.length < 2) throw new Error('데이터 행이 없습니다.');
    const header = rows[0].map((h) => h.trim().toLowerCase());
    if (header[0] !== 'id') throw new Error('첫 열은 ID 헤더여야 합니다.');

    const groups = {}; // id -> { meta, rows }
    for (const r of rows.slice(1)) {
      const id = (r[0] || '').trim();
      if (!id) continue;
      if (!groups[id]) groups[id] = { rows: [] };
      groups[id].rows.push(r);
    }

    const jobs = [];
    let colorIdx = 0;
    for (const [id, g] of Object.entries(groups)) {
      const first = g.rows[0];
      const name = (first[1] || id).trim();
      const emoji = (first[2] || '💼').trim();
      const color = this.PALETTE[colorIdx++ % this.PALETTE.length];

      const modes = { light: { scenarios: [] }, realistic: { scenarios: [] } };
      let career = null;
      for (const r of g.rows) {
        const mode = (r[3] || 'light').trim().toLowerCase();
        if (!modes[mode]) continue;
        const choices = [];
        for (const base of [7, 9, 11]) {
          const txt = (r[base] || '').trim();
          if (txt) choices.push({ text: txt, effects: this.parseEffects(r[base + 1]) });
        }
        if (!choices.length) continue;
        modes[mode].scenarios.push({
          step: Number(r[4]) || modes[mode].scenarios.length + 1,
          narration: (r[5] || '').split('|').map((s) => s.trim()).filter(Boolean),
          q: (r[6] || '').trim(),
          choices,
        });
        if (!career && (r[13] || '').trim()) {
          career = {
            certs: r[13].trim(),
            competition: (r[14] || '-').trim(),
            outlook: Math.min(5, Math.max(1, Number(r[15]) || 3)),
            outlookText: '',
            salary: (r[16] || '-').trim(),
            interviewTip: (r[17] || '-').trim(),
          };
        }
      }
      for (const m of Object.values(modes)) m.scenarios.sort((a, b) => a.step - b.step);
      if (!modes.light.scenarios.length && !modes.realistic.scenarios.length) continue;
      // 한쪽 모드만 있으면 다른 모드에도 재사용 (부족한 데이터 허용)
      if (!modes.light.scenarios.length) modes.light.scenarios = modes.realistic.scenarios.slice(0, 3);
      if (!modes.realistic.scenarios.length) modes.realistic.scenarios = modes.light.scenarios;

      jobs.push(this.makeJob({ id, name, emoji, color, modes, career }));
    }
    return jobs;
  },

  /* --- 칭호/보상 자동 생성 포함 직업 객체 조립 --- */
  makeJob({ id, name, emoji, color, modes, career }) {
    return {
      id, name, emoji, color,
      emojiSuccess: emoji + '😄',
      emojiAlt: emoji + '😅',
      desc: `CSV 데이터로 등록된 직업입니다. ${name}의 세계를 체험해 보세요!`,
      imported: true,
      modes,
      career: career || {
        certs: '데이터 없음', competition: '데이터 없음', outlook: 3,
        outlookText: '', salary: '데이터 없음', interviewTip: '데이터 없음',
      },
      titles: [
        { id: `${id}_ace`, name: `유능한 ${name}`, type: 'success', desc: `동료들이 인정하는 실력파 ${name}입니다.`, cond: (s, c) => s.performance >= c.completed * 1.4 },
        { id: `${id}_alt`, name: `나만의 길을 가는 ${name}`, type: 'alt', desc: `정석과는 다른, 그러나 분명히 당신다운 방식이었습니다.`, cond: (s, c) => s.performance < c.completed * 1.0 },
      ],
      defaultTitle: { id: `${id}_default`, name: `성실한 ${name}`, type: 'success', desc: `묵묵히 제 몫을 해낸 ${name}입니다.` },
      quitterTitle: { id: `${id}_quit`, name: `${name}의 길목에서 돌아선 여행자`, type: 'alt', desc: '이 길은 아니었을 뿐, 여정은 계속됩니다.' },
      deepCond: (s, c) => s.performance >= c.completed * 1.5,
      furniture: { id: `furn_${id}`, name: `${name}의 기념품`, emoji: '🎁' },
      decor: { id: `deco_${id}`, name: `${name}의 소품`, emoji: '🪴' },
      costume: { id: `cos_${id}`, name: `${name} 유니폼`, color, emoji },
    };
  },

  /* --- 저장/복원 --- */
  importText(text) {
    const jobs = this.build(text); // 실패 시 throw
    localStorage.setItem(this.IMPORT_KEY, text);
    this.imported = jobs;
    return jobs.length;
  },

  restore() {
    const raw = localStorage.getItem(this.IMPORT_KEY);
    if (!raw) return;
    try { this.imported = this.build(raw); }
    catch (e) { console.warn('CSV 복원 실패', e); this.imported = []; }
  },

  clear() {
    localStorage.removeItem(this.IMPORT_KEY);
    this.imported = [];
  },
};

/* 전체 직업 목록 = 내장 데이터 + CSV 데이터 */
function getAllJobs() {
  return JOBS.concat(CSVLoader.imported);
}
function findJob(id) {
  return getAllJobs().find((j) => j.id === id);
}

/* 데모용 샘플 CSV — 설정 창의 [샘플 채우기] 버튼에서 사용 */
const SAMPLE_CSV = `ID,Job_Name,Emoji,Mode,Scenario_Step,Narration,Question,Choice_A,Choice_A_Effects,Choice_B,Choice_B_Effects,Choice_C,Choice_C_Effects,Certification_Info,Competition_Rate,Outlook_Rating,Avg_Salary,Interview_Tip
cafe_master,카페 마스터,☕,light,1,카페 첫 출근!|고소한 원두 향이 가게를 가득 채운다.,첫 손님이 "아무거나 맛있는 거"를 주문했다. 무엇을 내릴까?,시그니처 라떼를 자신 있게 추천한다,performance:2;traits.risk:1;traits.creativity:1,취향을 차근차근 물어보고 맞춤 추천한다,performance:1;patience:1;traits.teamwork:2,오늘 볶은 신선한 원두 드립을 권한다,performance:1;traits.perfection:2,바리스타 2급/1급(민간) · 위생교육 이수,카페 창업 포화로 경쟁 치열,3,신입 연 2400~3000만원,라떼아트보다 위생·미소·회전율 감각을 어필하세요.
cafe_master,카페 마스터,☕,light,2,점심 러시아워!|주문이 12잔 밀려 있고 손님 줄이 문밖까지 이어졌다.,밀려드는 주문 폭탄. 어떻게 처리할까?,속도 최우선! 손이 보이지 않게 만든다,performance:2;stress:2;traits.speed:2,한 잔 한 잔 품질을 지키며 만든다,performance:1;stress:1;patience:2;traits.perfection:2,동선을 재배치해 제조 라인을 즉석 개편한다,performance:2;stress:1;traits.analytical:2,,,,,
cafe_master,카페 마스터,☕,light,3,마감 30분 전.|단골손님이 오늘 힘든 일이 있었다며 조용히 앉아 있다.,마감 시간, 지친 단골손님에게 어떻게 할까?,서비스 쿠키와 함께 따뜻한 한마디를 건넨다,performance:1;patience:1;traits.teamwork:2,정중하게 마감 시간을 안내한다,performance:1;traits.perfection:1,신메뉴 시제품을 시음 대접한다,performance:1;traits.creativity:2,,,,,
cafe_master,카페 마스터,☕,realistic,1,오픈 2년 차 카페의 매니저가 되었다.|바로 옆 건물에 대형 프랜차이즈 카페가 입점한다는 공고가 붙었다.,대형 프랜차이즈의 옆 건물 입점 확정. 생존 전략은?,가격 인하로 정면 대응한다,performance:1;stress:2;traits.risk:2,스페셜티 원두와 큐레이션으로 차별화한다,performance:2;stress:1;traits.perfection:2,단골 멤버십과 커뮤니티 이벤트를 강화한다,performance:1;patience:2;traits.teamwork:2,,,,,
cafe_master,카페 마스터,☕,realistic,2,신입 직원이 3주째 라떼아트를 어려워한다.|러시아워마다 제조 속도가 눈에 띄게 느려진다.,성장이 더딘 신입 직원 어떻게 코칭할까?,러시아워에는 제조에서 빼고 포지션을 조정한다,performance:1;traits.speed:2,마감 후 1:1 트레이닝 시간을 만든다,performance:2;stress:2;patience:2;traits.teamwork:2,교육 매뉴얼과 체크리스트 체계를 만든다,performance:2;stress:1;traits.analytical:2,,,,,
cafe_master,카페 마스터,☕,realistic,3,원두 납품가가 30% 인상됐다.|가격을 올리면 단골이 떠날까 두렵다.,치솟는 원가. 메뉴 가격 정책을 어떻게 할까?,과감히 가격을 인상하고 품질로 설득한다,performance:2;stress:1;traits.risk:2,가격은 동결하고 원가 구조를 재설계한다,performance:1;stress:2;patience:2;traits.analytical:2,사이즈·옵션을 세분화해 체감 인상을 낮춘다,performance:1;stress:1;traits.creativity:2,,,,,
cafe_master,카페 마스터,☕,realistic,4,SNS에 우리 카페 위생 관련 허위 리뷰가 올라와 확산 중이다.,사실이 아닌 악성 리뷰 확산. 대응은?,법적 대응을 예고하는 공식 입장문을 낸다,performance:1;stress:2;traits.risk:2,주방 공개 영상으로 투명하게 반박한다,performance:2;stress:1;traits.creativity:2;traits.modern:1,조용히 정정 요청하고 단골 관리에 집중한다,performance:1;patience:2;traits.patience:1,,,,,
cafe_master,카페 마스터,☕,realistic,5,투자자가 2호점 오픈을 제안했다.|지금 매장도 겨우 안정된 상태다.,확장이냐 내실이냐. 당신의 선택은?,지금이 기회다. 2호점 오픈을 추진한다,performance:2;stress:2;traits.risk:2,1호점의 시스템화가 먼저다. 정중히 거절한다,performance:1;patience:2;traits.perfection:2,공동 운영 파트너를 조건으로 수락한다,performance:1;stress:1;traits.teamwork:2,,,,,`;
