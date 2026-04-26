const { chromium } = require('playwright');

async function debug() {
    try {
        console.log('Connecting to CDP on 9222...');
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        console.log('Connected.');
        
        const page = browser.contexts()[0].pages()[0];
        console.log(`URL: ${page.url()}`);
        
        const frames = page.frames();
        console.log(`Found ${frames.length} frames.`);
        for (let i = 0; i < frames.length; i++) {
            console.log(`  Frame ${i} URL: ${frames[i].url()}`);
            console.log(`  Frame ${i} Name: ${frames[i].name()}`);
        }
        
        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

debug();
