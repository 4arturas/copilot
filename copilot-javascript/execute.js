const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RESPONSE_FILE = 'ollama-response.txt';
const OUTPUT_JS = 'generated-implementation.js';
const OUTPUT_TXT = 'execution-output.txt';
const IS_FIRST_RUN_FILE = '.first-run';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL = 'qwen3.5:397b-cloud';

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function callOllama(prompt) {
    log('Calling Ollama API...');
    
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                prompt: prompt,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.response;
    } catch (e) {
        log(`API Error: ${e.message}`);
        throw e;
    }
}

function isFirstRun() {
    if (fs.existsSync(IS_FIRST_RUN_FILE)) {
        const content = fs.readFileSync(IS_FIRST_RUN_FILE, 'utf8').trim();
        return content === 'true';
    }
    return true;
}

function deleteFirstRunMarker() {
    if (fs.existsSync(IS_FIRST_RUN_FILE)) {
        fs.unlinkSync(IS_FIRST_RUN_FILE);
        log('First-run marker deleted');
    }
}

function markFirstRunDone() {
    fs.writeFileSync(IS_FIRST_RUN_FILE, 'false');
    log('First-run marker set to false');
}

function cleanOutputFiles() {
    if (fs.existsSync(OUTPUT_JS)) {
        fs.unlinkSync(OUTPUT_JS);
        log(`Deleted: ${OUTPUT_JS}`);
    }
    if (fs.existsSync(OUTPUT_TXT)) {
        fs.unlinkSync(OUTPUT_TXT);
        log(`Deleted: ${OUTPUT_TXT}`);
    }
}

function extractCode(responseText) {
    const regex = /\{CODE_START\}([\s\S]*?)\{CODE_END\}/;
    const match = responseText.match(regex);
    if (match && match[1]) {
        return match[1].trim();
    }
    return null;
}

function saveCode(code, filePath) {
    fs.writeFileSync(filePath, code);
    log(`Saved: ${filePath} (${code.length} chars)`);
}

function executeCode(filePath) {
    log(`Executing: ${filePath}...`);
    
    try {
        const output = execSync(`node "${filePath}"`, {
            encoding: 'utf8',
            timeout: 60000
        });
        return { success: true, output: output };
    } catch (e) {
        return { success: false, output: `Error: ${e.message}` };
    }
}

function saveOutput(output, filePath) {
    fs.writeFileSync(filePath, output);
    log(`Saved: ${filePath}`);
}

async function askLlmIfHappy(code, executionOutput) {
    log('\n=== Asking LLM if happy with result ===');
    
    const prompt = `You are reviewing code execution results.

CODE THAT WAS EXECUTED:
${code}

EXECUTION OUTPUT:
${executionOutput}

Decide if you are happy with this result. Respond with EXACTLY one of:
- YES if the output is correct, complete, and no errors occurred
- NO followed by a brief reason if there are issues

Examples:
- YES - output is correct and complete
- NO - there is an error in the output
- NO - output is missing expected data
- NO - code crashed with exception`;

    try {
        const response = await callOllama(prompt);
        log('LLM response: ' + response.substring(0, 100));
        
        const isHappy = response.trim().startsWith('YES');
        return { happy: isHappy, response: response };
    } catch (e) {
        log('Failed to ask LLM: ' + e.message);
        return { happy: false, response: 'Error asking LLM' };
    }
}

async function run() {
    const firstRun = isFirstRun();
    deleteFirstRunMarker();
    
    if (firstRun) {
        log('=== FIRST RUN: Cleaning old output files ===');
        cleanOutputFiles();
    }
    
    const { generateTask } = require('./task-generator.js');
    const runOllama = require('./run-ollama-javascript.js');
    
    let maxAttempts = 3;
    let attempt = 1;
    
    while (attempt <= maxAttempts) {
        log(`\n=== Attempt ${attempt}/${maxAttempts} ===`);
        
        generateTask();
        
        try {
            await runOllama.runWithOllama('task-javascript.md');
        } catch (e) {
            log(`Ollama failed: ${e.message}`);
            attempt++;
            if (attempt <= maxAttempts) log('Retrying...');
            continue;
        }
        
        if (!fs.existsSync(RESPONSE_FILE)) {
            log('ERROR: Response file not found');
            attempt++;
            continue;
        }
        
        const responseText = fs.readFileSync(RESPONSE_FILE, 'utf8');
        
        const code = extractCode(responseText);
        if (!code) {
            log('ERROR: Could not find {CODE_START}...{CODE_END} markers');
            attempt++;
            continue;
        }
        
        saveCode(code, OUTPUT_JS);
        
        const result = executeCode(OUTPUT_JS);
        
        log('\n=== Execution Output ===');
        console.log(result.output);
        log('========================\n');
        
        saveOutput(result.output, OUTPUT_TXT);
        
        const llmFeedback = await askLlmIfHappy(code, result.output);
        
        if (llmFeedback.happy) {
            log('=== LLM IS HAPPY - SUCCESS ===');
            markFirstRunDone();
            return true;
        } else {
            log(`LLM is NOT happy: ${llmFeedback.response}`);
            if (attempt < maxAttempts) {
                log('Will regenerate code...');
            }
        }
        
        attempt++;
    }
    
    log('=== MAX ATTEMPTS REACHED ===');
    markFirstRunDone();
    return false;
}

if (require.main === module) {
    run().then(success => {
        if (!success) {
            process.exit(1);
        }
    }).catch(e => {
        console.error('Fatal error:', e);
        process.exit(1);
    });
}

module.exports = { run };