/*
  Warnings:

  - You are about to drop the column `productId` on the `AISuggestion` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `SerpResult` table. All the data in the column will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `searchQueryId` to the `AISuggestion` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CompetitionLevel" AS ENUM ('HIGH', 'LOW');

-- DropForeignKey
ALTER TABLE "AISuggestion" DROP CONSTRAINT "AISuggestion_productId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_websiteId_fkey";

-- DropForeignKey
ALTER TABLE "SerpResult" DROP CONSTRAINT "SerpResult_productId_fkey";

-- DropIndex
DROP INDEX "AISuggestion_productId_idx";

-- DropIndex
DROP INDEX "SerpResult_productId_idx";

-- AlterTable
ALTER TABLE "AISuggestion" DROP COLUMN "productId",
ADD COLUMN     "searchQueryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Competitor" ADD COLUMN     "lastSitemapFetch" TIMESTAMP(3),
ADD COLUMN     "sitemapUrl" TEXT;

-- AlterTable
ALTER TABLE "SerpResult" DROP COLUMN "productId",
ADD COLUMN     "searchQueryId" TEXT;

-- DropTable
DROP TABLE "Product";

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
CREATE INDEX "AISuggestion_searchQueryId_idx" ON "AISuggestion"("searchQueryId");

-- CreateIndex
CREATE INDEX "SerpResult_searchQueryId_idx" ON "SerpResult"("searchQueryId");

-- AddForeignKey
ALTER TABLE "SitemapSnapshot" ADD CONSTRAINT "SitemapSnapshot_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitemapSnapshot" ADD CONSTRAINT "SitemapSnapshot_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SitemapSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitemapUrl" ADD CONSTRAINT "SitemapUrl_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SitemapSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchQuery" ADD CONSTRAINT "SearchQuery_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSitemapSnapshot" ADD CONSTRAINT "CompetitorSitemapSnapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSitemapSnapshot" ADD CONSTRAINT "CompetitorSitemapSnapshot_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CompetitorSitemapSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSitemapUrl" ADD CONSTRAINT "CompetitorSitemapUrl_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CompetitorSitemapSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpResult" ADD CONSTRAINT "SerpResult_searchQueryId_fkey" FOREIGN KEY ("searchQueryId") REFERENCES "SearchQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageExtraction" ADD CONSTRAINT "PageExtraction_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISuggestion" ADD CONSTRAINT "AISuggestion_searchQueryId_fkey" FOREIGN KEY ("searchQueryId") REFERENCES "SearchQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
