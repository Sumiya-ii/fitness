---
name: add-screen
description: Scaffold a new React Native screen with NativeWind styling and navigation. Use when user asks to add or create a new mobile screen.
disable-model-invocation: true
---

Scaffold a new mobile screen: $ARGUMENTS

## Project Conventions

- **NativeWind only** for styling — use `className`, never `StyleSheet.create()` or inline styles
- **Zustand** for state management — no Redux, no Context for state
- React Navigation 7 with typed `NativeStackScreenProps<ParamList, 'ScreenName'>`
- `useColors()` for theme, `useLocale()` for i18n, `useProGate()` for subscription
- `useFocusEffect(useCallback(...))` for screen lifecycle — not `useEffect`
- `api` client from `src/api/client.ts` — never raw `fetch`
- i18n: all user-facing strings through translation keys (Mongolian + English)
- File naming: kebab-case

## Reference

- Existing screens: `apps/mobile/app/`
- Navigation types: check for `ParamList` type definitions
- Hooks: `useColors()`, `useLocale()`, `useProGate()`
- i18n files: look for translation JSON files (mn + en)

## Steps

1. Read 2-3 existing screens in `apps/mobile/app/` to match the exact pattern (imports, props typing, NativeWind usage)
2. Read navigation type definitions to find the `ParamList` type
3. Create `apps/mobile/app/<screenName>/<ScreenName>Screen.tsx` with:
   - Typed `NativeStackScreenProps` props
   - NativeWind `className` styling throughout (no StyleSheet)
   - `useColors()` for theme-aware colors
   - `useLocale()` for translated strings
   - `useFocusEffect` for data loading
   - Placeholder UI content
4. Add screen to navigation types (`ParamList`)
5. Add translation keys for both `mn` and `en` locale files
6. Run `npm run typecheck --workspace=apps/mobile` to verify no type errors
7. Report what was created and where the screen was registered
