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

## Postman

Dossier `postman/` :
- `Fixkosten-API.postman_collection.json` : 35 requêtes et 62 tests, répartis dans 6 dossiers (System, Kategorien, Ausgaben, Dashboard, Fehlerfälle, Aufräumen).
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

L'API écoute seulement sur `127.0.0.1:5000`. Il faut l'exposer via ton reverse proxy (HTTPS).

## API (`/api`, Bearer token Firebase sauf `/health`)

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/health` | Statut |
| GET | `/me` | Utilisateur courant (créé à la 1re connexion) |
| PUT | `/me` | `{ "monthlyNetIncomeCents": 300000 }` : revenu net mensuel (ou `null`) |
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
  "name": "Tontine A",
  "categoryId": 3,
  "amountCents": 10000,
  "frequency": "MONTHLY",
  "firstDueDate": "2026-08-05",
  "payouts": [{ "date": "2027-03-05", "amountCents": 120000 }]
}
```

`/upcoming` renvoie maintenant un champ `type` : `EXPENSE` (sortie) ou `PAYOUT` (entrée).

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
├── entities/      User, Category, Expense, Contract, Payout, PriceChange
├── enums/         Frequency, NoticeUnit
├── middleware/    auth (Firebase ou mode dev)
├── migrations/
├── routes/
├── services/      CostCalculator + BalanceCalculator (purs), ExpenseService, DashboardService
├── utils/         dateOnly (dates YYYY-MM-DD, calculs en UTC)
└── validation/    schémas zod
```

## Prochaines étapes

1. Frontend React + Vite : liste, formulaire, dashboard
2. Rappels de résiliation (node-cron + e-mail)
3. CI GitHub Actions → Hetzner
