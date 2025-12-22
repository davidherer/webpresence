// Internal types for BrightData integration
// These are NOT exposed to the client

export interface BrightDataConfig {
  apiKey: string;
  zone: string;
}

export interface ScrapeOptions {
  url: string;
  waitForSelector?: string;
  timeout?: number;
  javascript?: boolean;
}

export interface ScrapeResult {
  html: string;
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  timestamp: Date;
}

export interface SerpOptions {
  query: string;
  country?: string;
  language?: string;
  device?: "desktop" | "mobile";
  numResults?: number;
}

export interface SerpResultItem {
  position: number;
  url: string;
  title: string;
  snippet: string;
  domain: string;
}

export interface SerpResponse {
  query: string;
  results: SerpResultItem[];
  totalResults: number;
  timestamp: Date;
}

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface SitemapResult {
  urls: SitemapUrl[];
  sitemapUrl: string;
  timestamp: Date;
}
