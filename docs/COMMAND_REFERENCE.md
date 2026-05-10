# Command Reference

Toutes les commandes CLI exposées par le toolkit, avec leurs flags.

> Toute commande accepte le flag `--yes` pour sauter les prompts de confirmation
> (à utiliser avec prudence — préférer le dry-run).

---

## Extraction

### `node fetch-store-data.js`

Extrait l'état complet de la boutique → `store-data/*.md`.

Pas de flags — relit `.env`. Réexécutable autant de fois que nécessaire.

---

## Audit

### `node audit/audit.js`

Audit générique read-only. Liste les entités matchées + flags.

| Flag | Effet |
|---|---|
| `--task <fichier.md>` | Lit la tâche (recommandé) |
| `--scope products\|collections\|pages\|redirects` | Sans tâche : choisit le scope |
| `--filter "<dsl>"` | Sans tâche : applique un filtre (cf. mini-DSL) |

### `node audit/full-audit.js`

Audit complet avec scoring (SEO/UX/Contenu/Opérations).

Sortie : `audit-report.md` à la racine.

---

## SEO

### `node seo/seo-update.js`

Génère et applique des meta SEO via les **formules locales** de
`lib/builders/seo-meta.js` (sans Gemini, gratuit, déterministe).

| Flag | Effet |
|---|---|
| `--target=titles\|descriptions\|alt` | Type de meta à générer (défaut: `titles`) |
| `--filter "<dsl>"` | Override du filtre par défaut |
| `--confirm` | Applique réellement (sinon dry-run) |
| `--mode=vision` (cible `alt`) | Génère les alt via Gemini Vision (analyse de l'image) |

---

## Contenu

### `node content/update-products.js`

Mise à jour générique des produits, pilotée par fichier de tâche.

| Flag | Effet |
|---|---|
| `--task <fichier.md>` | **Obligatoire** |
| `--yes` | Saute la confirmation |

Champs supportés : `descriptionHtml`, `seo.title`, `seo.description`, `tags`,
`handle`, `status`.

### `node content/update-collections.js`

Idem pour les collections. Champs : `descriptionHtml`, `seo.title`,
`seo.description`, `handle`.

### `node content/update-pages.js`

Idem pour les pages CMS. Champs : `body`, `seo.title`, `seo.description`,
`handle`, `title`.

### `node content/handle-normalize.js`

Normalise les handles non-ASCII en kebab-case ASCII.

| Flag | Effet |
|---|---|
| (aucun) | Dry-run |
| `--confirm` | Applique |
| `--map=<file.json>` | Preset de translittération (ex: `lib/builders/translit-presets/tifinagh.json`) |
| `--yes` | Saute la confirmation |

---

## Images

### `node images/image-audit.js`

Comptage et qualité des images (alt manquants, < seuil).

| Flag | Effet |
|---|---|
| `--task <fichier.md>` | Audit piloté |
| `--filter "<dsl>"` | Audit ad-hoc |

### `node images/image-alt.js`

Met à jour les alt texts manquants.

| Flag | Effet |
|---|---|
| `--filter "<dsl>"` | Défaut: `status ACTIVE, no_alt` |
| `--mode=formula\|vision` | Source du texte (défaut: `formula`) |
| `--confirm` | Applique |

### `node images/image-generate.js`

Génère des images via Gemini Image. Sauvegarde locale dans `generated-images/`.

| Flag | Effet |
|---|---|
| `--mode=single\|multi-variant` | Mode (défaut: `single`) |
| `--handle=<product-handle>` | **Obligatoire** |
| `--prompt="…"` | Prompt utilisateur (sinon défaut) |
| `--canonical=<idx>` | (multi-variant) image canonique (défaut: 0) |
| `--only="V1, V2"` | Limite aux variantes nommées |
| `--skip="V3"` | Saute ces variantes |
| `--retries=<n>` | Nombre de tentatives (défaut: `MAX_RETRIES`) |
| `--no-improve` | N'améliore pas le prompt via Gemini Text |
| `--dry-run` | N'appelle pas Gemini |

### `node images/image-upload.js`

Upload des images locales vers Shopify (staged upload + `productCreateMedia`).

| Flag | Effet |
|---|---|
| `--handle=<product-handle>` | **Obligatoire** |
| `--file=<path>` | Un seul fichier |
| `--dir=<path>` | Tous les `*.jpg/png/webp` du dossier |
| `--confirm` | Applique réellement |
| `--link-variants` | Lie chaque image à la variante dont le titre matche le nom de fichier |
| `--delete-old` | Supprime les anciennes images après upload (**IRREVERSIBLE**) |

### `node images/visual-audit.js`

Audit qualité d'image via Gemini Vision (`ADEQUATE` / `A_REMPLACER` / `NO_IMAGE`).

| Flag | Effet |
|---|---|
| `--filter "<dsl>"` | Défaut: `status ACTIVE` |
| `--refresh` | Ignore le cache JSON et ré-appelle Gemini |

Sortie : `visual-audit-report.md` + cache `.audit-tmp/visual-audit.json`.

---

## Intégrations

### `node integrations/klaviyo/klaviyo-export.js`

Export read-only Klaviyo → MD + templates HTML.

Variables requises : `KLAVIYO_API_KEY=pk_...` dans `.env`.

### `node integrations/shopify-email/adapt-templates.js`

Adapte les templates HTML Klaviyo pour Shopify Email.

| Flag | Effet |
|---|---|
| `--src=<dir>` | Dossier source (défaut: `../klaviyo/templates/`) |
| `--out=<dir>` | Dossier de sortie (défaut: `./templates-adapted/`) |
| `--mapping=<file.json>` | Substitutions custom de variables |

---

## Raccourcis npm

| Commande | Équivalent |
|---|---|
| `npm run fetch` | `node fetch-store-data.js` |
| `npm run audit` | `node audit/audit.js` |
| `npm run audit:full` | `node audit/full-audit.js` |
| `npm run image:audit` | `node images/image-audit.js` |
| `npm run image:visual-audit` | `node images/visual-audit.js` |
| `npm run klaviyo:export` | `node integrations/klaviyo/klaviyo-export.js` |
| `npm run klaviyo:adapt` | `node integrations/shopify-email/adapt-templates.js` |
| `npm run syntax-check` | `node -c` sur tous les `*.js` |
