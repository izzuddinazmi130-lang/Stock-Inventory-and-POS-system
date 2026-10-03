// Download QR labels as PNG / JPG images or as an A4 PDF, without extra libraries.
//
// The label is drawn on a canvas at print resolution, matching the printed label (70 × 36 mm: QR on the left,
// name, variant line, SKU and price on the right, dashed cut line). PNG/JPG give one label; the PDF lays out
// `copies` labels on A4 pages exactly like the print sheet (8 mm margin, 4 mm gaps, 2 × 7 per page).
//
// Colours here are literal black/greys on white on purpose: like the print styles, the output is for paper.

const MM_PER_INCH = 25.4;
export const LABEL_MM = { w: 70, h: 36 };
const PAD_MM = 2.5;
const QR_MM = 30;
const GAP_MM = 2.5;

const px = (mm, dpi) => Math.round((mm / MM_PER_INCH) * dpi);
const pt = (points, dpi) => (points / 72) * dpi;

function loadSvgImage(svg, size) {
  // Give the SVG an explicit size so it rasterises square and sharp at the target resolution
  const sized = svg.replace(/<svg\b([^>]*)>/i, (m, attrs) => {
    const cleaned = attrs.replace(/\s(width|height)="[^"]*"/gi, '');
    return `<svg${cleaned} width="${size}" height="${size}">`;
  });
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not draw the QR code.')); };
    img.src = url;
  });
}

// Fit text into maxWidth, adding an ellipsis; returns up to `maxLines` lines
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxWidth) { line = next; continue; }
    if (line) lines.push(line);
    line = words[i];
    if (lines.length === maxLines) { line = ''; break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const usedAll = lines.join(' ').split(/\s+/).filter(Boolean).length === words.length;
  if (!usedAll && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines.map(l => {
    if (ctx.measureText(l).width <= maxWidth) return l;
    let s = l;
    while (s && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
    return `${s}…`;
  });
}

/** Draw one label and return the canvas. `label` = { name, variants, sku, price } (price may be null). */
export async function renderLabel({ qrSvg, label, dpi = 300, cutLine = true }) {
  if (document.fonts?.ready) await document.fonts.ready;
  const W = px(LABEL_MM.w, dpi), H = px(LABEL_MM.h, dpi);
  const pad = px(PAD_MM, dpi), qr = px(QR_MM, dpi), gap = px(GAP_MM, dpi);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (cutLine) {
    const lw = Math.max(1, px(0.3, dpi));
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = lw;
    ctx.setLineDash([px(1.2, dpi), px(0.8, dpi)]);
    const r = px(2, dpi), o = lw / 2;
    ctx.beginPath();
    ctx.roundRect(o, o, W - lw, H - lw, r);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const qrTop = Math.round((H - qr) / 2);
  const img = await loadSvgImage(qrSvg, qr);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, pad, qrTop, qr, qr);
  ctx.imageSmoothingEnabled = true;

  const x = pad + qr + gap;
  const maxW = W - x - pad;
  const font = (weight, size, family = "Inter, system-ui, sans-serif") => `${weight} ${pt(size, dpi)}px ${family}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';

  let y = qrTop;
  ctx.font = font(700, 9);
  const nameLH = pt(9, dpi) * 1.2;
  wrapLines(ctx, label.name, maxW, 2).forEach(line => { ctx.fillText(line, x, y); y += nameLH; });
  y += px(1, dpi);

  if (label.variants) {
    ctx.font = font(400, 7.5);
    ctx.fillStyle = '#333333';
    ctx.fillText(wrapLines(ctx, label.variants, maxW, 1)[0] || '', x, y);
    y += pt(7.5, dpi) * 1.3 + px(1, dpi);
  }

  ctx.font = font(400, 7.5, 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace');
  ctx.fillStyle = '#000000';
  ctx.fillText(wrapLines(ctx, label.sku, maxW, 1)[0] || '', x, y);

  if (label.price) {
    ctx.font = font(800, 12);
    ctx.textBaseline = 'bottom';
    ctx.fillText(label.price, x, qrTop + qr);
  }
  return canvas;
}

const canvasBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image.'))), type, quality);
});

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One label as a PNG or JPG image (300 dpi). */
export async function labelImage({ qrSvg, label, format = 'png' }) {
  const canvas = await renderLabel({ qrSvg, label });
  return format === 'jpg'
    ? canvasBlob(canvas, 'image/jpeg', 0.95)
    : canvasBlob(canvas, 'image/png');
}

/** `copies` labels on A4 pages, same layout as the print sheet. */
export async function labelsPdf({ qrSvg, label, copies }) {
  const canvas = await renderLabel({ qrSvg, label });
  const jpeg = new Uint8Array(await (await canvasBlob(canvas, 'image/jpeg', 0.95)).arrayBuffer());

  const A4 = { w: 595.28, h: 841.89 };            // points
  const mmPt = (mm) => (mm / MM_PER_INCH) * 72;
  const margin = mmPt(8), gapPt = mmPt(4);
  const lw = mmPt(LABEL_MM.w), lh = mmPt(LABEL_MM.h);
  const cols = Math.max(1, Math.floor((A4.w - 2 * margin + gapPt) / (lw + gapPt)));
  const rows = Math.max(1, Math.floor((A4.h - 2 * margin + gapPt) / (lh + gapPt)));
  const perPage = cols * rows;
  const pageCount = Math.max(1, Math.ceil(copies / perPage));

  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => { const bytes = typeof data === 'string' ? enc.encode(data) : data; chunks.push(bytes); length += bytes.length; };
  const startObj = (n) => { offsets[n] = length; push(`${n} 0 obj\n`); };

  // Object numbers: 1 catalog, 2 pages, 3 image, then (page, content) pairs
  const pageObj = (i) => 4 + i * 2;
  const contentObj = (i) => 5 + i * 2;
  const totalObjs = 3 + pageCount * 2;

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  startObj(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2);
  push(`<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>\nendobj\n`);
  startObj(3);
  push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push('\nendstream\nendobj\n');

  for (let p = 0; p < pageCount; p++) {
    const onPage = Math.min(perPage, copies - p * perPage);
    let ops = '';
    for (let k = 0; k < onPage; k++) {
      const c = k % cols, r = Math.floor(k / cols);
      const x = margin + c * (lw + gapPt);
      const y = A4.h - margin - lh - r * (lh + gapPt);   // PDF origin is bottom-left
      ops += `q ${lw.toFixed(2)} 0 0 ${lh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q\n`;
    }
    startObj(pageObj(p));
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Im1 3 0 R >> >> /Contents ${contentObj(p)} 0 R >>\nendobj\n`);
    startObj(contentObj(p));
    push(`<< /Length ${enc.encode(ops).length} >>\nstream\n${ops}endstream\nendobj\n`);
  }

  const xref = length;
  let table = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= totalObjs; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}
