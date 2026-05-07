# Style PR Checklist

Use this checklist for UI-related pull requests.

- [ ] New or updated styles use tokens from `src/theme/index.ts`.
- [ ] Static styles are implemented in `StyleSheet.create` (no avoidable inline style objects).
- [ ] No new raw hex colors outside `src/theme/index.ts`.
- [ ] Existing shared components were reused when possible.
- [ ] Interactive controls include `testID` and basic accessibility props.

## Local Guardrail Command

Run before opening a PR:

`npm run lint:styles`
