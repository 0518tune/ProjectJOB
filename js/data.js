/* =========================================================
 * ProjectJOB — Job Data Layer (Phase 3)
 * ---------------------------------------------------------
 * 구성:
 *  1) BESPOKE_JOBS : 정성 제작된 3개 직업 (풀 시나리오)
 *  2) JOB_META     : 27개 확장 직업 메타데이터
 *                    → buildTemplateJob()이 시나리오를 자동 생성
 *                    → 나중에 이 배열만 갈아끼우면 콘텐츠 교체 완료
 *  3) THEMES       : 배경 테마 (히든 퀘스트로만 해금)
 *  4) QUESTS       : 히든 퀘스트 정의
 *
 * 직업 공통 스키마:
 *  { id, name, emoji, color, desc, traitProfile,
 *    modes:{light:{scenarios[3]}, realistic:{scenarios[5]}},
 *    career:{certs,competition,outlook,outlookText,salary,interviewTip},
 *    titles[], defaultTitle, quitterTitle, deepCond(s,ctx),
 *    furniture{}, decor{}, costume{} }
 * ========================================================= */

/* ------------------------------------------------------ *
 * 1. 정성 제작 직업 3종
 * ------------------------------------------------------ */
const BESPOKE_JOBS = [
  {
    id: 'farmer',
    name: '농사꾼',
    emoji: '👨‍🌾',
    emojiSuccess: '🌾😄',
    emojiAlt: '🥀😅',
    desc: '흙과 함께 사계절을 보내는 삶. 자연과 기술 사이, 당신의 농사 철학은?',
    color: '#84cc16',
    traitProfile: { eco: 3, patience: 2, teamwork: 1 },
    modes: {
      light: {
        scenarios: [
          {
            narration: ['시골 첫 출근 날, 아침 6시.', '수탉이 우렁차게 울고, 밭이 당신을 기다린다.'],
            q: '오늘의 첫 일과, 무엇부터 시작할까?',
            choices: [
              { text: '밭에 쪼그려 앉아 잡초부터 뽑는다.', effects: { performance: 1, stress: 1, patience: 2, traits: { patience: 2 } } },
              { text: '반짝반짝한 트랙터부터 시운전한다!', effects: { performance: 1, stress: 0, patience: 0, traits: { modern: 2, speed: 1 } } },
              { text: '이장님 댁부터 인사를 돌며 마을 정보를 얻는다.', effects: { performance: 1, stress: 0, patience: 1, traits: { teamwork: 2 } } },
            ],
          },
          {
            narration: ['점심 무렵, 상추밭에서 사각사각 소리가 들린다.', '벌레들이 상추 뷔페를 즐기고 있다!'],
            q: '벌레 손님들을 어떻게 돌려보낼까?',
            choices: [
              { text: '한 마리씩 정성껏 손으로 잡아낸다.', effects: { performance: 1, stress: 2, patience: 2, traits: { eco: 2, patience: 1 } } },
              { text: '친환경 약제를 슥슥 뿌리고 마무리!', effects: { performance: 2, stress: 0, patience: 0, traits: { speed: 2 } } },
              { text: '천적인 무당벌레 부대를 투입한다.', effects: { performance: 1, stress: 1, patience: 1, traits: { creativity: 2, eco: 2 } } },
            ],
          },
          {
            narration: ['드디어 첫 수확의 날!', '바구니 한가득 채소가 반짝인다.'],
            q: '이 소중한 첫 수확물, 어떻게 할까?',
            choices: [
              { text: '새벽 시장에 들고 나가 직접 판다.', effects: { performance: 2, stress: 1, patience: 1, traits: { speed: 1 } } },
              { text: '이웃들과 나눠 먹으며 정을 쌓는다.', effects: { performance: 1, stress: 0, patience: 1, traits: { teamwork: 2, eco: 1 } } },
              { text: 'SNS에 수확 브이로그를 올려 자랑한다.', effects: { performance: 1, stress: 0, patience: 0, traits: { modern: 2, creativity: 1 } } },
            ],
          },
        ],
      },
      realistic: {
        scenarios: [
          {
            narration: ['영농 2년 차 여름. 아침 순찰 중 잎 뒷면에서 낯선 반점을 발견했다.', '옆 마을에서는 이미 병충해로 밭 절반을 갈아엎었다는 소문이 돈다.'],
            q: '병충해 확산 조짐이 보인다. 초기 대응 전략은?',
            choices: [
              { text: '등록 약제를 즉시 전면 살포해 빠르게 진압한다.', effects: { performance: 2, stress: 1, patience: 0, traits: { speed: 2, eco: -1 } } },
              { text: '친환경 방제로 전환하고 매일 수작업 예찰을 병행한다.', effects: { performance: 1, stress: 2, patience: 2, traits: { eco: 2 } } },
              { text: '센서·드론 기반 정밀 방제 시스템 도입을 결정한다.', effects: { performance: 1, stress: 1, patience: 0, traits: { modern: 2, analytical: 1 } } },
            ],
          },
          {
            narration: ['출하 직전, 기상 앱이 요란하게 울린다. 초강력 폭우 예보.', '작물은 아직 덜 익었다. 지금 따면 헐값, 버티면 최고 등급 아니면 전멸.'],
            q: '출하 직전 폭우 예보. 지금 수확할까, 위험을 감수하고 버틸까?',
            choices: [
              { text: '덜 익은 상태로 지금 전량 수확해 저가에라도 판다. (안정)', effects: { performance: 1, stress: 1, patience: 0, traits: { speed: 2 } } },
              { text: '폭우를 견뎌내고 고품질·고가 출하에 승부를 건다. (고위험)', effects: { performance: 2, stress: 2, patience: 2, traits: { risk: 2, patience: 1 } } },
              { text: '절반만 선수확하고, 남은 밭은 배수·방풍을 보강해 버틴다. (분산)', effects: { performance: 2, stress: 1, patience: 1, traits: { analytical: 2 } } },
            ],
          },
          {
            narration: ['풍년이다. 그러나 전국적인 과잉 생산으로 도매가가 40% 폭락했다.', '창고에는 출하를 기다리는 작물이 산더미다.'],
            q: '팔수록 손해라는 계산이 나온다. 판로 전략은?',
            choices: [
              { text: '손해를 감수하고 도매상에 전량 넘겨 현금을 확보한다.', effects: { performance: 0, stress: 0, patience: 0, traits: { speed: 2 } } },
              { text: '라이브커머스 직거래로 전환해 유통 마진을 없앤다.', effects: { performance: 2, stress: 2, patience: 1, traits: { modern: 2, risk: 1, creativity: 1 } } },
              { text: '이웃 농가와 출하 조절 협동조합을 조직한다.', effects: { performance: 1, stress: 1, patience: 2, traits: { teamwork: 2, eco: 1 } } },
            ],
          },
          {
            narration: ['모내기 철. 고령화된 마을에 일손이 절대적으로 부족하다.', '어르신들이 품앗이를 부탁하지만, 우리 밭 일정도 빠듯하다.'],
            q: '내 일정과 마을 공동체 사이, 어떻게 균형을 잡을까?',
            choices: [
              { text: '우리 밭이 우선이다. 사정을 설명하고 정중히 거절한다.', effects: { performance: 1, stress: 0, patience: 0, traits: { speed: 1 } } },
              { text: '이틀을 온전히 내어 마을 모내기에 합류한다.', effects: { performance: 0, stress: 2, patience: 2, traits: { teamwork: 2, eco: 1 } } },
              { text: '드론 파종기를 빌려드리고 조작법을 교육한다.', effects: { performance: 1, stress: 1, patience: 1, traits: { modern: 2, teamwork: 1 } } },
            ],
          },
          {
            narration: ['수확한 사과의 절반이 우박 자국으로 상품성이 떨어진다.', '맛과 당도는 최상급인데, 마트 납품 기준에는 미달이다.'],
            q: 'B급 사과 20톤. 이 재고를 어떻게 처리할까?',
            choices: [
              { text: '브랜드 가치를 지키기 위해 전량 폐기한다.', effects: { performance: 1, stress: 1, patience: 0, traits: { perfection: 2 } } },
              { text: '"못난이 사과" 기획전으로 스토리텔링 판매한다.', effects: { performance: 2, stress: 1, patience: 1, traits: { creativity: 2, eco: 2 } } },
              { text: '착즙 주스 가공 라인에 투자해 신제품을 만든다.', effects: { performance: 2, stress: 2, patience: 1, traits: { modern: 1, analytical: 1, risk: 1 } } },
            ],
          },
        ],
      },
    },
    career: {
      certs: '유기농업기능사, 농산물품질관리사, 농기계운전기능사 (필수는 아니나 지원사업 가점)',
      competition: '진입 경쟁은 낮으나 판로·경영 경쟁이 치열. 청년후계농 선발 약 4:1',
      outlook: 3,
      outlookText: '고령화로 세대교체 수요 증가, 스마트팜·직거래 역량 보유 시 전망 양호',
      salary: '초기 연 2,500~3,500만원 (경영 규모·작목에 따라 편차 매우 큼)',
      interviewTip: '귀농 면접·지원사업 심사에서는 "낭만"보다 구체적인 영농 계획서와 자금 계획이 당락을 가릅니다.',
    },
    titles: [
      { id: 'farmer_eco', name: '자연을 담는 농부', type: 'success', desc: '땅을 살리는 방식으로 결실을 맺었습니다. 당신의 밭에는 벌레도 행복하게 삽니다.', cond: (s, c) => (s.traits.eco || 0) >= c.completed * 0.8 },
      { id: 'farmer_smart', name: '스마트팜 개척자', type: 'success', desc: '호미 대신 데이터를 든 농부. 미래의 농업이 당신의 밭에서 시작됩니다.', cond: (s, c) => (s.traits.modern || 0) >= c.completed * 0.8 },
      { id: 'farmer_hasty', name: '질주하는 농사꾼', type: 'alt', desc: '작물보다 마음이 먼저 자라는 타입. 속도는 최고지만, 밭은 조금 어리둥절합니다.', cond: (s, c) => (s.traits.speed || 0) >= c.completed * 0.8 && s.performance < c.completed * 1.2 },
    ],
    defaultTitle: { id: 'farmer_default', name: '성실한 농사꾼', type: 'success', desc: '화려하진 않지만 꾸준히 밭을 일군 진짜 농부입니다.' },
    quitterTitle: { id: 'farmer_quit', name: '새참의 낭만가', type: 'alt', desc: '농사보다 새참의 매력을 먼저 발견하고 떠났습니다. 언젠가 다시 밭이 부를 거예요.' },
    deepCond: (s, c) => s.performance >= c.completed * 1.3 && s.stress <= c.completed * 1.5,
    furniture: { id: 'furn_farmer', name: '수확 바구니', emoji: '🧺' },
    decor: { id: 'deco_farmer', name: '들꽃 화분', emoji: '🌼' },
    costume: { id: 'cos_farmer', name: '햇살 농부 작업복', color: '#65a30d', emoji: '🌾' },
  },

  {
    id: 'marketer',
    name: '마케터',
    emoji: '📣',
    emojiSuccess: '📈😎',
    emojiAlt: '📉🙃',
    desc: '트렌드의 최전선에서 사람들의 마음을 훔치는 일. 오늘도 대박 아니면 쪽박!',
    color: '#f472b6',
    traitProfile: { risk: 3, creativity: 2, analytical: 2 },
    modes: {
      light: {
        scenarios: [
          {
            narration: ['마케팅팀 첫 출근!', '팀장님이 다짜고짜 회사 SNS 계정을 맡긴다.'],
            q: '첫 게시물, 무엇을 올릴까?',
            choices: [
              { text: '요즘 유행하는 밈으로 눈길을 사로잡는다.', effects: { performance: 2, stress: 1, patience: 0, traits: { risk: 2, creativity: 2 } } },
              { text: '제품 소개를 깔끔하고 정직하게 올린다.', effects: { performance: 1, stress: 0, patience: 1, traits: { perfection: 2 } } },
              { text: '팔로우 이벤트를 열어 사람부터 모은다.', effects: { performance: 1, stress: 1, patience: 1, traits: { teamwork: 1, creativity: 1 } } },
            ],
          },
          {
            narration: ['신제품 출시 D-3.', '광고 카피가 아직도 정해지지 않았다!'],
            q: '어떤 카피로 승부할까?',
            choices: [
              { text: '"안 사면 후회함" — 자극적이고 트렌디하게!', effects: { performance: 2, stress: 1, patience: 0, traits: { risk: 2, creativity: 1 } } },
              { text: '"3년 연구한 기능성" — 정직한 정보 전달.', effects: { performance: 1, stress: 0, patience: 1, traits: { perfection: 1, analytical: 1 } } },
              { text: 'AI에게 타겟 데이터를 주고 카피를 뽑아본다.', effects: { performance: 1, stress: 1, patience: 1, traits: { analytical: 2, modern: 1 } } },
            ],
          },
          {
            narration: ['일주일 뒤, 조회수 그래프가 잠잠하다.', '팀장님의 눈빛이 애매하게 흔들린다.'],
            q: '정체된 조회수, 어떻게 돌파할까?',
            choices: [
              { text: '남은 예산으로 광고를 확 태운다!', effects: { performance: 2, stress: 2, patience: 0, traits: { risk: 2 } } },
              { text: '댓글 하나하나에 답하며 팬을 만든다.', effects: { performance: 1, stress: 1, patience: 2, traits: { teamwork: 2, patience: 1 } } },
              { text: '유입 데이터를 뜯어보고 원인부터 찾는다.', effects: { performance: 1, stress: 1, patience: 1, traits: { analytical: 2 } } },
            ],
          },
        ],
      },
      realistic: {
        scenarios: [
          {
            narration: ['신제품 런칭 캠페인의 총괄을 맡았다.', '카피 하나로 첫 주 매출이 갈린다는 걸 모두가 알고 있다.'],
            q: '메인 광고 카피의 방향을 정해야 한다.',
            choices: [
              { text: '자극적이고 트렌디한 밈 기반 카피로 화제성을 노린다.', effects: { performance: 2, stress: 1, patience: 0, traits: { risk: 2, creativity: 2 } } },
              { text: '제품 기능과 검증 데이터를 정직하게 전달한다.', effects: { performance: 1, stress: 0, patience: 1, traits: { perfection: 1 } } },
              { text: '타겟 세그먼트 데이터를 분석해 AI로 카피를 도출한다.', effects: { performance: 1, stress: 1, patience: 1, traits: { analytical: 2, modern: 1 } } },
            ],
          },
          {
            narration: ['새벽 2시, 알림이 쏟아진다. 집행 중인 광고에 성차별적 요소가 있다는 네티즌 항의가 빗발친다.', '실시간 검색어에 브랜드가 오르내리고, 대표의 전화가 울린다.'],
            q: '광고 논란 확산 중. 내리고 사과할까, 노이즈 기회로 삼을까?',
            choices: [
              { text: '즉시 광고를 내리고 공식 사과문을 발표한다. (리스크 관리)', effects: { performance: 1, stress: 1, patience: 1, traits: { perfection: 2 } } },
              { text: '노이즈 마케팅 기회로 삼아 광고를 유지하고 화제성을 키운다. (공격적)', effects: { performance: 2, stress: 2, patience: 0, traits: { risk: 2, creativity: 1 } } },
              { text: '여론 데이터를 실시간 분석하며 단계적 대응 시점을 잰다.', effects: { performance: 0, stress: 1, patience: 2, traits: { analytical: 2, patience: 1 } } },
            ],
          },
          {
            narration: ['분기 마케팅 예산 3억이 확정됐다.', '경영진은 "이번 분기 안에 성과를 보여달라"고 못 박았다.'],
            q: '한정된 예산, 어디에 집중 투자할까?',
            choices: [
              { text: '톱스타 모델을 기용한 대형 캠페인 한 방에 건다.', effects: { performance: 2, stress: 2, patience: 0, traits: { risk: 2 } } },
              { text: 'ROAS가 검증된 퍼포먼스 채널에 안정 분산한다.', effects: { performance: 1, stress: 0, patience: 1, traits: { analytical: 1, perfection: 1 } } },
              { text: '마이크로 인플루언서 100명과 실험 캠페인을 돌린다.', effects: { performance: 1, stress: 1, patience: 2, traits: { analytical: 2, creativity: 1, modern: 1 } } },
            ],
          },
          {
            narration: ['디자이너가 기획안과 전혀 다른 방향의 시안을 가져왔다.', '그런데… 솔직히 내 안보다 좋아 보인다.'],
            q: '데이터에 근거한 내 기획 vs 디자이너의 감각. 결정은?',
            choices: [
              { text: '기획은 데이터가 근거다. 원안 기준으로 수정 요청한다.', effects: { performance: 1, stress: 1, patience: 0, traits: { analytical: 1, perfection: 1 } } },
              { text: '디자이너의 감각을 믿고 캠페인 판을 다시 짠다.', effects: { performance: 1, stress: 1, patience: 1, traits: { teamwork: 2, risk: 1 } } },
              { text: '두 안 모두 제작해 A/B 테스트로 결판낸다.', effects: { performance: 2, stress: 2, patience: 1, traits: { analytical: 2, teamwork: 1 } } },
            ],
          },
          {
            narration: ['캠페인 론칭 전날 밤 9시.', '대표가 "느낌이 안 온다"며 전면 수정을 요구했다.'],
            q: '론칭까지 15시간. 어떻게 대응할까?',
            choices: [
              { text: '밤을 새워 대표의 방향대로 전면 재작업한다.', effects: { performance: 1, stress: 3, patience: 1, traits: { speed: 2 } } },
              { text: '성과 예측 데이터를 들고 가 원안을 설득한다.', effects: { performance: 2, stress: 1, patience: 1, traits: { analytical: 2, risk: 1 } } },
              { text: '핵심 메시지는 지키고 디테일만 조정하는 절충안을 낸다.', effects: { performance: 1, stress: 1, patience: 2, traits: { teamwork: 2, patience: 1 } } },
            ],
          },
        ],
      },
    },
    career: {
      certs: '필수 자격증 없음. 구글애널리틱스(GAIQ), 검색광고마케터 1급, 콘텐츠 포트폴리오가 실질 스펙',
      competition: '신입 공채 기준 약 30:1 내외 (인기 브랜드는 100:1 이상)',
      outlook: 4,
      outlookText: '디지털 전환으로 수요 지속 증가. 데이터 분석 겸비형 마케터 특히 유망',
      salary: '신입 연 3,000~4,500만원 (업계·성과급 구조에 따라 상이)',
      interviewTip: '"열정" 대신 숫자로 말하세요. 직접 운영한 채널의 도달·전환 수치가 최고의 자기소개서입니다.',
    },
    titles: [
      { id: 'marketer_trend', name: '트렌드 리더', type: 'success', desc: '위험을 즐기고 대박을 터뜨리는 승부사. 당신이 만지면 밈이 됩니다.', cond: (s, c) => (s.traits.risk || 0) >= c.completed * 0.8 && s.performance >= c.completed * 1.3 },
      { id: 'marketer_data', name: '데이터 연금술사', type: 'success', desc: '숫자 속에서 소비자의 마음을 읽어냅니다. 감이 아니라 근거로 이기는 타입.', cond: (s, c) => (s.traits.analytical || 0) >= c.completed * 1.1 },
      { id: 'marketer_idle', name: '느긋한 관찰자', type: 'alt', desc: '지켜보는 것도 전략입니다. 다만 분기가 끝나기 전에 움직여야 한다는 게 함정.', cond: (s, c) => s.performance < c.completed * 1.1 },
    ],
    defaultTitle: { id: 'marketer_default', name: '믿음직한 마케터', type: 'success', desc: '화려하진 않아도 브랜드를 단단하게 키워낸 실속파 마케터입니다.' },
    quitterTitle: { id: 'marketer_quit', name: '미팅 간 마케터', type: 'alt', desc: '"미팅 다녀올게요"가 마지막 인사가 되었습니다. 어딘가에서 더 좋은 트렌드를 찾았기를.' },
    deepCond: (s, c) => s.performance >= c.completed * 1.5,
    furniture: { id: 'furn_marketer', name: '골든 트로피', emoji: '🏆' },
    decor: { id: 'deco_marketer', name: '네온 사인', emoji: '💡' },
    costume: { id: 'cos_marketer', name: '트렌디 캠페인 수트', color: '#db2777', emoji: '📣' },
  },

  {
    id: 'engineer',
    name: '소프트웨어 엔지니어',
    emoji: '💻',
    emojiSuccess: '💻😄',
    emojiAlt: '🔥🫠',
    desc: '커피를 코드로 변환하는 직업. 오늘도 버그와의 전쟁이 시작된다.',
    color: '#38bdf8',
    traitProfile: { analytical: 3, perfection: 2, modern: 1 },
    modes: {
      light: {
        scenarios: [
          {
            narration: ['개발팀 첫 출근!', '새 노트북과 함께 개발 환경 셋업 미션이 떨어졌다.'],
            q: '개발 환경, 어떻게 세팅할까?',
            choices: [
              { text: '옆자리 선배의 설정 파일을 통째로 복사한다.', effects: { performance: 1, stress: 0, patience: 0, traits: { speed: 2 } } },
              { text: '공식 문서를 읽으며 차근차근 직접 세팅한다.', effects: { performance: 1, stress: 1, patience: 2, traits: { perfection: 2, patience: 1 } } },
              { text: '선배에게 커피를 사며 페어 셋업을 부탁한다.', effects: { performance: 1, stress: 0, patience: 1, traits: { teamwork: 2 } } },
            ],
          },
          {
            narration: ['오후 3시, 갑자기 화면에 빨간 에러가 가득!', '내가 만진 적 없는 곳에서 버그가 났다.'],
            q: '수수께끼의 버그, 어떻게 잡을까?',
            choices: [
              { text: '일단 껐다 켠다. 만능 해결책이지!', effects: { performance: 1, stress: 0, patience: 0, traits: { speed: 2 } } },
              { text: '로그를 한 줄씩 추적하며 범인을 찾는다.', effects: { performance: 2, stress: 1, patience: 2, traits: { analytical: 2, perfection: 1 } } },
              { text: '팀 채널에 공유하고 같이 디버깅하자고 한다.', effects: { performance: 1, stress: 0, patience: 1, traits: { teamwork: 2 } } },
            ],
          },
          {
            narration: ['금요일, 사내 데모 데이!', '내가 만든 기능을 전 직원 앞에서 시연해야 한다.'],
            q: '어떤 데모를 보여줄까?',
            choices: [
              { text: '어젯밤 완성한 화려한 신기능으로 승부한다!', effects: { performance: 2, stress: 2, patience: 0, traits: { risk: 2, creativity: 1 } } },
              { text: '검증이 끝난 안정적인 기능만 시연한다.', effects: { performance: 1, stress: 0, patience: 1, traits: { perfection: 2 } } },
              { text: '팀원들과 합동 시나리오 데모를 준비한다.', effects: { performance: 1, stress: 1, patience: 1, traits: { teamwork: 2 } } },
            ],
          },
        ],
      },
      realistic: {
        scenarios: [
          {
            narration: ['배포 1시간 전, 최종 점검 중 치명적인 보안 버그를 발견했다.', '마케팅팀은 이미 출시 카운트다운 이벤트를 시작했다. 일정이냐, 안전이냐.'],
            q: '배포 1시간 전 발견된 치명적 보안 버그. 당신의 결정은?',
            choices: [
              { text: '출시 일정을 미루고 밤을 새워서라도 완전히 수정한다. (완벽주의)', effects: { performance: 2, stress: 2, patience: 2, traits: { perfection: 2 } } },
              { text: '일단 예정대로 배포하고 핫픽스 패치로 대응한다. (속도 중심)', effects: { performance: 1, stress: 1, patience: 0, traits: { speed: 2, risk: 2 } } },
              { text: '취약 기능만 기능 플래그로 잠근 채 배포하고 모니터링을 건다. (절충)', effects: { performance: 2, stress: 1, patience: 1, traits: { analytical: 2, modern: 1 } } },
            ],
          },
          {
            narration: ['10년 묵은 레거시 모듈에서 치명적 버그를 발견했다.', '주석은 없고, 작성자는 퇴사했으며, 이 코드를 이해하는 사람은 아무도 없다.'],
            q: '건드리면 무너질 것 같은 레거시. 어떻게 처리할까?',
            choices: [
              { text: '증상만 막는 임시 패치를 대고 이슈로 남겨둔다.', effects: { performance: 1, stress: 0, patience: 0, traits: { speed: 2, risk: 1 } } },
              { text: '일주일이 걸려도 근본 원인을 추적해 제대로 고친다.', effects: { performance: 2, stress: 2, patience: 2, traits: { perfection: 2, analytical: 1 } } },
              { text: '모듈 전체 리팩토링을 기술 부채 안건으로 상정한다.', effects: { performance: 1, stress: 2, patience: 1, traits: { teamwork: 2, modern: 1 } } },
            ],
          },
          {
            narration: ['신규 프로젝트 킥오프.', '기술 스택 결정권이 당신에게 주어졌다. 팀의 1년이 이 선택에 달렸다.'],
            q: '프로젝트의 운명을 가를 기술 스택, 무엇을 기준으로 정할까?',
            choices: [
              { text: '커뮤니티가 뜨거운 최신 프레임워크를 과감히 도입한다.', effects: { performance: 1, stress: 1, patience: 0, traits: { modern: 2, risk: 2 } } },
              { text: '팀 전원이 익숙한 검증된 스택을 유지한다.', effects: { performance: 1, stress: 0, patience: 1, traits: { teamwork: 2, perfection: 1 } } },
              { text: '핵심 시나리오로 벤치마크를 돌려 데이터로 결정한다.', effects: { performance: 2, stress: 1, patience: 2, traits: { analytical: 2 } } },
            ],
          },
          {
            narration: ['정성껏 작성한 PR에 리뷰 코멘트 30개가 달렸다.', '작성자는 입사 6개월 차 후배. 코멘트 하나하나가 꽤 날카롭다.'],
            q: '30개의 수정 요청, 어떻게 소화할까?',
            choices: [
              { text: '"좋은 지적이네요" — 타당한 것은 전부 수용한다.', effects: { performance: 1, stress: 2, patience: 2, traits: { teamwork: 2, patience: 1 } } },
              { text: '코멘트마다 기술적 근거를 달아 건설적 토론을 연다.', effects: { performance: 2, stress: 2, patience: 1, traits: { analytical: 2, perfection: 1 } } },
              { text: '핵심 3개만 반영하고 나머지는 후속 PR로 미룬다.', effects: { performance: 1, stress: 0, patience: 0, traits: { speed: 2 } } },
            ],
          },
          {
            narration: ['새벽 3시, 온콜 알림이 울린다.', '데이터베이스 응답 없음. 서비스 전면 장애. 분당 손실이 쌓이고 있다.'],
            q: '서비스 전면 장애 발생. 첫 조치는?',
            choices: [
              { text: '즉시 재시작으로 복구부터. 원인 분석은 날이 밝으면.', effects: { performance: 1, stress: 1, patience: 0, traits: { speed: 2, risk: 1 } } },
              { text: '로그와 메트릭을 파며 근본 원인을 찾을 때까지 판다.', effects: { performance: 2, stress: 3, patience: 2, traits: { perfection: 2, analytical: 2 } } },
              { text: '장애 대응 프로세스대로 팀을 소집해 역할을 분담한다.', effects: { performance: 2, stress: 2, patience: 1, traits: { teamwork: 2 } } },
            ],
          },
        ],
      },
    },
    career: {
      certs: '정보처리기사 (공공/대기업 우대). 실무에서는 GitHub 포트폴리오·프로젝트 경험이 핵심',
      competition: '신입 공채 20~80:1 (직무·기업별 편차 큼). 경력직 수요는 꾸준히 높음',
      outlook: 5,
      outlookText: 'AI·클라우드 확산으로 장기 수요 최상위. 단, 주니어 진입장벽은 상승 추세',
      salary: '신입 연 4,000~6,000만원 (IT 대기업·유니콘 기준, 중소기업은 3,000만원대)',
      interviewTip: '코딩테스트는 기본기, 면접의 승부처는 "왜 그렇게 설계했는가"입니다. 프로젝트의 기술적 의사결정을 설명할 수 있어야 합니다.',
    },
    titles: [
      { id: 'engineer_slayer', name: '버그 파괴자', type: 'success', desc: '버그가 당신을 보면 스스로 사라집니다. 근본 원인을 끝까지 추적하는 집념의 엔지니어.', cond: (s, c) => (s.traits.perfection || 0) + (s.traits.analytical || 0) >= c.completed * 1.3 && s.performance >= c.completed * 1.3 },
      { id: 'engineer_pillar', name: '팀의 든든한 기둥', type: 'success', desc: '혼자 잘하는 개발자보다 팀을 잘 굴리는 개발자. 당신이 있으면 야근이 줄어듭니다.', cond: (s, c) => (s.traits.teamwork || 0) >= c.completed * 0.9 },
      { id: 'engineer_copier', name: '자유로운 코드 여행자', type: 'alt', desc: '세상의 모든 코드는 연결되어 있다는 철학의 소유자. 출처를 기억하는 습관만 더하면 완벽합니다.', cond: (s, c) => (s.traits.speed || 0) >= c.completed * 0.8 && s.performance < c.completed * 1.3 },
    ],
    defaultTitle: { id: 'engineer_default', name: '오늘도 무사히 배포', type: 'success', desc: '화려한 기술은 없어도 서비스는 오늘도 잘 돌아갑니다. 그게 제일 어려운 일입니다.' },
    quitterTitle: { id: 'engineer_quit', name: '흔적 없는 개발자', type: 'alt', desc: '커밋 하나 남기지 않은 깔끔한 퇴장. git blame조차 당신을 찾지 못합니다.' },
    deepCond: (s, c) => s.performance >= c.completed * 1.5 && s.stress <= c.completed * 1.9,
    furniture: { id: 'furn_engineer', name: '듀얼 모니터 데스크', emoji: '🖥️' },
    decor: { id: 'deco_engineer', name: '러버덕', emoji: '🐥' },
    costume: { id: 'cos_engineer', name: '개발자 후드티', color: '#0284c7', emoji: '💻' },
  },
];

