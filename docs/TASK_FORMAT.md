# Format des fichiers de tâche

Un fichier de tâche est un Markdown structuré décrivant une intervention sur la
boutique. Il est lu par `audit/`, `content/`, `seo/`, `images/`.

## Squelette

```markdown
# Titre humain de la tâche

**Date** : YYYY-MM-DD
**Script utilisé** : `<chemin/vers/script.js>`
**Fichiers de référence lus** : `store-data/<scope>.md`

## Cible

- **Scope** : products | collections | pages | redirects
- **Filtre** : <expression DSL>
- **Nb entités concernées** : 0 (recalculé par le script)

## Action

- **Type** : audit | update | create | delete
- **Champ modifié** : descriptionHtml | seo.title | seo.description | tags | handle | status | …
- **Valeur** : <littéral> | générer via Gemini avec ce prompt : "…"

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/<scope>.md`
- [x] Afficher les changements prévus avant d'appliquer (dry-run automatique)
- [x] Demander confirmation `o/N` avant la mutation

## Critères de succès

- <critère 1>
- <critère 2>

## Résultats

<!-- rempli automatiquement par le script -->
```

## Mini-DSL de filtre

Combinable par virgule (= AND) :

| Clause | Sémantique |
|---|---|
| `tous` / `tous les produits` | Toutes les entités |
| `handle X` | handle = X |
| `handles X, Y, Z` | handle ∈ {X, Y, Z} |
| `tag X` | possède le tag X |
| `status ACTIVE\|DRAFT\|ARCHIVED` | status produit |
| `images < N` | < N images |
| `images > N` | > N images |
| `images = 0` | aucune image |
| `desc_words < N` | description < N mots |
| `desc_words > N` | description > N mots |
| `seo_title manquant` | meta title vide |
| `seo_description manquant` | meta description vide |
| `no_alt` | au moins une image sans alt |
| `variants > N` | > N variantes |
| `vendor X` | vendor = X |

Exemples :

- `status ACTIVE, images < 3, no_alt`
- `tag soldes, desc_words < 150`
- `handles foo, bar, baz`

## Champs « Action »

### `Type`

- `audit` — lecture seule, n'écrit rien dans Shopify
- `update` — mutation `<entity>Update`
- `create` — création (rarement utilisé via tâche, plutôt via UI Shopify)
- `delete` — suppression (rarement utilisé via tâche)

### `Champ modifié` (selon le scope)

| Scope | Champs supportés |
|---|---|
| products | `descriptionHtml`, `seo.title`, `seo.description`, `tags`, `handle`, `status` |
| collections | `descriptionHtml`, `seo.title`, `seo.description`, `handle` |
| pages | `body`, `seo.title`, `seo.description`, `handle`, `title` |

### `Valeur`

- **Littérale** : `<p>HTML fixe</p>` ou `tag1, tag2, tag3` (pour `tags`)
- **Gemini** : `générer via Gemini avec ce prompt : "Rédige une description …"`
  → le script appellera `lib/gemini-text.js::callGeminiTextWithRetry` avec le
  prompt enrichi du contexte produit (titre, type, vendor, tags).

## Section « Validation »

Les cases cochées contrôlent le comportement du script :

- `[x] Vérifier que les entités cibles sont bien dans store-data/...` — vérification de pré-condition
- `[x] Afficher les changements prévus avant d'appliquer` — affiche le dry-run sur les 3-5 premières cibles
- `[x] Demander confirmation o/N avant la mutation` — prompt interactif

Pour automatiser sans prompt, passer `--yes` au script.

## Section « Résultats »

Auto-remplie par le script :

```markdown
## Résultats — 2026-01-15T20:00:00Z
- Entités ciblées : 12
- Entités modifiées : 12
- Erreurs : 0
- Champ modifié : descriptionHtml
- Re-fetch recommandé : node fetch-store-data.js
```

## Cycle de vie

1. **Créer** : `cp tasks/_template.md tasks/task-001-<nom>.md`
2. **Remplir** : Cible + Action + Validation
3. **Tester** : `node audit/audit.js --task tasks/task-001-<nom>.md` (dry-run)
4. **Appliquer** : `node content/update-products.js --task tasks/task-001-<nom>.md`
5. **Constater** : section `## Résultats` peuplée automatiquement
6. **Re-fetch** : `node fetch-store-data.js` pour rafraîchir `store-data/`
7. **Tracer** : `git add tasks/task-001-<nom>.md && git commit`
