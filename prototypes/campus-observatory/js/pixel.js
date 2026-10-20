// Original pixel-art sprites, drawn from character grids into crisp SVG. One character = one pixel.
// Colours: fixed hex, or classes that follow the marker's category colour (--mc) so one sprite serves all three.
const PAL = {
  k: '#1b1640', p: '#6b4fd8', P: '#9b7bff', g: '#f6c94f', G: '#c7922c', s: '#fff0a8', w: '#ffffff', y: '#ffe36e', o: '#ffb238',
  c: 'var(--mc)', C: 'color-mix(in srgb,var(--mc) 55%,white)', d: 'color-mix(in srgb,var(--mc) 60%,black)', i: 'currentColor',
};
const SPRITES = {
  hat: [
    '......kk....',
    '.....kPk....',
    '.....kPpk...',
    '....kPppk...',
    '....kpspk...',
    '...kPpppk...',
    '...kPppppk..',
    '..kggggggk..',
    '.kPpppppppk.',
    'kkkkkkkkkkkk',
  ],
  star: [
    '...y...',
    '..yoy..',
    'yyyyyyy',
    '.yyoyy.',
    '..y.y..',
    '.y...y.',
  ],
  gem: [
    '....k....',
    '...kwk...',
    '..kwCck..',
    '.kwCccdk.',
    'kwCcccddk',
    'kCcccccdk',
    'kCccccddk',
    '.kCccddk.',
    '..kCcdk..',
    '...kdk...',
    '....k....',
  ],
  block: [
    '...iiii...',
    '.ii....ii.',
    'i..iiii..i',
    'i.i....i.i',
    'i..iiii..i',
    'i...ii...i',
    'i...ii...i',
    'i...ii...i',
    '.ii.ii.ii.',
    '...iiii...',
  ],
  frame: [
    'iii....iii',
    'i........i',
    'i........i',
    '..........',
    '....ii....',
    '....ii....',
    '..........',
    'i........i',
    'i........i',
    'iii....iii',
  ],
  peak: [
    '....i.....',
    '...iii....',
    '...i.ii...',
    '..i...i.i.',
    '..i....iii',
    '.i......ii',
    '.i.......i',
    'iiiiiiiiii',
  ],
  scroll: [
    '.iiiiiiii.',
    'i.i......i',
    '.ii.iiii.i',
    '..i......i',
    '..i.iiii.i',
    '..i......i',
    '..i.iii..i',
    '..i......i',
    '..iiiiiii.',
  ],
  pin: [
    '..iiii..',
    '.i....i.',
    'i..ii..i',
    'i..ii..i',
    '.i....i.',
    '.i....i.',
    '..i..i..',
    '...ii...',
  ],
  shield: [
    'iiiiiiii',
    'i......i',
    'i..ii..i',
    'i.iiii.i',
    'i..ii..i',
    '.i....i.',
    '..i..i..',
    '...ii...',
  ],
  stairs: [
    '........ii',
    '........ii',
    '......iiii',
    '......iiii',
    '....iiiiii',
    '....iiiiii',
    '..iiiiiiii',
    '..iiiiiiii',
    'iiiiiiiiii',
    'iiiiiiiiii',
  ],
};

/** An SVG string for sprite `name`, each pixel drawn `scale` CSS pixels wide. Runs of one colour share a rect. */
export function px(name, scale = 2) {
  const rows = SPRITES[name];
  if (!rows) return '';
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      let n = 1;
      while (row[x + n] === ch) n++;
      if (ch !== '.' && PAL[ch]) rects += `<rect x="${x}" y="${y}" width="${n}" height="1" style="fill:${PAL[ch]}"/>`;
      x += n;
    }
  });
  return `<svg class="px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" aria-hidden="true" focusable="false">${rects}</svg>`;
}

/** Fill every element carrying data-px="name" with its sprite. */
export function paintSprites(root = document) {
  root.querySelectorAll('[data-px]').forEach(el => { el.innerHTML = px(el.dataset.px, +el.dataset.scale || 2); });
}
