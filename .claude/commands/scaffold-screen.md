---
description: Scaffold a new React Native screen with NativeWind styling, navigation types, and standard patterns
argument-hint: <ScreenName> [stack-name]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Scaffold a New Mobile Screen

Create a new screen: **$ARGUMENTS**

## Reference Patterns

### Screen structure:
!`head -80 apps/mobile/src/screens/logging/TextSearchScreen.tsx`

### Navigation types:
!`cat apps/mobile/src/navigation/types.ts | head -60`

### Zustand store pattern:
!`head -50 apps/mobile/src/stores/dashboardStore.ts`

## Instructions

1. Create the screen component at `apps/mobile/src/screens/<appropriate-directory>/<ScreenName>.tsx`
   - Use NativeWind `className` props (NOT StyleSheet)
   - Include loading, error, and empty states
   - Use `useNavigation()` and `useRoute()` with proper typing
   - Use `useCallback` for event handlers
2. Add navigation type to `apps/mobile/src/navigation/types.ts` with proper params
3. Register the screen in the appropriate navigator
4. If the screen needs state management, create/update a Zustand store
5. Run `npm run typecheck --workspace=apps/mobile` to verify
6. Commit the new screen
