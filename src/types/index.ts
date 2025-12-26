export type {
  User,
  Admin,
  Organization,
  OrganizationMember,
  Website,
  SearchQuery,
  CompetitionLevel,
  Competitor,
  SerpResult,
  PageAnalysis,
  CompetitorPageAnalysis,
  AIReport,
  AISuggestion,
  AnalysisJob,
  SitemapSnapshot,
} from "@/generated/prisma/client";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export interface SessionAdmin {
  id: string;
  email: string;
  name: string | null;
}

// ==========================================
// ORGANIZATION TYPES
// ==========================================

export type OrganizationRole = "owner" | "admin" | "member";

export interface OrganizationWithRole {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
  serpFrequencyHours: number;
  competitorFrequencyHours: number;
  aiReportFrequencyHours: number;
}

// ==========================================
// WEBSITE ANALYSIS TYPES
// ==========================================

export type WebsiteStatus = "pending" | "analyzing" | "active" | "error";

export interface ExtractedHeadings {
  h1: string[];
  h2: string[];
  h3: string[];
}

export interface ExtractedKeywords {
  keyword: string;
  frequency: number;
  density: number;
}

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: string;
}

export interface ParsedSitemap {
  type: "urlset" | "sitemapindex";
  urls: SitemapEntry[];
  sitemapIndexes?: SitemapIndexEntry[];
  metadata?: {
    totalUrls: number;
    changefreqDistribution?: Record<string, number>;
    priorityAverage?: number;
  };
}

export interface SitemapUrl {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  isAnalyzed?: boolean;
  lastAnalyzed?: string;
}

export interface SitemapSnapshotWithUrls {
  id: string;
  websiteId: string;
  sitemapUrl: string;
  urlCount: number;
  fetchedAt: string;
  sitemapType: string;
  urls: SitemapUrl[];
}

// ==========================================
// AI ANALYSIS TYPES
// ==========================================

export interface IdentifiedSearchQuery {
  description: string;
  query: string;
  tags: string[];
  competitionLevel: "HIGH" | "LOW";
  confidence: number;
}

export interface AIAnalysisResult {
  searchQueries: IdentifiedSearchQuery[];
  summary: string;
  recommendations: string[];
}

export type AIReportType =
  | "initial_analysis"
  | "periodic_recap"
  | "competitor_analysis";

export type AISuggestionType = "content" | "keyword" | "technical" | "backlink";

export type AISuggestionStatus = "pending" | "accepted" | "dismissed";

// ==========================================
// JOB TYPES
// ==========================================

export type AnalysisJobType =
  | "sitemap_fetch"
  | "page_scrape"
  | "serp_analysis"
  | "ai_report"
  | "initial_analysis";

export type AnalysisJobStatus = "pending" | "running" | "completed" | "failed";

export interface JobPayload {
  urls?: string[];
  query?: string;
  queries?: string[];
  searchQueryId?: string;
  competitorId?: string;
  reportType?: AIReportType;
}

// ==========================================
// SERP TYPES
// ==========================================

export type SearchEngine = "google" | "bing";
export type DeviceType = "desktop" | "mobile";

export interface SerpResultData {
  position: number;
  url: string;
  title: string;
  snippet: string;
}

export interface SerpAnalysisRequest {
  query: string;
  searchEngine?: SearchEngine;
  country?: string;
  device?: DeviceType;
}
