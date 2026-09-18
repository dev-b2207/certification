/* eslint-disable */
/**
 * Generates the visual's gallery icon and the AppSource store logo.
 *
 * Deliberately an abstract filter-panel mark, not a Darwinbox brand mark: the real
 * wordmark should come from the design team. Both sizes share one motif so the store
 * tile and the field-well icon read as the same product.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ASSETS = path.join(__dirname, '..', 'src2', 'multiSlicerDarwinbox', 'assets');
const STORE = path.join(__dirname, '..', 'appsource');
fs.mkdirSync(STORE, { recursive: true });

/** size: rendered px. detail: draw the checkbox squares (only legible when large). */
function markup(size, detail) {
  const s = size;
  const r = Math.round(s * 0.22);
  const barH = Math.round(s * 0.085);
  const barR = barH / 2;
  const left = Math.round(s * 0.2);
  const widths = [0.6, 0.44, 0.28].map((w) => Math.round(s * w));
  const tops = [0.28, 0.455, 0.63].map((t) => Math.round(s * t));
  const boxSize = Math.round(s * 0.085);

  const bars = widths
    .map((w, i) => {
      const y = tops[i];
      const bar = `<rect x="${left + (detail ? boxSize + s * 0.055 : 0)}" y="${y}" width="${
        detail ? w - boxSize - s * 0.055 : w
      }" height="${barH}" rx="${barR}" fill="${i === 0 ? '#FFFFFF' : 'rgba(255,255,255,0.72)'}"/>`;
      if (!detail) return bar;
      const boxY = y + barH / 2 - boxSize / 2;
      const checked = i === 0;
      const box = checked
        ? `<rect x="${left}" y="${boxY}" width="${boxSize}" height="${boxSize}" rx="${Math.round(boxSize * 0.22)}" fill="#F2B138"/>
           <path d="M${left + boxSize * 0.24},${boxY + boxSize * 0.52} L${left + boxSize * 0.43},${boxY + boxSize * 0.72} L${
            left + boxSize * 0.78
          },${boxY + boxSize * 0.28}" fill="none" stroke="#12386B" stroke-width="${Math.max(
            1.5,
            boxSize * 0.16
          )}" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<rect x="${left}" y="${boxY}" width="${boxSize}" height="${boxSize}" rx="${Math.round(
            boxSize * 0.22
          )}" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="${Math.max(1.4, boxSize * 0.13)}"/>`;
      return box + bar;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1B4E92"/><stop offset="1" stop-color="#0F2F5C"/>
      </linearGradient>
    </defs>
    <rect width="${s}" height="${s}" rx="${r}" fill="url(#g)"/>
    ${bars}
  </svg>`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  const targets = [
    { file: path.join(ASSETS, 'icon.png'), size: 20, render: 240, detail: false, label: 'visual gallery icon' },
    { file: path.join(STORE, 'logo-300x300.png'), size: 300, render: 600, detail: true, label: 'AppSource store logo' },
  ];

  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.render, height: t.render }, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${markup(t.render, t.detail)}</body></html>`
    );
    const tmp = t.file + '.tmp.png';
    await page.screenshot({ path: tmp, omitBackground: true, clip: { x: 0, y: 0, width: t.render, height: t.render } });
    await page.close();

    // Downsample to the exact required size with a good filter.
    const { execSync } = require('child_process');
    execSync(
      `python3 -c "from PIL import Image; im=Image.open('${tmp}').convert('RGBA'); im=im.resize((${t.size},${t.size}), Image.LANCZOS); im.save('${t.file}')"`
    );
    fs.unlinkSync(tmp);
    const { size } = fs.statSync(t.file);
    console.log(`  ${path.basename(t.file).padEnd(20)} ${t.size}x${t.size}  ${Math.round(size / 1024)} KB  (${t.label})`);
  }

  await browser.close();
})();
