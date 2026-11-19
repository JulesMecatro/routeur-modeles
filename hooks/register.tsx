import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Niveau, Route } from '../types'

// Modèle utilisé pour chaque niveau de complexité.
const MODELES: Record<Niveau, string> = {
  simple: 'haiku',
  moyen: 'sonnet',
  complexe: 'opus',
}
const CONNUS = ['haiku', 'sonnet', 'opus', 'fable']
// Du moins cher au plus cher : sert à savoir si un changement « descend ».
const ORDRE = ['haiku', 'sonnet', 'opus', 'fable']
// Au-delà de ce nombre de messages, le cache de la conversation vaut plus
// que l'écart de prix : on ne redescend plus vers un modèle moins cher.
const SEUIL_CONTEXTE = 30

const force = atom({ plugin: 'routeur-modeles', key: 'force' } as const, null, { shape: 'force-1' })
const route = atom({ plugin: 'routeur-modeles', key: 'route' } as const, null, { shape: 'route-2' })
const actif = atom({ plugin: 'routeur-modeles', key: 'actif' } as const, null, { shape: 'actif-1' })
const taille = atom({ plugin: 'routeur-modeles', key: 'taille' } as const, 0, { shape: 'taille-1' })

// Mots qui signalent un gros chantier, et réponses courtes évidentes.
const LOURD =
  /refactor|architect|migr|conçoi|concevoir|implément|plan |sécurité|audit|optimis|debug|bug|pourquoi|plusieurs fichiers|tout le projet/i
const EVIDENT = /^(ok|oui|non|merci|salut|hey|go|vas-y|c'est bon|parfait|top|super)\b/i

function rang(modele: string): number {
  const i = ORDRE.findIndex(m => modele.includes(m))
  return i === -1 ? ORDRE.length : i
}

function deviner(texte: string): Niveau {
  if (LOURD.test(texte) || texte.length > 600) return 'complexe'
  if (EVIDENT.test(texte) || texte.length <= 60) return 'simple'

  return 'moyen'
}

async function classer($: EngineInterface, texte: string): Promise<Niveau> {
  const t = texte.trim()
  // Cas évidents : pas d'appel au classifieur.
  if (!LOURD.test(t) && (EVIDENT.test(t) || t.length < 25)) return 'simple'
  if (t.length > 1500) return 'complexe'

  try {
    const n = await $.model.classify(
      `Évalue la complexité de cette demande faite à un assistant de code.
simple = question courte, salutation, petite modification évidente, lecture d'un fichier.
moyen = modification ciblée sur un ou deux fichiers, explication, petit script.
complexe = conception, refactor, débogage difficile, plusieurs fichiers, plan, audit.

Demande :
${t.slice(0, 4000)}`,
      ['simple', 'moyen', 'complexe'],
      { model: 'haiku' },
    )
    if (n === 'simple' || n === 'moyen' || n === 'complexe') return n
  } catch {
    // on retombe sur l'heuristique
  }

  return deviner(t)
}

function afficher($: EngineInterface, imposé: string | null, r: Route | null) {
  if (imposé) $.ui.status(`modèle : ${imposé} (forcé)`)
  else if (r?.garde) $.ui.status(`modèle : ${r.modele} (gardé · contexte long)`)
  else if (r) $.ui.status(`modèle : ${r.modele} (auto · ${r.niveau})`)
  else $.ui.status('modèle : auto')
}

async function traiterForce($: EngineInterface, args: string): Promise<string> {
  const choix = args.trim().toLowerCase()

  if (choix === '') {
    const imposé = await read($, force)
    if (imposé) return `Modèle forcé : ${imposé}. Tape /force auto pour revenir au routage.`
    const r = await read($, route)
    const base = `Routage auto (simple → ${MODELES.simple}, moyen → ${MODELES.moyen}, complexe → ${MODELES.complexe} ; au-delà de ${SEUIL_CONTEXTE} messages, pas de retour vers un modèle moins cher).`
    if (!r) return base
    return `${base} Dernière tâche : ${r.niveau} → ${r.modele}${r.garde ? ' (gardé pour le cache)' : ''}.`
  }

  if (choix === 'auto') {
    await update($, force, () => null)
    afficher($, null, await read($, route))
    return 'Routage automatique réactivé.'
  }

  if (!CONNUS.includes(choix) && !choix.startsWith('claude-')) {
    return `Modèle inconnu : « ${choix} ». Choix : ${CONNUS.join(', ')}, auto, ou un id complet (claude-…).`
  }

  await update($, force, () => choix)
  afficher($, choix, null)
  return `Modèle forcé sur ${choix} jusqu'à /force auto.`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'force',
      description: 'Forcer un modèle (haiku, sonnet, opus, fable) ou revenir au routage auto',
      argumentHint: '[haiku|sonnet|opus|fable|auto]',
    })
    afficher($, await read($, force), await read($, route))

    return next(e)
  })

  on('command.run', { command: 'force' }, async ($, e) => ({
    text: await traiterForce($, e.args),
  }))

  // Classe chaque prompt tapé (pas les commandes ni les messages système).
  on('prompt.submit', async ($, e, next) => {
    // /force tapé alors que l'app ne connaît pas la commande : on la traite ici.
    const m = !e.command && e.text.trim().match(/^\/force(?:\s+([\s\S]*))?$/i)
    if (m) {
      const msg = await traiterForce($, m[1] ?? '')
      $.ui.toast(msg)
      return { drop: msg }
    }
    if (e.command || e.isMeta || e.origin.kind !== 'composer') return next(e)
    if (await read($, force)) return next(e)

    const niveau = await classer($, e.text)
    const cible = MODELES[niveau]
    const courant = await read($, actif)
    // Conversation longue : redescendre ferait relire tout le contexte au prix
    // plein sur un autre modèle, ce qui coûte plus que l'écart de prix.
    const garde =
      courant !== null &&
      (await read($, taille)) >= SEUIL_CONTEXTE &&
      rang(cible) < rang(courant)
    const r: Route = { niveau, modele: garde && courant ? courant : cible, garde }
    await update($, route, () => r)
    afficher($, null, r)

    return next(e)
  }).catch(($, e, next) => next(e))

  // Chaque requête du fil principal part sur le modèle choisi ; on note sa
  // taille et son modèle pour la décision du prompt suivant.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)

    const modele = (await read($, force)) ?? (await read($, route))?.modele
    await update($, taille, () => e.messageCount)
    await update($, actif, () => modele ?? e.model)

    return yield* next(modele ? { ...e, model: modele } : e)
  })

  // Sous-agents : contexte neuf, donc pas de cache à perdre. C'est là que le
  // routage rapporte le plus. Le modèle forcé s'impose ; sinon, s'ils n'en ont
  // pas, on classe leur tâche.
  on('agent.spawn', async ($, e, next) => {
    const imposé = await read($, force)
    if (imposé) return next({ ...e, model: imposé })
    if (e.model) return next(e)
    const niveau = await classer($, e.prompt)

    return next({ ...e, model: MODELES[niveau] })
  }).catch(($, e, next) => next(e))
}
