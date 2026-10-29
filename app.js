/* River Hold'em - application: table UI, game flow, computer players, coach, online play */
(function () {
  'use strict';

  const R = window.River;
  const B = window.RiverBrain;
  const { cardSVG, backSVG, chipSVG, icon, BACKS } = window.RiverArt;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v) => Number(v || 0).toLocaleString('en-US');
  const SUIT_TXT = { s: '♠︎', h: '♥︎', d: '♦︎', c: '♣︎' };
  const cardTxt = (c) => { const k = R.cardCode(c); return (k[0] === 'T' ? '10' : k[0]) + SUIT_TXT[k[1]]; };

  /* ---------------- Storage ---------------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('river.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('river.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem('river.' + k); } catch (e) { /* ignore */ } }
  };
  const DEFAULTS = { ui: 'dark', felt: 'midnight', back: 'violet', four: false, sound: true, fast: false, autoNext: true, confirmFold: true, name: '' };
  const settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);

  const LEVELS = [
    { id: 'easy', label: 'Easy', sub: 'Calls too much, rarely bluffs' },
    { id: 'normal', label: 'Normal', sub: 'Solid, sensible players' },
    { id: 'hard', label: 'Hard', sub: 'Aggressive and positional' },
    { id: 'expert', label: 'Expert', sub: 'Semi-bluffs and reads odds' }
  ];
  const STACKS = [{ id: '1000', label: '1,000' }, { id: '2500', label: '2,500' }, { id: '5000', label: '5,000' }];
  const BLINDS = [{ id: '10', label: 'Rise every 10 hands' }, { id: '20', label: 'Every 20 hands' }, { id: '0', label: 'Fixed' }];
  const SHOT = [{ id: '0', label: 'Off' }, { id: '20', label: '20 s' }, { id: '30', label: '30 s' }, { id: '60', label: '60 s' }];
  const BOT_NAMES = ['Mara', 'Theo', 'Jun', 'Priya', 'Otto', 'Lena', 'Kofi', 'Ines'];
  const PERSONAS = [{ aggr: 0.15, loose: 0.05 }, { aggr: -0.1, loose: 0.12 }, { aggr: 0.05, loose: -0.05 }, { aggr: 0.2, loose: 0.1 }, { aggr: -0.05, loose: 0 }, { aggr: 0.1, loose: -0.08 }];
  const FELTS = [{ id: 'midnight', c: '#2b2357' }, { id: 'emerald', c: '#1e6b47' }, { id: 'navy', c: '#1d4068' }, { id: 'crimson', c: '#6a2232' }, { id: 'graphite', c: '#3c424d' }];

  function applyTheme() {
    document.documentElement.dataset.theme = settings.ui;
    document.documentElement.dataset.felt = settings.felt;
    const btn = $('#navTheme');
    if (btn) btn.innerHTML = icon(settings.ui === 'dark' ? 'sun' : 'moon');
    const meta = $('meta[name=theme-color]');
    if (meta) meta.content = settings.ui === 'dark' ? '#0e1014' : '#f4f5f7';
  }
  function fillIcons(root) {
    $$('[data-icon]', root).forEach((el) => {
      if (el.dataset.iconDone) return;
      el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
      el.dataset.iconDone = '1';
    });
  }

  /* ---------------- Sound ---------------- */
  const Sound = {
    ctx: null,
    tone(freq, start, dur, type, gain) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, c.currentTime + start);
      g.gain.exponentialRampToValueAtTime(gain || 0.14, c.currentTime + start + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.02);
    },
    play(kind) {
      if (!settings.sound) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (kind === 'chip') { this.tone(2200, 0, 0.04, 'triangle', 0.08); this.tone(1700, 0.035, 0.05, 'triangle', 0.07); }
        else if (kind === 'check') { this.tone(180, 0, 0.05, 'sine', 0.2); this.tone(180, 0.09, 0.05, 'sine', 0.18); }
        else if (kind === 'fold') { this.tone(500, 0, 0.08, 'sine', 0.05); this.tone(300, 0.03, 0.1, 'sine', 0.04); }
        else if (kind === 'deal') { this.tone(1200, 0, 0.03, 'square', 0.03); }
        else if (kind === 'allin') { [330, 440, 554].forEach((f, i) => this.tone(f, i * 0.06, 0.16, 'triangle', 0.1)); }
        else if (kind === 'win') { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.09, 0.3, 'sine', 0.1)); }
        else if (kind === 'turn') { this.tone(660, 0, 0.08, 'sine', 0.1); this.tone(880, 0.07, 0.1, 'sine', 0.08); }
      } catch (e) { /* no audio */ }
    }
  };

  function toast(msg, ms) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }

  /* ---------------- Game state ---------------- */
  // G.table is the authoritative table (host side) or the latest view received (online guest).
  let G = null;
  let seenCards = new Set();
  let pumpTimer = null, nextTimer = null, shotTimer = null;

  const isHost = () => G && (G.mode !== 'online' || Net.role === 'host');
  const localHumans = () => G.table.seats.map((s, i) => (s.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  function viewerSeat() {
    if (!G) return -1;
    if (G.mode === 'ai' || G.mode === 'online') return G.mySeat;
    return G.revealed; // pass and play: only the player who lifted the curtain
  }
  function view() {
    if (!G) return null;
    if (G.mode === 'online' && Net.role === 'guest') return G.table;
    return R.viewFor(G.table, viewerSeat());
  }

  function emptyStats(n) { return Array.from({ length: n }, () => ({ hands: 0, won: 0, vpip: 0, pfr: 0, sdWon: 0, biggest: 0 })); }

  function startGame(cfg, resume) {
    clearTimers();
    seenCards = new Set();
    if (resume) {
      G = resume;
      G.token = (G.token || 0) + 1;
    } else {
      const table = R.createTable({ players: cfg.players, stack: cfg.stack, sb: cfg.sb, bb: cfg.bb, every: cfg.every, mult: 2 });
      G = {
        cfg, mode: cfg.mode, table, mySeat: cfg.mySeat || 0, revealed: -1,
        stats: emptyStats(cfg.players.length), startStacks: cfg.players.map(() => cfg.stack),
        history: [], hint: null, hintsUsed: {}, paused: false, token: 1, deadline: 0, away: {}
      };
    }
    $('#chatTab').classList.toggle('hidden', G.mode !== 'online');
    if (G.mode !== 'online') switchTab('history');
    showView('game');
    renderAll();
    if (isHost()) {
      if (!resume || G.table.street === 'idle' || G.table.street === 'done') scheduleNext(resume ? 600 : 400);
      else pump();
    }
  }

  function clearTimers() {
    clearTimeout(pumpTimer); clearTimeout(nextTimer); clearInterval(shotTimer);
    pumpTimer = nextTimer = shotTimer = null;
  }

  function scheduleNext(ms) {
    clearTimeout(nextTimer);
    if (!G || G.table.over) return;
    if (G.paused) { renderAll(); return; }
    if (!settings.autoNext && G.table.handNo > 0 && ms > 600) { renderAll(); return; }
    nextTimer = setTimeout(dealNext, ms);
  }

  function dealNext() {
    if (!G || !isHost() || G.table.over) return;
    if (G.table.street !== 'idle' && G.table.street !== 'done') return;
    clearTimeout(nextTimer);
    // Online: seats whose players left are folded out of play by the clock; remote seats stay
    R.startHand(G.table);
    G.hint = null; G.revealed = -1;
    seenCards = new Set();
    G.handLogStart = 0;
    Sound.play('deal');
    afterChange();
  }

  // Called after every change to the table on the host
  function afterChange() {
    const t = G.table;
    G.deadline = 0;
    if (t.street === 'done') onHandDone();
    renderAll();
    broadcast();
    saveResume();
    pump();
  }

  function pump() {
    clearTimeout(pumpTimer);
    clearInterval(shotTimer);
    if (!G || !isHost()) return;
    const t = G.table;
    if (t.street === 'done' || t.street === 'idle') {
      if (t.over) { setTimeout(showGameOver, 1600); return; }
      scheduleNext(settings.fast ? 1400 : 2800);
      return;
    }
    if (G.paused) return;
    const i = t.toAct;
    const s = t.seats[i];
    if (!s) return;
    const token = G.token, hand = t.handNo;
    if (s.kind === 'bot') {
      const wait = B.thinkTime(G.cfg.level) * (settings.fast ? 0.45 : 1);
      pumpTimer = setTimeout(() => {
        if (!G || G.token !== token || G.table.handNo !== hand || G.table.toAct !== i || G.paused) return;
        const a = B.decide(G.table, i, G.cfg.level, PERSONAS[i % PERSONAS.length]) || { type: 'fold' };
        doAct(i, a);
      }, wait);
      return;
    }
    // Human seat (local or remote): start the shot clock if one is set
    const secs = G.away[i] ? 8 : (G.cfg.shot || 0);
    if (secs > 0) {
      G.deadline = Date.now() + secs * 1000;
      shotTimer = setInterval(() => {
        if (!G || G.token !== token) { clearInterval(shotTimer); return; }
        updateTimers();
        if (Date.now() >= G.deadline && G.table.toAct === i && G.table.handNo === hand) {
          clearInterval(shotTimer);
          const L = R.legal(G.table, i);
          if (!L) return;
          toast(`${seatName(i)} ran out of time and ${L.check ? 'checks' : 'folds'}`);
          doAct(i, { type: L.check ? 'check' : 'fold' });
        }
      }, 200);
    }
    if (s.kind === 'human' && G.mode === 'local' && localHumans().length > 1 && G.revealed !== i) {
      renderAll();
      return;
    }
    if (s.kind === 'human') Sound.play('turn');
  }

  function doAct(i, a) {
    const t = G.table;
    const before = t.log.length;
    const res = R.act(t, i, a);
    if (!res.ok) { toast(res.error); return false; }
    const ev = t.log[before];
    if (ev && ev.e === 'act') {
      if (ev.allIn) Sound.play('allin');
      else if (ev.a === 'fold') Sound.play('fold');
      else if (ev.a === 'check') Sound.play('check');
      else Sound.play('chip');
      // Stats: voluntary money before the flop
      if (t.street === 'preflop' || (t.log.slice(0, before).every((e) => e.e !== 'street'))) {
        const st = G.stats[i];
        if ((ev.a === 'call' || ev.a === 'raise' || ev.a === 'bet') && !st._vp) { st.vpip++; st._vp = true; }
        if ((ev.a === 'raise' || ev.a === 'bet') && !st._pr) { st.pfr++; st._pr = true; }
      }
    }
    if (t.log.slice(before).some((e) => e.e === 'street')) Sound.play('deal');
    G.hint = null;
    if (G.mode === 'local') G.revealed = -1;
    afterChange();
    return true;
  }

  function onHandDone() {
    const t = G.table;
    t.seats.forEach((s, i) => {
      const st = G.stats[i];
      if (t.log.some((e) => e.e === 'deal') && s.hole.length) st.hands++;
      delete st._vp; delete st._pr;
    });
    const winners = new Set();
    for (const e of t.log) if (e.e === 'win') e.seats.forEach((w) => winners.add(w));
    winners.forEach((w) => {
      const st = G.stats[w];
      st.won++;
      st.biggest = Math.max(st.biggest, t.seats[w].won);
      if (!t.results.uncontested) st.sdWon++;
    });
    G.history.push(handText(t));
    if (G.history.length > 40) G.history.shift();
    if (t.results && t.seats.some((s, i) => winners.has(i))) {
      const mine = viewerSeat() >= 0 && winners.has(viewerSeat());
      Sound.play(mine || G.mode === 'local' ? 'win' : 'chip');
    }
  }

  function seatName(i, t) {
    t = t || G.table;
    const s = t.seats[i];
    if (!s) return '';
    if ((G.mode === 'ai' || G.mode === 'online') && i === G.mySeat) return 'You';
    return s.name;
  }

  // Readable hand history built from the table log
  function handText(t) {
    const lines = [`Hand ${t.handNo}. Blinds ${fmt(t.sb)} and ${fmt(t.bb)}. ${seatName(t.button, t)} has the button.`];
    for (const e of t.log) lines.push(eventText(e, t));
    return lines.filter(Boolean);
  }
  function eventText(e, t) {
    const nm = (i) => seatName(i, t);
    // "You raise" but "Mara raises"
    const say = (i, base, third) => `${nm(i)} ${nm(i) === 'You' ? base : (third || base + 's')}`;
    switch (e.e) {
      case 'blind': return `${say(e.seat, 'post')} the ${e.kind} blind of ${fmt(e.amount)}`;
      case 'act':
        if (e.a === 'fold') return say(e.seat, 'fold');
        if (e.a === 'check') return say(e.seat, 'check', 'checks');
        if (e.a === 'call') return `${say(e.seat, 'call')} ${e.allIn ? 'all in for ' : ''}${fmt(e.amount)}`;
        if (e.allIn) return `${say(e.seat, 'go', 'goes')} all in for ${fmt(e.to)}`;
        return e.a === 'bet' ? `${say(e.seat, 'bet')} ${fmt(e.to)}` : `${say(e.seat, 'raise')} to ${fmt(e.to)}`;
      case 'street': return `${e.street[0].toUpperCase() + e.street.slice(1)}: ${e.cards.map(cardTxt).join(' ')}`;
      case 'return': return `${fmt(e.amount)} uncalled is returned to ${nm(e.seat) === 'You' ? 'you' : nm(e.seat)}`;
      case 'show': return `${say(e.seat, 'show')} ${e.cards.map(cardTxt).join(' ')}, ${e.desc.toLowerCase()}`;
      case 'muck': return say(e.seat, 'muck');
      case 'win': {
        const names = e.seats.map(nm).join(' and ');
        const verb = e.seats.length > 1 ? 'split' : (names === 'You' ? 'win' : 'wins');
        return `${names} ${verb} ${e.uncontested ? '' : 'the ' + e.pot + ' '}(${fmt(e.amount)})${e.desc ? ' with ' + e.desc.toLowerCase() : ''}`;
      }
      case 'bust': return `${nm(e.seat)} ${nm(e.seat) === 'You' ? 'are' : 'is'} out of chips`;
      default: return '';
    }
  }

  function saveResume() {
    if (!G || G.mode === 'online') return;
    if (G.table.over) { store.del('resume'); return; }
    store.set('resume', { G, at: Date.now() });
  }

  /* ---------------- Rendering ---------------- */
  function cardEl(c, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'pcard';
    if (c === undefined) { el.classList.add('slot'); return el; }
    const key = (opts.key || '') + ':' + c;
    if (!seenCards.has(key)) { seenCards.add(key); el.classList.add('new'); }
    el.innerHTML = c < 0 ? backSVG(settings.back) : cardSVG(R.cardCode(c), settings.four);
    if (opts.win) el.classList.add('win');
    if (opts.dim) el.classList.add('dim');
    return el;
  }

  function seatGeometry(nSeats, k) {
    const mobile = window.matchMedia('(max-width: 640px)').matches;
    const ang = (Math.PI / 2) + (k * 2 * Math.PI) / nSeats;
    const rx = mobile ? 39 : 43, ry = mobile ? 41 : 40;
    const cx = 50 + Math.cos(ang) * rx, cy = 50 + Math.sin(ang) * ry;
    return {
      seat: { x: cx, y: cy },
      bet: { x: 50 + Math.cos(ang) * rx * 0.55, y: 50 + Math.sin(ang) * ry * (mobile ? 0.6 : 0.5) },
      btn: { x: 50 + Math.cos(ang + 0.32) * rx * 0.68, y: 50 + Math.sin(ang + 0.32) * ry * 0.66 }
    };
  }

  function winningCards(t) {
    const set = new Set();
    if (!t.results || t.results.uncontested) return set;
    for (const p of t.results.pots) for (const five of p.best || []) five.forEach((c) => set.add(c));
    return set;
  }

  function renderTable() {
    const t = view();
    const me = viewerSeat();
    const n = t.seats.length;
    const anchor = G.mode === 'local' ? 0 : G.mySeat;
    const wins = winningCards(t);
    const winners = new Set();
    if (t.street === 'done' && t.results) t.results.pots.forEach((p) => p.winners.forEach((w) => winners.add(w)));

    // Board
    const bc = $('#boardCards'); bc.innerHTML = '';
    for (let k = 0; k < 5; k++) bc.appendChild(cardEl(t.board[k], { key: 'b' + t.handNo, win: wins.has(t.board[k]), dim: t.street === 'done' && wins.size && !wins.has(t.board[k]) && t.board[k] !== undefined }));
    // Pots
    const pot = $('#potLine');
    const total = t.seats.reduce((a, s) => a + s.total, 0);
    if (t.street === 'done' && t.results) {
      pot.innerHTML = t.results.pots.map((p) => `<span class="pot-pill">${chipSVG(p.amount)}${fmt(p.amount)} <small>${esc(p.label || 'pot')}</small></span>`).join('');
    } else if (total > 0) {
      const live = R.buildPots(t.seats.map((s) => Object.assign({}, s, { total: s.total - s.bet })));
      pot.innerHTML = live.length > 1
        ? live.map((p, i) => `<span class="pot-pill">${chipSVG(p.amount)}${fmt(p.amount)} <small>${i ? 'side pot ' + i : 'main pot'}</small></span>`).join('')
        : `<span class="pot-pill">${chipSVG(total)}${fmt(total)} <small>total pot</small></span>`;
    } else pot.innerHTML = '';
    // Banner
    let banner = '';
    if (t.street === 'done' && t.results) {
      const p = t.results.pots[0];
      const names = p.winners.map((w) => seatName(w, t)).join(' and ');
      banner = t.results.uncontested ? `${names} ${names === 'You' ? 'win' : 'wins'} ${fmt(p.amount)}` : t.results.pots.map((q) => `${q.winners.map((w) => seatName(w, t)).join(' and ')} ${q.winners.length > 1 ? 'split' : (q.winners.length === 1 && seatName(q.winners[0], t) === 'You' ? 'win' : 'wins')} ${fmt(q.amount)} with ${q.desc.toLowerCase()}`).join('. ');
    } else if (t.street === 'idle') banner = 'Shuffling up and dealing';
    else if (t.runout) banner = 'All in. Running out the board.';
    $('#banner').textContent = banner;

    // Seats
    const box = $('#seats'); box.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const s = t.seats[i];
      const k = (i - anchor + n) % n;
      const geo = seatGeometry(n, k);
      const el = document.createElement('div');
      const isMe = i === me || (G.mode === 'local' && k === 0 && me < 0);
      el.className = 'seat' + (i === me ? ' me' : '') + (i === t.toAct && t.street !== 'done' ? ' turn' : '') + (s.folded && !s.out ? ' folded' : '') + (s.out ? ' out' : '') + (winners.has(i) ? ' winner' : '');
      el.style.left = geo.seat.x + '%'; el.style.top = geo.seat.y + '%';
      const hole = document.createElement('div'); hole.className = 'hole';
      if (!s.out && s.hole.length && !(s.folded && i !== me)) s.hole.forEach((c) => hole.appendChild(cardEl(c, { key: 's' + i + 'h' + t.handNo, win: wins.has(c), dim: t.street === 'done' && wins.size && c >= 0 && !wins.has(c) })));
      let tag = '';
      if (s.kind === 'bot') tag = '<span class="tagx">CPU</span>';
      else if (G.mode === 'online') tag = i === G.mySeat ? '<span class="tagx">You</span>' : `<span class="live ${G.awayView && G.awayView[i] ? 'off' : ''}"></span>`;
      const plate = document.createElement('div'); plate.className = 'plate';
      plate.innerHTML = `<div class="nm">${esc(seatName(i, t))}${tag}</div><div class="st">${s.out ? 'Out' : fmt(s.stack)}</div><div class="act">${esc(s.last || '')}</div>${i === t.toAct && G.deadline ? '<div class="timer"><i></i></div>' : ''}`;
      el.appendChild(hole); el.appendChild(plate);
      box.appendChild(el);
      if (s.bet > 0 && t.street !== 'done') {
        const b = document.createElement('div'); b.className = 'bet';
        b.style.left = geo.bet.x + '%'; b.style.top = geo.bet.y + '%';
        b.innerHTML = chipSVG(s.bet) + fmt(s.bet);
        box.appendChild(b);
      }
      if (i === t.button && t.street !== 'idle') {
        const d = document.createElement('div'); d.className = 'dealer-btn'; d.textContent = 'D';
        d.style.left = geo.btn.x + '%'; d.style.top = geo.btn.y + '%';
        box.appendChild(d);
      }
    }
    renderCurtain();
    updateTimers();
  }

  function updateTimers() {
    if (!G || !G.deadline) return;
    const secs = G.away[G.table.toAct] ? 8 : (G.cfg.shot || 30);
    const left = Math.max(0, G.deadline - Date.now());
    const pct = Math.min(100, (left / (secs * 1000)) * 100);
    $$('.seat.turn .timer').forEach((tm) => { tm.classList.toggle('low', left < 6000); tm.firstElementChild.style.width = pct + '%'; });
  }

  // Pass and play: hide cards until the right player is holding the device
  function renderCurtain() {
    const slot = $('#curtainSlot');
    slot.innerHTML = '';
    if (!G || G.mode !== 'local' || localHumans().length < 2) return;
    const t = G.table;
    const i = t.toAct;
    if (t.street === 'done' || t.street === 'idle' || i < 0 || t.seats[i].kind !== 'human' || G.revealed === i) return;
    slot.innerHTML = `<div class="curtain"><div><h3>${esc(t.seats[i].name)}, your turn</h3><p>Pass the device to ${esc(t.seats[i].name)}. Everyone else, look away.</p><button class="btn primary" id="revealBtn">${icon('eye')}Show my cards</button></div></div>`;
    $('#revealBtn').onclick = () => { G.revealed = i; G.hint = null; renderAll(); Sound.play('turn'); };
  }

  function myTurnSeat() {
    if (!G) return -1;
    const t = view();
    if (t.street === 'done' || t.street === 'idle') return -1;
    const i = t.toAct;
    if (i < 0) return -1;
    if (G.mode === 'local') return t.seats[i].kind === 'human' && (localHumans().length < 2 || G.revealed === i) ? i : -1;
    return i === G.mySeat ? i : -1;
  }

  function renderActions() {
    const bar = $('#actionBar');
    const t = view();
    const i = myTurnSeat();
    const L = i >= 0 ? R.legal(t, i) : null;
    bar.classList.toggle('waiting', !L);
    const note = $('#actionNote');
    if (!L) {
      let msg = '';
      if (t.over) msg = 'The game is over.';
      else if (t.street === 'done' || t.street === 'idle') msg = G.paused ? 'Paused. Press Resume to continue.' : (isHost() ? 'Next hand is coming up.' : 'Waiting for the host to deal the next hand.');
      else if (t.toAct >= 0) msg = `Waiting for ${seatName(t.toAct, t)}.`;
      note.textContent = msg;
      $('#foldBtn').textContent = 'Fold'; $('#callBtn').textContent = 'Check'; $('#raiseBtn').textContent = 'Raise';
      ['foldBtn', 'callBtn', 'raiseBtn'].forEach((id) => $('#' + id).classList.remove('suggest'));
      return;
    }
    note.textContent = L.raise ? '' : (L.toCall > 0 && t.locked.includes(i) ? 'A short all-in did not reopen the betting, so you may only call or fold.' : '');
    $('#foldBtn').disabled = false;
    $('#callBtn').textContent = L.check ? 'Check' : (L.call >= t.seats[i].stack ? `Call all in ${fmt(L.call)}` : `Call ${fmt(L.call)}`);
    $('#raiseBtn').disabled = !L.raise;
    $('#raiseRow').style.display = L.raise ? '' : 'none';
    if (L.raise) {
      const rg = $('#raiseRange'), inp = $('#raiseInput');
      rg.min = inp.min = L.raise.min; rg.max = inp.max = L.raise.max;
      const step = t.bb >= 100 ? 10 : 5;
      rg.step = 1; inp.step = step;
      if (!(+inp.value >= L.raise.min && +inp.value <= L.raise.max) || G._lastTurnKey !== t.handNo + ':' + t.log.length) {
        const sugg = G.hint && G.hint.to ? G.hint.to : L.raise.min;
        inp.value = sugg; rg.value = sugg;
      }
      G._lastTurnKey = t.handNo + ':' + t.log.length;
      const v = +inp.value;
      $('#raiseBtn').textContent = v >= L.raise.max ? `All in ${fmt(L.raise.max)}` : `${L.raise.bet ? 'Bet' : 'Raise to'} ${fmt(v)}`;
    } else $('#raiseBtn').textContent = 'Raise';
    ['foldBtn', 'callBtn', 'raiseBtn'].forEach((id) => $('#' + id).classList.remove('suggest'));
    if (G.hint && G.hint.seat === i) {
      const map = { fold: 'foldBtn', check: 'callBtn', call: 'callBtn', raise: 'raiseBtn' };
      const el = $('#' + map[G.hint.action]);
      if (el) el.classList.add('suggest');
    }
  }

  function renderStatus() {
    const t = view();
    let main = '', sub = '';
    if (t.over) {
      const w = t.winner;
      main = w >= 0 ? `${seatName(w, t)} ${seatName(w, t) === 'You' ? 'win' : 'wins'} the table` : 'Game over';
      sub = 'Every other player is out of chips';
    } else if (t.street === 'idle') { main = 'Getting ready'; sub = `Blinds ${fmt(t.cfg.sb)} and ${fmt(t.cfg.bb)}`; }
    else {
      const turn = myTurnSeat();
      if (t.street === 'done') main = `Hand ${t.handNo} finished`;
      else if (turn >= 0) main = G.mode === 'local' ? `${t.seats[turn].name}, your move` : 'Your move';
      else main = `${seatName(t.toAct, t)} to act`;
      const street = { preflop: 'Before the flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown', done: 'Showdown' }[t.street];
      const nextLevel = t.cfg.every ? ` Blinds rise in ${t.cfg.every - ((t.handNo - 1) % t.cfg.every)} ${t.cfg.every - ((t.handNo - 1) % t.cfg.every) === 1 ? 'hand' : 'hands'}.` : '';
      sub = `Hand ${t.handNo}, ${street.toLowerCase()}. Blinds ${fmt(t.sb)} and ${fmt(t.bb)}.${nextLevel}`;
    }
    $('#status').innerHTML = `<span class="turn-dot" style="background:var(--accent)"></span><div><span class="stxt">${esc(main)}</span><small>${esc(sub)}</small></div>`;
  }

  function renderHint() {
    const body = $('#hintBody'), btn = $('#hintBtn'), count = $('#hintCount');
    const allowed = G.cfg.hints !== false;
    const t = view();
    const me = G.mode === 'local' ? (G.revealed >= 0 ? G.revealed : myTurnSeat()) : G.mySeat;
    const used = me >= 0 ? (G.hintsUsed[me] || 0) : 0;
    count.textContent = allowed ? `Hints used: ${used}` : 'Hints off';
    const turn = myTurnSeat();
    btn.disabled = !allowed || turn < 0;
    const s = me >= 0 ? t.seats[me] : null;
    const handLine = s && s.hole.length && s.hole[0] >= 0 && !s.folded
      ? `<div class="hand-name">${esc(t.board.length ? R.describe(R.evaluate(s.hole.concat(t.board))) : B.preflopName(s.hole))}</div>` : '';
    if (G.hint && G.hint.seat === turn && turn >= 0) {
      const h = G.hint, A = h.analysis;
      body.innerHTML = `${handLine}
        <div class="meter" title="Chance to win compared with the chance you need"><i style="width:${Math.round(A.equity * 100)}%"></i>${A.toCall > 0 ? `<b style="left:${Math.round(A.potOdds * 100)}%"></b>` : ''}</div>
        <div class="stat-grid"><div><span>Win chance</span><b>${Math.round(A.equity * 100)}%</b></div><div><span>Pot odds</span><b>${A.toCall > 0 ? Math.round(A.potOdds * 100) + '%' : 'Free'}</b></div><div><span>Outs</span><b>${t.board.length >= 3 && t.board.length < 5 ? A.outs : '-'}</b></div></div>
        <div class="best" style="margin-top:10px">${esc(h.label)}</div>
        <div class="reasons">${h.reasons.map((r) => `<span class="reason">${esc(r)}</span>`).join('')}</div>`;
      btn.lastElementChild.textContent = 'Hide advice';
      btn.disabled = false;
      return;
    }
    btn.lastElementChild.textContent = 'Ask the coach';
    if (!allowed) body.innerHTML = handLine + 'The coach is turned off for this game.';
    else if (turn >= 0) body.innerHTML = handLine + 'Ask the coach for your chance to win, the pot odds, and the move it would make.';
    else if (t.street === 'done' || t.street === 'idle') body.innerHTML = handLine + 'The coach helps on your turn. Use the history to see how the last hand played out.';
    else body.innerHTML = handLine + (s && s.folded ? 'You folded this hand. Watch how the others play it.' : 'Wait for your turn, then ask the coach.');
  }

  function renderHistory() {
    const list = $('#histList');
    const t = view();
    const lines = [];
    const past = G.history.slice(-12);
    const current = t.street !== 'done' && t.street !== 'idle' ? handText(t) : null;
    const blocks = current ? past.concat([current]) : past;
    for (const block of blocks.slice().reverse()) {
      block.forEach((ln, idx) => lines.push(idx === 0 ? `<div class="h-sep">${esc(ln)}</div>` : `<div>${esc(ln)}</div>`));
    }
    list.innerHTML = lines.join('') || '<div>No hands yet.</div>';
  }

  function renderStandings() {
    const t = view();
    const stats = G.statsView || G.stats;
    const order = t.seats.map((s, i) => i).sort((a, b) => (t.seats[b].stack - t.seats[a].stack) || (t.seats[a].out - t.seats[b].out));
    const start = G.startStacks || t.seats.map(() => t.cfg.stack);
    $('#standings').innerHTML = order.map((i, pos) => {
      const s = t.seats[i], st = stats[i] || {};
      const chg = s.stack - start[i];
      const vp = st.hands ? Math.round((st.vpip / st.hands) * 100) : 0;
      return `<div class="row ${s.out ? 'out' : ''}"><span class="pos">${pos + 1}</span>
        <div><b>${esc(seatName(i, t))}</b><div class="sub">Won ${st.won || 0} of ${st.hands || 0} hands. Plays ${vp}% of hands. Biggest pot ${fmt(st.biggest || 0)}</div></div>
        <div class="chips">${s.out ? 'Out' : fmt(s.stack)}<span class="chg ${chg > 0 ? 'up' : chg < 0 ? 'down' : ''}">${chg > 0 ? '+' : ''}${fmt(chg)}</span></div></div>`;
    }).join('') + `<p class="pt-note" style="margin-top:6px">Chips are your points. Everyone started with ${fmt(t.cfg.stack)}. "Plays" is how often a player puts money in before the flop by choice.</p>`;
  }

  function renderToolbar() {
    const host = isHost();
    $('#pauseBtn').disabled = !host || G.mode === 'online';
    $('#pauseBtn').lastElementChild.textContent = G.paused ? 'Resume' : 'Pause';
    const t = G.table;
    $('#nextBtn').disabled = !host || !(t.street === 'done' || t.street === 'idle') || t.over;
  }

  function renderAll() {
    if (!G) return;
    renderStatus();
    renderTable();
    renderActions();
    renderHint();
    renderHistory();
    renderStandings();
    renderToolbar();
  }

  /* ---------------- Player actions ---------------- */
  function humanAct(a) {
    const i = myTurnSeat();
    if (i < 0) return;
    if (G.mode === 'online' && Net.role === 'guest') {
      Net.send({ t: 'act', hand: G.table.handNo, a });
      G.table.toAct = -1; // wait for the host's update
      renderAll();
      return;
    }
    doAct(i, a);
  }

  $('#foldBtn').onclick = () => {
    const t = view(); const i = myTurnSeat(); if (i < 0) return;
    const L = R.legal(t, i);
    if (L && L.check && settings.confirmFold) {
      confirmBox('Fold when you can check?', 'Checking costs nothing. Folding gives up the hand.', 'Fold anyway', () => humanAct({ type: 'fold' }), true);
      return;
    }
    humanAct({ type: 'fold' });
  };
  $('#callBtn').onclick = () => { const t = view(); const i = myTurnSeat(); if (i < 0) return; const L = R.legal(t, i); humanAct({ type: L.check ? 'check' : 'call' }); };
  $('#raiseBtn').onclick = () => {
    const t = view(); const i = myTurnSeat(); if (i < 0) return;
    const L = R.legal(t, i); if (!L || !L.raise) return;
    const v = Math.max(L.raise.min, Math.min(L.raise.max, Math.round(+$('#raiseInput').value || L.raise.min)));
    humanAct({ type: L.raise.bet ? 'bet' : 'raise', to: v });
  };
  function setRaise(v) {
    const t = view(); const i = myTurnSeat(); if (i < 0) return;
    const L = R.legal(t, i); if (!L || !L.raise) return;
    v = Math.max(L.raise.min, Math.min(L.raise.max, Math.round(v)));
    $('#raiseInput').value = v; $('#raiseRange').value = v;
    $('#raiseBtn').textContent = v >= L.raise.max ? `All in ${fmt(L.raise.max)}` : `${L.raise.bet ? 'Bet' : 'Raise to'} ${fmt(v)}`;
  }
  $('#raiseRange').oninput = (e) => setRaise(+e.target.value);
  $('#raiseInput').onchange = (e) => setRaise(+e.target.value);
  $$('.presets button').forEach((b) => b.onclick = () => {
    const t = view(); const i = myTurnSeat(); if (i < 0) return;
    const L = R.legal(t, i); if (!L || !L.raise) return;
    const pot = t.seats.reduce((a, s) => a + s.total, 0);
    const step = t.bb >= 100 ? 10 : 5;
    const frac = { half: 0.5, three: 0.75, pot: 1 }[b.dataset.p];
    let v = b.dataset.p === 'min' ? L.raise.min : b.dataset.p === 'all' ? L.raise.max : t.currentBet + frac * (pot + L.toCall);
    if (frac) v = Math.round(v / step) * step;
    setRaise(v);
  });

  function toggleHint() {
    const i = myTurnSeat();
    if (i < 0 || G.cfg.hints === false) return;
    if (G.hint && G.hint.seat === i) { G.hint = null; renderHint(); renderActions(); return; }
    $('#hintBody').innerHTML = '<span class="spinner"></span>Working out your odds...';
    setTimeout(() => {
      const adv = B.advise(view(), i);
      if (!adv) return;
      G.hint = Object.assign({ seat: i }, adv);
      G.hintsUsed[i] = (G.hintsUsed[i] || 0) + 1;
      if (adv.to) setRaise(adv.to);
      renderHint(); renderActions();
    }, 30);
  }

  /* ---------------- Game over ---------------- */
  function showGameOver() {
    if (!G || !G.table.over) return;
    if (!$('#modalBack').classList.contains('hidden')) return;
    const t = G.table;
    const me = G.mode === 'local' ? -1 : G.mySeat;
    const order = t.seats.map((s, i) => i).sort((a, b) => t.seats[b].stack - t.seats[a].stack);
    // Finishing places: the winner first, then players in reverse order of busting
    const bustOrder = [];
    for (const h of G.history) for (const ln of h) { const m = /^(.*) (is|are) out of chips$/.exec(ln); if (m) bustOrder.push(m[1]); }
    const myPlace = me >= 0 ? (t.winner === me ? 1 : t.seats.length - bustOrder.lastIndexOf('You')) : 0;
    if (G.mode === 'ai') {
      const life = store.get('lifetime', { games: 0, wins: 0, best: 0, hands: 0 });
      life.games++; if (myPlace === 1) life.wins++;
      life.best = life.best ? Math.min(life.best, myPlace) : myPlace;
      life.hands += t.handNo;
      store.set('lifetime', life);
    }
    store.del('resume');
    const st = me >= 0 ? G.stats[me] : null;
    Sound.play('win');
    openModal(`
      <div class="m-head"><div><p class="result-big">${t.winner === me ? 'You win the table' : `${esc(seatName(t.winner))} ${seatName(t.winner) === 'You' ? 'win' : 'wins'} the table`}</p>
        <p class="result-why">${me >= 0 ? `You finished in place ${myPlace} of ${t.seats.length} after ${t.handNo} hands.` : `${t.handNo} hands played.`}</p></div>
        <button class="m-close" data-close aria-label="Close">${icon('x')}</button></div>
      ${st ? `<div class="result-stats">
        <div><span>Hands won</span><b>${st.won}</b></div><div><span>Biggest pot</span><b>${fmt(st.biggest)}</b></div>
        <div><span>Showdowns won</span><b>${st.sdWon}</b></div><div><span>Hints used</span><b>${G.hintsUsed[me] || 0}</b></div></div>` :
        `<div class="standings">${order.map((i, p) => `<div class="row"><span class="pos">${p + 1}</span><div><b>${esc(t.seats[i].name)}</b></div><div class="chips">${fmt(t.seats[i].stack)}</div></div>`).join('')}</div>`}
      <div class="m-actions"><button class="btn" data-act="home">Home</button>${G.mode !== 'online' || Net.role === 'host' ? '<button class="btn primary" data-act="again">Play again</button>' : ''}</div>`,
    (act) => {
      if (act === 'home') { closeModal(); goHome(); }
      else if (act === 'again') {
        closeModal();
        if (G.mode === 'online') { hostRestart(); return; }
        startGame(G.cfg);
      }
    });
  }

  /* ---------------- Modals ---------------- */
  let modalHandler = null;
  function openModal(html, handler, wide) {
    const m = $('#modal');
    m.className = 'modal' + (wide ? ' wide' : '');
    m.innerHTML = html;
    fillIcons(m);
    modalHandler = handler;
    $('#modalBack').classList.remove('hidden');
  }
  function closeModal() { $('#modalBack').classList.add('hidden'); $('#modal').innerHTML = ''; modalHandler = null; }
  $('#modalBack').addEventListener('click', (e) => {
    if (e.target.id === 'modalBack' || e.target.closest('[data-close]')) { const h = modalHandler; closeModal(); if (h) h('close'); return; }
    const a = e.target.closest('[data-act]');
    if (a && modalHandler) modalHandler(a.dataset.act, a);
  });
  function confirmBox(title, text, okLabel, onOk, danger) {
    openModal(`<div class="m-head"><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div></div>
      <div class="m-actions"><button class="btn" data-act="cancel">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="ok">${esc(okLabel)}</button></div>`,
    (act) => { if (act === 'ok') { closeModal(); onOk(); } else if (act === 'cancel') closeModal(); });
  }
  function seg(name, items, value, big) {
    return `<div class="seg ${big ? 'big' : ''}" data-seg="${name}">${items.map((it) => `<button type="button" data-v="${it.id}" class="${it.id === value ? 'on' : ''}">${esc(it.label)}${big && it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('')}</div>`;
  }
  function wireSegs(root, state, onChange) {
    $$('[data-seg]', root).forEach((s) => s.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', s).forEach((x) => x.classList.toggle('on', x === b));
      state[s.dataset.seg] = b.dataset.v;
      if (onChange) onChange(s.dataset.seg);
    }));
  }
  function toggleRow(id, label, sub, on) {
    return `<label class="toggle"><span>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></span></label>`;
  }
  const blindsFor = (stack) => { const bb = Math.max(10, Math.round(stack / 100 / 5) * 5); return { sb: bb / 2, bb }; };

  /* ---------------- Setup screens ---------------- */
  function setupAI() {
    const st = { opps: '3', level: 'normal', stack: '1000', blinds: '10' };
    const life = store.get('lifetime', null);
    openModal(`
      <div class="m-head"><div><h3>Play the computer</h3><p>Everyone starts with the same chips. Last player with chips wins.${life && life.games ? ` Your record: ${life.wins} wins in ${life.games} games${life.best ? `, best finish ${life.best}` : ''}.` : ''}</p></div><button class="m-close" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><label for="nMe">Your name</label><input type="text" id="nMe" maxlength="16" placeholder="You" value="${esc(settings.name)}"></div>
      <div class="field"><span class="lbl">Opponents</span>${seg('opps', [1, 2, 3, 4, 5].map((v) => ({ id: String(v), label: String(v) })), st.opps)}</div>
      <div class="field"><span class="lbl">Skill</span>${seg('level', LEVELS, st.level, true)}</div>
      <div class="field"><span class="lbl">Starting chips</span>${seg('stack', STACKS, st.stack)}</div>
      <div class="field"><span class="lbl">Blinds</span>${seg('blinds', BLINDS, st.blinds)}</div>
      <div class="field">${toggleRow('optHints', 'Allow the coach', 'Ask for odds and advice on your turn', true)}</div>
      <div class="m-actions"><button class="btn primary block" data-act="start">${icon('play')}Take a seat</button></div>`,
    (act) => {
      if (act !== 'start') return;
      const name = $('#nMe').value.trim(); settings.name = name; saveSettings();
      const stack = +st.stack, { sb, bb } = blindsFor(stack);
      const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
      const players = [{ name: name || 'You', kind: 'human' }];
      for (let k = 0; k < +st.opps; k++) players.push({ name: names[k], kind: 'bot' });
      const cfg = { mode: 'ai', players, stack, sb, bb, every: +st.blinds, level: st.level, hints: $('#optHints').checked, mySeat: 0, shot: 0 };
      closeModal(); startGame(cfg);
    });
    wireSegs($('#modal'), st);
  }

  function setupLocal() {
    const st = { humans: '2', bots: '0', level: 'normal', stack: '1000', blinds: '10', shot: '0' };
    const names = () => Array.from({ length: +st.humans }, (_, k) => `<div class="field"><label for="pn${k}">Player ${k + 1}</label><input type="text" id="pn${k}" maxlength="16" placeholder="Player ${k + 1}"></div>`).join('');
    openModal(`
      <div class="m-head"><div><h3>Pass &amp; Play</h3><p>Players share this device. Before each turn, the screen hides the cards until the right player taps to see them.</p></div><button class="m-close" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><span class="lbl">Players at this device</span>${seg('humans', [2, 3, 4, 5, 6].map((v) => ({ id: String(v), label: String(v) })), st.humans)}</div>
      <div class="field-row" id="nameRows" style="grid-template-columns:1fr 1fr">${names()}</div>
      <div class="field"><span class="lbl">Computer players</span>${seg('bots', [0, 1, 2, 3, 4].map((v) => ({ id: String(v), label: String(v) })), st.bots)}</div>
      <div class="field"><span class="lbl">Starting chips</span>${seg('stack', STACKS, st.stack)}</div>
      <div class="field"><span class="lbl">Blinds</span>${seg('blinds', BLINDS, st.blinds)}</div>
      <div class="field"><span class="lbl">Shot clock</span>${seg('shot', SHOT, st.shot)}</div>
      <div class="field">${toggleRow('optHints', 'Allow the coach', 'Each player can ask for odds and advice on their turn', true)}</div>
      <div class="m-actions"><button class="btn primary block" data-act="start">${icon('play')}Deal the cards</button></div>`,
    (act) => {
      if (act !== 'start') return;
      const humans = +st.humans, bots = Math.min(+st.bots, 6 - humans);
      const players = [];
      for (let k = 0; k < humans; k++) players.push({ name: ($('#pn' + k).value.trim() || `Player ${k + 1}`).slice(0, 16), kind: 'human' });
      const bn = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
      for (let k = 0; k < bots; k++) players.push({ name: bn[k], kind: 'bot' });
      const stack = +st.stack, { sb, bb } = blindsFor(stack);
      const hints = $('#optHints').checked;
      closeModal();
      startGame({ mode: 'local', players, stack, sb, bb, every: +st.blinds, level: st.level, hints, shot: +st.shot, mySeat: -1 });
    });
    wireSegs($('#modal'), st, (k) => {
      if (k === 'humans') {
        $('#nameRows').innerHTML = names();
        const maxBots = 6 - +st.humans;
        $$('[data-seg=bots] button', $('#modal')).forEach((b) => { b.disabled = +b.dataset.v > maxBots; });
        if (+st.bots > maxBots) { st.bots = String(maxBots); $$('[data-seg=bots] button', $('#modal')).forEach((b) => b.classList.toggle('on', b.dataset.v === st.bots)); }
      }
    });
  }

  /* ---------------- Online play (PeerJS, host-authoritative) ---------------- */
  const PREFIX = 'river-holdem-v1-';
  const myToken = (() => { try { let t = sessionStorage.getItem('river.token'); if (!t) { t = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('river.token', t); } return t; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
  const Net = {
    peer: null, role: null, code: null, conns: new Map(), conn: null, connected: false, lobby: [], hostCfg: null,
    genCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; },
    close() {
      try { this.conns.forEach((c) => c.conn.close()); } catch (e) { /* ignore */ }
      try { if (this.conn) this.conn.close(); } catch (e) { /* ignore */ }
      try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
      this.peer = null; this.conn = null; this.conns = new Map(); this.connected = false; this.role = null; this.lobby = [];
    },
    host(cfg, onReady, tries) {
      this.close();
      this.role = 'host'; this.hostCfg = cfg;
      const code = this.genCode(); this.code = code;
      const peer = new window.Peer(PREFIX + code, { debug: 0 });
      this.peer = peer;
      this.lobby = [{ name: cfg.name, token: myToken, host: true }];
      peer.on('open', () => onReady(code));
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && (tries || 0) < 4) { this.host(cfg, onReady, (tries || 0) + 1); return; }
        if (err.type === 'peer-unavailable') return;
        toast('Connection problem: ' + (err.type || 'unknown'));
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
      peer.on('connection', (conn) => {
        conn.on('data', (msg) => hostOnData(conn, msg));
        conn.on('close', () => hostOnClose(conn));
        conn.on('error', () => {});
      });
    },
    join(code, name, onErr) {
      this.close();
      this.role = 'guest'; this.code = code; this.myName = name;
      const peer = new window.Peer({ debug: 0 });
      this.peer = peer;
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { onErr('Could not reach that table. Check the code and that the host still has it open.'); this.close(); } }, 15000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true });
        this.attachGuest(conn, () => { settled = true; clearTimeout(timer); });
      });
      peer.on('error', (err) => {
        if (settled && err.type !== 'peer-unavailable') { toast('Connection problem: ' + err.type); return; }
        settled = true; clearTimeout(timer);
        onErr(err.type === 'peer-unavailable' ? 'Table not found. Check the code and try again.' : 'Could not connect (' + err.type + ').');
        this.close();
      });
    },
    attachGuest(conn, onOpen) {
      this.conn = conn;
      conn.on('open', () => { this.connected = true; if (onOpen) onOpen(); conn.send({ t: 'join', name: this.myName, token: myToken }); });
      conn.on('data', (msg) => guestOnData(msg));
      conn.on('close', () => {
        if (this.conn !== conn) return;
        this.connected = false; this.conn = null;
        toast('Lost connection to the table. Reconnecting...', 3500);
        setTimeout(() => { if (this.role === 'guest' && this.peer && !this.peer.destroyed) this.attachGuest(this.peer.connect(PREFIX + this.code, { reliable: true })); }, 1500);
        if (G) renderAll();
      });
      conn.on('error', () => {});
    },
    send(obj) { if (this.conn && this.conn.open) { try { this.conn.send(obj); } catch (e) { /* ignore */ } } },
    sendTo(conn, obj) { if (conn && conn.open) { try { conn.send(obj); } catch (e) { /* ignore */ } } }
  };

  function lobbyHTML() {
    const cap = Net.role === 'host' ? Net.hostCfg.seats : (Net.lobbyCap || 6);
    return `<div class="lobby-list">${Net.lobby.map((p) => `<div><span>${esc(p.name)}</span><small>${p.host ? 'Host' : 'Joined'}</small></div>`).join('')}</div>
      <p class="pt-note">${Net.lobby.length} of ${cap} seats taken.${Net.role === 'host' && Net.hostCfg.fill ? ' Empty seats will be filled with computer players.' : ''}</p>`;
  }
  function refreshLobby() {
    const slot = $('#lobbySlot');
    if (slot) slot.innerHTML = lobbyHTML();
    const go = $('[data-act=begin]');
    if (go) go.disabled = Net.lobby.length < 2 && !Net.hostCfg.fill;
    if (Net.role === 'host') Net.conns.forEach((c) => Net.sendTo(c.conn, { t: 'lobby', players: Net.lobby.map((p) => ({ name: p.name, host: !!p.host })), cap: Net.hostCfg.seats }));
  }

  function hostOnData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'join') {
      const name = String(msg.name || 'Guest').slice(0, 16);
      const token = String(msg.token || conn.peer);
      // Reconnecting player takes back their seat
      if (G && G.mode === 'online') {
        const seat = G.table.seats.findIndex((s) => s.kind === 'remote' && s.id === token);
        if (seat >= 0) {
          Net.conns.set(conn.peer, { conn, token, name, seat });
          delete G.away[seat];
          toast(`${name} reconnected`);
          sendState(conn.peer);
          return;
        }
        Net.sendTo(conn, { t: 'full', reason: 'The game has already started.' });
        setTimeout(() => conn.close(), 400);
        return;
      }
      if (Net.lobby.length >= Net.hostCfg.seats) { Net.sendTo(conn, { t: 'full', reason: 'That table is full.' }); setTimeout(() => conn.close(), 400); return; }
      Net.conns.set(conn.peer, { conn, token, name, seat: -1 });
      Net.lobby = Net.lobby.filter((p) => p.token !== token).concat({ name, token });
      Sound.play('turn');
      toast(`${name} joined the table`);
      refreshLobby();
      return;
    }
    const c = Net.conns.get(conn.peer);
    if (!c) return;
    if (msg.t === 'act') {
      if (!G || G.table.handNo !== msg.hand || G.table.toAct !== c.seat) { sendState(conn.peer); return; }
      const a = msg.a || {};
      if (!doAct(c.seat, { type: String(a.type), to: +a.to })) sendState(conn.peer);
    } else if (msg.t === 'chat') {
      const text = String(msg.text || '').slice(0, 200);
      if (!text) return;
      addChat(`${c.name}: ${text}`, 'them');
      Net.conns.forEach((o, id) => { if (id !== conn.peer) Net.sendTo(o.conn, { t: 'chat', text: `${c.name}: ${text}` }); });
    }
  }
  function hostOnClose(conn) {
    const c = Net.conns.get(conn.peer);
    if (!c) return;
    Net.conns.delete(conn.peer);
    if (G && G.mode === 'online' && c.seat >= 0) {
      G.away[c.seat] = true;
      toast(`${c.name} disconnected. Their hand is played by the clock until they return.`, 3500);
      broadcast();
      if (G.table.toAct === c.seat) pump();
    } else {
      Net.lobby = Net.lobby.filter((p) => p.token !== c.token);
      refreshLobby();
    }
  }
  function publicMeta() {
    return { stats: G.stats, startStacks: G.startStacks, history: G.history.slice(-12), away: G.away, cfg: { hints: G.cfg.hints, shot: G.cfg.shot, level: G.cfg.level, mode: 'online' }, deadline: G.deadline ? G.deadline - Date.now() : 0 };
  }
  function sendState(peerId) {
    const c = Net.conns.get(peerId);
    if (!c || !G) return;
    Net.sendTo(c.conn, { t: 'state', view: R.viewFor(G.table, c.seat), seat: c.seat, meta: publicMeta() });
  }
  function broadcast() {
    if (!G || G.mode !== 'online' || Net.role !== 'host') return;
    Net.conns.forEach((c, id) => sendState(id));
  }

  function guestOnData(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'lobby') {
      Net.lobby = msg.players || []; Net.lobbyCap = msg.cap;
      const slot = $('#lobbySlot');
      if (!slot) showGuestLobby();
      else slot.innerHTML = lobbyHTML();
    } else if (msg.t === 'state') {
      const first = !G || G.mode !== 'online';
      if (first) {
        closeModal();
        G = { mode: 'online', cfg: msg.meta.cfg, table: msg.view, mySeat: msg.seat, stats: msg.meta.stats, startStacks: msg.meta.startStacks, history: msg.meta.history, hint: null, hintsUsed: {}, away: {}, token: 1, deadline: 0 };
        $('#chatTab').classList.remove('hidden');
        showView('game');
        toast('You are seated. Good luck!');
      } else {
        const prevHand = G.table.handNo;
        const prevLog = G.table.log.length;
        G.table = msg.view; G.mySeat = msg.seat;
        G.stats = msg.meta.stats; G.startStacks = msg.meta.startStacks; G.history = msg.meta.history;
        if (G.table.handNo !== prevHand) { seenCards = new Set(); G.hint = null; Sound.play('deal'); }
        else if (G.table.log.length > prevLog) {
          const ev = G.table.log[prevLog];
          if (ev && ev.e === 'act') Sound.play(ev.allIn ? 'allin' : ev.a === 'fold' ? 'fold' : ev.a === 'check' ? 'check' : 'chip');
          G.hint = null;
        }
      }
      G.awayView = msg.meta.away;
      G.deadline = msg.meta.deadline ? Date.now() + msg.meta.deadline : 0;
      G.cfg.shot = msg.meta.cfg.shot;
      renderAll();
      if (myTurnSeat() >= 0) Sound.play('turn');
      if (G.table.over) setTimeout(showGameOver, 1600);
    } else if (msg.t === 'chat') addChat(String(msg.text || '').slice(0, 240), 'them');
    else if (msg.t === 'full') { toast(msg.reason || 'That table is full.'); Net.close(); }
    else if (msg.t === 'ended') { toast('The host closed the table.', 4000); Net.close(); goHome(true); }
  }

  function showGuestLobby() {
    openModal(`
      <div class="m-head"><div><h3>You joined the table</h3><p>Waiting for the host to start the game.</p></div><button class="m-close" data-close aria-label="Leave">${icon('x')}</button></div>
      <div id="lobbySlot">${lobbyHTML()}</div>
      <div class="waiting"><span class="spinner"></span>Waiting for the host...</div>`, (act) => { if (act === 'close') Net.close(); });
  }

  function setupOnline(joinCode) {
    const st = { seats: '6', stack: '1000', blinds: '10', shot: '30', level: 'normal', tab: joinCode ? 'join' : 'create' };
    openModal(`
      <div class="m-head"><div><h3>Play online</h3><p>Host a table and share the link, or join a friend's table.</p></div><button class="m-close" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="tabs" style="margin-bottom:16px">
        <button class="tab ${st.tab === 'create' ? 'active' : ''}" data-act="tab" data-t="create">Host a table</button>
        <button class="tab ${st.tab === 'join' ? 'active' : ''}" data-act="tab" data-t="join">Join a table</button>
      </div>
      <div class="field"><label for="nMe">Your name</label><input type="text" id="nMe" maxlength="16" placeholder="Player" value="${esc(settings.name)}"></div>
      <div id="createPane" class="${st.tab === 'create' ? '' : 'hidden'}">
        <div class="field"><span class="lbl">Seats</span>${seg('seats', [2, 3, 4, 5, 6].map((v) => ({ id: String(v), label: String(v) })), st.seats)}</div>
        <div class="field"><span class="lbl">Starting chips</span>${seg('stack', STACKS, st.stack)}</div>
        <div class="field"><span class="lbl">Blinds</span>${seg('blinds', BLINDS, st.blinds)}</div>
        <div class="field"><span class="lbl">Shot clock</span>${seg('shot', SHOT.slice(1), st.shot)}</div>
        <div class="field">${toggleRow('optFill', 'Fill empty seats with computer players', 'Start even if only one friend joins', true)}${toggleRow('optHints', 'Allow the coach', 'Everyone can ask for odds and advice', false)}</div>
        <div id="roomSlot"></div>
        <div class="m-actions" id="createActions"><button class="btn primary block" data-act="create">${icon('link')}Open the table</button></div>
      </div>
      <div id="joinPane" class="${st.tab === 'join' ? '' : 'hidden'}">
        <div class="field"><label for="codeIn">Table code</label><input type="text" id="codeIn" maxlength="6" placeholder="ABC123" value="${esc(joinCode || '')}" style="text-transform:uppercase;font-family:var(--mono);letter-spacing:.15em"></div>
        <div class="waiting hidden" id="joinWait"><span class="spinner"></span>Connecting...</div>
        <div class="m-actions"><button class="btn primary block" data-act="join">${icon('globe')}Join table</button></div>
      </div>`,
    (act, el) => {
      if (act === 'close') { if (!G || G.mode !== 'online') Net.close(); return; }
      if (act === 'tab') {
        st.tab = el.dataset.t;
        $$('.tabs .tab', $('#modal')).forEach((t) => t.classList.toggle('active', t.dataset.t === st.tab));
        $('#createPane').classList.toggle('hidden', st.tab !== 'create');
        $('#joinPane').classList.toggle('hidden', st.tab !== 'join');
        return;
      }
      if (act === 'copy') {
        const v = $('#roomLink').value;
        const done = () => toast('Link copied');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, () => { $('#roomLink').select(); document.execCommand('copy'); done(); });
        else { $('#roomLink').select(); document.execCommand('copy'); done(); }
        return;
      }
      if (act === 'begin') { hostBegin(); return; }
      const name = ($('#nMe').value.trim() || 'Player').slice(0, 16);
      settings.name = $('#nMe').value.trim(); saveSettings();
      if (typeof window.Peer !== 'function') { toast('Online play needs an internet connection. Check your connection and reload.'); return; }
      if (act === 'create') {
        el.disabled = true; el.innerHTML = '<span class="spinner"></span>Opening the table...';
        const stack = +st.stack;
        Net.host({ name, seats: +st.seats, stack, every: +st.blinds, shot: +st.shot, level: st.level, fill: $('#optFill').checked, hints: $('#optHints').checked }, (code) => {
          const link = `${location.origin}${location.pathname}?table=${code}`;
          $('#createActions').innerHTML = `<button class="btn primary block" data-act="begin">${icon('play')}Start the game</button>`;
          $('#roomSlot').innerHTML = `<div class="room-box">
            <div style="font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.06em;text-transform:uppercase">Table code</div>
            <div class="room-code">${code}</div>
            <div class="room-link"><input readonly value="${esc(link)}" id="roomLink"><button class="btn" data-act="copy">${icon('copy')}Copy link</button></div>
            <div id="lobbySlot">${lobbyHTML()}</div></div>`;
          refreshLobby();
        });
      } else if (act === 'join') {
        const code = $('#codeIn').value.trim().toUpperCase();
        if (code.length < 4) { toast('Enter the table code your friend sent you.'); return; }
        $('#joinWait').classList.remove('hidden');
        Net.join(code, name, (err) => { $('#joinWait').classList.add('hidden'); toast(err); });
      }
    });
    wireSegs($('#modal'), st);
  }

  function hostBegin() {
    const h = Net.hostCfg;
    const players = [{ name: h.name, kind: 'human' }];
    const guests = [...Net.conns.values()];
    guests.forEach((g) => players.push({ name: g.name, kind: 'remote', id: g.token }));
    if (h.fill) { const bn = BOT_NAMES.slice().sort(() => Math.random() - 0.5); while (players.length < h.seats) players.push({ name: bn[players.length], kind: 'bot' }); }
    if (players.length < 2) { toast('Wait for a friend to join, or turn on computer players.'); return; }
    guests.forEach((g, k) => { g.seat = k + 1; });
    const { sb, bb } = blindsFor(h.stack);
    closeModal();
    startGame({ mode: 'online', players, stack: h.stack, sb, bb, every: h.every, level: h.level, hints: h.hints, shot: h.shot, mySeat: 0 });
    broadcast();
  }
  function hostRestart() {
    const players = G.table.seats.map((s) => ({ name: s.name, kind: s.kind, id: s.id }));
    const cfg = Object.assign({}, G.cfg, { players });
    startGame(cfg);
    broadcast();
  }

  function addChat(text, who) {
    if (!text) return;
    const log = $('#chatLog');
    const el = document.createElement('div');
    el.className = 'chat-msg ' + (who === 'me' ? 'me' : '');
    el.textContent = text;
    log.appendChild(el); log.scrollTop = log.scrollHeight;
    if (who === 'them' && $('[data-panel=chat]').classList.contains('hidden')) $('#chatDot').classList.remove('hidden');
  }
  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#chatInput'); const text = inp.value.trim();
    if (!text) return;
    if (Net.role === 'host') {
      const line = `${Net.hostCfg.name}: ${text}`;
      Net.conns.forEach((c) => Net.sendTo(c.conn, { t: 'chat', text: line }));
    } else if (Net.connected) Net.send({ t: 'chat', text });
    else { toast('Not connected'); return; }
    addChat(`You: ${text}`, 'me'); inp.value = '';
  });

  /* ---------------- Views ---------------- */
  function showView(v) {
    $('#home').classList.toggle('hidden', v !== 'home');
    $('#game').classList.toggle('hidden', v !== 'game');
    window.scrollTo(0, 0);
  }
  function goHome(force) {
    const leave = () => {
      clearTimers();
      if (G && G.mode === 'online') {
        if (Net.role === 'host') Net.conns.forEach((c) => Net.sendTo(c.conn, { t: 'ended' }));
        setTimeout(() => Net.close(), 200);
      }
      G = null; renderHome(); showView('home');
    };
    if (!force && G && G.mode === 'online' && !G.table.over) {
      confirmBox(Net.role === 'host' ? 'Close this table?' : 'Leave this table?', Net.role === 'host' ? 'The game ends for everyone.' : 'Your seat will be played by the clock.', Net.role === 'host' ? 'Close table' : 'Leave', leave, true);
      return;
    }
    leave();
  }
  function switchTab(name) {
    $$('.tab[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    $$('.panel[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== name));
    if (name === 'chat') $('#chatDot').classList.add('hidden');
  }

  const LADDER = [
    ['Royal flush', 'As Ks Qs Js Ts', 'A to 10, one suit'],
    ['Straight flush', '9h 8h 7h 6h 5h', 'Five in a row, one suit'],
    ['Four of a kind', 'Qc Qd Qh Qs 4d', 'Four of one rank'],
    ['Full house', 'Kd Kh Ks 7c 7d', 'Three plus a pair'],
    ['Flush', 'Ad Jd 8d 5d 2d', 'Five of one suit'],
    ['Straight', '8c 7d 6h 5s 4c', 'Five in a row'],
    ['Three of a kind', 'Jc Jh Js 9d 3h', 'Three of one rank'],
    ['Two pair', 'Tc Td 6h 6s Ac', 'Two different pairs'],
    ['Pair', '9s 9h Kd 7c 2h', 'Two of one rank'],
    ['High card', 'Ah Jd 8c 5s 3d', 'Nothing else']
  ];
  function renderHome() {
    $('#rankLadder').innerHTML = LADDER.map(([n, cards, d]) => `<div><b>${n}</b><div class="mini">${cards.split(' ').map((c) => `<span class="pcard">${cardSVG(c, settings.four)}</span>`).join('')}</div><span>${d}</span></div>`).join('');
    const r = store.get('resume', null);
    const slot = $('#resumeSlot');
    if (r && r.G && r.G.table && !r.G.table.over) {
      const t = r.G.table;
      const label = r.G.mode === 'ai' ? `vs ${t.seats.length - 1} computer ${t.seats.length === 2 ? 'player' : 'players'}` : t.seats.filter((s) => s.kind === 'human').map((s) => s.name).join(', ');
      slot.innerHTML = `<div class="resume"><div><strong>Continue your game</strong><span>${esc(label)}, hand ${t.handNo}</span></div>
        <div class="row"><button class="btn ghost" id="resumeDrop">Discard</button><button class="btn primary" id="resumeGo">Resume</button></div></div>`;
      $('#resumeGo').onclick = () => startGame(r.G.cfg, r.G);
      $('#resumeDrop').onclick = () => { store.del('resume'); renderHome(); };
    } else slot.innerHTML = '';
  }

  function openSettings() {
    openModal(`
      <div class="m-head"><div><h3>Settings</h3><p>Saved on this device.</p></div><button class="m-close" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="field"><span class="lbl">Appearance</span>${seg('ui', [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }], settings.ui)}</div>
      <div class="field"><span class="lbl">Table felt</span><div class="swatches">${FELTS.map((f) => `<button class="swatch felt-sw ${f.id === settings.felt ? 'on' : ''}" data-act="felt" data-f="${f.id}" aria-label="${f.id} felt" style="background:${f.c}"></button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Card back</span><div class="swatches">${Object.keys(BACKS).map((k) => `<button class="swatch back-sw ${k === settings.back ? 'on' : ''}" data-act="back" data-b="${k}" aria-label="${k} card back">${backSVG(k)}</button>`).join('')}</div></div>
      <div class="field">
        ${toggleRow('sFour', 'Four-colour deck', 'Blue diamonds and green clubs, easier to tell suits apart', settings.four)}
        ${toggleRow('sAuto', 'Deal the next hand automatically', 'Otherwise press "Deal next hand"', settings.autoNext)}
        ${toggleRow('sFast', 'Fast play', 'Computer players act more quickly', settings.fast)}
        ${toggleRow('sConfirm', 'Confirm before folding', 'Ask first when you could check for free', settings.confirmFold)}
        ${toggleRow('sSound', 'Sounds', 'Chips, cards and turn alerts', settings.sound)}
      </div>
      <div class="m-actions"><button class="btn primary" data-act="done">Done</button></div>`,
    (act, el) => {
      if (act === 'felt') { settings.felt = el.dataset.f; $$('.felt-sw', $('#modal')).forEach((s) => s.classList.toggle('on', s === el)); applyTheme(); saveSettings(); }
      else if (act === 'back') { settings.back = el.dataset.b; $$('.back-sw', $('#modal')).forEach((s) => s.classList.toggle('on', s === el)); saveSettings(); if (G) renderAll(); }
      else if (act === 'done') closeModal();
    });
    const m = $('#modal');
    $('[data-seg=ui]', m).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $$('button', b.parentNode).forEach((x) => x.classList.toggle('on', x === b)); settings.ui = b.dataset.v; applyTheme(); saveSettings(); });
    const bind = (id, key, after) => $('#' + id, m).addEventListener('change', (e) => { settings[key] = e.target.checked; saveSettings(); if (after) after(); });
    bind('sFour', 'four', () => { renderHome(); if (G) renderAll(); });
    bind('sAuto', 'autoNext', () => { if (G && settings.autoNext && isHost()) pump(); });
    bind('sFast', 'fast');
    bind('sConfirm', 'confirmFold');
    bind('sSound', 'sound');
  }

  function openRules() {
    openModal(`
      <div class="m-head"><div><h3>How the rules work</h3><p>No-limit Texas Hold'em. Everything below is enforced automatically.</p></div><button class="m-close" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="rules">
        <h4>The deal</h4><p>Each player gets two private cards. Five shared cards are dealt face up in three stages: the flop (three cards), the turn and the river. A card is burned before each stage. Your hand is the best five cards from your two and the five on the board.</p>
        <h4>Blinds and the button</h4><p>The dealer button moves one seat to the left each hand. The two players after it post the small and big blind. With only two players, the button posts the small blind and acts first before the flop, then last after it. If the big blind is short, others must still call the full big blind.</p>
        <h4>Betting</h4>
        <ul>
          <li>On your turn you can fold, check (if there is no bet), call, bet or raise.</li>
          <li>The smallest bet is the big blind. A raise must be at least as big as the last bet or raise in that round.</li>
          <li>No limit: you can bet all your chips at any time.</li>
          <li>An all-in raise that is smaller than a full raise does not reopen betting. Players who already acted can only call or fold.</li>
          <li>Before the flop, the big blind gets the option to raise if nobody else has.</li>
          <li>When everyone else is all in, there is no more betting and the board is dealt out.</li>
        </ul>
        <h4>Side pots</h4><p>A player who is all in can only win as much from each opponent as they put in. Extra bets form side pots that only the players who contributed can win. A bet that nobody calls is returned.</p>
        <h4>Showdown</h4><p>The last player to bet or raise shows first. If there was no bet on the river, the first player left of the button shows first. Players who cannot win may muck (throw away) their hand. Hands that went all in are always shown. Equal hands split the pot, and any odd chip goes to the first winner left of the button.</p>
        <h4>Winning</h4><p>Players with no chips are out. The last player with chips wins the table. Blinds can rise on a schedule to keep the game moving.</p>
        <h4>Shot clock</h4><p>If a shot clock is set and time runs out, you check if you can, otherwise you fold.</p>
        <h4>Play chips</h4><p>Chips have no cash value and cannot be bought or sold. No real money is ever involved.</p>
      </div>
      <div class="m-actions"><button class="btn primary" data-close>Got it</button></div>`, null, true);
  }

  function downloadHistory() {
    if (!G) return;
    const text = G.history.map((h) => h.join('\n')).join('\n\n') || 'No hands played yet.';
    const blob = new Blob(['River Hold\'em hand history\n\n' + text + '\n'], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `river-hands-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Hand history saved');
  }

  /* ---------------- Wiring ---------------- */
  function init() {
    applyTheme();
    fillIcons(document);
    $('#brandMark').innerHTML = `<svg viewBox="0 0 64 64" width="26" height="26"><circle cx="32" cy="32" r="22" fill="#151026"/><circle cx="32" cy="32" r="18" fill="none" stroke="#a78bfa" stroke-width="5" stroke-dasharray="7.07 7.07"/><path d="M32 23.5 C28 27.6 24.8 29.6 24.8 33 C24.8 35.8 27.6 37.4 30 35.9 C29.7 37.8 28.9 39 27.6 40.2 H36.4 C35.1 39 34.3 37.8 34 35.9 C36.4 37.4 39.2 35.8 39.2 33 C39.2 29.6 36 27.6 32 23.5 Z" fill="#a78bfa"/></svg>`;
    renderHome();
    $$('.mode-card').forEach((c) => c.addEventListener('click', () => {
      const m = c.dataset.mode;
      if (m === 'local') setupLocal(); else if (m === 'ai') setupAI(); else setupOnline();
    }));
    $('#brandBtn').onclick = () => goHome();
    $('#navPlay').onclick = () => goHome();
    $('#navRules').onclick = openRules;
    $('#navSettings').onclick = openSettings;
    $('#navTheme').onclick = () => { settings.ui = settings.ui === 'dark' ? 'light' : 'dark'; applyTheme(); saveSettings(); };
    $('#hintBtn').onclick = toggleHint;
    $('#pauseBtn').onclick = () => {
      if (!G || !isHost() || G.mode === 'online') return;
      G.paused = !G.paused;
      if (!G.paused) { G.token++; pump(); } else clearTimers();
      renderAll();
    };
    $('#nextBtn').onclick = () => { if (G && isHost()) { G.paused = false; dealNext(); } };
    $('#newBtn').onclick = () => {
      if (!G) return;
      if (G.mode === 'online') { goHome(); return; }
      confirmBox('Start a new game?', 'The current game will end.', 'New game', () => { clearTimers(); store.del('resume'); if (G.mode === 'ai') setupAI(); else setupLocal(); });
    };
    $('#saveBtn').onclick = downloadHistory;
    $$('.tab[data-tab]').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    document.addEventListener('keydown', (e) => {
      if (!G || $('#game').classList.contains('hidden') || e.target.closest('input, textarea')) return;
      if (!$('#modalBack').classList.contains('hidden')) { if (e.key === 'Escape') { const h = modalHandler; closeModal(); if (h) h('close'); } return; }
      const k = e.key.toLowerCase();
      if (myTurnSeat() < 0) return;
      if (k === 'f') $('#foldBtn').click();
      else if (k === 'c') $('#callBtn').click();
      else if (k === 'r' && !$('#raiseBtn').disabled) $('#raiseBtn').click();
      else if (k === 'h') toggleHint();
    });
    window.addEventListener('resize', () => { if (G) renderTable(); });
    window.addEventListener('beforeunload', (e) => { if (G && G.mode === 'online' && !G.table.over) { e.preventDefault(); e.returnValue = ''; } });
    const code = new URLSearchParams(location.search).get('table');
    if (code) {
      const open = () => setupOnline(code.toUpperCase().slice(0, 6));
      if (document.readyState === 'complete') open(); else window.addEventListener('load', open);
    }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
    window.__river = { get G() { return G; }, startGame, humanAct, myTurnSeat, dealNext, settings };
  }
  init();
})();