/* ------------------------------------------------------ *
 * 2. 확장 직업 27종 메타데이터 (총 30개)
 *    — 이 배열만 교체하면 콘텐츠를 통째로 갈아끼울 수 있음
 *    tp: traitProfile (AI 추천/유사도 계산에 사용)
 * ------------------------------------------------------ */
const JOB_META = [
  { id: 'chef', name: '요리사', emoji: '🍳', color: '#f97316', desc: '불과 칼의 예술가. 한 접시에 하루의 승부를 건다.', tp: { perfection: 3, creativity: 2, speed: 1 }, career: { certs: '조리기능사(한식/양식 등), 위생교육 이수', competition: '유명 레스토랑 채용 50:1 내외', outlook: 4, salary: '신입 연 2,800~3,600만원', tip: '화려한 플레이팅보다 기본기와 위생 습관을 먼저 보여주세요.' } },
  { id: 'webtoon', name: '웹툰작가', emoji: '🎨', color: '#a855f7', desc: '마감과 싸우며 세계를 창조하는 이야기꾼.', tp: { creativity: 3, patience: 2, perfection: 1 }, career: { certs: '자격증보다 포트폴리오·연재 경험', competition: '정식 연재 데뷔 경쟁 매우 치열', outlook: 4, salary: '연재 작가 편당 고료+수익배분 (편차 극심)', tip: '완결 경험이 있는 단편 포트폴리오가 최고의 명함입니다.' } },
  { id: 'firefighter', name: '소방관', emoji: '🚒', color: '#ef4444', desc: '누군가 도망쳐 나올 때 뛰어 들어가는 사람.', tp: { teamwork: 3, speed: 2, patience: 1 }, career: { certs: '소방공무원 공채 (체력+필기), 응급구조사 우대', competition: '공채 경쟁률 약 15~25:1', outlook: 4, salary: '공무원 호봉제 + 위험수당', tip: '체력 시험은 커트라인이 아니라 만점을 목표로 준비하세요.' } },
  { id: 'ai_engineer', name: 'AI엔지니어', emoji: '🤖', color: '#06b6d4', desc: '기계에게 생각하는 법을 가르치는 최전선 개척자.', tp: { analytical: 3, modern: 3 }, career: { certs: '학위/논문 또는 모델 포트폴리오, 클라우드 자격증 우대', competition: '경력직 수요 폭증, 신입 문은 좁음', outlook: 5, salary: '신입 연 5,000만원~ (상위 기업 1억+)', tip: '모델을 "써본" 경험이 아니라 "만들고 개선한" 경험을 말하세요.' } },
  { id: 'nurse', name: '간호사', emoji: '💉', color: '#f472b6', desc: '3교대 속에서도 환자의 손을 놓지 않는 사람.', tp: { patience: 3, teamwork: 2, perfection: 1 }, career: { certs: '간호사 국가고시 (간호학과 졸업 필수)', competition: '대형병원 신규 채용 10:1 내외', outlook: 5, salary: '신입 연 3,500~4,500만원 (병원 규모별)', tip: '태움 걱정보다 프리셉터십 제도와 부서 문화를 질문하는 지원자가 강합니다.' } },
  { id: 'teacher', name: '초등교사', emoji: '🏫', color: '#22c55e', desc: '한 교실에서 서른 개의 우주를 키우는 일.', tp: { patience: 3, teamwork: 2, creativity: 1 }, career: { certs: '교대 졸업 + 임용고시', competition: '임용 경쟁률 지역별 2~10:1', outlook: 3, salary: '공무원 호봉제', tip: '수업 시연은 완벽한 진행보다 아이들과의 상호작용을 보여주는 자리입니다.' } },
  { id: 'youtuber', name: '유튜버', emoji: '📹', color: '#f43f5e', desc: '구독과 좋아요 사이, 알고리즘의 파도를 타는 서퍼.', tp: { creativity: 3, risk: 2, modern: 2 }, career: { certs: '자격증 없음. 채널 데이터가 곧 이력서', competition: '상위 1%가 수익 대부분 차지', outlook: 3, salary: '수익 0원~수십억 (극단적 편차)', tip: '장비보다 업로드 주기. 100개를 올려본 사람만 아는 것이 있습니다.' } },
  { id: 'game_designer', name: '게임기획자', emoji: '🎮', color: '#8b5cf6', desc: '재미를 설계하는 사람. 밸런스 시트 뒤의 마법사.', tp: { creativity: 2, analytical: 2, teamwork: 1 }, career: { certs: '자격증보다 역기획서·기획 포트폴리오', competition: '신입 공채 30~50:1', outlook: 4, salary: '신입 연 3,000~4,000만원', tip: '"이 게임 재밌어요"가 아니라 "왜 재밌는지"를 분해해서 설명하세요.' } },
  { id: 'fashion_designer', name: '패션디자이너', emoji: '👗', color: '#ec4899', desc: '천과 실로 시대의 감성을 재단하는 사람.', tp: { creativity: 3, perfection: 2 }, career: { certs: '패션디자인산업기사, 포트폴리오 필수', competition: '브랜드 디자인실 채용 소수 정예', outlook: 3, salary: '신입 연 2,800~3,500만원', tip: '트렌드 분석과 원가 감각을 갖춘 디자이너가 오래 살아남습니다.' } },
  { id: 'vet', name: '수의사', emoji: '🐶', color: '#14b8a6', desc: '말하지 못하는 환자의 통증을 읽어내는 의사.', tp: { patience: 2, perfection: 2, eco: 1 }, career: { certs: '수의사 국가고시 (수의대 6년)', competition: '수의대 입시가 최대 관문', outlook: 4, salary: '신입 연 3,500~4,500만원', tip: '반려동물 보호자와의 커뮤니케이션 능력이 실력만큼 중요합니다.' } },
  { id: 'police', name: '경찰관', emoji: '🚓', color: '#3b82f6', desc: '일상의 평화를 지키는 가장 가까운 제복.', tp: { teamwork: 2, speed: 2, patience: 1 }, career: { certs: '경찰공무원 공채 (필기+체력+면접)', competition: '공채 경쟁률 10~20:1', outlook: 4, salary: '공무원 호봉제 + 수당', tip: '법 지식 암기보다 상황 판단 문제에서 침착함을 보여주세요.' } },
  { id: 'flight_attendant', name: '항공승무원', emoji: '✈️', color: '#0ea5e9', desc: '3만 피트 위에서 안전과 미소를 책임지는 프로.', tp: { teamwork: 3, perfection: 2 }, career: { certs: '어학 성적(토익 등), 안전훈련 이수', competition: '대형 항공사 100:1 이상', outlook: 3, salary: '신입 연 3,000~4,000만원 + 비행수당', tip: '외모보다 "비상시 침착하게 팀으로 움직일 사람인가"를 봅니다.' } },
  { id: 'architect', name: '건축가', emoji: '📐', color: '#64748b', desc: '도면 위에 사람의 삶을 설계하는 예술가.', tp: { perfection: 3, analytical: 2, creativity: 2 }, career: { certs: '건축사 자격 (실무수련 3년+시험)', competition: '건축사 시험 합격률 10%대', outlook: 3, salary: '신입 연 3,000~3,800만원', tip: '멋진 조감도보다 법규·구조를 아는 디자인이 신뢰를 얻습니다.' } },
  { id: 'accountant', name: '회계사', emoji: '🧾', color: '#10b981', desc: '숫자의 숲에서 진실을 찾아내는 탐정.', tp: { analytical: 3, perfection: 3 }, career: { certs: 'KICPA (공인회계사 시험)', competition: '연 1,100명 선발, 수년 수험 일반적', outlook: 4, salary: '빅4 신입 연 5,000만원 내외', tip: '시즌(감사기간)의 강도를 버틸 체력과 꼼꼼함을 어필하세요.' } },
  { id: 'progamer', name: '프로게이머', emoji: '🕹️', color: '#6366f1', desc: '0.1초의 반응속도에 커리어를 거는 승부사.', tp: { speed: 3, analytical: 2, risk: 1 }, career: { certs: '랭킹과 대회 성적이 전부', competition: '프로 데뷔 확률 극히 낮음, 선수 수명 짧음', outlook: 3, salary: '연봉 편차 극심 (최저 연봉제~수십억)', tip: '은퇴 후 커리어(코치/방송)까지 그려둔 선수가 팀에서도 환영받습니다.' } },
  { id: 'photographer', name: '사진작가', emoji: '📷', color: '#f59e0b', desc: '찰나를 영원으로 바꾸는 빛의 사냥꾼.', tp: { creativity: 3, patience: 2 }, career: { certs: '자격증 무관, 포트폴리오와 인맥', competition: '프리랜서 시장 포화', outlook: 3, salary: '건당 수입 (스튜디오 취업 시 연 2,500~3,200만원)', tip: '장르(웨딩/제품/보도)를 빨리 정하고 그 분야 포트폴리오를 파세요.' } },
  { id: 'trainer', name: '헬스트레이너', emoji: '💪', color: '#fb7185', desc: '몸과 마음의 한계를 함께 넘어주는 파트너.', tp: { patience: 2, teamwork: 2, speed: 1 }, career: { certs: '생활스포츠지도사 2급, NSCA 등', competition: '자격 취득은 쉬우나 지명 PT 경쟁 치열', outlook: 4, salary: '기본급+PT 수당 (역량별 연 2,500~6,000만원)', tip: '몸이 명함이지만, 재등록률(회원 유지)이 진짜 실력 지표입니다.' } },
  { id: 'pharmacist', name: '약사', emoji: '💊', color: '#34d399', desc: '처방전 뒤의 마지막 안전장치.', tp: { perfection: 3, analytical: 2 }, career: { certs: '약사 국가고시 (약대 6년)', competition: '약대 입시(PEET 폐지 후 통합 6년제)가 관문', outlook: 4, salary: '근무약사 연 5,000~7,000만원', tip: '복약지도 시뮬레이션에서 환자 눈높이 언어를 쓰는 연습을 하세요.' } },
  { id: 'lawyer', name: '변호사', emoji: '⚖️', color: '#78716c', desc: '말과 논리로 싸우는 법정의 검투사.', tp: { analytical: 3, perfection: 2, risk: 1 }, career: { certs: '변호사시험 (로스쿨 3년 필수)', competition: '변시 합격률 약 50%, 대형로펌은 극소수', outlook: 3, salary: '대형로펌 1억+ / 개업·중소 편차 큼', tip: '리걸 마인드는 기본, 어떤 분야(송무/자문/신산업)로 갈지 스토리를 준비하세요.' } },
  { id: 'idol_manager', name: '아이돌매니저', emoji: '🎤', color: '#c084fc', desc: '무대 뒤에서 스타의 하루를 설계하는 그림자.', tp: { teamwork: 2, speed: 2, patience: 2 }, career: { certs: '운전면허 필수, 자격증보다 체력과 눈치', competition: '대형 기획사 공채 수백:1', outlook: 3, salary: '신입 연 2,800~3,500만원', tip: '"연예인이 좋아서"는 탈락 멘트. 위기 대응 사례를 준비하세요.' } },
  { id: 'carpenter', name: '목수', emoji: '🪚', color: '#b45309', desc: '나무의 결을 읽고 공간을 짓는 장인.', tp: { perfection: 2, patience: 2, eco: 1 }, career: { certs: '건축목공기능사, 도제식 현장 경력', competition: '숙련공 부족으로 수요 증가', outlook: 4, salary: '일당 15~30만원 (숙련도별)', tip: '연장 관리 습관만 봐도 몇 년 차인지 티가 납니다.' } },
  { id: 'florist', name: '플로리스트', emoji: '💐', color: '#e879f9', desc: '꽃의 언어로 감정을 번역하는 사람.', tp: { creativity: 2, eco: 2, patience: 1 }, career: { certs: '화훼장식기능사', competition: '소규모 창업 위주, 시즌 수요 편차', outlook: 3, salary: '직원 연 2,400~3,000만원 / 창업 편차 큼', tip: '새벽 꽃시장 체력전과 명절 시즌 러시를 버틸 각오가 필요합니다.' } },
  { id: 'data_analyst', name: '데이터분석가', emoji: '📊', color: '#0891b2', desc: '데이터의 소음 속에서 신호를 찾아내는 사람.', tp: { analytical: 3, modern: 2, perfection: 1 }, career: { certs: 'ADsP/SQLD, 그러나 분석 프로젝트 경험이 핵심', competition: '신입 30~60:1', outlook: 5, salary: '신입 연 3,800~5,000만원', tip: '차트를 그린 경험 말고, 분석으로 "의사결정을 바꾼" 경험을 말하세요.' } },
  { id: 'voice_actor', name: '성우', emoji: '🎙️', color: '#fb923c', desc: '목소리 하나로 천 개의 인생을 사는 배우.', tp: { creativity: 2, perfection: 2, patience: 1 }, career: { certs: '방송사 공채 또는 학원+오디션', competition: '공채 수백:1, 소수 정예', outlook: 3, salary: '전속기간 후 편당 출연료', tip: '좋은 목소리보다 "연기"가 됩니다. 낭독 말고 연기를 녹음하세요.' } },
  { id: 'tour_guide', name: '여행가이드', emoji: '🧭', color: '#16a34a', desc: '낯선 도시를 이야기로 바꿔주는 길잡이.', tp: { teamwork: 3, creativity: 1, speed: 1 }, career: { certs: '관광통역안내사 (국가자격)', competition: '언어권별 수요 편차 큼', outlook: 3, salary: '투어당 일당+팁 (시즌 편차)', tip: '지식 암기보다 돌발 상황(지연/분실) 대응 스토리가 합격을 부릅니다.' } },
  { id: 'hairdresser', name: '미용사', emoji: '💇', color: '#d946ef', desc: '가위 하나로 사람의 하루 기분을 바꾸는 마법사.', tp: { creativity: 2, speed: 2, teamwork: 1 }, career: { certs: '미용사(일반) 면허 필수', competition: '스타일리스트 승급까지 평균 3~5년', outlook: 4, salary: '스탭 연 2,400만원~ / 디자이너 인센티브제', tip: '샴푸 3년을 버티는 끈기가 디자이너 데뷔의 진짜 자격증입니다.' } },
  { id: 'barista', name: '바리스타', emoji: '☕', color: '#a16207', desc: '한 잔의 커피에 하루의 온도를 담는 사람.', tp: { perfection: 2, teamwork: 2, speed: 1 }, career: { certs: '바리스타 2급/1급(민간), 위생교육 이수', competition: '카페 포화 시장, 스페셜티 역량이 차별점', outlook: 3, salary: '신입 연 2,400~3,000만원', tip: '라떼아트보다 위생·미소·회전율 감각을 어필하세요.' } },
];

