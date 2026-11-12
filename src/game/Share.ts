// Sharing scores: native share sheet inside the apps, Web Share API in browsers,
// clipboard as the last resort.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

export async function shareText(title: string, text: string): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    } catch {
      /* user dismissed or plugin unavailable; fall through */
    }
  }
  const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title, text });
      return 'shared';
    } catch {
      /* cancelled */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function scoreShareText(mode: string, score: number, maxTile: number, extra = ''): string {
  const lines = [`Temple 2048 · ${mode}`, `Score ${score.toLocaleString('en-US')} · Highest gem ${maxTile}`];
  if (extra) lines.push(extra);
  lines.push('Can you beat it? Play Temple 2048');
  return lines.join('\n');
}
