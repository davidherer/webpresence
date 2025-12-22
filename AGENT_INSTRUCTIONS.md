# WebPresence - Instructions de développement

## Stack technique

- **pnpm** utilise pnpm
- **Next.js** (latest, App Router)
- **Prisma 6! (pas la version 7)** (ORM)
- **shadcn/ui** (mode compact, thème clair avec accents blue/purple)
- **TypeScript**
- **docker** pour postgres
- **prisma** crée bien des migrations à appliquer, pas de db push, schéma en anglais

## Principes de développement

### Architecture

- **Approche par composants** : découper en composants réutilisables et atomiques
- **Server Components par défaut** : utiliser RSC sauf besoin d'interactivité
- **API Routes Client** : toutes les mutations et agrégations côté serveur
- **Séparation User/Admin stricte** :

  - Routes utilisateur : `/(user)` avec auth User model
  - Routes management publiques : `/mgt-p4s7n/login` (page de connexion accessible)
  - Routes management protégées : `/mgt-p4s7n/app/*` avec auth Admin model et URL obfusquée
  - Deux modèles Prisma complètement séparés : `User` et `Admin` (passwordless, on authentifie par code envoyé par email avec resend)
  - Systèmes d'authentification indépendants (sessions, cookies, middlewares distincts)
  - Middlewares de protection sur layouts ET routes API
  - Pas de code partagé entre user et admin sauf types/utils génériques### Données et sécurité

- **Requêtes serveur** : agrégations et jointures via Prisma côté API
- **Auth obligatoire** : toutes les requêtes de données nécessitent authentification
- **Server Actions** : privilégier pour les mutations simples
- **Validation** : zod pour schémas de validation
- **Deux modèles Prisma séparés** :
  - `User` : utilisateurs finaux de l'app (participants aux rencontres)
  - `Admin` : comptes d'administration (table séparée, credentials distincts)
  - Pas de champ "role" partagé, deux tables complètement isolées
- **Double auth** :

  - User auth : JWT/session classique (`/api/auth/user`)
  - Admin auth : JWT/session séparé + 2FA optionnel (`/api/auth/admin`)
  - Vérification du modèle correct à chaque requête
  - Login admin sur `/mgt-p4s7n/login`, redirect vers `/mgt-p4s7n/app` après auth
  - Rate limiting plus strict sur routes admin
  - Logs de toutes actions admin### UI/UX

- **Design system** : palette claire (slate) + accents blue et purple (couleurs tailwind)
- **shadcn compact** : utiliser le mode `default` avec `radius: 0.5`
- **lucide icons** : utiliser les icones lucide react
- **Responsive first** : mobile d'abord

### Bonnes pratiques prototypage

- **Stop au README, QUICKSTART, MD files** ne crée pas de documentation sauf si demande
- **Pas de sur-documentation** : code auto-explicatif, JSDoc uniquement si complexe
- **Structure plate** : éviter les imbrications excessives
- **Colocation** : composants près de leur usage
- **Types partagés** : interfaces communes dans `/types`
- **Hooks réutilisables** : extraire la logique métier
- **Loading/Error states** : gérer dès le départ avec Suspense
- **Optimistic updates** : pour UX réactive
- **Contextes** : utilise les contextes pour partager des états globaux

### Structure

```
/app
  /(user)            # Groupe routes utilisateur
    /layout.tsx      # Layout + middleware auth user
    /page.tsx
  /mgt-p4s7n         # Routes admin publiques (login)
    /login/
      /page.tsx
  /mgt-p4s7n/app     # Routes admin protégées (URL obfusquée)
    /layout.tsx      # Layout + middleware auth admin strict
    /page.tsx        # Dashboard admin
  /api
    /auth
      /user/         # Auth endpoints user (User model)
      /admin/        # Auth endpoints admin (Admin model)
    /user/           # API routes user
    /admin/          # API routes admin
/components
  /user/             # Composants UI user
  /admin/            # Composants UI admin
  /shared/           # Composants réutilisables
/lib
  /auth
    /user.ts         # User auth logic (User model)
    /admin.ts        # Admin auth logic (Admin model)
  /api
    /middleware.ts   # withUserAuth, withAdminAuth
/prisma
  /schema.prisma     # User et Admin séparés
/types               # Types TypeScript partagés
/hooks               # Hooks React custom
/proxy.ts           # Middleware Next.js global
```

## À éviter

- ❌ Logique métier dans les composants client
- ❌ Requêtes DB directes côté client
- ❌ Sur-abstraction prématurée
- ❌ Commentaires évidents
- ❌ Components trop génériques trop tôt
- ❌ Mélanger code user et admin dans les mêmes fichiers
- ❌ Utiliser le même système d'auth pour user et admin
- ❌ Routes admin non protégées ou URL prévisibles (toujours via `/mgt-p4s7n/app/*`)
- ❌ Oublier la vérification du modèle Admin dans les API routes admin
- ❌ Exposer des routes admin sans le préfixe `/mgt-p4s7n/app`
