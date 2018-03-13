require('dotenv').config()
const { timeout, asyncForEach } = require('../utils');

const octokit = require('@octokit/rest');
const { getClient, getAllRepoNames } = require('../github');

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


const apolloLabels = [
  {
    name: 'blocking',
    color: 'b60205',
    description: 'Prevents production or dev due to perf, bug, build error, etc..',
  },
  {
    name: 'good first issue',
    color: '7057ff',
    description: 'Issues that are suitable for first-time contributors.',
  },
  {
    name: 'good first review',
    color: '7057ff',
    description: 'PR\'s that are suitable for first-time contributors to review.',
  },
  {
    name: 'feature',
    color: 'a2eeef',
    description: 'New addition or enhancement to existing solutions',
  },
  {
    name: 'has-reproduction',
    color: '42f44e',
    description: '❤ Has a reproduction in a codesandbox or single minimal repository',
  },
  {
    name: 'docs',
    color: 'c2e0c6',
    description: 'Focuses on documentation changes',
  },
]

async function paginate (client, method, args = {}) {
  let response = await method(args);
  let {data} = response
  while (client.hasNextPage(response)) {
    response = await client.getNextPage(response)
    data = data.concat(response.data)
  }
  return data
}

async function createOrUpdateLabels(client, owner, repo){
  const getNames = arr => arr.map(({name}) => name.toLowerCase());

  const labels = await paginate(client, client.issues.getLabels, {owner, repo, per_page:100});
  const labelNames = getNames(labels);

  const newLabels = apolloLabels.filter(({ name }) => !labelNames.includes(name));
  const existingLabels = apolloLabels.filter(({ name }) => labelNames.includes(name));

  const createNewLabels = newLabels.map(({name, color, description}) => client.issues.createLabel({owner, repo, name, color, description, headers: {
      accept: 'application/vnd.github.symmetra-preview+json'
  }}));
  const updateLabels = existingLabels.map(({name, color, description}) => client.issues.updateLabel({owner, repo, oldname:name, name, color, description, headers: {
      accept: 'application/vnd.github.symmetra-preview+json'
  }}));

  return Promise.all([...createNewLabels, ...updateLabels]);
}

async function syncLabels() {
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

  await Promise.all(repoCheck.map(repo => (async () => {
    const events = await client.activity.getEventsForRepo({ owner:'apollographql', repo });
    if(events.data[0].created_at)
      sorted.push({ repo, time: new Date(events.data[0].created_at) });
  })()));

  //sorted descending to retain activity history
  sorted.sort(({time}, {time: time2}) => time - time2);

  console.log('Syncing Labels')
  const creationJobs = sorted.map(({ repo }) => ({
    update: async () => createOrUpdateLabels(client, 'apollographql', repo),
    name: repo,
  }));

  await asyncForEach(creationJobs, async ({ name, update }) => {
    console.log(`trying ${name}`);
    try{
      await update();
      await timeout(1);
    } catch (e) {
      console.log(`failed ${name}`);
      console.error(e);
    }
  });

  return Promise.all(creationJobs)
}

syncLabels().then(process.exit).catch(console.error);
