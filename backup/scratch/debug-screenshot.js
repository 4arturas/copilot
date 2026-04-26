const { chromium } = require('playwright');

async function debug() {
    try {
        console.log('Connecting to CDP on 9222...');
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        console.log('Connected.');
        
        const page = browser.contexts()[0].pages()[0];
        console.log(`URL: ${page.url()}`);
        
        await page.screenshot({ path: 'scratch/debug-app.png' });
        console.log('Screenshot saved to scratch/debug-app.png');
        
        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

debug();
