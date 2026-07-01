/**
 * InsightX prediction market odds query template.
 * Adjust field names to match your deployed subgraph schema.
 */
export const INSIGHTX_MARKETS_QUERY = `
query InsightXMarkets($search: String!, $first: Int!) {
  markets(
    first: $first
    orderBy: createdAt
    orderDirection: desc
    where: {
      or: [
        { question_contains_nocase: $search }
        { title_contains_nocase: $search }
      ]
    }
  ) {
    id
    question
    title
    status
    resolved
    volume
    liquidity
    outcomes {
      id
      label
      probability
      price
    }
    createdAt
    endDate
  }
}
`.trim();

export const INSIGHTX_DEFAULT_SEARCH = 'SpaceX';
