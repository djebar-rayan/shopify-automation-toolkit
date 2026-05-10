# Skills Claude Code

Le toolkit fournit 8 **skills** dans `.claude/skills/` pour utilisateurs de
[Claude Code](https://claude.com/claude-code). Une skill se déclenche
automatiquement quand son `description` matche le contexte, ou
manuellement via `/<nom-skill>`.

## Skills fournis

| Skill | Déclenche quand |
|---|---|
| `shopify-seo-writer` | Produits avec `seo_title_missing` ou `seo_desc_missing` ; demande de générer des meta SEO |
| `shopify-content-enricher` | Produits avec `desc_missing`, `desc_too_short`, `desc_no_html` ; demande d'enrichissement de description |
| `shopify-image-generator` | Produits avec `image_count_low` ; demande de régénérer des photos via IA |
| `shopify-liquid-analyzer` | Audit du thème Liquid actif, Core Web Vitals, accessibilité |
| `shopify-competitor-spy` | Analyse concurrentielle d'une niche e-commerce |
| `seo-researcher` | Recherche de mots-clés SEO via WebSearch |
| `prompt-optimizer` | Optimisation de requêtes GraphQL Shopify ou de prompts Claude |
| `recurring-monitor` | Configuration d'un audit récurrent (hebdomadaire/mensuel) avec cron ou n8n |

## Installation côté utilisateur Claude Code

### Option 1 — Skills locales au repo (recommandé)

Si vous utilisez Claude Code et que ce repo est ouvert, les skills dans
`.claude/skills/` sont **automatiquement chargées**.

### Option 2 — Skills globales (toutes vos sessions Claude Code)

Copier les skills vers votre dossier global :

**Windows / PowerShell** :
```powershell
Copy-Item -Recurse .claude\skills\* "$env:USERPROFILE\.claude\skills\"
```

**macOS / Linux** :
```bash
cp -r .claude/skills/* ~/.claude/skills/
```

## Désactiver une skill localement

Renommer son dossier en ajoutant un underscore :

```bash
mv .claude/skills/shopify-image-generator .claude/skills/_shopify-image-generator
```

## Créer ses propres skills

Voir la doc Claude Code : <https://claude.com/claude-code/skills>

Le format minimum est :

```markdown
---
name: ma-skill
description: Quand cette skill se déclenche (1-2 phrases) ; les mots-clés ici servent au matching automatique.
---

# Ma Skill

Instructions étape par étape pour Claude.
```

## Tester sans Claude Code

Les skills sont **rédigées en Markdown** et restent lisibles comme documentation
hors-Claude-Code. Vous pouvez les utiliser comme cheat-sheets ou comme prompts
système pour d'autres LLM.
