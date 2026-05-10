# Presets de translittération

Ce dossier contient des **maps JSON** pour translittérer des alphabets
non-latins en ASCII. Chaque preset est un fichier `<nom>.json` au format :

```json
{
  "char_unicode_1": "ascii_eq_1",
  "char_unicode_2": "ascii_eq_2"
}
```

## Presets fournis

| Fichier | Script | Usage |
|---|---|---|
| `tifinagh.json` | Tifinagh / Néo-Tifinagh (Unicode 2D30–2D7F) | Boutiques publiant en tamazight |

## Utilisation

```bash
node content/handle-normalize.js --confirm \
  --map=lib/builders/translit-presets/tifinagh.json
```

## Ajouter un preset

1. Créer `<nom>.json` ici (ex : `cyrillic.json`).
2. Lancer `--map=lib/builders/translit-presets/<nom>.json`.

Les diacritiques latins (é, ç, à, ñ, ü…) sont gérés nativement par
NFKD — pas besoin de preset.
