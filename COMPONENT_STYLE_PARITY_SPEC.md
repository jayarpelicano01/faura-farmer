# Faura-Farmer Component Style Parity Specification

> **Status:** Implemented locally; device visual acceptance pending.
> **Scope:** Mobile primitive styling and burger-toggleable navigation sidebar/auth chrome only.
> **Reference implementation:** `apps/web/src/components/ui/` and `apps/web/src/components/dashboard/sidebar.tsx`.
> **Companion document:** A future `MOBILE_DESIGN_PARITY_SPEC.md` will cover screen coverage, feature parity, and mobile layouts. Those topics are intentionally excluded here.

## 1. Objective

Make the Expo application's shared controls visually belong to the same Faura-Farmer design system as the web application while preserving native accessibility and interaction conventions.

The first implementation focus is the primary, destructive, compact, and constrained mobile buttons used by:

- `Unlock this device` in `apps/mobile/app/_layout.tsx`
- `Log out of this device` in `apps/mobile/app/(tabs)/more.tsx`
- `New` in `apps/mobile/app/(tabs)/transactions.tsx`
- Sign-in, registration, save, and delete actions that consume `Button`

## 2. Scope and Non-goals

### In scope

- Mobile semantic theme tokens that drive shared controls.
- `Button`, `Field`, `Card`, `AuthModeSelector`, and drawer navigation styling.
- Shared mobile equivalents for web badges, separators, loading indicators, and skeletons.
- Visual alignment of destructive actions with a shared red/coral semantic color.
- Replacing the mobile-only `buttonBackground` token with the canonical primary-solid token.

### Out of scope

- Adding mobile pages or feature parity for budgets, reports, recurring transactions, profile management, CSV, receipts, or OAuth.
- Changing navigation destinations or the number of drawer items.
- Replacing native modal, alert, biometric, offline, sync, or form behavior.
- Changing desktop web layout or navigation behavior.
- Introducing a general button shadow, elevation, or capsule/pill geometry. The web `Button` is a flat `rounded-md` control, not a pill button.

## 3. Confirmed Design Decisions

| Decision | Required outcome |
| --- | --- |
| Primary button surface | Remove `buttonBackground`; mobile primary actions use `theme.primarySolid` directly. |
| Destructive surface | Use a red/coral token on both clients instead of the current navy destructive token. |
| Destructive foreground | Define an explicit destructive foreground token on both clients; do not rely on an undefined CSS variable or reuse the primary foreground. |
| Card radius | Keep the mobile card radius at 12px as a deliberate native adaptation. |
| Button geometry | Match the web's `rounded-md` visual language: 6px radius, not a generic 14px rounded control. |
| Native touch targets | Retain a minimum 44px touch target for full and constrained actions, even though the web's default visual height is 40px. |
| Loading feedback | Buttons show a spinner as well as a loading label, matching the web's icon-plus-label pattern. |

## 4. Baseline Findings Resolved by This Implementation

### 4.1 Button radius is present but does not match the web reference

Before this implementation, `apps/mobile/src/ui/primitives.tsx` applied `borderRadius: 14` in the base `Button` style. It was not being omitted by the shared component: every `Pressable` received that style before its size and tone styles.

The mismatch is that the web control uses Tailwind `rounded-md` (6px), while mobile uses a substantially rounder 14px corner. The target is a compact rounded rectangle, not a pill.

### 4.2 Primary button surface uses a non-canonical token

The mobile primary variant used `theme.buttonBackground`, an app-local semi-transparent value. The web primary button uses the canonical opaque `primary-solid` token. This was the concrete reason a primary action could visually blend with the surface rather than read as a system control.

`buttonBackground` is a user-created artifact and must be removed rather than tuned.

### 4.3 Destructive semantics are not visually destructive

Both destructive tokens were navy. The user selected red/coral destructive actions instead. The web implementation also used `text-destructive-foreground` without defining `--destructive-foreground` in `apps/web/src/app/globals.css`; the shared token change corrects that omission.

### 4.4 Mobile semantic foregrounds are ambiguous

