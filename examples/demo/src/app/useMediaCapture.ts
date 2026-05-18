import { useEffect, useRef, useState } from 'react'

type DisplayMode = 'browser' | 'window' | 'screen'

interface UseMediaCaptureOptions {
  initialCameraDeviceId: string
  initialMicrophoneDeviceId: string
}

export function useMediaCapture({
  initialCameraDeviceId,
  initialMicrophoneDeviceId,
}: UseMediaCaptureOptions) {
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState(initialCameraDeviceId)
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState(initialMicrophoneDeviceId)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [activeSource, setActiveSource] = useState('idle')
  const [status, setStatus] = useState('待启动')
  const [error, setError] = useState<string | null>(null)
  const [isSharingDisplay, setIsSharingDisplay] = useState(false)
  const currentMediaStreamRef = useRef<MediaStream | null>(null)

  const stopCurrentStream = () => {
    currentMediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    currentMediaStreamRef.current = null
  }

  useEffect(() => {
    setSelectedCameraId(initialCameraDeviceId)
  }, [initialCameraDeviceId])

  useEffect(() => {
    setSelectedMicrophoneId(initialMicrophoneDeviceId)
  }, [initialMicrophoneDeviceId])

  useEffect(() => {
    void refreshDevices()

    return () => {
      stopCurrentStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshDevices() {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        throw new Error('当前浏览器不支持设备枚举')
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter((device) => device.kind === 'videoinput')
      const microphones = devices.filter((device) => device.kind === 'audioinput')

      setCameraDevices(cameras)
      setMicrophoneDevices(microphones)

      if (!selectedCameraId && cameras[0]) {
        setSelectedCameraId(cameras[0].deviceId)
      }

      if (!selectedMicrophoneId && microphones[0]) {
        setSelectedMicrophoneId(microphones[0].deviceId)
      }

      setStatus('设备已刷新')
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '设备读取失败')
      setStatus('设备读取失败')
    }
  }

  async function startCameraPreview() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持媒体采集')
      }

      stopCurrentStream()
      setIsSharingDisplay(false)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true,
        audio: selectedMicrophoneId ? { deviceId: { exact: selectedMicrophoneId } } : true,
      })

      currentMediaStreamRef.current = stream
      setPreviewStream(stream)
      setActiveSource('camera + microphone')
      setStatus('摄像头预览中')
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '开启摄像头失败')
      setStatus('摄像头启动失败')
    }
  }

  async function startDisplayShare(mode: DisplayMode) {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('当前浏览器不支持桌面共享')
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })

      stopCurrentStream()
      setIsSharingDisplay(true)

      const microphoneStream = selectedMicrophoneId
        ? await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: selectedMicrophoneId } },
            video: false,
          })
        : null

      const audioTrack = microphoneStream?.getAudioTracks()[0] ?? null
      const videoTrack = displayStream.getVideoTracks()[0]
      const combinedTracks = [videoTrack, ...(audioTrack ? [audioTrack] : [])]
      const combinedStream = new MediaStream(combinedTracks)

      videoTrack.onended = () => {
        setIsSharingDisplay(false)
        setStatus('桌面共享已结束')
        void startCameraPreview()
      }

      currentMediaStreamRef.current = combinedStream
      setPreviewStream(combinedStream)
      setActiveSource(
        mode === 'browser' ? 'browser tab' : mode === 'window' ? 'window' : 'screen',
      )
      setStatus(`共享中：${mode}`)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '桌面共享失败')
      setStatus('桌面共享失败')
    }
  }

  function stopCapture() {
    stopCurrentStream()
    setPreviewStream(null)
    setIsSharingDisplay(false)
    setActiveSource('idle')
    setStatus('已停止采集')
  }

  return {
    cameraDevices,
    microphoneDevices,
    selectedCameraId,
    selectedMicrophoneId,
    setSelectedCameraId,
    setSelectedMicrophoneId,
    previewStream,
    activeSource,
    status,
    error,
    isSharingDisplay,
    refreshDevices,
    startCameraPreview,
    startDisplayShare,
    stopCapture,
  }
}
