import fetchQuery from "./fetch-query.js";

export default function queryPr({ owner, repository, number, token }) {
  return fetchQuery({
    token,
    query: `{
        repository(owner: "${owner}", name: "${repository}") {
          pullRequest(number: ${number}) {
            url
            title
            state
            commits(last: 1) {
              nodes {
                commit {
                  url
                  author {
                    date
                    email
                    name
                  }
                  status {
                    id
                    state
                  }
                }
              }
            }
          }
        }
      }
      `
  });
}

export function extractPrData(data) {
  const {
    data: {
      repository: {
        pullRequest: {
          url,
          title,
          state,
          commits: {
            nodes: [{ commit }]
          }
        }
      }
    }
  } = data;

  const status = commit.status ? commit.status.state : null;

  return {
    url,
    status,
    title,
    state
  };
}
