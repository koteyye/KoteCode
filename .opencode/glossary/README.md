# Russian Translation Glossary

Use this folder for locale-specific translation guidance that supplements `.opencode/agent/translator.md`.

The global glossary in `translator.md` remains the source of truth for shared do-not-translate terms. The product ships in English and Russian, so `ru.md` contains the only locale-specific guidance.

## What To Put In A Locale File

- **Sources**: PRs/issues/discussions that motivated the guidance
- **Do Not Translate (Locale Additions)**: locale-specific terms or casing decisions
- **Preferred Terms**: recurring UI/docs words with preferred translations
- **Guidance**: tone, style, and consistency notes
- **Avoid** (optional): common literal translations or wording we should avoid

Prefer guidance that is:

- Repeated across multiple docs/screens
- Easy to apply consistently
- Backed by a community contribution or review discussion

## Template

```md
# ru Glossary

## Sources

- Project review

## Do Not Translate (Locale Additions)

- `KoteCode` (preserve casing)
- `OpenCode Go` and `OpenCode Zen` (external service names)

## Preferred Terms

| English | Preferred | Notes     |
| ------- | --------- | --------- |
| prompt  | ...       | preferred |
| session | ...       | preferred |

## Guidance

- Prefer natural phrasing over literal translation

## Avoid

- Avoid ... when ...
```

## Contribution Notes

- Mark entries as preferred when they may evolve
- Keep examples short
- Add or update the `Sources` section whenever you add a new rule
- Prefer PR-backed guidance over invented term mappings; start with general guidance if no term-level corrections exist yet
