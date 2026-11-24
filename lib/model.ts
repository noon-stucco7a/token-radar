// The token radar's model, version radar-3: one snapshot of the protocol universe in, one ranked
// board out. Every figure comes from the snapshot itself; no protocol name is ever special-cased.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds the
// strongest pre-token protocols below the floor: the early rows the radar exists to find. A protocol
// is pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol). Protocols
// whose token already trades are never ranked: they are the model's measuring stick, and the dashboard
// sets them aside in a Live view with the market's own values.
//
// Implied value is a comparables estimate, built in five stated steps:
//
//   1. Peer multiple. Among live-token protocols, market cap / TVL is the price the market pays for a
//      dollar of a protocol's TVL. Each category's multiple is the median of that ratio over the
//      category's live protocols, shrunk toward the all-protocol median so a category with two peers
//      cannot outvote one with forty:  multiple = (n x category median + K x global median) / (n + K),
//      clamped to [0.03, 1.25]. A category with no live peer uses the global median. Radar-3 shrinks
//      thin categories harder: below three live peers the phantom weight grows by 9 for every missing
//      peer (K = 24 for a single peer, 15 for two), because a median of one or two ratios is mostly
//      noise; at three peers and above the weight is the plain K = 6, exactly as radar-2 had it.
//   2. Base value = tvl_usd x peer multiple: what this protocol's TVL would be worth if the market
//      priced it like its live peers.
//   3. Growth and maturity. Seven-day TVL growth moves the base by (clamped change / 100) x 0.35.
//      Time live with no token is evidence a launch is nearer and the product is proven, so a maturity
//      factor rises from 0.75 to 1.00 over three years; an unknown listing date scores a flat 0.85.
//   4. Pre-token discount x 0.85: a token that does not trade yet carries launch and liquidity risk
//      its live peers have already shed, so the estimate prices it below them on purpose.
//   5. Diversity quota. No category may hold more than 5 of the board's top 20 places: a board whose
//      head is one category repeated is a worse map of where launches will come from, whatever the
//      raw values say. The model enforces the cap itself, before any row is written: while a category
//      holds more than 5 of the top 20, that category's multiple steps down by x0.9 and the board is
//      repriced, until the cap holds (a category priced on the global median steps down from it).
//      The multiples table shows the final multiple and how many steps each category took.
//
//   implied = max(1, round(tvl x multiple x growthMult x maturityMult x 0.85))
//
// The dashboard states this model, shows each row's own inputs and peer count, and recomputes every
// row from data.js to prove the page and board.json carry the same arithmetic.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  shrinkage_k: number;
  small_sample_n: number;
  small_sample_boost: number;
  multiple_min: number;
  multiple_max: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_multiplier: number;
  pretoken_discount: number;
  quota_top: number;
  quota_max: number;
  quota_step: number;
}

