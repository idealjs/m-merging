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

export function buildPublishUrlFromPushUrl(_url: string): string {
  return `https://srs.idealjs.com/rtc/v1/publish/`
}

export function buildStreamUrlFromPushUrl(url: string, roomId?: string, streamName?: string): string {
  const normalizedUrl = url.replace(/^rtc:\/\//, 'http://').replace(/^webrtc:\/\//, 'http://')
  const parsedUrl = new URL(normalizedUrl)
  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean)
  const app = roomId || pathSegments[0] || 'live'
  const stream = streamName || pathSegments[pathSegments.length - 1] || 'livestream'

  return `webrtc://${parsedUrl.hostname}/${app}/${stream}`
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
    _options: PublishOptions = { audio: true, video: true },
    streamUrl?: string
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdp,
          streamurl: streamUrl,
          api: url,
        }),
      })

      if (!response.ok) {
        throw new Error(`WHIP request failed: ${response.status} ${response.statusText}`)
      }

      const responseText = await response.text()
      let answerSdp = responseText
      let sessionid = this.generateSessionId()

      try {
        const responseJson = JSON.parse(responseText) as { sdp?: string; sid?: string; sessionid?: string }
        if (responseJson.sdp) {
          answerSdp = responseJson.sdp
        }
        sessionid = responseJson.sid || responseJson.sessionid || sessionid
      } catch {
        // Keep raw SDP bodies for compatibility.
      }

      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      })

      await this.pc.setRemoteDescription(answer)

      // Extract session ID from JSON response or generate one.
      this.sessionid = sessionid

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
      // Construct the SRS publish URL.
      // Support both SRS JSON API and legacy webrtc:// URLs.
      const publishUrl = buildPublishUrlFromPushUrl(this.url)
      const streamUrl = buildStreamUrlFromPushUrl(this.url, this.roomId, this.streamName)

      // Use the underlying WebRTC implementation.
      return await this.rtc.publish(publishUrl, mediaStream, options, streamUrl)
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

}

