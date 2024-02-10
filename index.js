const express = require("express");
const { chromium } = require("playwright");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs").promises;
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const emailSender = process.env.NODEMAILER_EMAIL_SENDER;
const emailPassword = process.env.NODEMAILER_EMAIL_PASSSWORD_SENDER;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  const items = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
    { id: 3, name: "Item 3" },
  ];

  res.json(items);
});

app.post("/scrape", async (req, res) => {
  const userURL = req.body.url;

  try {
    const pdfPath = await scrapeAndGeneratePDF(userURL);
    res.json({ success: true, pdfPath });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const isAlbum = (url) => {
  return url.split("/")[3].includes("albums");
};

const getPageTitle = async (page) => {
  const pageTitleEl = await page.$("h1");
  if (!pageTitleEl) {
    throw new Error("No se encontró el elemento h1 en la página.");
  }

  return await pageTitleEl.innerText();
};

const getSongTemplate = async (page) => {
  await page.waitForSelector("#lyrics-root-pin-spacer");

  await page.waitForSelector("h1");
  const title = await page.evaluate(
    () => document.querySelector("h1").outerHTML
  );

  const lyricsSections = await page.evaluate(() => {
    const lyricsPartsNodeList = document.querySelectorAll(
      "#lyrics-root-pin-spacer div[data-lyrics-container]"
    );

    const lyricsParts = [];
    for (let part of lyricsPartsNodeList) {
      lyricsParts.push(part.outerHTML);
    }
    return lyricsParts;
  });

  const htmlTemplate = `
    ${title}${lyricsSections.map((el) => el + "<br>").join("")}
  `;

  return htmlTemplate;
};

const getAlbumTemplate = async (page) => {
  await page.waitForSelector("album-tracklist-row a");
  const links = await page.evaluate(() => {
    const items = document.querySelectorAll("album-tracklist-row a");

    const links = [];
    for (let item of items) {
      links.push(item.href);
    }
    return links;
  });

  let template = "";

  for (let link of links) {
    await page.goto(link, { waitUntil: "domcontentloaded" });
    const songTemplate = await getSongTemplate(page);
    template += songTemplate;

    await page.waitForTimeout(1000);
  }

  return template;
};

const generateHtmlTemplate = (template) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kindle-Genius</title>
    </head>
    <body>
      ${template}
    </body>
    </html>
  `;
};

const scrapeAndGeneratePDF = async (userURL) => {
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    if (!userURL) {
      return "Necesito la URL como argumento.";
    }

    const isAnAlbum = isAlbum(userURL);

    await page.goto(userURL, {
      waitUntil: "domcontentloaded",
    });

    const pdfTitle = await getPageTitle(page);
    let template = "";

    if (isAnAlbum) {
      template = await getAlbumTemplate(page);
    } else {
      template = await getSongTemplate(page);
    }

    const newHtmlContent = generateHtmlTemplate(template);
    await context.close();
    await browser.close();
    return newHtmlContent;
  } catch (error) {
    console.error("Error:", error);
  }
};

app.post("/generate-pdf", async (req, res) => {
  const htmlContent = req.body.template; // HTML content as a string

  try {
    // Save the HTML content to a temporary file
    const htmlPath = path.join(__dirname, "temp.html");
    await fs.writeFile(htmlPath, htmlContent);

    // Launch Puppeteer
    const browser = await chromium.launch({
      headless: true,
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Load the HTML file into the page
    await page.goto(`file://${htmlPath}`, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf();

    await context.close();
    await browser.close();

    await fs.unlink(htmlPath);

    const email = req.body.email;
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: emailSender,
        pass: emailPassword,
      },
    });

    await transporter.sendMail({
      from: '"lyricss kindle 👻" <brandon7.7porcel@gmail.com>',
      to: email,
      subject: "convert",
      attachments: [
        {
          filename: "archivo.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
      html: '<div dir="auto"></div>',
    });

    res.status(200).send("PDF generado y enviado correctamente");
  } catch (error) {
    console.error("Error al generar o enviar el PDF:", error);
    res.status(500).send("Error al generar o enviar el PDF");
  }
});

app.listen(port, () => {
  console.log(`Servidor en http://localhost:${port}`);
});