/* ------------------------------------------------------ *
 * 3. 템플릿 직업 생성기 — JOB_META → 완전한 직업 객체
 * ------------------------------------------------------ */
/* scenarios.js의 압축 팩 → 정식 시나리오 스키마 디코더 */
function decodeScn(rows) {
  return rows.map(([narration, q, cs]) => ({
    narration, q,
    choices: cs.map(([text, fb, p, s, pa, tr]) => ({
      text, fb,
      effects: { performance: p, stress: s, patience: pa, traits: tr || {} },
    })),
  }));
}

function buildTemplateJob(m) {
  const n = m.name;
  const t1 = Object.keys(m.tp).sort((a, b) => m.tp[b] - m.tp[a])[0] || 'teamwork';
  const T = (extra) => ({ ...extra }); // 가독성용
  /* 직업별 전용 팩이 있으면 그것을 사용, 없으면(안전장치) 아래 범용 시나리오 */
  const pack = typeof JOB_SCN !== 'undefined' ? JOB_SCN[m.id] : null;

  /* 라이트 3단계: 전 단계 실무 밀착형 — 첫 미션 → 돌발상황 → 마무리 */
  const light = [
    {
      npc: { name: '친절한 사수', emoji: '😊', color: '#34d399' },
      narration: [`${n} 체험 첫날. 인수인계 10분 만에 급한 일 두 개가 동시에 떨어졌다.`, '"둘 다 오늘까지예요! 어떤 것부터 처리할래요?"'],
      q: `${n}의 첫 미션, 겹친 두 업무 중 무엇부터?`,
      choices: [
        { text: '마감이 코앞인 쉬운 일부터 빠르게 쳐낸다.', effects: { performance: 1, stress: 1, patience: 0, traits: { speed: 2 } }, fb: '회전이 빠르네요! 현장에서는 그 순발력이 큰 무기예요.' },
        { text: '시간이 걸려도 더 중요한 핵심 업무부터 판다.', effects: { performance: 2, stress: 1, patience: 2, traits: T({ [t1]: 2, patience: 1 }) }, fb: '우선순위를 볼 줄 아는군요. 이 직업의 본질을 벌써 잡았어요.' },
        { text: '사수와 하나씩 나눠 맡아 동시에 끝낸다.', effects: { performance: 1, stress: 0, patience: 1, traits: { teamwork: 2 } }, fb: '혼자 끌어안지 않는 것도 실력! 협업 감각이 좋네요. 👍' },
      ],
    },
    {
      npc: { name: '친절한 사수', emoji: '😊', color: '#34d399' },
      narration: [`본격 실무 체험! 사수가 실제 ${n}의 하루 업무를 보여준다.`, '그런데 눈앞에서 예상치 못한 문제가 터졌다!'],
      q: '실무 돌발 상황! 어떻게 돌파할까?',
      choices: [
        { text: '정면돌파! 과감하게 해결을 시도한다.', effects: { performance: 1, stress: 1, patience: 0, traits: { risk: 2 } }, fb: '오, 겁이 없네요? 현장에서는 그 배포가 무기가 되기도 해요.' },
        { text: '매뉴얼과 자료를 뒤져 원인부터 파악한다.', effects: { performance: 1, stress: 1, patience: 1, traits: { analytical: 2 } }, fb: '원인부터 찾는 습관, 아주 좋아요. 실무의 정석입니다.' },
        { text: '사수를 불러 함께 해결책을 찾는다.', effects: { performance: 1, stress: 0, patience: 1, traits: { teamwork: 2 } }, fb: '혼자 끙끙대지 않고 바로 공유하는 것도 실력이에요!' },
      ],
    },
    {
      npc: { name: '깐깐한 팀장님', emoji: '🧐', color: '#f59e0b' },
      narration: ['체험 마지막 날, 팀장님이 다가온다.', `"오늘 배운 ${n}의 실무, 어떻게 마무리할 건가요?"`],
      q: '하루의 마무리, 어떻게 정리할까?',
      choices: [
        { text: '오늘의 성과를 팀에 확실하게 어필한다.', effects: { performance: 2, stress: 1, patience: 0, traits: { risk: 1 } }, fb: '자기 PR도 능력이죠. 인상적인 마무리였습니다.' },
        { text: `${n} 노트를 펴고 부족했던 점을 복기한다.`, effects: { performance: 1, stress: 0, patience: 2, traits: T({ perfection: 1, [t1]: 1 }) }, fb: '복기하는 사람은 반드시 성장합니다. 오늘 제일 인상 깊었어요.' },
        { text: '동료들에게 감사 인사를 돌리고 회식을 제안한다.', effects: { performance: 1, stress: 0, patience: 1, traits: { teamwork: 2 } }, fb: '허허, 팀의 온도를 올릴 줄 아는 사람이군요.' },
      ],
    },
  ];

  /* 리얼 5단계: 전 단계 딜레마 밀착형 — 긴급 돌발 → 품질vs마감 → 클레임 → 스펙 전략 → 최종 결단 */
  const realistic = [
    {
      npc: { name: '베테랑 선배', emoji: '😎', color: '#a78bfa' },
      narration: [`${n} 심층 체험 첫날 아침, 현장이 뒤집혔다.`, '핵심 장비(시스템)가 멈췄는데 오늘 일정은 그대로다. 선배가 당신을 본다. "자, 어떻게 할래?"'],
      q: '첫날부터 터진 현장 마비. 초동 대응은?',
      choices: [
        { text: '매뉴얼과 체크리스트대로 원인부터 차분히 짚는다.', effects: { performance: 1, stress: 1, patience: 2, traits: { analytical: 2, patience: 1 } }, fb: '급할수록 정석. 이 바닥에서 오래 살아남는 사람들의 방식이야.' },
        { text: '임시방편이라도 당장 굴러가게 만들고 일정을 지킨다.', effects: { performance: 2, stress: 2, patience: 0, traits: { speed: 2, risk: 1 } }, fb: '배짱 좋네! 단, 임시방편의 뒷수습은 반드시 네 몫이야.' },
        { text: '즉시 윗선에 보고하고 관련 팀을 모아 대응을 분담한다.', effects: { performance: 1, stress: 1, patience: 1, traits: { teamwork: 2 } }, fb: '혼자 안 끌어안는 판단력. 사고 대응의 절반은 공유야.' },
      ],
    },
    {
      npc: { name: '깐깐한 팀장님', emoji: '🧐', color: '#f59e0b' },
      narration: [`${n}의 영원한 딜레마가 눈앞에 왔다. 결과물 완성도는 아직 70%.`, '그런데 마감은 오늘. 품질이냐, 약속이냐.'],
      q: '완성도 70% vs 오늘 마감. 무엇을 지킬 것인가?',
      choices: [
        { text: '마감을 미루더라도 100% 품질로 승부한다.', effects: { performance: 1, stress: 2, patience: 2, traits: { perfection: 2 } }, fb: '이름을 걸 줄 아는 장인이군. 대신 신뢰 잃은 일정은 네가 갚아야 해.' },
        { text: '70%라도 마감을 지켜 내보내고, 이후 보완한다.', effects: { performance: 1, stress: 1, patience: 0, traits: { speed: 2, risk: 1 } }, fb: '세상은 마감을 지키는 사람을 프로라고 부르지. 보완 약속은 꼭 지켜.' },
        { text: '핵심만 100%로 다듬고 부가 요소는 과감히 잘라낸다.', effects: { performance: 2, stress: 1, patience: 1, traits: T({ analytical: 1, [t1]: 2 }) }, fb: '범위를 조정하는 협상력! 그게 진짜 실무 감각이야.' },
      ],
    },
    {
      npc: { name: '화가 난 고객', emoji: '😠', color: '#f43f5e' },
      narration: ['실무 체험 D-1일 차. 갑자기 강성 클레임이 접수됐다.', `${n}의 실제 현장에서는 이런 돌발 상황이 일상이라고 한다.`],
      q: '고객(이해관계자)의 거센 항의. 첫 대응은?',
      choices: [
        { text: '먼저 충분히 경청하고 진심으로 사과부터 한다.', effects: { performance: 1, stress: 1, patience: 2, traits: { teamwork: 2, patience: 1 } }, fb: '…흠. 일단 들어주니 화가 좀 풀리는군요. 계속 얘기해 봅시다.' },
        { text: '사실관계를 빠르게 확인하고 정확한 데이터로 답한다.', effects: { performance: 2, stress: 1, patience: 1, traits: { analytical: 2 } }, fb: '숫자를 들이미니 할 말이 없네요. 프로답습니다.' },
        { text: '보상안을 먼저 제시해 상황을 빠르게 진정시킨다.', effects: { performance: 1, stress: 1, patience: 0, traits: { speed: 2, risk: 1 } }, fb: '화끈하네요! …근데 다음에도 이러면 또 와도 되죠? (팀장님이 뒤에서 식은땀)' },
      ],
    },
    {
      npc: { name: '커리어 멘토', emoji: '🦉', color: '#0ea5e9' },
      narration: [`멘토가 ${n}의 취업 준비 로드맵을 펼쳐 보인다.`, `"이 직업은 보통 '${m.career.certs}' 같은 준비가 필요해요. 어떻게 스펙을 쌓을 건가요?"`],
      q: `${n}이(가) 되기 위한 스펙 준비, 나의 전략은?`,
      choices: [
        { text: '자격증·시험부터 정석대로 차근차근 준비한다.', effects: { performance: 1, stress: 1, patience: 2, traits: { perfection: 2, patience: 1 } }, fb: '기본기를 갖춘 지원자는 면접관도 함부로 못 봐요. 좋은 전략!' },
        { text: '실전 경험과 포트폴리오로 실력을 증명한다.', effects: { performance: 2, stress: 1, patience: 1, traits: T({ creativity: 1, [t1]: 2 }) }, fb: '요즘 채용 트렌드는 확실히 "증명하는 사람"의 편이에요. 👏' },
        { text: '현직자 커뮤니티·OJT 기회부터 뚫어 정보를 모은다.', effects: { performance: 1, stress: 0, patience: 1, traits: { teamwork: 2, modern: 1 } }, fb: '정보력이 곧 스펙인 시대죠. 네트워킹 감각이 뛰어나네요.' },
      ],
    },
    {
      npc: { name: '깐깐한 팀장님', emoji: '🧐', color: '#f59e0b' },
      narration: ['체험 마지막 날, 팀장님의 최종 미션.', `"회사의 명운이 걸린 대형 프로젝트, 그 리드 자리를 제안한다면?"`],
      q: '커리어 최대의 기회이자 위기. 당신의 대답은?',
      choices: [
        { text: '제안을 수락한다. 이건 내 무대다.', effects: { performance: 2, stress: 2, patience: 0, traits: T({ risk: 2, [t1]: 1 }) }, fb: '그 눈빛, 마음에 드는군. 실패해도 배우는 게 있을 거야.' },
        { text: '아직은 때가 아니다. 실력을 더 쌓고 다음을 노린다.', effects: { performance: 1, stress: 0, patience: 2, traits: { patience: 2, perfection: 1 } }, fb: '자기 객관화가 되는 사람이군. 그것도 귀한 능력이야.' },
        { text: '믿을 만한 동료와 공동 리드를 조건으로 수락한다.', effects: { performance: 2, stress: 1, patience: 1, traits: { teamwork: 2 } }, fb: '조건 협상까지! 리더의 그릇이 보이는 대답이었어.' },
      ],
    },
  ];

  return {
    id: m.id, name: n, emoji: m.emoji, color: m.color, desc: m.desc,
    emojiSuccess: m.emoji + '😄', emojiAlt: m.emoji + '😅',
    traitProfile: m.tp,
    modes: {
      light: { scenarios: pack ? decodeScn(pack.L) : light },
      realistic: { scenarios: pack ? decodeScn(pack.R) : realistic },
    },
    career: {
      certs: m.career.certs, competition: m.career.competition,
      outlook: m.career.outlook, outlookText: '',
      salary: m.career.salary, interviewTip: m.career.tip,
    },
    titles: [
      { id: `${m.id}_ace`, name: `${n}의 에이스`, type: 'success', desc: `동료들이 먼저 알아보는 실력파 ${n}입니다.`, cond: (s, c) => s.performance >= c.completed * 1.4 },
      { id: `${m.id}_mate`, name: `팀이 사랑하는 ${n}`, type: 'success', desc: `함께 일하고 싶은 사람 1순위. 팀의 온도를 올리는 ${n}입니다.`, cond: (s, c) => (s.traits.teamwork || 0) >= c.completed * 0.9 },
      { id: `${m.id}_free`, name: `자유로운 영혼의 ${n}`, type: 'alt', desc: '정석과는 다른, 그러나 분명히 당신다운 방식이었습니다.', cond: (s, c) => s.performance < c.completed * 1.0 },
    ],
    defaultTitle: { id: `${m.id}_default`, name: `성실한 ${n}`, type: 'success', desc: `묵묵히 제 몫을 해낸 ${n}입니다.` },
    quitterTitle: { id: `${m.id}_quit`, name: `${n}의 문 앞에서 돌아선 여행자`, type: 'alt', desc: '이 길은 아니었을 뿐, 여정은 계속됩니다.' },
    deepCond: (s, c) => s.performance >= c.completed * 1.5,
    furniture: { id: `furn_${m.id}`, name: `${n}의 애장품`, emoji: m.emoji },
    decor: { id: `deco_${m.id}`, name: `${n}의 기념 소품`, emoji: '🎀' },
    costume: { id: `cos_${m.id}`, name: `${n} 유니폼`, color: m.color, emoji: m.emoji },
  };
}

