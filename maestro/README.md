# Maestro E2E Tests — Coach Mobile

End-to-end tests for the Coach iOS/Android app using [Maestro](https://maestro.mobile.dev).

## Prerequisites

### 1. Install Maestro CLI

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Verify the installation:

```bash
maestro --version
```

### 2. Device / simulator

- **iOS**: an iPhone simulator or physical device with the Coach app installed (`com.coach.mobile`).
- **Android**: an emulator or physical device with the Coach app installed (`com.coach.mobile`).

The app must already be built and installed. Maestro does not build the app for you.

---

## Running tests

### Run all flows

```bash
maestro test maestro/flows/
```

### Run a single flow

```bash
maestro test maestro/flows/01-app-launch.yaml
maestro test maestro/flows/02-log-meal-quick-add.yaml
maestro test maestro/flows/03-view-dashboard.yaml
maestro test maestro/flows/04-check-settings.yaml
maestro test maestro/flows/05-water-logging.yaml
```

### Run with a specific device (iOS simulator)

```bash
maestro --device <udid> test maestro/flows/
```

### Record a video of the run

```bash
maestro record maestro/flows/03-view-dashboard.yaml
```

---

## Flow descriptions

| File | Description |
|------|-------------|
| `01-app-launch.yaml` | App launches, loading spinner disappears, correct screen appears (Home tab or Welcome screen) |
| `02-log-meal-quick-add.yaml` | Navigate to Log tab, open Quick Add, select Breakfast meal type, enter 450 kcal, save |
| `03-view-dashboard.yaml` | Verify calorie card, macro cards (Protein/Carbs/Fat), water widget, and meals section header are visible |
| `04-check-settings.yaml` | Navigate to Settings, verify profile card, General section rows, Integrations, Support & Legal, Sign Out, and version string |
| `05-water-logging.yaml` | Swipe to carousel page 1, tap Add water twice, tap Remove once, verify widget remains visible |

---

## Configuration

`maestro/.maestro/config.yaml` sets the app ID for iOS (`com.coach.mobile`).
For Android the package name is identical — no change required.

---

## Notes

- All flows are **independent** and can run in any order or standalone.
- Flows use `accessibilityLabel` and visible text rather than `testID` because the
  current codebase does not yet add `testID` props. If `testID` props are added to
  components in the future, update the selectors to `id:` for more robust targeting.
- The Log tab's center `+` button is a `PanResponder` (not a standard `Pressable`),
  so flow 02 navigates via the action strip inside the LogScreen rather than the tab
  bar button.
- Water add/remove buttons have no `testID` or `accessibilityLabel`; flows use the
  Ionicons mock `accessibilityLabel` (icon name) with an `index` selector.
