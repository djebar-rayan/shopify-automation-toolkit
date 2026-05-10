# Enrichissement de descriptions trop courtes

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE, desc_words < 150
- **Nb entités concernées** : 0

## Action

- **Type** : update
- **Champ modifié** : descriptionHtml
- **Valeur** : générer via Gemini avec ce prompt : "Rédige une description HTML structurée d'au moins 150 mots pour ce produit, avec au moins un h2, une liste à puces, et au moins un strong. Pas de DOCTYPE/html/body, pas de Markdown."

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/products.md`
- [x] Afficher les changements prévus avant d'appliquer
- [x] Demander confirmation `o/N` avant la mutation

## Critères de succès

- 100 % des produits filtrés ont une description ≥ 150 mots
- HTML structuré (h2, ul, li, strong)
- Re-fetch recommandé après application

## Résultats