`theme.primaryForeground` was white in both modes and was used for content on `primarySolid` surfaces. The web system distinguishes `primary-foreground` from `primary-solid-foreground`. The mobile theme now mirrors that distinction so badges, standard-primary surfaces, and primary-solid controls can be styled correctly in both color modes.

### 4.5 The prior button visual-system reports are implementation history, not acceptance

The worktree contains earlier button-system reports and uncommitted UI changes. This specification does not alter them. Device or simulator validation is still required after implementation because no source-only review can prove native visual rendering.

## 5. Shared Token Contract

### 5.1 Web changes

Update `apps/web/src/app/globals.css` in both `:root` and `.dark`:

| Token | Light value | Dark value | Purpose |
| --- | --- | --- | --- |
| `--destructive` | `8 64% 42%` | `8 72% 62%` | Red/coral destructive fill |
| `--destructive-foreground` | `0 0% 100%` | `226 85% 8%` | Accessible text/icon color on destructive fill |

Keep `--primary-solid` and `--primary-solid-foreground` unchanged.

### 5.2 Mobile changes

Update `apps/mobile/src/ui/theme.tsx` so its semantic roles mirror the web CSS variables:

| Mobile token | Light value | Dark value | Maps to |
| --- | --- | --- | --- |
| `primaryForeground` | `hsl(0, 0%, 100%)` | `hsl(211, 91%, 10%)` | `--primary-foreground` |
| `primarySolidForeground` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | `--primary-solid-foreground` |
| `danger` | `hsl(8, 64%, 42%)` | `hsl(8, 72%, 62%)` | `--destructive` |
| `dangerForeground` | `hsl(0, 0%, 100%)` | `hsl(226, 85%, 8%)` | `--destructive-foreground` |
| `secondary` | `hsl(174, 42%, 92%)` | `hsl(210, 24%, 20%)` | `--secondary` |
| `secondaryForeground` | `hsl(200, 26%, 25%)` | `hsl(174, 42%, 90%)` | `--secondary-foreground` |

Remove `buttonBackground` from both mobile theme objects. `surface`, `overlay`, and `shadow` may remain because they serve non-button native surfaces.

### 5.3 Foreground migration map

After adding `primarySolidForeground`, update content rendered on a `primarySolid` background to use it:

- `apps/mobile/src/ui/primitives.tsx`: primary button label and selected `ChoiceChip` label.
- `apps/mobile/src/ui/auth-mode.tsx`: active tab label.
- `apps/mobile/src/ui/app-shell.tsx`: active navigation icon/label and avatar text.
- Mobile dashboard, accounts, transactions, and profile initials that appear on a `primarySolid` circle.

Use `dangerForeground` for destructive button labels. Use `primaryForeground` only for content on a standard `primary` background.

## 6. Priority 0: Mobile Button System

### 6.1 Target API

Align mobile variant names with web semantics. The target mobile `Button` variants are:

| Mobile variant | Web equivalent | Surface |
| --- | --- | --- |
| `default` | `default` | `primarySolid` |
| `destructive` | `destructive` | `danger` |
| `outline` | `outline` | `background` with `input` border |
| `secondary` | `secondary` | `secondary` |
| `ghost` | `ghost` | Transparent at rest; accent on press |
| `link` | `link` | Transparent, primary text |
| `income` | `income` | `income` |
| `expense` | `expense` | `expense` |

The current `tone="primary"`, `tone="danger"`, and `tone="plain"` names are mobile-only. Migrate call sites to the shared semantic names rather than maintaining duplicate aliases without a concrete external consumer.

### 6.2 Target geometry and typography

| Property | Web reference | Mobile target | Notes |
| --- | --- | --- | --- |
| Radius | `rounded-md` = 6px | 6px | Replaces the current 14px button-only radius. |
| Font family | Albert Sans body font | Albert Sans body font | Already aligned. |
| Font size | 14px | 14px | Already aligned. |
| Font weight | 500 | 500 | Replaces the current 700. |
| Icon/text gap | 8px | 8px | Use a row layout when an icon is supplied. |
| Default web height | 40px | 44px minimum touch target | Preserve native usability. |
| Full/constrained height | N/A | 46px minimum | Existing native sizing remains valid. |
| Compact height | 40px current | 44px minimum where space allows | Header actions must remain easy to tap. |
| Horizontal padding | 16px | 16px | Replaces 18px. |
| Pressed feedback | Color change | Accent/color shift plus current subtle scale | Do not use a permanent drop shadow. |
| Disabled state | 50% opacity | 50% opacity and disabled pressability | Already aligned. |

