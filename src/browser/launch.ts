import { chromium, Browser } from "playwright";

export async function launchBrowser(): Promise<Browser> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  return browser;
}
