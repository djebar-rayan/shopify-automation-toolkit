# Setup Gemini

## 1. Obtenir une clé API

1. Aller sur <https://aistudio.google.com/app/apikey>
2. Se connecter avec un compte Google
3. Cliquer "Create API key"
4. Copier la clé — elle commence par **`AIza...`**

> Les tokens OAuth (`AQ...`) **ne fonctionnent pas** avec ce toolkit.

## 2. Configurer `.env`

```bash
GEMINI_API_KEY=AIzaSy...vraie_clé_ici
```

## 3. Modèles utilisés

Le toolkit configure 3 modèles dans `.env` :

| Constante | Valeur par défaut | Rôle |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.1-flash-image-preview` | **Génération/édition d'images uniquement** |
| `GEMINI_TEXT_MODEL` | `gemini-3.1-flash-lite-preview` | Texte (descriptions, prompts, meta) |
| `GEMINI_VISION_MODEL` | `gemini-3.1-flash-lite-preview` | Analyse d'images (vision) |

> ⚠️ Ne **jamais** utiliser `GEMINI_MODEL` (Flash Image) pour de l'analyse
> ou du texte — le modèle refuse avec `blockReason: OTHER`.

> Flash Lite gère nativement texte ET vision : un même modèle ID est utilisé
> pour `GEMINI_TEXT_MODEL` et `GEMINI_VISION_MODEL`.

## 4. Limites en tier gratuit

- **10 requêtes / minute** par modèle
- Le toolkit attend automatiquement `DELAY_GEMINI=6500 ms` entre appels
- Sur erreur **429 Rate Limit** ou **503 Unavailable** : retry après 60 s
  (jusqu'à `MAX_RETRIES=3` configurable)

## 5. Coût en tier payant

- Voir <https://ai.google.dev/pricing> pour les prix actuels
- Flash Lite : très économique (texte + vision)
- Flash Image : tarifé au token de génération d'image

## 6. Tester

```bash
node -e "
const { callGeminiTextWithRetry } = require('./lib/gemini-text');
callGeminiTextWithRetry('Dis bonjour en français.').then(console.log);
"
```

Si la clé est valide, vous verrez une réponse en quelques secondes. Sinon :

- `GEMINI_API_KEY invalide ou manquante` → vérifier `.env`
- `Gemini Text 401` → clé invalide / révoquée
- `Gemini Text 429` → rate limit (attendre 60 s)
- `Gemini Text 403` → quota épuisé
