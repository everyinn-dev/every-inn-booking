---
name: everyinn-admin-feature
description: Build or change a page, panel, drawer section or BFF API route in everyinn-admin (Next.js 16 + OpenNext on Cloudflare Workers, React 19, Tailwind 4) following the real post-Core conventions — AdminShell page shell, Sidebar + mobile nav, light slate/emerald theme, useToast, ETag adaptive polling, Core calls via src/lib/cores.ts, FakeCore tests. Use for any Every Inn admin UI or /api route work ("add a page", "agent inbox", "settings tab", "add a field to BookingDetailDrawer", "new admin endpoint"), and prefer it over the stale everyinn-admin CLAUDE.md.
---

# Every Inn Admin — feature recipe

Admin is a staff-only UI plus a thin BFF. **It holds no business data.** All bookings, holds, customers and AI data come from Cores through Service Bindings, and Admin's own D1 holds only staff and auth. Parts of `everyinn-admin/CLAUDE.md` and `.cursorrules` describe the pre-Core app; this skill and `everyinn-platform-docs/CONVENTIONS.md` §7 are current.

## 1. BFF route (`src/app/api/<area>/route.ts`)
- `export const dynamic = "force-dynamic"; export const revalidate = 0;`
- Check auth first: `const staff = await getCurrentStaff(); if (!staff) return 401`.
- Do light shape validation here, with Vietnamese messages. The Core does the real validation.
- Call the Core with `bookingCore` / `cdpCore` / `agentCore` (see the `everyinn-core-client` skill). Pass `staff`, an idempotency key for writes and `expectedVersion` for mutations.
- Pass ETag/304 through for list and view endpoints. See `src/app/api/dashboard/gantt/route.ts` for the pattern.
- Map errors with `coreErrorResponse(err)` or `toHttpError(err)` (`src/lib/apiError.ts`).
- **Role:** the Core enforces it from `x-ei-actor-role`. Still hide manager-only UI with `staff?.role === "manager"`.

## 2. Page (`src/app/<page>/page.tsx`)
```tsx
<AdminShell>
  <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
    <header>…emoji + <h1 className="text-2xl font-black text-slate-900"> + <p className="text-xs sm:text-sm text-slate-500"></header>
    …
  </div>
</AdminShell>
```
- **Navigation:** add the item to **both** `src/components/layout/Sidebar.tsx` (`baseNavItems`, or `financeNavItems` for manager-only) **and** the mobile bottom nav in `src/components/layout/AdminShell.tsx`. Update the active-match list if the path needs an exact match.
- **Tabs:** there is no shared Tabs component. Copy the segmented switcher from `src/app/promotions/page.tsx` (container `flex items-center bg-slate-200/80 p-1 rounded-xl`, active `bg-white text-emerald-900 shadow-xs`).
- **Shared UI:** `src/components/ui` has `Button` (primary/secondary/danger/ghost/outline), `Input`, `Select`, `Modal`, `Badge` and `Spinner`. Cards use `p-3.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs`.
- **Theme is LIGHT:** white or slate-50 surfaces, emerald for primary, amber for warning, rose for error, sky for Haven, purple for Signature. Do not introduce dark surfaces.
- **Feedback:** `const toast = useToast(); toast.success(msg, title?)`. Confirmations are inline (see the cancel prompt in `BookingDetailDrawer.tsx`). Never `alert` or `confirm`.
- **Copy:** Vietnamese. Time pickers use the 30-minute `TIME_SLOTS_30MIN` (`src/lib/timelineUtils.ts`) with past slots disabled.
- **Mobile:** the sidebar is `hidden lg:flex`, `main` has `pb-16 lg:pb-0`, and drawers are `fixed inset-0 … w-full max-w-md`.

## 3. Live data (no WebSocket)
OpenNext route handlers cannot proxy WebSocket upgrades, so use **ETag adaptive polling**, as in `src/app/dashboard/page.tsx`:
- send `If-None-Match` with the last ETag;
- start at 20 s and back off to 40 s and 60 s while responses are 304; reset on change;
- poll only while the tab is visible; revalidate on focus with a 15 s cooldown;
- for cross-tab refresh, use `notifyDataChanged()` / the BroadcastChannel in `src/lib/syncEvents.ts`.

A chat thread that is actively open may poll faster (5 s) only while it is visible and focused.

## 4. Client fetch
Use `apiFetch` (`src/lib/apiClient.ts`); it dispatches session-expired on 401. For writes, generate an `idempotency-key` once per user action (a `useRef`) and resend the same key on retry.

## 5. Tests and checks
- Route and client tests go in `test/<area>.test.mjs` with the `FakeCore` harness (`test/helpers/fakeCore.mjs`) and `setTestFetcher`. Contract tests go in `test/contract.test.mjs` against the synced `contracts/*.openapi.json`.
- Run `npm run lint && npx tsc --noEmit && npm test`. Check visually with `npm run dev` (it needs `.dev.vars` and bindings) or on `everyinn-admin-dev` after pushing to `dev`.
- **Never deploy from a laptop.** Pushing to `dev` triggers Workers Builds.
