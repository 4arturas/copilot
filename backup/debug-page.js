const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const page = browser.contexts()[0].pages().find(p => p.url().includes('copilot'));
    await page.screenshot({path: 'page-state.png'});
    
    console.log('Title:', await page.title());
    console.log('URL:', page.url());
    
    const input = await page.$('textarea, [contenteditable], [role=textbox]');
    console.log('Input found:', !!input);
    
    const text = await page.locator('body').innerText();
    console.log('Body:', text.substring(0, 300));
    
    await browser.close();
})();