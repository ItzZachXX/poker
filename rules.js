/*
 * River - No-limit Texas Hold'em rules engine.
 * Enforces standard table rules:
 *  - moving button; small and big blind (heads-up: the button posts the small blind and acts first before the flop)
 *  - a short big blind still sets the full big blind as the amount to call
 *  - a burn card before the flop, turn and river
 *  - minimum bet is the big blind; a raise must be at least the size of the previous bet or raise
 *  - an all-in raise smaller than a full raise does not reopen betting for players who already acted
 *  - no betting when every opponent is all-in; the board is run out instead
 *  - uncalled bets are returned; main and side pots; split pots with odd chips to the first winner left of the button
 *  - showdown order: last aggressor first (otherwise first player left of the button); players who cannot win may muck;
 *    hands that are all-in are always shown
 * The table state is a plain object so it can be saved and sent over the network.
 */
function RiverRulesFactory(root) {
  'use strict';

  const RANK_CH = '23456789TJQKA';
  const SUIT_CH = 'shdc';
  const CAT_NAME = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
  const rankOf = (c) => (c >> 2) + 2;
  const suitOf = (c) => c & 3;
  const cardCode = (c) => RANK_CH[rankOf(c) - 2] + SUIT_CH[suitOf(c)];
  const parseCard = (s) => ((RANK_CH.indexOf(s[0].toUpperCase()) << 2) | SUIT_CH.indexOf(s[1].toLowerCase()));

  /* ---------- hand evaluation ---------- */
  function straightHigh(ranks) {
    const set = new Set(ranks);
    if (set.has(14)) set.add(1);
    for (let h = 14; h >= 5; h--) {
      let ok = true;
      for (let k = 0; k < 5; k++) if (!set.has(h - k)) { ok = false; break; }
      if (ok) return h;
    }
    return 0;
  }
  function code(cat, ks) { let v = cat; for (let i = 0; i < 5; i++) v = v * 15 + (ks[i] || 0); return v; }

  // Score of the best five-card hand from 5 to 7 cards. Higher is better.
  function evaluate(cards) {
    const counts = new Array(15).fill(0), bySuit = [[], [], [], []];
    for (const c of cards) { const r = rankOf(c); counts[r]++; bySuit[suitOf(c)].push(r); }
    let flush = null;
    for (const s of bySuit) if (s.length >= 5) flush = s.slice().sort((a, b) => b - a);
    if (flush) { const sf = straightHigh(flush); if (sf) return code(8, [sf]); }
    const quads = [], trips = [], pairs = [], all = [];
    for (let r = 14; r >= 2; r--) {
      if (!counts[r]) continue;
      all.push(r);
      if (counts[r] === 4) quads.push(r); else if (counts[r] === 3) trips.push(r); else if (counts[r] === 2) pairs.push(r);
    }
    if (quads.length) return code(7, [quads[0], all.find((r) => r !== quads[0])]);
    if (trips.length && (trips.length > 1 || pairs.length)) return code(6, [trips[0], Math.max(trips[1] || 0, pairs[0] || 0)]);
    if (flush) return code(5, flush.slice(0, 5));
    const st = straightHigh(all);
    if (st) return code(4, [st]);
    if (trips.length) return code(3, [trips[0], ...all.filter((r) => r !== trips[0]).slice(0, 2)]);
    if (pairs.length >= 2) return code(2, [pairs[0], pairs[1], all.find((r) => r !== pairs[0] && r !== pairs[1])]);
    if (pairs.length) return code(1, [pairs[0], ...all.filter((r) => r !== pairs[0]).slice(0, 3)]);
    return code(0, all.slice(0, 5));
  }
  const category = (score) => Math.floor(score / 759375);

  // The five cards that make the best hand (for highlighting)
  function bestFive(cards) {
    let best = -1, pick = null;
    const n = cards.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const h = [cards[a], cards[b], cards[c], cards[d], cards[e]];
      const v = evaluate(h);
      if (v > best) { best = v; pick = h; }
    }
    return pick || cards.slice(0, 5);
  }

  const RANK_WORD = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  const plural = (r) => (r === 6 ? 'Sixes' : RANK_WORD[r] + 's');
  function describe(score) {
    const cat = category(score);
    let rest = score % 759375;
    const k = [];
    for (let i = 0; i < 5; i++) { k.unshift(rest % 15); rest = Math.floor(rest / 15); }
    switch (cat) {
      case 8: return k[0] === 14 ? 'Royal flush' : `Straight flush, ${RANK_WORD[k[0]]} high`;
      case 7: return `Four ${plural(k[0])}`;
      case 6: return `Full house, ${plural(k[0])} full of ${plural(k[1])}`;
      case 5: return `Flush, ${RANK_WORD[k[0]]} high`;
      case 4: return `Straight, ${RANK_WORD[k[0]]} high`;
      case 3: return `Three ${plural(k[0])}`;
      case 2: return `Two pair, ${plural(k[0])} and ${plural(k[1])}`;
      case 1: return `Pair of ${plural(k[0])}`;
      default: return `${RANK_WORD[k[0]]} high`;
    }
  }

  function rand(n) {
    if (root.crypto && root.crypto.getRandomValues) {
      const a = new Uint32Array(1);
      const lim = Math.floor(0x100000000 / n) * n;
      do { root.crypto.getRandomValues(a); } while (a[0] >= lim);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffledDeck() {
    const d = Array.from({ length: 52 }, (_, i) => i);
    for (let i = d.length - 1; i > 0; i--) { const j = rand(i + 1); const t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }

  // Monte Carlo chance of winning against `opps` unknown hands (ties count as a share)
  function equity(hole, board, opps, sims, dead) {
    const known = new Set([...hole, ...board, ...(dead || [])]);
    const rest = [];
    for (let c = 0; c < 52; c++) if (!known.has(c)) rest.push(c);
    const need = 5 - board.length;
    let total = 0;
    sims = sims || 400;
    if (opps <= 0) return 1;
    for (let s = 0; s < sims; s++) {
      const pick = opps * 2 + need;
      for (let i = 0; i < pick; i++) { const j = i + Math.floor(Math.random() * (rest.length - i)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
      const full = board.concat(rest.slice(opps * 2, opps * 2 + need));
      const mine = evaluate(hole.concat(full));
      let best = true, ties = 0;
      for (let o = 0; o < opps; o++) {
        const v = evaluate([rest[o * 2], rest[o * 2 + 1], ...full]);
        if (v > mine) { best = false; break; }
        if (v === mine) ties++;
      }
      if (best) total += 1 / (ties + 1);
    }
    return total / sims;
  }

  // Split contributions into a main pot and side pots
  function buildPots(seats) {
    const live = seats.filter((p) => !p.folded && p.total > 0);
    const levels = [...new Set(live.map((p) => p.total))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const L of levels) {
      let amount = 0;
      for (const p of seats) amount += Math.max(0, Math.min(p.total, L) - prev);
      const eligible = seats.map((p, i) => (!p.folded && p.total >= L ? i : -1)).filter((i) => i >= 0);
      if (amount > 0) {
        if (pots.length && pots[pots.length - 1].eligible.join() === eligible.join()) pots[pots.length - 1].amount += amount;
        else pots.push({ amount, eligible });
      }
      prev = L;
    }
    let leftover = 0;
    for (const p of seats) leftover += Math.max(0, p.total - prev);
    if (leftover && pots.length) pots[pots.length - 1].amount += leftover;
    return pots;
  }

  /* ---------- the table ---------- */
  // cfg: { players: [{ name, kind, id }], stack, sb, bb, every (hands per blind level, 0 = fixed), mult }
  function createTable(cfg) {
    return {
      v: 1,
      cfg: { stack: cfg.stack, sb: cfg.sb, bb: cfg.bb, every: cfg.every || 0, mult: cfg.mult || 2 },
      seats: cfg.players.map((p) => ({
        name: p.name, kind: p.kind || 'human', id: p.id || null,
        stack: cfg.stack, hole: [], folded: true, allIn: false, out: false,
        bet: 0, total: 0, acted: false, shown: false, mucked: false, last: '', won: 0
      })),
      button: -1, handNo: 0, level: 0, sb: cfg.sb, bb: cfg.bb,
      street: 'idle', board: [], deck: [], burned: 0,
      toAct: -1, currentBet: 0, minRaise: cfg.bb, lastAggressor: -1, locked: [],
      sbSeat: -1, bbSeat: -1,
      log: [], results: null, over: false, winner: -1, runout: false
    };
  }

  const n = (t) => t.seats.length;
  const alive = (t) => t.seats.map((s, i) => (!s.out ? i : -1)).filter((i) => i >= 0);
  const inHand = (t) => t.seats.map((s, i) => (!s.out && !s.folded ? i : -1)).filter((i) => i >= 0);
  const canAct = (s) => !s.out && !s.folded && !s.allIn;
  function nextSeat(t, i, pred) {
    for (let k = 1; k <= n(t); k++) { const j = (i + k + n(t)) % n(t); if (pred(t.seats[j], j)) return j; }
    return -1;
  }
  const potTotal = (t) => t.seats.reduce((a, s) => a + s.total, 0);

  function put(t, i, amount) {
    const s = t.seats[i];
    amount = Math.max(0, Math.min(amount, s.stack));
    s.stack -= amount; s.bet += amount; s.total += amount;
    if (s.stack === 0) s.allIn = true;
    return amount;
  }

  function roundBlind(v) { return v >= 100 ? Math.round(v / 10) * 10 : Math.round(v / 5) * 5 || 1; }

  function startHand(t, deck) {
    const live = alive(t);
    if (live.length < 2) { t.over = true; t.winner = live[0] ?? -1; t.street = 'done'; return t; }
    t.handNo++;
    if (t.cfg.every) {
      t.level = Math.floor((t.handNo - 1) / t.cfg.every);
      t.sb = roundBlind(t.cfg.sb * Math.pow(t.cfg.mult, t.level));
      t.bb = roundBlind(t.cfg.bb * Math.pow(t.cfg.mult, t.level));
    }
    t.button = t.button < 0 ? live[rand(live.length)] : nextSeat(t, t.button, (s) => !s.out);
    const headsUp = live.length === 2;
    t.sbSeat = headsUp ? t.button : nextSeat(t, t.button, (s) => !s.out);
    t.bbSeat = nextSeat(t, t.sbSeat, (s) => !s.out);
    for (const s of t.seats) Object.assign(s, { hole: [], folded: s.out, allIn: false, bet: 0, total: 0, acted: false, shown: false, mucked: false, last: s.out ? 'Out' : '', won: 0 });
    t.deck = deck || shuffledDeck();
    t.board = []; t.burned = 0; t.results = null; t.runout = false; t.log = []; t.locked = [];
    t.lastAggressor = -1;
    const sbPaid = put(t, t.sbSeat, t.sb);
    t.seats[t.sbSeat].last = `Small blind ${sbPaid}`;
    t.log.push({ e: 'blind', seat: t.sbSeat, amount: sbPaid, kind: 'small' });
    const bbPaid = put(t, t.bbSeat, t.bb);
    t.seats[t.bbSeat].last = `Big blind ${bbPaid}`;
    t.log.push({ e: 'blind', seat: t.bbSeat, amount: bbPaid, kind: 'big' });
    t.currentBet = t.bb;      // the full big blind is the amount to call, even if the big blind is short
    t.minRaise = t.bb;
    for (let r = 0; r < 2; r++) {
      for (let k = 1; k <= n(t); k++) {
        const i = (t.button + k) % n(t);
        if (!t.seats[i].out) t.seats[i].hole.push(t.deck.pop());
      }
    }
    t.street = 'preflop';
    t.log.push({ e: 'deal' });
    t.toAct = nextSeat(t, t.bbSeat, canAct);
    settle(t, t.bbSeat);
    return t;
  }

  // What the player to act may do
  function legal(t, i) {
    if (t.street === 'idle' || t.street === 'done' || t.street === 'showdown' || i !== t.toAct) return null;
    const s = t.seats[i];
    const toCall = Math.max(0, t.currentBet - s.bet);
    const opponentsCanRespond = t.seats.some((o, j) => j !== i && canAct(o));
    const out = { fold: true, check: toCall === 0, call: toCall > 0 ? Math.min(toCall, s.stack) : 0, toCall, raise: null };
    if (s.stack > toCall && opponentsCanRespond && !t.locked.includes(i)) {
      const maxTo = s.bet + s.stack;
      const minTo = Math.min(t.currentBet === 0 ? t.bb : t.currentBet + t.minRaise, maxTo);
      out.raise = { min: minTo, max: maxTo, bet: t.currentBet === 0 };
    }
    return out;
  }

  function act(t, i, a) {
    const L = legal(t, i);
    if (!L) return { ok: false, error: 'Not your turn' };
    const s = t.seats[i];
    let type = a.type;
    if (type === 'check' && !L.check) return { ok: false, error: 'You cannot check, there is a bet to call' };
    if (type === 'call' && L.toCall === 0) type = 'check';
    if ((type === 'raise' || type === 'bet') && !L.raise) return { ok: false, error: 'Raising is not allowed here' };
    if (type === 'fold') {
      s.folded = true; s.last = 'Fold';
      t.log.push({ e: 'act', seat: i, a: 'fold' });
    } else if (type === 'check') {
      s.last = 'Check';
      t.log.push({ e: 'act', seat: i, a: 'check' });
    } else if (type === 'call') {
      const paid = put(t, i, L.toCall);
      s.last = s.allIn ? 'All in' : `Call ${paid}`;
      t.log.push({ e: 'act', seat: i, a: 'call', amount: paid, allIn: s.allIn });
    } else if (type === 'raise' || type === 'bet') {
      let to = Math.round(Number(a.to));
      if (!isFinite(to)) return { ok: false, error: 'Enter an amount' };
      to = Math.min(Math.max(to, L.raise.min), L.raise.max);
      const before = t.currentBet;
      put(t, i, to - s.bet);
      const size = s.bet - before;
      const opened = before === 0;
      const full = opened ? s.bet >= t.bb : size >= t.minRaise;
      if (s.bet > before) {
        t.currentBet = s.bet;
        t.lastAggressor = i;
        if (full) {
          t.minRaise = Math.max(size, t.bb);
          t.locked = [];
          t.seats.forEach((o, j) => { if (j !== i && canAct(o)) o.acted = false; });
        } else {
          // Short all-in: players who already acted may only call or fold
          t.seats.forEach((o, j) => {
            if (j === i || !canAct(o)) return;
            if (o.acted && !t.locked.includes(j)) t.locked.push(j);
            o.acted = false;
          });
        }
      }
      s.last = s.allIn ? 'All in' : `${opened ? 'Bet' : 'Raise to'} ${s.bet}`;
      t.log.push({ e: 'act', seat: i, a: opened ? 'bet' : 'raise', to: s.bet, allIn: s.allIn, full });
    } else return { ok: false, error: 'Unknown action' };
    s.acted = true;
    settle(t, i);
    return { ok: true };
  }

  function roundDone(t) {
    return t.seats.every((s) => !canAct(s) || (s.acted && s.bet >= t.currentBet));
  }

  // Move play forward after an action
  function settle(t, from) {
    if (inHand(t).length === 1) { awardUncontested(t); return; }
    if (!roundDone(t)) {
      t.toAct = nextSeat(t, from, (s) => canAct(s) && (!s.acted || s.bet < t.currentBet));
      if (t.toAct >= 0) {
        // Nobody left to respond: a lone player who has matched the bet does not need to act
        const others = t.seats.some((o, j) => j !== t.toAct && canAct(o));
        const s = t.seats[t.toAct];
        if (!others && s.bet >= t.currentBet) { s.acted = true; settle(t, t.toAct); }
        return;
      }
    }
    nextStreet(t);
  }

  function nextStreet(t) {
    for (const s of t.seats) { s.bet = 0; s.acted = false; }
    t.currentBet = 0; t.minRaise = t.bb; t.locked = []; t.toAct = -1;
    const order = { preflop: 'flop', flop: 'turn', turn: 'river', river: 'showdown' };
    const lastStreetAggressor = t.lastAggressor;
    t.street = order[t.street];
    if (t.street === 'showdown') { showdown(t, lastStreetAggressor); return; }
    t.lastAggressor = -1;
    t.deck.pop(); t.burned++;
    const count = t.street === 'flop' ? 3 : 1;
    const cards = [];
    for (let k = 0; k < count; k++) { const c = t.deck.pop(); t.board.push(c); cards.push(c); }
    t.log.push({ e: 'street', street: t.street, cards });
    const actors = t.seats.filter(canAct).length;
    if (actors <= 1) { t.runout = true; nextStreet(t); return; }
    t.toAct = nextSeat(t, t.button, canAct);
    for (const s of t.seats) if (!s.out && !s.folded && !s.allIn) s.last = '';
  }

  function returnUncalled(t) {
    const totals = t.seats.map((s) => s.total).sort((a, b) => b - a);
    if (totals[0] > totals[1]) {
      const i = t.seats.findIndex((s) => s.total === totals[0]);
      const back = totals[0] - totals[1];
      t.seats[i].total -= back; t.seats[i].stack += back;
      t.log.push({ e: 'return', seat: i, amount: back });
    }
  }

  function awardUncontested(t) {
    returnUncalled(t);
    const w = inHand(t)[0];
    const amount = potTotal(t);
    t.seats[w].stack += amount; t.seats[w].won = amount;
    t.log.push({ e: 'win', seats: [w], amount, pot: 'pot', uncontested: true });
    t.results = { pots: [{ amount, winners: [w], desc: null }], uncontested: true };
    finishHand(t);
  }

  function showdown(t, lastAggressor) {
    returnUncalled(t);
    const contenders = inHand(t);
    const scores = {};
    for (const i of contenders) scores[i] = evaluate(t.seats[i].hole.concat(t.board));
    // Showing order
    let start = lastAggressor >= 0 && !t.seats[lastAggressor].folded ? lastAggressor : nextSeat(t, t.button, (s) => !s.out && !s.folded);
    const orderList = [];
    for (let k = 0; k < n(t); k++) { const i = (start + k) % n(t); if (contenders.includes(i)) orderList.push(i); }
    const potsBefore = buildPots(t.seats);
    const canStillWin = (i) => potsBefore.some((p) => {
      if (!p.eligible.includes(i)) return false;
      const shown = p.eligible.filter((j) => t.seats[j].shown).map((j) => scores[j]);
      return !shown.length || scores[i] >= Math.max(...shown);
    });
    for (const i of orderList) {
      const s = t.seats[i];
      if (s.allIn || t.runout || canStillWin(i)) {
        s.shown = true;
        s.last = describe(scores[i]);
        t.log.push({ e: 'show', seat: i, cards: s.hole.slice(), desc: describe(scores[i]) });
      } else {
        s.mucked = true; s.last = 'Mucks';
        t.log.push({ e: 'muck', seat: i });
      }
    }
    const pots = buildPots(t.seats);
    const results = [];
    pots.forEach((pot, idx) => {
      const elig = pot.eligible.filter((i) => s_shownOrOnly(t, i, pot.eligible));
      const best = Math.max(...elig.map((i) => scores[i]));
      const winners = elig.filter((i) => scores[i] === best);
      winners.sort((a, b) => ((a - t.button + n(t)) % n(t)) - ((b - t.button + n(t)) % n(t)));
      const share = Math.floor(pot.amount / winners.length);
      let odd = pot.amount - share * winners.length;
      for (const w of winners) { const amt = share + (odd-- > 0 ? 1 : 0); t.seats[w].stack += amt; t.seats[w].won += amt; }
      const label = pots.length > 1 ? (idx === 0 ? 'main pot' : `side pot ${idx}`) : 'pot';
      results.push({ amount: pot.amount, winners, desc: describe(best), label, best: winners.map((w) => bestFive(t.seats[w].hole.concat(t.board))) });
      t.log.push({ e: 'win', seats: winners, amount: pot.amount, pot: label, desc: describe(best) });
    });
    t.results = { pots: results, uncontested: false };
    finishHand(t);
  }
  // A mucked hand gives up its claim to the pot, unless it is the only hand left for that pot
  function s_shownOrOnly(t, i, eligible) {
    const s = t.seats[i];
    if (s.shown) return true;
    return !eligible.some((j) => t.seats[j].shown);
  }

  function finishHand(t) {
    t.street = 'done'; t.toAct = -1;
    for (const s of t.seats) { s.total = 0; s.bet = 0; }
    for (let i = 0; i < n(t); i++) {
      const s = t.seats[i];
      if (!s.out && s.stack === 0) { s.out = true; s.last = 'Out of chips'; t.log.push({ e: 'bust', seat: i }); }
    }
    const live = alive(t);
    if (live.length < 2) { t.over = true; t.winner = live[0] ?? -1; }
  }

  // A copy for one viewer: other players' cards are hidden unless shown at showdown
  function viewFor(t, seat) {
    const v = JSON.parse(JSON.stringify(t));
    v.deck = [];
    v.seats.forEach((s, i) => { if (i !== seat && !s.shown) s.hole = s.hole.map(() => -1); });
    return v;
  }

  root.River = {
    RANK_CH, SUIT_CH, CAT_NAME, rankOf, suitOf, cardCode, parseCard,
    evaluate, category, describe, bestFive, equity, buildPots, shuffledDeck,
    createTable, startHand, legal, act, viewFor, potTotal, inHand, alive, canAct, nextSeat
  };
  return root.River;
}
(function (g) {
  const R = RiverRulesFactory(g);
  g.RiverRulesFactory = RiverRulesFactory;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
