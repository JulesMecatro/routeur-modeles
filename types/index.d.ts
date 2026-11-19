export type Niveau = 'simple' | 'moyen' | 'complexe'
/** La dernière montée de modèle décidée pour la conversation principale. */
export type Route = { niveau: Niveau; modele: string }

declare module 'claude-code' {
  interface PluginState {
    'routeur-modeles': {
      force: Shaped<string | null>
      route: Shaped<Route | null>
    }
  }
}
