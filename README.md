# Fixkosten-App

App perso pour gérer les charges fixes : loyer, assurances, internet, abonnements. Elle calcule le coût mensuel réel, les prochaines échéances et les dates limites de résiliation.

## Stack

Node 22 + Express + TypeScript 5.9.3, MikroORM 6.5.9 + PostgreSQL 16, Firebase Auth, Vitest.
C'est la même base que TimeStamp : CommonJS, migrations appliquées au démarrage (`migrator.up()`).

## Démarrage local

```bash
cd backend
cp ../.env.example .env        # AUTH_MODE=dev : pas besoin de Firebase en local
npm install
npm test                       # tests du moteur de calcul
npm run dev                    # API sur http://localhost:5000/api
```

PostgreSQL local rapide, en une seule ligne (marche dans PowerShell, cmd et bash) :

```
docker run -d --name fixkosten-db -p 5432:5432 -e POSTGRES_USER=fixkosten -e POSTGRES_PASSWORD=bitte-aendern -e POSTGRES_DB=fixkosten postgres:16-alpine
```

Le port 5432 est déjà pris ? Utilise `-p 5433:5432` et mets `DB_PORT=5433` dans `backend/.env`.

Nouvelle migration après un changement d'entité : `npm run migration:create`.

## Frontend (React + Vite)

`frontend/` : React 18, TypeScript, Vite, TanStack Query, React Router, Firebase Auth. Interface en DE/FR/EN ; la langue est aussi enregistrée dans le backend pour les e-mails.

**Design « Brume »**, pensé d'abord pour le mobile : des aplats doux, Fraunces pour les chiffres et les titres, Figtree pour le texte. Chaque catégorie garde sa couleur : l'interface la mélange en pastel (`color-mix`) en clair comme en sombre. Thème clair, sombre ou système (Einstellungen › Darstellung).
Écrans : Monat (reste disponible, mosaïque des catégories, rappel de préavis, prochains paiements, versement de tontine), Ausgaben (regroupées par catégorie), Neue Ausgabe (panneau qui monte du bas, détails repliables), Zahlungen (on touche le rond pour cocher), Mehr → Kontoimport et Einstellungen. Sur mobile : barre d'onglets en pilule et bouton « + » ; sur ordinateur : navigation en haut.

**PWA** : `manifest.webmanifest`, icônes et service worker (`public/sw.js`, actif seulement dans le build de production). Sur iPhone : Safari → Partager → « Sur l'écran d'accueil » ; sur Android : Chrome → « Installer l'application ». Les données `/api` ne sont jamais mises en cache.

### Démarrer en local (sans Firebase)

```bash
# Terminal 1 – backend (AUTH_MODE=dev dans backend/.env)
cd backend && npm run dev

# Terminal 2 – frontend
cd frontend
cp .env.example .env          # VITE_AUTH_MODE=dev
npm install
npm run dev                   # http://localhost:5173  (/api passe par le proxy vers :5000)
```

En mode dev, le frontend envoie l'en-tête `x-dev-user: dev-user`. Ce sont les mêmes données que celles de la collection Postman.

### Avec Firebase

Dans `frontend/.env`, vide `VITE_AUTH_MODE` et renseigne les `VITE_FIREBASE_*` (console Firebase › Paramètres du projet › Tes applications › Web). Active aussi la connexion « E-mail/Mot de passe » dans Firebase Authentication. Le backend a besoin du compte de service (`GOOGLE_APPLICATION_CREDENTIALS`) et ne doit pas avoir `AUTH_MODE=dev`.

### Tests

`npm test` (format et calcul des échéances). Le parcours complet (réglages → dépenses → dashboard → montants → paiements → import CSV → sombre + français → ordinateur → suppression) a été testé dans Chrome, en vue mobile.

## Postman

Dossier `postman/` :
- `Fixkosten-API.postman_collection.json` : 52 requêtes et 100 tests, répartis dans 7 dossiers (System, Kategorien, Ausgaben, Dashboard, Fehlerfälle, V2, Aufräumen).
- `Fixkosten-lokal.postman_environment.json` : `baseUrl = http://localhost:5000/api`.
- `Fixkosten-Hetzner.postman_environment.json` : remplace `[DEINE-DOMAIN]` et mets un ID token Firebase dans `token`.

Importe les trois fichiers dans Postman, choisis l'environnement, puis lance la collection avec **Run collection**. Les IDs créés (catégorie, dépenses) sont enregistrés automatiquement, et le dossier « Aufräumen » supprime les données de test.
En local, mets `AUTH_MODE=dev` : aucun token n'est nécessaire.

En ligne de commande : `npx newman run postman/Fixkosten-API.postman_collection.json -e postman/Fixkosten-lokal.postman_environment.json`

## Production (Hetzner)

```bash
cp .env.example .env           # mettre un vrai DB_PASSWORD, vider AUTH_MODE, NODE_ENV=production
mkdir secrets && cp <service-account>.json secrets/firebase-service-account.json
docker compose up -d --build
```

