const { chromium } = require('playwright');

async function debug() {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        
        console.log('Contexts:', browser.contexts().length);
        for (const ctx of browser.contexts()) {
            const pages = ctx.pages();
            console.log(`Context has ${pages.length} pages.`);
            for (const p of pages) {
                console.log(`  Page URL: ${p.url()}`);
            }
        }
        
        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

debug();
