import { listJUnitXmlPaths } from '../junit.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const discoverJUnitFilesConfig = {
    title: 'Discover JUnit XML files',
    description: 'Discover JUnit XML files in the project. Always run this first when a user asks for a JUnit XML file or wants to analyze tests results.',
    inputSchema: {
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
        async (args: { maxDepth?: number }) => {
            const { maxDepth } = args;
            const files = await listJUnitXmlPaths('.', maxDepth);
            let responseText: string;
            if (files.length === 0) {
                responseText =
                    'No JUnit XML files were found. Please provide a path to the JUnit XML file you want to use.';
            } else if (files.length > 1) {
                responseText =
                    "Multiple JUnit XML files were found. Please specify which file you'd like to use: " +
                    files.join(', ');
            } else {
                responseText =
                    'Found one JUnit XML file: ' +
                    files[0] +
                    '. Proceeding with this file.';
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
