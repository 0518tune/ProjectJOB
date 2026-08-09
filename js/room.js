/* =========================================================
 * ProjectJOB — Front-View Room Builder (Phase 3)
 * ---------------------------------------------------------
 * - 정면(Front View) 2D 방. 아이템을 자유 좌표(%)에 드래그 배치
 * - [방 회전 🔄] : 90도씩 회전 (정면→오른쪽→뒷면→왼쪽)
 *   벽면마다 배치 상태가 독립적으로 저장됨 (SAVE.room.walls[0..3])
 * - 배경 테마는 히든 퀘스트 달성으로만 해금 (THEMES/QUESTS)
 * - 인벤토리 → 방: HTML5 드래그&드롭 / 클릭 자동 배치
 * - 방 안 이동: 포인터 드래그 / 더블클릭: 인벤토리로 회수
 * ========================================================= */

const RoomUI = {
  EXPAND_COST: 500,
  WALL_NAMES: ['정면 벽', '오른쪽 벽', '뒷면 벽', '왼쪽 벽'],
  WALL_DECOS: ['🪟', '🚪', '🖼️', '🕰️'], // 벽면 구분용 붙박이 장식
  _rotating: false,
  _drag: null, // 포인터 드래그 상태

  allItems() {
    const items = [];
    for (const j of getAllJobs()) {
      items.push({ ...j.furniture, kind: 'furniture', jobName: j.name });
      items.push({ ...j.decor, kind: 'decor', jobName: j.name });
    }
    return items;
  },

  ownedItems() {
    return this.allItems().filter((it) => SAVE.unlocked.includes(it.id));
  },

  activeTheme() {
    return THEMES.find((t) => t.id === SAVE.room.theme) || DEFAULT_THEME;
  },

  wallItems() {
    return SAVE.room.walls[SAVE.room.wall] || {};
  },

  /** 아이템이 어느 벽이든 이미 배치되어 있는지 */
  placedWall(id) {
    for (let w = 0; w < 4; w++) {
      if (SAVE.room.walls[w] && SAVE.room.walls[w][id]) return w;
    }
    return -1;
  },

  /* ------------------- 렌더링 ------------------- */
  render() {
    this.renderRoom();
    this.renderThemes();
    this.renderInventory();
    this.renderExpand();
    this.renderSocial();
  },

  renderRoom() {
    const theme = this.activeTheme();
    const wall = SAVE.room.wall;
    const room = document.querySelector('#room-2d');
    const big = SAVE.room.size >= 7;
    room.style.height = big ? '400px' : '330px';

    const itemsHtml = Object.entries(this.wallItems())
      .map(([id, pos]) => {
        const it = this.allItems().find((i) => i.id === id);
        if (!it) return '';
        return `<div class="room-item item-card-${it.kind}" data-item="${id}" style="left:${pos.x}%;top:${pos.y}%"
          title="${it.name} (드래그: 이동, 더블클릭: 회수)"
          onpointerdown="RoomUI.dragStart(event,'${id}')" ondblclick="RoomUI.pickUp('${id}')">${it.emoji}</div>`;
      })
      .join('');

    room.innerHTML = `
      <div class="room-wall" style="background:${theme.bg}">
        <span class="absolute top-3 left-1/2 -translate-x-1/2 text-4xl opacity-70 pointer-events-none">${this.WALL_DECOS[wall]}</span>
        <span class="absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-slate-600 shadow pointer-events-none z-10">
          ${theme.emoji} ${theme.name} · ${this.WALL_NAMES[wall]} ${big ? '· 대형룸' : ''}
        </span>
      </div>
      <div class="room-floor" style="background:linear-gradient(180deg, ${theme.floor} 0%, rgba(0,0,0,.28) 100%)"></div>
      <div class="room-baseboard"></div>
      ${itemsHtml}`;

    // 드롭(인벤토리 → 방) 바인딩
    room.ondragover = (e) => e.preventDefault();
    room.ondrop = (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (!id || !SAVE.unlocked.includes(id)) return;
      const r = room.getBoundingClientRect();
      const x = Math.min(94, Math.max(4, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.min(90, Math.max(12, ((e.clientY - r.top) / r.height) * 100));
      this.place(id, x, y);
    };

    document.querySelector('#wall-indicator').innerHTML = [0, 1, 2, 3]
      .map((w) => `<span class="w-2 h-2 rounded-full inline-block ${w === wall ? 'bg-indigo-500' : 'bg-slate-300'}"></span>`)
      .join('');
  },

  renderThemes() {
    document.querySelector('#theme-list').innerHTML = THEMES.map((t) => {
      const owned = t.always || SAVE.unlocked.includes(t.id);
      const active = SAVE.room.theme === t.id;
      const quest = QUESTS.find((q) => q.reward === t.id);
      return `
        <button ${owned ? `onclick="RoomUI.setTheme('${t.id}')"` : 'disabled'}
          class="relative rounded-xl h-14 border-2 transition overflow-hidden ${
            active ? 'border-indigo-500 ring-2 ring-indigo-200' : owned ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-100 opacity-60 cursor-not-allowed'
          }" style="background:${t.bg}" ${!owned && quest ? `title="히든 퀘스트: ${quest.desc}"` : ''}>
          <span class="absolute inset-0 flex flex-col items-center justify-center text-[11px] font-bold text-white bg-black/30 leading-tight">
            <span class="flex items-center gap-1">${owned ? Icons.forTheme(t.id, { size: 13 }) : Icons.svg('lock', { size: 12 })} ${t.name}</span>
            ${!owned && quest ? `<span class="text-[9px] font-medium opacity-90">퀘스트: ${quest.name}</span>` : ''}
          </span>
        </button>`;
    }).join('');
  },

  renderInventory() {
    const owned = this.ownedItems().filter((it) => this.placedWall(it.id) < 0);
    const placedElsewhere = this.ownedItems().filter((it) => {
      const w = this.placedWall(it.id);
      return w >= 0 && w !== SAVE.room.wall;
    });
    const locked = this.allItems().filter((it) => !SAVE.unlocked.includes(it.id)).slice(0, 12);

    const html =
      owned
        .map(
          (it) => `
        <button draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${it.id}')"
          onclick="RoomUI.autoPlace('${it.id}')"
          class="item-card-glow item-card-${it.kind} flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 border-slate-200 bg-white transition cursor-grab active:cursor-grabbing"
          title="방으로 드래그해 배치 (클릭: 자동 배치)">
          <span class="text-2xl">${it.emoji}</span>
          <span class="text-[10px] font-bold text-slate-600 text-center leading-tight">${it.name}</span>
          <span class="text-[9px] px-1.5 rounded-full ${it.kind === 'furniture' ? 'bg-sky-100 text-sky-600' : 'bg-pink-100 text-pink-600'}">${it.kind === 'furniture' ? '가구' : '장식'}</span>
        </button>`
        )
        .join('') +
      placedElsewhere
        .map(
          (it) => `
        <div class="flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 border-indigo-100 bg-indigo-50/60">
          <span class="text-2xl opacity-60">${it.emoji}</span>
          <span class="text-[10px] font-bold text-slate-400 text-center leading-tight">${it.name}</span>
          <span class="text-[9px] text-indigo-400 font-bold">${this.WALL_NAMES[this.placedWall(it.id)]} 배치 중</span>
        </div>`
        )
        .join('') +
      locked
        .map(
          (it) => `
        <div class="relative flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 border-slate-100 bg-slate-50">
          <span class="text-2xl grayscale opacity-30">${it.emoji}</span>
          <span class="absolute top-2 text-slate-400">${Icons.svg('lock', { size: 15 })}</span>
          <span class="text-[10px] font-bold text-slate-400 text-center leading-tight opacity-60">${it.name}</span>
          <span class="text-[9px] text-slate-300">${it.kind === 'furniture' ? '리얼 완주' : '라이트 완주'}</span>
        </div>`
        )
        .join('');

    document.querySelector('#furniture-list').innerHTML =
      html || '<p class="col-span-full text-xs text-slate-400 text-center py-4">직업을 완주하면 아이템을 얻을 수 있어요!</p>';
  },

  renderExpand() {
    const btn = document.querySelector('#expand-btn');
    if (SAVE.room.size >= 7) {
      btn.textContent = '🏰 대형룸';
      btn.disabled = true;
      btn.className = 'text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed';
    } else {
      btn.textContent = '🔨 방 확장';
      btn.disabled = false;
      btn.className = 'text-xs font-bold px-3 py-2 rounded-xl bg-amber-400 text-white hover:bg-amber-500 transition';
    }
  },

  /* ------------------- 방 회전 ------------------- */
  rotate() {
    if (this._rotating) return;
    this._rotating = true;
    const room = document.querySelector('#room-2d');
    room.classList.add('room-rot-out');
    setTimeout(() => {
      SAVE.room.wall = (SAVE.room.wall + 1) % 4;
      Storage.save(SAVE);
      this.renderRoom();
      this.renderInventory();
      room.classList.remove('room-rot-out');
      room.classList.add('room-rot-in');
      setTimeout(() => {
        room.classList.remove('room-rot-in');
        this._rotating = false;
      }, 260);
    }, 240);
    UI.toast(`🔄 ${this.WALL_NAMES[(SAVE.room.wall + 1) % 4]}으로 회전!`);
  },

  /* ------------------- 배치/이동/회수 ------------------- */
  place(id, x, y) {
    // 다른 벽에 있었다면 제거 후 현재 벽에 배치
    const prev = this.placedWall(id);
    if (prev >= 0) delete SAVE.room.walls[prev][id];
    SAVE.room.walls[SAVE.room.wall][id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    Storage.save(SAVE);
    this.renderRoom();
    this.renderInventory();
  },

  autoPlace(id) {
    const n = Object.keys(this.wallItems()).length;
    const x = 15 + (n % 5) * 17;
    const y = 62 + Math.floor(n / 5) * 14;
    this.place(id, x, Math.min(86, y));
  },

  pickUp(id) {
    const w = this.placedWall(id);
    if (w >= 0) delete SAVE.room.walls[w][id];
    Storage.save(SAVE);
    this.renderRoom();
    this.renderInventory();
  },

  /* 포인터 기반 자유 드래그 (방 안 이동) */
  dragStart(e, id) {
    e.preventDefault();
    const room = document.querySelector('#room-2d');
    const el = room.querySelector(`[data-item="${id}"]`);
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    this._drag = { id, el, room };

    el.onpointermove = (ev) => {
      if (!this._drag) return;
      const r = room.getBoundingClientRect();
      const x = Math.min(94, Math.max(4, ((ev.clientX - r.left) / r.width) * 100));
      const y = Math.min(90, Math.max(12, ((ev.clientY - r.top) / r.height) * 100));
      el.style.left = x + '%';
      el.style.top = y + '%';
    };
    el.onpointerup = (ev) => {
      if (!this._drag) return;
      el.classList.remove('dragging');
      const r = room.getBoundingClientRect();
      const x = Math.min(94, Math.max(4, ((ev.clientX - r.left) / r.width) * 100));
      const y = Math.min(90, Math.max(12, ((ev.clientY - r.top) / r.height) * 100));
      this._drag = null;
      el.onpointermove = el.onpointerup = null;
      SAVE.room.walls[SAVE.room.wall][id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      Storage.save(SAVE);
    };
  },

  setTheme(id) {
    SAVE.room.theme = id;
    Storage.save(SAVE);
    this.render();
  },

  /* ------------------- 방 확장 (수익화 목업) ------------------- */
  showExpandModal() {
    const gold = SAVE.gold;
    const affordable = gold >= this.EXPAND_COST;
    document.querySelector('#modal-content').innerHTML = `
      <div class="text-center">
        <div class="text-5xl mb-3">🔨</div>
        <h3 class="text-xl font-extrabold text-slate-800 mb-1">방 확장하기</h3>
        <p class="text-sm text-slate-500 mb-5">천장을 높인 <b>대형 룸</b>으로 업그레이드!<br/>더 넓은 공간에 가구를 배치할 수 있어요.</p>
        <div class="flex flex-col gap-2.5 mb-4">
          <button onclick="RoomUI.showPremiumMock()"
            class="w-full p-4 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-left hover:brightness-110 transition">
            <p class="font-extrabold text-sm">💎 프리미엄 이용권으로 확장</p>
            <p class="text-xs opacity-90 mt-0.5">₩4,900 · 즉시 확장 (결제 목업)</p>
          </button>
          <button ${affordable ? `onclick="RoomUI.expandWithGold()"` : 'disabled'}
            class="w-full p-4 rounded-2xl text-left transition ${affordable ? 'bg-amber-100 border-2 border-amber-300 hover:bg-amber-200' : 'bg-slate-100 border-2 border-slate-200 opacity-60 cursor-not-allowed'}">
            <p class="font-extrabold text-sm text-slate-700">💰 골드로 확장 — ${this.EXPAND_COST}G</p>
            <p class="text-xs text-slate-500 mt-0.5">보유: ${gold}G ${affordable ? '' : '(골드가 부족해요 — 라이트 모드로 모아보세요!)'}</p>
          </button>
        </div>
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">다음에 할게요</button>
      </div>`;
    UI.openModal();
  },

  showPremiumMock() {
    document.querySelector('#modal-content').innerHTML = `
      <div class="text-center">
        <div class="text-5xl mb-3">💳</div>
        <h3 class="text-xl font-extrabold text-slate-800 mb-1">프리미엄 결제 (목업)</h3>
        <div class="bg-slate-50 rounded-2xl p-4 my-4 text-left text-sm">
          <div class="flex justify-between py-1"><span class="text-slate-500">상품</span><b>방 확장 이용권</b></div>
          <div class="flex justify-between py-1"><span class="text-slate-500">금액</span><b>₩4,900</b></div>
          <div class="flex justify-between py-1"><span class="text-slate-500">결제 수단</span><b>목업 페이 🧪</b></div>
        </div>
        <p class="text-[11px] text-slate-400 mb-4">* 프로토타입 결제 시뮬레이션입니다. 실제 결제가 발생하지 않습니다.</p>
        <button onclick="RoomUI.completeExpand('💎 프리미엄 결제 완료! (목업)')"
          class="w-full py-3 rounded-xl font-bold bg-violet-600 text-white hover:bg-violet-700 transition mb-2">결제하기</button>
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">취소</button>
      </div>`;
  },

  expandWithGold() {
    if (SAVE.gold < this.EXPAND_COST) return;
    SAVE.gold -= this.EXPAND_COST;
    this.completeExpand(`💰 ${this.EXPAND_COST}G를 사용해 방을 확장했어요!`);
  },

  completeExpand(msg) {
    SAVE.room.size = 7;
    Storage.save(SAVE);
    UI.closeModal();
    UI.renderHeader();
    this.render();
    UI.toast(msg);
  },

  /* ------------------- 소셜: 친구 코드 · 한 줄 공지 · 방명록 ------------------- */
  /** 내 고유 친구 코드 (최초 1회 생성 후 세이브에 고정) */
  myCode() {
    if (!SAVE.social.myCode) {
      const L = 'ABCDEFGHJKMNPQRSTUVWXYZ';
      const four = () => Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join('');
      SAVE.social.myCode = `JOB-${four()}-${Math.floor(Math.random() * 9000) + 1000}`;
      Storage.save(SAVE);
    }
    return SAVE.social.myCode;
  },

  renderSocial() {
    const toggle = document.querySelector('#room-private-toggle');
    if (toggle) toggle.checked = !!(SAVE.social && SAVE.social.private);
    this.renderNotice();

    /* 친구 코드 박스: 내 코드 + 코드 입력창 (+ 체험용 코드 힌트) */
    const box = document.querySelector('#friend-code-box');
    if (box) {
      const hints = FRIENDS.filter((f) => !SAVE.social.friends.includes(f.id))
        .map((f) => `<button onclick="RoomUI.fillCode('${f.code}')" title="클릭하면 입력창에 채워져요"
          class="font-mono text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition">${f.name} · ${f.code}</button>`)
        .join(' ');
      box.innerHTML = `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2.5">
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="font-bold text-slate-500 shrink-0">🪪 내 친구 코드</span>
            <code class="font-mono font-black text-indigo-600 bg-white border border-indigo-100 rounded-lg px-2.5 py-1">${this.myCode()}</code>
            <button onclick="RoomUI.copyMyCode()" class="text-[11px] font-bold text-indigo-500 hover:text-indigo-700">📋 복사</button>
          </div>
          <div class="flex gap-2">
            <input id="friend-code-input" maxlength="14" placeholder="친구 코드 붙여넣기 (예: JOB-QOKA-1010)"
              onkeydown="if(event.key==='Enter')RoomUI.addByCode()"
              class="flex-1 text-sm font-mono font-bold border-2 border-slate-200 rounded-xl px-3 py-2 bg-white focus:border-indigo-300 outline-none"/>
            <button onclick="RoomUI.addByCode()" class="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shrink-0">➕ 친구 등록</button>
          </div>
          ${hints ? `<p class="text-[10px] text-slate-400 leading-relaxed">🧪 체험용 친구 코드 (실서비스에서는 상대가 직접 알려줘야 해요): ${hints}</p>` : ''}
        </div>`;
    }

    /* 등록된 친구만 목록에 노출 */
    const list = document.querySelector('#friend-list');
    if (list) {
      const added = FRIENDS.filter((f) => SAVE.social.friends.includes(f.id));
      list.innerHTML = added.map((f) => `
        <div class="flex items-center gap-3 p-3 rounded-2xl border-2 border-indigo-100 bg-indigo-50/40 transition">
          <span class="shrink-0">${AvatarSVG.render(f.avatar, 32)}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-extrabold text-slate-700 truncate">${f.name} ${f.private ? '<span class="text-[10px]" title="비공개 방">🔒</span>' : ''}</p>
            <p class="text-[10px] text-slate-400 truncate">${f.motto}</p>
          </div>
          <button onclick="RoomUI.visitFriend('${f.id}')" class="text-[11px] font-bold px-3 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition shrink-0">🏠 놀러가기</button>
        </div>`).join('')
        || '<p class="col-span-full text-xs text-slate-400 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-5">아직 친구가 없어요. 위 입력창에 친구 코드를 붙여넣어 등록해 보세요!</p>';
    }
    this.renderGuestbook();
  },

  copyMyCode() {
    if (navigator.clipboard) navigator.clipboard.writeText(this.myCode());
    UI.toast('📋 내 친구 코드가 복사되었어요! 친구에게 공유해 보세요.');
  },

  fillCode(code) {
    const input = document.querySelector('#friend-code-input');
    if (input) { input.value = code; input.focus(); }
  },

  /** 코드 입력을 통해서만 친구 등록 가능 */
  addByCode() {
    const input = document.querySelector('#friend-code-input');
    const code = (input.value || '').trim().toUpperCase();
    if (!code) { UI.toast('친구 코드를 입력해 주세요!'); return; }
    if (code === this.myCode()) { UI.toast('🙃 자기 자신은 친구로 등록할 수 없어요!'); return; }
    const f = FRIENDS.find((x) => x.code === code);
    if (!f) { UI.toast('❌ 존재하지 않는 코드예요. 다시 확인해 주세요!'); return; }
    if (SAVE.social.friends.includes(f.id)) { UI.toast(`이미 ${f.name}님과 친구예요!`); return; }
    SAVE.social.friends.push(f.id);
    // 새 친구가 내 방명록에 첫 인사 댓글 (내 방이 비공개면 작성 차단)
    const open = !SAVE.social.private;
    if (open) SAVE.social.guestbook.push({ name: f.name, text: f.hello, date: Date.now() });
    Storage.save(SAVE);
    input.value = '';
    this.renderSocial();
    UI.toast(`💌 ${f.name}님과 친구가 되었어요!${open ? ' 방명록에 인사를 남겼네요.' : ' (비공개라 방명록 인사는 차단됐어요)'}`);
  },

  /* --- 한 줄 공지사항 (방 주인 작성) --- */
  renderNotice() {
    const el = document.querySelector('#room-notice');
    if (!el) return;
    const notice = (SAVE.social.notice || '').replace(/"/g, '&quot;');
    el.innerHTML = `
      <div class="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-2.5">
        <span class="text-lg shrink-0">📌</span>
        <input id="notice-input" maxlength="40" value="${notice}" placeholder="한 줄 공지사항 작성 (방문한 친구에게 보여요)"
          onkeydown="if(event.key==='Enter')RoomUI.saveNotice()"
          class="flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:font-normal placeholder:text-slate-400 min-w-0"/>
        <button onclick="RoomUI.saveNotice()" class="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-amber-400 text-white hover:bg-amber-500 transition shrink-0">저장</button>
      </div>`;
  },

  saveNotice() {
    SAVE.social.notice = (document.querySelector('#notice-input').value || '').trim();
    Storage.save(SAVE);
    UI.toast('📌 한 줄 공지사항이 저장되었어요!');
  },

  /* --- 내 방명록 (친구들의 댓글 · 비공개 시 열람/작성 차단) --- */
  renderGuestbook() {
    const el = document.querySelector('#guestbook');
    if (!el) return;
    if (SAVE.social.private) {
      el.innerHTML = '<div class="text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-6">🔒 비공개 상태 — 친구들이 방명록을 열람하거나 댓글을 남길 수 없어요.</div>';
      return;
    }
    const gb = SAVE.social.guestbook || [];
    el.innerHTML = gb.slice(-8).reverse().map((c) => `
      <div class="flex items-start gap-2.5 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
        <span class="text-base">💬</span>
        <div class="min-w-0">
          <p class="text-xs font-extrabold text-slate-700">${c.name}</p>
          <p class="text-xs text-slate-500 leading-relaxed">${c.text}</p>
        </div>
      </div>`).join('')
      || '<p class="text-xs text-slate-400 text-center py-4">아직 댓글이 없어요. 친구를 등록하면 놀러 와서 한마디씩 남겨요!</p>';
  },

  /** 비공개 팝업 (친구 방 방문 시 & 내 방 방문자 시점 시뮬레이션 공용) */
  showPrivatePopup(ownerName) {
    document.querySelector('#modal-content').innerHTML = `
      <div class="text-center">
        <div class="text-6xl mb-3">🔒</div>
        <h3 class="text-xl font-extrabold text-slate-800 mb-2">비공개된 방입니다</h3>
        <p class="text-sm text-slate-500 mb-5">${ownerName}님이 마이룸을 비공개로 설정했어요.<br/>공개로 전환되면 다시 놀러 올 수 있어요!</p>
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">돌아가기</button>
      </div>`;
    UI.openModal();
  },

  visitFriend(id) {
    const f = FRIENDS.find((x) => x.id === id);
    if (!f) return;
    if (f.private) { this.showPrivatePopup(f.name); return; }

    const theme = THEMES.find((t) => t.id === f.theme) || DEFAULT_THEME;
    const items = f.items
      .map((it) => `<span class="absolute text-3xl pointer-events-none" style="left:${it.x}%;top:${it.y}%;transform:translate(-50%,-50%);filter:drop-shadow(2px 4px 3px rgba(0,0,0,.3))">${it.emoji}</span>`)
      .join('');
    const badges = f.badges.map((b) => `<span class="text-lg">${b}</span>`).join(' ');

    document.querySelector('#modal-content').innerHTML = `
      <div>
        <p class="text-xs font-bold tracking-widest uppercase text-emerald-500 mb-1 text-center">Friend's Room</p>
        <h3 class="text-lg font-extrabold text-slate-800 mb-3 text-center">🏠 ${f.name}님의 마이룸</h3>
        <div class="relative h-48 rounded-2xl overflow-hidden mb-3 shadow-inner">
          <div class="absolute inset-0" style="background:${theme.bg}"></div>
          <div class="absolute left-0 right-0 bottom-0 h-1/4" style="background:linear-gradient(180deg, ${theme.floor} 0%, rgba(0,0,0,.28) 100%)"></div>
          ${items}
          <div class="absolute bottom-2 left-3">${AvatarSVG.render(f.avatar, 44)}</div>
          <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full bg-white/85 text-slate-600">${theme.emoji} ${theme.name}</span>
        </div>
        ${f.notice ? `<div class="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2"><span>📌</span><p class="text-xs font-bold text-amber-700">${f.notice}</p></div>` : ''}
        <div class="bg-slate-50 rounded-2xl p-3.5 mb-3">
          <p class="text-xs font-bold text-slate-500 mb-1">💬 "${f.motto}"</p>
          <p class="text-[11px] text-slate-400">획득 배지 ${badges || '없음'}</p>
        </div>
        <p class="text-[11px] font-black text-slate-500 mb-1.5">📮 ${f.name}님의 방명록</p>
        <div class="flex flex-col gap-1.5 mb-2 max-h-28 overflow-y-auto">
          ${(SAVE.social.sent[f.id] || []).map((t) => `
            <div class="bg-white border border-slate-100 rounded-xl px-3 py-2">
              <p class="text-[11px]"><b class="text-indigo-600">${SAVE.nickname}</b> <span class="text-slate-500">${t}</span></p>
            </div>`).join('') || '<p class="text-[11px] text-slate-300 text-center py-1.5">아직 남긴 댓글이 없어요.</p>'}
        </div>
        <div class="flex gap-2 mb-4">
          <input id="visit-comment" maxlength="40" placeholder="한마디 남기기…"
            onkeydown="if(event.key==='Enter')RoomUI.leaveComment('${f.id}')"
            class="flex-1 text-xs font-bold border-2 border-slate-200 rounded-xl px-3 py-2 focus:border-emerald-300 outline-none min-w-0"/>
          <button onclick="RoomUI.leaveComment('${f.id}')" class="text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition shrink-0">✍️ 남기기</button>
        </div>
        <button onclick="UI.closeModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">우리 집으로 돌아가기</button>
      </div>`;
    UI.openModal();
  },

  /** 친구 방명록에 댓글 작성 (상대가 비공개면 visitFriend 진입 자체가 차단됨) */
  leaveComment(fid) {
    const input = document.querySelector('#visit-comment');
    const text = (input.value || '').trim();
    if (!text) { UI.toast('댓글 내용을 입력해 주세요!'); return; }
    (SAVE.social.sent[fid] = SAVE.social.sent[fid] || []).push(text);
    Storage.save(SAVE);
    this.visitFriend(fid); // 모달 갱신
    UI.toast('✍️ 친구 방명록에 댓글을 남겼어요!');
  },

  togglePrivate(checked) {
    SAVE.social.private = !!checked;
    Storage.save(SAVE);
    this.renderGuestbook(); // 비공개 시 방명록 열람 차단 즉시 반영
    UI.toast(checked ? '🔒 내 방이 비공개로 전환되었어요. 친구의 댓글 작성/열람이 차단됩니다.' : '🌍 내 방이 공개로 전환되었어요!');
  },

  /** 방문자(친구) 시점에서 내 방이 어떻게 보이는지 시뮬레이션 */
  previewVisit() {
    if (SAVE.social.private) { this.showPrivatePopup(SAVE.nickname); return; }
    UI.showShareMock();
  },
};
