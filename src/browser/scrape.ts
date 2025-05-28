import { launchBrowser } from "./launch";

export async function scrapeAndGenerateHTML(url: string): Promise<string> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const content = await page.content();
  await browser.close();
  return content;
}
