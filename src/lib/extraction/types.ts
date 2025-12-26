export type ExtractionType = "quick" | "full";

export type ExtractionStatus =
  | "pending"
  | "extracting"
  | "completed"
  | "failed";

export interface QuickExtractionResult {
  title: string | null;
  metaDescription: string | null;
  h1: string[];
}

export interface FullExtractionResult extends QuickExtractionResult {
  headings: {
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
  };
  keywords: Array<{
    keyword: string;
    frequency: number;
    density: number;
  }>;
}

export interface ExtractionResult {
  type: ExtractionType;
  quick: QuickExtractionResult | null;
  full: FullExtractionResult | null;
  htmlBlobUrl: string;
  error?: string;
}
