# Troubleshooting — FAQ et erreurs courantes

## "SHOPIFY_STORE manquant dans .env"

→ Copier `.env.example` en `.env` et remplir au minimum `SHOPIFY_STORE`.

```bash
cp .env.example .env
```

## "store-data/products.md introuvable"

→ Lancer d'abord `node fetch-store-data.js`. Tous les scripts génériques
lisent depuis `store-data/`, qui doit avoir été peuplé.

## La commande quitte avec exit code 1 sans message

→ Probablement `stdio: 'pipe'` au lieu de `'inherit'` dans un fork de
`execGql`. Cf. **Règle 2** de `CLAUDE.md`. Tous les scripts du toolkit
respectent cette règle.

## "Cannot find module ./shop-config"

→ Imports legacy. Le toolkit utilise `./lib/config` partout. Vérifier que
les imports relatifs sont corrects après une refonte locale.

## La query retourne `undefined` partout

→ Vous accédez à `res.data.products.edges` au lieu de `res.products.edges`.
Le Shopify CLI **n'a pas d'enveloppe `.data`**. Cf. **Règle 3** de `CLAUDE.md`.

## "Gemini Text 429" en boucle

→ Rate limit du tier gratuit (10 req/min). Le toolkit retry automatiquement
après 60 s, jusqu'à 3 fois. Si ça persiste :
- baisser le volume de la tâche (filtre plus restrictif)
- attendre quelques minutes
- passer au tier payant

## "blockReason: OTHER" en générant du texte avec Gemini

→ Vous utilisez `GEMINI_MODEL` (Flash Image) pour du texte. Utiliser
`GEMINI_TEXT_MODEL`. Cf. `lib/gemini-text.js` (déjà bon par défaut).

## Image générée rejetée pour "Trop petite (XX KB < 50KB)"

→ Le prompt ne demande pas une qualité suffisante. Ajouter "qualité 4K",
"haute résolution", "détails nets", et passer en `--mode=multi-variant`
avec une image de référence si possible.

## "Résolution trop basse (300×400)"

→ Idem. Gemini Flash Image génère parfois des images carrées 1024×1024
mais peut produire des miniatures sur certains prompts vagues. Forcer la
résolution dans le prompt : "image carrée 4K, 4096×4096 pixels".

## "stagedUploadsCreate échoué"

→ Vérifier le scope `write_files`. Cf. `docs/SHOPIFY_AUTH.md`.

## "ACCESS_DENIED sur menus"

→ `menus` GraphQL nécessite une App privée avec `read_online_store_navigation`.
`fetch-store-data.js` écrit un stub honnête dans `store-data/navigation.md`.
Documenter manuellement la structure du menu si besoin.

## Encodage cassé (caractères accentués)

→ Sur Windows, vérifier que la console est en UTF-8 :
```powershell
chcp 65001
```

## "shopify-cli not found"

→ Installer Shopify CLI : <https://shopify.dev/docs/api/shopify-cli/install>

## La tâche s'exécute mais rien ne se passe

→ Vérifier que :
1. Le scope est cohérent avec le script (`scope=products` pour
   `content/update-products.js`).
2. Le filtre matche bien des entités (lancer `audit/audit.js --task <task>`
   d'abord pour vérifier).
3. La case "Demander confirmation" n'est pas cochée si vous attendez une
   exécution non interactive (passer `--yes`).
