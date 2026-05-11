# Claude Code skills

The toolkit ships 8 **skills** under `.claude/skills/` for users of
[Claude Code](https://claude.com/claude-code). A skill activates
automatically when its `description` matches the context, or
manually via `/<skill-name>`.

## Provided skills

| Skill | Triggers when |
|---|---|
| `shopify-seo-writer` | Products with `seo_title_missing` or `seo_desc_missing`; request to generate SEO meta |
| `shopify-content-enricher` | Products with `desc_missing`, `desc_too_short`, `desc_no_html`; request to enrich descriptions |
| `shopify-image-generator` | Products with `image_count_low`; request to regenerate photos through AI |
| `shopify-liquid-analyzer` | Audit the active Liquid theme, Core Web Vitals, accessibility |
| `shopify-competitor-spy` | Competitive analysis of an e-commerce niche |
| `seo-researcher` | SEO keyword research via WebSearch |
| `prompt-optimizer` | Optimize Shopify GraphQL queries or Claude prompts |
| `recurring-monitor` | Set up a recurring audit (weekly/monthly) with cron or n8n |

## Install on the Claude Code side

### Option 1 — Repo-local skills (recommended)

If you use Claude Code with this repo open, the skills under
`.claude/skills/` are **loaded automatically**.

### Option 2 — Global skills (across all your sessions)

Copy the skills into your global folder:

**Windows / PowerShell**:
```powershell
Copy-Item -Recurse .claude\skills\* "$env:USERPROFILE\.claude\skills\"
```

**macOS / Linux**:
```bash
cp -r .claude/skills/* ~/.claude/skills/
```

## Disable a skill locally

Rename its folder by prefixing an underscore:

```bash
mv .claude/skills/shopify-image-generator .claude/skills/_shopify-image-generator
```

## Create your own skills

See the Claude Code docs: <https://claude.com/claude-code/skills>

The minimal format is:

```markdown
---
name: my-skill
description: When this skill activates (1–2 sentences); the keywords here drive automatic matching.
---

# My Skill

Step-by-step instructions for Claude.
```

## Use without Claude Code

The skills are **plain Markdown** and remain readable as documentation
outside Claude Code. You can use them as cheat-sheets or system prompts
for other LLMs.
