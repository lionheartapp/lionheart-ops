# Deferred Items — Phase 20

## Out-of-scope issues discovered during execution

### 1. ShareHub.tsx — Pre-existing TypeScript errors

**File:** `src/components/events/project/ShareHub.tsx`
**Discovered during:** 20-03 Task 2 verification
**Status:** Pre-existing before this plan's changes

**Issues:**
- Imports `toast` from `sonner` which is not installed (should use project's `useToast` hook)
- `configData` typed as `{}` so `shareUrl`, `qrCodeDataUrl`, `maxCapacity`, `registeredCount`, `openAt` properties do not exist
- `staggerContainer` called as a function but it is `Variants` type

**Recommended fix:** Replace `from 'sonner'` with `useToast()` from `@/components/Toast`, and properly type the `useQuery` return value with the `ShareConfig` interface.

---

### 2. __tests__/lib/assistant-prompt.test.ts — Pre-existing TypeScript error

**File:** `__tests__/lib/assistant-prompt.test.ts:158`
**Discovered during:** 20-01 Task 3 (noted in 20-01 SUMMARY)
**Status:** Pre-existing

**Issue:** `relevantFacts` array missing `importance` field required by `AssembledContext` type.

**Recommended fix:** Add `importance: 0` to each item in the `relevantFacts` array in the test fixture.
