# shopify-automation-toolkit

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Shopify](https://img.shields.io/badge/Shopify-Admin%20GraphQL-95BF47?logo=shopify&logoColor=white)](https://shopify.dev/docs/api/admin-graphql)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%203.1%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![No npm deps](https://img.shields.io/badge/dependencies-zero%20npm-success)](package.json)

Toolkit Node.js réutilisable pour automatiser l'audit, le SEO, le contenu et la
gestion des images d'une boutique Shopify, **piloté par fichiers de tâche
Markdown** et alimenté par **Gemini 3.1** (texte / vision / image).

> Aucune dépendance npm. Uniquement Node.js ≥ 18 et le Shopify CLI.

## Pourquoi ce toolkit

| Besoin | Réponse |
|---|---|
| Auditer une boutique de A à Z | `audit/full-audit.js` → score SEO/UX/Contenu/Opérations |
| Générer les meta SEO manquants | `seo/seo-update.js` |
| Réécrire des descriptions trop courtes via IA | `content/update-products.js` + Gemini Text |
| Régénérer une image produit | `images/image-generate.js` + Gemini Image |
| Auditer la qualité des images | `images/visual-audit.js` + Gemini Vision |
| Migrer des templates email Klaviyo → Shopify Email | `integrations/shopify-email/adapt-templates.js` |

## Architecture en un coup d'œil

```mermaid
flowchart LR
    ENV[".env<br/>credentials & marque"] --> CONFIG["lib/config.js"]
    CONFIG --> CLI["Scripts CLI<br/>audit · seo · content · images"]
    SHOPIFY[("Shopify Admin<br/>GraphQL")] -->|fetch| FETCH["fetch-store-data.js"]
    FETCH --> STORE_DATA[("store-data/*.md<br/>source de vérité locale")]
    STORE_DATA --> CLI
    TASKS[("tasks/*.md<br/>intention décrite")] --> CLI
    CLI -->|mutations idempotentes| SHOPIFY
    CLI -->|prompts paramétrés| GEMINI[("Gemini 3.1<br/>Text · Vision · Image")]
    GEMINI --> CLI
    CLI -->|append résultats| TASKS
```

**3 piliers** :

1. **`store-data/`** — extraction unique de la boutique en 9 fichiers Markdown (source de vérité locale, diffable, lisible).
2. **`lib/` + scripts CLI** — 14 modules réutilisables (un fichier = une responsabilité) + commandes par domaine (`audit/`, `seo/`, `content/`, `images/`).
3. **`tasks/`** — fichiers Markdown décrivant l'intention (Cible + Action + Validation), exécutés par les scripts génériques qui appendent leurs résultats.

## Installation (5 minutes)

```bash
# 1. Cloner
git clone https://github.com/djebar-rayan/shopify-automation-toolkit.git
cd shopify-automation-toolkit

# 2. Configurer
cp .env.example .env
# … puis éditer .env (SHOPIFY_STORE, GEMINI_API_KEY, …)

# 3. S'authentifier au Shopify CLI
shopify store auth --store <your-store>.myshopify.com \
  --scopes read_products,write_products,read_content,write_content,read_themes,write_files

# 4. Extraire l'état actuel
node fetch-store-data.js
```

## Usage en 30 secondes

```bash
# Lecture seule : audit complet → audit-report.md
node audit/full-audit.js

# Audit ciblé via fichier de tâche
node audit/audit.js --task tasks/example-audit-images.md

# SEO : générer les meta titles manquants (formules locales, gratuit)
node seo/seo-update.js --target=titles --confirm

# Contenu : enrichir descriptions courtes (Gemini Text)
cp tasks/_template.md tasks/enrich-desc.md
# … remplir, puis :
node content/update-products.js --task tasks/enrich-desc.md

# Images : audit + régénération multi-variantes
node images/image-audit.js
node images/image-generate.js --mode=multi-variant --handle=mon-produit
node images/image-upload.js --handle=mon-produit --dir=generated-images --confirm
```

## Architecture

```
shopify-automation-toolkit/
├── lib/                  # Couche commune (modules réutilisables, un fichier = une responsabilité)
│   ├── config.js                # lit .env, expose toutes les constantes
│   ├── shopify-graphql.js       # execGql / execMutation
│   ├── task-file.js             # parser de fichier de tâche
│   ├── store-data.js            # parser de store-data/<scope>.md
│   ├── filter-dsl.js            # mini-DSL de filtre
│   ├── cli.js                   # getFlag / confirm / sleep
│   ├── text.js                  # stripHtml / wordCount
│   ├── gemini-text.js           # Gemini Text (descriptions, prompts)
│   ├── gemini-vision.js         # Gemini Vision (analyse d'images)
│   ├── gemini-image.js          # Gemini Image (génération)
│   ├── image-download.js        # téléchargement HTTP → base64
│   ├── image-validate.js        # validation taille/résolution
│   ├── image-upload.js          # staged upload + multipart + productCreateMedia
│   └── builders/                # générateurs paramétrés
│       ├── seo-meta.js              # meta titles/descriptions/alt
│       ├── content-prompts.js       # prompts Gemini paramétrés
│       ├── handle.js                # normalisation handle Unicode→ASCII
│       ├── livraison.js             # bloc livraison HTML
│       └── translit-presets/        # maps JSON pour scripts non-latins
│
├── fetch-store-data.js   # Extraction unique → store-data/*.md (à relancer après modifs)
│
├── audit/                # LECTURE SEULE
│   ├── audit.js                 # audit générique piloté par tâche
│   ├── full-audit.js            # audit complet avec scoring
│   └── examples/                # tâches d'audit prêtes à l'emploi
│
├── seo/                  # MISE À JOUR DES META SEO
│   ├── seo-update.js            # titles / descriptions / alt
│   └── examples/
│
├── content/              # MISE À JOUR DES PRODUITS / COLLECTIONS / PAGES
│   ├── update-products.js
│   ├── update-collections.js
│   ├── update-pages.js
│   ├── handle-normalize.js      # CLI dédié pour les handles non-ASCII
│   └── examples/
│
├── images/               # WORKFLOW IMAGES
│   ├── image-audit.js           # comptage + alt manquants
│   ├── image-alt.js             # alt texts (formules ou Vision)
│   ├── image-generate.js        # génération Gemini Image (single / multi-variant)
│   ├── image-upload.js          # staged upload + bind variantes
│   ├── visual-audit.js          # qualité d'image via Gemini Vision
│   └── examples/
│
├── integrations/         # CONNECTEURS TIERS
│   ├── klaviyo/                 # export read-only Klaviyo
│   └── shopify-email/           # adaptation HTML pour Shopify Email
│
├── tasks/                # FICHIERS DE TÂCHE
│   ├── _template.md             # modèle commenté
│   └── example-*.md             # exemples
│
├── store-data/           # AUTO-GÉNÉRÉ par fetch-store-data.js (gitignore)
├── generated-images/     # AUTO-GÉNÉRÉ par images/image-generate.js (gitignore)
│
├── docs/                 # Documentation détaillée
│   ├── QUICK_START.md
│   ├── COMMAND_REFERENCE.md
│   ├── TASK_FORMAT.md
│   ├── GEMINI_SETUP.md
│   ├── SHOPIFY_AUTH.md
│   ├── TROUBLESHOOTING.md
│   └── SKILLS.md
│
├── .claude/skills/       # Skills Claude Code (optionnels, partage GitHub)
├── .env.example          # Modèle de config
├── CLAUDE.md             # Règles techniques critiques
├── ARCHITECTURE.md       # Vision triade store-data/scripts/tasks
└── package.json
```

## Modèle d'utilisation : la tâche pilote tout

Au lieu d'écrire un script par cas d'usage, le toolkit lit un **fichier de tâche
Markdown** qui décrit Cible / Action / Validation. Les scripts génériques
appliquent. Cela permet :

- **traçabilité** : chaque tâche est un fichier versionnable
- **idempotence** : la tâche enregistre ses résultats à la fin
- **généricité** : un même script (`content/update-products.js`) couvre
  toutes les mises à jour produits, peu importe le champ ou le filtre

Voir [`docs/TASK_FORMAT.md`](docs/TASK_FORMAT.md) pour la spec complète.

## Skills Claude Code (optionnel)

Le dossier `.claude/skills/` contient 8 skills prêtes à l'emploi pour
**Claude Code**. Voir [`docs/SKILLS.md`](docs/SKILLS.md) pour les installer.

## Documentation

- [docs/QUICK_START.md](docs/QUICK_START.md) — parcours installation → 1er audit
- [docs/COMMAND_REFERENCE.md](docs/COMMAND_REFERENCE.md) — toutes les commandes + flags
- [docs/TASK_FORMAT.md](docs/TASK_FORMAT.md) — format des fichiers de tâche + mini-DSL
- [docs/GEMINI_SETUP.md](docs/GEMINI_SETUP.md) — clé API + modèles
- [docs/SHOPIFY_AUTH.md](docs/SHOPIFY_AUTH.md) — scopes OAuth + dépannage
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — FAQ et erreurs courantes
- [docs/SKILLS.md](docs/SKILLS.md) — skills Claude Code fournies
- [CLAUDE.md](CLAUDE.md) — **règles techniques critiques** à ne jamais violer
- [ARCHITECTURE.md](ARCHITECTURE.md) — pourquoi store-data + scripts + tasks

## Compétences démontrées

- **Node.js « pur »** : aucun `npm install` requis. Uniquement les built-ins (`https`, `fs`, `child_process`, `readline`, `path`). 32 fichiers JS, ~3 500 lignes, zéro `node_modules/`.
- **Shopify Admin GraphQL** : queries paginées (cursor `after`/`endCursor`), mutations idempotentes (`productUpdate`, `collectionUpdate`, `pageUpdate`, `productCreateMedia`, `productVariantsBulkUpdate`), staged uploads multipart (`stagedUploadsCreate`), gestion fine des scopes OAuth.
- **Intégration LLM** : Gemini 3.1 Flash en 3 modes (Text pour rédaction de descriptions, Vision pour audit visuel d'images, Image pour génération multi-variantes avec image de référence), retry exponentiel sur rate limit 429/503, validation de la qualité (taille ≥ 50 KB, résolution ≥ 800×800).
- **Architecture pilotée par fichiers** : tâches Markdown versionnables (traçabilité git-blame), mini-DSL de filtre (`status ACTIVE, images < 3, no_alt`), source de vérité locale `store-data/` (extraction unique → 9 fichiers MD diffables).
- **Single Responsibility Principle** : `lib/` découpé en 14 modules ciblés (config, GraphQL, Gemini text/vision/image, pipeline image download/validate/upload, parsers task-file/store-data, filter-DSL, builders SEO/contenu/handle/livraison).
- **Sécurité by design** : `.gitignore` strict (`.env`, `store-data/*.md`, `generated-images/*.jpg`), zéro PII dans les exports Klaviyo (compteurs agrégés uniquement), validation multi-étapes (dry-run → préview → confirmation → mutation), aucune mutation possible sans `--confirm`.
- **Documentation portfolio-ready** : 7 docs spécifiques (Quick Start, Command Reference, Task Format, Gemini Setup, Shopify Auth, Troubleshooting, Skills) + README avec diagramme Mermaid + 8 skills Claude Code packagées pour partage.

## Licence

MIT — voir [LICENSE](LICENSE).

## Auteur

**Rayan Djebar** — [djebar.rayan75@gmail.com](mailto:djebar.rayan75@gmail.com) · [GitHub](https://github.com/djebar-rayan)

Projet réalisé pendant un stage Shopify, refondu en toolkit générique pour partage open source.
