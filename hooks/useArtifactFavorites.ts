"use client"

import { create } from "zustand"

interface ArtifactFavoritesState {
  favorites: Record<string, boolean>
  seedFavorite: (artifactId: string, favorite: boolean) => void
  isFavorite: (artifactId?: string, fallback?: boolean) => boolean
  toggleFavorite: (artifactId: string, nextFavorite?: boolean) => Promise<void>
}

export const useArtifactFavorites = create<ArtifactFavoritesState>((set, get) => ({
  favorites: {},
  seedFavorite: (artifactId, favorite) =>
    set((state) => ({
      favorites: {
        ...state.favorites,
        [artifactId]:
          artifactId in state.favorites ? state.favorites[artifactId] : favorite,
      },
    })),
  isFavorite: (artifactId, fallback = false) =>
    artifactId ? (get().favorites[artifactId] ?? fallback) : false,
  toggleFavorite: async (artifactId, nextFavorite) => {
    const current = get().favorites[artifactId] ?? false
    const favorite = nextFavorite ?? !current

    set((state) => ({
      favorites: {
        ...state.favorites,
        [artifactId]: favorite,
      },
    }))

    const res = await fetch(`/api/artifacts/${artifactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite }),
    })

    if (!res.ok) {
      set((state) => ({
        favorites: {
          ...state.favorites,
          [artifactId]: current,
        },
      }))
      const { error } = await res.json().catch(() => ({ error: `Error ${res.status}` }))
      throw new Error(error)
    }
  },
}))
