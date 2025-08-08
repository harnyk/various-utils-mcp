import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetWorkingDirectoryTool(server: McpServer) {
    server.registerTool(
        'get_working_directory',
        {
            title: 'Get working directory',
            description: 'Get the current working directory',
            inputSchema: {},
        },
        async () => {
            const result = process.cwd();
            return { content: [{ type: 'text', text: result }] };
        }
    );
}
