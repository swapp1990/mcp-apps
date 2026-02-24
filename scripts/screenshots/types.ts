export interface ScreenshotFixture {
  /** Used in output filename, e.g. "test" → test-light.png */
  name: string;
  /** CSS selector to wait for after render completes */
  readySelector: string;
  /** The view envelope (e.g. {__regexplayground__: true, viewType, data}) */
  envelope: Record<string, unknown>;
}

export interface AppScreenshotConfig {
  /** Matches dist/views/<app>.html */
  app: string;
  /** Default: both light and dark */
  themes?: ("light" | "dark")[];
  /** Fixture data for each screenshot */
  fixtures: ScreenshotFixture[];
}