/* 최종 내장 직업 배열 (3 정성 제작 + 27 템플릿 = 30개) */
const JOBS = [...BESPOKE_JOBS, ...JOB_META.map(buildTemplateJob)];

/* ------------------------------------------------------ *
 * 4. 배경 테마 — 히든 퀘스트로만 해금
 * ------------------------------------------------------ */
const THEMES = [
  { id: 'theme_default', name: '아늑한 원룸', emoji: '🏠', bg: 'linear-gradient(180deg, #e0e7ff 0%, #fce7f3 100%)', floor: '#d6c9b8', always: true },
  { id: 'theme_farmer', name: '햇살 가득한 농장', emoji: '🌻', bg: 'linear-gradient(180deg, #7dd3fc 0%, #fef9c3 55%, #a3e635 100%)', floor: '#a3a061' },
  { id: 'theme_marketer', name: '네온 시티 오피스', emoji: '🌃', bg: 'linear-gradient(180deg, #1e1b4b 0%, #7e22ce 60%, #ec4899 100%)', floor: '#3b0764' },
  { id: 'theme_engineer', name: '해커의 다크룸', emoji: '⌨️', bg: 'linear-gradient(180deg, #020617 0%, #0f172a 60%, #14532d 100%)', floor: '#1e293b' },
  { id: 'theme_rest', name: '백수의 안식처', emoji: '🛌', bg: 'linear-gradient(180deg, #fef3c7 0%, #fed7aa 60%, #fdba74 100%)', floor: '#d97706' },
  { id: 'theme_penthouse', name: '황금 펜트하우스', emoji: '👑', bg: 'linear-gradient(180deg, #1c1917 0%, #78350f 55%, #fbbf24 100%)', floor: '#92400e' },
];
const DEFAULT_THEME = THEMES[0];

