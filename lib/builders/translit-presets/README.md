# Transliteration presets

This folder contains **JSON maps** to transliterate non-Latin alphabets
into ASCII. Each preset is a `<name>.json` file with the format:

```json
{
  "unicode_char_1": "ascii_eq_1",
  "unicode_char_2": "ascii_eq_2"
}
```

## Provided presets

| File | Script | Usage |
|---|---|---|
| `tifinagh.json` | Tifinagh / Neo-Tifinagh (Unicode 2D30–2D7F) | Stores publishing content in this alphabet |

## Usage

```bash
node content/handle-normalize.js --confirm \
  --map=lib/builders/translit-presets/tifinagh.json
```

## Adding a preset

1. Create `<name>.json` here (e.g. `cyrillic.json`).
2. Run `--map=lib/builders/translit-presets/<name>.json`.

Latin diacritics (é, ç, à, ñ, ü…) are handled natively by NFKD — no
preset needed.
