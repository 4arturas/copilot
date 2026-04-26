const fs = require('fs');
const path = require('path');

const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL = 'qwen3.5:397b-cloud'; // This model gives good result - but it is slow
// const MODEL = 'qwen2.5:7b'; // This model gives bad result
// const MODEL = 'qwen2.5-coder:0.5b';  // This model gives bad result
// const MODEL = 'qwen2.5-coder:3b';  // This model gives bad result
// const MODEL = 'deepseek-coder:6.7b';  // This model gives bad result

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
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.response;
    } catch (e) {
        log(`API Error: ${e.message}`);
        throw e;
    }
}

async function runWithOllama(taskFile = 'task-progress-openedge-4g.md') {
    try {
        log(`Reading task file: ${taskFile}`);
        
        if (!fs.existsSync(taskFile)) {
            log(`Task file not found: ${taskFile}`);
            
            const { generateTask } = require('./copilot-progress-openedge-4g.js');
            generateTask();
            log('Generated new task file');
        }
        
        const taskContent = fs.readFileSync(taskFile, 'utf8');
        log(`Task content: ${taskContent.length} chars`);
        
        const prompt = `Task file content:

${taskContent}

Read the task above and implement the requested changes. Return only the code.`;
        
        log('Sending task to Ollama...');
        const response = await callOllama(prompt);
        
        log('\n=== Response from Ollama ===\n');
        console.log(response);
        console.log('\n============================\n');
        
        fs.writeFileSync('ollama-response.txt', response);
        log('Response saved to ollama-response.txt');
        
    } catch (e) {
        log(`ERROR: ${e.message}`);
    }
}

if (require.main === module) {
    const taskFile = process.argv[2] || 'task-progress-openedge-4g.md';
    runWithOllama(taskFile);
}

module.exports = { runWithOllama, callOllama };