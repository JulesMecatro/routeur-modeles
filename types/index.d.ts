export type Niveau = 'simple' | 'moyen' | 'complexe'
export type Route = { niveau: Niveau; modele: string }

declare module 'claude-code' {
  interface PluginState {
    'routeur-modeles': {
      force: Shaped<string | null>
      route: Shaped<Route | null>
    }
  }
}
