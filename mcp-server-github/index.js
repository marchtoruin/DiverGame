const { Octokit } = require('@octokit/rest');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const octokit = new Octokit({
  auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN
});

const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const branch = process.env.GITHUB_BRANCH || 'main';

app.post('/api/github/*', async (req, res) => {
  try {
    const path = req.path.replace('/api/github/', '');
    const result = await octokit.request(`GET /repos/${owner}/${repo}/contents/${path}`, {
      owner,
      repo,
      ref: branch
    });
    res.json(result.data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`GitHub MCP server running on port ${port}`);
  console.log(`Connected to repository: ${owner}/${repo} (${branch})`);
}); 