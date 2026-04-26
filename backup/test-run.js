const global = {};
const context = {
    _store: new Map(),
    get(key) { return this._store.get(key); },
    set(key, value) { this._store.set(key, value); }
};

const node = {
    status: (s) => console.log('STATUS:', JSON.stringify(s)),
    error: (e) => console.error('ERROR:', e),
    send: (m) => console.log('SENT:', JSON.stringify(m, null, 2))
};

const msg = { payload: "Say hello in one word" };

const { chromium } = require('playwright');
const { exec, execSync } = require('child_process');
const progPath = require('path');
const nodeProcess = require('process');

const REQUEST_COUNT = 20;
const port = 9222;

const request = msg.payload || "Could you write a very short poem about coffee.";

let requestCount = context.get('requestCount') || 0;
requestCount++;
context.set('requestCount', requestCount);

function stopCopilotProcess(force = false) {
    if (force || requestCount >= REQUEST_COUNT) {
        try {
            execSync('powershell -Command "Stop-Process -Name mscopilot -Force -ErrorAction SilentlyContinue"');
            context.set('requestCount', 0);
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
        console.log('Starting...');
        const exePath = getCopilotExePath();
        if (!exePath) {
            node.error("Copilot executable not found.");
            return;
        }

        console.log('Exe path:', exePath);

        nodeProcess.env.NO_PROXY = "127.0.0.1,localhost";
        nodeProcess.env.no_proxy = "127.0.0.1,localhost";

        const alreadyRunning = await isCopilotRunning();

        node.status({ fill: "blue", shape: "dot", text: `Request ${requestCount}/${REQUEST_COUNT}`});

        console.log('Launching Copilot...');
        const launchCmd = `powershell -Command "Start-Process -FilePath '${exePath}' -ArgumentList '--remote-debugging-port=${port}'"`;
        exec(launchCmd);

        if (!alreadyRunning) {
            await new Promise(r => setTimeout(r, 10000));
        } else {
            await new Promise(r => setTimeout(r, 2000));
        }

        node.status({fill:"yellow", shape:"dot", text:"Connecting CDP..."});

        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        
        // Find the actual Copilot page
        let page;
        const contexts = browser.contexts();
        for (const ctx of contexts) {
            const pages = ctx.pages();
            for (const p of pages) {
                if (p.url().includes('copilot.microsoft.com') || p.url().includes('bing.com')) {
                    page = p;
                    break;
                }
            }
            if (page) break;
        }

        if (!page) {
            // Fallback to the first available page if not found
            page = browser.contexts()[0].pages()[0] || await browser.contexts()[0].newPage();
        }

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

        node.status({fill:"green", shape:"dot", text:"Generating..."});

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
                    node.status({fill:"green", shape:"dot", text:`Generating... (${attempts})`});
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

        if (match && match[1]) {
            try {
                const jsonString = match[1].replace(/```json|```/g, "").trim();
                msg.payload = JSON.parse(jsonString);
            } catch (e) {
                msg.payload = { error: "JSON Parse Error", raw: match[1] };
            }
        } else {
            msg.payload = { error: "Markers not found", raw: responseContent };
        }

        await browser.close();

        node.status({fill:"green", shape:"ring", text:`Done (${requestCount}/${REQUEST_COUNT})`});
        node.send(msg);

        if (requestCount >= REQUEST_COUNT) {
            stopCopilotProcess(true);
        }

    } catch (err) {
        node.status({fill:"red", shape:"ring", text: err.message});
        node.error(err.message);
    }
})();