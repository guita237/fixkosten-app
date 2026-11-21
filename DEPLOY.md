# Mise en ligne sur Hetzner

Même schéma que MiniHRWork : utilisateur `deploy`, dossier `/var/www/fixkosten`, `docker-compose.yml` + `docker-compose.prod.yml`. Remplace `fixkosten.guita.dev` si tu veux un autre sous-domaine.

Raccourci utilisé plus bas :
```bash
alias dcp='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
```

## 1. DNS (Hostinger)
Zone DNS de guita.dev → enregistrement **A** `fixkosten` → IP du serveur Hetzner (et **AAAA** si IPv6).
Vérifier : `dig +short fixkosten.guita.dev`

## 2. Premier déploiement (sur le serveur)
```bash
cd /var/www
git clone git@github.com:guita237/<repo>.git fixkosten   # comme minihrwork (même clé que pour ce repo)
cd fixkosten
cp .env.example .env && nano .env
mkdir -p secrets && nano secrets/firebase-service-account.json   # coller le JSON du compte de service
chmod 600 .env secrets/firebase-service-account.json
dcp up -d --build
dcp ps                            # db, api (healthy), web
curl -s 127.0.0.1:8086/api/health # {"status":"ok"}
```

`.env` de prod (le reste comme dans `.env.example`) :
```
DB_PASSWORD=<long mot de passe aléatoire : openssl rand -base64 32>
AUTH_MODE=
NODE_ENV=production
CORS_ORIGIN=https://fixkosten.guita.dev
RESEND_API_KEY=re_…
MAIL_FROM=Fixkosten <noreply@guita.dev>
VITE_FIREBASE_API_KEY=…
VITE_FIREBASE_AUTH_DOMAIN=<projet>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<projet>
VITE_FIREBASE_APP_ID=…
```

## 3. Reverse proxy + HTTPS
Avec Nginx sur l'hôte : `deploy/nginx-fixkosten.conf` (les commandes sont en haut du fichier), puis `certbot --nginx -d fixkosten.guita.dev`.
En prod, l'app écoute seulement sur `127.0.0.1:8086` (le conteneur web sert le frontend et transmet `/api` à l'API ; l'API n'a pas de port sur l'hôte, donc pas de conflit avec le port 5000 de MiniHRWork). Si 8086 est déjà pris : `ss -tlnp | grep 8086`, puis change-le dans `docker-compose.prod.yml`, dans la conf Nginx et dans le workflow.

## 4. Firebase
- Console Firebase → Authentication → Sign-in method → **E-mail/mot de passe** activé
- Authentication → Paramètres → **Domaines autorisés** → ajouter `fixkosten.guita.dev`
- Test réel : ouvrir l'app, créer un compte, puis `dcp logs api | tail` → des lignes `"status":200` avec `"user":1`.
  Un `Auth fehlgeschlagen: …` dans les logs indique le problème (JSON faux, mauvais projet…).

## 5. Sauvegarde de la base
```bash
./deploy/backup.sh            # test manuel → backups/fixkosten-AAAA-MM-JJ_HHMM.sql.gz
crontab -e
30 3 * * * /var/www/fixkosten/deploy/backup.sh >> /var/www/fixkosten/backups/backup.log 2>&1
```
14 jours conservés (`KEEP_DAYS`). Restauration : `./deploy/restore.sh backups/<fichier>.sql.gz`.
Pour avoir une copie hors du serveur : activer les Backups Hetzner, ou copier `backups/` ailleurs de temps en temps.

## 6. CI/CD GitHub Actions
`.github/workflows/deploy.yml`, comme MiniHRWork : SSH en tant que `deploy` → `git reset --hard origin/main` → `down` → `up -d --build` → `image prune`.
En plus : les tests et le build du backend et du frontend passent **avant** le déploiement (rien n'est déployé si un test casse), et à la fin le workflow attend `/api/health` (en cas d'échec, il affiche les logs de l'API dans Actions).

Secrets du repo (GitHub → Settings → Secrets and variables → Actions), les mêmes que pour MiniHRWork :
| Secret | Valeur |
|---|---|
| `SSH_PRIVATE_KEY` | la même clé privée que pour MiniHRWork |
| `SERVER_IP` | IP du serveur Hetzner |

## 7. Installer sur le téléphone
iPhone : Safari → Partager → « Sur l'écran d'accueil ». Android : Chrome → « Installer l'application ».
