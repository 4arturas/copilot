const { chromium } = require('playwright');

async function debug() {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        const page = browser.contexts()[0].pages()[0];
        
        console.log('Main URL:', page.url());
        
        // Wait a bit
        await new Promise(r => setTimeout(r, 5000));
        
        const frames = page.frames();
        console.log('Total frames:', frames.length);
        for (const f of frames) {
            console.log(`- Frame: ${f.url()} (Name: ${f.name()})`);
        }
        
        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

debug();
