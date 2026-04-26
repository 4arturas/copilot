const { chromium } = require('playwright');
const http = require('http');

async function getTargets() {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function debug() {
    try {
        const targets = await getTargets();
        const chatTarget = targets.find(t => t.url.includes('copilot.microsoft.com'));
        
        if (!chatTarget) {
            console.log('Chat target not found');
            return;
        }
        
        console.log(`Connecting to: ${chatTarget.webSocketDebuggerUrl}`);
        const browser = await chromium.connectOverCDP(chatTarget.webSocketDebuggerUrl);
        
        const contexts = browser.contexts();
        console.log(`Contexts: ${contexts.length}`);
        if (contexts.length > 0) {
            const pages = contexts[0].pages();
            console.log(`Pages: ${pages.length}`);
            if (pages.length > 0) {
                console.log(`Page URL: ${pages[0].url()}`);
            }
        }
        
        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

debug();
