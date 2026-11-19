# routeur-modeles

Mod pour Claude Code : envoie chaque tâche sur le modèle adapté à sa complexité.

| Niveau   | Exemples                                                      | Modèle |
|----------|---------------------------------------------------------------|--------|
| simple   | « ok », question courte, petite modif évidente                | haiku  |
| moyen    | modif sur un ou deux fichiers, explication, petit script      | sonnet |
| complexe | refactor, débogage difficile, plan, audit, plusieurs fichiers | opus   |

Le niveau est estimé par un appel à Haiku. Les cas évidents (« ok », « merci », message très court) sont classés sans cet appel, et une règle simple (longueur, mots-clés) prend le relais si l'appel échoue.

## Ce qui fait vraiment économiser

Le mod ne réduit pas le nombre de tokens : il fait passer les tâches simples sur des modèles moins chers.

- **Sous-agents :** ils partent d'un contexte vide, donc changer de modèle ne coûte rien. C'est là que le gain est le plus net.
- **Conversation principale :** le cache de contexte est propre à chaque modèle. Changer de modèle fait relire toute la conversation au prix plein. Au-delà de 30 messages, le mod ne redescend donc plus vers un modèle moins cher. Il peut encore monter si une tâche l'exige. La ligne d'état affiche alors « gardé · contexte long ».
- **Grosse tâche longue :** un `/force opus` en début de tâche évite les allers-retours entre modèles.

## Commandes

- `/force` : affiche le mode actuel.
- `/force opus` (ou `haiku`, `sonnet`, `fable`, un id `claude-…`) : impose ce modèle, sous-agents compris.
- `/force auto` : revient au routage automatique.

## Personnaliser

Dans `hooks/register.tsx` :

- la table `MODELES` définit le modèle de chaque niveau ;
- `SEUIL_CONTEXTE` (30 par défaut) fixe le nombre de messages à partir duquel le mod ne redescend plus de modèle.

## Installation

Dans Claude Code :

```
/plugin marketplace add JulesMecatro/routeur-modeles
/plugin install routeur-modeles@routeur-modeles
```
