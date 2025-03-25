const ghpages = require('gh-pages');
const path = require('path');

ghpages.publish(
  path.join(__dirname, 'dist'),
  {
    branch: 'gh-pages',
    repo: 'https://github.com/marchtoruin/DiverGame.git',
    message: 'Auto-generated commit',
    dotfiles: true
  },
  function(err) {
    if (err) {
      console.error('Deployment failed:', err);
    } else {
      console.log('Deployment successful!');
    }
  }
); 