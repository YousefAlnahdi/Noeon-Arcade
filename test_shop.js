const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`PAGE LOG [${msg.type()}]: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`PAGE EXCEPTION:`, err.message);
  });

  console.log("Navigating to http://localhost:3001/shop ...");
  try {
    await page.goto('http://localhost:3001/shop', { waitUntil: 'load' });
    console.log("Navigation to /shop finished. Waiting 3 seconds...");
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'shop_screenshot.png' });
    console.log("Saved shop_screenshot.png");
  } catch (e) {
    console.error("Navigation failed:", e);
  }

  await browser.close();
})();
