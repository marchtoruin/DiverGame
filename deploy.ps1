# Ensure we're in the right directory
Set-Location $PSScriptRoot

# Create a new orphan branch
git checkout --orphan temp-gh-pages

# Remove everything except dist
Get-ChildItem -Exclude dist | Remove-Item -Recurse -Force

# Move dist contents to root
Move-Item dist/* .
Remove-Item dist -Recurse

# Add all files
git add .

# Commit
git commit -m "Deploy to GitHub Pages"

# Delete the old gh-pages branch
git branch -D gh-pages
git branch -m gh-pages

# Force push to remote
git push -f origin gh-pages

# Switch back to main branch
git checkout main 