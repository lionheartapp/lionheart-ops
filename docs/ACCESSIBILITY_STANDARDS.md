# Accessibility Standards (WCAG 2.1 AA)

**Status:** Established as core baseline — all new features must meet these standards from day 1.

**Date Established:** February 22, 2026

---

## Core Principle

> Everything we do needs to be thought through in a lens of accessibility and mobile-first design.

Lionheart serves diverse school communities (students, teachers, administrators, support staff) with varying needs, devices, and assistive technologies. **Accessibility is not a feature or polish phase—it's a foundational architectural requirement.**

---

## Compliance Target

- **Standard:** WCAG 2.1 Level AA (minimum)
- **Mobile First:** Design for 320px+ viewports first, then scale up
- **Keyboard Navigation:** All features must be fully usable with keyboard alone
- **Screen Reader:** All interactive elements properly labeled and announced

---

## Touch Targets & Spacing

### Minimum Touch Target Size
- **Buttons:** Minimum 44×44px (height + padding)
- **Form inputs:** Minimum 44×44px (height + padding)
- **Links/clickable areas:** Minimum 44×44px
- **Spacing between targets:** Minimum 8px gap to prevent mis-taps

```tsx
// ✅ CORRECT: Touch target with Tailwind
<button className="px-4 py-3 min-h-[44px] bg-blue-600 text-white rounded-lg">
  Click Me
</button>

// ❌ INCORRECT: Too small
<button className="px-2 py-1 bg-blue-600 text-white">Not Accessible</button>
```

### Mobile Spacing
- **Padding on mobile:** `p-4` (16px)
- **Padding on desktop:** `p-6` or `p-8` (24px or 32px)
- **Use responsive:** `p-4 sm:p-6 lg:p-8`

```tsx
// ✅ CORRECT: Responsive spacing
<section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
  Content
</section>
```

---

## Font Sizes & Readability

### Minimum Font Sizes
- **Body text:** 16px minimum (prevents browser zoom)
- **Labels:** 14px minimum
- **Captions/hints:** 12px acceptable with `text-gray-500` or lighter
- **Headlines:** Scale responsively with viewport

```tsx
// ✅ CORRECT: Mobile-first font scaling
<h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">
  Heading
</h1>

<p className="text-base sm:text-lg text-gray-600">
  Body text always readable
</p>

// ❌ INCORRECT: Too small on mobile
<h1 className="text-6xl">This is too large initially</h1>
<p className="text-xs">This is too small</p>
```

---

## Focus Indicators & Keyboard Navigation

### Global Focus Styles
All interactive elements must have visible focus indicators. Defined in `src/app/globals.css`:

```css
:focus-visible {
  outline: 2px solid #2563eb; /* blue-600 */
  outline-offset: 2px;
}
```

### Button/Link Focus Classes
Use these Tailwind classes for all interactive elements:

```tsx
// ✅ CORRECT: Clear focus indicator
<button className="px-4 py-3 min-h-[44px] bg-blue-600 text-white rounded-lg
  hover:bg-blue-700
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
  transition">
  Submit
</button>

// ❌ INCORRECT: No focus indicator
<button className="px-4 py-3 bg-blue-600 text-white rounded-lg">
  Submit
</button>
```

### Focus Ring Pattern
```tsx
// Standard focus ring (works on white/light backgrounds)
focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2

// For dark buttons (ring outline visible)
focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600

// For form inputs
focus:ring-2 focus:ring-blue-500 focus:border-transparent
```

