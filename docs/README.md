# Documentation

Start with the root [README](../README.md) for installation and the [Development Guide](development/README.md) for practical implementation instructions. This index separates current references from historical design records.

## Development references

- [Development Guide and feature map](development/README.md): frontend/API recipes, data flows, migrations, jobs, AI, i18n, testing, deployment and a complete feature example.
- [Architecture](ARCHITECTURE.md): feature-first ownership, dependency boundaries and source layout.
- [Code quality](CODE_QUALITY.md): formatting, lint, types, tests, language checks and reviewed baselines.
- [UI guidelines](ui-guidelines.md): themes, components, responsive layout and accessibility.

## Feature references

- [Authentication and remembered sessions](auth-sessions.md).
- [Style questionnaire and interpreted profile](style-profile.md), with [migration notes](style-profile-migration.md).
- [Travel Packing](travel-packing.md): deterministic completeness, AI enrichment, wardrobe matching and persistence.
- [Custom garment properties and deployment](custom-garment-properties-migration.md).
- [Gemini setup and security](gemini-setup.md).
- [Queue administration](queue-board.md).

## Deployment and operations

- [Self-hosted deployment on Proxmox](deployment-proxmox.md).
- [Operations, backups and recovery](operations.md).
- [Native Storage and xattr requirements](../infra/storage/README.md).
- [CPU models](../infra/models/README.md) and [FashionSigLIP](../infra/models/fashion-siglip/README.md).
- [Authentication email templates](../infra/auth-email/README.md).

## Historical records and audit evidence

- [Progress log](progress.md): dated implementation, deployment and verification records; an old entry does not establish current behavior.
- [Codebase audit](CODEBASE_AUDIT.md), [refactor plan](REFACTOR_PLAN.md) and [refactor progress](REFACTOR_PROGRESS.md): retained at these paths because developer instructions reference them. Read dated findings alongside the current architecture.
- [Image pipeline audit and implementation history](image-pipeline.md): historical design decisions and limitations; current flow is summarized in the Development Guide.
- [Archive](archive/README.md): superseded SQL drafts, an unapplied design proposal and a dated dependency snapshot. These are not runnable deployment migrations.

## What belongs here

Keep maintained instructions and feature references in this directory, practical developer chapters in `development/`, and retired design artifacts in `archive/` with an explicit status. Executable deployment migrations belong only in `supabase/migrations/` after review.

`quality/` contains active machine-readable baselines used by the quality scripts. Keep their paths stable and review changes; do not archive or regenerate them as part of documentation cleanup.

Do not commit private screenshots, recordings, account exports, test reports or backups. Generated test artifacts belong in the existing ignored output directories. Screenshots are not required to understand the maintained text references.
