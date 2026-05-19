type SrsUserQuery = Record<string, string | undefined>

interface SrsUrlObject {
  url: string
  schema: string
  server: string
  port?: string
  vhost: string
  app: string
  stream: string
  user_query: SrsUserQuery
  [key: string]: unknown
}

interface SrsPreparedUrl {
  apiUrl: string
  streamUrl: string
  schema: string
  urlObject: SrsUrlObject
  port: string | number
  tid: string
}

interface SrsSessionInfo {
  sdp: string
  code?: number
  simulator?: string
  sessionid?: string
  [key: string]: unknown
}

interface SrsRtcTrackEvent {
  track: MediaStreamTrack
}

interface SrsRtcPublisherOptions {
  audio?: boolean
  camera?: boolean
  screen?: boolean
}

interface SrsRtcPlayerOptions {
  videoOnly?: boolean
  audioOnly?: boolean
}

interface SrsRtcPublisherAsyncInstance {
  constraints: MediaStreamConstraints
  pc: RTCPeerConnection | null
  stream: MediaStream
  ontrack?: (event: SrsRtcTrackEvent) => void
  publish(url: string): Promise<SrsSessionInfo>
  close(): void
  __internal: {
    defaultPath: string
    prepareUrl(webrtcUrl: string): SrsPreparedUrl
    parse(url: string): SrsUrlObject
    fill_query(query_string: string, obj: SrsUrlObject): void
  }
}

interface SrsRtcPlayerAsyncInstance {
  pc: RTCPeerConnection | null
  stream: MediaStream
  ontrack?: (event: SrsRtcTrackEvent) => void
  play(url: string): Promise<SrsSessionInfo>
  close(): void
  __internal: {
    defaultPath: string
    prepareUrl(webrtcUrl: string): SrsPreparedUrl
    parse(url: string): SrsUrlObject
    fill_query(query_string: string, obj: SrsUrlObject): void
  }
}

interface SrsRtcWhipWhepAsyncInstance {
  constraints: MediaStreamConstraints
  pc: RTCPeerConnection | null
  stream: MediaStream
  ontrack?: (event: SrsRtcTrackEvent) => void
  publish(url: string, options?: SrsRtcPublisherOptions): Promise<{ sessionid: string; simulator: string }>
  play(url: string, options?: SrsRtcPlayerOptions): Promise<{ sessionid: string; simulator: string }>
  close(): void
  __internal: {
    parseId(url: string, offer: string, answer: string): { sessionid: string; simulator: string }
  }
}

export function SrsError(name: string, message: string): Error
export function SrsRtcPublisherAsync(): SrsRtcPublisherAsyncInstance
export function SrsRtcPlayerAsync(): SrsRtcPlayerAsyncInstance
export function SrsRtcWhipWhepAsync(): SrsRtcWhipWhepAsyncInstance
export function SrsRtcFormatStats(stats: RTCStatsReport, kind: string): string
