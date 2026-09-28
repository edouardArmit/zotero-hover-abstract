import type { HttpFailure, LookupResult, MissingDetail } from "./lookupResult";

// Everything one hover found out, source by source, and the pure formatting
// of it into the text injected into the popup: a heading ("Abstract (from
// Crossref)" / "No abstract found"), then either the abstract or one status
// line per source that was checked, so the user can see *why* nothing came
// back - not in the library, online search off, publisher shares no
// abstract, API key rejected, rate limited, offline...

export type LibraryStatus =
  | { kind: "found"; abstract: string }
  | { kind: "notInLibrary" }
  | { kind: "noAbstract" }
  | { kind: "error"; message: string };

/** Semantic Scholar is absent when it wasn't needed (Crossref found it). */
export interface ExternalResults {
  crossref: LookupResult;
  semanticScholar?: LookupResult;
}

export interface LookupReport {
  library: LibraryStatus;
  external: ExternalResults | "disabled";
  /** Set when `external` came from the cache: when it was originally fetched. */
  cachedAt?: number;
}

export interface FormattedReport {
  heading: string;
  abstract?: string;
  details: string[];
}

export interface FormatOptions {
  /** Plugin name as shown in Zotero's Settings sidebar. */
  settingsName: string;
  now: number;
  /** Development builds only: append the cache age to the heading. */
  showCacheAge: boolean;
}

const MAX_MESSAGE_LENGTH = 90;

export function formatReport(
  report: LookupReport,
  options: FormatOptions,
): FormattedReport {
  const cacheSuffix =
    options.showCacheAge && report.cachedAt !== undefined
      ? ` · cached ${formatAge(options.now - report.cachedAt)}`
      : "";

  const found = findAbstract(report);
  if (found) {
    return {
      heading: `Abstract (from ${found.source})${cacheSuffix}`,
      abstract: found.abstract,
      details: [],
    };
  }

  const details = [`Library: ${describeLibrary(report.library)}`];
  if (report.external === "disabled") {
    details.push(
      `Online search: off (turn it on in Settings > ${options.settingsName})`,
    );
  } else {
    const { crossref, semanticScholar } = report.external;
    details.push(`Crossref: ${describeResult(crossref, options)}`);
    if (semanticScholar) {
      details.push(
        `Semantic Scholar: ${describeResult(semanticScholar, options)}`,
      );
    }
  }
  return { heading: `No abstract found${cacheSuffix}`, details };
}

function findAbstract(
  report: LookupReport,
): { source: string; abstract: string } | undefined {
  if (report.library.kind === "found") {
    return { source: "your library", abstract: report.library.abstract };
  }
  if (report.external === "disabled") return undefined;
  const { crossref, semanticScholar } = report.external;
  if (crossref.kind === "found") {
    return { source: "Crossref", abstract: crossref.abstract };
  }
  if (semanticScholar?.kind === "found") {
    return { source: "Semantic Scholar", abstract: semanticScholar.abstract };
  }
  return undefined;
}

function describeLibrary(status: LibraryStatus): string {
  switch (status.kind) {
    case "found":
      return "abstract found";
    case "notInLibrary":
      return "not in your library";
    case "noAbstract":
      return "in your library, but its abstract field is empty";
    case "error":
      return `search failed (${truncate(status.message)})`;
  }
}

function describeResult(result: LookupResult, options: FormatOptions): string {
  switch (result.kind) {
    case "found":
      return "abstract found";
    case "missing":
      return MISSING_TEXT[result.detail];
    case "error":
      return describeFailure(result.failure, options.settingsName);
  }
}

const MISSING_TEXT: Record<MissingDetail, string> = {
  noMatch: "no matching record",
  noAbstract: "record found, but no abstract available",
  noQuery: "not searched (no title or DOI could be read from the reference)",
};

export function describeFailure(
  failure: HttpFailure,
  settingsName: string,
): string {
  const http = formatHttpError(failure);
  switch (failure.reason) {
    case "auth":
      return `authentication error, ${http} - check the API key in Settings > ${settingsName}`;
    case "rateLimited":
      return `rate limited, ${http} - hover again later`;
    case "server":
      return `server error, ${http} - hover again later`;
    case "network": {
      const detail = failure.message ? ` (${truncate(failure.message)})` : "";
      return `network issue${detail} - hover again to retry`;
    }
  }
}

// HTTP/2 responses carry no reason phrase, so statusText is often empty
// (Semantic Scholar's 403 arrives that way) - fill in the common ones.
const STANDARD_STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/** e.g. `429 Too Many Requests: "Please wait and try again..."` */
export function formatHttpError(failure: HttpFailure): string {
  const statusText =
    failure.statusText?.trim() ||
    (failure.status ? STANDARD_STATUS_TEXT[failure.status] : undefined);
  const code = [failure.status, statusText].filter(Boolean).join(" ");
  const message = failure.message?.trim();
  const isRedundant =
    !message || message.toLowerCase() === statusText?.toLowerCase();
  if (isRedundant) return code || "no status";
  return code ? `${code}: "${truncate(message)}"` : `"${truncate(message)}"`;
}

export function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

function truncate(text: string): string {
  return text.length > MAX_MESSAGE_LENGTH
    ? `${text.slice(0, MAX_MESSAGE_LENGTH - 1).trimEnd()}…`
    : text;
}
