const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`PAGE LOG: [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`PAGE ERROR: ${err.toString()}`);
  });

  console.log("Navigating to http://localhost:3001/gridrunner ...");
  await page.goto('http://localhost:3001/gridrunner', { waitUntil: 'networkidle2' });

  // Take screenshot of menu
  await page.screenshot({ path: 'menu_screenshot.png' });
  console.log("Saved menu_screenshot.png");

  console.log("Looking for 'INITIATE NEURAL GRIDRUN' button...");
  const buttons = await page.$$('button');
  let startButton = null;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes("INITIATE NEURAL GRIDRUN") || text.includes("ENGAGE") || text.includes("CONFRONT")) {
      startButton = btn;
      break;
    }
  }

  if (startButton) {
    console.log("Clicking 'INITIATE NEURAL GRIDRUN' button...");
    await startButton.click();
    console.log("Waiting 3 seconds to see if canvas updates...");
    await new Promise(r => setTimeout(r, 3000));
    
    // Take screenshot after clicking start
    await page.screenshot({ path: 'gameplay_screenshot.png' });
    console.log("Saved gameplay_screenshot.png");

    // Check if the canvas size is correct and it is visible
    const canvasDetails = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return 'No canvas found';
      return {
        width: canvas.width,
        height: canvas.height,
        styleWidth: canvas.style.width,
        styleHeight: canvas.style.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        visible: canvas.getBoundingClientRect()
      };
    });
    console.log("Canvas details:", JSON.stringify(canvasDetails, null, 2));

  } else {
    console.log("Start button not found!");
  }

  await browser.close();
})();
