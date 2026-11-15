# Smart Wardrobe UI guidelines

- **daisyUI** is the default for basic controls: `btn`, `input`, `textarea`, `select`, `checkbox`, `radio`, `badge`, `alert`, `card`.
- The `smartwardrobe` theme in `apps/web/src/styles/app.css` owns colors, radii, and base component tokens. Use daisyUI classes (`btn-primary`, `bg-base-100`) instead of duplicating color values.
- Use Tailwind mainly for layout/spacing. Preserve existing domain classes when they represent page layout or behavior.
- A small application component is justified when it shares behavior, accessibility, or form integration. Do not wrap components merely to rename daisyUI classes.
- Autocomplete, suggestion lists, menus, and dialogs with focus/keyboard/outside-click behavior need React/Radix logic. daisyUI classes alone do not implement these interactions.
- Do not introduce custom variants of standard buttons, fields, badges, or cards without a specific accessibility/domain need.
- Control changes must preserve focus, disabled/loading states, validation, responsiveness, and Polish labels; verify them with desktop/mobile Playwright.

Complex autocomplete and interactions remain outside the basic-control migration.
