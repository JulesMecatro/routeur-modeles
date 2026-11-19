export type Niveau = 'simple' | 'moyen' | 'complexe'
/** `garde` : le modèle visé était moins cher, mais on garde l'actuel pour ne pas perdre le cache. */
export type Route = { niveau: Niveau; modele: string; garde: boolean }

declare module 'claude-code' {
  interface PluginState {
    'routeur-modeles': {
      force: Shaped<string | null>
      route: Shaped<Route | null>
      /** Modèle de la dernière requête du fil principal. */
      actif: Shaped<string | null>
      /** Nombre de messages de la dernière requête du fil principal. */
      taille: Shaped<number>
    }
  }
}
