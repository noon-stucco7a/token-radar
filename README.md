# token-radar

[![make.fun bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/noon-stucco7a/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/noon-stucco7a/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar: a Node 22 program (standard library only) that reads the sealed
DefiLlama snapshot in `/input/snapshot.json`, ranks every pre-token protocol by an implied
value priced from its live peers, and writes a static dashboard a farmer can act on.

The model (radar-3, in `lib/model.ts`) prices each pre-token protocol as
`TVL x peer multiple x growth x maturity x 0.85`, where the peer multiple is the median
market-cap/TVL of the protocol's live-token category peers, shrunk toward the all-protocol
median. Radar-3 shrinks thin categories harder (below three live peers the shrinkage weight
grows by 9 per missing peer, so a median of one or two ratios is mostly discounted) and adds
a diversity quota: no category may hold more than 5 of the top 20 places, enforced by
stepping that category's multiple down x0.9 and repricing the board before any row is
written. The board covers the snapshot's whole watchlist and adds the strongest independent
pre-token protocols below the watchlist floor; every row carries its own reason and a
category-specific farm plan with costs and times. Protocols whose token already trades are
never ranked: they are the measuring stick, shown in the dashboard's Live view. The
dashboard's Method view states the model, its data sources and how each farm plan is
generated; the fourth screenshot shows it.

Run it the way the grader does:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

It writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` (built
with the vendored `vendor/makefun-board.ts`) into the output directory. Open
`dashboard/index.html` beside the generated `data.js` to use the board: search, filter by
category, chain or watchlist, sort any column, and open a protocol for its pricing
breakdown and farm plan. No network is needed or used.

License: MIT (see LICENSE).
