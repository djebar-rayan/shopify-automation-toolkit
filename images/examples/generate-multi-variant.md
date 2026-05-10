# Génération d'images multi-variantes (référence + variante)

> Recette **non pilotée par tâche** — utilise directement la commande dédiée.
> Conçue pour les produits où chaque variante doit afficher un motif/design
> commun (image canonique) appliqué sur sa propre forme/couleur.
>
> Ex. : étuis téléphone, t-shirts avec impression, mugs personnalisés.

## Étape 1 — Générer (local, pas de mutation Shopify)

```
node images/image-generate.js --mode=multi-variant --handle=mon-produit \
  --canonical=0 \
  --prompt="Préserve fidèlement le motif de l'image 1 (canonique). Applique-le sur la forme et la couleur de l'image 2 (variante). Photo studio fond blanc, éclairage uniforme, qualité 4K."
```

Options utiles :

- `--only="iPhone 14, iPhone 15"` — n'effectue que ces variantes
- `--skip="iPhone 11"` — saute ces variantes
- `--canonical=2` — utiliser l'image #2 comme référence canonique
- `--no-improve` — ne pas faire passer le prompt par Gemini Text avant
- `--dry-run` — n'appelle pas Gemini, vérifie juste le plan
- `--retries=5` — augmente le nombre de tentatives sur rate limit

## Étape 2 — Validation visuelle

Inspecter les fichiers produits dans `generated-images/` :

```
ls generated-images/mon-produit_*
```

Supprimer manuellement les images jugées non satisfaisantes.

## Étape 3 — Upload + liaison aux variantes

```
node images/image-upload.js --handle=mon-produit --dir=generated-images \
  --link-variants --confirm
```

Pour remplacer définitivement les anciennes :

```
node images/image-upload.js --handle=mon-produit --dir=generated-images \
  --link-variants --delete-old --confirm
```

⚠️ `--delete-old` est irréversible. Toujours valider visuellement avant.

## Critères de succès

- Une image par variante validée (motif fidèle + forme variante respectée)
- Variantes liées à leur nouvelle image (`productVariantsBulkUpdate`)
- Aucune image résiduelle non utilisée si `--delete-old`
