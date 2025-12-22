export type {
  User,
  Admin,
  Organization,
  OrganizationMember,
  Website,
  Product,
  Competitor,
  SerpResult,
  PageAnalysis,
  CompetitorPageAnalysis,
  AIReport,
  AISuggestion,
  AnalysisJob,
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

// ==========================================
// AI ANALYSIS TYPES
// ==========================================

export interface IdentifiedProduct {
  name: string;
  description: string;
  keywords: string[];
  sourceUrl: string;
  confidence: number;
}

export interface AIAnalysisResult {
  products: IdentifiedProduct[];
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
  productId?: string;
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
