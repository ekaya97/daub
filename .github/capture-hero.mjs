import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.setViewport({ width: 1400, height: 820, deviceScaleFactor: 2 });

const htmlPath = resolve(__dirname, 'hero-mockup.html');
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

const stage = await page.$('.stage');
await stage.screenshot({
  path: resolve(__dirname, 'hero.png'),
  type: 'png',
});

console.log('Saved .github/hero.png');
await browser.close();
