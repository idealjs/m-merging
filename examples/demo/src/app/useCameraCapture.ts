import { useCallback, useEffect, useRef, useState } from 'react'

interface UseCameraCaptureOptions {
  initialCameraDeviceId: string
  initialMicrophoneDeviceId: string
}

export function useCameraCapture({
  initialCameraDeviceId,
  initialMicrophoneDeviceId,
}: UseCameraCaptureOptions) {
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState(initialCameraDeviceId)
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState(initialMicrophoneDeviceId)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [activeSource, setActiveSource] = useState('idle')
  const [status, setStatus] = useState('待启动')
  const [error, setError] = useState<string | null>(null)
  const currentMediaStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setSelectedCameraId(initialCameraDeviceId)
  }, [initialCameraDeviceId])

  useEffect(() => {
    setSelectedMicrophoneId(initialMicrophoneDeviceId)
  }, [initialMicrophoneDeviceId])

  const stopCurrentStream = useCallback(() => {
    currentMediaStreamRef.current?.getTracks().forEach((track) => {
      track.stop()
    })
    currentMediaStreamRef.current = null
  }, [])

  const refreshDevices = useCallback(async () => {
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
  }, [selectedCameraId, selectedMicrophoneId])

  const startCameraPreview = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持媒体采集')
      }

      stopCurrentStream()

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
  }, [selectedCameraId, selectedMicrophoneId, stopCurrentStream])

  const stopCapture = useCallback(() => {
    stopCurrentStream()
    setPreviewStream(null)
    setActiveSource('idle')
    setStatus('已停止采集')
  }, [stopCurrentStream])

  useEffect(() => {
    void refreshDevices()

    return () => {
      stopCurrentStream()
    }
  }, [refreshDevices, stopCurrentStream])

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
    refreshDevices,
    startCameraPreview,
    stopCapture,
  }
}
