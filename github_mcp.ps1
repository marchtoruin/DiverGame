# Set environment variables
$env:GITHUB_TOKEN = "YOUR_GITHUB_TOKEN"
$env:OWNER = "justinmccoy"
$env:REPO = "DiverGame-main"
$env:BRANCH = "main"

# Get Node.js executable path
$nodePath = (Get-Command node).Path

# Run the MCP server
& $nodePath -e "require('@modelcontextprotocol/server-filesystem').startServer({
    port: 3000,
    config: {
        rootDir: process.cwd(),
        allowedPaths: ['*']
    }
})" 