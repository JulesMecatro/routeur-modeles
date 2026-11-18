# routeur-modeles

Mod pour Claude Code : envoie chaque tâche sur le modèle adapté à sa complexité.

| Niveau   | Exemples                                                      | Modèle |
|----------|---------------------------------------------------------------|--------|
| simple   | « ok », question courte, petite modif évidente                | haiku  |
| moyen    | modif sur un ou deux fichiers, explication, petit script      | sonnet |
| complexe | refactor, débogage difficile, plan, audit, plusieurs fichiers | opus   |

Le niveau est d'abord estimé par un appel à Haiku ; en cas d'échec, une règle simple (longueur, mots-clés) prend le relais.

## Commandes

- `/force` : affiche le mode actuel.
- `/force opus` (ou `haiku`, `sonnet`, `fable`, un id `claude-…`) : impose ce modèle, sous-agents compris.
- `/force auto` : revient au routage automatique.

## Personnaliser

La table `MODELES` dans `hooks/register.tsx` définit le modèle de chaque niveau.

## Installation

Dans Claude Code :

```
/plugin marketplace add <propriétaire>/routeur-modeles
/plugin install routeur-modeles@routeur-modeles
```
