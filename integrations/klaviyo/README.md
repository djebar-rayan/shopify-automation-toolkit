# Klaviyo — Export read-only

Ce dossier exporte la configuration **Klaviyo** d'un compte vers des
fichiers Markdown locaux + des templates HTML par email. **Aucune
mutation** : seul des `GET` sont effectués.

## Pré-requis

- Une clé Private API Klaviyo (commence par `pk_…`).
- Définir `KLAVIYO_API_KEY=pk_xxx` dans `.env` à la racine du repo.

## Lancer l'export

```bash
node integrations/klaviyo/klaviyo-export.js
```

## Fichiers produits

| Fichier | Contenu |
|---|---|
| `flows.md` | Tous les flows avec trigger, statut, nb d'actions/emails |
| `lists.md` | Toutes les listes |
| `segments.md` | Tous les segments + définition (tronquée 200c) |
| `metrics.md` | Toutes les métriques |
| `profiles-summary.md` | Compteurs **agrégés** (sans PII) : total, subscribed, etc. |
| `klaviyo-summary.md` | Vue d'ensemble + table des flows |
| `templates/<flow-slug>_<n>.html` | HTML brut de chaque email |

## Garanties

- **Aucune écriture vers Klaviyo** : la méthode HTTP est verrouillée à `GET`.
- **Aucune PII exportée** : `profiles-summary.md` contient uniquement
  des compteurs et les clés (pas les valeurs) des `properties`.
- **Rate limit** : pause de 500 ms entre requêtes + retry 60 s sur 429.
