/**
 * SRS WHIP/WHEP WebRTC SDK - Async Version
 * Support for WHIP (WebRTC-HTTP ingestion Protocol) and WHEP (WebRTC-HTTP egress Protocol)
 * Also supports SRS JSON API for publishing
 */

export interface RtcSessionInfo {
  sessionid: string
  [key: string]: any
}

export interface PublishOptions {
  audio?: boolean
  video?: boolean
}

/**
 * SrsRtcWhipWhepAsync - Modern WHIP/WHEP WebRTC implementation
 * Supports WebRTC publishing and playback over HTTP
 */
export class SrsRtcWhipWhepAsync {
  private pc: RTCPeerConnection | null = null
  private _stream: MediaStream | null = null
  public sessionid: string = ''

  get stream(): MediaStream | null {
    return this._stream
  }

  set stream(value: MediaStream | null) {
    this._stream = value
  }

  /**
   * Publish media stream via WHIP protocol
   */
  async publish(
    url: string,
    mediaStream: MediaStream,
    options: PublishOptions = { audio: true, video: true }
  ): Promise<RtcSessionInfo> {
    try {
      // Close existing connection
      if (this.pc) {
        this.pc.close()
      }

      // Create RTCPeerConnection
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      })

      // Add media tracks
      for (const track of mediaStream.getTracks()) {
        this.pc.addTrack(track, mediaStream)
      }

      // Create and send offer
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      })

      await this.pc.setLocalDescription(offer)

      // Wait for ICE candidates to be gathered
      await new Promise<void>((resolve) => {
        const onIceComplete = () => {
          if (this.pc?.iceGatheringState === 'complete') {
            this.pc?.removeEventListener('icegatheringstatechange', onIceComplete)
            resolve()
          }
        }

        if (this.pc?.iceGatheringState === 'complete') {
          resolve()
        } else {
          this.pc?.addEventListener('icegatheringstatechange', onIceComplete)
        }
      })

      // Send SDP via WHIP
      const sdp = this.pc.localDescription?.sdp
      if (!sdp) {
        throw new Error('Failed to create SDP offer')
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: sdp,
      })

      if (!response.ok) {
        throw new Error(`WHIP request failed: ${response.status} ${response.statusText}`)
      }

      const answerSdp = await response.text()
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      })

      await this.pc.setRemoteDescription(answer)

      // Extract session ID from response location header or generate one
      this.sessionid = response.headers.get('Location')?.split('/').pop() || this.generateSessionId()

      return {
        sessionid: this.sessionid,
      }
    } catch (error) {
      this.pc?.close()
      this.pc = null
      throw error
    }
  }

  /**
   * Play media stream via WHEP protocol
   */
  async play(url: string): Promise<void> {
    try {
      // Close existing connection
      if (this.pc) {
        this.pc.close()
      }

      // Create RTCPeerConnection for playback
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      })

      // Handle incoming tracks
      this.pc.ontrack = (event) => {
        if (!this._stream) {
          this._stream = new MediaStream()
        }
        this._stream.addTrack(event.track)
      }

      // Create offer for playback
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })

      await this.pc.setLocalDescription(offer)

      // Wait for ICE candidates
      await new Promise<void>((resolve) => {
        const onIceComplete = () => {
          if (this.pc?.iceGatheringState === 'complete') {
            this.pc?.removeEventListener('icegatheringstatechange', onIceComplete)
            resolve()
          }
        }

        if (this.pc?.iceGatheringState === 'complete') {
          resolve()
        } else {
          this.pc?.addEventListener('icegatheringstatechange', onIceComplete)
        }
      })

      const sdp = this.pc.localDescription?.sdp
      if (!sdp) {
        throw new Error('Failed to create SDP offer for playback')
      }

      // Send WHEP request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: sdp,
      })

      if (!response.ok) {
        throw new Error(`WHEP request failed: ${response.status} ${response.statusText}`)
      }

      const answerSdp = await response.text()
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      })

      await this.pc.setRemoteDescription(answer)

      this.sessionid = response.headers.get('Location')?.split('/').pop() || this.generateSessionId()
    } catch (error) {
      this.pc?.close()
      this.pc = null
      this.stream = null
      throw error
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    this._stream = null
    this.sessionid = ''
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * SrsPublisher - SRS JSON API based publisher
 * Uses SRS WebRTC API for publishing
 */
export class SrsPublisher {
  private rtc: SrsRtcWhipWhepAsync
  private url: string
  private roomId: string
  private streamName: string

  constructor(url: string, roomId: string, streamName: string) {
    this.rtc = new SrsRtcWhipWhepAsync()
    this.url = url
    this.roomId = roomId
    this.streamName = streamName
  }

  /**
   * Publish stream via SRS JSON API
   */
  async publish(
    mediaStream: MediaStream,
    options: PublishOptions = { audio: true, video: true }
  ): Promise<RtcSessionInfo> {
    try {
      // Construct the WHIP URL for SRS
      // SRS JSON API uses: https://server/rtc/v1/publish/?app=live&stream=stream_name
      const whipUrl = this.buildWhipUrl()

      // Use the underlying WHIP implementation
      return await this.rtc.publish(whipUrl, mediaStream, options)
    } catch (error) {
      throw error
    }
  }

  /**
   * Stop publishing
   */
  async stop(): Promise<void> {
    await this.rtc.close()
  }

  private buildWhipUrl(): string {
    // Parse the SRS JSON API URL and construct WHIP URL
    // Convert: https://server/rtc/v1/publish/ -> https://server/rtc/v1/whip/?app=app&stream=stream
    const baseUrl = this.url.replace(/\/rtc\/v1\/publish\/$/, '')
    const params = new URLSearchParams({
      app: this.roomId || 'live',
      stream: this.streamName || 'stream',
    })
    return `${baseUrl}/rtc/v1/whip/?${params.toString()}`
  }
}

// Attach global functions for backward compatibility with Flash callbacks
declare global {
  interface Window {
    __srs_find_publisher?: (id: number) => SrsPublisher
    __srs_on_publisher_ready?: (id: number, cameras: string[], microphones: string[]) => void
    __srs_on_publisher_error?: (id: number, code: number) => void
    __srs_on_publisher_warn?: (id: number, code: number) => void
  }
}

// Publisher registry for callback compatibility
const publisherRegistry = new Map<number, SrsPublisher>()
let publisherId = 100

function registerPublisher(publisher: SrsPublisher): number {
  const id = publisherId++
  publisherRegistry.set(id, publisher)
  return id
}

function findPublisher(id: number): SrsPublisher {
  const publisher = publisherRegistry.get(id)
  if (!publisher) {
    throw new Error(`Publisher not found: ${id}`)
  }
  return publisher
}

// Export global functions
if (typeof window !== 'undefined') {
  window.__srs_find_publisher = (id: number) => findPublisher(id)
}
