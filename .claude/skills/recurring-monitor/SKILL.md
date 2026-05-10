---
name: recurring-monitor
description: Configure un audit Shopify récurrent automatisé (hebdomadaire/mensuel) via CronCreate ou n8n, compare les résultats avec l'audit précédent et génère un rapport de progression delta. Use when the user wants to schedule recurring audits, monitor KPI evolution over time, set up weekly/monthly Shopify store health checks, or track SEO improvement progress.
---

# Recurring Monitor

Configure des audits Shopify automatisés récurrents et suit la progression des KPIs
dans le temps.

## Instructions

### Étape 1 — Choisir le mode de planification

**Option A — CronCreate (Claude Code natif)**
- Exécute directement dans Claude Code via le skill `schedule`
- Requiert que Claude Code soit lancé au moment de l'exécution

**Option B — n8n Workflow (autonome)**
- S'exécute même quand Claude Code est fermé
- Envoie les résultats par email/webhook

### Étape 2 — Fréquences recommandées

| Cas d'usage | Fréquence | Justification |
|---|---|---|
| Suivi SEO (meta) | Hebdomadaire | Les changements prennent 1-2 semaines à propager |
| Suivi contenu | Bi-mensuel | Enrichissement progressif |
| Surveillance stock/prix | Quotidien | Changements rapides |
| Audit complet | Mensuel | Vue d'ensemble |

### Étape 3 — Diff entre audits

Modifier `audit/full-audit.js` (ou wrapper) pour supporter `--diff` :

1. Sauvegarder chaque audit avec timestamp dans `audit-history/audit-YYYY-MM-DD.json`
2. Calculer le delta vs l'avant-dernier
3. Générer un rapport delta lisible

Squelette JS :

```javascript
const HIST = path.join(config.WORKSPACE, 'audit-history');
fs.mkdirSync(HIST, { recursive: true });
const today = new Date().toISOString().split('T')[0];
fs.writeFileSync(path.join(HIST, `audit-${today}.json`),
  JSON.stringify({ scores, products: analyzed.map(p => ({ id: p.id, score: p._a.score, flags: p._a.flags.map(f => f.code) })) }, null, 2));

if (process.argv.includes('--diff')) {
  const files = fs.readdirSync(HIST).sort();
  if (files.length >= 2) {
    const prev = JSON.parse(fs.readFileSync(path.join(HIST, files[files.length - 2]), 'utf8'));
    const curr = JSON.parse(fs.readFileSync(path.join(HIST, files[files.length - 1]), 'utf8'));
    generateDiffReport(prev, curr);
  }
}
```

### Étape 4 — Configurer Cron (Option A)

Via le skill `schedule` :

```
Créer un trigger hebdomadaire (lundi 8h) qui :
1. Lance "node audit/full-audit.js --diff"
2. Lit audit-report.md
3. Envoie un résumé des changements
```

### Étape 5 — Configurer n8n (Option B)

Workflow :

1. **Trigger** : Schedule (cron `0 8 * * 1` = lundi 8h)
2. **Execute Command** : `node <path>/audit/full-audit.js --diff`
3. **Read File** : `audit-report.md`
4. **Email/Slack/Webhook** : envoyer le résumé

### Étape 6 — Format du rapport de progression

```markdown
# Rapport — Évolution des KPIs (semaine {date})

## Progression
| KPI | Semaine dernière | Cette semaine | Delta |
|---|---|---|---|
| Score SEO | X.X/10 | Y.Y/10 | +0.X |
| Problèmes P1 | A | B | -C ✓ |
| Produits sans meta | A | B | -C ✓ |

## Corrections appliquées
- … (déduit du delta de flags)

## Restant à faire
- Priorité 1 : …
- Priorité 2 : …
```

### Étape 7 — Alertes

Configurer des alertes si :

- Score global baisse de > 0.5 point
- Nombre de produits actifs change brutalement
- Un produit phare perd ses meta SEO (régression)

### Étape 8 — Rotation

- Garder les 12 derniers audits (≈ 3 mois)
- Ne jamais supprimer le **premier** audit (baseline historique)
- Stocker dans `audit-history/` (gitignoré par défaut)
