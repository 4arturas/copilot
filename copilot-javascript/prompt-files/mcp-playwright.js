const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

// ===================== CONFIG =====================

// MCP Playwright server
const PLAYWRIGHT_MCP = {
    command: 'npx',
    args: ['-y', '@playwright/mcp']
};

// ===================== LOGGING =====================
function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

function error(msg) {
    console.error(`ERROR: ${msg}`);
}

// ===================== MCP FUNCTIONS =====================

async function createClient(command, args) {
    const transport = new StdioClientTransport({ command, args });
    const client = new Client(
        { name: 'playwright-mcp-client', version: '1.0.0' },
        { capabilities: {} }
    );
    client.transport = transport;
    await client.connect(transport);
    return client;
}

async function callTool(client, toolName, args = {}) {
    return await client.callTool({
        name: toolName,
        arguments: args
    });
}

async function listTools(client) {
    const result = await client.listTools();
    return result.tools;
}

// ===================== BROWSER TOOLS =====================

async function navigate(client, url) {
    const result = await callTool(client, 'browser_navigate', { url });
    return result;
}

async function click(client, selector) {
    const result = await callTool(client, 'browser_click', { selector });
    return result;
}

async function type(client, selector, text) {
    const result = await callTool(client, 'browser_type', { selector, text });
    return result;
}

async function pressKey(client, key) {
    const result = await callTool(client, 'browser_press_key', { key });
    return result;
}

async function screenshot(client, name = 'screenshot.png') {
    const result = await callTool(client, 'browser_take_screenshot', { name });
    return result;
}

async function runCode(client, code) {
    const result = await callTool(client, 'browser_run_code', { code: code });
    return result;
}

async function close(client) {
    return await callTool(client, 'browser_close');
}

// ===================== MAIN =====================

async function runBrowserTask(task) {
    try {
        log('Connecting to Playwright MCP...');
        const client = await createClient(PLAYWRIGHT_MCP.command, PLAYWRIGHT_MCP.args);
        
        log('Executing task: ' + task);
        
        // Navigate to example.com
        await navigate(client, 'https://example.com');
        log('Navigated to example.com');
        
        // Take screenshot
        await screenshot(client, 'example.png');
        log('Screenshot saved to example.png');
        
        // Run custom code to get page title
        const titleResult = await runCode(client, "return document.title");
        log('Page title: ' + (titleResult.content?.[0]?.text || 'unknown'));
        
        // Close browser
        await close(client);
        
        log('Done');
    } catch (e) {
        error(e.message);
    }
}

async function runDemo() {
    console.log('==================================================');
    console.log('Playwright MCP Demo');
    console.log('==================================================\n');
    
    try {
        log('Connecting to Playwright MCP...');
        const client = await createClient(PLAYWRIGHT_MCP.command, PLAYWRIGHT_MCP.args);
        
        // List available tools
        log('Listing tools...');
        const tools = await listTools(client);
        
        console.log('\n--- Available Playwright MCP Tools ---\n');
        for (const tool of tools) {
            const name = tool.name || 'unnamed';
            const desc = (tool.description || '').substring(0, 60);
            console.log(`  - ${name}`);
            if (desc) console.log(`    ${desc}...\n`);
        }
        
        console.log(`\nTotal: ${tools.length} tools\n`);
        
        // Run a simple demo
        log('\n--- Running Demo ---\n');
        
        // Navigate
        await navigate(client, 'https://example.com');
        log('1. Navigated to https://example.com');
        
        // Get title
        const result = await runCode(client, 'return document.title');
        const title = result.content?.[0]?.text || 'unknown';
        log(`2. Page title: ${title}`);
        
        // Get content preview
        const content = await runCode(client, "return document.body.innerText.substring(0, 200)");
        log(`3. Page content preview: ${content.content?.[0]?.text || 'none'}...`);
        
        // Screenshot
        await screenshot(client, 'demo-example.png');
        log('4. Screenshot saved to demo-example.png');
        
        // Close
        await close(client);
        
        console.log('\n==================================================');
        log('Demo complete!');
        console.log('==================================================\n');
        
    } catch (e) {
        error(e.message);
    }
}

// ===================== CLI =====================

const args = process.argv.slice(2);

if (args.length > 0) {
    // Run custom task
    const task = args.join(' ');
    runBrowserTask(task);
} else {
    // Run demo
    runDemo();
}