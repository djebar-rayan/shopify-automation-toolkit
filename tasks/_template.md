# Task file template

> This file serves as a **commented template** for all future tasks.
> It is never executed as-is.
>
> To create a new task: copy this file to `tasks/<name>.md`, strip the
> HTML comments, fill in the sections.

**Date**: YYYY-MM-DD
**Script used**: `<path/to/script.js>`
**Reference files read**: `store-data/<scope>.md`

<!-- ============================================================ -->
<!-- REQUIRED SECTIONS — every sub-key is mandatory                -->
<!-- ============================================================ -->

## Target

- **Scope**: products
- **Filter**: all products with fewer than 3 images
- **Entities affected**: 0 (recomputed by the script)

<!--
The filter is written in plain English. Mini-DSL recognized by the
scripts (combinable with comma = AND):

  • "all" / "all products"
  • "handle <h>"                          e.g. handle my-product
  • "handles <h1>, <h2>, …"
  • "tag <t>"                             e.g. tag bestseller
  • "status <ACTIVE|DRAFT|ARCHIVED>"
  • "images < N"                          e.g. images < 3
  • "images = 0"
  • "images > N"
  • "desc_words < N"                      e.g. desc_words < 150
  • "desc_words > N"
  • "seo_title missing"
  • "seo_description missing"
  • "no_alt"                              (at least one image without alt)
  • "variants > N"
  • "vendor <v>"

Combined example: "status ACTIVE, images < 3, no_alt"
-->

## Action

- **Type**: update             (audit | update | create | delete)
- **Field**: descriptionHtml
- **Value**: generate via Gemini with this prompt: "Write an HTML structured description of more than 150 words for this product, with at least one h2, one bullet list and one strong tag."

<!--
For a literal value, write it directly:
  - **Value**: <p>Fixed text.</p>

For an audit action, use:
  - **Field**: —
  - **Value**: —
-->

## Validation

- [x] Verify target entities are in `store-data/<scope>.md`
- [x] Show planned changes (dry-run)
- [x] Ask confirmation y/N before mutation

<!--
Uncheck [ ] to skip a step. To automate without a prompt, pass `--yes`
to the script.
-->

## Success criteria

- 100% of filtered entities modified without GraphQL error
- Re-fetch recommended: `node fetch-store-data.js`
- No mutation outside the filter

<!-- ============================================================ -->
<!-- RESULTS SECTION — automatically filled by the script          -->
<!-- ============================================================ -->

## Results

<!-- The script appends its report here:
## Results — 2026-01-15T20:00:00Z
- Targeted entities: 12
- Modified entities: 12
- Errors: 0
-->
