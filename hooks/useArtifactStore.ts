import { create } from "zustand"

// Only HTML can be visually previewed in the sandbox iframe.
// CSS, JS, and TS are code-only — they have no standalone visual output.
const PREVIEWABLE_LANGS = ["html"]

export function isPreviewable(lang: string): boolean {
  return PREVIEWABLE_LANGS.includes(lang.toLowerCase())
}

export interface ArtifactEntry {
  artifactId?: string   // MongoDB _id — used to fetch content from API
  filename:   string
  lang:       string
  sizeBytes:  number
  favorite?:  boolean
  sourceCode?: string   // inline fallback for code-block previews
}

interface ArtifactState {
  isOpen: boolean
  artifact: ArtifactEntry | null
  artifacts: ArtifactEntry[]
  currentIndex: number
  openArtifact: (
    entry: ArtifactEntry,
    artifacts?: ArtifactEntry[],
    currentIndex?: number
  ) => void
  nextArtifact: () => void
  previousArtifact: () => void
  closeArtifact: () => void
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  isOpen: false,
  artifact: null,
  artifacts: [],
  currentIndex: 0,
  openArtifact: (entry, artifacts, currentIndex) =>
    set({
      isOpen: true,
      artifact: entry,
      artifacts: artifacts?.length ? artifacts : [entry],
      currentIndex: currentIndex ?? 0,
    }),
  nextArtifact: () =>
    set((state) => {
      const nextIndex = Math.min(state.currentIndex + 1, state.artifacts.length - 1)
      return {
        currentIndex: nextIndex,
        artifact: state.artifacts[nextIndex] ?? state.artifact,
      }
    }),
  previousArtifact: () =>
    set((state) => {
      const nextIndex = Math.max(state.currentIndex - 1, 0)
      return {
        currentIndex: nextIndex,
        artifact: state.artifacts[nextIndex] ?? state.artifact,
      }
    }),
  closeArtifact: () => set({ isOpen: false, artifact: null, artifacts: [], currentIndex: 0 }),
}))
