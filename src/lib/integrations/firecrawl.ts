type FirecrawlMetadata = Record<string, unknown>;

export type FirecrawlScrapedPage = {
  url: string;
  markdown: string;
  title: string | null;
  description: string | null;
  publishedTime: string | null;
  metadata: FirecrawlMetadata;
};

function cleanString(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function parseBoolean(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanString(entry)).filter((entry): entry is string => Boolean(entry));
  }

  const text = cleanString(value);
  if (!text) return [];

  return text
    .split(/[\n,]+/g)
    .map((entry) => cleanString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function looksLikeUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

export function firecrawlExplicitlyEnabled(config: Record<string, unknown>) {
  return parseBoolean(config.use_firecrawl) || parseBoolean(config.scrape_with_firecrawl);
}

export function resolveFirecrawlScrapeUrls(config: Record<string, unknown>, fallbackFields: string[] = []) {
  const directScrapeUrls = uniqueStrings(
    [...parseStringList(config.scrape_urls), ...parseStringList(config.firecrawl_urls)].filter(looksLikeUrl)
  );

  if (directScrapeUrls.length > 0) return directScrapeUrls;
  if (!firecrawlExplicitlyEnabled(config)) return [];

  return uniqueStrings(
    [...parseStringList(config.page_urls), ...fallbackFields.flatMap((field) => parseStringList(config[field]))].filter(looksLikeUrl)
  );
}

export async function scrapeConfiguredPagesWithFirecrawl({
  config,
  fallbackFields = []
}: {
  config: Record<string, unknown>;
  fallbackFields?: string[];
}): Promise<FirecrawlScrapedPage[]> {
  const urls = resolveFirecrawlScrapeUrls(config, fallbackFields);
  if (urls.length === 0) return [];

  const apiKey = cleanString(config.firecrawl_api_key || process.env.FIRECRAWL_API_KEY);
  if (!apiKey) {
    throw new Error("Firecrawl scraping requested but FIRECRAWL_API_KEY is missing");
  }

  const endpoint = cleanString(config.firecrawl_api_url || process.env.FIRECRAWL_API_URL) || "https://api.firecrawl.dev/v2/scrape";
  const timeout = Math.max(1000, Math.min(120000, toNumber(config.firecrawl_timeout_ms, 30000)));
  const maxAge = Math.max(0, toNumber(config.firecrawl_max_age_ms, 600000));
  const waitFor = Math.max(0, toNumber(config.firecrawl_wait_for_ms, 0));
  const country = cleanString(config.firecrawl_country) || "US";
  const languages = parseStringList(config.firecrawl_languages);

  const pages: FirecrawlScrapedPage[] = [];

  for (const url of urls) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout,
        waitFor,
        maxAge,
        blockAds: true,
        location: {
          country,
          languages: languages.length > 0 ? languages : ["en-US"]
        }
      })
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          success?: boolean;
          error?: string;
          data?: {
            markdown?: unknown;
            metadata?: FirecrawlMetadata;
          };
        }
      | null;

    if (!response.ok || !payload?.success || !payload.data) {
      throw new Error(payload?.error || `Firecrawl scrape failed (${response.status})`);
    }

    const metadata = payload.data.metadata && typeof payload.data.metadata === "object" ? payload.data.metadata : {};
    const markdown = cleanString(payload.data.markdown) || "";
    const sourceUrl = cleanString(metadata.sourceURL) || url;

    pages.push({
      url: sourceUrl,
      markdown,
      title: cleanString(metadata.title || metadata.ogTitle),
      description: cleanString(metadata.description || metadata.ogDescription),
      publishedTime: cleanString(metadata.publishedTime || metadata.modifiedTime || metadata.published_time),
      metadata
    });
  }

  return pages;
}
