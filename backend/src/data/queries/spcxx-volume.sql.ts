/**
 * Parameterized SQL template for 48-hour Fluxion pool volume.
 * Params: pool_address, window_start_utc, window_end_utc
 */
export const SPCXX_POOL_VOLUME_48H_SQL = `
SELECT
  SUM(amount_usd) AS volume_48h_usd,
  COUNT(*) AS swap_count,
  MIN(block_time) AS first_swap_utc,
  MAX(block_time) AS last_swap_utc
FROM swaps
WHERE chain_id = 5000
  AND LOWER(pool_address) = LOWER(:pool_address)
  AND block_time >= :window_start_utc
  AND block_time < :window_end_utc
`.trim();

export function build48HourWindow(hours = 48): { start_utc: string; end_utc: string; hours: number } {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return {
    start_utc: start.toISOString(),
    end_utc: end.toISOString(),
    hours,
  };
}
