/**
 * Preserve deep-link destination across login redirect.
 */

let pendingHref: string | null = null;

export function setPendingDeepLink(href: string | null) {
  pendingHref = href;
}

export function consumePendingDeepLink(): string | null {
  const next = pendingHref;
  pendingHref = null;
  return next;
}
