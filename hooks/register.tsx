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

const force = atom({ plugin: 'routeur-modeles', key: 'force' } as const, null, {
  shape: 'force-1',
})
const route = atom({ plugin: 'routeur-modeles', key: 'route' } as const, null, {
  shape: 'route-1',
})

// Repli si le classifieur échoue : longueur et mots qui signalent un gros chantier.
const LOURD =
  /refactor|architect|migr|conçoi|concevoir|implément|plan |sécurité|audit|optimis|debug|bug|pourquoi|plusieurs fichiers|tout le projet/i
const LEGER = /^(ok|oui|non|merci|salut|hey|go|vas-y|c'est bon)\b|^.{0,60}$/i

function deviner(texte: string): Niveau {
  if (LOURD.test(texte) || texte.length > 600) return 'complexe'
  if (LEGER.test(texte.trim())) return 'simple'

  return 'moyen'
}

async function classer($: EngineInterface, texte: string): Promise<Niveau> {
  try {
    const n = await $.model.classify(
      `Évalue la complexité de cette demande faite à un assistant de code.
simple = question courte, salutation, petite modification évidente, lecture d'un fichier.
moyen = modification ciblée sur un ou deux fichiers, explication, petit script.
complexe = conception, refactor, débogage difficile, plusieurs fichiers, plan, audit.

Demande :
${texte.slice(0, 4000)}`,
      ['simple', 'moyen', 'complexe'],
      { model: 'haiku' },
    )
    if (n === 'simple' || n === 'moyen' || n === 'complexe') return n
  } catch {
    // on retombe sur l'heuristique
  }

  return deviner(texte)
}

function afficher($: EngineInterface, imposé: string | null, r: Route | null) {
  if (imposé) $.ui.status(`modèle : ${imposé} (forcé)`)
  else if (r) $.ui.status(`modèle : ${r.modele} (auto · ${r.niveau})`)
  else $.ui.status('modèle : auto')
}

async function traiterForce($: EngineInterface, args: string): Promise<string> {
  const choix = args.trim().toLowerCase()

  if (choix === '') {
    const imposé = await read($, force)
    if (imposé) return `Modèle forcé : ${imposé}. Tape /force auto pour revenir au routage.`
    const r = await read($, route)
    const base = `Routage auto (simple → ${MODELES.simple}, moyen → ${MODELES.moyen}, complexe → ${MODELES.complexe}).`
    return r ? `${base} Dernière tâche : ${r.niveau} → ${r.modele}.` : base
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
    if (!(await read($, force))) {
      const niveau = await classer($, e.text)
      const r: Route = { niveau, modele: MODELES[niveau] }
      await update($, route, () => r)
      afficher($, null, r)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Chaque requête du fil principal part sur le modèle choisi.
  on('turn.step', async function* ($, e, next) {
    const modele =
      e.agentId === undefined
        ? ((await read($, force)) ?? (await read($, route))?.modele)
        : undefined

    return yield* next(modele ? { ...e, model: modele } : e)
  })

  // Sous-agents : le modèle forcé s'impose ; sinon, s'ils n'en ont pas, on classe leur tâche.
  on('agent.spawn', async ($, e, next) => {
    const imposé = await read($, force)
    if (imposé) return next({ ...e, model: imposé })
    if (e.model) return next(e)
    const niveau = await classer($, e.prompt)

    return next({ ...e, model: MODELES[niveau] })
  }).catch(($, e, next) => next(e))
}
