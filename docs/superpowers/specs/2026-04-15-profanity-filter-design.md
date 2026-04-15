# Username Profanity Filter — Design Spec

## Overview

Add server-side profanity filtering to username submissions. Rejects usernames containing profanity in English or Dutch before the score is stored.

## Approach

Use the `obscenity` npm package with its built-in English dataset, extended with a Dutch word list from the LDNOOBW project. Runs server-side in the submit-score endpoint — no external API calls, no latency.

## Files

- **`lib/profanity.js`** — Initializes the `obscenity` matcher with English + Dutch datasets. Exports `containsProfanity(text)` which returns `true` if the text contains profanity.
- **`lib/profanity-nl.json`** — Dutch word list from LDNOOBW, committed to the repo as a JSON array.
- **`api/submit-score.js`** — Calls `containsProfanity(name)` during input validation. Returns `400` with `"USERNAME NOT ALLOWED"` if profanity detected.

## Validation Order in submit-score.js

1. Verify Turnstile token
2. Validate inputs (format, length, no URLs)
3. **Check profanity** (new — after format validation, before session validation)
4. Validate session
5. Rate limit
6. Store score

Profanity check runs before session validation so a rejected name doesn't consume the session.

## Package

- `obscenity` — zero dependencies, TypeScript, active maintenance, ~112K weekly downloads
- Built-in English dataset with leet-speak detection, character substitution, whitespace insertion handling
- Dutch words added via `addPhrase()` on a custom dataset

## Error Handling

Rejection returns the same error format as other validation errors:
```json
{ "error": "USERNAME NOT ALLOWED" }
```

Frontend displays this in the existing `.score-submit-error` element. No frontend changes needed.

## Dutch Word List

Source: https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words (MIT license, 3.3K GitHub stars). The `nl` file is converted to a JSON array and committed to the repo.
