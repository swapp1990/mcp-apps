#!/usr/bin/env node

/**
 * CLI script to import apps from the iTunes Search API into the catalog.
 *
 * Usage:
 *   node build/scripts/import-app.js --search "Vacation Photos"
 *   node build/scripts/import-app.js --id 6467860498
 *   node build/scripts/import-app.js --url "https://apps.apple.com/us/app/vacation-photos/id6467860498"
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { App, AppCatalog } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATALOG_PATH = resolve(__dirname, "../../data/catalog.json");

function ensureDataDir(): void {
  const dir = dirname(CATALOG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadCatalog(): AppCatalog {
  ensureDataDir();
  if (!existsSync(CATALOG_PATH)) {
    return { version: "1.0", lastModified: new Date().toISOString(), apps: [] };
  }
  return JSON.parse(readFileSync(CATALOG_PATH, "utf-8")) as AppCatalog;
}

function saveCatalog(catalog: AppCatalog): void {
  ensureDataDir();
  catalog.lastModified = new Date().toISOString();
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");
}

function extractIdFromUrl(url: string): string | null {
  const match = url.match(/\/id(\d+)/);
  return match ? match[1] : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface ITunesResult {
  trackId: number;
  trackName: string;
  bundleId: string;
  description: string;
  price: number;
  currency: string;
  averageUserRating: number;
  userRatingCount: number;
  primaryGenreName: string;
  artistName: string;
  trackViewUrl: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  screenshotUrls?: string[];
  currentVersionReleaseDate: string;
  version: string;
}

function mapCategory(genre: string): string {
  const mapping: Record<string, string> = {
    "Photo & Video": "Photography",
    Photography: "Photography",
    Productivity: "Productivity",
    Travel: "Travel",
    Navigation: "Travel",
    "Developer Tools": "Developer Tools",
    Utilities: "Utilities",
    Education: "Education",
    Entertainment: "Entertainment",
    Finance: "Finance",
    "Health & Fitness": "Health & Fitness",
    Music: "Music",
    "News": "News",
    "Social Networking": "Social",
    Weather: "Weather",
    "Food & Drink": "Food & Drink",
    Business: "Business",
    Reference: "Reference",
  };
  return mapping[genre] || genre;
}

async function fetchFromItunes(
  query: string,
  isId: boolean
): Promise<ITunesResult[]> {
  let url: string;
  if (isId) {
    url = `https://itunes.apple.com/lookup?id=${query}&entity=software`;
  } else {
    url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&limit=5`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`iTunes API returned ${response.status}`);
  }

  const data = (await response.json()) as { results: ITunesResult[] };
  return data.results;
}

function itunesResultToApp(result: ITunesResult): App {
  const id = slugify(result.trackName);

  return {
    id,
    name: result.trackName,
    platform: "ios",
    category: mapCategory(result.primaryGenreName),
    price: result.price || 0,
    currency: result.currency || "USD",
    rating: Math.round((result.averageUserRating || 0) * 10) / 10,
    reviewCount: result.userRatingCount || 0,
    shortDescription: result.description.split("\n")[0].slice(0, 200),
    fullDescription: result.description.slice(0, 1000),
    features: [],
    pros: [],
    cons: [],
    developer: result.artistName,
    appStoreUrl: result.trackViewUrl,
    iconUrl: result.artworkUrl512 || result.artworkUrl100,
    screenshotUrls: result.screenshotUrls || [],
    lastUpdated: result.currentVersionReleaseDate,
    addedAt: new Date().toISOString(),
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log('  import-app --search "App Name"');
    console.log("  import-app --id 123456789");
    console.log('  import-app --url "https://apps.apple.com/..."');
    process.exit(0);
  }

  const flag = args[0];
  const value = args[1];

  if (!value) {
    console.error(`Missing value for ${flag}`);
    process.exit(1);
  }

  let results: ITunesResult[];

  if (flag === "--url") {
    const id = extractIdFromUrl(value);
    if (!id) {
      console.error("Could not extract app ID from URL");
      process.exit(1);
    }
    results = await fetchFromItunes(id, true);
  } else if (flag === "--id") {
    results = await fetchFromItunes(value, true);
  } else if (flag === "--search") {
    results = await fetchFromItunes(value, false);
  } else {
    console.error(`Unknown flag: ${flag}. Use --search, --id, or --url`);
    process.exit(1);
  }

  if (results.length === 0) {
    console.log("No results found.");
    process.exit(0);
  }

  const catalog = loadCatalog();

  for (const result of results) {
    const app = itunesResultToApp(result);

    // Check for duplicates
    const existing = catalog.apps.findIndex(
      (a) => a.id === app.id || a.appStoreUrl === app.appStoreUrl
    );

    if (existing >= 0) {
      console.log(`Updating existing: ${app.name} (${app.id})`);
      // Preserve manually set fields
      const prev = catalog.apps[existing];
      app.features = prev.features.length > 0 ? prev.features : app.features;
      app.pros = prev.pros.length > 0 ? prev.pros : app.pros;
      app.cons = prev.cons.length > 0 ? prev.cons : app.cons;
      if (prev.shortDescription !== prev.fullDescription.split("\n")[0].slice(0, 200)) {
        app.shortDescription = prev.shortDescription;
      }
      catalog.apps[existing] = app;
    } else {
      console.log(`Adding: ${app.name} (${app.id})`);
      catalog.apps.push(app);
    }
  }

  saveCatalog(catalog);
  console.log(`Catalog saved — ${catalog.apps.length} total apps`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
