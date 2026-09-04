# Mobile Drawer Footer Spec

**Status:** Implemented locally; device visual acceptance pending
**Scope:** `apps/mobile/src/ui/app-shell.tsx` drawer footer only
**Reference:** `apps/web/src/components/dashboard/sidebar.tsx`

## Goal

Match the web sidebar footer while retaining mobile-appropriate interaction targets.

```
[ avatar  Name ]                         [ theme toggle ]
          email
```

The avatar, name, and email form one action that navigates to `/more`. The theme
toggle changes the local app theme. No additional menu action is added.

## Requirements

| Element | Requirement |
| --- | --- |
| Footer layout | Single horizontal row with the profile action on the left and theme toggle on the right. |
| Profile action | Retain the existing `/more` navigation and name/email hierarchy. |
| Avatar | 32px primary-solid circle with the user's initial. |
| Name | 14px, medium weight (`500`), foreground color. |
| Email | 12px, muted foreground color, below the name. |
| Theme toggle | 40px transparent ghost control with a 16px sun/moon icon. |
| Pressed feedback | Paint the pressed accent background on the visual inner `View`, using `Pressable`'s child render callback. |
| Footer separator | Retain the existing top border and bottom anchoring. |

## Non-Goals

- Do not change drawer navigation items, header, animation, width, or backdrop.
- Do not add a More, user-menu, or logout control.
- Do not alter theme behavior or profile navigation behavior.

## Verification

1. `pnpm --filter @faura-farmer/mobile typecheck` passes.
2. In Expo Go, the profile action opens `/more` and the theme icon toggles the app theme.
3. Light and dark modes retain readable name, email, icon, and pressed states.
