import { create } from 'zustand'
import API from '../services/api'

interface ConfigState {
  config: any | null
  isLoading: boolean
  fetchConfig: (force?: boolean) => Promise<any>
}

export const useConfigStore = create<ConfigState>((set, get) => {
  return {
    config: null,
    isLoading: false,
    fetchConfig: async (force = false) => {
      const state = get()
      if (state.config && !force) {
        return state.config
      }
      set({ isLoading: true })
      try {
        const res = await API.get('/config')
        set({ config: res.data, isLoading: false })
        return res.data
      } catch (err) {
        set({ isLoading: false })
        throw err
      }
    }
  }
})
