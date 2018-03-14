require('dotenv').config()

const { GithubAPI, getClient } = require('../github');
const { getRepos } = require('./getRepos');
const { timeout, asyncForEach } = require('../utils');

async function mergePR(client, repo) {
  const result = await client.pullRequests.getAll({owner:'apollographql', repo})

  const relevant = result.data.filter(({title}) => {
    return title.startsWith('[apollo-bot]')
  });

  if(relevant.length){
    const owner = 'apollographql';
    const gh = new GithubAPI('apollographql', repo, client);

    try{
      const currentCommit = await gh.getCurrentCommit(relevant[0].base.ref);
      // console.log(currentCommit);
      // const sha = currentCommit.data.sha;
      // console.log(sha);
      const number = relevant[0].number;
      const result = await client.pullRequests.merge({owner, repo, number, merge_method: 'squash'})

      const check = await client.pullRequests.checkMerged({owner, repo, number})
      console.log(`merged ${repo}`);
    } catch (e) {
      console.error(e);
      console.log(`failed ${repo}`)
    }
  } else {
    console.log(`not present ${repo}`);
  }
}

async function mergePRs() {
  console.log('Authenticating Client');
  const client = await getClient();
  console.log('Fetching Repos');
  const repos = await getRepos({ client });

  console.log('Updating Templates');
  const mergeJobs = repos.map(repo => ({
    update: async () => mergePR(client, repo),
    name: repo,
  }));

  await asyncForEach(mergeJobs, async ({ name, update }) => {
    // console.log(`trying ${name}`);
    await update();
    await timeout(1);
  });

  return;
}

mergePRs().then(() => {
  console.log('success');
  process.exit(0)
}).catch(console.error);
