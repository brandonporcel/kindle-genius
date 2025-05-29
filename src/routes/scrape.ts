import { Page } from "playwright";

import { launchBrowser } from "../browser/launch";
import { isAlbum } from "../utils/isAlbum";
import { Router } from "express";

const router = Router();

async function scrapeAndGenerateHTML(url: string): Promise<string> {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const content = isAlbum(url)
    ? await getAlbumContent(page)
    : await getSongContent(page);

  await browser.close();
  return content;
}

async function getSongContent(page: Page): Promise<string> {
  await page.waitForSelector("h1");
  const title = await page.$eval("h1", (el) => el.outerHTML);

  await page.waitForSelector(
    "#lyrics-root-pin-spacer div[data-lyrics-container]"
  );

  const cleanedHtml = await page.$eval(
    "#lyrics-root-pin-spacer div[data-lyrics-container]",
    (el) => {
      const headers = el.querySelectorAll(
        'div[class*="LyricsHeader__Container"]'
      );
      headers.forEach((header) => header.remove());

      return el.outerHTML;
    }
  );

  return `${title}<br />${cleanedHtml}`;
}

async function getAlbumContent(page: Page): Promise<string> {
  await page.waitForSelector("album-tracklist-row a");

  const links = await page.$$eval("album-tracklist-row a", (items) =>
    [...items].map((item: any) => item.href)
  );

  let fullContent = "";

  for (const link of links) {
    await page.goto(link, { waitUntil: "domcontentloaded" });
    const songContent = await getSongContent(page);
    fullContent += songContent + "<hr />";
    await page.waitForTimeout(1000);
  }

  return fullContent;
}

router.post("/scrape", async (req: any, res: any) => {
  const { url } = req.body;
  if (!url)
    return res.status(400).json({ success: false, error: "URL faltante." });

  try {
    const htmlContent = await scrapeAndGenerateHTML(url);
    res.json({ success: true, pdfPath: htmlContent });
  } catch (error: any) {
    console.error("Error al hacer scraping:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
