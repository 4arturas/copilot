const { chromium } = require('playwright');
const { exec, execSync } = require('child_process');
const progPath = require('path');
const nodeProcess = require('process');

const port = 9222;

const exePath = 'C:\\Program Files (x86)\\Microsoft\\Copilot\\Application\\mscopilot.exe';

(async () => {
    try {
        console.log("Exe path:", exePath);

        try {
            execSync('powershell -Command "Stop-Process -Name mscopilot -Force -ErrorAction SilentlyContinue"');
        } catch(e) {}

        const launchCmd = `powershell -Command "Start-Process -FilePath '${exePath}' -ArgumentList '--remote-debugging-port=${port}'"`;
        console.log("Launching...");
        exec(launchCmd);

        await new Promise(r => setTimeout(r, 5000));

        console.log("Connecting CDP...");
        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        console.log("Connected!");
        const contextPage = browser.contexts()[0];
        
        const contexts = browser.contexts();
        let targetPage;
        
        console.log(`Found ${contexts.length} contexts`);
        for (const ctx of contexts) {
            const pages = ctx.pages();
            for (const p of pages) {
                console.log(`Page: ${p.url()}`);
                if (p.url().includes('copilot') || p.url().includes('bing')) {
                    targetPage = p;
                }
            }
        }
        
        if (!targetPage) {
            console.log("Could not find copilot page target by URL, using fallback to first page.");
            targetPage = contexts[0].pages()[0];
        }
        
        if (!targetPage) {
            console.log("No page targets found at all!");
            await browser.close();
            return;
        }
        
        console.log("Target page URL:", targetPage.url());

        console.log("Looking for input box on target page...");
        const inputSelector = 'textarea[placeholder*="Ask"], [contenteditable="true"], [role="textbox"], textarea, input';
        await targetPage.waitForSelector(inputSelector, { state: 'visible', timeout: 15000 });
        console.log("Found input box!");

        await browser.close();
        console.log("Done");
    } catch (e) {
        console.error(e);
    }
})();
