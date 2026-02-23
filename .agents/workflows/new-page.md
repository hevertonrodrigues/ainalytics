---
description: How to add a new page/feature with i18n to the frontend
---

# Add a New Page/Feature

1. Create the component file:

```
src/pages/<section>/<PageName>.tsx
```

2. Add translations to ALL three locale files:

```
src/i18n/locales/en.json
src/i18n/locales/es.json
src/i18n/locales/pt-br.json
```

3. Add the route in `src/App.tsx`:

```tsx
<Route
  path="/<path>"
  element={
    <ProtectedRoute>
      <PageName />
    </ProtectedRoute>
  }
/>
```

4. Add navigation item in `src/components/layout/Sidebar.tsx` (if needed)

5. Verify:

- [ ] No hardcoded strings (all use `t()`)
- [ ] All three locale files updated
- [ ] Route protected if authenticated page
- [ ] Responsive on mobile
- [ ] Uses design system tokens (CSS variables)
- [ ] Types defined in `src/types/index.ts`