### 6.3 Target tone styling

| Variant | Background | Border | Label/icon color |
| --- | --- | --- | --- |
| `default` | `theme.primarySolid` | None | `theme.primarySolidForeground` |
| `destructive` | `theme.danger` | None | `theme.dangerForeground` |
| `outline` | `theme.background` | 1px `theme.input` | `theme.foreground` |
| `secondary` | `theme.secondary` | None | `theme.secondaryForeground` |
| `ghost` | Transparent at rest | None | `theme.foreground` |
| `link` | Transparent | None | `theme.primary`, with underline treatment where supported |
| `income` | `theme.income` | None | White |
| `expense` | `theme.expense` | None | White |

### 6.4 Loading state

Add a `loading?: boolean` property to `Button`.

- A loading button is disabled and retains its geometry.
- It renders a 16px `ActivityIndicator` beside the loading label.
- The spinner uses the tone-appropriate foreground color.
- Existing callers may continue to provide their current loading copy, for example `Signing in...`.

### 6.5 Explicit non-requirements

- Do not add a generic shadow or Android elevation to standard buttons. The web reference is flat.
- Do not make standard buttons `rounded-full` or increase their radius beyond 6px.
- Do not use the removed `buttonBackground` token in any screen-local style.

## 7. Priority 0: Auth Mode Selector

`apps/mobile/src/ui/auth-mode.tsx` must match the visual treatment of the web authentication selector while retaining separate mobile routes.

| Property | Web | Mobile target |
| --- | --- | --- |
| Selector background | `muted` | `theme.muted` |
| Selector padding and gap | 4px | 4px |
| Selector radius | 6px | 6px, replacing 8px |
| Tab radius | 6px | 6px |
| Horizontal tab padding | 16px | 16px |
| Display font size | 14px | 14px, replacing 12px |
| Display font weight | 600 | 600 |
| Active fill | `primarySolid` | `theme.primarySolid` |
| Active foreground | `primarySolidForeground` | `theme.primarySolidForeground` |
| Inactive foreground | `mutedForeground` | `theme.mutedForeground` |
| Route behavior | In-page state | Keep `router.replace()` between `/login` and `/register` |

Retain a 44px minimum tab target for native accessibility; it is an intentional mobile-only size difference.

## 8. Priority 1: Burger-toggleable Navigation Sidebar

`apps/mobile/src/ui/app-shell.tsx` is the native burger-toggleable sidebar counterpart of `apps/web/src/components/dashboard/sidebar.tsx`. This work aligns shared visual rules only; it does not change mobile routes or introduce missing web navigation items.

| Property | Web sidebar | Mobile burger-sidebar target |
| --- | --- | --- |
| Width | 256px (`w-64`) | Keep 256px |
| Active fill | `primarySolid` | `theme.primarySolid` |
| Active foreground | `primarySolidForeground` | `theme.primarySolidForeground` |
| Item radius | 6px | 6px, replacing 8px |
| Label size | 14px | 14px, replacing 15px |
| Label weight | 500 | 500, replacing 600 |
| Icon size | 16px | 16px, replacing 18px |
| Inactive foreground | `mutedForeground` | `theme.mutedForeground` |
| Pressed state | Accent surface | `theme.accent` surface |
| Native target | Browser-dependent | Keep 44px minimum |

The user profile and theme-control footer remains part of the native burger sidebar. The profile destination and theme behavior do not change in this scope.

## 9. Priority 1: Form Controls and Auth Card

### 9.1 Field

| Property | Web input | Mobile target |
| --- | --- | --- |
| Radius | 6px | 6px, replacing 8px |
| Border | 1px `input` | Already aligned |
| Background | `background` | Already aligned |
| Body font size | 14px | 14px, replacing 16px |
| Label size | 14px | Already aligned |
| Label weight | 500 | 500, replacing 600 |
| Label/input gap | 8px | 8px, replacing 7px |
| Touch/input height | 40px visual baseline | Keep 46px minimum native input target |

