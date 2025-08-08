import { listJUnitXmlPaths } from '../junit.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const discoverJUnitFilesConfig = {
    description: 'Discover JUnit XML files in the project',
    inputSchema: {
        path: z
            .string()
            .optional()
            .describe(
                'Optional: The directory to start searching from. Defaults to the current working directory.'
            ),
        maxDepth: z
            .number()
            .optional()
            .describe(
                'Optional: The maximum depth to search for files. Defaults to 3.'
            ),
    },
};

export function registerDiscoverJUnitFilesTool(server: McpServer) {
    server.registerTool(
        'discover_junit_files',
        discoverJUnitFilesConfig,
        async (args: { path?: string; maxDepth?: number }) => {
            const { path, maxDepth } = args;
            const files = await listJUnitXmlPaths(path, maxDepth);
            let responseText: string;
            if (files.length === 0) {
                responseText = "No JUnit XML files were found. Please provide a path to the JUnit XML file you want to use.";
            } else if (files.length > 1) {
                responseText = "Multiple JUnit XML files were found. Please specify which file you'd like to use: " + files.join(', ');
            } else {
                responseText = "Found one JUnit XML file: " + files[0] + ". Proceeding with this file.";
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: responseText,
                    },
                ],
            };
        }
    );
}
