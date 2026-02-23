export interface App {
  id: string;
  name: string;
  platform: "ios" | "android" | "both";
  category: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  shortDescription: string;
  fullDescription: string;
  features: string[];
  pros: string[];
  cons: string[];
  developer: string;
  appStoreUrl: string;
  playStoreUrl?: string;
  iconUrl?: string;
  screenshotUrls: string[];
  lastUpdated: string;
  addedAt: string;
}

export interface AppCatalog {
  version: string;
  lastModified: string;
  apps: App[];
}

export interface QueryLog {
  timestamp: string;
  tool: string;
  params: Record<string, unknown>;
  resultsCount: number;
  appsReturned: string[];
}

export interface SearchParams {
  keywords?: string;
  category?: string;
  platform?: "ios" | "android" | "both";
  max_price?: number;
  min_rating?: number;
}
