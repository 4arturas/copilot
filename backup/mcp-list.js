const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const fs = require('fs');
const path = require('path');

// ===================== CONFIG =====================

// Hardcoded MCP server commands
const MCP_SERVERS = [
    {
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem']
    },
    {
        name: 'docling',
        command: 'uvx',
        args: ['--from=docling-mcp', 'docling-mcp-server']
    },
    {
        name: 'playwright',
        command: 'npx',
        args: ['-y', '@playwright/mcp']
    }
];

// ===================== LOGGING =====================
function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

function error(msg) {
    console.error(`ERROR: ${msg}`);
}

// ===================== MCP FUNCTIONS =====================

async function createClient(command, args) {
    const transport = new StdioClientTransport({
        command: command,
        args: args
    });

    const client = new Client(
        { name: 'mcp-client', version: '1.0.0' },
        { capabilities: {} }
    );

    client.transport = transport;
    await client.connect(transport);
    
    return client;
}

async function listTools(client) {
    const result = await client.listTools();
    return result.tools;
}

// ===================== MAIN =====================

async function runServer(serverConfig) {
    try {
        const { name, command, args } = serverConfig;
        
        log(`[${name}] Connecting: ${command} ${args.join(' ')}`);
        
        const client = await createClient(command, args);
        
        log(`[${name}] Fetching tools...`);
        const tools = await listTools(client);
        
        log(`[${name}] Found ${tools.length} tools:\n`);
        
        for (const tool of tools) {
            const desc = tool.description ? tool.description.substring(0, 80) + '...' : '(no description)';
            console.log(`  - ${tool.name}`);
            console.log(`    ${desc}\n`);
        }
        
        await client.close();
        
        return tools;
    } catch (e) {
        error(`[${serverConfig.name}] ${e.message}`);
        return [];
    }
}

async function runAll() {
    console.log('==================================================');
    console.log('MCP Servers Tool Listing');
    console.log('==================================================\n');
    
    for (const server of MCP_SERVERS) {
        try {
            await runServer(server);
            console.log('');
        } catch (e) {
            console.error(`Failed for ${server.name}: ${e.message}\n`);
        }
    }
    
    log('Done');
}

runAll();