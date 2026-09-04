# Mobile Drawer Footer Implementation

- **Date:** 2026-09-04
- **Branch:** `feature/mobile-phase3-delivery`
- **Scope:** Mobile drawer footer only
- **Production touched:** No

## Changed areas

- Added `MOBILE_DRAWER_FOOTER_SPEC.md` with the approved scope and acceptance criteria.
- Updated `apps/mobile/src/ui/app-shell.tsx` footer so the existing profile action remains on the left and the existing theme action remains on the right.
- Reduced the profile avatar to 32px and matched the web footer's medium name weight.
- Styled the theme control as a 40px transparent ghost control with a 16px icon.
- Used `Pressable` child render callbacks to apply pressed surfaces to the visual inner views without changing navigation or theme behavior.

## Result

The footer now presents the intended `[avatar + name/email] ... [theme toggle]` layout. The profile action still navigates to `/more`; the theme action still calls `toggleMode`.

## Limitations

Device visual acceptance in Expo Go is pending.
