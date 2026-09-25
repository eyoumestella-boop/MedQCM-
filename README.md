# MedQCM V6.1

Version préparée pour PostgreSQL/Supabase + Render.

Variables Render : DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY, OPENAI_MODEL, NODE_ENV=production.

Déploiement : GitHub -> Render Web Service -> npm install -> npm start.

La base est créée automatiquement au premier démarrage. Les mots de passe sont hachés et les sessions sont stockées dans PostgreSQL.

Avant ouverture publique : récupération de mot de passe, vérification e-mail, rate limiting, stockage cloud des PDF, sauvegardes, monitoring et validation pédagogique des QCM.
