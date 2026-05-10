# Quick Start — du clone au premier audit en 15 minutes

## 1. Pré-requis

- Node.js ≥ 18
- Shopify CLI ≥ 3.93 (`shopify --version`)
- Un compte sur la boutique Shopify cible (rôle `read_products` minimum, `write_products` pour les mutations)
- Une clé API Gemini (commence par `AIza`) — gratuite sur <https://aistudio.google.com/app/apikey>

## 2. Cloner et configurer

```bash
git clone https://github.com/djebar-rayan/shopify-automation-toolkit.git
cd shopify-automation-toolkit

cp .env.example .env
# Ouvrir .env et remplir au minimum :
#   SHOPIFY_STORE=mon-magasin.myshopify.com
#   SHOP_BRAND_NAME=Ma Marque
#   GEMINI_API_KEY=AIza...
```

## 3. Authentification Shopify

```bash
shopify store auth --store mon-magasin.myshopify.com \
  --scopes read_products,write_products,read_content,write_content,read_themes,write_files
```

Une fenêtre de navigateur s'ouvre — autoriser l'accès. Le token est ensuite
stocké par le CLI.

> Si erreur "port 13387 already in use" :
> ```powershell
> netstat -ano | findstr ':13387'
> Stop-Process -Id <PID> -Force
> ```

## 4. Premier fetch

```bash
node fetch-store-data.js
```

Sortie attendue :

```
[1/9] Extraction des produits...
  page 1… 50 → cumul 50
  page 2… 47 → cumul 97
  ✓ products.md (315 KB)
[2/9] Extraction des collections...
…
✅ Extraction terminée en 38s
```

Vérifier que `store-data/` contient bien 9 fichiers `.md`.

## 5. Premier audit

```bash
node audit/full-audit.js
```

Sortie : `audit-report.md` à la racine. Ouvrir et lire les sections
"Scores globaux" et "Problèmes critiques (Priorité 1)".

## 6. Première action — exemple SEO

Si l'audit montre des `seo_title_missing` :

```bash
# Dry-run d'abord (rien n'est appliqué)
node seo/seo-update.js --target=titles

# Si la préview est satisfaisante, appliquer :
node seo/seo-update.js --target=titles --confirm
```

## 7. Re-fetch + audit comparatif

```bash
node fetch-store-data.js   # rafraîchit store-data/
node audit/full-audit.js   # nouveau audit-report.md
```

Comparer les scores. Le score SEO devrait avoir augmenté.

## Étapes suivantes

- [docs/COMMAND_REFERENCE.md](COMMAND_REFERENCE.md) — toutes les commandes
- [docs/TASK_FORMAT.md](TASK_FORMAT.md) — créer une tâche personnalisée
- [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md) — erreurs courantes
- [CLAUDE.md](../CLAUDE.md) — règles techniques à connaître
