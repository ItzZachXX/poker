/*
 * River - computer players and the coach.
 * Both use the same analysis: win chance by simulation, pot odds, draws and outs.
 */
function RiverBrainFactory(root) {
  'use strict';
  const R = root.River;
  const { rankOf, suitOf, evaluate, category, describe, equity } = R;

  const LEVELS = {
    easy: { sims: 160, think: [600, 1100], loose: 0.35, aggr: 0.2, bluff: 0.04, skill: 0.4 },
    normal: { sims: 320, think: [700, 1300], loose: 0.15, aggr: 0.45, bluff: 0.08, skill: 0.7 },
    hard: { sims: 600, think: [700, 1400], loose: 0.05, aggr: 0.65, bluff: 0.12, skill: 0.9 },
    expert: { sims: 1000, think: [800, 1600], loose: 0, aggr: 0.75, bluff: 0.15, skill: 1 }
  };

  // Flush and straight draws that use at least one hole card
  function draws(hole, board) {
    const all = hole.concat(board);
    const out = { flush: false, oesd: false, gutshot: false };
    if (board.length < 3 || board.length > 4) return out;
    for (let s = 0; s < 4; s++) {
      const n = all.filter((c) => suitOf(c) === s).length;
      if (n === 4 && hole.some((c) => suitOf(c) === s)) out.flush = true;
    }
    const straightWith = (cards, r) => {
      const rs = cards.map(rankOf).concat(r);
      const set = new Set(rs); if (set.has(14)) set.add(1);
      for (let h = 14; h >= 5; h--) { let ok = true; for (let k = 0; k < 5; k++) if (!set.has(h - k)) { ok = false; break; } if (ok) return true; }
      return false;
    };
    if (!straightWith(all, 0)) {
      let completing = 0;
      for (let r = 2; r <= 14; r++) if (straightWith(all, r) && !straightWith(board, r)) completing++;
      if (completing >= 2) out.oesd = true; else if (completing === 1) out.gutshot = true;
    }
    if (out.oesd) out.gutshot = false;
    return out;
  }

  // Cards that would lift the hand to a stronger category using your own cards
  function outs(hole, board) {
    if (board.length < 3 || board.length > 4) return 0;
    const all = hole.concat(board);
    const now = category(evaluate(all));
    const known = new Set(all);
    let count = 0;
    for (let c = 0; c < 52; c++) {
      if (known.has(c)) continue;
      const cat = category(evaluate(all.concat(c)));
      if (cat > now && cat >= 2) {
        const boardOnly = board.length + 1 >= 5 ? category(evaluate(board.concat(c))) : -1;
        if (boardOnly < cat) count++;
      }
    }
    return count;
  }

  function analyze(t, seat, sims) {
    const s = t.seats[seat];
    const opps = t.seats.filter((o, j) => j !== seat && !o.out && !o.folded).length;
    const toCall = Math.max(0, t.currentBet - s.bet);
    const pot = R.potTotal(t);
    const eq = equity(s.hole, t.board, Math.max(1, opps), sims || 600);
    const made = t.board.length ? evaluate(s.hole.concat(t.board)) : null;
    const pos = (() => {
      const active = t.seats.map((o, j) => (!o.out && !o.folded ? j : -1)).filter((j) => j >= 0);
      const order = active.map((j) => (j - t.button + t.seats.length - 1) % t.seats.length).sort((a, b) => a - b);
      const mine = (seat - t.button + t.seats.length - 1) % t.seats.length;
      return order.indexOf(mine) / Math.max(1, order.length - 1); // 0 = acts first, 1 = acts last
    })();
    return {
      equity: eq,
      opps,
      toCall,
      pot,
      potOdds: toCall > 0 ? toCall / (pot + toCall) : 0,
      made,
      handDesc: made != null ? describe(made) : preflopName(s.hole),
      cat: made != null ? category(made) : -1,
      draws: draws(s.hole, t.board),
      outs: outs(s.hole, t.board),
      position: pos,
      spr: pot > 0 ? s.stack / pot : 99,
      stack: s.stack,
      street: t.street
    };
  }

  function preflopName(hole) {
    const [a, b] = hole.map(rankOf).sort((x, y) => y - x);
    const ch = (r) => R.RANK_CH[r - 2].replace('T', '10');
    if (a === b) return `Pocket ${ch(a)}s`;
    return `${ch(a)}-${ch(b)} ${suitOf(hole[0]) === suitOf(hole[1]) ? 'suited' : 'offsuit'}`;
  }

  const roundChips = (v, bb) => { const step = bb >= 100 ? 10 : 5; return Math.max(step, Math.round(v / step) * step); };

  function sizeTo(t, L, fraction) {
    const pot = R.potTotal(t);
    const want = t.currentBet + fraction * (pot + (L.toCall || 0));
    return Math.max(L.raise.min, Math.min(L.raise.max, roundChips(want, t.bb)));
  }

  // A computer player's decision
  function decide(t, seat, levelId, persona) {
    const lv = LEVELS[levelId] || LEVELS.normal;
    const p = persona || { aggr: 0, loose: 0 };
    const L = R.legal(t, seat);
    if (!L) return null;
    const A = analyze(t, seat, lv.sims);
    const r = Math.random();
    const aggr = Math.min(1, lv.aggr + p.aggr);
    const loose = Math.max(0, lv.loose + p.loose);
    const base = 1 / (A.opps + 1);
    // Weaker players misjudge their hand a little
    const eq = A.equity + (Math.random() - 0.5) * (1 - lv.skill) * 0.25;
    const strong = Math.min(0.72, base * 2.1) - aggr * 0.05;
    const drawing = (A.draws.flush || A.draws.oesd) && t.board.length < 5;

    if (L.raise) {
      if (eq > 0.85 && r < 0.2 + aggr * 0.3 && A.spr < 3) return { type: 'raise', to: L.raise.max };
      if (eq > strong && r < 0.55 + aggr * 0.4) return { type: 'raise', to: sizeTo(t, L, 0.5 + Math.random() * 0.5 + (eq > 0.8 ? 0.3 : 0)) };
      if (L.check && drawing && lv.skill >= 0.9 && r < 0.35 + aggr * 0.2) return { type: 'raise', to: sizeTo(t, L, 0.55) };
      if (L.check && A.position > 0.6 && r < lv.bluff + aggr * 0.08) return { type: 'raise', to: sizeTo(t, L, 0.45) };
      if (!L.check && drawing && lv.skill >= 0.9 && r < 0.12 * aggr && A.spr > 2) return { type: 'raise', to: sizeTo(t, L, 0.7) };
    }
    if (L.check) return { type: 'check' };
    // Before the flop, cheap calls with playable hands are fine: most of the money goes in later
    if (t.street === 'preflop' && L.toCall <= 3 * t.bb && eq > base * (0.95 - loose)) return { type: 'call' };
    const needed = A.potOdds;
    // Implied odds for draws on the flop and turn
    const implied = drawing ? 0.06 + (A.spr > 3 ? 0.04 : 0) : 0;
    if (eq + implied + loose * 0.12 > needed + 0.03) return { type: 'call' };
    if (L.toCall <= t.bb && r < 0.2 + loose) return { type: 'call' };
    return { type: 'fold' };
  }

  function thinkTime(levelId) {
    const lv = LEVELS[levelId] || LEVELS.normal;
    return lv.think[0] + Math.random() * (lv.think[1] - lv.think[0]);
  }

  // Advice for a human player, with plain-language reasons
  function advise(t, seat) {
    const L = R.legal(t, seat);
    if (!L) return null;
    const A = analyze(t, seat, 1500);
    const pct = (x) => Math.round(x * 100) + '%';
    const reasons = [];
    let action, label, to = null;
    const base = 1 / (A.opps + 1);
    const strong = Math.min(0.7, base * 2);
    if (A.equity > strong && L.raise) {
      to = sizeTo(t, L, A.equity > 0.8 ? 0.85 : 0.6);
      action = 'raise'; label = `${L.raise.bet ? 'Bet' : 'Raise to'} ${to.toLocaleString()}`;
      reasons.push(`Strong hand: you win about ${pct(A.equity)} of the time against ${A.opps} ${A.opps === 1 ? 'opponent' : 'opponents'}`);
      reasons.push('Betting builds the pot while you are ahead');
    } else if (L.check) {
      const drawing = (A.draws.flush || A.draws.oesd) && t.board.length < 5;
      if (drawing && L.raise && A.position > 0.5) {
        to = sizeTo(t, L, 0.5); action = 'raise'; label = `Bet ${to.toLocaleString()}`;
        reasons.push('Semi-bluff: you can win now, or improve with your draw');
      } else {
        action = 'check'; label = 'Check';
        reasons.push(A.equity > base ? 'Decent hand, but not strong enough to build a big pot' : 'Checking is free, so there is no reason to fold');
      }
    } else {
      const drawing = (A.draws.flush || A.draws.oesd) && t.board.length < 5;
      const implied = drawing ? 0.05 : 0;
      if (t.street === 'preflop' && L.toCall <= 3 * t.bb && A.equity >= base) {
        action = 'call'; label = `Call ${L.call.toLocaleString()}`;
        reasons.push(`Playable hand: about ${pct(A.equity)} to win against ${A.opps} ${A.opps === 1 ? 'opponent' : 'opponents'}, and the price to see the flop is small`);
      } else if (A.equity + implied >= A.potOdds) {
        action = 'call'; label = `Call ${L.call.toLocaleString()}`;
        reasons.push(`You need to win ${pct(A.potOdds)} of the time to call, and you win about ${pct(A.equity)}`);
        if (drawing && A.equity < A.potOdds) reasons.push('Your draw can win extra chips later (implied odds)');
      } else {
        action = 'fold'; label = 'Fold';
        reasons.push(`Calling needs a ${pct(A.potOdds)} chance to win, but you win only about ${pct(A.equity)}`);
      }
    }
    if (A.draws.flush) reasons.push('Flush draw: one more card of your suit makes a flush');
    if (A.draws.oesd) reasons.push('Open-ended straight draw');
    else if (A.draws.gutshot) reasons.push('Inside straight draw');
    if (A.outs && t.board.length < 5) reasons.push(`${A.outs} outs improve your hand`);
    if (A.position > 0.7 && A.opps > 0) reasons.push('Good position: you act after most players');
    return { action, label, to, reasons, analysis: A };
  }

  root.RiverBrain = { LEVELS, analyze, decide, advise, thinkTime, draws, outs, preflopName };
  return root.RiverBrain;
}
(function (g) {
  const B = RiverBrainFactory(g);
  g.RiverBrainFactory = RiverBrainFactory;
  if (typeof module !== 'undefined' && module.exports) module.exports = B;
})(typeof globalThis !== 'undefined' ? globalThis : this);