/* ------------------------------------------------------ *
 * 5. 히든 퀘스트 — 달성 시 팝업과 함께 테마 해금
 *    cond(SAVE) 형태. hint는 잠금 상태에서 보여줄 힌트.
 * ------------------------------------------------------ */
const QUESTS = [
  { id: 'q_first_clear', icon: '🌱', name: '첫 완주의 기쁨', desc: '직업 1개를 완주하세요', cond: (s) => s.clears >= 1, reward: 'theme_farmer' },
  { id: 'q_runs5', icon: '🔥', name: '열정의 탐험가', desc: '직업 체험을 누적 5회 완료하세요', cond: (s) => s.history.length >= 5, reward: 'theme_marketer' },
  { id: 'q_runs10', icon: '🌟', name: '백전노장', desc: '직업 체험을 누적 10회 완료하세요', cond: (s) => s.history.length >= 10, reward: 'theme_engineer' },
  { id: 'q_resign5', icon: '🛌', name: '프로 휴식러', desc: '조기 퇴사를 5회 달성하세요 (이것도 재능!)', cond: (s) => s.resignCount >= 5, reward: 'theme_rest' },
  { id: 'q_deep3', icon: '👑', name: '심화의 달인', desc: '리얼 모드 심화 클리어를 3회 달성하세요', cond: (s) => s.deepCount >= 3, reward: 'theme_penthouse' },
];

