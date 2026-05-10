# Normalisation des handles non-ASCII

> Cette recette utilise la commande dédiée :
>
> ```
> node content/handle-normalize.js              # dry-run, diacritiques latins
> node content/handle-normalize.js --confirm    # applique
> ```
>
> Les diacritiques latins (é, ç, à, ñ, ü…) sont gérés nativement par NFKD.
> Pour les alphabets non-latins (cyrillique, arabe, devanagari, tifinagh…)
> fournir un preset JSON via `--map=lib/builders/translit-presets/<name>.json`
> (ou créer le sien — cf. `lib/builders/translit-presets/README.md`).

## Cible

- **Scope** : products
- **Filtre** : tous les produits
- **Nb entités concernées** : (calculé à l'exécution — uniquement ceux dont le handle contient des caractères non-ASCII)

## Action

- **Type** : update
- **Champ modifié** : handle
- **Valeur** : produit par `lib/builders/handle.js::normalizeHandle()`

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/products.md`
- [x] Afficher les changements prévus avant d'appliquer
- [x] Demander confirmation `o/N` avant la mutation

## Critères de succès

- 100 % des handles non-ASCII sont remplacés par leur équivalent ASCII
- Shopify crée automatiquement les redirections 301 depuis les anciens handles
- `store-data/redirects.md` doit être re-fetché après application

## Résultats
