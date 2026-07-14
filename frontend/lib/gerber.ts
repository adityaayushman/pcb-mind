// Renders a single Gerber layer file into a raster PNG in the browser, so a
// board's design file can seed a golden reference without photographing a
// physical board. Kept entirely client-side (renders to SVG, rasterizes via
// canvas) so nothing new is needed on the backend — the result is just an
// image the existing golden-PCB flow already understands.
import gerberToSvg from "gerber-to-svg";

// PCB-ish look: copper artwork on a soldermask-green ground, so the render
// reads as a board both in the UI and to the defect model's eye.
const BOARD_BG = "#0c3b2b";
const COPPER = "#d7a869";
const TARGET_WIDTH = 1400;

const GERBER_EXTENSIONS = [
  ".gbr", ".ger", ".gtl", ".gbl", ".gto", ".gbo", ".gts", ".gbs",
  ".gko", ".gm1", ".gml", ".art", ".pho", ".rml",
];

/** Best-effort detection: a Gerber file by extension, or RS-274X content
 *  markers (format spec / mode / an aperture or `G04` comment) in the head. */
export function looksLikeGerber(file: File, head = ""): boolean {
  const name = file.name.toLowerCase();
  if (GERBER_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return /%FS[LT]?A/.test(head) || (/%MO(MM|IN)\*/.test(head) && /G0?4|%AD/.test(head));
}

function renderToSvg(gerber: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // `color` is applied via the root SVG attribute (paths use currentColor).
    gerberToSvg(gerber, { id: "golden", attributes: { color: COPPER } }, (err, svg) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

/** Force an explicit pixel size on the <svg> root (keeping its viewBox for the
 *  coordinate mapping) so the browser rasterizes it at a known resolution. */
function sizedSvg(svg: string): { svg: string; width: number; height: number } {
  const vb = svg.match(/viewBox="([\d.eE+\- ]+)"/);
  let height = TARGET_WIDTH;
  if (vb) {
    const parts = vb[1].trim().split(/\s+/).map(Number);
    const vw = parts[2];
    const vh = parts[3];
    if (vw > 0 && vh > 0) height = Math.max(1, Math.round((TARGET_WIDTH * vh) / vw));
  }
  const out = svg.replace(/<svg([^>]*)>/, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s(width|height)="[^"]*"/g, "");
    return `<svg${cleaned} width="${TARGET_WIDTH}" height="${height}">`;
  });
  return { svg: out, width: TARGET_WIDTH, height };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not rasterize the rendered Gerber"));
    img.src = url;
  });
}

/** Render a Gerber file to a PNG File, ready to hand to the golden-PCB upload. */
export async function renderGerberToPng(file: File): Promise<File> {
  const text = await file.text();
  const svg = await renderToSvg(text);
  const { svg: sized, width, height } = sizedSvg(svg);

  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png")
    );
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
