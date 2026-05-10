---
name: shopify-image-generator
description: Améliore et génère des images produit Shopify via Gemini Flash Image. Pour mode multi-variantes, utilise une image canonique (motif/design) + l'image existante de chaque variante comme références. Use when products have low-quality images, image_count_low flag, or when the user asks to regenerate/improve product photos using AI.
---

# Shopify Image Generator

Génère des images produits via **Gemini Flash Image (Nano Banana)** — soit pour
un produit unique, soit pour toutes les variantes en préservant un motif commun.

## Mode 1 — Single

Pour un produit dont on veut compléter / refaire une image :

```bash
node images/image-generate.js --mode=single --handle=<product-handle> \
  --prompt="Photo studio fond blanc, éclairage doux, cadrage carré, qualité 4K"
```

L'image de référence (si disponible) est la première image du produit
(préserve la cohérence visuelle).

## Mode 2 — Multi-variant (avec image canonique)

Pour un produit où chaque variante doit afficher un même motif/design appliqué
sur sa propre forme/couleur (étuis téléphone, t-shirts à imprimés, mugs…) :

```bash
node images/image-generate.js --mode=multi-variant --handle=<product-handle> \
  --canonical=0 \
  --prompt="Préserve fidèlement le motif de l'image 1 (canonique). Applique-le sur la forme de l'image 2 (variante). Photo studio fond blanc, éclairage uniforme, qualité 4K."
```

Options utiles :

- `--canonical=N` — utiliser l'image #N comme référence canonique
- `--only="variante 1, variante 2"` — ne traiter que ces variantes
- `--skip="variante 3"` — ignorer ces variantes
- `--retries=5` — augmenter le nombre de tentatives sur rate limit
- `--no-improve` — ne pas faire passer le prompt par Gemini Text avant
- `--dry-run` — vérifier le plan sans appeler Gemini

## Étape 1 — Audit visuel (recommandé)

Avant régénération, identifier les images à remplacer :

```bash
node images/visual-audit.js --filter "status ACTIVE"
```

→ produit `visual-audit-report.md` qui classe chaque image en
`ADEQUATE` / `A_REMPLACER` / `NO_IMAGE`.

## Étape 2 — Génération locale

Les images sont sauvegardées dans `generated-images/`. Aucun upload Shopify
à ce stade — validation visuelle obligatoire.

Vérifier les fichiers :
- taille ≥ 50 KB
- résolution ≥ 800×800
- motif fidèle / forme respectée

Supprimer manuellement les images jugées non satisfaisantes.

## Étape 3 — Upload + liaison aux variantes

```bash
# Upload simple
node images/image-upload.js --handle=<handle> --dir=generated-images --confirm

# Upload + liaison automatique aux variantes (matching par nom de fichier)
node images/image-upload.js --handle=<handle> --dir=generated-images --link-variants --confirm

# Upload + remplacement total (supprime les anciennes images, IRREVERSIBLE)
node images/image-upload.js --handle=<handle> --dir=generated-images --link-variants --delete-old --confirm
```

## Limitations

- Gemini Flash Image : 1 appel = 1 image (pas de batch natif).
- Rate limit : 10 req/min en tier gratuit. Le retry sur 429/503 attend 60 s automatiquement.
- Coût : variable selon le tier Google AI Studio.
- Fond blanc et cadrage uniforme demandent un prompt très précis ; ajouter
  des références visuelles (image canonique) améliore considérablement le résultat.

## Référence

- Modèle : `GEMINI_MODEL=gemini-3.1-flash-image-preview` (configurable dans `.env`).
- Pipeline : `lib/gemini-image.js` → `lib/image-validate.js` → `lib/image-upload.js`.
