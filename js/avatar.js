/* =========================================================
 * ProjectJOB — Avatar SVG Renderer (Phase 3)
 * ---------------------------------------------------------
 * 유저 아바타/NPC를 인라인 SVG로 그립니다.
 * cfg = { skin, hair, hairColor, outfit, costume }
 *  - skin/hair/hairColor/outfit : 인덱스
 *  - costume : 착용 중인 코스튬 id (null이면 기본 의상)
 * ========================================================= */

const AvatarSVG = {
  SKINS: ['#fde8d0', '#f8c99b', '#c9885a', '#8a5a33'],
  SKIN_NAMES: ['밝은 피부', '살구 피부', '갈색 피부', '진갈색 피부'],
  HAIRS: ['짧은 머리', '단발 머리', '긴 머리', '포니테일', '곱슬 머리'],
  HAIR_COLORS: ['#2d2a26', '#6b4226', '#b45309', '#eab308', '#f472b6', '#64748b'],
  HAIR_COLOR_NAMES: ['흑발', '갈색', '적갈색', '금발', '핑크', '은발'],
  OUTFITS: ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#0ea5e9', '#a855f7'],
  OUTFIT_NAMES: ['인디고 셔츠', '그린 셔츠', '로즈 셔츠', '앰버 셔츠', '스카이 셔츠', '퍼플 셔츠'],

  /** 해금 코스튬 정보 조회 (전체 직업에서 검색) */
  costumeOf(costumeId) {
    if (!costumeId) return null;
    for (const j of getAllJobs()) {
      if (j.costume && j.costume.id === costumeId) return j.costume;
    }
    return null;
  },

  hairSvg(style, color) {
    switch (style) {
      case 1: // 단발
        return `<path d="M25 36 Q25 13 50 13 Q75 13 75 36 L75 57 Q71 60 67 57 L67 33 Q60 23 50 23 Q40 23 33 33 L33 57 Q29 60 25 57 Z" fill="${color}"/>`;
      case 2: // 긴 머리 (뒷머리는 head보다 먼저 그려짐 — back 파트에서 처리)
        return `<path d="M27 38 Q27 14 50 14 Q73 14 73 38 Q65 23 50 23 Q35 23 27 38 Z" fill="${color}"/>`;
      case 3: // 포니테일
        return `<path d="M27 38 Q27 14 50 14 Q73 14 73 38 Q65 23 50 23 Q35 23 27 38 Z" fill="${color}"/>
                <circle cx="74" cy="22" r="7" fill="${color}"/>
                <path d="M74 22 Q84 36 77 52 Q73 40 70 30 Z" fill="${color}"/>`;
      case 4: // 곱슬
        return `<circle cx="35" cy="21" r="10" fill="${color}"/><circle cx="50" cy="16" r="11" fill="${color}"/><circle cx="65" cy="21" r="10" fill="${color}"/>
                <circle cx="28" cy="32" r="7" fill="${color}"/><circle cx="72" cy="32" r="7" fill="${color}"/>`;
      default: // 짧은 머리
        return `<path d="M27 38 Q27 15 50 15 Q73 15 73 38 Q66 24 50 24 Q34 24 27 38 Z" fill="${color}"/>`;
    }
  },

  hairBackSvg(style, color) {
    if (style === 2) {
      return `<path d="M28 30 Q28 12 50 12 Q72 12 72 30 L75 80 Q62 87 50 85 Q38 87 25 80 Z" fill="${color}"/>`;
    }
    return '';
  },

  /**
   * 아바타 SVG 문자열 생성
   * @param cfg 아바타 설정
   * @param size 렌더 크기(px)
   */
  render(cfg, size = 80) {
    const skin = this.SKINS[cfg.skin % this.SKINS.length];
    const hairC = this.HAIR_COLORS[cfg.hairColor % this.HAIR_COLORS.length];
    const costume = this.costumeOf(cfg.costume);
    const outfit = costume ? costume.color : this.OUTFITS[cfg.outfit % this.OUTFITS.length];
    const badge = costume ? `<text x="50" y="91" font-size="16" text-anchor="middle">${costume.emoji}</text>` : '';
    return `
<svg width="${size}" height="${size * 1.25}" viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg">
  ${this.hairBackSvg(cfg.hair, hairC)}
  <rect x="36" y="100" width="11" height="17" rx="5" fill="#334155"/>
  <rect x="53" y="100" width="11" height="17" rx="5" fill="#334155"/>
  <ellipse cx="41" cy="119" rx="8" ry="4" fill="#1e293b"/>
  <ellipse cx="59" cy="119" rx="8" ry="4" fill="#1e293b"/>
  <rect x="18" y="68" width="11" height="26" rx="5.5" fill="${outfit}"/>
  <rect x="71" y="68" width="11" height="26" rx="5.5" fill="${outfit}"/>
  <circle cx="23.5" cy="96" r="4.5" fill="${skin}"/>
  <circle cx="76.5" cy="96" r="4.5" fill="${skin}"/>
  <rect x="28" y="62" width="44" height="42" rx="14" fill="${outfit}"/>
  ${badge}
  <circle cx="50" cy="40" r="23" fill="${skin}"/>
  ${this.hairSvg(cfg.hair, hairC)}
  <circle cx="42" cy="43" r="2.6" fill="#1e293b"/>
  <circle cx="58" cy="43" r="2.6" fill="#1e293b"/>
  <path d="M44 51 Q50 56 56 51" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="37" cy="49" r="3.5" fill="#fda4af" opacity=".5"/>
  <circle cx="63" cy="49" r="3.5" fill="#fda4af" opacity=".5"/>
</svg>`;
  },

  /** 직업 NPC(삼갈래길 끝에 서 있는 캐릭터) */
  npc(job, size = 56) {
    return `
<svg width="${size}" height="${size * 1.25}" viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg">
  <rect x="36" y="100" width="11" height="17" rx="5" fill="#334155"/>
  <rect x="53" y="100" width="11" height="17" rx="5" fill="#334155"/>
  <rect x="18" y="68" width="11" height="26" rx="5.5" fill="${job.color}"/>
  <rect x="71" y="68" width="11" height="26" rx="5.5" fill="${job.color}"/>
  <rect x="28" y="62" width="44" height="42" rx="14" fill="${job.color}"/>
  ${Icons.nested(Icons.JOB_ICON_MAP[job.id] || 'briefcase', { x: 39, y: 76, size: 22, color: 'rgba(255,255,255,.95)' })}
  <circle cx="50" cy="40" r="23" fill="#fde8d0"/>
  <path d="M27 38 Q27 15 50 15 Q73 15 73 38 Q66 24 50 24 Q34 24 27 38 Z" fill="#475569"/>
  <circle cx="42" cy="43" r="2.6" fill="#1e293b"/>
  <circle cx="58" cy="43" r="2.6" fill="#1e293b"/>
  <path d="M44 51 Q50 55 56 51" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>`;
  },
};
