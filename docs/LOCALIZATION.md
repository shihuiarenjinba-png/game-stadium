# Localization & Publication — EKIDEN MANAGER

## One repository, one simulator, two languages

**Recommended:** Keep `game-stadium` as a single repository. Load Japanese and English labels with `src/i18n.js`, preserve stable IDs, run the exact same race calculation regardless of display language, and save language preference separately from game state.

- Save: `ekiden-manager-v1`, identical between Japanese and English
- Preference: `ekiden-manager-language`, values `ja` / `en`
- Default locale: **Japanese**. English selected by the user and persisted.
- Windows build: one Setup EXE plus one Portable EXE, with both languages available in each.
- Repository branching: one feature branch, tests for both locales, one final version/release tag.
- If the future marketplace needs two *download labels*, attach the **same build** as JP/EN bilingual; do not fork the game engine or create duplicate repositories.

## QA before an official bilingual release

- Render and manually review every screen (first launch, scouting, training, 5 legs × 3 checkpoints, wagers, budget, item store, year-end, autosave/import/export, 8th-year ending) in both languages.
- Review all runtime narrative/event text. Fictional proper names can remain romanized; untranslated Japanese narrative means localization is **not complete**.
- Check English overflow, keyboard focus, 100/125/150/200% DPI, a fresh Windows user profile and Japanese IME behavior.
- Verify exact save checksum and RNG unchanged after JP → EN → JP on the same machine. Language switching must not reset or reroll probabilities.
- Capture original Ekiden gameplay screenshots for marketing. Avoid unrelated soccer or stock photos.
- Confirm legal, intellectual-property, shop listing, screenshot rights, code signing and mock-prediction marketplace policy.

**Current status: unsigned bilingual development Alpha, not a certified commercial release.**
