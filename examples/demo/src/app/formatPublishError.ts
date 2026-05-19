export default function formatPublishError(error: unknown) {
  const err = error as any

  if (err && err.name === 'HttpsRequiredError') {
    return `WebRTC推流必须是HTTPS或者localhost：${err.name} ${err.message}`
  }

  if (err instanceof DOMException) {
    if (err.name === 'NotFoundError') {
      return `找不到麦克风和摄像头设备：getUserMedia ${err.name} ${err.message}`
    }

    if (err.name === 'NotAllowedError') {
      return `你禁止了网页访问摄像头和麦克风：getUserMedia ${err.name} ${err.message}`
    }

    if (
      ['AbortError', 'NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError', 'SecurityError', 'TypeError'].includes(
        err.name,
      )
    ) {
      return `getUserMedia ${err.name} ${err.message}`
    }
  }

  if (err && typeof err.name === 'string') {
    return `${err.name} ${err.message || ''}`
  }

  return error instanceof Error ? error.message : '推流失败'
}
