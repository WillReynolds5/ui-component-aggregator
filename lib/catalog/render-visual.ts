import sharp from "sharp";

/**
 * Share of pixels that differ visibly from the page background. A DOM check can't tell a real
 * component from an empty 16×24 list item or a frame of "+" marks; pixels can. Pass the page's
 * real background: comparing to a corner pixel would call a full-bleed background "empty".
 */
export async function inkCoverage(
  png: Buffer,
  background?: [number, number, number],
  /** Channel difference that counts as ink: 16 catches light borders; 6 catches faint patterns. */
  threshold = 16,
): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r0, g0, b0] = background ?? [data[0], data[1], data[2]];
  let ink = 0;
  for (let i = 0; i < data.length; i += 3) {
    const diff = Math.max(Math.abs(data[i] - r0), Math.abs(data[i + 1] - g0), Math.abs(data[i + 2] - b0));
    if (diff > threshold) ink += 1;
  }
  return ink / (info.width * info.height);
}

/**
 * Below this share of inked pixels a render reads as empty. Measured at card size (480×360 @2x):
 * Arc's outline Copy button 0.14%, an empty 16×24 list item ~0.02%, mdxcn's empty chart
 * frame ("+" marks) ~0.06%.
 */
export const MIN_INK = 0.0008;

/**
 * Subtle designs (animate-ui's near-white hex grid) have no strong ink but tint a few percent
 * of the canvas. A hairline or a few "+" marks never reach this.
 */
export const MIN_FAINT_INK = 0.02;

export async function looksEmpty(png: Buffer, background: [number, number, number]): Promise<boolean> {
  if ((await inkCoverage(png, background)) >= MIN_INK) return false;
  return (await inkCoverage(png, background, 6)) < MIN_FAINT_INK;
}

/** Visible text that means the component rendered without the data it needed. */
export function looksUnfed(text: string): boolean {
  return /(^|\s)(NaN|undefined|null|\[object Object\])(\s|$)/.test(text);
}
