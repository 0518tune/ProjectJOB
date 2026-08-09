/* =========================================================
 * ProjectJOB — Three.js 로우폴리 3D 씬 엔진
 * ---------------------------------------------------------
 * 절차적 로우폴리 캐릭터(Char3D) + 카테고리 코스튬 아키타입
 * (COSTUME_KITS) + 직업별 소품(PROP_KITS)으로 잡보드 갈림길
 * (Scene3D.Board)과 시나리오 무대(Scene3D.Stage)를 렌더링한다.
 * SAVE.avatar 색상 팔레트는 avatar.js의 AvatarSVG 팔레트와
 * 동일한 배열을 참조해 2D/3D 캐릭터 색상이 일관되게 유지된다.
 * ========================================================= */

const Scene3D = (() => {
  const HAS_THREE = typeof THREE !== 'undefined';

  /* ------------------------------------------------------- *
   * 0. 코스튬 아키타입 / 소품 라이브러리
   * ------------------------------------------------------- */
  /* 직업복 아키타입.
   * outfit = 상의(몸통+팔), pants = 하의. 나머지는 얹히는 파츠 플래그다.
   * 실루엣(모자/헬멧/후드)과 색을 함께 바꿔야 멀리서도 "무슨 직업인지" 읽힌다. */
  const COSTUME_KITS = {
    medical:        { outfit: '#f8fafc', pants: '#dfe6ee', neckAccessory: true },                          // 의사 가운
    nursing:        { outfit: '#9fd3e6', pants: '#74b6ce', nurseCap: true },                               // 간호사 스크럽
    vetcoat:        { outfit: '#f8fafc', pants: '#cfe4bd', neckAccessory: true },                          // 수의사 가운
    culinary:       { outfit: '#f8fafc', pants: '#3a4453', hat: 'chefHat', apron: '#eef2f6' },             // 셰프복
    cafe:           { outfit: '#f3e3c9', pants: '#4a3524', hat: 'cap', apron: '#6b4a2f' },                 // 바리스타 앞치마
    aviation:       { outfit: '#22406b', pants: '#182f4e', hat: 'aviatorCap', epaulette: '#eab308' },      // 파일럿 제복
    police:         { outfit: '#33547e', pants: '#274162', hat: 'peakedCap', badge: true, epaulette: '#cbd5e1' },
    fire:           { outfit: '#c2410c', pants: '#7c2d12', helmet: '#dc2626', stripe: true },              // 방화복
    sports_uniform: { outfit: '#f6f7f9', pants: '#22406b', hat: 'cap', stripe: true },                     // 야구 유니폼
    creative:       { outfit: '#dcc7ea', pants: '#4a3524', hat: 'beret' },                                 // 디자이너
    writing:        { outfit: '#c8b295', pants: '#4a3524', glasses: true, scarf: '#8f6b4a' },              // 작가 가디건
    business:       { outfit: '#455168', pants: '#2c3444', necktie: true },                                // 오피스 정장
    law:            { outfit: '#2f2f3d', pants: '#22222d', necktie: true },                                // 법조 정장
    academic:       { outfit: '#7f93a8', pants: '#404d60', glasses: true },                                // 교사 재킷
    farm:           { outfit: '#cfe0b8', pants: '#5b7d4a', hat: 'strawHat', straps: true },                // 농사 작업복
    florist:        { outfit: '#f6d3de', pants: '#6b8f5e', apron: '#c8708c' },                             // 플로리스트 앞치마
    tech:           { outfit: '#3d7f8c', pants: '#2b5a63', headset: true },                                // 개발자
    hoodie:         { outfit: '#5b6673', pants: '#414a55', hood: true },                                   // 유튜버 후드
    hoodie_purple:  { outfit: '#8069b8', pants: '#5c4a86', hood: true },                                   // 게임기획자 후드
    idol:           { outfit: '#f472b6', pants: '#f6f7f9', stripe: true, epaulette: '#fde68a' },           // 아이돌 무대의상
    beauty_service: { outfit: '#fefce8', pants: '#e7e5e4' },
    default:        { outfit: '#efe0c6', pants: '#3a4453' },
  };

  /* JOB_DATABASE(index.html 하단 "기획자 데이터 존")의 실제 직업 ID와 1:1로 맞춰야 한다.
   * JobBinder.bindAll()이 런타임에 JOBS 배열을 이 20개 직업으로 완전히 교체하므로,
   * data.js의 구 스키마 id(nurse 외 flight_attendant/game_designer 등)는 더 이상 쓰이지 않는다. */
  const JOB_COSTUME_MAP = {
    farmer:      { kit: 'farm', prop: 'hoe' },
    marketer:    { kit: 'business', prop: 'laptop' },
    engineer:    { kit: 'tech', prop: 'laptop' },
    lawyer:      { kit: 'law', prop: 'briefcase' },
    chef:        { kit: 'culinary', prop: 'pan' },
    designer:    { kit: 'creative', prop: 'palette' },
    firefighter: { kit: 'fire', prop: 'axe' },
    idol:        { kit: 'idol', prop: 'mic' },
    baseball:    { kit: 'sports_uniform', prop: 'bat' },
    doctor:      { kit: 'medical', prop: 'clipboard' },
    teacher:     { kit: 'academic', prop: 'book' },
    youtuber:    { kit: 'hoodie', prop: 'camera' },
    barista:     { kit: 'cafe', prop: 'cup' },
    nurse:       { kit: 'nursing', prop: 'pillBottle' },
    police:      { kit: 'police', prop: 'whistle' },
    writer:      { kit: 'writing', prop: 'book' },
    pilot:       { kit: 'aviation', prop: 'clipboard' },
    vet:         { kit: 'vetcoat', prop: 'clipboard' },
    gamedev:     { kit: 'hoodie_purple', prop: 'controller' },
    florist:     { kit: 'florist', prop: 'bouquet' },
  };

  const NPC_COSTUME_MAP = {
    '친절한 사수': { kit: 'business', prop: 'clipboard' },
    '깐깐한 팀장님': { kit: 'law', prop: 'briefcase' },
    '화가 난 고객': { kit: 'default', prop: null },
    '유쾌한 동기': { kit: 'hoodie', prop: null },
    '베테랑 선배': { kit: 'business', prop: 'briefcase' },
    '커리어 멘토': { kit: 'academic', prop: 'book' },
  };

  function costumeForJob(job) {
    return (job && JOB_COSTUME_MAP[job.id]) || { kit: 'default', prop: 'briefcase' };
  }
  function costumeForNpc(npc) {
    return (npc && NPC_COSTUME_MAP[npc.name]) || { kit: 'default', prop: null };
  }

  /* ------------------------------------------------------- *
   * 1. 저수준 프리미티브 빌더
   * ------------------------------------------------------- */
  let mesh = () => null, group = () => null;
  if (HAS_THREE) {
    mesh = (geo, color, opts = {}) => {
      const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.05, ...opts });
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = false;
      return m;
    };
    group = () => new THREE.Group();
  }

  /* ------------------------------------------------------- *
   * 2. Char3D — 절차적 로우폴리 캐릭터
   * ------------------------------------------------------- */
  const Char3D = {
    /** cfg = { skin:'#hex', hair:'#hex', outfit:'#hex' } */
    build(cfg) {
      const root = group();
      const legL = mesh(new THREE.BoxGeometry(0.18, 0.55, 0.22), cfg.pants || '#3a4453');
      legL.position.set(-0.14, 0.275, 0);
      const legR = legL.clone(); legR.position.x = 0.14;
      const torso = mesh(new THREE.BoxGeometry(0.52, 0.62, 0.32), cfg.outfit);
      torso.position.set(0, 0.86, 0);
      const armL = mesh(new THREE.BoxGeometry(0.16, 0.54, 0.16), cfg.outfit);
      armL.position.set(-0.35, 0.86, 0);
      const armR = armL.clone(); armR.position.x = 0.35;
      const handL = mesh(new THREE.BoxGeometry(0.15, 0.13, 0.15), cfg.skin);
      handL.position.set(-0.35, 0.55, 0);
      const handR = handL.clone(); handR.position.x = 0.35;
      const head = mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), cfg.skin);
      head.position.set(0, 1.42, 0);
      const hair = mesh(new THREE.BoxGeometry(0.44, 0.15, 0.44), cfg.hair);
      hair.position.set(0, 1.64, -0.02);

      root.add(legL, legR, torso, armL, armR, handL, handR, head, hair);
      root.userData.parts = { root, legL, legR, torso, armL, armR, handL, handR, head, hair, extras: [] };
      root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return root.userData.parts;
    },

    /** 코스튬 아키타입 + 소품을 캐릭터에 적용 */
    applyCostume(parts, kitKey, propKey, accentColor) {
      const kit = COSTUME_KITS[kitKey] || COSTUME_KITS.default;
      const accent = accentColor || '#6366f1';

      /* 직업복 색 — 상의(몸통+팔)와 하의를 통째로 갈아입힌다.
       * (팔/다리 오른쪽은 왼쪽의 clone이라 머티리얼을 공유하므로 한 번만 칠하면 된다) */
      if (kit.outfit) { parts.torso.material.color.set(kit.outfit); parts.armL.material.color.set(kit.outfit); }
      if (kit.pants) parts.legL.material.color.set(kit.pants);
      if (kit.coatColor) parts.torso.material.color.set(kit.coatColor); // 구 스키마 호환

      /* 앞치마 — 셰프·바리스타·플로리스트의 핵심 실루엣 */
      if (kit.apron) {
        const cloth = mesh(new THREE.BoxGeometry(0.44, 0.66, 0.06), kit.apron);
        cloth.position.set(0, 0.72, 0.17);
        const bib = mesh(new THREE.BoxGeometry(0.28, 0.2, 0.05), kit.apron);
        bib.position.set(0, 1.11, 0.18);
        parts.root.add(cloth, bib); parts.extras.push(cloth, bib);
      }
      /* 후드 — 유튜버·게임기획자 */
      if (kit.hood) {
        const back = mesh(new THREE.BoxGeometry(0.46, 0.34, 0.16), kit.outfit || '#59626f');
        back.position.set(0, 1.34, -0.21);
        const collar = mesh(new THREE.BoxGeometry(0.5, 0.12, 0.42), kit.outfit || '#59626f');
        collar.position.set(0, 1.18, 0);
        parts.root.add(back, collar); parts.extras.push(back, collar);
      }
      /* 소방 헬멧 — 챙이 뒤로 긴 형태 */
      if (kit.helmet) {
        const dome = mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.85), kit.helmet);
        dome.position.set(0, 1.6, 0);
        const brim = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.34), kit.helmet);
        brim.position.set(0, 1.6, -0.08);
        const shield = mesh(new THREE.BoxGeometry(0.2, 0.13, 0.03), '#fbbf24');
        shield.position.set(0, 1.72, 0.23);
        parts.root.add(dome, brim, shield); parts.extras.push(dome, brim, shield);
        parts.hair.visible = false;
      }
      /* 간호사 캡 */
      if (kit.nurseCap) {
        const cap = mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.11, 10), '#ffffff');
        cap.position.set(0, 1.74, -0.02);
        const cross = mesh(new THREE.BoxGeometry(0.07, 0.03, 0.02), '#e05a6e');
        cross.position.set(0, 1.75, 0.19);
        const cross2 = mesh(new THREE.BoxGeometry(0.03, 0.07, 0.02), '#e05a6e');
        cross2.position.set(0, 1.75, 0.19);
        parts.root.add(cap, cross, cross2); parts.extras.push(cap, cross, cross2);
      }
      /* 견장 — 제복 계열(경찰·파일럿·아이돌 무대의상)의 격식 표현 */
      if (kit.epaulette) {
        const geo = new THREE.BoxGeometry(0.19, 0.05, 0.19);
        const eL = mesh(geo, kit.epaulette); eL.position.set(-0.33, 1.14, 0);
        const eR = mesh(geo, kit.epaulette); eR.position.set(0.33, 1.14, 0);
        parts.root.add(eL, eR); parts.extras.push(eL, eR);
      }
      /* 목도리 — 작가의 서재 느낌 */
      if (kit.scarf) {
        const ring = mesh(new THREE.TorusGeometry(0.2, 0.055, 6, 14), kit.scarf);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 1.17, 0);
        const tail = mesh(new THREE.BoxGeometry(0.11, 0.3, 0.05), kit.scarf);
        tail.position.set(0.12, 1.0, 0.16);
        parts.root.add(ring, tail); parts.extras.push(ring, tail);
      }

      if (kit.hat) {
        const hat = this._buildHat(kit.hat, accent);
        if (hat) { hat.position.set(0, 1.68, 0); parts.root.add(hat); parts.extras.push(hat); parts.hair.visible = kit.hat !== 'strawHat'; }
      }
      if (kit.neckAccessory) {
        const tube = mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 12), '#64748b');
        tube.rotation.x = Math.PI / 2.1;
        tube.position.set(0, 1.16, 0.13);
        const bell = mesh(new THREE.SphereGeometry(0.045, 6, 6), '#94a3b8');
        bell.position.set(0, 0.9, 0.2);
        parts.root.add(tube, bell); parts.extras.push(tube, bell);
      }
      if (kit.necktie) {
        const tie = mesh(new THREE.BoxGeometry(0.08, 0.32, 0.03), accent);
        tie.position.set(0, 0.92, 0.17);
        parts.root.add(tie); parts.extras.push(tie);
      }
      if (kit.stripe) {
        const stripe = mesh(new THREE.BoxGeometry(0.54, 0.1, 0.34), '#ffffff');
        stripe.position.set(0, 1.0, 0);
        parts.root.add(stripe); parts.extras.push(stripe);
      }
      if (kit.badge) {
        const badge = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), '#fbbf24');
        badge.position.set(0.16, 1.0, 0.17);
        parts.root.add(badge); parts.extras.push(badge);
      }
      if (kit.glasses) {
        const ringGeo = new THREE.TorusGeometry(0.07, 0.016, 6, 10);
        const gL = mesh(ringGeo, '#1e293b'); gL.position.set(-0.1, 1.44, 0.19);
        const gR = mesh(ringGeo, '#1e293b'); gR.position.set(0.1, 1.44, 0.19);
        const bridge = mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), '#1e293b'); bridge.position.set(0, 1.44, 0.19);
        parts.root.add(gL, gR, bridge); parts.extras.push(gL, gR, bridge);
      }
      if (kit.headset) {
        const arch = mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 12, Math.PI), '#1e293b');
        arch.rotation.z = Math.PI; arch.position.set(0, 1.68, 0);
        const earL = mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), '#1e293b'); earL.position.set(-0.22, 1.44, 0);
        const earR = earL.clone(); earR.position.x = 0.22;
        parts.root.add(arch, earL, earR); parts.extras.push(arch, earL, earR);
      }
      if (kit.straps) {
        const strapGeo = new THREE.BoxGeometry(0.07, 0.5, 0.03);
        const sL = mesh(strapGeo, '#78350f'); sL.position.set(-0.14, 0.9, 0.17); sL.rotation.z = 0.12;
        const sR = mesh(strapGeo, '#78350f'); sR.position.set(0.14, 0.9, 0.17); sR.rotation.z = -0.12;
        parts.root.add(sL, sR); parts.extras.push(sL, sR);
      }
      if (kit.trimDefault) {
        const trim = mesh(new THREE.BoxGeometry(0.54, 0.05, 0.02), kit.trimDefault);
        trim.position.set(0, 0.7, 0.17);
        parts.root.add(trim); parts.extras.push(trim);
      }
      if (propKey) {
        const prop = this._buildProp(propKey, accent);
        if (prop) { prop.position.set(0.35, 0.42, 0.12); prop.rotation.set(0, 0, -0.3); parts.root.add(prop); parts.extras.push(prop); }
      }
    },

    _buildHat(type, accent) {
      const g = group();
      switch (type) {
        case 'chefHat': {
          const base = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 10), '#f8fafc');
          const poof = mesh(new THREE.SphereGeometry(0.19, 8, 6), '#f8fafc');
          poof.position.y = 0.14;
          g.add(base, poof);
          return g;
        }
        case 'aviatorCap': {
          const brim = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 12), '#152a43');
          const top = mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.16, 12), '#1e3a5f');
          top.position.y = 0.09;
          g.add(brim, top);
          return g;
        }
        case 'cap': {
          const top = mesh(new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.8), accent);
          const brim = mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.03, 10, 1, false, 0, Math.PI), accent);
          brim.position.set(0, -0.02, 0.16); brim.rotation.x = -0.15;
          g.add(top, brim);
          return g;
        }
        case 'beret': {
          const b = mesh(new THREE.SphereGeometry(0.22, 10, 8), '#7c3aed');
          b.scale.set(1, 0.45, 1);
          return b;
        }
        case 'peakedCap': {
          const top = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.14, 10), '#1e293b');
          const brim = mesh(new THREE.CylinderGeometry(0.1, 0.24, 0.03, 10, 1, false, 0, Math.PI), '#0f172a');
          brim.position.set(0, -0.05, 0.17); brim.rotation.x = -0.1;
          g.add(top, brim);
          return g;
        }
        case 'strawHat': {
          const brim = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 14), '#d4a96c');
          const top = mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.14, 12), '#e7c99a');
          top.position.y = 0.09;
          g.add(brim, top);
          return g;
        }
        default:
          return null;
      }
    },

    _buildProp(key, accent) {
      const g = group();
      switch (key) {
        case 'pan': {
          const body = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 12), '#94a3b8');
          const handle = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), '#334155');
          handle.position.set(0, 0, 0.16);
          g.add(body, handle); return g;
        }
        case 'cup': return mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8), '#f8fafc');
        case 'clipboard': {
          const board = mesh(new THREE.BoxGeometry(0.14, 0.19, 0.02), '#a16207');
          const paper = mesh(new THREE.BoxGeometry(0.11, 0.15, 0.01), '#f8fafc');
          paper.position.z = 0.015;
          g.add(board, paper); return g;
        }
        case 'pillBottle': return mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8), '#f97316');
        case 'controller': {
          const b = mesh(new THREE.BoxGeometry(0.2, 0.09, 0.06), '#1e293b');
          return b;
        }
        case 'palette': {
          const p = mesh(new THREE.SphereGeometry(0.13, 10, 6), '#e7c99a');
          p.scale.set(1, 0.35, 0.8);
          const dab = mesh(new THREE.SphereGeometry(0.02, 6, 6), '#f43f5e'); dab.position.set(0.05, 0.04, 0.03);
          g.add(p, dab); return g;
        }
        case 'camera': {
          const body = mesh(new THREE.BoxGeometry(0.16, 0.12, 0.1), '#1e293b');
          const lens = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 10), '#0f172a');
          lens.rotation.x = Math.PI / 2; lens.position.z = 0.09;
          g.add(body, lens); return g;
        }
        case 'ruler': return mesh(new THREE.BoxGeometry(0.03, 0.32, 0.02), '#eab308');
        case 'briefcase': {
          const b = mesh(new THREE.BoxGeometry(0.18, 0.13, 0.05), '#78350f');
          const handle = mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 8, Math.PI), '#3f2410');
          handle.position.y = 0.08; handle.rotation.z = Math.PI;
          g.add(b, handle); return g;
        }
        case 'mic': {
          const stick = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), '#1e293b');
          const head = mesh(new THREE.SphereGeometry(0.045, 8, 6), '#334155'); head.position.y = 0.1;
          g.add(stick, head); return g;
        }
        case 'axe': {
          const handle = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6), '#78350f');
          const blade = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), '#94a3b8'); blade.position.y = 0.14;
          g.add(handle, blade); return g;
        }
        case 'flag': {
          const pole = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), '#78350f');
          const cloth = mesh(new THREE.BoxGeometry(0.14, 0.09, 0.01), accent); cloth.position.set(0.07, 0.11, 0);
          g.add(pole, cloth); return g;
        }
        case 'book': {
          const b = mesh(new THREE.BoxGeometry(0.14, 0.02, 0.18), '#0ea5e9');
          return b;
        }
        case 'laptop': {
          const base = mesh(new THREE.BoxGeometry(0.18, 0.015, 0.13), '#475569');
          const screen = mesh(new THREE.BoxGeometry(0.18, 0.13, 0.012), '#1e293b');
          screen.position.set(0, 0.065, -0.06); screen.rotation.x = -0.35;
          g.add(base, screen); return g;
        }
        case 'hoe': {
          const handle = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 6), '#78350f');
          const blade = mesh(new THREE.BoxGeometry(0.12, 0.04, 0.02), '#94a3b8'); blade.position.y = 0.17;
          g.add(handle, blade); return g;
        }
        case 'hammer': {
          const handle = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 6), '#78350f');
          const head = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), '#475569'); head.position.y = 0.12;
          g.add(handle, head); return g;
        }
        case 'bouquet': {
          const colors = ['#f472b6', '#facc15', '#f87171'];
          colors.forEach((c, i) => {
            const s = mesh(new THREE.SphereGeometry(0.045, 6, 6), c);
            s.position.set((i - 1) * 0.05, 0.03, 0);
            g.add(s);
          });
          return g;
        }
        case 'scissors': {
          const a = mesh(new THREE.BoxGeometry(0.16, 0.02, 0.015), '#94a3b8'); a.rotation.z = 0.35;
          const b = mesh(new THREE.BoxGeometry(0.16, 0.02, 0.015), '#94a3b8'); b.rotation.z = -0.35;
          g.add(a, b); return g;
        }
        case 'whistle': return mesh(new THREE.SphereGeometry(0.035, 6, 6), '#fbbf24');
        case 'bat': {
          const handle = mesh(new THREE.CylinderGeometry(0.018, 0.035, 0.32, 8), '#e7c99a');
          const cap = mesh(new THREE.SphereGeometry(0.025, 6, 6), '#a16207'); cap.position.y = -0.16;
          g.add(handle, cap); return g;
        }
        default: return null;
      }
    },
  };

  /* ------------------------------------------------------- *
   * 3. 공용 유틸
   * ------------------------------------------------------- */
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ------------------------------------------------------- *
   * 3-1. 감정 모션(Emote) — 연출 큐 { 모션:'기쁨' } 이 호출한다.
   *      캐릭터 리그가 평면 구조(손이 팔의 자식이 아님)라, 팔을 돌릴 때
   *      손 위치를 어깨 기준으로 직접 재계산해 따라붙게 한다.
   * ------------------------------------------------------- */
  const ARM_X = 0.35, ARM_Y = 0.86, HAND_DROP = -0.31;

  function poseArm(parts, side, rx, rz) {
    const arm = side === 'L' ? parts.armL : parts.armR;
    const hand = side === 'L' ? parts.handL : parts.handR;
    const sx = side === 'L' ? -ARM_X : ARM_X;
    arm.rotation.x = rx; arm.rotation.z = rz;
    const x1 = -HAND_DROP * Math.sin(rz);
    const y1 = HAND_DROP * Math.cos(rz);
    hand.position.set(sx + x1, ARM_Y + y1 * Math.cos(rx), y1 * Math.sin(rx));
  }

  /** 모션별 재생 길이(초) */
  const EMOTE_DUR = { 기쁨: 0.95, 당황: 0.75, 끄덕: 0.7, 고민: 1.15, 움츠림: 0.85 };

  function applyEmote(parts, now) {
    const e = parts.emote;
    const p = Math.min(1, (now - e.start) / (e.dur * 1000));
    const decay = 1 - p;
    const root = parts.root;
    const emis = parts.torso.material.emissive;

    switch (e.kind) {
      case '기쁨': // 방방 뛰며 양팔을 번쩍
        root.position.y += Math.abs(Math.sin(p * Math.PI * 3.2)) * 0.24 * decay;
        poseArm(parts, 'L', 0, 0.6 + Math.sin(p * Math.PI * 3.2) * 0.4 * decay);
        poseArm(parts, 'R', 0, -0.6 - Math.sin(p * Math.PI * 3.2) * 0.4 * decay);
        if (emis) { emis.set('#fbbf24'); parts.torso.material.emissiveIntensity = 0.55 * decay; }
        break;
      case '당황': // 부르르 떨며 팔을 앞으로 들어 방어
        root.rotation.z = Math.sin(p * Math.PI * 9) * 0.14 * decay;
        root.rotation.x = 0.12 * decay;
        poseArm(parts, 'L', -1.0 * decay, 0.2 * decay);
        poseArm(parts, 'R', -1.0 * decay, -0.2 * decay);
        if (emis) { emis.set('#f43f5e'); parts.torso.material.emissiveIntensity = 0.45 * decay; }
        break;
      case '끄덕': // 상체를 두 번 숙였다 편다
        root.rotation.x = Math.abs(Math.sin(p * Math.PI * 2)) * 0.2 * decay;
        break;
      case '고민': // 몸을 기울이고 한 손을 턱 근처로
        root.rotation.z = Math.sin(p * Math.PI) * 0.13;
        poseArm(parts, 'R', -2.1 * Math.sin(p * Math.PI), -0.35 * Math.sin(p * Math.PI));
        break;
      case '움츠림': // 어깨를 말고 작아진다
        root.rotation.x = 0.2 * Math.sin(p * Math.PI);
        root.scale.setScalar(1 - 0.09 * Math.sin(p * Math.PI));
        poseArm(parts, 'L', -0.5 * Math.sin(p * Math.PI), 0.45 * Math.sin(p * Math.PI));
        poseArm(parts, 'R', -0.5 * Math.sin(p * Math.PI), -0.45 * Math.sin(p * Math.PI));
        break;
      default:
        root.rotation.x = Math.sin(p * Math.PI * 2) * 0.08 * decay;
    }

    if (p >= 1) {
      root.scale.setScalar(1);
      root.rotation.set(0, root.rotation.y, 0);
      parts.emote = null;
    }
  }

  function avatarColors(save) {
    const a = (save && save.avatar) || { skin: 0, hair: 0, hairColor: 0, outfit: 0 };
    return {
      skin: (typeof AvatarSVG !== 'undefined' ? AvatarSVG.SKINS : ['#fde8d0'])[a.skin % 4] || '#fde8d0',
      hair: (typeof AvatarSVG !== 'undefined' ? AvatarSVG.HAIR_COLORS : ['#2d2a26'])[a.hairColor % 6] || '#2d2a26',
      outfit: (typeof AvatarSVG !== 'undefined' ? AvatarSVG.OUTFITS : ['#6366f1'])[a.outfit % 6] || '#6366f1',
    };
  }

  function makeRenderer(container) {
    const w = Math.max(container.clientWidth, 100);
    const h = Math.max(container.clientHeight, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    container.appendChild(renderer.domElement);
    return { renderer, w, h };
  }

  function addLights(scene, shadowSize) {
    const amb = new THREE.AmbientLight(0xffffff, 0.7);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(5, 8, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    const s = shadowSize || 6;
    dir.shadow.camera.left = -s; dir.shadow.camera.right = s;
    dir.shadow.camera.top = s; dir.shadow.camera.bottom = -s;
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 25;
    scene.add(amb, dir);
    return { amb, dir };
  }

  /** Tailwind CDN의 JIT 클래스 주입은 비동기라, 새로 삽입된 DOM의 clientWidth/Height를
   * 마운트 시점에 동기적으로 읽으면 레이아웃이 아직 안정되기 전 값을 얻을 수 있다.
   * ResizeObserver로 실제 크기가 확정될 때(및 창 크기 변경 시)마다 렌더러/카메라를 갱신한다. */
  function watchResize(container, state, onResize) {
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width < 4 || height < 4) return;
      if (Math.abs(width - state.w) < 1 && Math.abs(height - state.h) < 1) return;
      state.w = width; state.h = height;
      onResize(width, height);
    });
    ro.observe(container);
    state.resizeObserver = ro;
  }

  function disposeObject(obj) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.geometry && o.geometry.dispose();
        if (o.material) { Array.isArray(o.material) ? o.material.forEach((m) => m.dispose()) : o.material.dispose(); }
      }
    });
  }

  function teardown(state) {
    if (!state) return;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    if (state.resizeObserver) state.resizeObserver.disconnect();
    if (state.scene) disposeObject(state.scene);
    if (state.renderer) {
      state.renderer.dispose();
      if (state.renderer.domElement && state.renderer.domElement.parentNode) {
        state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
      }
    }
    if (state.labelsEl) state.labelsEl.forEach((el) => el.remove());
  }

  /* ------------------------------------------------------- *
   * 4. Scene3D.Board — 잡보드 갈림길
   * ------------------------------------------------------- */
  const Board = {
    _s: null, // 현재 상태

    mount(container, jobs, selIdx, labelsHtml, onPick) {
      if (!HAS_THREE) { this._fallback(container); return; }
      teardown(this._s);
      const { renderer, w, h } = makeRenderer(container);
      const scene = new THREE.Scene();
      const aspect = w / h;
      // 카메라: 정통 아이소메트릭에 가깝게 피치를 낮추고(덜 탑뷰) 거리를 늘렸다.
      // 라벨 겹침/클리핑은 더 이상 카메라 기하학 계산에만 의존하지 않고
      // (아래 _loop의 헤드-상대 배치 + 충돌 회피가 항상 최종 보정한다) — 즉 카메라 값이
      // 뷰포트마다 달라져도 라벨은 절대 겹치거나 캐릭터를 가리지 않는다.
      /* 세 갈래 노드(월드 x = ±4.8)가 어떤 화면비에서도 잘리지 않도록 뷰 크기를 정한다.
       * 가로 반경 = viewSize * aspect / 2 가 6.7 이상이어야 양끝 캐릭터가 여유 있게 들어온다.
       * (세로로 긴 모바일에서는 이 식이 알아서 뷰를 넓혀 준다) */
      const frameFor = (a) => Math.max(9.6, 13.4 / a);
      const viewSize = frameFor(aspect);
      const camera = new THREE.OrthographicCamera(-viewSize * aspect / 2, viewSize * aspect / 2, viewSize / 2, -viewSize / 2, 0.1, 100);
      /* 정면-부감 카메라.
       * 이전의 정통 아이소메트릭(9.5, 8.2, 9.5)은 월드 X축을 화면상 대각선으로 눌러버려,
       * 세 갈래 노드가 화면 폭 1026px 중 82px 안에 뭉쳐 투영됐다. 그 결과 152px짜리 직업
       * 카드들이 서로 밀어내며 캐릭터에서 멀리 떨어져 "버튼만 띄엄띄엄" 떠 보였다.
       * 카메라를 정면 쪽으로 돌려 월드 X가 화면 X에 그대로 대응하게 하면,
       * 카드가 자기 캐릭터 바로 위에 붙는다. (약간의 x 오프셋으로 입체감은 남긴다) */
      const isoBase = new THREE.Vector3(2.0, 6.4, 11.2);
      camera.position.copy(isoBase);
      camera.lookAt(0, 0, 0);
      addLights(scene, 16);

      // 지면 (넓어진 노드 간격에 맞춰 확장)
      const ground = mesh(new THREE.BoxGeometry(32, 0.3, 14), '#9ac47c');
      ground.position.y = -0.15; ground.receiveShadow = true;
      scene.add(ground);

      // 3개 직업 노드(11시·12시·1시) 좌표: X 간격을 크게 벌리고 길 길이도 1.5배 연장해
      // 캐릭터들이 뭉쳐 보이지 않게 한다. 겹침 방지의 최종 보장은 라벨 충돌 회피가 담당한다.
      const XPOS = [-4.8, 0, 4.8];
      const trunkEnd = new THREE.Vector3(0, 0.01, 2.0);
      const trunk = mesh(new THREE.BoxGeometry(1.05, 0.04, 2.6), '#e7c99a');
      trunk.position.set(0, 0.01, 0.9); trunk.receiveShadow = true;
      scene.add(trunk);

      const npcTargets = XPOS.map((x) => new THREE.Vector3(x, 0, -3.0));
      npcTargets.forEach((pos) => {
        const dx = pos.x - 0, dz = pos.z - trunkEnd.z;
        const len = Math.hypot(dx, dz);
        const fork = mesh(new THREE.BoxGeometry(0.85, 0.035, len), '#e7c99a');
        fork.position.set(pos.x / 2, 0.005, trunkEnd.z + dz / 2);
        fork.rotation.y = Math.atan2(dx, dz);
        fork.receiveShadow = true;
        scene.add(fork);
      });

      // 로우폴리 나무
      const treeSpots = [[-7.2, -4.6], [7.2, -4.6], [-8, 2], [8, 1.4], [-5.6, 5.2], [5.8, 5], [0, -5.8], [-2.4, 6.4]];
      treeSpots.forEach(([x, z]) => {
        const t = group();
        const trunkM = mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.5, 6), '#78350f');
        trunkM.position.y = 0.25;
        const leaf = mesh(new THREE.ConeGeometry(0.42, 0.75, 7), ['#7fb069', '#639a51'][Math.round(Math.random())]);
        leaf.position.y = 0.85; leaf.receiveShadow = true;
        t.add(trunkM, leaf);
        t.position.set(x, 0, z);
        scene.add(t);
      });

      // 직업 캐릭터 — 같은 얼굴이 세 명 서 있지 않도록 피부/머리색도 슬롯마다 다르게 준다
      const SKINS = ['#f8c99b', '#e8b184', '#c98d63'];
      const HAIRS = ['#3f2410', '#1f1a17', '#6b4a2f'];
      const npcChars = jobs.map((job, i) => {
        const parts = Char3D.build({ skin: SKINS[i % 3], hair: HAIRS[i % 3], outfit: '#efe0c6' });
        const c = costumeForJob(job);
        Char3D.applyCostume(parts, c.kit, c.prop, job.color);
        parts.root.position.copy(npcTargets[i]);
        parts.root.rotation.y = Math.PI + Math.atan2(npcTargets[i].x, npcTargets[i].z - trunkEnd.z) * 0.3;
        parts.root.scale.setScalar(1.18); // 아이소메트릭 원경에서 직업복이 읽히도록 살짝 키운다
        scene.add(parts.root);
        return parts;
      });

      // 선택 링
      const selRing = mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 20), '#e8a33d', { emissive: '#e8a33d', emissiveIntensity: 0.55 });
      selRing.rotation.x = -Math.PI / 2;
      scene.add(selRing);

      // 플레이어 캐릭터
      const pc = avatarColors(typeof SAVE !== 'undefined' ? SAVE : null);
      const player = Char3D.build(pc);
      player.root.position.copy(trunkEnd);
      player.root.rotation.y = Math.PI;
      player.root.scale.setScalar(1.18);
      scene.add(player.root);

      // 라벨 오버레이 (기존 road-plate HTML 재사용) — container는 이미 absolute 포지셔닝 컨텍스트
      const labelsEl = jobs.map((job, i) => {
        const el = document.createElement('div');
        el.className = 'road-3d-label';
        el.innerHTML = labelsHtml[i];
        el.addEventListener('click', () => onPick && onPick(i));
        container.appendChild(el);
        return el;
      });

      const s = {
        renderer, scene, camera, w, h, container, viewSize,
        npcChars, player, npcTargets, trunkEnd, selRing, labelsEl,
        selIdx, camTarget: isoBase.clone(), isoBase,
        walk: null, clockStart: performance.now(), rafId: null,
      };
      this._s = s;
      watchResize(container, s, (nw, nh) => {
        renderer.setSize(nw, nh);
        const a = nw / nh;
        s.viewSize = frameFor(a);
        camera.left = -s.viewSize * a / 2; camera.right = s.viewSize * a / 2;
        camera.top = s.viewSize / 2; camera.bottom = -s.viewSize / 2;
        camera.updateProjectionMatrix();
      });
      this.updateSelection(selIdx, true);
      this._loop();
    },

    _fallback(container) {
      container.innerHTML = '<div class="flex items-center justify-center h-full text-sm font-bold text-slate-400">3D 그래픽을 사용할 수 없는 환경이에요 🙏</div>';
    },

    updateSelection(i, instant) {
      const s = this._s; if (!s) return;
      s.selIdx = i;
      const npcPos = s.npcTargets[i];
      s.camTarget = new THREE.Vector3(s.isoBase.x + npcPos.x * 0.18, s.isoBase.y, s.isoBase.z + npcPos.z * 0.1);
      if (instant) s.camera.position.copy(s.camTarget);
      s.labelsEl.forEach((el, idx) => el.classList.toggle('road-3d-label-sel', idx === i));
    },

    walkPlayerTo(i, duration = 1250) {
      const s = this._s; if (!s) return;
      const target = s.npcTargets[i].clone().lerp(s.trunkEnd, 0.42);
      target.y = 0;
      s.walk = { from: s.player.root.position.clone(), to: target, start: performance.now(), duration };
      const lookDir = new THREE.Vector3().subVectors(target, s.player.root.position);
      s.player.root.rotation.y = Math.atan2(lookDir.x, lookDir.z);
      this.updateSelection(i);
    },

    /** 화살표 키로 갈림길을 훑어볼 때의 짧은 미리보기 이동 (커밋 아님) */
    previewWalk(i) {
      const s = this._s; if (!s) return;
      const target = s.npcTargets[i].clone().lerp(s.trunkEnd, 0.75);
      target.y = 0;
      s.walk = { from: s.player.root.position.clone(), to: target, start: performance.now(), duration: 400 };
      const lookDir = new THREE.Vector3().subVectors(target, s.player.root.position);
      s.player.root.rotation.y = Math.atan2(lookDir.x, lookDir.z);
      this.updateSelection(i);
    },

    resetPlayer() {
      const s = this._s; if (!s) return;
      s.walk = { from: s.player.root.position.clone(), to: s.trunkEnd.clone(), start: performance.now(), duration: 500 };
      s.player.root.rotation.y = Math.PI;
    },

    _loop() {
      const s = this._s; if (!s) return;
      const tick = () => {
        if (this._s !== s) return; // 이미 새 씬으로 교체됨
        const now = performance.now();
        const t = (now - s.clockStart) / 1000;

        [...s.npcChars, s.player].forEach((parts, idx) => {
          parts.root.position.y = (parts.root.userData.baseY || 0) + Math.sin(t * 1.6 + idx) * 0.035;
        });

        if (s.walk) {
          const p = Math.min(1, (now - s.walk.start) / s.walk.duration);
          const e = easeInOut(p);
          const y = s.player.root.position.y;
          s.player.root.position.lerpVectors(s.walk.from, s.walk.to, e);
          s.player.root.position.y = y;
          if (p >= 1) s.walk = null;
        }

        s.camera.position.lerp(s.camTarget, 0.07);
        s.camera.lookAt(0, 1.35, 0); // 시선을 올려 인물을 프레임 아래로 내리면 머리 위에 카드 자리가 생긴다

        const npcPos = s.npcTargets[s.selIdx];
        s.selRing.position.set(npcPos.x, 0.02, npcPos.z);
        s.selRing.rotation.z = t * 0.6;

        // ---- 라벨 배치: (1) 캐릭터 머리 꼭대기를 매 프레임 화면좌표로 투영해 그 지점보다
        // 고정 픽셀만큼 위(공중)에 라벨을 띄우고, (2) 좌우 라벨끼리 220px 이내로 가까워지면
        // 서로 밀어내는 충돌 회피를 적용한다. 두 단계 모두 카메라 각도/뷰포트 크기와 무관하게
        // "겹치지 않음"과 "캐릭터를 안 가림"을 항상 보장하는 최종 안전장치다.
        const HEAD_TOP_Y = 2.35; // 모자 포함 캐릭터 최고점 근사 (캐릭터 1.18배 확대 반영)
        const LABEL_GAP_ABOVE_HEAD = 20; // 머리 위 여유(px)
        // 좁은 화면에서는 카드를 균일하게 축소해 3장이 항상 나란히 들어가게 한다.
        const fitScale = Math.max(0.75, Math.min(1, s.w / 640));
        // 최소 간격은 "실제로 렌더된 카드 폭"에서 계산한다 — 문구/폰트가 바뀌어도 자동으로 맞는다.
        const cardW = Math.max(...s.labelsEl.map((el) => el.offsetWidth || 152)) * fitScale;
        const MIN_LABEL_GAP = cardW + 12;

        const pos = s.npcTargets.map((npcPos) => {
          const headTop = npcPos.clone(); headTop.y = HEAD_TOP_Y;
          headTop.project(s.camera);
          const x = (headTop.x * 0.5 + 0.5) * s.w;
          const headScreenY = (-headTop.y * 0.5 + 0.5) * s.h;
          return { x, headScreenY };
        });

        // 좌→우 정렬 후 반복적으로 밀어내기 (3개 노드라 몇 번의 패스로 충분히 수렴)
        const order = pos.map((_, i) => i).sort((a, b) => pos[a].x - pos[b].x);
        for (let pass = 0; pass < 4; pass++) {
          for (let k = 0; k < order.length - 1; k++) {
            const a = pos[order[k]], b = pos[order[k + 1]];
            const d = b.x - a.x;
            if (d < MIN_LABEL_GAP) {
              const push = (MIN_LABEL_GAP - d) / 2;
              a.x -= push; b.x += push;
            }
          }
        }
        // 컨테이너 폭 밖으로 밀려나지 않도록 클램프
        const edge = cardW / 2 + 6;
        pos.forEach((p) => { p.x = Math.max(edge, Math.min(s.w - edge, p.x)); });

        s.labelsEl.forEach((el, i) => {
          const focused = i === s.selIdx;
          const scale = (focused ? 1 : 0.93) * fitScale;
          const labelH = (el.offsetHeight || 80) * scale;
          const x = pos[i].x;
          const y = Math.max(pos[i].headScreenY - LABEL_GAP_ABOVE_HEAD, labelH + 6);
          el.style.opacity = focused ? '1' : '0.88';
          el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`;
        });

        s.renderer.render(s.scene, s.camera);
        s.rafId = requestAnimationFrame(tick);
      };
      s.rafId = requestAnimationFrame(tick);
    },

    pause() { if (this._s && this._s.rafId) { cancelAnimationFrame(this._s.rafId); this._s.rafId = null; } },
    resume() { if (this._s && !this._s.rafId) this._loop(); },
    dispose() { teardown(this._s); this._s = null; },
  };

  /* ------------------------------------------------------- *
   * 5. Scene3D.Stage — 시나리오 진행 무대
   * ------------------------------------------------------- */
  const Stage = {
    _s: null,

    mount(container, npc, job) {
      if (!HAS_THREE) { this._fallback(container); return; }
      teardown(this._s);
      const { renderer, w, h } = makeRenderer(container);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 50);
      // 코지 톤: 햇살처럼 노란 주광 + 크림빛 환경광, 반대편에서 옅은 채움광
      const L = addLights(scene, 3);
      L.amb.color.set('#fff2dc');
      L.dir.color.set('#ffe6bd');
      const fill = new THREE.DirectionalLight(0xffd9b0, 0.28);
      fill.position.set(-4, 2.5, 3);
      scene.add(fill);

      /* 코지 무대(디오라마): 배경 판을 두지 않고 알파로 비워, 뒤의 CSS 하늘
       * 그라디언트(.cine-stage)가 그대로 배경이 되게 한다. 어떤 각도의 카메라
       * 에서도 배경 이음매가 보이지 않고, 무대만 떠 있는 미니어처 느낌이 난다. */
      const platform = mesh(new THREE.CylinderGeometry(3.0, 2.85, 0.3, 36), '#cfa878');
      platform.position.y = -0.15; platform.receiveShadow = true;
      scene.add(platform);
      const rug = mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.04, 32), '#e9c9a8');
      rug.position.y = 0.02; rug.receiveShadow = true;
      scene.add(rug);
      // 무대 뒤편 화분 — 뒤가 비어 보이지 않게 하는 최소한의 소품
      [[-2.05, -1.5], [2.05, -1.5], [0, -2.3]].forEach(([px, pz], i) => {
        const pot = mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.24, 10), '#c2764f');
        pot.position.set(px, 0.12, pz); pot.castShadow = true;
        const leaf = mesh(new THREE.SphereGeometry(0.26 + i * 0.03, 9, 7), i === 2 ? '#7fb069' : '#8fbb72');
        leaf.position.set(px, 0.42, pz); leaf.castShadow = true;
        scene.add(pot, leaf);
      });

      const npcParts = Char3D.build({ skin: '#f8c99b', hair: '#3f2410', outfit: '#efe0c6' });
      const nc = costumeForNpc(npc);
      Char3D.applyCostume(npcParts, nc.kit, nc.prop, npc.color);
      npcParts.root.position.set(-0.85, 0, 0);
      npcParts.root.rotation.y = -0.5;
      scene.add(npcParts.root);

      const pc = avatarColors(typeof SAVE !== 'undefined' ? SAVE : null);
      const playerParts = Char3D.build(pc);
      const jc = costumeForJob(job);
      Char3D.applyCostume(playerParts, jc.kit, jc.prop, job.color);
      playerParts.root.position.set(0.85, 0, 0);
      playerParts.root.rotation.y = 0.5;
      scene.add(playerParts.root);

      const s = {
        renderer, scene, camera, w, h, container,
        npcParts, playerParts, clockStart: performance.now(), rafId: null,
        reaction: null,
        /* ── 연출 시스템이 조작하는 "논리 카메라" ──
         * Director는 이 값만 보간하고, 실제 THREE 카메라는 매 프레임
         * (논리 카메라 + 셰이크 오프셋)으로 합성된다. */
        cam: { pos: [0, 1.5, 4.1], look: [0, 1.0, 0], fov: 38 },
        shake: null,
      };
      this._s = s;
      watchResize(container, s, (nw, nh) => {
        renderer.setSize(nw, nh);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      });
      this._loop();
    },

    /* ─────────────────────────────────────────────────────
     * 연출 리깅 — js/direction.js의 Director가 잡는 핸들.
     * 무대가 없으면 null을 돌려주고, Director는 조용히 무시한다.
     * ───────────────────────────────────────────────────── */
    rig() {
      const s = this._s;
      if (!s) return null;
      return {
        cam: s.cam,
        actors: { npc: s.npcParts, pc: s.playerParts },
        shake: (power, dur) => { s.shake = { power, dur: dur || 0.4, start: performance.now() }; },
        emote: (who, kind) => this.emote(who, kind),
      };
    },

    /** 감정 모션 1회 재생. who: 'npc' | 'pc' */
    emote(who, kind) {
      const s = this._s; if (!s) return;
      const parts = who === 'npc' ? s.npcParts : s.playerParts;
      parts.emote = { kind, start: performance.now(), dur: EMOTE_DUR[kind] || 0.65 };
    },

    _fallback(container) {
      container.innerHTML = '<div class="flex items-center justify-center h-full text-sm font-bold text-slate-400">3D 그래픽을 사용할 수 없는 환경이에요 🙏</div>';
    },

    /** innerHTML 재작성으로 캔버스가 DOM에서 떨어져 나갔을 때, 씬을 새로 만들지 않고
     * 기존 renderer의 canvas만 새 컨테이너에 다시 붙인다 (idle 애니메이션 끊김 방지). */
    reattach(container) {
      const s = this._s; if (!s) return false;
      container.appendChild(s.renderer.domElement);
      return true;
    },

    /** 레거시 API — app.js의 선택 리액션. 새 감정 모션 이름으로 매핑한다. */
    react(kind) {
      this.emote('pc', kind === 'performance' ? '기쁨' : kind === 'stress' ? '당황' : '끄덕');
    },

    _loop() {
      const s = this._s; if (!s) return;
      const tick = () => {
        if (this._s !== s) return;
        const now = performance.now();
        const t = (now - s.clockStart) / 1000;

        /* ── 1) 배우: 아이들 + 걷기 + 감정 모션 ──
         * x/z/rotation.y 는 Director가 소유하므로 여기서 건드리지 않는다.
         * 이 루프는 "그 위에 얹히는" 몸짓(상하 흔들림·팔다리·기울기)만 담당. */
        [s.npcParts, s.playerParts].forEach((parts, idx) => {
          const walking = !!parts.walking;
          // 걷는 중이면 빠른 보폭 흔들림, 아니면 잔잔한 호흡
          parts.root.position.y = walking
            ? Math.abs(Math.sin(t * 9)) * 0.05
            : Math.sin(t * 1.5 + idx * 2) * 0.03;
          parts.root.rotation.z = 0;
          parts.root.rotation.x = 0;
          const swing = walking ? Math.sin(t * 9) * 0.55 : 0;
          poseArm(parts, 'L', swing, 0);
          poseArm(parts, 'R', -swing, 0);
          parts.legL.rotation.x = -swing * 0.8;
          parts.legR.rotation.x = swing * 0.8;
          if (parts.torso.material.emissive) parts.torso.material.emissiveIntensity = 0;
          if (parts.emote) applyEmote(parts, now);
        });

        /* ── 2) 카메라: 논리 카메라 + 셰이크 합성 ── */
        let ox = 0, oy = 0, oz = 0;
        if (s.shake) {
          const p = (now - s.shake.start) / (s.shake.dur * 1000);
          if (p >= 1) { s.shake = null; }
          else {
            const amp = s.shake.power * 0.16 * (1 - p);
            ox = (Math.random() - 0.5) * amp;
            oy = (Math.random() - 0.5) * amp;
            oz = (Math.random() - 0.5) * amp * 0.4;
          }
        }
        const c = s.cam;
        s.camera.position.set(c.pos[0] + ox, c.pos[1] + oy, c.pos[2] + oz);
        s.camera.lookAt(c.look[0] + ox * 0.35, c.look[1] + oy * 0.35, c.look[2]);
        if (Math.abs(s.camera.fov - c.fov) > 0.01) {
          s.camera.fov = c.fov;
          s.camera.updateProjectionMatrix();
        }

        s.renderer.render(s.scene, s.camera);
        s.rafId = requestAnimationFrame(tick);
      };
      s.rafId = requestAnimationFrame(tick);
    },

    pause() { if (this._s && this._s.rafId) { cancelAnimationFrame(this._s.rafId); this._s.rafId = null; } },
    resume() { if (this._s && !this._s.rafId) this._loop(); },
    dispose() { teardown(this._s); this._s = null; },
  };

  return { Char3D, Board, Stage, HAS_THREE, JOB_COSTUME_MAP, NPC_COSTUME_MAP, costumeForJob, costumeForNpc };
})();
