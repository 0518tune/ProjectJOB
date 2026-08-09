/* =========================================================
 * ProjectJOB — Inline SVG Icon System
 * ---------------------------------------------------------
 * Lucide 스타일 stroke 기반 24x24 아이콘 라이브러리.
 * UI 크롬 / 직업 대표 아이콘 / NPC 초상 / 테마 아이콘을
 * 이모지 대신 일관된 벡터 라인 아이콘으로 렌더링한다.
 * 성공·실패 리액션 이모지, 가구/장식/코스튬 보상 이모지는
 * 데이터 콘텐츠의 일부라 의도적으로 이모지를 유지한다.
 * ========================================================= */

const Icons = {
  /** 24x24 viewBox 내부 path/shape 마크업 (stroke는 svg() 래퍼가 부여) */
  PATHS: {
    // ---- UI 크롬 ----
    gear: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 17.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 13a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 6.7a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 2.14a1.7 1.7 0 0 0 1.04-1.56V0"/>',
    userCog: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h3.5"/><circle cx="18" cy="17" r="3"/><path d="M18 12.5v1M18 20.5v1M14.5 17h1M20.5 17h1M15.5 14.5l.7.7M20.3 19.3l.7.7M15.5 19.5l.7-.7M20.3 14.7l.7-.7"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5c0-1 .9-1.8 2.5-1.8s2.5.8 2.5 1.6c0 2.2-5 1-5 3.4 0 .9 1 1.7 2.5 1.7s2.5-.7 2.5-1.7M12 6.5v11"/>',
    briefcase: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M2.5 13h19"/>',
    clipboardList: '<rect x="5" y="3.5" width="14" height="18" rx="2"/><path d="M9 3.5V3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5M8 11h8M8 15h8M8 19h5"/>',
    home: '<path d="M3.5 11 12 3.5 20.5 11"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H9v-5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V21h2.5a1 1 0 0 0 1-1V9.5"/>',
    brain: '<path d="M9 3a3 3 0 0 0-3 3v.3A3 3 0 0 0 4.5 9v1.2A3 3 0 0 0 3 13v.5a3 3 0 0 0 3 3v.5A3.5 3.5 0 0 0 9.5 20.5 2.5 2.5 0 0 0 12 18V6a3 3 0 0 0-3-3Z"/><path d="M15 3a3 3 0 0 1 3 3v.3A3 3 0 0 1 19.5 9v1.2A3 3 0 0 1 21 13v.5a3 3 0 0 1-3 3v.5A3.5 3.5 0 0 1 14.5 20.5 2.5 2.5 0 0 1 12 18"/>',
    bookOpen: '<path d="M12 6.5c-1.5-1.4-4-2-7.5-2v13.5c3.5 0 6 .6 7.5 2 1.5-1.4 4-2 7.5-2V4.5c-3.5 0-6 .6-7.5 2Z"/><path d="M12 6.5v13.5"/>',
    shoppingCart: '<circle cx="9.5" cy="20.5" r="1.3"/><circle cx="18" cy="20.5" r="1.3"/><path d="M2.5 3.5h2.3l2.4 11.6a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 1.96-1.6L21.5 8H6"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.3-2.3"/>',
    rotateCw: '<path d="M20 11A8 8 0 1 0 19 15.5"/><path d="M20 5.5V11h-5.5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
    x: '<path d="M5 5l14 14M19 5 5 19"/>',
    chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    mailbox: '<path d="M4 9.5A4.5 4.5 0 0 1 8.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.5A4.5 4.5 0 0 1 4 14.5v-5Z"/><path d="M4 9.5h4.5M8 12h.01" /><path d="M2 19h6"/>',

    // ---- 직업 대표 아이콘 ----
    sprout: '<path d="M7 20c0-4.5 2.5-7 5-7s5 2.5 5 7"/><path d="M12 13V21"/><path d="M12 9C7 9 5 5 5 5s2 2 7 2c0 0 0 4-2 6"/><path d="M12 9c5 0 7-4 7-4s-2 2-7 2c0 0 0 4 2 6"/>',
    megaphone: '<path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l2.5 5H11l-1-5h1l8 3v-12l-8 3H4Z"/><path d="M8 15v3a1.5 1.5 0 0 0 3 0"/>',
    code: '<path d="m9 18-6-6 6-6M15 6l6 6-6 6"/>',
    chefHat: '<path d="M7.5 11.5A4 4 0 0 1 8 3.6 3.5 3.5 0 0 1 12 2a3.5 3.5 0 0 1 4 1.6 4 4 0 0 1 .5 7.9V16h-9v-4.5Z"/><path d="M7.5 16h9v3.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V16Z"/>',
    brush: '<path d="M9.5 14.5 3 21l1.5-5.5 8-8"/><path d="M12.5 7 15 4.5a2.1 2.1 0 0 1 3 3L15.5 10 12.5 7Z"/><path d="M9.5 14.5c1-1 1.5-2.5 3-3"/>',
    flame: '<path d="M12 2s-5 5-5 10a5 5 0 0 0 10 0c0-1.5-.5-2.5-1.3-3.3.2 1.5-.4 2.6-1.2 2.6-1 0-1-1.3-.5-2.8C14.6 6.5 12 4 12 2Z"/><path d="M9.5 15a2.5 2.5 0 0 0 5 0c0-1-.7-1.6-1.2-2.3-.2.7-.8 1-1.3 1-.7 0-1-.5-.8-1.3-1 .6-1.7 1.6-1.7 2.6Z"/>',
    syringe: '<path d="m18 2 4 4M9 11l4 4M4 20l3-1 1-3 8-8 1-4-4 1-8 8-1 4Z"/><path d="m14 6.5 3.5 3.5M12 8.5l3.5 3.5"/>',
    graduationCap: '<path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5Z"/><path d="M6.5 11.7v4.4c0 1.4 2.5 2.4 5.5 2.4s5.5-1 5.5-2.4v-4.4"/><path d="M22 9.5v5"/>',
    video: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>',
    gamepad2: '<path d="M8 9v4M6 11h4"/><circle cx="16" cy="10.5" r="1"/><circle cx="18.5" cy="13" r="1"/><path d="M7 6.5h10a4.5 4.5 0 0 1 4.5 4.5v3a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.6 1.8A3 3 0 0 1 2.5 14v-3A4.5 4.5 0 0 1 7 6.5Z"/>',
    shirt: '<path d="M8 3 3 7l3 3 2-1.5V21h8V8.5L18 10l3-3-5-4a3 3 0 0 1-6 0Z"/>',
    pawPrint: '<circle cx="6.5" cy="9.5" r="1.6"/><circle cx="10.5" cy="6.5" r="1.6"/><circle cx="14.5" cy="6.5" r="1.6"/><circle cx="18" cy="9.5" r="1.6"/><path d="M6.7 13.4c1-1.4 2.7-2.2 5.3-2.2s4.3.8 5.3 2.2c.9 1.3.5 3.2-1.5 3.5-1.6.2-2.2-.6-3.8-.6s-2.2.8-3.8.6c-2-.3-2.4-2.2-1.5-3.5Z"/>',
    shield: '<path d="M12 2.5 4.5 5.5v6c0 5 3 8.5 7.5 10 4.5-1.5 7.5-5 7.5-10v-6L12 2.5Z"/>',
    plane: '<path d="M2.5 16.5 21 8c1-.5 1.5-1.7.3-2.4-.7-.4-1.5-.3-2.3.1L14 9 5 6.5l-2 1.3L10 12l-4 3-3-1-1.2 1.4 3 2.6L6 21l1.6-1 1.7-3 4.2 3.2 1.3-2-2-4.8Z"/>',
    draftingCompass: '<path d="M12 3v3.5"/><circle cx="12" cy="4.5" r="1.3"/><path d="m10 9 -6 12h3.2L10 15l3 6h3.2L10 9Z"/>',
    receipt: '<path d="M6 2.5h12v19l-2.5-1.5L13 21l-2-1.5L9 21l-2.5-1.5L4 21V5a2.5 2.5 0 0 1 2-2.5Z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
    joystick: '<path d="M12 3a3 3 0 0 1 3 3v3.5h-6V6a3 3 0 0 1 3-3Z"/><path d="M9 9.5H6a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-3a3 3 0 0 0-3-3h-3"/><circle cx="8.5" cy="15" r="1"/><circle cx="15.5" cy="15" r="1"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1-2h6.6l1 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.5"/>',
    dumbbell: '<path d="M4.5 9.5v5M2.5 11v2M6.5 8v8"/><path d="M17.5 8v8M19.5 11v2M21.5 9.5v5"/><path d="M8 12h8"/>',
    pill: '<rect x="3" y="10" width="18" height="6" rx="3" transform="rotate(-35 12 13)"/><path d="m9.5 8.5 5 5"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h4M15 7h4M5 7l-2.5 5a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 5a2.5 2.5 0 0 0 5 0L19 7Z"/>',
    mic: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
    hammer: '<path d="m14.5 6.5 3 3-8 8-3-3ZM13 5l1.5-1.5a2.1 2.1 0 0 1 3 3L16 8"/><path d="m4 20 3-3"/>',
    flower2: '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8a2.6 2.6 0 1 1 2.6-2.6A2.6 2.6 0 0 1 12 9.8ZM12 14.2a2.6 2.6 0 1 1-2.6 2.6 2.6 2.6 0 0 1 2.6-2.6ZM14.2 12a2.6 2.6 0 1 1 2.6 2.6A2.6 2.6 0 0 1 14.2 12ZM9.8 12a2.6 2.6 0 1 1-2.6-2.6A2.6 2.6 0 0 1 9.8 12Z"/><path d="M12 17v4"/>',
    barChart2: '<path d="M6 20V10M12 20V4M18 20v-7"/>',
    compass: '<circle cx="12" cy="12" r="9.5"/><path d="m15 9-2 6-6 2 2-6 6-2Z"/>',
    scissors: '<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/><path d="M20 5 8.5 12M8.5 12 20 19M11 12h9"/>',
    coffee: '<path d="M4 8h13v6.5A4.5 4.5 0 0 1 12.5 19h-4A4.5 4.5 0 0 1 4 14.5V8Z"/><path d="M17 9.5h1.5a2.3 2.3 0 0 1 0 4.6H17"/><path d="M7 4.5c0 1-1 1-1 2M11 4.5c0 1-1 1-1 2"/>',
    baseball: '<circle cx="12" cy="12" r="9"/><path d="M6.5 4c-1.8 2.8-1.8 13.2 0 16M17.5 4c1.8 2.8 1.8 13.2 0 16"/>',
    stethoscope: '<path d="M5 3v5a3 3 0 0 0 6 0V3"/><path d="M11 8v3a5 5 0 0 0 5 5h.3"/><circle cx="18.3" cy="16.3" r="2.3"/><path d="M5 3H3.5M11 3h1.5"/>',

    // ---- NPC 초상 6종 ----
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 13.5s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01"/>',
    meh: '<circle cx="12" cy="12" r="9"/><path d="M8.5 15h7M9 9.5h.01M15 9.5h.01"/>',
    angry: '<circle cx="12" cy="12" r="9"/><path d="M8.3 15.5c1-1 2.3-1.5 3.7-1.5s2.7.5 3.7 1.5M8 9.7l2.2-1M15.8 9.7l-2.2-1"/>',
    laugh: '<circle cx="12" cy="12" r="9"/><path d="M7.5 13.2a4.7 4.7 0 0 0 9 0Z"/><path d="M9 9.2h.01M15 9.2h.01"/>',
    sunglasses: '<circle cx="12" cy="12" r="9"/><path d="M6 10.5h4a1.5 1.5 0 0 1 1.5 1.5 1.5 1.5 0 0 0 1 0 1.5 1.5 0 0 1 1.5-1.5h4M8 10.5v2a2 2 0 1 0 4 0M16 10.5v2a2 2 0 1 1-4 0M15 15.3a3.6 3.6 0 0 1-6 0"/>',
    owl: '<path d="M6 21c0-5 2.5-9 6-9s6 4 6 9"/><circle cx="9.3" cy="10.3" r="2.3"/><circle cx="14.7" cy="10.3" r="2.3"/><circle cx="9.3" cy="10.3" r=".6" fill="currentColor"/><circle cx="14.7" cy="10.3" r=".6" fill="currentColor"/><path d="M12 12.3 11 14h2Z" fill="currentColor"/><path d="M8.5 4.5 6 2M15.5 4.5 18 2"/>',

    // ---- 테마 아이콘 ----
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    building2: '<rect x="4" y="3.5" width="10" height="17" rx="1"/><path d="M14 9.5h6v11h-6M7 7h4M7 10.5h4M7 14h4M7 17.5h4"/>',
    terminal: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="m6.5 9 3.5 3-3.5 3M13 15h4.5"/>',
    bedDouble: '<rect x="2.5" y="12" width="19" height="7" rx="1.5"/><path d="M2.5 17V8a1.5 1.5 0 0 1 1.5-1.5h16A1.5 1.5 0 0 1 21.5 8v9M6.5 12V9M12 12V9M17.5 12V9"/>',
    crown: '<path d="M3 8.5 7 12l5-7 5 7 4-3.5V17H3V8.5Z"/><path d="M3 20h18"/>',
  },

  /** name → 완성 SVG 문자열 */
  svg(name, { size = 20, color = 'currentColor', className = '' } = {}) {
    const inner = this.PATHS[name] || this.PATHS.briefcase;
    return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  },

  /** 다른 SVG(아바타/뱃지) 내부에 x,y 좌표로 삽입할 중첩 <svg> 조각 */
  nested(name, { x = 0, y = 0, size = 20, color = '#fff' } = {}) {
    const inner = this.PATHS[name] || this.PATHS.briefcase;
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  },

  /* JOB_DATABASE(index.html 하단 "기획자 데이터 존")의 실제 직업 ID와 1:1로 맞춰야 한다.
   * data.js의 JOB_META id(nurse/flight_attendant 등 구 스키마)가 아님에 주의 —
   * JobBinder.bindAll()이 런타임에 JOBS 배열을 JOB_DATABASE 기준으로 완전히 교체한다. */
  JOB_ICON_MAP: {
    farmer: 'sprout', marketer: 'megaphone', engineer: 'code', lawyer: 'scale',
    chef: 'chefHat', designer: 'brush', firefighter: 'flame', idol: 'mic',
    baseball: 'baseball', doctor: 'stethoscope', teacher: 'graduationCap',
    youtuber: 'video', barista: 'coffee', nurse: 'syringe', police: 'shield',
    writer: 'bookOpen', pilot: 'plane', vet: 'pawPrint', gamedev: 'gamepad2',
    florist: 'flower2',
  },

  NPC_ICON_MAP: {
    '친절한 사수': 'smile', '깐깐한 팀장님': 'meh', '화가 난 고객': 'angry',
    '유쾌한 동기': 'laugh', '베테랑 선배': 'sunglasses', '커리어 멘토': 'owl',
  },

  THEME_ICON_MAP: {
    theme_default: 'home', theme_farmer: 'sun', theme_marketer: 'building2',
    theme_engineer: 'terminal', theme_rest: 'bedDouble', theme_penthouse: 'crown',
  },

  forJob(job, opts) {
    return this.svg(this.JOB_ICON_MAP[job && job.id] || 'briefcase', opts);
  },

  forNpc(npc, opts) {
    return this.svg(this.NPC_ICON_MAP[npc && npc.name] || 'smile', opts);
  },

  forTheme(themeId, opts) {
    return this.svg(this.THEME_ICON_MAP[themeId] || 'home', opts);
  },
};
