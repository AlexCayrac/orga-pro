# Layout crossings reference

Generated: 2026-03-06

- runEngineOnFail.js (saved failing graph): crossings 0 → 0, positions size 12

Test suite (npx jest orga-pro/tests/layoutEngine.test.js):
- small family: nodes=12 edges=11 crossings: 9 → 3 (cpe 0.818 → 0.273)
- medium family: nodes=60 edges=63 crossings: 143 → 47 (cpe 2.270 → 0.746)
- large family: nodes=120 edges=135 crossings: 890 → 193 (cpe 6.593 → 1.430)
- stress test: nodes=240 edges=305 crossings: 3318 → 1022 (cpe 10.879 → 3.351)

Notes:
- All tests passed after the barycenter-reorder safeguard change.
- These values serve as a baseline for future regressions.
