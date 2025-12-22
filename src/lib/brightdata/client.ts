import type {
  ScrapeOptions,
  ScrapeResult,
  SerpOptions,
  SerpResponse,
  SerpResultItem,
  SitemapResult,
  SitemapUrl,
} from "./types";

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY!;
const BRIGHTDATA_ZONE = process.env.BRIGHTDATA_ZONE || "web_unlocker";

// Base URL for BrightData Web Unlocker API
const BRIGHTDATA_BASE_URL = "https://api.brightdata.com";

/**
 * Internal client for BrightData API
 * This abstraction is NEVER exposed to the frontend
 */
class BrightDataClient {
  private apiKey: string;
  private zone: string;

  constructor() {
    this.apiKey = BRIGHTDATA_API_KEY;
    this.zone = BRIGHTDATA_ZONE;
  }

  private getProxyUrl(): string {
    // BrightData proxy endpoint format
    return `http://brd-customer-${this.zone}:${this.apiKey}@brd.superproxy.io:22225`;
  }

  /**
   * Scrape a single page
   */
  async scrapePage(options: ScrapeOptions): Promise<ScrapeResult> {
    const { url, timeout = 30000 } = options;

    try {
      // Using BrightData Web Unlocker API
      const response = await fetch(`${BRIGHTDATA_BASE_URL}/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          zone: this.zone,
          url,
          format: "raw",
          timeout,
        }),
        signal: AbortSignal.timeout(timeout + 5000),
      });

      if (!response.ok) {
        throw new Error(
          `Scrape failed: ${response.status} ${response.statusText}`
        );
      }

      const html = await response.text();

      return {
        html,
        url,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`[BrightData] Scrape error for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Fetch SERP results for a query
   */
  async searchSerp(options: SerpOptions): Promise<SerpResponse> {
    const {
      query,
      country = "fr",
      language = "fr",
      // device is available in options but not used in URL building for now
      numResults = 10,
    } = options;

    try {
      // Build Google search URL
      const searchUrl = this.buildGoogleSearchUrl(
        query,
        country,
        language,
        numResults
      );

      // Scrape Google results page
      const result = await this.scrapePage({ url: searchUrl });

      // Parse SERP results from HTML
      const results = this.parseSerpResults(result.html);

      return {
        query,
        results,
        totalResults: results.length,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`[BrightData] SERP error for "${query}":`, error);
      throw error;
    }
  }

  private buildGoogleSearchUrl(
    query: string,
    country: string,
    language: string,
    numResults: number
  ): string {
    const params = new URLSearchParams({
      q: query,
      gl: country,
      hl: language,
      num: numResults.toString(),
    });
    return `https://www.google.com/search?${params.toString()}`;
  }

  /**
   * Parse SERP results from Google HTML
   * This is a simplified parser - real implementation would be more robust
   */
  private parseSerpResults(html: string): SerpResultItem[] {
    const results: SerpResultItem[] = [];

    // Simple regex-based extraction
    // In production, use a proper HTML parser like cheerio
    const resultPattern = new RegExp(
      '<div class="[^"]*g[^"]*"[^>]*>.*?<a href="(https?://[^"]+)"[^>]*>.*?<h3[^>]*>([^<]+)</h3>.*?<span[^>]*>([^<]*)</span>',
      "gis"
    );

    let match;
    let position = 1;

    while ((match = resultPattern.exec(html)) !== null && position <= 20) {
      const url = match[1];
      const title = match[2];
      const snippet = match[3] || "";

      try {
        const domain = new URL(url).hostname;

        results.push({
          position,
          url,
          title: this.decodeHtmlEntities(title),
          snippet: this.decodeHtmlEntities(snippet),
          domain,
        });
        position++;
      } catch {
        // Skip invalid URLs
      }
    }

    return results;
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  /**
   * Fetch and parse sitemap
   */
  async fetchSitemap(websiteUrl: string): Promise<SitemapResult> {
    // Try common sitemap locations
    const sitemapUrls = [
      new URL("/sitemap.xml", websiteUrl).href,
      new URL("/sitemap_index.xml", websiteUrl).href,
      new URL("/sitemap/sitemap.xml", websiteUrl).href,
    ];

    let sitemapHtml: string | null = null;
    let foundSitemapUrl: string | null = null;

    for (const sitemapUrl of sitemapUrls) {
      try {
        const result = await this.scrapePage({
          url: sitemapUrl,
          timeout: 15000,
        });
        if (
          result.html.includes("<urlset") ||
          result.html.includes("<sitemapindex")
        ) {
          sitemapHtml = result.html;
          foundSitemapUrl = sitemapUrl;
          break;
        }
      } catch {
        // Try next URL
      }
    }

    if (!sitemapHtml || !foundSitemapUrl) {
      // Try robots.txt for sitemap URL
      try {
        const robotsResult = await this.scrapePage({
          url: new URL("/robots.txt", websiteUrl).href,
          timeout: 10000,
        });
        const sitemapMatch = robotsResult.html.match(/Sitemap:\s*(\S+)/i);
        if (sitemapMatch) {
          const customSitemapUrl = sitemapMatch[1];
          const result = await this.scrapePage({ url: customSitemapUrl });
          sitemapHtml = result.html;
          foundSitemapUrl = customSitemapUrl;
        }
      } catch {
        // No sitemap found
      }
    }

    if (!sitemapHtml || !foundSitemapUrl) {
      throw new Error(`No sitemap found for ${websiteUrl}`);
    }

    const urls = this.parseSitemapXml(sitemapHtml);

    return {
      urls,
      sitemapUrl: foundSitemapUrl,
      timestamp: new Date(),
    };
  }

  /**
   * Parse sitemap XML content
   */
  private parseSitemapXml(xml: string): SitemapUrl[] {
    const urls: SitemapUrl[] = [];

    // Handle sitemap index (contains references to other sitemaps)
    if (xml.includes("<sitemapindex")) {
      // For now, just extract the sitemap URLs
      // In production, we'd recursively fetch each sitemap
      const sitemapPattern = /<loc>([^<]+)<\/loc>/g;
      let match;
      while ((match = sitemapPattern.exec(xml)) !== null) {
        urls.push({ loc: match[1] });
      }
      return urls;
    }

    // Handle regular sitemap
    const urlPattern = /<url>([\s\S]*?)<\/url>/g;
    let urlMatch;

    while ((urlMatch = urlPattern.exec(xml)) !== null) {
      const urlBlock = urlMatch[1];

      const locMatch = urlBlock.match(/<loc>([^<]+)<\/loc>/);
      const lastmodMatch = urlBlock.match(/<lastmod>([^<]+)<\/lastmod>/);
      const changefreqMatch = urlBlock.match(
        /<changefreq>([^<]+)<\/changefreq>/
      );
      const priorityMatch = urlBlock.match(/<priority>([^<]+)<\/priority>/);

      if (locMatch) {
        urls.push({
          loc: locMatch[1],
          lastmod: lastmodMatch?.[1],
          changefreq: changefreqMatch?.[1],
          priority: priorityMatch ? parseFloat(priorityMatch[1]) : undefined,
        });
      }
    }

    return urls;
  }

  /**
   * Extract page metadata (title, description, headings)
   */
  extractPageMetadata(html: string): {
    title: string | null;
    metaDescription: string | null;
    headings: { h1: string[]; h2: string[]; h3: string[] };
    wordCount: number;
  } {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch
      ? this.decodeHtmlEntities(titleMatch[1].trim())
      : null;

    // Extract meta description
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
    );
    const metaDescription = descMatch
      ? this.decodeHtmlEntities(descMatch[1].trim())
      : null;

    // Extract headings
    const headings = {
      h1: this.extractHeadings(html, "h1"),
      h2: this.extractHeadings(html, "h2"),
      h3: this.extractHeadings(html, "h3"),
    };

    // Estimate word count (strip HTML and count words)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = textContent.split(/\s+/).filter(Boolean).length;

    return { title, metaDescription, headings, wordCount };
  }

  private extractHeadings(html: string, tag: string): string[] {
    const headings: string[] = [];
    const pattern = new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, "gi");
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = this.decodeHtmlEntities(match[1].trim());
      if (text) headings.push(text);
    }
    return headings;
  }

  /**
   * Extract keywords from text content
   */
  extractKeywords(
    html: string,
    minFrequency = 2
  ): Array<{ keyword: string; frequency: number; density: number }> {
    // Strip HTML
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .toLowerCase();

    // Common French and English stop words
    const stopWords = new Set([
      "le",
      "la",
      "les",
      "de",
      "du",
      "des",
      "un",
      "une",
      "et",
      "en",
      "à",
      "au",
      "aux",
      "ce",
      "ces",
      "cette",
      "qui",
      "que",
      "quoi",
      "dont",
      "où",
      "pour",
      "par",
      "sur",
      "avec",
      "dans",
      "est",
      "sont",
      "a",
      "ont",
      "être",
      "avoir",
      "faire",
      "plus",
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
    ]);

    // Extract words
    const words = textContent
      .split(/[\s\p{P}]+/u)
      .filter(
        (word) => word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word)
      );

    // Count frequencies
    const wordCount = new Map<string, number>();
    for (const word of words) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }

    const totalWords = words.length;

    // Convert to array and filter
    const keywords = Array.from(wordCount.entries())
      .filter(([, count]) => count >= minFrequency)
      .map(([keyword, frequency]) => ({
        keyword,
        frequency,
        density: Number(((frequency / totalWords) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 50); // Top 50 keywords

    return keywords;
  }
}

// Export singleton instance
export const brightdata = new BrightDataClient();

// Export types
export type {
  ScrapeOptions,
  ScrapeResult,
  SerpOptions,
  SerpResponse,
  SitemapResult,
};
