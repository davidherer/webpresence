import { put, del } from "@vercel/blob";

const BLOB_PREFIX = "webpresence";

export interface BlobUploadResult {
  url: string;
  pathname: string;
}

/**
 * Store HTML content in Vercel Blob
 */
export async function storeHtml(
  websiteId: string,
  pageUrl: string,
  html: string
): Promise<BlobUploadResult> {
  const timestamp = Date.now();
  const urlHash = hashUrl(pageUrl);
  const pathname = `${BLOB_PREFIX}/html/${websiteId}/${urlHash}/${timestamp}.html`;

  const blob = await put(pathname, html, {
    access: "public",
    contentType: "text/html",
  });

  return {
    url: blob.url,
    pathname,
  };
}

/**
 * Store SERP raw data in Vercel Blob
 */
export async function storeSerpData(
  websiteId: string,
  query: string,
  data: object
): Promise<BlobUploadResult> {
  const timestamp = Date.now();
  const queryHash = hashUrl(query);
  const pathname = `${BLOB_PREFIX}/serp/${websiteId}/${queryHash}/${timestamp}.json`;

  const blob = await put(pathname, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
  });

  return {
    url: blob.url,
    pathname,
  };
}

/**
 * Store sitemap data in Vercel Blob
 */
export async function storeSitemap(
  websiteId: string,
  sitemapUrl: string,
  data: object
): Promise<BlobUploadResult> {
  const timestamp = Date.now();
  const pathname = `${BLOB_PREFIX}/sitemap/${websiteId}/${timestamp}.json`;

  const blob = await put(pathname, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
  });

  return {
    url: blob.url,
    pathname,
  };
}

/**
 * Delete a blob by URL
 */
export async function deleteBlob(blobUrl: string): Promise<void> {
  try {
    await del(blobUrl);
  } catch (error) {
    console.error(`[Blob] Failed to delete ${blobUrl}:`, error);
  }
}

/**
 * Get sitemap data from blob URL
 */
export async function getSitemapData(blobUrl: string): Promise<any> {
  try {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[Blob] Failed to get sitemap data from ${blobUrl}:`, error);
    throw error;
  }
}

/**
 * Create a simple hash from a URL for file naming
 */
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export const storage = {
  storeHtml,
  storeSerpData,
  storeSitemap,
  deleteBlob,
  getSitemapData,
};
