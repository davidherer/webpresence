-- CreateTable
CREATE TABLE "CompetitorPageExtraction" (
    "id" TEXT NOT NULL,
    "searchQueryId" TEXT NOT NULL,
    "competitorId" TEXT,
    "url" TEXT NOT NULL,
    "position" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'serp',
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

    CONSTRAINT "CompetitorPageExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitorPageExtraction_searchQueryId_idx" ON "CompetitorPageExtraction"("searchQueryId");

-- CreateIndex
CREATE INDEX "CompetitorPageExtraction_competitorId_idx" ON "CompetitorPageExtraction"("competitorId");

-- CreateIndex
CREATE INDEX "CompetitorPageExtraction_url_idx" ON "CompetitorPageExtraction"("url");

-- CreateIndex
CREATE INDEX "CompetitorPageExtraction_status_idx" ON "CompetitorPageExtraction"("status");

-- CreateIndex
CREATE INDEX "CompetitorPageExtraction_type_idx" ON "CompetitorPageExtraction"("type");

-- CreateIndex
CREATE INDEX "CompetitorPageExtraction_extractedAt_idx" ON "CompetitorPageExtraction"("extractedAt");

-- AddForeignKey
ALTER TABLE "CompetitorPageExtraction" ADD CONSTRAINT "CompetitorPageExtraction_searchQueryId_fkey" FOREIGN KEY ("searchQueryId") REFERENCES "SearchQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPageExtraction" ADD CONSTRAINT "CompetitorPageExtraction_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
