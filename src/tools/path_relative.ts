import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'path';
import { z } from 'zod';

export function registerPathRelativeTool(server: McpServer) {
    server.registerTool(
        'path_relative',
        {
            title: 'Get relative path',
            description:
                'Calculate the relative path from one file path to another using Node.js path.relative',
            inputSchema: {
                base_file_name: z
                    .string()
                    .describe('Base file path to resolve from'),
                target_file_name: z
                    .string()
                    .describe('Target file path to resolve to'),
            },
        },
        async ({ base_file_name, target_file_name }) => {
            const result = path.relative(base_file_name, target_file_name);
            return { content: [{ type: 'text', text: result }] };
        }
    );
}
