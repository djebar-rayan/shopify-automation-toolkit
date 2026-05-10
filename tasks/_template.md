# Modèle de fichier de tâche

> Ce fichier sert de **modèle commenté** pour toutes les tâches futures.
> Il n'est jamais exécuté tel quel.
>
> Pour créer une nouvelle tâche : copier ce fichier en `tasks/<nom>.md`,
> retirer les commentaires HTML, remplir les sections.

**Date** : YYYY-MM-DD
**Script utilisé** : `<chemin/vers/script.js>`
**Fichiers de référence lus** : `store-data/<scope>.md`

<!-- ============================================================ -->
<!-- SECTIONS OBLIGATOIRES — toutes les sous-clés sont requises   -->
<!-- ============================================================ -->

## Cible

- **Scope** : products
- **Filtre** : tous les produits avec moins de 3 images
- **Nb entités concernées** : 0 (à recalculer par le script)

<!--
Le filtre est exprimé en français naturel. Mini-DSL reconnu par les
scripts (combinable par virgule = AND) :

  • « tous les produits »
  • « handle <h> »                        ex: handle mon-produit
  • « handles <h1>, <h2>, … »
  • « tag <t> »                           ex: tag bestseller
  • « status <ACTIVE|DRAFT|ARCHIVED> »
  • « images < N »                        ex: images < 3
  • « images = 0 »
  • « images > N »
  • « desc_words < N »                    ex: desc_words < 150
  • « desc_words > N »
  • « seo_title manquant »
  • « seo_description manquant »
  • « no_alt »                            (au moins 1 image sans alt)
  • « variants > N »
  • « vendor <v> »

Exemple combiné : « status ACTIVE, images < 3, no_alt »
-->

## Action

- **Type** : update              (audit | update | create | delete)
- **Champ modifié** : descriptionHtml
- **Valeur** : générer via Gemini avec ce prompt : "Rédige une description HTML structurée >150 mots pour ce produit, avec au moins un h2, une liste à puces et un strong."

<!--
Si valeur littérale, l'écrire directement :
  - **Valeur** : <p>Texte fixe.</p>

Pour une action audit, mettre :
  - **Champ modifié** : —
  - **Valeur** : —
-->

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/<scope>.md`
- [x] Afficher les changements prévus avant d'appliquer (dry-run automatique)
- [x] Demander confirmation `o/N` avant la mutation

<!--
Décocher [ ] pour sauter une étape. Pour automatiser sans prompt, passer
le flag --yes au script.
-->

## Critères de succès

- 100 % des entités filtrées modifiées sans erreur GraphQL
- Re-fetch automatique recommandé : `node fetch-store-data.js`
- Aucune mutation sur des entités hors-filtre

<!-- ============================================================ -->
<!-- SECTION RÉSULTATS — REMPLIE AUTOMATIQUEMENT PAR LE SCRIPT     -->
<!-- ============================================================ -->

## Résultats

<!-- Le script append ici son rapport :
## Résultats — 2026-01-15T20:00:00Z
- Entités ciblées : 12
- Entités modifiées : 12
- Erreurs : 0
-->
