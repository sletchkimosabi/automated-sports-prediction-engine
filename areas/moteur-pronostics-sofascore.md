# Moteur pronostics Sofascore — Mémoire persistante

## Date
2026-09-30

## Décisions actées dans cette reconstruction

- Application reconstruite en Next.js (App Router) + PostgreSQL (Drizzle ORM).
- Moteur JS `computeMatch` implémenté selon les règles R1–R17, avec R3/R6/R12 inactives et sans création de R18+.
- Marchés supportés : victoire, double chance, over15, under35/under45/under55, handicap15, handicap25, totalind.
- Arbitrages implémentés : priorité DC vs victoire selon seuil 1.40, promotion handicap +1.5 outsider, complément +2.5 via R16.
- Seuil RETENU basé sur `RETENU_TAUX_THRESHOLD=0.90`, aucune exclusion par marge.
- Pipeline quotidien scripté : collecte Sofascore, calcul batch, persistance base.
- Endpoints ajoutés :
  - `GET /api/verdicts/daily` (auto-refresh si snapshot absent, `?force=1` possible)
  - `POST|GET /api/cron/daily` (refresh quotidien automatisable via cron + `CRON_SECRET`)
- Journalisation des exécutions en base (`pipeline_runs`) et snapshots contextuels (`verdict_days`).
- Présentation principale en tableaux (club/sélection séparés), conformément à la contrainte de rendu tabulaire.

## Points d’attention

- La collecte Sofascore dépend de la disponibilité réseau et des structures de payload.
- Le pipeline ne bloque pas toute la journée si un championnat échoue : dégradation partielle par compétition.
- Les contextes club/sélection restent strictement séparés dans les vues et les données stockées.
