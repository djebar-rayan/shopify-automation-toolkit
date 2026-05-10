# Fichiers de tâche

Ce dossier contient les **fichiers de tâche** qui pilotent les scripts
génériques (`audit/`, `content/`, `seo/`, `images/`).

Chaque tâche est un fichier Markdown structuré qui décrit :

- **Cible** — quel scope (products / collections / pages / redirects) et quel filtre
- **Action** — type (`audit` / `update` / etc.), champ modifié, valeur (littérale ou prompt Gemini)
- **Validation** — cases à cocher (vérification, dry-run, confirmation)
- **Critères de succès** — comment valider que la tâche a réussi
- **Résultats** — section auto-remplie par le script à la fin

## Fichiers fournis

| Fichier | Rôle |
|---|---|
| `_template.md` | Modèle commenté — copier pour créer une nouvelle tâche |
| `example-audit-images.md` | Exemple fonctionnel — audit des produits < 3 images |

## Règle de versionnage

- Les fichiers de tâche **utilisateur** (`task-*.md`) sont **gitignorés**.
- Seuls le template (`_template.md`) et les exemples (`example-*.md`) sont versionnés.

## Mini-DSL de filtre

Combinable par virgule (= AND) :

```
tous                          → toutes les entités
handle X                      → entité dont le handle = X
handles X, Y, Z               → entités dont le handle ∈ {X,Y,Z}
tag X                         → entités taggées X
status ACTIVE|DRAFT|ARCHIVED  → produits avec ce statut
images < N                    → produits avec moins de N images
images > N                    → produits avec plus de N images
images = 0                    → produits sans aucune image
desc_words < N                → descriptions avec moins de N mots
desc_words > N                → descriptions avec plus de N mots
seo_title manquant            → meta title SEO absent
seo_description manquant      → meta description SEO absente
no_alt                        → au moins une image sans alt
variants > N                  → produits avec plus de N variantes
vendor X                      → produits du vendor X
```

Exemple : `status ACTIVE, images < 3, no_alt` cible les produits actifs
ayant moins de 3 images **et** au moins une image sans alt.

## Cycle de vie d'une tâche

1. **Créer** : `cp tasks/_template.md tasks/task-001-mon-action.md`
2. **Remplir** : ouvrir, modifier les sections Cible / Action / Validation
3. **Tester en lecture seule** : `node audit/audit.js --task tasks/task-001-mon-action.md`
4. **Appliquer** : `node content/update-products.js --task tasks/task-001-mon-action.md`
5. **Constater** : la section `## Résultats` est remplie automatiquement
6. **Re-fetch** : `node fetch-store-data.js` pour rafraîchir `store-data/`
