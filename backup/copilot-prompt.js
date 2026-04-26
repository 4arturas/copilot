const { chromium } = require('playwright');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ===================== CONFIG =====================
const CDP_PORT = 9222;
const COPILOT_URL = 'https://copilot.microsoft.com';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');
const PROMPT_FILES_DIR = path.join(__dirname, 'prompt-files');

// ===================== LOGGING =====================
function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

function error(msg) {
    console.error(`ERROR: ${msg}`);
}

// ===================== FILE FUNCTIONS =====================

function createTaskFile(taskContent) {
    const taskPath = path.join(PROMPT_FILES_DIR, 'task.md');
    fs.writeFileSync(taskPath, taskContent);
    log('Created task.md in prompt-files');
}

function createZipFile() {
    const zipPath = path.join(__dirname, 'task-zipped.txt');
    const tempZip = path.join(__dirname, 'task.zip');
    if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
    execSync(`powershell -Command "Compress-Archive -Path '${PROMPT_FILES_DIR}\\*' -DestinationPath '${tempZip}' -Force"`);
    fs.renameSync(tempZip, zipPath);
    log('Created task-zipped.txt');
}

// ===================== BROWSER FUNCTIONS =====================

async function connectToEdge() {
    try {
        return await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    } catch (e) {
        return null;
    }
}

async function launchEdgeWithCDP() {
    log('Launching Edge with CDP...');
    exec(`powershell -Command "Start-Process -FilePath '${EDGE_PATH}' -ArgumentList '--remote-debugging-port=${CDP_PORT}','--user-data-dir=${USER_DATA_DIR}','${COPILOT_URL}'"`);
    
    let attempts = 0;
    while (attempts < 20) {
        try {
            return await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
        } catch (err) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;
        }
    }
    throw new Error('Failed to launch Edge');
}

async function getBrowser() {
    let browser = await connectToEdge();
    if (!browser) browser = await launchEdgeWithCDP();
    return browser;
}

async function findCopilotPage(browser) {
    // Find all pages and look for copilot.microsoft.com
    let pages = browser.contexts()[0].pages();
    log(`Found ${pages.length} pages`);
    
    for (const p of pages) {
        log(`  - ${p.url()}`);
    }
    
    let page = pages.find(p => p.url().includes('copilot.microsoft.com'));
    
    // If not found, navigate to copilot
    if (!page) {
        page = pages[0];
        await page.goto(COPILOT_URL);
    }
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 3000));
    
    log(`Using page: ${page.url()}`);
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
    await new Promise(r => setTimeout(r, 1000));
}

async function attachAndSend(page, taskInput) {
    // First try + button
    const attachBtn = await page.$('#composer-create-button, [data-testid="composer-create-button"]');
    
    if (attachBtn) {
        log('Found attach button');
        await attachBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            const zipPath = path.join(__dirname, 'task-zipped.txt');
            await fileInput.setInputFiles(zipPath);
            log('File uploaded');
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    // Now type in the input field
    const selectors = [
        'textarea[placeholder*="Ask"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea',
        '[role="textbox"]'
    ];
    
    let inputEl = null;
    for (const sel of selectors) {
        inputEl = await page.$(sel);
        if (inputEl) break;
    }
    
    if (!inputEl) {
        error('Input not found');
        return false;
    }
    
    await inputEl.click();
    await new Promise(r => setTimeout(r, 500));
    
    // Type the prompt asking to modify prompt.js
    const prompt = `Read prompt.js and modify it: ${taskInput}. Return only JavaScript code.`;
    await page.keyboard.type(prompt);
    await page.keyboard.press('Enter');
    log('Sent prompt');
    
    return true;
}

async function getResponse(page) {
    // Wait for AI to respond
    await new Promise(r => setTimeout(r, 15000));
    
    const bodyText = await page.locator('body').innerText();
    
    // Look for code patterns
    const codePatterns = [
        /```javascript\n([\s\S]*?)```/,
        /```js\n([\s\S]*?)```/,
        /```\n([\s\S]*?)```/
    ];
    
    for (const pattern of codePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
            return match[1] || match[0];
        }
    }
    
    // Return last part of conversation
    const lines = bodyText.split('\n');
    return lines.slice(-30).join('\n');
}

// ===================== MAIN =====================

async function run(taskInput) {
    try {
        // Create task.md with instructions
        const taskContent = `Instructions for prompt.js:
${taskInput}

Output requirements:
- Return ONLY raw JavaScript code
- No markdown, no explanations, no code blocks
- Just the JavaScript code itself`;
        
        createTaskFile(taskContent);
        createZipFile();
        
        const browser = await getBrowser();
        const page = await findCopilotPage(browser);
        
        await closePopups(page);
        
        await attachAndSend(page, taskInput);
        
        const response = await getResponse(page);
        
        console.log('\n==================================================');
        console.log(response.substring(0, 1500));
        console.log('==================================================\n');
        
        log('Done');
    } catch (e) {
        error(e.message);
        console.error(e);
    }
}

// ===================== CLI =====================


const task = "Write two senteces poem."

run(task);