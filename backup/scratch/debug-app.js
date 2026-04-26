const { chromium } = require('playwright');

async function debug() {
    try {
        console.log('Connecting to CDP on 9222...');
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        console.log('Connected.');
        
        const page = browser.contexts()[0].pages()[0];
        console.log(`URL: ${page.url()}`);
        
        const content = await page.content();
        console.log(`Content length: ${content.length}`);
        // console.log(content.substring(0, 1000));
        
        // Check for common selectors
        const input = await page.$('textarea, [contenteditable="true"]');
        console.log(`Input found: ${!!input}`);
        
        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

debug();
