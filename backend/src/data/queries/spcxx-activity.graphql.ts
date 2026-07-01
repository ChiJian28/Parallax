export const SPCXX_ACTIVITY_QUERY = `
query GetSPCXxActivity($tokenAddr: String!, $start: Int!, $end: Int!) {
  tokenDayDatas(
    where: { token: $tokenAddr, date_gte: $start, date_lte: $end }
    orderBy: date
    orderDirection: asc
  ) {
    date
    priceUSD
    volumeUSD
  }
}
`.trim();
