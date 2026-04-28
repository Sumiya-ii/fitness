---
name: release-ios
description: Prepare and submit an iOS release to TestFlight/App Store. Use when user asks to release, deploy, or submit to TestFlight or App Store.
disable-model-invocation: true
---

# iOS Release for Coach

## Pre-release Checks

Run quality gates first:

```bash
npm run lint && npm run typecheck && npm run test --workspaces
```

## Steps

1. Run `npm run lint && npm run typecheck && npm run test --workspaces` — all must pass before proceeding
2. Check current version:
   - Read `apps/mobile/app.config.js` (or `app.json`) for the current version and build number
   - Read `apps/mobile/package.json` for the current version
3. Ask user for new version number, or auto-bump patch version
4. Update version in the appropriate config files
5. Commit with message: `chore(release): prepare v{version} for TestFlight`
6. Push to `main`
7. Run the EAS build and submit:
   ```bash
   cd apps/mobile && eas build --profile production --platform ios
   ```
   Then submit:
   ```bash
   cd apps/mobile && eas submit --platform ios
   ```
8. Report the build URL from EAS output
9. Remind user:
   - Bundle ID: `com.coach.mobile`
   - Apple Team: `DZ9RLGDX2M`
   - EAS Project ID: `cf5c8344-d39a-4869-b00f-69b8720bfea8`
   - Current build number: check and increment from last build (currently 17+)
   - For JS-only changes, consider OTA: `eas update --branch production --message "description"`
