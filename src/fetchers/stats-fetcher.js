const { request, logger, CustomError } = require("../common/utils");
const axios = require("axios");
const retryer = require("../common/retryer");
const getId = require("../common/getId");
const calculateRank = require("../calculateRank");
const githubUsernameRegex = require("github-username-regex");

require("dotenv").config();
console.log("testing")
async function getViews() {
    var [UID, SID] = getId();
    let url = 'https://medium.com/_/graphql';
    let config = {
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `sid=${SID}; uid=${UID}`,
        }
    }
    let data = {
        "operationName": "LifetimeStoriesStatsQuery",
        "variables": {
            "username": "chonyy",
            "first": 50,
            "after": "",
            "orderBy": {
                "publishedAt": "DESC"
            },
            "filter": {
                "published": true
            }
        },
        "query": "query LifetimeStoriesStatsQuery($username: ID!, $first: Int!, $after: String!, $orderBy: UserPostsOrderBy, $filter: UserPostsFilter) {\n  user(username: $username) {\n    id\n    postsConnection(\n      first: $first\n      after: $after\n      orderBy: $orderBy\n      filter: $filter\n    ) {\n      edges {\n        node {\n          ...LifetimeStoriesStats_post\n          __typename\n        }\n        __typename\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment LifetimeStoriesStats_post on Post {\n  id\n  ...StoriesStatsTable_post\n  ...MobileStoriesStatsTable_post\n  __typename\n}\n\nfragment StoriesStatsTable_post on Post {\n  ...StoriesStatsTableRow_post\n  __typename\n  id\n}\n\nfragment StoriesStatsTableRow_post on Post {\n  id\n  ...TablePostInfos_post\n  firstPublishedAt\n  milestones {\n    boostedAt\n    __typename\n  }\n  isLocked\n  totalStats {\n    views\n    reads\n    __typename\n  }\n  earnings {\n    total {\n      currencyCode\n      nanos\n      units\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment TablePostInfos_post on Post {\n  id\n  title\n  firstPublishedAt\n  readingTime\n  isLocked\n  visibility\n  ...usePostUrl_post\n  ...Star_post\n  __typename\n}\n\nfragment usePostUrl_post on Post {\n  id\n  creator {\n    ...userUrl_user\n    __typename\n    id\n  }\n  collection {\n    id\n    domain\n    slug\n    __typename\n  }\n  isSeries\n  mediumUrl\n  sequence {\n    slug\n    __typename\n  }\n  uniqueSlug\n  __typename\n}\n\nfragment userUrl_user on User {\n  __typename\n  id\n  customDomainState {\n    live {\n      domain\n      __typename\n    }\n    __typename\n  }\n  hasSubdomain\n  username\n}\n\nfragment Star_post on Post {\n  id\n  creator {\n    id\n    __typename\n  }\n  __typename\n}\n\nfragment MobileStoriesStatsTable_post on Post {\n  id\n  ...TablePostInfos_post\n  firstPublishedAt\n  milestones {\n    boostedAt\n    __typename\n  }\n  isLocked\n  totalStats {\n    reads\n    views\n    __typename\n  }\n  earnings {\n    total {\n      currencyCode\n      nanos\n      units\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n"
    }

    return await axios.post(url, data, config);
}
function process(data) {
    let posts = data.data.user.postsConnection.edges

    let totalViews = 0;
    for (const post of posts) {
        let views = post.node.totalStats.views
        totalViews += views
    }
    return totalViews;
}

const fetcher = (variables, token) => {
    return request(
        {
            query: `
      query userInfo($login: String!) {
        user(login: $login) {
          name
          login
          contributionsCollection {
            totalCommitContributions
            restrictedContributionsCount
          }
          repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
            totalCount
          }
          pullRequests(first: 1) {
            totalCount
          }
          issues(first: 1) {
            totalCount
          }
          followers {
            totalCount
          }
          repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}) {
            totalCount
            nodes {
              stargazers {
                totalCount
              }
            }
          }
        }
      }
      `,
            variables,
        },
        {
            Authorization: `bearer ${token}`,
        },
    );
};

// https://github.com/anuraghazra/github-readme-stats/issues/92#issuecomment-661026467
// https://github.com/anuraghazra/github-readme-stats/pull/211/
const totalCommitsFetcher = async (username) => {
    if (!githubUsernameRegex.test(username)) {
        logger.log("Invalid username");
        return 0;
    }

    // https://developer.github.com/v3/search/#search-commits
    const fetchTotalCommits = (variables, token) => {
        return axios({
            method: "get",
            url: `https://api.github.com/search/commits?q=author:${variables.login}`,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/vnd.github.cloak-preview",
                Authorization: `bearer ${token}`,
            },
        });
    };

    try {
        let res = await retryer(fetchTotalCommits, { login: username });
        if (res.data.total_count) {
            return res.data.total_count;
        }
    } catch (err) {
        logger.log(err);
        // just return 0 if there is something wrong so that
        // we don't break the whole app
        return 0;
    }
};

async function fetchStats(
    username,
    count_private = false,
    include_all_commits = false,
) {
    if (!username) throw Error("Invalid username");

    const stats = {
        name: "",
        totalPRs: 0,
        totalCommits: 0,
        totalIssues: 0,
        totalStars: 0,
        contributedTo: 0,
        totalViews: 0,
        rank: { level: "C", score: 0 },
    };

    let res = await retryer(fetcher, { login: username });

    if (res.data.errors) {
        logger.error(res.data.errors);
        throw new CustomError(
            res.data.errors[0].message || "Could not fetch user",
            CustomError.USER_NOT_FOUND,
        );
    }

    // Medium views
    let totalViews = 'TBD'
    try {
        let viewsRes = await getViews();
        totalViews = process(viewsRes.data);
    } catch(error) {
        // do nothing
    }
    console.log("Total views:", totalViews);
    stats.totalViews = totalViews;

    const user = res.data.data.user;

    stats.name = user.name || user.login;
    stats.totalIssues = user.issues.totalCount;

    // normal commits
    stats.totalCommits = user.contributionsCollection.totalCommitContributions;

    // if include_all_commits then just get that,
    // since totalCommitsFetcher already sends totalCommits no need to +=
    if (include_all_commits) {
        stats.totalCommits = await totalCommitsFetcher(username);
    }

    // if count_private then add private commits to totalCommits so far.
    if (count_private) {
        stats.totalCommits +=
            user.contributionsCollection.restrictedContributionsCount;
    }

    stats.totalPRs = user.pullRequests.totalCount;
    stats.contributedTo = user.repositoriesContributedTo.totalCount;

    stats.totalStars = user.repositories.nodes.reduce((prev, curr) => {
        return prev + curr.stargazers.totalCount;
    }, 0);

    console.log(stats.totalStars)

    stats.rank = calculateRank({
        totalCommits: stats.totalCommits,
        totalRepos: user.repositories.totalCount,
        followers: user.followers.totalCount,
        contributions: stats.contributedTo,
        stargazers: stats.totalStars,
        prs: stats.totalPRs,
        issues: stats.totalIssues,
    });

    return stats;
}

module.exports = fetchStats;
