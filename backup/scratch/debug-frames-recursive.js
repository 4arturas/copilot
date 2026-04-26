const { chromium } = require('playwright');

async function debug() {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const page = browser.contexts()[0].pages()[0];
        
        console.log('Main Frame URL:', page.mainFrame().url());
        const children = page.mainFrame().childFrames();
        console.log('Child Frames:', children.length);
        for (let i = 0; i < children.length; i++) {
            console.log(`  Child ${i} URL: ${children[i].url()}`);
        }
        
        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

debug();
