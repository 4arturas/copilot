const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ===================== CONFIG =====================

// MCP servers to query
const MCP_SERVERS = [
    { name: 'filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
    { name: 'docling', command: 'uvx', args: ['--from=docling-mcp', 'docling-mcp-server'] },
    { name: 'playwright', command: 'npx', args: ['-y', '@playwright/mcp'] }
];

// ===================== LOGGING =====================
function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ===================== MCP FUNCTIONS =====================

async function createClient(command, args) {
    const transport = new StdioClientTransport({ command, args });
    const client = new Client({ name: 'mcp-client', version: '1.0.0' }, { capabilities: {} });
    client.transport = transport;
    await client.connect(transport);
    return client;
}

async function listTools(client) {
    const result = await client.listTools();
    return result.tools;
}

// ===================== FILE FUNCTIONS =====================

function generateMarkdown(toolsByServer) {
    let md = '# MCP Tools Reference\n\n';
    md += 'This document lists all available MCP (Model Context Protocol) tools that can be used with Copilot.\n\n';
    md += '---\n\n';
    
    for (const { serverName, tools } of toolsByServer) {
        md += `## ${serverName} Server\n\n`;
        md += `| Tool Name | Description |\n`;
        md += `|----------|-------------|\n`;
        
        for (const tool of tools) {
            const desc = tool.description ? tool.description.replace(/\|/g, '-').substring(0, 100) : '';
            md += `| ${tool.name} | ${desc} |\n`;
        }
        
        md += `\nTotal: ${tools.length} tools\n\n---\n\n`;
    }
    
    // Add quick reference
    md += '## Quick Reference\n\n';
    md += '```\n';
    for (const { serverName, tools } of toolsByServer) {
        md += `# ${serverName} tools:\n`;
        for (const tool of tools) {
            md += `- ${tool.name}\n`;
        }
        md += '\n';
    }
    md += '```\n';
    
    return md;
}

function createTaskMd(taskContent) {
    fs.writeFileSync('task.md', taskContent);
    log('Created task.md');
}

function createZipFile() {
    // Create zip with PowerShell
    execSync('powershell -Command "Compress-Archive -Path task.md -DestinationPath task.zip -Force"');
    // Rename to .txt
    fs.renameSync('task.zip', 'task-zipped.txt');
    log('Created task-zipped.txt');
}

function cleanupFiles() {
    try {
        if (fs.existsSync('task.md')) fs.unlinkSync('task.md');
        if (fs.existsSync('task-zipped.txt')) fs.unlinkSync('task-zipped.txt');
    } catch (e) {}
}

// ===================== MAIN =====================

async function runServer(serverConfig) {
    try {
        const { name, command, args } = serverConfig;
        log(`[${name}] Connecting...`);
        
        const client = await createClient(command, args);
        const tools = await listTools(client);
        
        log(`[${name}] Found ${tools.length} tools`);
        
        await client.close();
        
        return { serverName: name, tools };
    } catch (e) {
        log(`[${name}] Error: ${e.message}`);
        return { serverName: name, tools: [] };
    }
}

async function runAll() {
    console.log('==================================================');
    console.log('MCP Tools Catalog');
    console.log('==================================================\n');
    
    const toolsByServer = [];
    
    // Query all servers
    for (const server of MCP_SERVERS) {
        const result = await runServer(server);
        toolsByServer.push(result);
        console.log('');
    }
    
    // Generate markdown
    const markdown = generateMarkdown(toolsByServer);
    
    // Write to file
    fs.writeFileSync('mcp-tools.md', markdown);
    console.log('Written to mcp-tools.md');
    
    // Create task.md for Copilot
    const taskContent = `Please read and learn from mcp-tools.md. This file contains a reference of all MCP tools available. Remember these tools - they can be used to perform various tasks like:
- File operations (read, write, list directories)
- Document conversion (PDF, Word, etc.)
- Browser automation (navigate, click, type)

When I ask you to perform a task, you may use these tools as needed.`;
    
    createTaskMd(taskContent);
    createZipFile();
    
    // Show summary
    let totalTools = 0;
    for (const { tools } of toolsByServer) {
        totalTools += tools.length;
    }
    
    console.log('\n==================================================');
    console.log(`Total: ${totalTools} tools from ${toolsByServer.length} servers`);
    console.log('Files created:');
    console.log('  - mcp-tools.md (reference document)');
    console.log('  - task.md (for Copilot)');
    console.log('  - task-zipped.txt (zipped task)');
    console.log('==================================================\n');
    
    log('Done');
}

runAll();