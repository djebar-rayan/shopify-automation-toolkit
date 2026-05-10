# Génération de meta titles SEO

> Cette recette utilise les **formules** de `lib/builders/seo-meta.js`
> (sans Gemini), rapides et déterministes.
>
> Lancer directement : `node seo/seo-update.js --target=titles --confirm`
>
> Ou via fichier de tâche : copier ce fichier dans `tasks/`, ajuster
> le filtre, puis `node content/update-products.js --task tasks/<ce-fichier>`
> en remplaçant la valeur par le contenu de votre choix.

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE, seo_title manquant
- **Nb entités concernées** : 0

## Action

- **Type** : update
- **Champ modifié** : seo.title
- **Valeur** : générer via Gemini avec ce prompt : "Rédige un meta title SEO pour ce produit, max 70 caractères, format `[mot-clé] | [marque]`. Pas de Markdown."

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/products.md`
- [x] Afficher les changements prévus avant d'appliquer (dry-run automatique)
- [x] Demander confirmation `o/N` avant la mutation

## Critères de succès

- 100 % des produits filtrés ont un meta title SEO ≤ 70 caractères
- Re-fetch automatique de `store-data/products.md` après modifications

## Résultats
