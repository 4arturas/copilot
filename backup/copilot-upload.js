const { chromium } = require('playwright');
const { exec, execSync } = require('child_process');
const progPath = require('path');
const fs = require('fs');

// ===================== CONFIG =====================
const CDP_PORT = 9222;
const COPILOT_URL = 'https://copilot.microsoft.com';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = progPath.join(process.env.USERPROFILE, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');

// ===================== LOGGING =====================
function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ===================== FILE FUNCTIONS =====================

function createTaskFile(taskContent) {
    fs.writeFileSync('task.md', taskContent);
    log('Created task.md');
}

function createZipFile() {
    execSync('powershell -Command "Compress-Archive -Path task.md -DestinationPath task.zip -Force"');
    fs.renameSync('task.zip', 'task-zipped.txt');
    log('Created task-zipped.txt');
}

function cleanupFiles() {
    try {
        if (fs.existsSync('task.md')) fs.unlinkSync('task.md');
        if (fs.existsSync('task-zipped.txt')) fs.unlinkSync('task-zipped.txt');
    } catch (e) {}
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
    
    const cmd = `powershell -Command "Start-Process -FilePath '${EDGE_PATH}' -ArgumentList '--remote-debugging-port=${CDP_PORT}','--user-data-dir=${USER_DATA_DIR}','${COPILOT_URL}'"`;
    exec(cmd);
    
    // Wait for Edge to start with CDP
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

// ===================== PAGE FUNCTIONS =====================

async function findCopilotPage(browser) {
    // Find copilot page - filter out internal pages
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

// ===================== INTERACTION FUNCTIONS =====================

async function attachFile(page) {
    const attachBtn = await page.$('#composer-create-button, [data-testid="composer-create-button"]');
    
    if (attachBtn) {
        log('Clicking + button to attach file...');
        await attachBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            await fileInput.setInputFiles(progPath.join(process.cwd(), 'task-zipped.txt'));
            log('File uploaded via + button');
            await new Promise(r => setTimeout(r, 1500));
        }
    }
}

async function sendPromptToCopilot(page, prompt) {
    const inputSelector = 'textarea, [contenteditable], [role=textbox]';
    const inputEl = await page.$(inputSelector);
    
    if (inputEl) {
        await inputEl.click();
        await new Promise(r => setTimeout(r, 300));
        
        await page.keyboard.type(prompt);
        await page.keyboard.press('Enter');
        log('Sent, waiting...');
    }
}

async function waitForCopilotResponse() {
    await new Promise(r => setTimeout(r, 15000));
}

// ===================== OUTPUT FUNCTIONS =====================

function extractResponseText(fullText) {
    const lines = fullText.split('\n').filter(l => l.trim().length > 0);
    let capture = false;
    let result = [];
    
    const exclude = ['Accept', 'Reject', 'More options', 'We value', 'Edit in a page', 'Smart', 'Start a group', 'Invite'];
    
    for (const line of lines) {
        if (line.includes('You said') || line.includes('Copilot said')) {
            capture = true;
        }
        
        if (capture) {
            const shouldExclude = exclude.some(ex => line.includes(ex));
            if (!shouldExclude) {
                result.push(line);
            }
        }
    }
    
    return result.join('\n').substring(0, 1500);
}

function printResponse(response) {
    console.log('\n==================================================');
    console.log(response);
    console.log('==================================================\n');
}

// ===================== MAIN =====================

async function run(taskContent) {
    try {
        // Create task files
        createTaskFile(taskContent);
        createZipFile();
        
        // Connect to browser
        const browser = await getBrowser();
        
        // Find Copilot page
        const page = await findCopilotPage(browser);
        log(`Using page: ${page.url()}`);
        
        await page.waitForLoadState('networkidle');
        await closePopups(page);
        
        // Attach file and send prompt
        await attachFile(page);
        await sendPromptToCopilot(page, taskContent);
        
        // Wait and get response
        await waitForCopilotResponse();
        const fullText = await page.locator('body').innerText();
        const response = extractResponseText(fullText);
        
        printResponse(response);
        
        // Cleanup
        cleanupFiles();
        await browser.close();
        
        log('Done');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

// ===================== ENTRY POINT =====================

const taskInput = process.argv.slice(2).join(' ') || 'Say hello';
run(taskInput);