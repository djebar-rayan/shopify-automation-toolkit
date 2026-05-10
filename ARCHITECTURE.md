# Architecture — `store-data` + `scripts` + `tasks`

Ce document explique le **pourquoi** des trois piliers du toolkit. Le **comment**
est dans `README.md` et `docs/COMMAND_REFERENCE.md`.

---

## Le problème qu'on résout

Une boutique Shopify, ça change tout le temps. À chaque modification (ajout
de produit, mise à jour de description, normalisation de handle…) il faut :

1. **Comprendre l'état actuel** sans interroger Shopify 50 fois (rate limit).
2. **Décrire l'intention** (ex : "tous les produits avec moins de 3 images")
   d'une façon que l'humain et l'agent IA peuvent vérifier ensemble.
3. **Appliquer** la mutation sur Shopify de façon idempotente.
4. **Tracer** ce qui a été fait pour pouvoir l'auditer plus tard.

Les scripts ad-hoc s'accumulent vite et deviennent ingérables. La triade
`store-data + scripts + tasks` répond aux quatre points.

---

## Pilier 1 — `store-data/` : la source de vérité locale

`fetch-store-data.js` extrait l'état complet de la boutique en **9 fichiers
Markdown** (un par catégorie) :

```
store-data/
├── products.md       # 1 bloc par produit (ID, handle, SEO, images, variantes, metafields)
├── collections.md
├── customers.md      # agrégat anonymisé (zéro PII)
├── orders.md         # agrégat (CA, panier moyen, top produits)
├── pages.md
├── metafields.md     # synthèse par namespace
├── redirects.md
├── navigation.md
└── store-meta.md     # snapshot global (plan, devise, volumes)
```

**Pourquoi du Markdown et pas du JSON ?**

- **Lisible par un humain** dans n'importe quel éditeur ou GitHub.
- **Diffable** : `git diff` montre lisiblement ce qui a changé entre
  deux extractions (utile pour les audits récurrents).
- **Parseable** par les scripts : un format MD avec sections `## Titre` et
  champs `- **Key** : value` est trivial à lire.

`store-data/` est **gitignoré** : c'est local et spécifique à chaque boutique.

---

## Pilier 2 — `scripts/` (renommé en `lib/` + dossiers domaine) : un outil par responsabilité

Chaque script CLI fait **une chose** :

| Domaine | Scripts |
|---|---|
| Audit | `audit/audit.js`, `audit/full-audit.js` |
| SEO | `seo/seo-update.js` |
| Contenu | `content/update-products.js`, `content/update-collections.js`, `content/update-pages.js`, `content/handle-normalize.js` |
| Images | `images/image-audit.js`, `images/image-alt.js`, `images/image-generate.js`, `images/image-upload.js`, `images/visual-audit.js` |

Tous s'appuient sur `lib/` pour la logique partagée :

- `lib/config.js` — config centralisée (.env)
- `lib/shopify-graphql.js` — `execGql` / `execMutation`
- `lib/store-data.js` — parser de `store-data/<scope>.md`
- `lib/task-file.js` — parser de fichier de tâche
- `lib/filter-dsl.js` — mini-langage de filtre
- `lib/gemini-text.js` / `gemini-vision.js` / `gemini-image.js` — Gemini
- `lib/image-download.js` / `image-validate.js` / `image-upload.js` — pipeline image
- `lib/builders/seo-meta.js` / `content-prompts.js` / `handle.js` / `livraison.js` — formules paramétrées

**Règle** : un fichier = une responsabilité. Si un script grossit, il est
découpé.

---

## Pilier 3 — `tasks/` : l'intention décrite, vérifiable, idempotente

Chaque mise à jour est décrite dans un fichier Markdown :

```markdown
## Cible
- Scope : products
- Filtre : status ACTIVE, desc_words < 150

## Action
- Type : update
- Champ modifié : descriptionHtml
- Valeur : générer via Gemini avec ce prompt : "…"

## Validation avant application
- [x] Vérifier dans store-data/products.md
- [x] Afficher dry-run
- [x] Demander confirmation

## Critères de succès
- 100 % des produits ciblés ont une description ≥ 150 mots
```

Les scripts génériques (`content/update-products.js`, `audit/audit.js`, …)
**lisent ce fichier**, appliquent l'action, et **écrivent les résultats**
en bas du fichier :

```markdown
## Résultats — 2026-01-15T20:00:00Z
- Entités ciblées : 12
- Entités modifiées : 12
- Erreurs : 0
```

**Avantages** :

- Le fichier de tâche est une **trace versionnable** (git-blame friendly).
- Le dry-run permet de **valider** l'intention avant la mutation.
- Les **critères de succès** rendent l'audit objectif.
- L'agent IA peut générer la tâche, l'utilisateur la relit et l'approuve.

---

## Mini-DSL de filtre

Le champ `Filtre` accepte une syntaxe simple, combinable par virgule (= AND) :

```
tous                          → toutes les entités
handle X                      → entité dont le handle = X
handles X, Y, Z               → entités dont le handle ∈ {X, Y, Z}
tag X                         → entités taggées X
status ACTIVE|DRAFT|ARCHIVED  → produits avec ce statut
images < N                    → produits avec moins de N images
images > N
images = 0
desc_words < N
desc_words > N
seo_title manquant
seo_description manquant
no_alt                        → au moins une image sans alt
variants > N
vendor X
```

Le DSL est implémenté dans `lib/filter-dsl.js` et entièrement testable
unitairement.

---

## Boucle de travail typique

```
┌─────────────────────────────────────────────────────────────┐
│ 1. node fetch-store-data.js          → store-data/*.md       │
│ 2. node audit/full-audit.js          → audit-report.md       │
│    (ou audit ciblé via tasks/)                                │
│ 3. cp tasks/_template.md tasks/<task>.md                      │
│ 4. node content/update-products.js --task tasks/<task>.md     │
│    → mutations Shopify + ## Résultats appendés à la tâche     │
│ 5. node fetch-store-data.js          → re-fetch               │
│ 6. git add tasks/<task>.md && git commit  (traçabilité)       │
└─────────────────────────────────────────────────────────────┘
```

Tout est rejouable, vérifiable, traçable.
