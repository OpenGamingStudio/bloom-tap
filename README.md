# Bloom Tap

Fais éclore les fleurs d'un tap avant qu'elles fanent : un jeu de réflexes jouable dans le navigateur, au doigt, à la souris et au clavier.

A reflex web game: tap the flowers before they wilt. Playable in the browser, on mobile, with a mouse or a keyboard.

- Jouer / Play : https://bloom-tap.opengamingstudio.com
- Licence : [MIT](LICENSE)
- Projet de [OpenGamingStudio](https://github.com/OpenGamingStudio), studio de jeux web open source.

## Le jeu / The game

| | |
|---|---|
| Plateau | grille 4×4 ; une fleur apparaît dans une case libre, reste 3 s (1,6 s après 2 minutes) puis fane |
| Contrôles | tap ou clic sur une fleur ; clavier : flèches pour se déplacer, `Entrée` ou `Espace` pour faire éclore ; `Échap` ou `P` pour la pause (automatique si l'onglet est caché) |
| Points | 10 par fleur, ×2 de 4 à 6 fleurs enchaînées, jusqu'à ×5 ; l'enchaînement tient si l'écart entre deux taps est de moins de 1,1 s |
| Vies | 3 ; une fleur fanée coûte une vie et casse le combo ; une case vide touchée ne coûte rien |
| Vitesse | la durée de vie des fleurs et l'écart entre apparitions baissent peu à peu pendant 2 minutes |
| Mode difficile | des mauvaises fleurs (une vie en moins) et des bombes apparaissent : une bombe touchée coûte aussi une vie, remet le combo à zéro et son explosion efface sans points les fleurs des 8 cases voisines ; un piège ignoré disparaît sans rien coûter |
| Sons | synthétisés (Web Audio, aucun fichier) : mauvaise fleur et bombe sonnent différemment ; bouton « Sons » dans le menu |
| Vibrations | sur les téléphones qui le permettent (`navigator.vibrate`) : mauvaise fleur, bombe, fleur fanée ; bouton « Vibrations » dans le menu (masqué ailleurs) |
| Pétales | 1 par fleur écloses (2 pour une dorée), cumulés d'une partie à l'autre |
| Boutique | Fleur lente (30 pétales, fleurs 35 % plus durables), Fleur dorée (40, une fleur sur cinq vaut ×2), Vie en plus (60, 4 vies au départ) |
| Sauvegarde | `localStorage` (`bloomtap.save`), versionnée, validée à la lecture ; le jeu marche aussi sans stockage |

Toutes les valeurs de réglage sont dans [`src/config.ts`](src/config.ts).

## Accessibilité

WCAG 2.2 AA visé : cibles de 44 px minimum, racine de police à 100 % (tout en rem), focus visible, jeu complet au clavier, `prefers-reduced-motion`, score et vies annoncés (`aria-live`), bouton pause, stade des fleurs distinct par la forme (bouton, ouverte, penchée) et non par la couleur seule.

## Développement / Development

Node ≥ 20.

```sh
npm ci
npm run dev        # serveur de développement
npm test           # tests unitaires (Vitest)
npm run build      # typecheck + build dans dist/
docker build -t bloom-tap . && docker run -p 8080:80 bloom-tap
```

Vite + TypeScript + Tailwind CSS v4. Police Fredoka auto-hébergée (SIL OFL, voir `src/fonts/OFL.txt`). Le site est statique (nginx 1.27) avec une CSP stricte : aucun script ni style inline, aucun appel réseau.
