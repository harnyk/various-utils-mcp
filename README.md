# MCP Various Utilities Server

This project implements an MCP (Model Context Protocol) server that provides a collection of utility functions accessible as tools and prompts.

## Features

Currently, the server offers the following functionalities:

### Tools

*   **`path_relative`**: Calculates the relative path from a base file path to a target file path.
    *   **Input**: `base_file_name` (string), `target_file_name` (string)
    *   **Output**: The relative path as a string.

*   **`get_working_directory`**: Returns the current working directory of the server process.
    *   **Input**: None
    *   **Output**: The current working directory as a string.

*   **`parse_junit_xml`**: Parses a JUnit XML report file to extract detailed test results, including failed tests, slow tests (based on a configurable threshold), and slow suites (based on a percentile).
    *   **Input**: `junit_xml_path` (string), `slowTestThresholdSec` (number, optional, default: 5), `topSlowTests` (number, optional, default: 20), `slowSuitesQuantile` (number, optional, default: 0.8), `minKeepSuites` (number, optional, default: 1)
    *   **Output**: A JSON object containing statistics, failed tests, slow tests, and slow suites.

### Prompts

*   **`JunitParse`**: An interactive prompt designed to assist users in analyzing JUnit XML files. It discovers JUnit XML files within a specified depth, allows the user to select files, and then presents a structured analysis of failures, slow tests, and slow suites.
    *   **Input**: None (interactive)
    *   **Output**: Formatted analysis of JUnit XML reports.

## Technologies Used

*   **TypeScript**: For type-safe and maintainable code.
*   **Node.js**: The runtime environment.
*   **`@modelcontextprotocol/sdk`**: The SDK for building MCP servers.
*   **`fast-glob`**: For efficient file system globbing.
*   **`fast-xml-parser`**: For parsing XML content, specifically JUnit reports.
*   **`zod`**: For robust schema validation of tool inputs.

## Installation

To set up the project, follow these steps:

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd mcp-various-utils
    ```
2.  Install dependencies:
    ```bash
    npm install
    # or yarn install
    # or pnpm install
    ```
3.  Build the project:
    ```bash
    npm run build
    ```

## Usage

To start the MCP server, run:

```bash
npm start
```

The server will then be ready to accept connections from MCP clients and expose the registered tools and prompts.

## Development

For development, you can use `tsx` to run the server directly without building:

```bash
npm run dev
```

To run type checks:

```bash
npm run typecheck
```
