const { chromium } = require('playwright');
const { exec, execSync } = require('child_process');
const progPath = require('path');
const fs = require('fs');

// ===================== CONFIG =====================
const CDP_PORT = 9222;
const COPILOT_APP_PATH = 'C:\\Program Files (x86)\\Microsoft\\Copilot\\Application\\mscopilot.exe';
const PROCESS_NAME = 'mscopilot';

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
    try {
        if (fs.existsSync('task-zipped.txt')) fs.unlinkSync('task-zipped.txt');
        if (fs.existsSync('task.zip')) fs.unlinkSync('task.zip');
        execSync('powershell -Command "Compress-Archive -Path task.md -DestinationPath task.zip -Force"');
        fs.renameSync('task.zip', 'task-zipped.txt');
        log('Created task-zipped.txt');
    } catch (e) {
        log(`Warning: Failed to create zip: ${e.message}`);
    }
}

function cleanupFiles() {
    try {
        if (fs.existsSync('task.md')) fs.unlinkSync('task.md');
        if (fs.existsSync('task-zipped.txt')) fs.unlinkSync('task-zipped.txt');
    } catch (e) {}
}

// ===================== BROWSER FUNCTIONS =====================

function stopProcesses() {
    try {
        log(`Stopping existing processes...`);
        execSync(`powershell -Command "Stop-Process -Name ${PROCESS_NAME}, msedge -Force -ErrorAction SilentlyContinue"`);
    } catch (err) {}
}

async function connectToCDP() {
    try {
        return await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    } catch (e) {
        return null;
    }
}

async function launchCopilot() {
    log('Launching Copilot...');
    stopProcesses();
    await new Promise(r => setTimeout(r, 2000));
    
    const cmd = `powershell -Command "Start-Process -FilePath '${COPILOT_APP_PATH}' -ArgumentList '--remote-debugging-port=${CDP_PORT}'"`;
    log(`Executing: ${cmd}`);
    exec(cmd);
    
    log('Waiting for CDP connection...');
    let attempts = 0;
    while (attempts < 30) {
        try {
            const browser = await connectToCDP();
            if (browser) {
                log('CDP connected!');
                return browser;
            }
        } catch (err) {}
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }
    throw new Error('Failed to connect to CDP on port ' + CDP_PORT);
}

// ===================== INTERACTION =====================

async function attachFile(page) {
    const attachBtnSelector = [
        '[aria-label="Add an attachment"]',
        'button:has(svg[aria-label="Add an attachment"])',
        '#composer-create-button',
        '[data-testid="composer-create-button"]',
        'button:has(svg)',
        '.composer-create-button'
    ].join(',');

    try {
        log('Waiting for attachment button...');
        await page.waitForSelector(attachBtnSelector, { timeout: 15000 });
        const attachBtn = await page.$(attachBtnSelector);
        
        if (attachBtn) {
            log('Attachment button found. Setting up file chooser listener...');
            
            // Set up listener for file chooser event
            const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
            
            log('Clicking upload button to trigger file chooser...');
            await attachBtn.click();
            
            const fileChooser = await fileChooserPromise;
            const filePath = progPath.resolve('task-zipped.txt');
            log(`Setting files via file chooser: ${filePath}`);
            await fileChooser.setFiles(filePath);
            
            log('File uploaded successfully via file chooser.');
            await new Promise(r => setTimeout(r, 2000));
            return true;
        }
    } catch (e) {
        log(`Warning: Automatic attachment failed or timed out: ${e.message}`);
        log('Attempting direct input fallback...');
        try {
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
                await fileInput.setInputFiles(progPath.resolve('task-zipped.txt'));
                log('File uploaded via direct input fallback.');
                return true;
            }
        } catch (err) {}
    }
    return false;
}

async function sendPrompt(page, taskRequest) {
    const inputSelector = [
        'textarea[placeholder*="Message Copilot"]',
        'textarea[placeholder*="Ask"]',
        '[contenteditable="true"]',
        '[role="textbox"]',
        '#userInput',
        'textarea'
    ].join(',');

    log('Waiting for input field...');
    await page.waitForSelector(inputSelector, { state: 'visible', timeout: 30000 });
    
    const prompt = `Forget about previous conversation.
Task: ${taskRequest}
No conversational filler. No markdown code blocks.
Constraint Format:
---START---
{
    "content": "{response}"
}
---END---`;

    log('Sending prompt...');
    await page.fill(inputSelector, prompt);
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press('Enter');
}

async function waitForResponse(page) {
    log('Waiting for AI response...');
    const lastMessageSelector = [
        '[data-testid="lastChatMessage"]',
        '[role="log"] [role="presentation"]:last-child',
        '.response-message-group:last-child',
        'div[data-author="bot"]'
    ].join(',');
    
    let responseContent = "";
    let isFinished = false;
    let attempts = 0;
    const maxAttempts = 60; 

    while (!isFinished && attempts < maxAttempts) {
        try {
            const locators = await page.locator(lastMessageSelector).all();
            const lastMessageLocator = locators[locators.length - 1];
            
            if (lastMessageLocator) {
                responseContent = await lastMessageLocator.innerText();
                if (responseContent.includes("---END---")) {
                    isFinished = true;
                    log('Response complete.');
                }
            }
            
            if (!isFinished) {
                if (attempts % 5 === 0) log(`...still waiting (${attempts})`);
                await page.waitForTimeout(2000);
                attempts++;
            }
        } catch (e) {
            await page.waitForTimeout(2000);
            attempts++;
        }
    }
    
    return responseContent;
}

// ===================== OUTPUT =====================

function parseResponse(rawText) {
    const regex = /---START---([\s\S]*?)---END---/;
    const match = rawText.match(regex);

    if (match && match[1]) {
        try {
            const jsonString = match[1].replace(/```json|```/g, "").trim();
            return JSON.parse(jsonString);
        } catch (e) {
            return { error: "JSON Parse Error", raw: match[1] };
        }
    }
    return { error: "Markers not found in response", raw: rawText.substring(0, 500) };
}

// ===================== MAIN =====================

async function run(taskRequest) {
    try {
        log(`TASK: ${taskRequest}`);
        createTaskFile(taskRequest);
        createZipFile();
        
        const browser = await launchCopilot();
        
        log('Waiting for page...');
        await new Promise(r => setTimeout(r, 5000)); 
        
        const contexts = browser.contexts();
        const page = contexts[0].pages()[0];
        if (!page) throw new Error('No page found');
        log(`Connected to: ${page.url()}`);

        await attachFile(page);
        await sendPrompt(page, taskRequest);
        
        const rawResponse = await waitForResponse(page);
        const result = parseResponse(rawResponse);
        
        console.log('\n--- FINAL RESPONSE ---');
        console.log(JSON.stringify(result, null, 2));
        console.log('----------------------\n');
        
        cleanupFiles();
        log('Closing browser...');
        await browser.close();
        log('Done.');
        
    } catch (e) {
        log(`FATAL ERROR: ${e.message}`);
        cleanupFiles();
    }
}

const taskInput = process.argv.slice(2).join(' ') || 'Say hello';
run(taskInput);