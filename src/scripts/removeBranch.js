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

async function deleteBranch(client, repo, ref) {
  try{
    await client.gitdata.deleteReference({owner:'apollographql', repo, ref})
    console.log(`success ${repo}`);
  } catch(e) {
    console.log(`failed ${repo}`);
    console.error(`failed ${repo}\n`, e.code);
  }
}

async function deleteBranchFromAll(branch) {
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

  console.log('Removing Branch');
  const jobs = repoCheck.map(repo => ({
    update: async () => deleteBranch(client, repo, branch),
    name: repo,
  }));

  await asyncForEach(jobs, async ({ name, update }) => {
    await update();
    await timeout(10);
  });

  return;
}

deleteBranchFromAll('heads/apollo-bot/templates').then(() => {
  console.log('success');
  process.exit(0)
}).catch(console.error);
