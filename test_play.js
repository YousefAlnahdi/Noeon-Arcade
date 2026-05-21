const puppeteer = require('puppeteer-core');

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

  console.log("Clicking 'INITIATE NEURAL GRIDRUN'...");
  const buttons = await page.$$('button');
  let startButton = null;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes("INITIATE NEURAL GRIDRUN")) {
      startButton = btn;
      break;
    }
  }

  if (!startButton) {
    console.log("Start button not found!");
    await browser.close();
    return;
  }

  await startButton.click();
  console.log("Game started.");

  // Let's simulate pressing Spacebar to shoot continuously
  console.log("Pressing spacebar to shoot...");
  await page.keyboard.down(' ');

  // Wait 1.5 seconds while shooting and moving left/right to hit enemies
  for (let i = 0; i < 15; i++) {
    await page.keyboard.down('ArrowLeft');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.up('ArrowLeft');
    
    await page.keyboard.down('ArrowRight');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.up('ArrowRight');
  }

  await page.keyboard.up(' ');
  console.log("Stopped shooting.");

  // Take a screenshot of the state
  await page.screenshot({ path: 'after_shooting.png' });
  console.log("Saved after_shooting.png");

  // Check the score and state
  const gameStateDetails = await page.evaluate(() => {
    const scoreEl = document.querySelector('span.font-display.text-2xl.font-extrabold.text-white');
    const scoreVal = scoreEl ? scoreEl.textContent : 'Not found';
    return {
      score: scoreVal,
      enemiesCount: window.enemies ? window.enemies.length : 'window.enemies not defined'
    };
  });
  console.log("Game state details:", JSON.stringify(gameStateDetails, null, 2));

  await browser.close();
})();
