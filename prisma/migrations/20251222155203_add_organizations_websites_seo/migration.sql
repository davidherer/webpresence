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
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "keywords" TEXT[],
    "sourceUrl" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerpResult" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
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
    "productId" TEXT NOT NULL,
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
CREATE INDEX "Product_websiteId_idx" ON "Product"("websiteId");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Competitor_websiteId_idx" ON "Competitor"("websiteId");

-- CreateIndex
CREATE INDEX "Competitor_isActive_idx" ON "Competitor"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_websiteId_url_key" ON "Competitor"("websiteId", "url");

-- CreateIndex
CREATE INDEX "SerpResult_productId_idx" ON "SerpResult"("productId");

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
CREATE INDEX "AISuggestion_productId_idx" ON "AISuggestion"("productId");

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
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpResult" ADD CONSTRAINT "SerpResult_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpResult" ADD CONSTRAINT "SerpResult_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAnalysis" ADD CONSTRAINT "PageAnalysis_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPageAnalysis" ADD CONSTRAINT "CompetitorPageAnalysis_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReport" ADD CONSTRAINT "AIReport_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISuggestion" ADD CONSTRAINT "AISuggestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