Trois conteneurs : `db` (PostgreSQL), `api` (backend) et `web` (nginx : frontend + proxy `/api` → `api:5000`).
Le reverse proxy (HTTPS) pointe vers `127.0.0.1:8080` (web). L'API est aussi joignable seule sur `127.0.0.1:5000`.
Les variables `VITE_FIREBASE_*` dans `.env` sont intégrées au moment du build du frontend.

## API (`/api`, Bearer token Firebase sauf `/health`)

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/health` | Statut |
| GET | `/me` | Utilisateur courant (créé à la 1re connexion) |
| PUT | `/me` | Seuls les champs envoyés sont modifiés : `monthlyNetIncomeCents`, `language` (de/fr/en), `remindersEnabled`, `reminderEmail`, `reminderDaysBefore`, `reminderOverdue` |
| GET/POST | `/expenses` | Liste (`?categoryId=`) / création |
| GET/PUT/DELETE | `/expenses/:id` | Détail / modification / suppression |
| POST | `/expenses/:id/price-changes` | `{ "validFrom", "amountCents", "note" }` : nouveau montant à partir d'une date |
| DELETE | `/expenses/:id/price-changes/:changeId` | Supprimer une modification de montant |
| GET/POST | `/categories` | Liste / création |
| PUT/DELETE | `/categories/:id` | Modification / suppression |
| GET | `/dashboard/monthly` | Total mensuel normalisé + par catégorie, `incomeCents`, `remainingCents` (= revenu − charges fixes) |
| GET | `/upcoming?months=2` | Échéances à partir du début du mois courant |
| GET | `/contracts/deadlines` | Dates limites de résiliation, les plus urgentes d'abord |
| GET | `/dashboard/month?month=YYYY-MM` | Bilan du mois : sorties, entrées (versements), solde, `availableCents` (= revenu + solde) |
| GET | `/payouts/upcoming` | Versements à venir non encore reçus |
| GET | `/payments?month=YYYY-MM` | Échéances du mois avec leur statut : `OPEN`, `OVERDUE` (plus de 3 jours de retard), `PAID`, `SKIPPED` + totaux |
| GET | `/payments/overdue` | Impayés des 6 derniers mois |
| PUT | `/expenses/:id/payments/:dueDate` | `{ "status": "PAID"\|"SKIPPED", "paidDate", "amountCents" }` : marquer une échéance |
| DELETE | `/expenses/:id/payments/:dueDate` | Annuler (l'échéance redevient ouverte) |
| GET | `/reminders/preview?date=` | Rappels qui seraient envoyés aujourd'hui (sans envoi) |
| POST | `/reminders/run?date=` | Envoyer maintenant pour l'utilisateur courant |
| POST | `/reminders/test` | E-mail de test |
| POST | `/imports/csv` | Corps = fichier CSV brut (`Content-Type: text/csv`) : détecte le format et propose des correspondances. Rien n'est enregistré. |
| POST | `/imports/confirm` | `{ "matches": [...] }` : enregistre les correspondances validées (paiements `PAID`/`CSV`, versements reçus) |

Les routes de dashboard acceptent `?date=YYYY-MM-DD` pour simuler une autre date.

### Exemple : créer une dépense avec contrat

```json
POST /api/expenses
{
  "name": "Kfz-Versicherung",
  "categoryId": 2,
  "amountCents": 60000,
  "frequency": "YEARLY",
  "firstDueDate": "2027-01-01",
  "contract": {
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "noticeValue": 1,
    "noticeUnit": "MONTHS",
    "autoRenewMonths": 12
  }
}
```

- `frequency` : `MONTHLY` | `QUARTERLY` | `HALF_YEARLY` | `YEARLY`
- `noticeUnit` : `DAYS` | `WEEKS` | `MONTHS`
- Les montants sont toujours **en centimes** (entiers).
- `contract: null` supprime le contrat. Si le champ est absent, le contrat reste inchangé.
- `endDate` : dernière échéance possible (incluse), facultative.
- `contract.cancelledOn` : date de la résiliation.
- `payouts` : versements ponctuels, par exemple la cagnotte d'une tontine, avec `{ "date", "amountCents", "received" }`. Un tableau remplace tous les versements. Si le champ est absent, rien ne change.

### Exemple : tontine avec versement

```json
POST /api/expenses
{
  "name": "Tontine 1",
  "categoryId": 3,
  "amountCents": 10000,
  "frequency": "MONTHLY",
  "firstDueDate": "2026-08-05",
  "payouts": [{ "date": "2027-03-05", "amountCents": 120000 }]
}
```

`/upcoming` renvoie maintenant un champ `type` : `EXPENSE` (sortie) ou `PAYOUT` (entrée).

## V2 : paiements, rappels, import bancaire

**Contrats grand public** (`contract.consumerContract: true`, pour les contrats conclus à partir du 01.03.2022, § 309 Nr. 9 BGB) : pendant la durée initiale, le préavis normal s'applique. Ensuite, il n'y a plus de reconduction de 12 mois : le contrat est résiliable à tout moment avec 1 mois de préavis (`earliestEndIfCancelledToday`).

**Suivi des paiements** : une échéance sans entrée est `OPEN`, puis `OVERDUE` après 3 jours de tolérance. Le montant réellement payé peut différer du montant prévu (`differenceCents`).

**Rappels par e-mail** (cron chaque jour à 7 h, Europe/Berlin) :
- un seul e-mail récapitulatif par utilisateur, dans sa langue (de/fr/en) ;
- dates limites de résiliation : un rappel au début de la période d'avance (`reminderDaysBefore`), puis un dernier rappel la veille ;
- versements de tontine : un rappel pendant la période d'avance ;
- impayés : seulement si `reminderOverdue`, et seulement sur les 14 derniers jours ;
- `reminder_logs` empêche les doublons ; si un passage du cron est manqué, le rappel est envoyé au suivant.

Envoi par **Resend** (API HTTP via le port 443, qui n'est pas bloqué par Hetzner, contrairement aux ports SMTP 25 et 465) : mets `RESEND_API_KEY` et `MAIL_FROM`. Expéditeur : `noreply@mail.guita.dev`. C'est le sous-domaine `mail.guita.dev`, déjà vérifié dans Resend pour les autres projets. Pour tester sans domaine vérifié : `MAIL_FROM=onboarding@resend.dev`, mais Resend n'envoie alors qu'à l'adresse de ton compte Resend. Le SMTP reste possible en option (`SMTP_*`). Sans clé ni SMTP, les e-mails sont seulement écrits dans le log.

**Import CSV** : formats reconnus automatiquement : Sparkasse (CSV-CAMT V2), N26 (actuel et ancien), Revolut (seulement les opérations `COMPLETED`). Tout autre export (Vivid, etc.) est détecté par les noms de colonnes (date/Datum/Buchungstag, montant/Betrag/Amount, …), même avec des lignes d'en-tête avant le tableau. En dernier recours, indique les colonnes à la main : `?dateColumn=Datum&amountColumn=Betrag&counterpartyColumn=Empfänger&referenceColumn=Verwendungszweck`. L'encodage UTF-8 ou Latin-1 est détecté, ainsi que le séparateur `;`, `,` ou tabulation.
Rapprochement : montant (exact, ou ±2 % / 1 €), date (±10 jours autour de l'échéance), mots du nom ou du fournisseur dans le libellé. Une échéance déjà payée n'est jamais proposée deux fois. Un montant différent n'est proposé que si le nom correspond nettement et que la date est à 3 jours près (confiance `MEDIUM`).

## Règles métier

- **Coût mensuel** = montant ÷ nombre de mois de la période, arrondi au centime.
- **Échéances** : le jour d'ancrage est conservé. Une échéance au 31 tombe le 28/29 en février, puis revient au 31 en mars.
- **Date de fin** : `endDate` sur une dépense (par exemple la fin d'un cycle de tontine). Si un contrat est résilié (`cancelled` + `cancelledOn`), les échéances s'arrêtent à la fin de la période en cours. Une résiliation tardive repousse la fin d'une période de prolongation. Le DTO indique `effectiveEndDate` et `ended`.
- **Montants** : `amountCents` est le montant de base à partir de `firstDueDate`. Les changements de prix (`priceChanges`) s'appliquent à partir de leur date. Les mois passés gardent l'ancien montant. Le DTO indique `currentAmountCents`, et `monthlyCostCents` est calculé à partir de celui-ci.
- **Revenu** : un seul montant net par mois sur l'utilisateur. Le dashboard calcule ce qui reste après les charges fixes.
- **Bilan mensuel** = versements du mois − échéances du mois. Le mois où tu touches la tontine peut être positif.
- **Résiliation** : date limite = fin de la période − préavis. Si cette date est passée et que le contrat a `autoRenewMonths > 0`, on calcule sur la période suivante.

## Structure

```
backend/src
├── app.ts / server.ts
├── config/        db, mikro-orm, firebase
├── controllers/   Expense, Category, Dashboard (+ gestion d'erreurs centrale)
├── entities/      User, Category, Expense, Contract, Payout, PriceChange, Payment, ReminderLog
├── import/        CsvReader, BankFormats, TransactionMatcher, ImportService
├── jobs/          reminderJob (cron)
├── enums/         Frequency, NoticeUnit
├── middleware/    auth (Firebase ou mode dev)
├── migrations/
├── routes/
├── services/      purs : CostCalculator, BalanceCalculator, PaymentTracker, ReminderPlanner
│                  DB : ExpenseService, DashboardService, PaymentService, ReminderService, Mailer
├── utils/         dateOnly (dates YYYY-MM-DD, calculs en UTC)
└── validation/    schémas zod
```

## Prochaines étapes

1. Déploiement : sauvegarde, durcissement de l'API, CI GitHub Actions → Hetzner
