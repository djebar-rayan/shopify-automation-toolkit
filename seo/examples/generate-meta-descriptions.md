# Génération de meta descriptions SEO

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE, seo_description manquant
- **Nb entités concernées** : 0

## Action

- **Type** : update
- **Champ modifié** : seo.description
- **Valeur** : générer via Gemini avec ce prompt : "Rédige une meta description SEO pour ce produit, entre 80 et 160 caractères, format incitatif avec un call-to-action léger. Pas de Markdown."

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/products.md`
- [x] Afficher les changements prévus avant d'appliquer
- [x] Demander confirmation `o/N` avant la mutation

## Critères de succès

- 100 % des produits filtrés ont une meta description SEO ≤ 160 caractères

## Résultats