### Keyboard Tab Order
- Tab order follows DOM order (don't use `tabindex` unless necessary)
- Use `tabindex="-1"` for decorative elements that shouldn't be keyboard accessible
- Modals should trap focus within the modal while open

---

## Form Semantics & Labels

### Always Use `<label>` with `htmlFor`

```tsx
// ✅ CORRECT: Explicit label association
<div>
  <label htmlFor="school-name" className="block text-sm font-medium text-gray-700 mb-2">
    School Name
  </label>
  <input
    id="school-name"
    type="text"
    placeholder="e.g., Mitchell Academy"
    aria-describedby="school-name-hint"
    className="w-full px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg
      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    required
  />
  <p id="school-name-hint" className="text-xs text-gray-500 mt-1">
    Enter your school's official name
  </p>
</div>

// ❌ INCORRECT: No label association
<div>
  <p>School Name</p>
  <input type="text" placeholder="School name..."/>
</div>

// ❌ INCORRECT: Implicit label (unclear to screen readers)
<label>
  School Name
  <input type="text"/>
</label>
```

### ARIA Attributes for Form Guidance

```tsx
// ✅ Input with hint text
<input
  id="password"
  type="password"
  aria-describedby="password-hint"
  required
/>
<p id="password-hint" className="text-xs text-gray-500 mt-1">
  At least 8 characters
</p>

// ✅ Real-time validation with aria-live
<div
  id="slug-status"
  aria-live="polite"
  aria-atomic="true"
>
  {validating && "Checking availability..."}
  {available === true && <span className="text-green-600">Available</span>}
  {available === false && <span className="text-red-600">Not available</span>}
</div>

// ✅ Error messages announced to screen readers
<div
  role="alert"
  aria-live="polite"
  className="bg-red-50 border border-red-200 rounded-lg p-3"
>
  <p className="text-sm text-red-700">{error}</p>
</div>
```

### Form Error Handling

```tsx
// ✅ CORRECT: Error with focus and announcement
const errorRef = useRef<HTMLDivElement>(null)

const handleSubmit = (e) => {
  if (error) {
    setError(errorMessage)
    errorRef.current?.focus() // Focus error for screen reader users
  }
}

return (
  <div
    ref={errorRef}
    role="alert"
    aria-live="polite"
    tabIndex={-1}
    className="bg-red-50 border border-red-200 rounded-lg p-3"
  >
    <p className="text-sm text-red-700">{error}</p>
  </div>
)
```

---

## ARIA Labels & Semantic HTML

### Icons with Text
```tsx
// ✅ CORRECT: Icon marked as decorative when text present
<button className="px-4 py-3 min-h-[44px]">
  Get Started <ChevronRight className="w-5 h-5" aria-hidden="true" />
</button>

// ✅ CORRECT: Icon-only button with aria-label
<button
  aria-label="Close modal"
  className="text-gray-400 hover:text-gray-600"
>
  <X className="w-6 h-6" aria-hidden="true" />
</button>

// ❌ INCORRECT: Icon-only button without label
<button>
  <X className="w-6 h-6" /> <!-- Screen reader doesn't know what this does -->
</button>
```

### Semantic HTML Elements
```tsx
// ✅ CORRECT: Use semantic elements
<nav role="navigation" aria-label="Main navigation">
  <a href="/">Home</a>
</nav>

<article>
  <h3>Feature Title</h3>
  <p>Description</p>
</article>

<footer role="contentinfo">
  Copyright info
</footer>

// ❌ INCORRECT: Everything is a div
<div> <!-- No semantic meaning -->
  <div onClick={() => navigate('/')}>Home</div>
</div>
```

### Modal Dialog Pattern
```tsx
// ✅ CORRECT: Modal with proper ARIA
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="presentation">
  <div
    role="dialog"
    aria-labelledby="modal-title"
    aria-modal="true"
    className="bg-white rounded-lg shadow-xl max-w-md w-full"
  >
    <h2 id="modal-title" className="text-lg font-bold p-6">
      Create Account
    </h2>
    <div className="p-6">
      {/* Content */}
    </div>
  </div>
</div>
```

---

## Color Contrast

### WCAG AA Contrast Ratios (Minimum)
- **Normal text:** 4.5:1
- **Large text** (18pt+ or 14pt+ bold): 3:1
- **UI components:** 3:1

### Current Design System
- **Blue-600 text on white:** ≥4.5:1 ✅ (WCAG AA compliant)
- **Gray-600 text on white:** ≥4.5:1 ✅
- **Red-600 error on white:** ≥5:1 ✅ (WCAG AAA)
- **Green-600 success on white:** ≥5:1 ✅ (WCAG AAA)

### Testing Color Contrast
Use WebAIM Color Contrast Checker: https://webaim.org/resources/contrastchecker/

```tsx
// ✅ CORRECT: Adequate contrast
<p className="text-blue-600">Link text on white background</p>

// ❌ INCORRECT: Low contrast
<p className="text-gray-400">Text on white - hard to read</p>
```

---

## Mobile-First Responsive Design

### Breakpoint Strategy
```tsx
// Mobile first: Design for 320px, enhance upward
<div className="text-xs sm:text-sm md:text-base lg:text-lg">
  Text size increases with viewport
</div>

// Grid layouts
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
  {/* Single column on mobile, 2 on tablet, 3 on desktop */}
</div>

// Flexibility for small screens
<div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
  {/* Stack vertically on mobile, horizontal on desktop */}
</div>
```

### No Horizontal Scroll at 320px
- Test all pages at 320px viewport width
- Ensure no content requires horizontal scrolling
- Use `overflow-hidden` on body if needed

### Form Input Sizing on Mobile
```tsx
// ✅ CORRECT: 44px minimum, readable on mobile
<input
  type="text"
  className="w-full px-4 py-3 min-h-[44px] text-base border rounded-lg
    focus:ring-2 focus:ring-blue-500"
/>

// ❌ INCORRECT: Too small on mobile
<input
  type="text"
  className="w-full px-2 py-1 text-sm border rounded-lg"
/>
```

---

## Reduced Motion

Users with vestibular disorders or motion sensitivity may have `prefers-reduced-motion` enabled. Defined in `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### In Code
```tsx
// ✅ CORRECT: Animations respect user preference
<div className="animate-spin"> {/* Automatically respects prefers-reduced-motion */}
  <Loader2 />
</div>

// Transitions work the same way with Tailwind
<button className="transition"> {/* Respects user preference */}
  Click
</button>
```

---

## Testing Checklist

### ✅ Before Deploying Any Feature

- [ ] **Keyboard Navigation**
  - Tab through every interactive element
  - Shift+Tab reverse navigation works
  - Focus always visible (blue ring or outline)
  - Modal/overlay focus trapped when open
  - Can reach all elements without using mouse

- [ ] **Screen Reader Testing** (use NVDA, JAWS, or VoiceOver)
  - Form labels announced correctly
  - Buttons/links purpose clear from label
  - Error messages announced with `role="alert"`
  - Loading states announced with `aria-busy`
  - Modals announced with `role="dialog"`

- [ ] **Mobile Testing** (at 320px, 375px, 768px)
  - All touch targets at least 44×44px
  - No horizontal scroll
  - Text readable at default zoom (16px+)
  - Form inputs easily tappable
  - Buttons clearly clickable

- [ ] **Color Contrast**
  - Use WebAIM Color Contrast Checker
  - Normal text: 4.5:1 minimum
  - All states (normal, hover, focus, disabled) meet contrast

- [ ] **Semantic HTML**
  - Uses `<button>` not `<div onClick>`
  - Uses `<nav>`, `<article>`, `<footer>` appropriately
  - Headings in logical order (h1, h2, h3...)
  - Form controls properly labeled

---

## Code Examples by Component Type

### Button Component Pattern
```tsx
<button
  onClick={handleClick}
  disabled={isLoading}
  className="px-4 sm:px-6 py-3 min-h-[44px]
    bg-blue-600 text-white font-medium rounded-lg
    hover:bg-blue-700
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    transition"
  aria-busy={isLoading}
  aria-label="Clear description of button action"
>
  {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
  Button Text
</button>
```

### Form Field Pattern
```tsx
<div>
  <label htmlFor="field-id" className="block text-sm font-medium text-gray-700 mb-2">
    Label Text
  </label>
  <input
    id="field-id"
    type="text"
    placeholder="Placeholder text"
    className="w-full px-4 py-3 min-h-[44px] text-base
      border border-gray-300 rounded-lg
      focus:ring-2 focus:ring-blue-500 focus:border-transparent
      outline-none transition"
    aria-describedby="field-hint"
    required
  />
  <p id="field-hint" className="text-xs text-gray-500 mt-1">
    Helper text or requirements
  </p>
</div>
```

### Modal Pattern
```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="presentation">
  <div
    role="dialog"
    aria-labelledby="modal-title"
    aria-modal="true"
    className="bg-white rounded-lg shadow-xl max-w-md w-full"
  >
    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
      <h2 id="modal-title" className="text-lg sm:text-xl font-bold text-gray-900">
        Modal Title
      </h2>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1 transition"
        aria-label="Close modal"
      >
        <X className="w-6 h-6" aria-hidden="true" />
      </button>
    </div>
    <div className="p-4 sm:p-6">
      {/* Content */}
    </div>
  </div>
</div>
```

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [MDN: Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WAI-ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Next.js Accessibility](https://nextjs.org/learn/foundations/accessibility)

---

## Questions or Clarifications?

If any accessibility requirement is unclear or conflicts with design goals, document the decision and rationale in this file for consistency across the codebase.

**Last Updated:** February 22, 2026
