// Pixel-art icons drawn as inline SVG from character maps. No binary assets.

const SVG_NS = 'http://www.w3.org/2000/svg';

export type Palette = Record<string, string>;

/** Build a crisp SVG from rows of characters; '.' is transparent. */
export function pixelArt(rows: string[], palette: Palette, scale = 4, label?: string): SVGSVGElement {
  const w = Math.max(...rows.map((r) => r.length));
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${rows.length}`);
  svg.setAttribute('width', String(w * scale));
  svg.setAttribute('height', String(rows.length * scale));
  svg.setAttribute('shape-rendering', 'crispEdges');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = palette[ch];
      if (!fill) return;
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', '1');
      r.setAttribute('height', '1');
      r.setAttribute('fill', fill);
      svg.append(r);
    });
  });
  return svg;
}

export const FEDORA = [
  '....wwwwww....',
  '...wwwsswww...',
  '..wwwwwwwwww..',
  '..rrrrrrrrrr..',
  'wwwwwwwwwwwwww',
  '.wwwwwwwwwwww.',
];

export const HAT_PALETTE: Palette = { w: '#F8F9FA', s: '#ADB5BD', r: '#E63946' };

// ---------- role icons (10×10) ----------
const P: Palette = {
  // w off-white, r crimson, b teal (town), d ash, k dark slate, p light ash, y light teal
  w: '#F8F9FA', r: '#E63946', b: '#2EC4B6', d: '#6C757D', k: '#3A3F48', p: '#ADB5BD', y: '#7FE0D6',
};

const ICONS: Record<string, string[]> = {
  mafia: [
    '..........',
    '...wwww...',
    '..wwppww..',
    '..wwwwww..',
    '..rrrrrr..',
    'wwwwwwwwww',
    '.wwwwwwww.',
    '..........',
    '..........',
    '..........',
  ],
  villager: [
    '....bb....',
    '...bbbb...',
    '..bbbbbb..',
    '.bbbbbbbb.',
    'bbbbbbbbbb',
    '.wwwwwwww.',
    '.wwpwwddw.',
    '.wwwwwddw.',
    '.wwwwwddw.',
    '.wwwwwddw.',
  ],
  sheriff: [
    '....yy....',
    '....yy....',
    '...yyyy...',
    'yyyyyyyyyy',
    '.yyywwyyy.',
    '..yywwyy..',
    '..yyyyyy..',
    '.yyy..yyy.',
    '.yy....yy.',
    '..........',
  ],
  doctor: [
    '..........',
    '...wwww...',
    '...wrrw...',
    '.wwwrrwww.',
    '.wrrrrrrw.',
    '.wrrrrrrw.',
    '.wwwrrwww.',
    '...wrrw...',
    '...wwww...',
    '..........',
  ],
  maniac: [
    '........ww',
    '.......www',
    '......www.',
    '.....www..',
    '....www...',
    '.d.www....',
    '..ddw.....',
    '..dd......',
    '.dd.d.....',
    'dd........',
  ],
  kamikaze: [
    '.......y..',
    '......y.y.',
    '.....pp...',
    '....pp....',
    '..kkkkkk..',
    '.kkkkkkkk.',
    '.kwkkkkkk.',
    '.kwkkkkkk.',
    '.kkkkkkkk.',
    '..kkkkkk..',
  ],
  police: [
    '.bbbbbbbb.',
    '.bwwwwwwb.',
    '.bwwyywwb.',
    '.bwyyyywb.',
    '.bwwyywwb.',
    '.bwwwwwwb.',
    '..bwwwwb..',
    '...bwwb...',
    '....bb....',
    '..........',
  ],
  custom: [
    '...wwww...',
    '..ww..ww..',
    '......ww..',
    '.....ww...',
    '....ww....',
    '....ww....',
    '..........',
    '....ww....',
    '....ww....',
    '..........',
  ],
};

/** Pixel icon for a role: its own drawing for default roles, a "?" for custom ones. */
export function roleIcon(roleId: string, scale = 6): SVGSVGElement {
  return pixelArt(ICONS[roleId] ?? ICONS.custom!, P, scale);
}
