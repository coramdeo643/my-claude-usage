# Changelog

## 1.1.0

Weekly usage is now visible in the status bar without hovering.

### What's new

- Show both windows in the status bar: a ring for the 5-hour session and a pie for the weekly limit, e.g. `Claude ◔ 20% ◑ 45%`.
- Hover tooltips draw colored ring/pie charts with reset countdowns (`5h 20% 2h 15m`, `7d 45% 4d 3h`).
- The warning color now follows whichever window is closer to its limit (yellow at 70%+, red at 90%+), so a nearly exhausted weekly limit is no longer missed.

### Improvements

- Multiple VS Code windows now share a single usage request instead of each polling on its own, which caused rate limiting (429).
- Rate limits back off automatically, and the last successful reading stays visible during temporary failures.
- The status bar distinguishes No Auth, Rate limited, Offline, and Loading instead of reporting every failure as No Auth.
- Updated the extension logo.
- English is now the primary README, with Korean and Chinese translations.

### Thanks

Special thanks to **Alejandro Lora** for the Marketplace review suggesting that the weekly limit be shown without hovering. This release is built around that request.

## 1.0.0

- Initial release: Claude Code 5-hour usage in the status bar, with 5h/7d details on hover.
