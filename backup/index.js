const { chromium } = require('playwright');
const { exec, execSync } = require('child_process');
const progPath = require('path');
const nodeProcess = require('process');

const REQUEST_COUNT = 20;
const port = 9222;

const args = process.argv.slice(2);
const request = args[0] || "Could you write a very short poem about coffee.";

let requestCount = 0;

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

function stopCopilotProcess(force = false) {
    if (force || requestCount >= REQUEST_COUNT) {
        try {
            execSync('powershell -Command "Stop-Process -Name mscopilot -Force -ErrorAction SilentlyContinue"');
            requestCount = 0;
        } catch (err) {}
    }
}

function getCopilotExePath() {
    return 'C:\\Program Files (x86)\\Microsoft\\Copilot\\Application\\mscopilot.exe';
}

async function isCopilotRunning() {
    try {
        const check = execSync(`powershell -Command "Get-Process mscopilot -ErrorAction SilentlyContinue"`).toString().trim();
        return check.length > 0;
    } catch (e) {
        return false;
    }
}

(async () => {
    try {
        requestCount++;
        log(`Starting request ${requestCount}/${REQUEST_COUNT}`);
        
        const exePath = getCopilotExePath();
        if (!exePath) {
            log("ERROR: Copilot executable not found.");
            return;
        }

        nodeProcess.env.NO_PROXY = "127.0.0.1,localhost";
        nodeProcess.env.no_proxy = "127.0.0.1,localhost";

        const alreadyRunning = await isCopilotRunning();

        log(`Request ${requestCount}/${REQUEST_COUNT}: Launching browsing context...`);

        // Kill existing first
        try {
            execSync('powershell -Command "Stop-Process -Name mscopilot -Force -ErrorAction SilentlyContinue"');
        } catch (e) {}
        
        await new Promise(r => setTimeout(r, 2000));

        // Launch Microsoft Edge with remote debugging
        const edgeExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
        
        const launchCmd = `powershell -Command "Start-Process -FilePath '${edgeExe}' -ArgumentList '--remote-debugging-port=${port}', '--no-first-run', '--no-default-browser-check', 'https://copilot.microsoft.com'"`;
        log(`Launch command: ${launchCmd}`);
        exec(launchCmd);

        if (!alreadyRunning) {
            await new Promise(r => setTimeout(r, 10000));
        } else {
            await new Promise(r => setTimeout(r, 2000));
        }

log("Connecting CDP...");

        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        
        const contexts = browser.contexts();
        log(`Found ${contexts.length} contexts`);
        
        let page;
        for (const ctx of contexts) {
            const pages = ctx.pages();
            log(`Context has ${pages.length} pages`);
            for (const p of pages) {
                const url = p.url();
                log(`  Page URL: ${url}`);
                if (url.includes('copilot.microsoft.com')) {
                    page = p;
                    break;
                }
            }
            if (page) break;
        }

        if (!page) {
            page = browser.contexts()[0].pages()[0];
        }
        
        if (!page) {
            log("ERROR: No page found");
            await browser.close();
            return;
        }

        log(`Using page: ${page.url()}`);

        const inputSelector = 'textarea[placeholder*="Ask"], [contenteditable="true"], [role="textbox"], textarea';
        await page.waitForSelector(inputSelector, { state: 'visible', timeout: 30000 });

        const prompt = `Forget about previous conversation.
Task: ${request}
No conversational filler. No markdown code blocks.
Constraint Format:
---START---
{
    "content": "{response}"
}
---END---`;

        await page.fill(inputSelector, prompt);
        await page.keyboard.press('Enter');

        log("Generating response...");

        const lastMessageLocator = page.locator('[data-testid="lastChatMessage"]').last();
        let responseContent = "";
        let isFinished = false;
        let attempts = 0;

        while (!isFinished && attempts < 40) {
            try {
                responseContent = await lastMessageLocator.innerText();
                if (responseContent.includes("---END---")) {
                    isFinished = true;
                } else {
                    log(`Waiting for completion... (${attempts})`);
                    await page.waitForTimeout(2000);
                    attempts++;
                }
            } catch (e) {
                await page.waitForTimeout(2000);
                attempts++;
            }
        }

        const regex = /---START---([\s\S]*?)---END---/;
        const match = responseContent.match(regex);

        let result = {};
        if (match && match[1]) {
            try {
                const jsonString = match[1].replace(/```json|```/g, "").trim();
                result = JSON.parse(jsonString);
            } catch (e) {
                result = { error: "JSON Parse Error", raw: match[1] };
            }
        } else {
            result = { error: "Markers not found", raw: responseContent };
        }

        log("Result: " + JSON.stringify(result));

        await browser.close();

        log(`Done (${requestCount}/${REQUEST_COUNT})`);
        console.log(JSON.stringify(result, null, 2));

        if (requestCount >= REQUEST_COUNT) {
            stopCopilotProcess(true);
        }

    } catch (err) {
        log("ERROR: " + err.message);
        console.error(err);
    }
})();