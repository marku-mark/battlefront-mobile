# Mobile UI decisions

- Keep existing routes, five navigation tabs, saved theme preferences, and server-authoritative pricing.
- Use the existing 4/8/12/16/24/32 spacing scale and 8px corners for cards and controls. Use thin borders rather than card shadows.
- Body text is 14–16px; secondary text is at least 12px. Filter and primary action targets are at least 48px.
- Product cards show contained imagery, name, price, optional rating/discount, one stock label, wishlist, and an action. Quantity belongs in details/cart. Products with options open details.
- A single in-memory chat provider owns messages, draft, requests, and modal visibility. Home, Account, and product details open the same conversation. Authentication changes and confirmed reset clear it; closing does not.
- Requests are serialized. Failed messages retain inline retry, server rate limits control cooldown, and there is no automatic resend. Reset invalidates late responses and context tokens.
- Phones use full-screen chat; tablets use a constrained panel. New replies do not move readers away from older messages.
- Android splash uses the existing padded adaptive icon at 200dp, rather than the tightly cropped logo at 260dp. Android launcher artwork remains unchanged. A new native APK build is required for splash and keyboard configuration changes.

## Device acceptance checks

Check Android/iOS phones at 320/360/390px widths, tablet, both themes, enlarged text, and reduced motion. Confirm keyboard does not obscure the composer, screen-reader controls and focus work, chat retains draft/history across navigation, and reset/account changes reject late replies. Exercise filters, wishlist, option selection, cart quantity/selection, checkout, builder, and order screens.

For Android opening behavior, cold-launch a rebuilt release APK on Android 12+ and check that the complete logo remains visible through the launcher-to-splash transition. Expo Go is not a release-splash verification environment.