/* ------------------------------------------------------ *
 * 6. 라벨 & 모드 메타
 * ------------------------------------------------------ */
const STAT_LABELS = { performance: '성과', stress: '스트레스', patience: '인내심' };
const TRAIT_LABELS = {
  speed: '스피드', eco: '친환경', modern: '혁신', risk: '모험심', analytical: '분석력',
  teamwork: '협동심', perfection: '완벽주의', creativity: '창의력', patience: '끈기',
};
const MODES = {
  light: {
    key: 'light', label: '캐주얼 탐색 모드 (Light)', short: '캐주얼 탐색', emoji: '🎈', gold: 150,
    desc: '청소년 및 초보자를 위한 가벼운 직업 탐색 모드. 교육기관 및 학교 수업용에 적합하며, 쉽고 흥미로운 실무 중심 질문과 마이룸 꾸미기 보상에 집중합니다.',
  },
  realistic: {
    key: 'realistic', label: '프로 취준생 모드 (Realistic)', short: '프로 취준생', emoji: '🎯', gold: 80,
    desc: '실제 취업 준비생을 위한 심도 있는 커리어 모드. 직업별 냉혹한 현실 딜레마를 경험하고, 필수 자격증·경쟁률·전망·연봉 등 고도화된 스펙 정보를 학습합니다.',
  },
};

