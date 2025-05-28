const express = require("express");
const { chromium } = require("playwright");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/ping", (req, res) => {
  res.json({ success: true, message: "Pong! 🏓", timestamp: Date.now() });
});

app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url)
    return res.status(400).json({ success: false, error: "URL faltante." });

  try {
    const htmlContent = await scrapeAndGenerateHTML(url);
    res.json({ success: true, pdfPath: htmlContent });
  } catch (error) {
    console.error("Error al hacer scraping:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/generate-pdf", async (req, res) => {
  const { template } = req.body;
  if (!template) return res.status(400).send("Falta el HTML.");

  const htmlPath = path.join(__dirname, "temp.html");

  try {
    await fs.writeFile(htmlPath, template);

    const browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf(); // Puedes enviar esto si necesitas enviarlo como archivo

    await browser.close();
    await fs.unlink(htmlPath);
    res.status(200).send("PDF generado correctamente");
  } catch (error) {
    console.error("Error al generar PDF:", error);
    res.status(500).send("Error al generar PDF");
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

// Utilidades

const isAlbum = (url) => url.split("/")[3]?.includes("albums");

const generateHtmlTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kindle-Genius</title>
</head>
<body>
  ${content}
</body>
</html>`;

async function scrapeAndGenerateHTML(url) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const isAnAlbum = isAlbum(url);
  const content = isAnAlbum
    ? await getAlbumContent(page)
    : await getSongContent(page);

  await browser.close();
  return generateHtmlTemplate(content);
}

async function getSongContent(page) {
  await page.waitForSelector("h1");
  const title = await page.$eval("h1", (el) => el.outerHTML);

  await page.waitForSelector(
    "#lyrics-root-pin-spacer div[data-lyrics-container]"
  );
  const sections = await page.$$eval(
    "#lyrics-root-pin-spacer div[data-lyrics-container]",
    (nodes) => nodes.map((n) => n.outerHTML)
  );

  return `${title}${sections.join("<br>")}`;
}

async function getAlbumContent(page) {
  await page.waitForSelector("album-tracklist-row a");

  const links = await page.$$eval("album-tracklist-row a", (items) =>
    [...items].map((item) => item.href)
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
