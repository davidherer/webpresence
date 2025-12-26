import { brightdata } from "../brightdata/client";
import { storeHtml } from "../storage/blob";
import type {
  QuickExtractionResult,
  FullExtractionResult,
  ExtractionResult,
  ExtractionType,
} from "./types";

/**
 * Extraire les données rapides d'une page (title, meta description, h1)
 */
export async function extractQuick(
  html: string
): Promise<QuickExtractionResult> {
  console.log(`[Extraction] Extracting quick metadata`);

  const metadata = brightdata.extractPageMetadata(html);

  return {
    title: metadata.title,
    metaDescription: metadata.metaDescription,
    h1: metadata.headings.h1,
  };
}

/**
 * Extraire toutes les données d'une page (headings complets, keywords, etc.)
 */
export async function extractFull(html: string): Promise<FullExtractionResult> {
  console.log(`[Extraction] Extracting full metadata and keywords`);

  const metadata = brightdata.extractPageMetadata(html);
  const keywords = brightdata.extractKeywords(html);

  // Extraire également h4, h5, h6
  const h4 = extractHeadingsByTag(html, "h4");
  const h5 = extractHeadingsByTag(html, "h5");
  const h6 = extractHeadingsByTag(html, "h6");

  return {
    title: metadata.title,
    metaDescription: metadata.metaDescription,
    h1: metadata.headings.h1,
    headings: {
      h2: metadata.headings.h2,
      h3: metadata.headings.h3,
      h4,
      h5,
      h6,
    },
    keywords,
  };
}

/**
 * Extraire les headings par tag
 */
function extractHeadingsByTag(html: string, tag: string): string[] {
  const headings: string[] = [];
  const pattern = new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`, "gi");
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const text = decodeHtmlEntities(match[1].trim());
    if (text) headings.push(text);
  }
  return headings;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Effectuer une extraction complète d'une page (scrape + extract + store)
 */
export async function extractPage(
  websiteId: string,
  url: string,
  type: ExtractionType
): Promise<ExtractionResult> {
  console.log(`[Extraction] Starting ${type} extraction for ${url}`);

  try {
    // 1. Scraper la page via BrightData
    const scrapeResult = await brightdata.scrapePage({
      url,
      timeout: 30000,
    });

    console.log(
      `[Extraction] Page scraped, HTML length: ${scrapeResult.html.length}`
    );

    // 2. Stocker le HTML en blob
    const blobResult = await storeHtml(websiteId, url, scrapeResult.html);
    const htmlBlobUrl = blobResult.url;
    console.log(`[Extraction] HTML stored at: ${htmlBlobUrl}`);

    // 3. Extraire selon le type
    let quickResult: QuickExtractionResult | null = null;
    let fullResult: FullExtractionResult | null = null;

    if (type === "quick") {
      quickResult = await extractQuick(scrapeResult.html);
    } else if (type === "full") {
      fullResult = await extractFull(scrapeResult.html);
    }

    console.log(`[Extraction] Extraction completed for ${url}`);

    return {
      type,
      quick: quickResult,
      full: fullResult,
      htmlBlobUrl,
    };
  } catch (error) {
    console.error(`[Extraction] Error extracting ${url}:`, error);
    throw error;
  }
}
