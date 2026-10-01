# Authentication, Session & Profile v1

## Session et protection des routes

Next.js 16 utilise `src/proxy.ts` pour synchroniser les cookies Supabase SSR, vérifier l’utilisateur avec `auth.getUser()` et appliquer les redirections :

- utilisateur anonyme : `/` et toute route applicative vont vers `/login` ;
- utilisateur authentifié : `/` et `/login` vont vers `/dashboard` ;
- les routes `/api/*` restent dans leurs handlers afin de renvoyer `401` plutôt qu’une redirection HTML.

Les handlers personnels vérifient toujours la session eux-mêmes. Le Proxy est un contrôle de parcours, pas une autorisation de données.

## Profil

`profiles.id` correspond à `auth.users.id`. Le profil est créé de façon idempotente par un trigger Supabase après la création Auth, avec un fallback `upsert` dans `/api/profile`. La RLS existante limite chaque lecture et écriture à `auth.uid()`.

Le lot persiste `display_name`, `base_currency` et `default_analysis_depth` (`QUICK` ou `DETAILED`). L’avatar utilise les initiales ; aucun stockage de fichier n’est nécessaire pour ce MVP.

## Suppression de compte

La suppression passe par `/api/account`, vérifie d’abord l’utilisateur de session, puis utilise `auth.admin.deleteUser` exclusivement côté serveur. Les clés personnelles et le portefeuille suivent les `ON DELETE CASCADE` du schéma existant.

## Limitation volontaire

La préférence `base_currency` est prête pour une future devise d’affichage. Les calculs actuels continuent d’utiliser `portfolios.base_currency` afin de ne pas modifier silencieusement les Lots 1–3.