/* ------------------------------------------------------ *
 * 7. 전문 용어 사전 — 시나리오/커리어 텍스트에서 자동 하이라이트
 *    키가 텍스트에 등장하면 보라색 강조 + 호버/클릭 툴팁
 * ------------------------------------------------------ */
const TERMS = {
  'ROAS': '광고비 대비 매출 비율(Return On Ad Spend). 광고에 100만원을 써서 매출 300만원이 나오면 ROAS 300%예요.',
  'ROI': '투자 대비 수익률(Return On Investment). 들인 비용 대비 얼마나 이익을 냈는지 나타내는 지표예요.',
  'KPI': '핵심 성과 지표(Key Performance Indicator). 목표를 얼마나 달성했는지 측정하는 숫자 기준이에요.',
  'A/B 테스트': '두 가지 안(A안/B안)을 실제 사용자에게 동시에 보여주고, 성과가 더 좋은 쪽을 선택하는 실험 방법이에요.',
  '리팩토링': '겉으로 보이는 기능은 그대로 두고 코드의 내부 구조만 더 깔끔하게 고치는 작업(Refactoring)이에요.',
  '레거시': '오래전에 만들어져 유지보수가 어려워진 낡은 코드나 시스템(Legacy)을 말해요.',
  '기술 부채': '빠른 개발을 위해 미뤄둔 코드 품질 문제. 빚처럼 나중에 이자(수정 비용)가 붙어 돌아와요.',
  '기능 플래그': '새 기능을 코드 안에 숨겨두고 스위치처럼 켰다 껐다 할 수 있게 하는 배포 기법(Feature Flag)이에요.',
  '온콜': '서비스 장애가 나면 새벽에도 즉시 대응해야 하는 비상 대기 당번(On-call)이에요.',
  'PR': '내가 수정한 코드를 팀원에게 검토(리뷰)해 달라고 요청하는 것(Pull Request)이에요.',
  '메트릭': '시스템의 상태를 숫자로 기록한 지표(Metric). 응답 속도, CPU 사용량 등이 대표적이에요.',
  '벤치마크': '여러 기술이나 제품의 성능을 같은 조건에서 비교 측정하는 것(Benchmark)이에요.',
  '퍼포먼스 채널': '클릭·구매 같은 성과가 숫자로 정확히 측정되는 광고 매체(검색 광고, SNS 광고 등)를 말해요.',
  '세그먼트': '나이·관심사 등 공통 특징으로 고객을 나눈 그룹(Segment). 그룹별로 다른 광고를 보여줄 수 있어요.',
  '마이크로 인플루언서': '팔로워 1천~10만 명 규모의 SNS 크리에이터. 규모는 작지만 팬과의 신뢰도가 높아요.',
  '라이브커머스': '실시간 방송으로 상품을 소개하고 판매하는 온라인 직거래 방식이에요.',
  '스마트팜': 'IoT 센서와 데이터로 온도·습도·물주기를 자동 관리하는 첨단 농장이에요.',
  '포트폴리오': '내 실력을 증명하는 작업물 모음집. 많은 직군에서 자격증보다 강력한 스펙이 돼요.',
  '스펙': '취업을 위해 쌓는 자격·경험·이력의 통칭. Specification(사양)에서 유래한 말이에요.',
  'OJT': '입사 후 실제 업무를 수행하면서 배우는 현장 직무 교육(On the Job Training)이에요.',
  '번아웃': '의욕적으로 일하던 사람이 극도의 피로로 무기력해지는 소진 상태(Burnout)예요.',
  '워라밸': '일(Work)과 삶(Life)의 균형(Balance). 직업을 고를 때 중요한 기준 중 하나예요.',
  '프리셉터십': '신입 간호사가 선배(프리셉터)에게 1:1로 실무를 배우는 병원 교육 제도예요.',
  '임용고시': '국공립학교 교사가 되기 위해 치르는 임용후보자 선정 경쟁시험이에요.',
  '재해보험': '태풍·우박 같은 자연재해로 입은 농작물 피해를 보상해 주는 보험이에요.',
  '역기획서': '이미 출시된 게임을 거꾸로 분석해 기획 문서로 재구성한 것. 게임기획자 지망생의 대표 포트폴리오예요.',
};

