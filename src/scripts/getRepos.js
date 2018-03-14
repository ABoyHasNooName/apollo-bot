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

module.exports.getRepos = async ({
  client,
  onlyRelevant = true,
  keepActivityHistory = true,
}) => {
  console.log('Authenticating Client');
  if(!client) {
    client = await getClient();
  }
  console.log('Fetching Repos');
  const repos = await getAllRepoNames(client);

  let repoCheck;
  if(process.env.NODE_ENV === 'production' && onlyRelevant)
  {
    repoCheck = relevantRepos.filter( rr => repos.some(r => r === rr));
    if(repoCheck.length !== relevantRepos.length)
      throw new Error('Fetched repositories do not match currently relevant');
  } else {
    repoCheck = repos;
  }

  if(keepActivityHistory) {
    console.log('sorting repos by activity time')
    const sorted = [];

    await Promise.all(repoCheck.map(repo => (async () => {
      const events = await client.activity.getEventsForRepo({ owner:'apollographql', repo });
      if(events.data[0].created_at)
        sorted.push({ repo, time: new Date(events.data[0].created_at) });
    })()));

    //sorted descending to retain activity history
    sorted.sort(({time}, {time: time2}) => time - time2);

    return sorted.map(({ repo }) => repo);
  } else {
    return repoCheck;
  }
}
