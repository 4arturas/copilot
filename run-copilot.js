const { chromium } = require('playwright');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CDP_PORT = 9222;
const COPILOT_URL = 'https://copilot.microsoft.com';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

function createTaskFile(taskContent, fileName) {
    fs.writeFileSync(fileName, taskContent);
    log(`Created ${fileName}`);
}

function cleanupFiles(fileName) {
    try {
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
    } catch (e) {}
}

async function connectToEdge() {
    try {
        return await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    } catch (e) {
        return null;
    }
}

async function launchEdgeWithCDP() {
    log('Launching Edge with CDP...');
    
    const userDataDir = path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');
    const cmd = `powershell -Command "Start-Process -FilePath '${EDGE_PATH}' -ArgumentList '--remote-debugging-port=${CDP_PORT}','--user-data-dir=${userDataDir}','${COPILOT_URL}'"`;
    exec(cmd);
    
    let attempts = 0;
    while (attempts < 20) {
        try {
            const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
            return browser;
        } catch (err) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;
        }
    }
    throw new Error('Failed to launch Edge with CDP');
}

async function getBrowser() {
    let browser = await connectToEdge();
    
    if (!browser) {
        log('Launching new Edge with CDP...');
        browser = await launchEdgeWithCDP();
        log('Edge launched and connected');
    } else {
        log('Connected to existing Edge');
    }
    
    return browser;
}

async function findCopilotPage(browser) {
    let page = browser.contexts()[0].pages().find(p => 
        p.url().includes('copilot.microsoft.com') && 
        !p.url().startsWith('data:')
    );
    
    if (!page) {
        page = browser.contexts()[0].pages().find(p => 
            !p.url().startsWith('data:') && 
            !p.url().startsWith('chrome:') &&
            !p.url().startsWith('about:')
        );
    }
    
    if (!page || page.url().startsWith('data:')) {
        page = browser.contexts()[0].newPage();
        await page.goto(COPILOT_URL);
        log('Navigated to copilot.microsoft.com');
    }
    
    return page;
}

async function closePopups(page) {
    try {
        const closeBtns = await page.locator(
            'button:has-text("Not now"), button:has-text("Close"), [aria-label="Close"]'
        ).all();
        
        for (const btn of closeBtns) {
            try { await btn.click(); } catch(e) {}
        }
    } catch (e) {}
    
    await new Promise(r => setTimeout(r, 500));
}

async function attachFile(page, fileName) {
    const attachBtn = await page.$('#composer-create-button, [data-testid="composer-create-button"], button[aria-label="Attach file"]');
    
    if (attachBtn) {
        log('Clicking + button to attach file...');
        await attachBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.setInputFiles(path.join(process.cwd(), fileName));
            log(`File uploaded: ${fileName}`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

async function sendPromptToCopilot(page, prompt) {
    // Wait a bit after file upload for Copilot to process
    log('Waiting for Copilot to process uploaded file...');
    await new Promise(r => setTimeout(r, 5000));
    
    // Try to click on the main chat area to focus input
    try {
        const chatContainer = await page.$('#searchbox, [role="searchbox"], [aria-label*="Search"]');
        if (chatContainer) {
            await chatContainer.click();
            log('Clicked on search box area');
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (e) {
        log('Could not click on search box');
    }
    
    // Use keyboard to type and press Enter - works from anywhere in the page
    log('Trying to send prompt via keyboard...');
    await page.keyboard.type(prompt, { delay: 20 });
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press('Enter');
    
    log('Prompt sent via keyboard');
    return true;
}

async function waitForCopilotResponse(page, maxWaitMs = 180000) {
    log('Waiting for Copilot response...');
    
    const startTime = Date.now();
    let previousContent = '';
    
    while (Date.now() - startTime < maxWaitMs) {
        try {
            // Try different selectors to find the response
            const selectors = [
                '[role="log"]',
                '[data-testid="message-area"]',
                '[data-testid="content"]',
                '.message-content',
                'copilot-response'
            ];
            
            for (const sel of selectors) {
                const el = await page.$(sel);
                if (el) {
                    const content = await el.innerText();
                    if (content && content.length > previousContent.length && content.length > 20) {
                        log(`Got response: ${content.substring(0, 100)}...`);
                        return content;
                    }
                }
            }
        } catch (e) {}
        
        await new Promise(r => setTimeout(r, 3000));
    }
    
    log('Timeout - returning whatever we have');
    return previousContent;
}

function extractResponseText(fullText) {
    if (!fullText) return '';
    
    // Just return the full content for now
    return fullText.trim();
}

function printResponse(response) {
    console.log('\n========================================');
    console.log(response);
    console.log('========================================\n');
}

async function runMicrosoftCopilot(taskFile = 'task-progress-openedge-4g.md') {
    try {
        const taskContent = fs.readFileSync(taskFile, 'utf8');
        
        log(`Using task file: ${taskFile}`);
        
        createTaskFile(taskContent, taskFile);
        
        const browser = await getBrowser();
        
        const page = await findCopilotPage(browser);
        log(`Using page: ${page.url()}`);
        
        await page.waitForLoadState('networkidle');
        await closePopups(page);
        
        await attachFile(page, taskFile);
        
        const prompt = `Read and implement the requested changes in the uploaded file ${taskFile}. Return only the code.`;
        await sendPromptToCopilot(page, prompt);
        
        const fullText = await waitForCopilotResponse(page);
        const response = extractResponseText(fullText);
        
        printResponse(response);
        
        fs.writeFileSync('copilot-response.txt', response);
        log('Response saved to copilot-response.txt');
        
        cleanupFiles(taskFile);
        
        await browser.close();
        
        log('Done');
        return response;
        
    } catch (e) {
        log(`FATAL ERROR: ${e.message}`);
        cleanupFiles(taskFile);
        throw e;
    }
}

module.exports = { runMicrosoftCopilot };

if (require.main === module) {
    runMicrosoftCopilot('task-progress-openedge-4g.md');
}