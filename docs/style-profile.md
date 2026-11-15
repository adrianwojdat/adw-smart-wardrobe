# Style questionnaire 2.0

## Audit and data compatibility

Previous implementation had 30 optional questions across seven pages.
Zod validated stable identifiers; answers were stored in
`profiles.style_profile` (`schema_version: 1`). BFF used the user token,
and `merge_my_style_answers` merged only submitted fields under a row lock.
Gemini worker received raw answers and hard constraints, while UI
showed selected answers instead of a common interpretation model.

All questions `q01`–`q30`, their options, meaning and types are preserved. Nothing
is reset or recalculated in stored JSON. Four optional fields were added,
without default answers:

| ID                        | New information                     | Type                                                          |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `q31_dominant_style`      | Dominant style                      | One stable identifier                                         |
| `q32_colors`              | Specific favorite colors            | Multiple selection from 15 swatches                           |
| `q33_daily_formality`     | Everyday formality                  | Five-level scale                                              |
| `q34_preference_strength` | Style/color/fit preference strength | Three independent optional dimensions: gentle/balanced/strong |

`q21_aesthetics` retains its meaning of multiple preferred aesthetics and supplies
supporting influences. It is not automatically interpreted as a declaration
of dominant style. Broad `q24` palettes do not become invented specific
colors. Main counter includes 34 questions (for example 30/34). Old accounts retain
their completed original survey and separate base counter (for example 30/30);
new questions have a separate 0/4 counter and optional-extension explanation.
Missing answers remain distinct from `false` and explicit `no`/`none` choices.

## Seven stages

| Stage                        | Questions          |
| ---------------------------- | ------------------ |
| Your style and aesthetics    | q31, q21, q33, q34 |
| Colors and patterns          | q32, q24, q22, q23 |
| Fits and clothing            | q06–q09            |
| Comfort and weather          | q01–q05            |
| Combining clothes            | q10–q15            |
| Occasions and accessories    | q16–q20, q25–q26   |
| Wardrobe and recommendations | q27–q30            |

Order and presentation changed, not identifiers. Option translations are
question-specific, so `formal` can mean formal footwear or
office formality. Styles use descriptive cards, colors use interactive swatches,
and formality uses an ordered radio scale. Controls have labels, keyboard
support, and skip actions. Autosave still sends only changed answers.
Local progress uses `survey_version: 2`; old page numbers map into the new
layout without losing pending answers/skips.

## Shared interpretation

Pure functions in `packages/shared/src/style-profile-summary.ts` create typed
`StyleProfileSummary` separating `stylePreferences`, `hardConstraints`,
`contextualPreferences` and `recommendationPreferences`. Unspecified preferences
remain `null`, empty lists, or empty objects; UI shows “Preference
not established”. Fit or black/white bans override conflicting
preferences; original answers remain saved and the profile marks conflicts.

`resolveStyleContext` selects office/date rules by occasion alongside
supplied temperature/weather and explicitly declared thermal preferences.
Profile never guesses the weather. Full answers remain in expandable details.

Active `jobs/outfit-generation/gemini-outfits.ts` worker sends exactly the
same interpretation to Gemini alongside existing context/wardrobe metadata.
Output is still checked against available IDs, garment roles, and duplicates.
Shared `evaluateStyleOutfit` rejects recognized hard-rule violations and ranks valid
outfits by soft preferences: style, colors, fit, trouser/footwear types,
formality, and thermal comfort. Preference strength changes ranking weights,
not restrictions. Ties preserve stable ordering.
No new AI client, queue, limiter configuration, or endpoint contract was introduced.

Constraint/preference recognition uses available text metadata,
including the PL/EN lexicon. It cannot guarantee recognition of a feature absent from
garment metadata. Style descriptions explain aesthetics rather than assign
unselected colors/fits to the user.

## Storage and tests

No new migration is needed: existing JSON/RPC support new
keys. Shared validation was extended while keeping storage version 1. RLS,
permissions, and encryption are unchanged. SQL tests must run only in an isolated
database; browser tests save answers only in separate RAM fixtures.
Never complete the survey on an existing user account for testing.

Tests cover all 30 legacy answers, empty/partial profiles,
new questions, strengths, colors, conflicts, yes/no answers, occasion context,
shared generator payload/ranking, BFF validation, and persistence. Playwright
checks EN/PL on desktop/mobile, cards, swatches, reopening, and
old-profile reads without any PATCH. Screenshots go to ignored
`investigation/tmp/ui-daisyui/` (`survey2-*`, `profile2-*`). Gemini is mocked;
tests make no costly calls or changes to existing accounts.
