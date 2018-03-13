require('dotenv').config()

const { GithubAPI, getClient, getAllRepoNames } = require('../github');
const { timeout, asyncForEach } = require('../utils');

const relevantRepos = [
  'apollo',
  'apollo-android',
  'apollo-angular',
  'apollo-cache-asyncstorage',
  'apollo-cache-control',
  'apollo-cache-control-js',
  'apollo-cache-persist',
  'apollo-client',
  'apollo-client-devtools',
  'apollo-codegen',
  'apollo-fetch',
  'apollo-ios',
  'apollo-link',
  'apollo-link-state',
  'apollo-server',
  'community',
  'docs-docs',
  'engine-docs',
  'eslint-plugin-graphql',
  'GitHub-GraphQL-API-Example',
  'GitHunt-API',
  'GitHunt-Angular',
  'GitHunt-React',
  'graphql-tag',
  'graphql-tools',
  'launchpad',
  'react-apollo',
  'reason-apollo',
  'subscriptions-transport-ws',
  'vscode-graphql'
];

const issueTemplateAddition =`<!--**Issue Labels**

While not necessary, you can help organize our issues by labeling this when you open it.  To add a label automatically, simply [x] mark the appropriate box below:

- [ ] has-reproduction
- [ ] feature
- [ ] blocking
- [ ] good first issue

To add a label not listed above, simply place \`/label another-label-name\` on a line by itself.
-->`;

const prTemplateAddition =`<!--**Pull Request Labels**

While not necessary, you can help organize our pull requests by labeling this when you open it.  To add a label automatically, simply [x] mark the appropriate box below:

- [ ] has-reproduction
- [ ] feature
- [ ] blocking
- [ ] good first review

To add a label not listed above, simply place \`/label another-label-name\` on a line by itself.
-->`;

function createIssueTemplate(issueTemplate) {
  const issueIndex = issueTemplate.indexOf('- [ ] blocking');
  if(issueIndex < 0) {
    throw new Error('unable to find issue template');
  }
  const newIssueContent = issueTemplate.slice(0, issueIndex) + `- [ ] docs
` + issueTemplate.slice(issueIndex);

  return newIssueContent;
}

function createPRTemplate(prTemplate) {
  const removeHasRepro = prTemplate.split('- [ ] has-reproduction\n');
  if(removeHasRepro.length !== 2) {
    throw new Error('unable to find has-reproduction in pr template');
  }

  const removeFirstReview = removeHasRepro[1].split('- [ ] good first review');
  if(removeFirstReview.length !== 2) {
    throw new Error('unable to find good first review in pr template');
  }

  const newPRContent = removeHasRepro[0] + removeFirstReview[0] + '- [ ] docs' + removeFirstReview[1];

  return newPRContent;
}

async function updateTemplates(client, repo, newBranch) {
  const gh = new GithubAPI('apollographql', repo, client);

  try{
    const issueTemplate = await gh.readFileContents('master', '.github/ISSUE_TEMPLATE.md');
    const prTemplate = await gh.readFileContents('master', '.github/PULL_REQUEST_TEMPLATE.md');
    console.log('create branch');
    await gh.createBranch('master', newBranch);

    console.log('add updates');
    const newIssueContent = createIssueTemplate(issueTemplate);
    const newPRContent = createPRTemplate(prTemplate);

    await gh.addFile('.github/ISSUE_TEMPLATE.md', newIssueContent);
    await gh.addFile('.github/PULL_REQUEST_TEMPLATE.md', newPRContent);

    console.log('get current');
    const currentCommit = await gh.getCurrentCommit(newBranch);
    console.log('create commit');
    const newCommit = await gh.createCommit('[apollo-bot] Update the Templates with docs label', currentCommit);
    console.log('push commit');
    await gh.pushCommit(newBranch, newCommit);
    console.log('open pr');
    await gh.openPR('master', newBranch, '[apollo-bot] Update the Issue/PR Templates with docs label', 'This PR contains an update to the issue and pr templates that add the `docs` label, also removes `has-repro` and `good first review` from pr')
  } catch(e) {
    console.log(`failed ${repo}`);
    // console.error(`failed ${repo}\n`, e);
  }
  return;
}


async function updateAllTemplates() {
  console.log('Authenticating Client');
  const client = await getClient();
  console.log('Fetching Repos');
  const repos = await getAllRepoNames(client);

  let repoCheck;
  if(process.env.NODE_ENV === 'production')
  {
    repoCheck = relevantRepos.filter( rr => repos.some(r => r === rr));
    if(repoCheck.length !== relevantRepos.length)
      throw new Error('Fetched repositories do not match currently relevant');
  } else {
    repoCheck = repos;
  }

  console.log('sorting repos by activity time')
  const sorted = [];
  await asyncForEach(repoCheck, async repo => {
    const events = await client.activity.getEventsForRepo({ owner:'apollographql', repo });
    sorted.push({ repo, time: new Date(events.data[0].created_at) });
  });

  //sorted descending to retain activity history
  sorted.sort(({time}, {time: time2}) => time - time2);

  console.log('Updating Templates');
  const updateJobs = sorted.map(({repo}) => ({
    update: async () => updateTemplates(client, repo, 'apollo-bot/templates'),
    name: repo,
  }));


  await asyncForEach(updateJobs, async ({ name, update }) => {
    console.log(`trying ${name}`);
    await update();
    await timeout(10);
  });

  return;
}

updateAllTemplates().then(() => {
  console.log('success');
  process.exit(0)
}).catch(console.error);
