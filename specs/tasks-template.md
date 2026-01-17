# NShapes Bug Fixes & Improvements

> **For Claude:** Check off tasks with `[x]` as you complete them. Follow TDD where applicable: write tests first, implement, verify tests pass.

## Commit Protocol (IMPORTANT)

**After EVERY subsection:**
1. Run `npm test` - ALL unit tests must pass
2. Run `npm run typecheck` - no type errors
3. Run `npx playwright test` - ALL integration/e2e tests must pass
4. Commit with a descriptive message specific to that subsection
5. Only proceed to the next subsection after commit succeeds

**Do NOT batch commits.** Each subsection gets its own commit. This ensures:
- Every change is atomic and reversible
- Bugs can be traced to specific commits
- Progress is saved incrementally

---

# Example setup:
## Section 1: UI Display Improvements

### 1.1 Max Items Display Enhancement
**Issue:** Max items (like maxCount weapons) should show ownership count AND percentage stats should show their caps.

**Files:**
- `src/components/WeaponShop.tsx` - stat display
- `src/components/LevelUp.tsx` - stat display
- `src/components/CharacterSelection.tsx` - character stats

**Tasks:**
- [x] Show "2/3 owned" style display for weapons with maxCount when player owns multiple copies
- [x] Show percentage stats with their caps: "30% fire spread (max 70%)"
- [x] Update weapon cards to indicate ownership count when applicable
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [x] **Commit:** `fix(ui): show weapon ownership count and stat caps`


...

### Finale
- [x] Emit "FULLY 100% ENTIRELY DONE" on the log so that the loop ends.
