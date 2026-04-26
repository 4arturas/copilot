const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

// ===================== CONFIG =====================

// MCP server for filesystem operations
const MCP_SERVER = {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
};

// ===================== LOGGING =====================
function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
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

async function callTool(client, toolName, arguments_) {
    return await client.callTool({
        name: toolName,
        arguments: arguments_
    });
}

// ===================== TOOL FUNCTIONS =====================

async function listDirectory(client, dirPath) {
    const result = await callTool(client, 'list_directory', { path: dirPath });
    return result;
}

// ===================== MAIN =====================

async function run(pathToList = '.') {
    try {
        log(`Connecting to filesystem MCP...`);
        log(`Allowed directory: ${process.cwd()}`);
        
        const client = await createClient(MCP_SERVER.command, MCP_SERVER.args);
        
        log(`Listing directory: ${pathToList}`);
        const result = await listDirectory(client, pathToList);
        
        console.log('\n==================================================');
        console.log(`Directory: ${pathToList}`);
        console.log('==================================================');
        
        if (result.content && result.content.length > 0) {
            for (const item of result.content) {
                if (item.type === 'text') {
                    console.log(item.text);
                }
            }
        } else {
            console.log('No content returned or empty directory');
        }
        
        console.log('==================================================\n');
        
        await client.close();
        
        log('Done');
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

// ===================== CLI =====================

const args = process.argv.slice(2);
const dirPath = args[0] || process.cwd();

run(dirPath);