export const MODEL: ModelConstants = {
  shrinkage_k: 6,
  small_sample_n: 3,
  small_sample_boost: 9,
  multiple_min: 0.03,
  multiple_max: 1.25,
  growth_weight: 0.35,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.75,
  maturity_range: 0.25,
  maturity_days: 1095,
  unknown_age_multiplier: 0.85,
  pretoken_discount: 0.85,
  quota_top: 20,
  quota_max: 5,
  quota_step: 0.9,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the early radar carries, by implied value. */
export const EARLY_ROWS = 180;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's peer evidence: how many live peers, their raw median multiple, and the multiple used. */
export interface CategoryMultiple {
  category: string;
  peers: number;
  median: number | null;
  used: number;
  /** Diversity-quota step-downs applied to `used` after shrinkage (step 5 of the model). */
  quota_steps: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The model's own arithmetic for one row, so a reader can re-derive the number. */
export interface ModelBreakdown {
  peer_multiple: number;
  peer_count: number;
  category_median: number | null;
  global_median: number;
  quota_steps: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  pretoken_discount: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: ModelBreakdown;
  reason: string;
  farm_steps: string[];
}

/**
 * The dashboard's view of one row: the board row's figures, its reason and its farm plan. Leaner
 * than the board row on purpose: a pre-token row's market cap is always null and its listing date
 * is carried as age alone, and what the page can re-derive exactly is not repeated (the growth
 * multiplier from change_7d and the model constants; the category's median and peer count from
 * the multiples table the same payload carries).
 */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  peer_multiple: number;
  maturity_multiplier: number;
  reason: string;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  mcap_tvl: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the multiples table and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_median: number;
  multiples: CategoryMultiple[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The phantom weight a category's median is shrunk with: the plain shrinkage_k once the category
 * has small_sample_n live peers, growing by small_sample_boost for every peer below that, so a
 * median of one or two ratios is treated as the weak evidence it is.
 */
export function shrinkageWeight(peers: number, model: ModelConstants = MODEL): number {
  return model.shrinkage_k + model.small_sample_boost * Math.max(0, model.small_sample_n - peers);
}

/**
 * The peer evidence: for every category, the live-token protocols' market-cap/TVL ratios, their
 * median, and the shrunk multiple the model uses. Live means the record carries a market cap.
 */
export function peerMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { globalMedian: number; byCategory: Map<string, CategoryMultiple> } {
  const ratios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? 'Uncategorised';
    const list = ratios.get(key) ?? [];
    list.push(ratio);
    ratios.set(key, list);
  }
  const globalMedian = all.length > 0 ? median(all) : 0.2;
  const byCategory = new Map<string, CategoryMultiple>();
  for (const [category, list] of ratios) {
    const med = median(list);
    const k = shrinkageWeight(list.length, model);
    const used = Math.min(model.multiple_max, Math.max(model.multiple_min, (list.length * med + k * globalMedian) / (list.length + k)));
    byCategory.set(category, { category, peers: list.length, median: round4(med), used: round4(used), quota_steps: 0 });
  }
  return { globalMedian: round4(globalMedian), byCategory };
}

/** The multiple one protocol is priced with: its category's shrunk median, or the global median. */
function multipleFor(p: SnapshotProtocol, peers: { globalMedian: number; byCategory: Map<string, CategoryMultiple> }): CategoryMultiple {
  const found = peers.byCategory.get(p.category ?? 'Uncategorised');
  if (found !== undefined) return found;
  return { category: p.category ?? 'Uncategorised', peers: 0, median: null, used: peers.globalMedian, quota_steps: 0 };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  peers: { globalMedian: number; byCategory: Map<string, CategoryMultiple> },
  model: ModelConstants = MODEL,
): { implied: number; breakdown: ModelBreakdown; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const multiple = multipleFor(protocol, peers);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(protocol.change_7d, 0)));
  // The multipliers are rounded to 4 places before they price anything, so the dashboard's
  // recomputation from the published breakdown lands on the same dollar, every row.
  const growthMult = round4(1 + (growthPct / 100) * model.growth_weight);
  const maturityMult = round4(
    age === null
      ? model.unknown_age_multiplier
      : model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range,
  );
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple.used * growthMult * maturityMult * model.pretoken_discount));
  return {
    implied,
    age,
    breakdown: {
      peer_multiple: multiple.used,
      peer_count: multiple.peers,
      category_median: multiple.median,
      global_median: peers.globalMedian,
      quota_steps: multiple.quota_steps,
      growth_pct: growthPct,
      growth_multiplier: growthMult,
      maturity_multiplier: maturityMult,
      pretoken_discount: model.pretoken_discount,
    },
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A wrapped or staked product's name: a token that already trades, in another wrapper. */
const WRAPPED_NAME = /\b(wrapped|staked|staking)\b/i;

/** Categories that are products of another protocol, not launches of their own (the watchlist's own list). */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX', 'Anchor BTC']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol may join the early radar: pre-token, and an independent launch candidate. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !PRODUCT_CATEGORIES.has(p.category ?? '') && !VERSIONED.test(p.name) && !WRAPPED_NAME.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** A compact dollar figure for reason text: $2.75B, $512M, $84K. */
function usdShort(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/** Why a row sits where it sits, in the model's own numbers: the sentence the detail view shows. */
export function reasonFor(p: SnapshotProtocol, b: ModelBreakdown, age: number | null, implied: number, watchlist: boolean): string {
  const cat = p.category ?? 'Uncategorised';
  const peerText =
    b.peer_count > 0
      ? `${b.peer_count} live ${cat} peer${b.peer_count === 1 ? '' : 's'} at a median ${b.category_median}x TVL, shrunk toward the ${b.global_median}x all-protocol median, price ${p.name} at ${b.peer_multiple}x`
      : `no live ${cat} peer trades yet, so ${p.name} is priced at the ${b.global_median}x all-protocol median`;
  const quotaText = b.quota_steps > 0 ? ` after ${b.quota_steps} diversity step-down${b.quota_steps === 1 ? '' : 's'} for the top-20 category quota` : '';
  const growthText =
    p.change_7d === null
      ? 'no seven-day change is recorded, so growth is neutral'
      : `seven-day TVL change of ${p.change_7d > 0 ? '+' : ''}${round2(p.change_7d)}% moves the estimate by x${b.growth_multiplier}`;
  const ageText =
    age === null
      ? 'no listing date is recorded, so maturity is a flat x0.85'
      : `${age} days live with no token: maturity x${b.maturity_multiplier}`;
  const coverText = watchlist ? 'On the watchlist (TVL at or above the floor, no token). ' : 'Below the watchlist floor (early radar). ';
  return `${coverText}${peerText}${quotaText}: ${usdShort(p.tvl_usd)} of TVL at that multiple, ${growthText}, ${ageText}, and a x${b.pretoken_discount} pre-token discount give an implied ${usdShort(implied)}.`;
}

/** The category holding too many of the board's first `top` places, or null: most places first, name order breaks ties. */
function quotaOffender(board: BoardRow[], model: ModelConstants): string | null {
  const counts = new Map<string, number>();
  for (const r of board.slice(0, model.quota_top)) {
    const key = r.category ?? 'Uncategorised';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let worst: string | null = null;
  let worstCount = model.quota_max;
  for (const key of [...counts.keys()].sort()) {
    if (counts.get(key)! > worstCount) {
      worst = key;
      worstCount = counts.get(key)!;
    }
  }
  return worst;
}

/**
 * The peer multiples the board is priced with: the shrunk medians of peerMultiples, then the
 * diversity quota of step 5. While one category would hold more than quota_max of the top
 * quota_top places, that category's multiple steps down by quota_step and the board is repriced;
 * a category with no live peer, priced on the global median, steps down from the median itself.
 * The loop is bounded and every step is a fixed multiple of the last, so the result is a pure
 * function of the snapshot. On the sealed snapshot the step-down engages for one category only.
 */
export function boardPeers(snapshot: Snapshot, model: ModelConstants = MODEL): { globalMedian: number; byCategory: Map<string, CategoryMultiple> } {
  const peers = peerMultiples(snapshot, model);
  for (let iter = 0; iter < 200; iter++) {
    const offender = quotaOffender(scoreBoard(snapshot, peers, model), model);
    if (offender === null) return peers;
    let cm = peers.byCategory.get(offender);
    if (cm === undefined) {
      cm = { category: offender, peers: 0, median: null, used: peers.globalMedian, quota_steps: 0 };
      peers.byCategory.set(offender, cm);
    }
    if (cm.used <= model.multiple_min) return peers;
    cm.used = round4(Math.max(model.multiple_min, cm.used * model.quota_step));
    cm.quota_steps += 1;
  }
  return peers;
}

/** The protocols the board ranks, strongest first, with ranks 1..n, priced with `peers`. */
export function scoreBoard(snapshot: Snapshot, peers: { globalMedian: number; byCategory: Map<string, CategoryMultiple> }, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: independent pre-token protocols below the floor, scored by the same model and
  // kept by implied value, so a small protocol with rich peers can outrank a bigger dull one.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .map((p) => ({ p, implied: impliedValue(p, snapshot.as_of, peers, model).implied }))
    .sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const e of early) chosen.set(e.p.slug, e.p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, breakdown, age } = impliedValue(p, snapshot.as_of, peers, model);
    return { p, implied, breakdown, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: s.breakdown,
    reason: reasonFor(s.p, s.breakdown, s.age, s.implied, watch.has(s.p.slug)),
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** The board, priced with the board's own multiples: shrinkage first, the diversity quota applied. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  return scoreBoard(snapshot, boardPeers(snapshot, model), model);
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The gas asset a chain settles in, for the wallet step. */
const GAS_TOKEN: Record<string, string> = {
  Ethereum: 'ETH', Base: 'ETH', Arbitrum: 'ETH', Optimism: 'ETH', Ink: 'ETH', Monad: 'MON', Pharos: 'PHRS',
  Solana: 'SOL', Binance: 'BNB', Tron: 'TRX', Avalanche: 'AVAX', Stellar: 'XLM', Bittensor: 'TAO',
  Polygon: 'POL', Fantom: 'FTM', Gnosis: 'xDAI', Linea: 'ETH', Scroll: 'ETH', 'zkSync Era': 'ETH', Mantle: 'MNT', Sui: 'SUI', Aptos: 'APT',
};

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 10_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** A category's playbook: the core action, the second action, the weekly action and the watch-out. */
interface Playbook {
  core: (p: SnapshotProtocol, capital: number, chain: string) => string;
  second: (p: SnapshotProtocol, capital: number, chain: string) => string;
  weekly: string;
  caution: string;
}

const PLAYBOOKS: { match: string[]; book: Playbook }[] = [
  {
    match: ['dexs'],
    book: {
      core: (p, c, ch) => `Provide $${c} of liquidity to ${p.name}'s deepest USDC pair on ${ch}, favouring a stable or correlated pair first.`,
      second: (p, c, ch) => `Route two or three small swaps through ${p.name}'s own interface on ${ch}, so the wallet shows trader as well as liquidity activity.`,
      weekly: 'rebalance or top up the pool position once',
      caution: 'Impermanent loss is the risk when the pair moves apart; a stable pair caps it, and caps the fees too.',
    },
  },
  {
    match: ['lending', 'uncollateralized lending'],
    book: {
      core: (p, c, ch) => `Supply $${c} of USDC to ${p.name} on ${ch} and leave the deposit untouched.`,
      second: (p, c) => `Borrow about 25% of the deposit's value against it, hold a few days, then repay in full: both sides of the market count.`,
      weekly: 'add a small top-up deposit or adjust the borrow once',
      caution: 'Never let the health factor drift toward liquidation; keep the borrow small and recheck it after sharp market moves.',
    },
  },
  {
    match: ['cdp', 'cdp manager'],
    book: {
      core: (p, c, ch) => `Open a vault on ${p.name} on ${ch} with $${c} of collateral and mint a modest amount of its stablecoin against it.`,
      second: (p) => `Park the minted stablecoin in ${p.name}'s own stability pool or savings module, if it offers one, so mint and hold are both recorded.`,
      weekly: 'check the collateral ratio and top up or repay once',
      caution: 'Stay far above the liquidation line; a minted position is a debt, and volatile collateral closes fast.',
    },
  },
  {
    match: ['derivatives', 'options', 'options vault', 'interest rate derivatives', 'synthetics'],
    book: {
      core: (p, c, ch) => `Deposit $${c} of USDC as margin on ${p.name} on ${ch} and open one small position at 1x, hedged against a spot holding of the same size.`,
      second: (p) => `Close and reopen the hedge once, so the wallet records completed trades on ${p.name}, not only a deposit.`,
      weekly: 'roll or resize the hedge once',
      caution: 'Funding can turn against a held hedge, and leverage multiplies mistakes; this plan never goes past 1x.',
    },
  },
  {
    match: ['risk curators', 'onchain capital allocator', 'collateral management'],
    book: {
      core: (p, c, ch) => `Read the strategy pages of two or three vaults ${p.name} curates on ${ch}, then deposit $${c} split across the two whose assets you understand best.`,
      second: (p, c) => `Move a small test amount, about a fifth of the position, from one ${p.name} vault to another once, so the wallet shows active allocation.`,
      weekly: 'review the vaults\' reported yield and holdings once',
      caution: 'A curated vault is someone else\'s strategy with your money: yields are not guaranteed and withdrawals can queue.',
    },
  },
  {
    match: ['yield', 'yield aggregator', 'liquidity manager', 'leveraged farming', 'farm', 'basis trading'],
    book: {
      core: (p, c, ch) => `Deposit $${c} of USDC into ${p.name}'s flagship vault on ${ch} and keep the vault shares in the wallet.`,
      second: (p) => `Claim any rewards ${p.name} accrues once and restake or hold them in the same wallet, so the claim is on record.`,
      weekly: 'claim or compound the accrued rewards once',
      caution: 'Vault yield is a strategy return, not interest, and can go negative in a bad week; leveraged variants can be liquidated.',
    },
  },
  {
    match: ['rwa'],
    book: {
      core: (p, c, ch) => `Complete ${p.name}'s onboarding on ${ch} if it asks for it, then mint a first small $${c} of its yield-bearing asset.`,
      second: (p) => `Hold the minted asset through one full payout or reporting cycle on ${p.name} before adding anything more.`,
      weekly: 'check the asset\'s reported value and payout notices once',
      caution: 'RWA products can require identity checks and pay out on fixed windows; redemptions are rarely instant, so size it as locked money.',
    },
  },
  {
    match: ['restaking', 'liquid restaking', 'staking pool', 'liquid staking'],
    book: {
      core: (p, c, ch) => `Stake $${c} of ${ch}'s staking asset through ${p.name} and keep the receipt token in the wallet.`,
      second: (p) => `Put the receipt token to work where ${p.name} itself points, such as its restaking or rewards module, not a third-party farm.`,
      weekly: 'check the receipt token\'s exchange rate and any points balance once',
      caution: 'Withdrawals can take a week or more and slashing is possible; never stake funds you may need back quickly.',
    },
  },
  {
    match: ['cross chain bridge'],
    book: {
      core: (p, c, ch) => `Bridge $${c} of USDC through ${p.name} to ${ch}, then use the bridged funds in one app on the far side.`,
      second: (p, c, ch) => `Bridge a smaller amount back through ${p.name} a week later, so the wallet shows a round trip, not a one-way exit.`,
      weekly: 'make one small bridge transfer',
      caution: 'Bridges are the most exploited contracts in the industry: use only the protocol\'s own interface and test small first.',
    },
  },
  {
    match: ['chain'],
    book: {
      core: (p, c, ch) => `Bridge $${c} of USDC to ${ch} and make it the wallet's home chain for this farm, holding a small balance of its gas token too.`,
      second: (p) => `Use two or three of the chain's native apps (its main exchange and lending market) with small amounts, so the wallet looks like a resident, not a passer-by.`,
      weekly: 'make one transaction in a native app',
      caution: 'Young chains carry young contracts: audits are thinner, bridges are the weak point, so size it as an experiment.',
    },
  },
  {
    match: ['prediction market'],
    book: {
      core: (p, c) => `Fund the wallet with $${c} on ${p.name} and place small positions in two or three of its most liquid markets.`,
      second: (p) => `Hold one position to settlement on ${p.name}, so the wallet records a completed market, win or lose.`,
      weekly: 'place or adjust one market position',
      caution: 'Prediction stakes are spent money with a possible payout, not a deposit: any single position can go to zero.',
    },
  },
  {
    match: ['insurance'],
    book: {
      core: (p, c, ch) => `Buy $${c} of cover from ${p.name} on ${ch} against a large, well-known protocol and hold the policy to expiry.`,
      second: (p) => `Renew or extend the cover once when it lapses, so the wallet shows a continuing customer of ${p.name}.`,
      weekly: 'check the policy status once',
      caution: 'Cover pays only on the events its terms name; read the exclusions first.',
    },
  },
  {
    match: ['launchpad'],
    book: {
      core: (p, c, ch) => `Register the wallet for one open sale or allowlist on ${p.name} on ${ch} and complete its listed tasks, staking the $${c} minimum only if the sale asks for it.`,
      second: (p) => `Take part in one launch on ${p.name} with a small amount, or record the completed registration if no launch is open.`,
      weekly: 'check for newly opened registrations once',
      caution: 'No legitimate launchpad guarantees an allocation for a fee; anyone promising one is running a scam.',
    },
  },
  {
    match: ['indexes'],
    book: {
      core: (p, c, ch) => `Mint $${c} of ${p.name}'s index token on ${ch} and hold it in the wallet.`,
      second: (p) => `Add a small second mint after the next rebalance of the index, so the wallet holds through a composition change.`,
      weekly: 'check the index composition and reported value once',
      caution: 'An index token is only as sound as its weakest constituent and its rebalancing rules; read both first.',
    },
  },
  {
    match: ['payments', 'crypto card issuer'],
    book: {
      core: (p, c) => `Open an account with ${p.name}, complete the identity check it requires, and load $${c} or the smallest amount it accepts.`,
      second: (p) => `Make one ordinary payment or transfer through ${p.name} so the account shows real use, not only a balance.`,
      weekly: 'make one small payment or top-up',
      caution: 'Payment products need identity verification and are not available everywhere; check eligibility before moving money in.',
    },
  },
  {
    match: ['stablecoin issuer', 'dual-token stablecoin', 'algo-stables', 'stablecoin wrapper'],
    book: {
      core: (p, c, ch) => `Mint or deposit $${c} of the stable asset through ${p.name} on ${ch} and hold it in the wallet.`,
      second: (p, c, ch) => `Provide a small amount of liquidity for the stable asset in ${p.name}'s main pool on ${ch}, if it keeps one.`,
      weekly: 'check the asset\'s price against its peg once',
      caution: 'A stablecoin can lose its peg; keep the position small and watch the price, not the balance.',
    },
  },
];

/** The playbook one protocol follows: its category's, or the default deposit plan. */
function playbookFor(p: SnapshotProtocol): Playbook {
  const c = (p.category ?? '').toLowerCase();
  for (const entry of PLAYBOOKS) if (entry.match.includes(c)) return entry.book;
  return {
    core: (p2, cap, ch) => `Deposit $${cap} of USDC into ${p2.name}'s main product on ${ch} and keep the position open.`,
    second: (p2, cap, ch) => `Make one more deposit or interaction of a different kind in ${p2.name} on ${ch}, so the wallet shows varied use.`,
    weekly: 'make one qualifying interaction',
    caution: 'Read the protocol\'s risk page before sizing up; an unfamiliar product keeps the smallest position on this board.',
  };
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, built from the
 * protocol's own record (category playbook, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = GAS_TOKEN[chain] ?? 'the chain\'s gas token';
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const book = playbookFor(p);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet holding only farm funds, keep its seed phrase offline, and fund it with ${gas} for gas on ${chain}.`,
      cost: 'under $3 of gas',
      time: '5 minutes',
    },
    {
      text: book.core(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes',
    },
    {
      text: book.second(p, capital, chain),
      cost: 'about $3 of gas',
      time: '10 minutes',
    },
  ];
  if (secondChain !== null) {
    steps.push({
      text: `Repeat the core position on ${secondChain} at half size: activity on two of ${p.name}'s chains reads as a resident, not a one-off.`,
      cost: `about $${Math.round(capital / 2)} of capital and $4 of gas`,
      time: '15 minutes',
    });
  }
  steps.push(
    {
      text: `Once a week, ${book.weekly}, always on the same weekday, so the pattern reads as a habit, not a burst.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position at least ${hold} days, so it lands in more than one weekly snapshot of the protocol.`,
      cost: `$${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Watch-out: ${book.caution}`,
      cost: 'no cost',
      time: '10 minutes',
    },
    {
      text: `Before withdrawing, claim only from the link on ${p.name}'s own points or rewards page; log the wallet, dates and every transaction so the position can be repeated or unwound.`,
      cost: 'no fee; never pay to claim',
      time: '10 minutes',
    },
  );
  return steps.slice(0, 8);
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
      change_7d: p.change_7d,
    }));
}

/** A board row's form for data.js: the leaner RadarRow shape described on the interface. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    peer_multiple: row.model.peer_multiple,
    maturity_multiplier: row.model.maturity_multiplier,
    reason: row.reason,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const peers = boardPeers(snapshot, model);
  const board = scoreBoard(snapshot, peers, model);
  const live = liveRows(snapshot);
  const onBoard = new Set(board.map((r) => r.category ?? 'Uncategorised'));
  const multiples = [...peers.byCategory.values()]
    .filter((m) => onBoard.has(m.category))
    .sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_median: peers.globalMedian,
    multiples,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
