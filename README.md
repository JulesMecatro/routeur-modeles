# routeur-modeles

Mod pour Claude Code : envoie chaque tâche sur le modèle adapté à sa complexité.

- **Sous-agents :** routés selon la complexité, vers le haut comme vers le bas.
- **Conversation principale :** garde le modèle de la session et ne fait que **monter** quand une demande est plus complexe. Elle ne redescend jamais.

| Niveau   | Exemples                                                      | Modèle |
|----------|---------------------------------------------------------------|--------|
| simple   | « ok », question courte, petite modif évidente                | haiku  |
| moyen    | modif sur un ou deux fichiers, explication, petit script      | sonnet |
| complexe | refactor, débogage difficile, plan, audit, plusieurs fichiers | opus   |

Le niveau est estimé par un appel à Haiku. Les cas évidents (« ok », « merci », message très court) sont classés sans cet appel, et une règle simple (longueur, mots-clés) prend le relais si l'appel échoue.

## Ce qui fait vraiment économiser

Le mod ne réduit pas le nombre de tokens : il fait passer les tâches simples sur des modèles moins chers.

- **Sous-agents :** ils partent d'un contexte vide, donc changer de modèle ne coûte rien. C'est là que le gain est le plus net : une tâche simple part sur haiku, une tâche lourde sur opus.
- **Conversation principale :** le cache de contexte est propre à chaque modèle, et changer de modèle fait relire toute la conversation au prix plein. Le mod ne redescend donc jamais. Il monte seulement quand une demande l'exige, et la ligne d'état affiche alors « monté ».
- **Déjà sur opus :** aucun appel de classement n'est fait, puisqu'il n'y a rien à monter.

## Commandes

- `/force` : affiche le mode actuel.
- `/force opus` (ou `haiku`, `sonnet`, `fable`, un id `claude-…`) : impose ce modèle, sous-agents compris.
- `/force auto` : revient au routage automatique.

## Personnaliser

La table `MODELES` dans `hooks/register.tsx` définit le modèle de chaque niveau.

## Installation

Dans Claude Code :

```
/plugin marketplace add JulesMecatro/routeur-modeles
/plugin install routeur-modeles@routeur-modeles
```
