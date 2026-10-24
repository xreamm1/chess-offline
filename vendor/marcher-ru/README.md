# Marcher RU — experimental browser adaptation

This is a Russian-rules adapter around Marcher NNUE, not the unmodified English-draughts Marcher search and not a newly trained Russian NNUE.

- Upstream Marcher: https://github.com/Stermere/Checkers-Engine , MIT. `marcher-scalar.js` and `.wasm` are the engine-latest release built from upstream commit `1fa785e`.
- Russian move generation, complete capture paths, promotion during captures, alpha-beta/PVS search and up-to-five-piece endgame tables: Damka by Anton Medvedev, MIT, under `../damka/`.
- The integration source is `../../damka-worker-entry.ts`; `../damka/src/engine/eval.ts` adds the adapter hook.
- Marcher's exported `_wasm_nnue_eval` runs on transformed Russian positions. The English-trained NNUE contributes a bounded positional correction (at most one man), while Russian flying-king material values and exact Russian endgame tables take precedence.
- The upstream English move generator, forced-jump search, opening book and English endgame tables are **not** used: their rules are incompatible with Russian draughts.
- A single Worker performs the search. Time budgets and maximum depth are capped. No external calls are needed after the page is cached.

The adapted engine's rating has not been measured. No claim that it is the strongest Russian draughts program is made. Proper training on Russian-draughts self-play and controlled engine matches are future work.

Rebuild the adapter with esbuild 0.25.11:

```
npx esbuild damka-worker-entry.ts --bundle --format=iife --minify --outfile=damka-worker.js
```

The integration uses Damka's simplified 30-quiet-king-ply draw rule plus threefold repetition in the UI, not every official tournament material-specific draw limit. The original licenses and rule documentation are retained.