### 9.2 Card

| Property | Web card | Mobile target |
| --- | --- | --- |
| Background | `card` | `theme.card` |
| Border | 1px `border` | Keep hairline border for native rendering |
| Radius | 8px | Keep 12px by approved mobile design decision |
| Shadow | `shadow-sm` | Keep current restrained native shadow; do not increase it to compensate for button styling |
| Content structure | Header/content/footer helpers | Keep the current simple wrapper unless a screen needs a reusable layout helper |

Adding mobile `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` is optional future cleanup, not a prerequisite for button-style parity.

## 10. Priority 2: Missing Shared Visual Primitives

These primitives are required before future page-level parity work, but they do not block the Priority 0 button correction.

| Primitive | Web reference | Mobile requirement |
| --- | --- | --- |
| `Badge` | `ui/badge.tsx` | Add rounded-full variants: default, secondary, destructive, outline, income, expense, muted. Use 12px semibold text and semantic foregrounds. |
| `Separator` | `ui/separator.tsx` | Add horizontal and vertical hairline variants driven by `theme.border`. |
| `Spinner` | `ui/spinner.tsx` | Wrap `ActivityIndicator` as a shared 16px control spinner. |
| `Skeleton` | `ui/skeleton.tsx` | Add a `theme.muted` rounded placeholder with native opacity-pulse animation. |

## 11. Migration Sequence

1. Complete: update semantic tokens in web `globals.css` and mobile `theme.tsx`, including the coral destructive foregrounds.
2. Complete: remove `buttonBackground` and migrate all uses to `primarySolid`.
3. Complete: add `primarySolidForeground` and migrate every `primarySolid` consumer listed in Section 5.3.
4. Complete: rebuild the mobile `Button` variants and update all call sites from the old tone names.
5. Complete: update the auth selector and burger-toggleable sidebar styles to the target visual values.
6. Complete: normalize `Field` corner radius, type scale, and label rhythm.
7. Complete: add the Priority 2 primitives and adopt `Badge` for archived-account status.
8. Pending external validation: run visual acceptance on physical or emulated Android and iOS in light and dark modes.

## 12. Acceptance Criteria

### Static and automated checks

- `buttonBackground` no longer exists in mobile source.
- Web defines both `--destructive` and `--destructive-foreground` in light and dark themes.
- Mobile defines `primarySolidForeground` and `dangerForeground` in light and dark themes.
- The mobile primary button uses `theme.primarySolid`.
- The mobile destructive button uses `theme.danger` and `theme.dangerForeground`.
- The `Button` primitive exposes all eight variants and a loading state.
- Mobile type checking and a production bundle export complete successfully.

### Visual acceptance

Inspect light and dark themes on Android and iOS at phone width:

- `Unlock this device`, `Log out of this device`, and `New` have a clear opaque fill, 6px rounded corners, 14px medium labels, and visible pressed feedback.
- Destructive controls are visibly coral/red and remain readable in both themes.
- Primary-solid labels, selected chips, active authentication tabs, drawer selections, and avatar initials retain correct contrast.
- Auth mode tabs match the web selector's fill, spacing, and 14px display type while preserving native touch targets.
- Input fields, drawer items, cards, and secondary actions retain clear boundaries without unnecessary pill shapes or shadows.

## 13. Risks and Rollback

| Risk | Mitigation |
| --- | --- |
| Red/coral destructive text has insufficient contrast | Validate both theme pairs with a contrast checker and device inspection before release. |
| Renaming mobile button variants leaves a stale call site | Use TypeScript exhaustiveness and repository search for all previous `tone` values. |
| `primaryForeground` migration changes a primary-solid consumer to dark text in dark mode | Complete the Section 5.3 migration in the same change as the token split. |
| Compact controls lose touch usability when matching web geometry | Preserve a 44px native touch target even where visual spacing follows the web. |

Rollback is limited to reverting the implementation commit. This specification itself makes no runtime or production changes.
