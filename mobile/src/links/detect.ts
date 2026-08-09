/**
 * Shared contact/link entity parser for message text.
 * Priority: URL > email > phone > location-ish URLs already covered by URL.
 */

export type DetectedEntityType = 'url' | 'ao_chats' | 'email' | 'phone' | 'location';

export type DetectedEntity = {
  type: DetectedEntityType;
  value: string;
  display: string;
  start: number;
  end: number;
};

const AO_HOSTS = new Set(['aochats.chat', 'www.aochats.chat', 'api.aochats.chat']);

const URL_RE =
  /\b((?:https?:\/\/|www\.)[^\s<>"'`]+|(?:maps\.google\.[^\s<>"'`]+|goo\.gl\/maps\/[^\s<>"'`]+|maps\.app\.goo\.gl\/[^\s<>"'`]+))/gi;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** Tanzania-friendly + common international phone patterns (avoid random digit runs). */
const PHONE_RE =
  /(?:^|[^\d+])((?:\+|00)?(?:255|254|256|250|257)?[\s.-]?(?:0)?(?:7\d{2}|6\d{2}|1\d{2})[\s.-]?\d{3}[\s.-]?\d{3,4}|(?:\+|00)\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4})(?!\d)/g;

function overlaps(aStart: number, aEnd: number, ranges: Array<{ start: number; end: number }>) {
  return ranges.some((r) => aStart < r.end && aEnd > r.start);
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.replace(/[),.;!?]+$/g, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isAoChatsUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return AO_HOSTS.has(host) || host.endsWith('.aochats.chat');
  } catch {
    return /aochats\.chat/i.test(url);
  }
}

function isLocationUrl(url: string): boolean {
  return /(?:maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl|openstreetmap\.org|maps\.apple\.com)/i.test(
    url
  );
}

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('0') && cleaned.length === 10) return `+255${cleaned.slice(1)}`;
  if (/^255\d{9}$/.test(cleaned)) return `+${cleaned}`;
  return cleaned.startsWith('+') ? cleaned : cleaned;
}

function isPlausiblePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return false;
  // Reject years / short IDs
  if (/^(19|20)\d{2}$/.test(digits)) return false;
  return true;
}

export function detectEntities(text: string): DetectedEntity[] {
  if (!text) return [];
  const found: DetectedEntity[] = [];
  const taken: Array<{ start: number; end: number }> = [];

  const push = (entity: DetectedEntity) => {
    if (overlaps(entity.start, entity.end, taken)) return;
    taken.push({ start: entity.start, end: entity.end });
    found.push(entity);
  };

  for (const match of text.matchAll(URL_RE)) {
    const raw = match[1] || match[0];
    const start = match.index ?? 0;
    const adjustedStart = text.slice(start, start + raw.length) === raw ? start : (match.index ?? 0);
    // matchAll with capturing group: index is start of full match; group may equal match[0]
    const idx = text.indexOf(raw, match.index ?? 0);
    const startIdx = idx >= 0 ? idx : adjustedStart;
    const endIdx = startIdx + raw.length;
    const value = normalizeUrl(raw);
    let type: DetectedEntityType = 'url';
    if (isAoChatsUrl(value)) type = 'ao_chats';
    else if (isLocationUrl(value)) type = 'location';
    push({
      type,
      value,
      display: raw.replace(/[),.;!?]+$/g, ''),
      start: startIdx,
      end: endIdx,
    });
  }

  for (const match of text.matchAll(EMAIL_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    push({
      type: 'email',
      value: raw,
      display: raw,
      start,
      end: start + raw.length,
    });
  }

  for (const match of text.matchAll(PHONE_RE)) {
    const raw = (match[1] || '').trim();
    if (!raw || !isPlausiblePhone(raw)) continue;
    const full = match[0];
    const startOffset = full.indexOf(raw);
    const start = (match.index ?? 0) + (startOffset >= 0 ? startOffset : 0);
    push({
      type: 'phone',
      value: normalizePhone(raw),
      display: raw.trim(),
      start,
      end: start + raw.length,
    });
  }

  return found.sort((a, b) => a.start - b.start);
}

export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'entity'; entity: DetectedEntity };

export function segmentTextWithEntities(text: string): TextSegment[] {
  const entities = detectEntities(text);
  if (!entities.length) return [{ kind: 'text', text }];

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const entity of entities) {
    if (entity.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, entity.start) });
    }
    segments.push({ kind: 'entity', entity });
    cursor = entity.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }
  return segments;
}
