import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

export type PlayProtocol = 'rtc' | 'rtmp' | 'hls' | 'rtsp'

export interface DemoConfig {
  pushUrl: string
  playUrl: string
  playProtocol: PlayProtocol
  roomId: string
  streamName: string
  preferredCameraDeviceId: string
  preferredMicrophoneDeviceId: string
}

interface ConfigContextValue {
  config: DemoConfig
  isReady: boolean
  updateConfig: (patch: Partial<DemoConfig>) => void
  resetConfig: () => void
}

const STORAGE_KEY = 'm-merging-demo-config'

const DEFAULT_CONFIG: DemoConfig = {
  pushUrl: 'webrtc://srs.idealjs.com/live/livestream',
  playUrl: 'webrtc://srs.idealjs.com/live/livestream',
  playProtocol: 'rtc',
  roomId: 'live',
  streamName: 'livestream',
  preferredCameraDeviceId: '',
  preferredMicrophoneDeviceId: '',
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

function readStoredConfig(): DemoConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG
  }

  const rawConfig = window.localStorage.getItem(STORAGE_KEY)
  if (!rawConfig) {
    return DEFAULT_CONFIG
  }

  try {
    return {
      ...DEFAULT_CONFIG,
      ...JSON.parse(rawConfig),
    } as DemoConfig
  } catch {
    return DEFAULT_CONFIG
  }
}

export function ConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<DemoConfig>(DEFAULT_CONFIG)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setConfig(readStoredConfig())
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady || typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }, [config, isReady])

  const value = useMemo<ConfigContextValue>(
    () => ({
      config,
      isReady,
      updateConfig: (patch) => setConfig((current) => ({ ...current, ...patch })),
      resetConfig: () => setConfig(DEFAULT_CONFIG),
    }),
    [config, isReady],
  )

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig() {
  const context = useContext(ConfigContext)

  if (!context) {
    throw new Error('useConfig must be used inside ConfigProvider')
  }

  return context
}

export { DEFAULT_CONFIG }
