const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

module.exports = function (RED) {
    function McpListNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.server = RED.nodes.getNode(config.server);

        node.on('input', async function (msg, send, done) {
            node.status({ fill: "blue", shape: "dot", text: "fetching tools..." });

            let client;
            let transport;
            const isPersistent = !!node.server;

            try {
                if (isPersistent) {
                    client = await node.server.connect();
                } else {
                    const command = msg.command || config.command || 'npx';
                    const serverArgsRaw = msg.serverArgs || config.serverArgs || '';
                    const args = serverArgsRaw ? serverArgsRaw.split(' ').filter(arg => arg.trim() !== "") : [];

                    transport = new StdioClientTransport({
                        command: command,
                        args: args
                    });

                    client = new Client(
                        { name: 'mcp-list-client', version: '1.0.0' },
                        { capabilities: {} }
                    );

                    client.transport = transport;
                    await client.connect(transport);
                }

                const result = await client.listTools();

                // Return the array of tool definitions to msg.payload
                msg.payload = result.tools;

                node.status({ fill: "green", shape: "dot", text: `found ${result.tools.length} tools` });
                send(msg);
            } catch (error) {
                node.status({ fill: "red", shape: "ring", text: "error" });
                node.error(error.message || error, msg);
            } finally {
                if (!isPersistent) {
                    try {
                        if (client) await client.close();
                    } catch (e) {
                        // Silent cleanup
                    }
                }
            }
            if (done) done();
        });
    }
    RED.nodes.registerType("mcp-list-tools", McpListNode);
};