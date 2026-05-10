# Description des collections vides

## Cible

- **Scope** : collections
- **Filtre** : tous
- **Nb entités concernées** : 0

> ⚠️ Le filtre `tous` cible **toutes** les collections. Si vous voulez
> ne traiter que celles sans description, c'est aux scripts amont
> (audit/audit.js) de présélectionner par handle.

## Action

- **Type** : update
- **Champ modifié** : descriptionHtml
- **Valeur** : générer via Gemini avec ce prompt : "Rédige une description de collection HTML, 80-120 mots, avec un paragraphe de présentation et une mention courte du positionnement. Pas de Markdown, pas de DOCTYPE."

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/collections.md`
- [x] Afficher les changements prévus avant d'appliquer
- [x] Demander confirmation `o/N` avant la mutation

## Critères de succès

- Chaque collection ciblée a une description entre 80 et 120 mots
- Aucun balisage Markdown résiduel dans le HTML

## Résultats
