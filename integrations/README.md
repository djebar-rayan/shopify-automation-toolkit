# Intégrations tierces

Ce dossier accueille les **connecteurs vers des services tiers**
qui ne sont pas Shopify (ESP, automation, analytics, paiement…).

Chaque intégration vit dans son propre sous-dossier avec :

- un script principal (`<integration>.js`)
- un `README.md` décrivant le périmètre, les credentials requis et
  les fichiers de sortie
- éventuellement des fichiers de configuration / mapping

## Intégrations fournies

| Dossier | Rôle |
|---|---|
| `klaviyo/` | Export read-only Klaviyo → fichiers Markdown + templates HTML |
| `shopify-email/` | Adaptation générique de templates Klaviyo vers Shopify Email |

## Ajouter une intégration

1. Créer un dossier `integrations/<nom>/`.
2. Y placer un script qui lit ses secrets dans `lib/config` (via `.env`).
3. Documenter dans un `README.md` les variables d'environnement requises et les sorties.
4. **Lecture seule par défaut** : ne déclencher des écritures que sur action explicite de l'utilisateur (`--confirm`).

## Pistes d'intégrations futures

- **Brevo / Sendinblue** : équivalent ESP de Klaviyo (alternatif).
- **n8n** : orchestrateur d'automations (webhooks Shopify → workflows).
- **Google Merchant Center** : exports catalogue.
- **Stripe** : croisement clients ↔ paiements pour métriques avancées.
- **Plausible / Matomo** : analytics serveur.
