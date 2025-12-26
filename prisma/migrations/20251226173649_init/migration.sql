-- CreateEnum
CREATE TYPE "CompetitionLevel" AS ENUM ('HIGH', 'LOW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAuthCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuthCode" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serpFrequencyHours" INTEGER NOT NULL DEFAULT 24,
    "competitorFrequencyHours" INTEGER NOT NULL DEFAULT 168,
    "aiReportFrequencyHours" INTEGER NOT NULL DEFAULT 720,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Website" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sitemapUrl" TEXT,
    "lastSitemapFetch" TIMESTAMP(3),

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitemapSnapshot" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sitemapUrl" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "urlCount" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sitemapType" TEXT NOT NULL DEFAULT 'single',
    "parentId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "SitemapSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitemapUrl" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastmod" TEXT,
    "changefreq" TEXT,
    "priority" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitemapUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "description" TEXT,
    "query" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitionLevel" "CompetitionLevel" NOT NULL DEFAULT 'HIGH',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sitemapUrl" TEXT,
    "lastSitemapFetch" TIMESTAMP(3),

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSitemapSnapshot" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "sitemapUrl" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "urlCount" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sitemapType" TEXT NOT NULL DEFAULT 'single',
    "parentId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "CompetitorSitemapSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSitemapUrl" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastmod" TEXT,
    "changefreq" TEXT,
    "priority" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSitemapUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerpResult" (
    "id" TEXT NOT NULL,
    "searchQueryId" TEXT,
    "competitorId" TEXT,
    "query" TEXT NOT NULL,
    "position" INTEGER,
    "url" TEXT,
    "title" TEXT,
    "snippet" TEXT,
    "searchEngine" TEXT NOT NULL DEFAULT 'google',
    "country" TEXT NOT NULL DEFAULT 'FR',
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawDataBlobUrl" TEXT,

    CONSTRAINT "SerpResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageAnalysis" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "metaDescription" TEXT,
    "headings" JSONB,
    "keywords" JSONB,
    "wordCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "htmlBlobUrl" TEXT,

    CONSTRAINT "PageAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageExtraction" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "headings" JSONB,
    "keywords" JSONB,
    "htmlBlobUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "PageExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorPageAnalysis" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "metaDescription" TEXT,
    "headings" JSONB,
    "keywords" JSONB,
    "wordCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "htmlBlobUrl" TEXT,

    CONSTRAINT "CompetitorPageAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIReport" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISuggestion" (
    "id" TEXT NOT NULL,
    "searchQueryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AISuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_token_idx" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserAuthCode_userId_idx" ON "UserAuthCode"("userId");

-- CreateIndex
CREATE INDEX "UserAuthCode_code_idx" ON "UserAuthCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_key" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_token_idx" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminAuthCode_adminId_idx" ON "AdminAuthCode"("adminId");

-- CreateIndex
CREATE INDEX "AdminAuthCode_code_idx" ON "AdminAuthCode"("code");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Website_organizationId_idx" ON "Website"("organizationId");

-- CreateIndex
CREATE INDEX "Website_status_idx" ON "Website"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Website_organizationId_url_key" ON "Website"("organizationId", "url");

-- CreateIndex
CREATE INDEX "SitemapSnapshot_websiteId_fetchedAt_idx" ON "SitemapSnapshot"("websiteId", "fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "SitemapSnapshot_websiteId_idx" ON "SitemapSnapshot"("websiteId");

-- CreateIndex
CREATE INDEX "SitemapSnapshot_fetchedAt_idx" ON "SitemapSnapshot"("fetchedAt");

-- CreateIndex
CREATE INDEX "SitemapUrl_snapshotId_idx" ON "SitemapUrl"("snapshotId");

-- CreateIndex
CREATE INDEX "SitemapUrl_url_idx" ON "SitemapUrl"("url");

-- CreateIndex
CREATE INDEX "SearchQuery_websiteId_idx" ON "SearchQuery"("websiteId");

-- CreateIndex
CREATE INDEX "SearchQuery_isActive_idx" ON "SearchQuery"("isActive");

-- CreateIndex
CREATE INDEX "SearchQuery_query_idx" ON "SearchQuery"("query");

-- CreateIndex
CREATE INDEX "Competitor_websiteId_idx" ON "Competitor"("websiteId");

-- CreateIndex
CREATE INDEX "Competitor_isActive_idx" ON "Competitor"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_websiteId_url_key" ON "Competitor"("websiteId", "url");

-- CreateIndex
CREATE INDEX "CompetitorSitemapSnapshot_competitorId_fetchedAt_idx" ON "CompetitorSitemapSnapshot"("competitorId", "fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "CompetitorSitemapSnapshot_competitorId_idx" ON "CompetitorSitemapSnapshot"("competitorId");

-- CreateIndex
CREATE INDEX "CompetitorSitemapSnapshot_fetchedAt_idx" ON "CompetitorSitemapSnapshot"("fetchedAt");

-- CreateIndex
CREATE INDEX "CompetitorSitemapUrl_snapshotId_idx" ON "CompetitorSitemapUrl"("snapshotId");

-- CreateIndex
CREATE INDEX "CompetitorSitemapUrl_url_idx" ON "CompetitorSitemapUrl"("url");

-- CreateIndex
CREATE INDEX "SerpResult_searchQueryId_idx" ON "SerpResult"("searchQueryId");

-- CreateIndex
CREATE INDEX "SerpResult_competitorId_idx" ON "SerpResult"("competitorId");

-- CreateIndex
CREATE INDEX "SerpResult_query_idx" ON "SerpResult"("query");

-- CreateIndex
CREATE INDEX "SerpResult_createdAt_idx" ON "SerpResult"("createdAt");

-- CreateIndex
CREATE INDEX "PageAnalysis_websiteId_idx" ON "PageAnalysis"("websiteId");

-- CreateIndex
CREATE INDEX "PageAnalysis_url_idx" ON "PageAnalysis"("url");

-- CreateIndex
CREATE INDEX "PageAnalysis_createdAt_idx" ON "PageAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "PageExtraction_websiteId_idx" ON "PageExtraction"("websiteId");

-- CreateIndex
CREATE INDEX "PageExtraction_url_idx" ON "PageExtraction"("url");

-- CreateIndex
CREATE INDEX "PageExtraction_status_idx" ON "PageExtraction"("status");

-- CreateIndex
CREATE INDEX "PageExtraction_type_idx" ON "PageExtraction"("type");

-- CreateIndex
CREATE INDEX "PageExtraction_extractedAt_idx" ON "PageExtraction"("extractedAt");

-- CreateIndex
CREATE INDEX "CompetitorPageAnalysis_competitorId_idx" ON "CompetitorPageAnalysis"("competitorId");

-- CreateIndex
CREATE INDEX "CompetitorPageAnalysis_url_idx" ON "CompetitorPageAnalysis"("url");

-- CreateIndex
CREATE INDEX "CompetitorPageAnalysis_createdAt_idx" ON "CompetitorPageAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "AIReport_websiteId_idx" ON "AIReport"("websiteId");

-- CreateIndex
CREATE INDEX "AIReport_type_idx" ON "AIReport"("type");

-- CreateIndex
CREATE INDEX "AIReport_createdAt_idx" ON "AIReport"("createdAt");

-- CreateIndex
CREATE INDEX "AISuggestion_searchQueryId_idx" ON "AISuggestion"("searchQueryId");

-- CreateIndex
CREATE INDEX "AISuggestion_type_idx" ON "AISuggestion"("type");

-- CreateIndex
CREATE INDEX "AISuggestion_status_idx" ON "AISuggestion"("status");

-- CreateIndex
CREATE INDEX "AISuggestion_priority_idx" ON "AISuggestion"("priority");

-- CreateIndex
CREATE INDEX "AnalysisJob_websiteId_idx" ON "AnalysisJob"("websiteId");

-- CreateIndex
CREATE INDEX "AnalysisJob_status_idx" ON "AnalysisJob"("status");

-- CreateIndex
CREATE INDEX "AnalysisJob_type_idx" ON "AnalysisJob"("type");

-- CreateIndex
CREATE INDEX "AnalysisJob_scheduledAt_idx" ON "AnalysisJob"("scheduledAt");

-- CreateIndex
CREATE INDEX "AnalysisJob_priority_idx" ON "AnalysisJob"("priority");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuthCode" ADD CONSTRAINT "UserAuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuthCode" ADD CONSTRAINT "AdminAuthCode_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitemapSnapshot" ADD CONSTRAINT "SitemapSnapshot_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitemapSnapshot" ADD CONSTRAINT "SitemapSnapshot_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SitemapSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitemapUrl" ADD CONSTRAINT "SitemapUrl_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SitemapSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchQuery" ADD CONSTRAINT "SearchQuery_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSitemapSnapshot" ADD CONSTRAINT "CompetitorSitemapSnapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSitemapSnapshot" ADD CONSTRAINT "CompetitorSitemapSnapshot_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CompetitorSitemapSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSitemapUrl" ADD CONSTRAINT "CompetitorSitemapUrl_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CompetitorSitemapSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpResult" ADD CONSTRAINT "SerpResult_searchQueryId_fkey" FOREIGN KEY ("searchQueryId") REFERENCES "SearchQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpResult" ADD CONSTRAINT "SerpResult_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAnalysis" ADD CONSTRAINT "PageAnalysis_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageExtraction" ADD CONSTRAINT "PageExtraction_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPageAnalysis" ADD CONSTRAINT "CompetitorPageAnalysis_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReport" ADD CONSTRAINT "AIReport_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISuggestion" ADD CONSTRAINT "AISuggestion_searchQueryId_fkey" FOREIGN KEY ("searchQueryId") REFERENCES "SearchQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
