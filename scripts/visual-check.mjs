import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.GAME_URL ?? "http://127.0.0.1:5173";
const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}capture=1`;
const outputDir = new URL("../test-results/", import.meta.url);

const viewports = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true }
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const viewport of viewports) {
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.isMobile ? 2 : 1,
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile
  });
  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(700);
  await page.click("#startButton");
  await page.waitForTimeout(800);

  const result = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    const sample = document.createElement("canvas");
    sample.width = 96;
    sample.height = 54;
    const ctx = sample.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
    const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
    let brightPixels = 0;
    let variedPixels = 0;
    let totalBrightness = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = r + g + b;
      totalBrightness += brightness;
      if (brightness > 26) {
        brightPixels += 1;
      }
      if (Math.max(r, g, b) - Math.min(r, g, b) > 8) {
        variedPixels += 1;
      }
    }

    const overflowNodes = [...document.querySelectorAll("button, .readout, .motion-panel, .speed-box, .modal, .meter")]
      .filter((node) => node.scrollWidth - node.clientWidth > 2 || node.scrollHeight - node.clientHeight > 2)
      .map((node) => node.id || node.className || node.tagName);

    return {
      canvasWidth: Math.round(rect.width),
      canvasHeight: Math.round(rect.height),
      brightPixels,
      variedPixels,
      averageBrightness: Math.round(totalBrightness / (data.length / 4)),
      overflowNodes
    };
  });

  await page.screenshot({
    path: fileURLToPath(new URL(`${viewport.name}.png`, outputDir)),
    fullPage: false
  });
  await context.close();

  const expectedPixels = viewport.width * viewport.height;
  const canvasArea = result.canvasWidth * result.canvasHeight;
  if (canvasArea < expectedPixels * 0.9) {
    failures.push(`${viewport.name}: canvas does not cover the viewport`);
  }
  if (result.brightPixels < 300 || result.variedPixels < 200 || result.averageBrightness < 12) {
    failures.push(`${viewport.name}: canvas appears blank or under-rendered`);
  }
  if (result.overflowNodes.length > 0) {
    failures.push(`${viewport.name}: overflowing UI nodes ${result.overflowNodes.join(", ")}`);
  }
  if (errors.length > 0) {
    failures.push(`${viewport.name}: console errors ${errors.join(" | ")}`);
  }

  console.log(`${viewport.name}:`, JSON.stringify(result));
}

await browser.close();

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
