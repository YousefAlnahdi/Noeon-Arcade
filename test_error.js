const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`PAGE LOG [${msg.type()}]: ${msg.text()}`);
    // If it's an error, log the location/trace
    if (msg.type() === 'error') {
      console.log('Trace details:', msg.location());
    }
  });

  page.on('pageerror', err => {
    console.log(`PAGE EXCEPTION:`, err.message);
    console.log(err.stack);
  });

  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED: ${request.url()} - ${request.failure() ? request.failure().errorText : '404/error'}`);
  });

  console.log("Navigating to http://localhost:3001/gridrunner ...");
  try {
    await page.goto('http://localhost:3001/gridrunner', { waitUntil: 'load' });
    console.log("Navigation finished. Waiting 5 seconds...");
    await new Promise(r => setTimeout(r, 5000));
  } catch (e) {
    console.error("Navigation failed:", e);
  }

  await browser.close();
})();
