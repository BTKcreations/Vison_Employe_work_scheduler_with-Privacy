## 2025-05-15 - [React State Management in Search Modals]
**Learning:** In Next.js/React applications with strict linting (e.g., `react-hooks/set-state-in-effect`), it's better to reset modal state (query, results) in the event handlers that trigger the modal (click, keyboard shortcuts) rather than in a `useEffect` watching the `isOpen` state. This avoids unnecessary re-renders and potential "set state in effect" linting errors.
**Action:** Always prefer clearing input/result state in the `onOpen` or `onClose` event handlers for modal components.

## 2025-05-15 - [Keyboard Navigation with Flat Lists]
**Learning:** When implementing keyboard navigation across categorized search results (e.g., Employees, Companies, Tasks), mapping them into a memoized "flat" array with explicit type markers makes the index-based navigation logic significantly simpler and more robust.
**Action:** Use `useMemo` to create a flattened version of categorized data for simplified keyboard selection logic.

## 2025-05-31 - [Accessibility for Icon-only Buttons]
**Learning:** Icon-only buttons without descriptive attributes are inaccessible to screen reader users and can be ambiguous for mouse users. Pairing `aria-label` with `title` attributes provides both screen reader support and visual tooltips.
**Action:** Always include both `aria-label` and `title` attributes on icon-only buttons to ensure universal accessibility and clarity.

## 2025-06-02 - [Accessibility and Linting in Modal Components]
**Learning:** Pairing `aria-label` and `title` on icon-only buttons ensures both screen reader accessibility and visual tooltips. Additionally, moving state initialization (like welcome messages or data fetching) from `useEffect` to the component's toggle/open handler resolves `react-hooks/set-state-in-effect` linting errors and prevents unnecessary re-renders.
**Action:** Use explicit open/toggle handlers to initialize modal state instead of `useEffect`. Always include `aria-label` and `title` for icon-only interactive elements.
