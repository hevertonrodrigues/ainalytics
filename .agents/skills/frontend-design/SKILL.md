---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when building web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

## SaaS Bootstrap Design System

For this project, we use a **refined dark-mode luxury** aesthetic:

### Typography

- Display: `"Outfit", sans-serif` — geometric, modern, premium
- Body: `"Plus Jakarta Sans", sans-serif` — warm, readable, refined
- Mono: `"JetBrains Mono", monospace` — for code/data

### Color Palette

```css
:root {
  /* Base */
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-tertiary: #1a1a2e;
  --bg-elevated: #222236;

  /* Brand */
  --brand-primary: #6c5ce7;
  --brand-secondary: #a29bfe;
  --brand-accent: #fd79a8;

  /* Text */
  --text-primary: #f0f0f5;
  --text-secondary: #9898b0;
  --text-muted: #555570;

  /* Status */
  --success: #00cec9;
  --warning: #fdcb6e;
  --error: #ff6b6b;

  /* Glass */
  --glass-bg: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-hover: rgba(255, 255, 255, 0.08);
}
```

### Effects

- **Glassmorphism**: Frosted glass cards with backdrop-blur
- **Gradient borders**: Subtle gradient borders on interactive elements
- **Micro-animations**: 200ms ease transitions on all interactive states
- **Glow effects**: Subtle brand-color glow on focused inputs and primary buttons
- **Staggered reveals**: Page load animations with cascading delays

### Component Standards

- All buttons: rounded-lg, padding 12px 24px, font-weight 600
- All inputs: dark bg, subtle border, brand glow on focus
- All cards: glass background, subtle border, rounded-xl
- All modals: centered, glass backdrop, scale-in animation
- Sidebar: fixed left, glass bg, icon + text nav items

## Implementation Rules

1. Use Tailwind utility classes with custom CSS variables
2. Every component must be responsive (mobile-first)
3. Animations via CSS transitions/keyframes (no external libs required)
4. Google Fonts loaded via `<link>` in `index.html`
5. Dark mode is the default and only theme (unless user requests light mode toggle)
6. All interactive elements must have hover/focus/active states
7. Loading states use skeleton animations, not spinners

NEVER use: Inter font, plain white backgrounds, basic blue buttons, default browser styles, or any generic/cookie-cutter patterns.
