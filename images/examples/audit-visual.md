# Audit visuel des images via Gemini Vision

> Cette recette appelle **Gemini Vision** pour classifier chaque image
> en `ADEQUATE` / `A_REMPLACER` / `NO_IMAGE`.
>
> Coût : 1 appel Gemini Vision par image. Le résultat est mis en cache
> (`.audit-tmp/visual-audit.json`) pour éviter les ré-appels.

## Étape 1 — Lancer l'audit

```
node images/visual-audit.js --filter "status ACTIVE"
```

Sortie :

- `visual-audit-report.md` à la racine du repo
- `.audit-tmp/visual-audit.json` (cache, réutilisable)

## Étape 2 — Décider

Lister les `A_REMPLACER` du rapport et préparer une tâche de génération
d'image (`images/image-generate.js`).

## Options

- `--refresh` — ignore le cache et ré-appelle Gemini Vision
- `--filter "handle mon-produit"` — restreindre à un produit

## Critères de succès

- Tous les produits filtrés ont un verdict pour chaque image
- Le rapport sépare clairement ADEQUATE / A_REMPLACER / NO_IMAGE
