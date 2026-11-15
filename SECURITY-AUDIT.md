# Audit de sécurité V1 (Max Code)

Périmètre : tout le dépôt, site statique sans serveur ni réseau.

| Point | Résultat |
|---|---|
| CSP | `default-src 'none'`, scripts/styles/polices en `'self'`, `connect-src 'none'`, `frame-ancestors 'none'` (en-tête) ; aucune balise `style`, aucun attribut `style`, aucun script inline |
| En-têtes nginx | CSP, HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy no-referrer, Permissions-Policy, COOP ; répétés dans chaque `location` qui ajoute un en-tête |
| Injection DOM | `innerHTML` seulement avec du balisage constant et des entiers calculés (cœurs, SVG) ; textes de la boutique posés par `textContent` |
| `localStorage` | lu en `JSON.parse` protégé, forme vérifiée, entiers bornés (≥ 0), achats filtrés sur une liste blanche et dédoublonnés ; JSON cassé copié sous `.corrupt` ; version future jamais écrasée |
| Hook de test | `window.__bt` n'existe qu'avec `?e2e` dans l'URL et n'expose que l'état de partie local |
| Dépendances | `npm audit` : 0 vulnérabilité ; aucune dépendance d'exécution ; scripts d'installation désactivés (`--ignore-scripts`) |
| Secrets | aucun dans le dépôt |
| Fichiers cachés | refusés par nginx (hors `/.well-known`) |