/* ------------------------------------------------------ *
 * 8. 기본 NPC 캐스팅 — 시나리오에 npc 지정이 없으면 순번대로 출연
 * ------------------------------------------------------ */
const NPC_CAST = [
  { name: '친절한 사수', emoji: '😊', color: '#34d399' },
  { name: '깐깐한 팀장님', emoji: '🧐', color: '#f59e0b' },
  { name: '화가 난 고객', emoji: '😠', color: '#f43f5e' },
  { name: '유쾌한 동기', emoji: '😆', color: '#38bdf8' },
  { name: '베테랑 선배', emoji: '😎', color: '#a78bfa' },
];

/* ------------------------------------------------------ *
 * 9. 가상 친구 데이터 — 소셜 마이룸 시뮬레이션
 * ------------------------------------------------------ */
/* code: 친구 추가에 필요한 고유 코드 · notice: 방 주인의 한 줄 공지 · hello: 친구 추가 시 내 방명록에 남기는 첫 댓글 */
const FRIENDS = [
  {
    id: 'f_squirrel', name: '하늘다람쥐', motto: '오늘도 씨앗 심는 중 🌱', private: false,
    code: 'JOB-SQRL-7942', notice: '주말엔 텃밭에 있어요. 방명록 남겨줘요! 🌱', hello: '친구 수락 고마워요! 방 구경 왔다 가요 🌻',
    avatar: { skin: 1, hair: 3, hairColor: 3, outfit: 1, costume: null },
    theme: 'theme_farmer',
    items: [{ emoji: '🧺', x: 22, y: 72 }, { emoji: '🌼', x: 72, y: 66 }, { emoji: '🐥', x: 48, y: 80 }],
    badges: ['👨‍🌾', '☕', '💐'],
  },
  {
    id: 'f_quokka', name: '코딩쿼카', motto: '어제도 밤샘 배포… 오늘도 무사히 🙏', private: false,
    code: 'JOB-QOKA-1010', notice: '온콜 주간이라 답장이 느려요 🙏', hello: '오 방 인테리어 감각 있는데요? 러버덕 하나 드릴게요 🐥',
    avatar: { skin: 0, hair: 4, hairColor: 0, outfit: 4, costume: null },
    theme: 'theme_engineer',
    items: [{ emoji: '🖥️', x: 30, y: 68 }, { emoji: '🐥', x: 55, y: 78 }, { emoji: '💡', x: 78, y: 60 }],
    badges: ['💻', '🤖', '📊'],
  },
  {
    id: 'f_fox', name: '네온여우', motto: '트렌드는 잡는 게 아니라 만드는 것 ✨', private: false,
    code: 'JOB-FOXY-3355', notice: '이번 주 방 테마 리뉴얼 완료! 피드백 환영 ✨', hello: '첫 방문 기념 좋아요 꾹! 마이룸 감성 미쳤다 ✨',
    avatar: { skin: 2, hair: 2, hairColor: 4, outfit: 5, costume: null },
    theme: 'theme_marketer',
    items: [{ emoji: '🏆', x: 25, y: 70 }, { emoji: '💡', x: 60, y: 62 }, { emoji: '🎀', x: 80, y: 76 }],
    badges: ['📣', '📹', '🎤'],
  },
  {
    id: 'f_fairy', name: '비밀요정', motto: '(방을 비공개로 설정했습니다)', private: true,
    code: 'JOB-FARY-0007', notice: '', hello: '…비밀요정이 조용히 다녀갔습니다 🧚',
    avatar: { skin: 0, hair: 1, hairColor: 5, outfit: 2, costume: null },
    theme: 'theme_default',
    items: [],
    badges: ['⚖️', '💊'],
  },
  {
    id: 'f_whale', name: '구름고래', motto: '(방을 비공개로 설정했습니다)', private: true,
    code: 'JOB-WALE-8282', notice: '', hello: '푸우… (고래가 물풍선 인사를 남겼어요) 🐳',
    avatar: { skin: 3, hair: 0, hairColor: 1, outfit: 3, costume: null },
    theme: 'theme_rest',
    items: [],
    badges: ['🚒', '✈️'],
  },
];
