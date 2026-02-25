import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { App, AppCatalog, SearchParams } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getCatalogPath(): string {
  if (process.env.CATALOG_PATH) {
    return resolve(process.env.CATALOG_PATH);
  }
  return resolve(__dirname, "../../../../data/catalog.json");
}

let catalog: AppCatalog | null = null;

export function loadCatalog(): AppCatalog {
  const path = getCatalogPath();
  if (!existsSync(path)) {
    const empty: AppCatalog = {
      version: "1.0",
      lastModified: new Date().toISOString(),
      apps: [],
    };
    return empty;
  }
  const raw = readFileSync(path, "utf-8");
  catalog = JSON.parse(raw) as AppCatalog;
  return catalog;
}

export function getCatalog(): AppCatalog {
  if (!catalog) {
    catalog = loadCatalog();
  }
  return catalog;
}

export function saveCatalog(cat: AppCatalog): void {
  const path = getCatalogPath();
  cat.lastModified = new Date().toISOString();
  writeFileSync(path, JSON.stringify(cat, null, 2), "utf-8");
  catalog = cat;
}

export function searchApps(params: SearchParams): App[] {
  const cat = getCatalog();
  let results = [...cat.apps];

  if (params.category) {
    const cat_lower = params.category.toLowerCase();
    results = results.filter(
      (app) => app.category.toLowerCase() === cat_lower
    );
  }

  if (params.platform && params.platform !== "both") {
    results = results.filter(
      (app) => app.platform === params.platform || app.platform === "both"
    );
  }

  if (params.max_price !== undefined) {
    results = results.filter((app) => app.price <= params.max_price!);
  }

  if (params.min_rating !== undefined) {
    results = results.filter((app) => app.rating >= params.min_rating!);
  }

  if (params.keywords) {
    const keywords = params.keywords.toLowerCase().split(/\s+/);
    results = results.filter((app) => {
      const searchText = [
        app.name,
        app.shortDescription,
        app.fullDescription,
        app.category,
        ...app.features,
      ]
        .join(" ")
        .toLowerCase();
      return keywords.some((kw) => searchText.includes(kw));
    });

    results.sort((a, b) => {
      const scoreA = keywordScore(a, keywords);
      const scoreB = keywordScore(b, keywords);
      return scoreB - scoreA;
    });
  } else {
    results.sort((a, b) => b.rating - a.rating);
  }

  return results;
}

function keywordScore(app: App, keywords: string[]): number {
  let score = 0;
  const name = app.name.toLowerCase();
  const desc = app.shortDescription.toLowerCase();
  const features = app.features.join(" ").toLowerCase();

  for (const kw of keywords) {
    if (name.includes(kw)) score += 10;
    if (desc.includes(kw)) score += 5;
    if (features.includes(kw)) score += 3;
  }

  score += app.rating;
  return score;
}

export function getAppByName(name: string): App | undefined {
  const cat = getCatalog();
  const lower = name.toLowerCase();
  return cat.apps.find(
    (app) =>
      app.name.toLowerCase() === lower ||
      app.id.toLowerCase() === lower
  );
}

export function getAppById(id: string): App | undefined {
  const cat = getCatalog();
  return cat.apps.find((app) => app.id === id);
}

export function getAlternatives(appName: string): App[] {
  const app = getAppByName(appName);
  if (!app) return [];

  const cat = getCatalog();
  return cat.apps
    .filter(
      (other) =>
        other.id !== app.id && other.category === app.category
    )
    .sort((a, b) => b.rating - a.rating);
}
