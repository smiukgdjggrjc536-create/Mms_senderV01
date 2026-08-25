# UX Overhaul — Enterprise Compact Single-Screen UI

## 1. Collapsible Sidebar
- [x] Add `sidebarCollapsed` state to UserDashboard
- [x] Add collapse/expand toggle button on desktop sidebar
- [x] Animate width: w-64 -> w-0 (collapsed) and main margin lg:ml-64 -> lg:ml-0
- [x] Icon-only collapsed rail optional (chevron toggle button shifts left-64 <-> left-0)

## 2. Compact SendTab (no page scroll — everything fits)
- [x] Wrap addTask content in a fixed-height container h-[calc(100vh-150px)] overflow-hidden
- [x] Use internal scroll areas per panel (left/center/right each scroll independently)
- [x] Reduce padding (p-4 -> p-2.5), spacing (space-y-4 -> space-y-2.5)
- [x] Make body textarea smaller (rows=3) inside center scroll area
- [x] Move action buttons into a sticky bottom bar inside the container
- [x] Tighter config chip row

## 3. Enterprise polish
- [x] Consistent compact card styling (rounded-xl, subtle borders)
- [x] Section headers tighter (text-[9px] uppercase tracking-wider)
- [x] Build + push + verify Vercel (commit 1b85831, READY, HTTP 200)
- [x] Bengali response
