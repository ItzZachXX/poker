/* River - original SVG playing cards, chips and UI icons (no external assets needed). */
(function (root) {
  'use strict';

  const SUIT_PATHS = {
    s: 'M50 6 C38 27 12 40 12 61 C12 75 25 83 37 79 C41 78 44 75 46.5 72 C45.5 81 41.5 89 33 95 H67 C58.5 89 54.5 81 53.5 72 C56 75 59 78 63 79 C75 83 88 75 88 61 C88 40 62 27 50 6 Z',
    h: 'M50 92 C25 73 7 57 7 36 C7 21 18 10 32 10 C40 10 46.5 15 50 22 C53.5 15 60 10 68 10 C82 10 93 21 93 36 C93 57 75 73 50 92 Z',
    d: 'M50 4 Q65 29 89 50 Q65 71 50 96 Q35 71 11 50 Q35 29 50 4 Z',
    c: 'M50 8 a19 19 0 0 1 16.5 28.4 a19 19 0 1 1 -3 30 C64 77 60 87 67 95 H33 C40 87 36 77 36.5 66.4 a19 19 0 1 1 -3 -30 A19 19 0 0 1 50 8 Z'
  };
  const SUIT_NAME = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
  const RANK_NAME = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: '10' };

  function suitColor(s, four) {
    if (s === 'h') return '#d4343f';
    if (s === 'd') return four ? '#2563d1' : '#d4343f';
    if (s === 'c') return four ? '#1a8a4a' : '#1b1e26';
    return '#1b1e26';
  }

  function suitSVG(s, x, y, size, color, flip) {
    const k = size / 100;
    return `<path d="${SUIT_PATHS[s]}" fill="${color}" transform="translate(${x - size / 2} ${y - size / 2}) scale(${k})${flip ? ` rotate(180 50 50)` : ''}"/>`;
  }

  const L = 82, C = 125, Rr = 168;
  const PIPS = {
    2: [[C, 78], [C, 272, 1]],
    3: [[C, 78], [C, 175], [C, 272, 1]],
    4: [[L, 78], [Rr, 78], [L, 272, 1], [Rr, 272, 1]],
    5: [[L, 78], [Rr, 78], [C, 175], [L, 272, 1], [Rr, 272, 1]],
    6: [[L, 78], [Rr, 78], [L, 175], [Rr, 175], [L, 272, 1], [Rr, 272, 1]],
    7: [[L, 78], [Rr, 78], [C, 126], [L, 175], [Rr, 175], [L, 272, 1], [Rr, 272, 1]],
    8: [[L, 78], [Rr, 78], [C, 126], [L, 175], [Rr, 175], [C, 224, 1], [L, 272, 1], [Rr, 272, 1]],
    9: [[L, 78], [Rr, 78], [L, 143], [Rr, 143], [C, 175], [L, 207, 1], [Rr, 207, 1], [L, 272, 1], [Rr, 272, 1]],
    10: [[L, 78], [Rr, 78], [C, 110], [L, 143], [Rr, 143], [L, 207, 1], [Rr, 207, 1], [C, 240, 1], [L, 272, 1], [Rr, 272, 1]]
  };

  // Emblems for the court cards (original designs)
  const EMBLEM = {
    J: '<path d="M-26 -30 H26 V6 C26 26 0 38 0 38 C0 38 -26 26 -26 6 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M0 -18 V22 M-14 2 H14" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    Q: '<path d="M-32 18 L-36 -16 L-16 0 L0 -26 L16 0 L36 -16 L32 18 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><circle cx="0" cy="-34" r="6" fill="currentColor"/><path d="M-30 30 H30" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    K: '<path d="M-34 22 L-38 -20 L-18 -2 L0 -32 L18 -2 L38 -20 L34 22 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M-34 34 H34" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="-38" cy="-24" r="5" fill="currentColor"/><circle cx="0" cy="-37" r="5" fill="currentColor"/><circle cx="38" cy="-24" r="5" fill="currentColor"/>'
  };

  const cache = {};
  // code like 'As', 'Td', 'Kh'. Pass four = true for a four-colour deck.
  function cardSVG(code, four) {
    const key = code + (four ? '4' : '');
    if (cache[key]) return cache[key];
    const r = code[0], s = code[1];
    const col = suitColor(s, four);
    const label = r === 'T' ? '10' : r;
    const corner = `<text x="26" y="52" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="${label === '10' ? 40 : 46}" letter-spacing="${label === '10' ? -3 : 0}" text-anchor="middle" fill="${col}">${label}</text>${suitSVG(s, 26, 76, 30, col)}`;
    let center = '';
    if (r === 'A') center = suitSVG(s, 125, 175, s === 's' ? 130 : 110, col);
    else if (EMBLEM[r]) {
      center = `<rect x="56" y="62" width="138" height="226" rx="12" fill="${col}" fill-opacity=".08" stroke="${col}" stroke-opacity=".5" stroke-width="3"/>
        <g transform="translate(125 150)" color="${col}">${EMBLEM[r]}</g>
        <text x="125" y="276" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="58" text-anchor="middle" fill="${col}">${r}</text>
        ${suitSVG(s, 125, 207, 30, col)}`;
    } else {
      const n = r === 'T' ? 10 : +r;
      center = PIPS[n].map(([x, y, f]) => suitSVG(s, x, y, 46, col, !!f)).join('');
    }
    const svg = `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${RANK_NAME[r] || r} of ${SUIT_NAME[s]}">
      <rect x="2" y="2" width="246" height="346" rx="20" fill="#ffffff" stroke="#d6d9df" stroke-width="3"/>
      ${corner}<g transform="rotate(180 125 175)">${corner}</g>${center}</svg>`;
    cache[key] = svg;
    return svg;
  }

  const BACKS = {
    violet: ['#5b3fc4', '#8b6ff0'],
    crimson: ['#8f1d2c', '#d1485a'],
    navy: ['#173a6b', '#3f7bd1'],
    onyx: ['#1c1f26', '#5b6170']
  };
  function backSVG(style) {
    const key = 'back-' + style;
    if (cache[key]) return cache[key];
    const [a, b] = BACKS[style] || BACKS.violet;
    const svg = `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><pattern id="bp-${style}" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="28" height="28" fill="${a}"/><path d="M0 14 H28 M14 0 V28" stroke="${b}" stroke-width="2" opacity=".55"/></pattern></defs>
      <rect x="2" y="2" width="246" height="346" rx="20" fill="#ffffff" stroke="#d6d9df" stroke-width="3"/>
      <rect x="16" y="16" width="218" height="318" rx="12" fill="url(#bp-${style})"/>
      <rect x="16" y="16" width="218" height="318" rx="12" fill="none" stroke="${b}" stroke-width="3"/>
      <circle cx="125" cy="175" r="44" fill="${a}" stroke="#ffffff" stroke-width="5"/>
      <circle cx="125" cy="175" r="34" fill="none" stroke="${b}" stroke-width="7" stroke-dasharray="13.35 13.35"/>
      ${suitSVG('s', 125, 175, 34, '#ffffff')}</svg>`;
    cache[key] = svg;
    return svg;
  }

  const CHIP_COLORS = [[1000, '#1c1f26', '#f5c542'], [500, '#6b3fd4', '#ffffff'], [100, '#1c1f26', '#ffffff'], [25, '#178a4a', '#ffffff'], [5, '#c8303d', '#ffffff'], [1, '#e8e8ec', '#3a3f4b']];
  function chipSVG(amount) {
    const [, fill, edge] = CHIP_COLORS.find(([v]) => amount >= v) || CHIP_COLORS[CHIP_COLORS.length - 1];
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
      <circle cx="20" cy="20" r="14" fill="none" stroke="${edge}" stroke-width="4" stroke-dasharray="5.5 5.5"/><circle cx="20" cy="20" r="8.5" fill="${fill}" stroke="${edge}" stroke-width="1.5"/></svg>`;
  }

  const ICON_PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    flip: '<path d="M7 4v16"/><path d="m3 8 4-4 4 4"/><path d="M17 20V4"/><path d="m21 16-4 4-4-4"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    flag: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
    draw: '<path d="M5 12h14"/><path d="M5 7h14"/><path d="M5 17h14"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
    first: '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
    prev: '<path d="m15 18-6-6 6-6"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    last: '<path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    play: '<path d="m6 3 14 9-14 9z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    chip: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    cards: '<rect x="3" y="5" width="11" height="15" rx="2" transform="rotate(-10 8.5 12.5)"/><rect x="10" y="4" width="11" height="15" rx="2"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
  };

  function icon(name, size) {
    const s = size || 18;
    return `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
  }

  root.RiverArt = { cardSVG, backSVG, chipSVG, suitSVG, icon, BACKS, SUIT_PATHS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
