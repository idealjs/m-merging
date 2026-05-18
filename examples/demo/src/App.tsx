import { useEffect, useRef, useState } from 'react'
import { ConfigProvider, useConfig, type DemoConfig } from './app/ConfigProvider'
import { useMediaCapture } from './app/useMediaCapture'
import { SrsRtcWhipWhepAsync, SrsPublisher, type RtcSessionInfo } from './app/srsRtcWhipWhepAsync'
import './App.css'

type DemoPage = 'publish' | 'play'

function App() {
  return (
    <ConfigProvider>
      <DemoShell />
    </ConfigProvider>
  )
}

function DemoShell() {
  const { config, isReady, updateConfig, resetConfig } = useConfig()
  const [activePage, setActivePage] = useState<DemoPage>('publish')

  if (!isReady) {
    return (
      <div className="app app--loading">
        <div className="loading-card">
          <p className="eyebrow">直播 Demo</p>
          <h1>正在读取配置</h1>
          <p>组件启动时会先加载配置，再初始化推流和播放相关能力。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero__content">
          <p className="eyebrow">直播 Demo · React 组件化前置设计</p>
          <h1>推流页与播放页分离，配置先行，能力解耦</h1>
          <p className="hero__desc">
            当前 demo 先把配置读取、媒体采集、桌面共享和协议入口拆开，后续再接入
            SRS / OSS RS 的实际推流与播放引擎。
          </p>
          <div className="hero__stats">
            <Stat label="默认推流地址" value={config.pushUrl} />
            <Stat label="默认播放协议" value={config.playProtocol.toUpperCase()} />
            <Stat label="默认房间" value={config.roomId} />
          </div>
        </div>

        <div className="hero__panel">
          <div className="panel-card panel-card--accent">
            <p className="panel-card__title">Config Provider</p>
            <p className="panel-card__value">启动时读取配置，并在运行时保持可编辑。</p>
          </div>
          <div className="panel-card">
            <p className="panel-card__title">推流目标</p>
            <p className="panel-card__value">{config.pushUrl}</p>
          </div>
          <div className="panel-card">
            <p className="panel-card__title">播放入口</p>
            <p className="panel-card__value">{config.playUrl}</p>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="mode-switcher" aria-label="直播页面切换">
          <button
            type="button"
            className={activePage === 'publish' ? 'mode-switcher__tab is-active' : 'mode-switcher__tab'}
            onClick={() => setActivePage('publish')}
          >
            推流页
          </button>
          <button
            type="button"
            className={activePage === 'play' ? 'mode-switcher__tab is-active' : 'mode-switcher__tab'}
            onClick={() => setActivePage('play')}
          >
            播放页
          </button>

          <button type="button" className="mode-switcher__ghost" onClick={resetConfig}>
            恢复默认配置
          </button>
        </section>

        <div className="page-stack">
          <PublishPage
            config={config}
            updateConfig={updateConfig}
            isVisible={activePage === 'publish'}
          />
          <PlayPage
            config={config}
            updateConfig={updateConfig}
            isVisible={activePage === 'play'}
          />
        </div>
      </main>
    </div>
  )
}

function PublishPage({
  config,
  updateConfig,
  isVisible,
}: {
  config: DemoConfig
  updateConfig: (patch: Partial<DemoConfig>) => void
  isVisible: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const publisherRef = useRef<SrsPublisher | null>(null)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing'>('idle')
  const [publishError, setPublishError] = useState('')
  const [sessionInfo, setSessionInfo] = useState<RtcSessionInfo | null>(null)
  const {
    cameraDevices,
    microphoneDevices,
    previewStream,
    error,
    status,
    activeSource,
    selectedCameraId,
    selectedMicrophoneId,
    setSelectedCameraId,
    setSelectedMicrophoneId,
    refreshDevices,
    startCameraPreview,
    startDisplayShare,
    stopCapture,
    isSharingDisplay,
  } = useMediaCapture({
    initialCameraDeviceId: config.preferredCameraDeviceId,
    initialMicrophoneDeviceId: config.preferredMicrophoneDeviceId,
  })

  useEffect(() => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.srcObject = previewStream
    if (previewStream) {
      void videoRef.current.play().catch(() => undefined)
    }
  }, [previewStream])

  async function startPublish() {
    if (!previewStream) {
      setPublishError('请先开启摄像头预览或屏幕共享，再开始推流。')
      return
    }

    setPublishError('')
    setPublishStatus('publishing')

    try {
      if (publisherRef.current) {
        await publisherRef.current.stop()
      }

      const publisher = new SrsPublisher(config.pushUrl, config.roomId, config.streamName)
      publisherRef.current = publisher
      const session = await publisher.publish(previewStream, {
        audio: true,
        video: true,
      })
      setSessionInfo(session)
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : '推流失败')
      setPublishStatus('idle')
      publisherRef.current = null
    }
  }

  async function stopPublish() {
    setPublishStatus('idle')
    setSessionInfo(null)

    if (publisherRef.current) {
      await publisherRef.current.stop()
      publisherRef.current = null
    }
  }

  return (
    <section className={isVisible ? 'page page--publish' : 'page page--publish page--hidden'}>
      <div className="page__grid">
        <article className="card card--main">
          <div className="card__header">
            <div>
              <p className="eyebrow">主播侧</p>
              <h2>推流页</h2>
            </div>
            <span className="badge">RTC 推流</span>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>推流地址</span>
              <input
                value={config.pushUrl}
                onChange={(event) => updateConfig({ pushUrl: event.target.value })}
                spellCheck={false}
              />
            </label>

            <label className="field">
              <span>房间 / 频道</span>
              <input
                value={config.roomId}
                onChange={(event) => updateConfig({ roomId: event.target.value })}
                spellCheck={false}
              />
            </label>

            <label className="field">
              <span>流名称</span>
              <input
                value={config.streamName}
                onChange={(event) => updateConfig({ streamName: event.target.value })}
                spellCheck={false}
              />
            </label>

            <label className="field">
              <span>摄像头</span>
              <select
                value={selectedCameraId}
                onChange={(event) => {
                  setSelectedCameraId(event.target.value)
                  updateConfig({ preferredCameraDeviceId: event.target.value })
                }}
              >
                {cameraDevices.length === 0 ? <option value="">未发现摄像头</option> : null}
                {cameraDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 4)}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>麦克风</span>
              <select
                value={selectedMicrophoneId}
                onChange={(event) => {
                  setSelectedMicrophoneId(event.target.value)
                  updateConfig({ preferredMicrophoneDeviceId: event.target.value })
                }}
              >
                {microphoneDevices.length === 0 ? <option value="">未发现麦克风</option> : null}
                {microphoneDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 4)}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="button-row">
            <button type="button" className="primary-button" onClick={() => void refreshDevices()}>
              读取设备
            </button>
            <button type="button" className="primary-button" onClick={() => void startCameraPreview()}>
              开启摄像头预览
            </button>
            <button type="button" className="primary-button" onClick={startPublish}>
              开始推流
            </button>
            <button type="button" className="ghost-button" onClick={stopPublish}>
              停止推流
            </button>
            <button type="button" className="secondary-button" onClick={() => void startDisplayShare('browser')}>
              分享网页
            </button>
            <button type="button" className="secondary-button" onClick={() => void startDisplayShare('window')}>
              分享窗口
            </button>
            <button type="button" className="secondary-button" onClick={() => void startDisplayShare('screen')}>
              分享整个屏幕
            </button>
            <button type="button" className="ghost-button" onClick={stopCapture}>
              停止采集
            </button>
          </div>

          <div className="status-row">
            <StatusCard label="采集状态" value={status} />
            <StatusCard label="当前来源" value={activeSource} />
            <StatusCard label="共享状态" value={isSharingDisplay ? '屏幕共享中' : '未共享'} />
            <StatusCard label="推流状态" value={publishStatus === 'publishing' ? '推流中' : '未推流'} />
          </div>

          {sessionInfo ? (
            <div className="notice">
              会话已建立：{sessionInfo.sessionid}
            </div>
          ) : null}

          {publishError ? <div className="notice notice--error">{publishError}</div> : null}
          {error ? <div className="notice notice--error">{error}</div> : null}
          <div className="notice">
            说明：推流地址支持 `webrtc://...` / `rtc://...` 以及 SRS JSON API (`https://.../rtc/v1/publish/`)；发布参数会通过 POST body 发送，不再拼接 query。
          </div>
        </article>

        <aside className="card card--preview">
          <div className="card__header">
            <div>
              <p className="eyebrow">本地预览</p>
              <h2>媒体画面</h2>
            </div>
            <span className="badge badge--subtle">Preview</span>
          </div>

          <div className="preview-frame">
            {previewStream ? (
              <video ref={videoRef} autoPlay playsInline muted />
            ) : (
              <div className="preview-placeholder">
                <p>尚未开启采集</p>
                <span>先选择摄像头和麦克风，再点击“开启摄像头预览”或“分享屏幕”。</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

function PlayPage({
  config,
  updateConfig,
  isVisible,
}: {
  config: DemoConfig
  updateConfig: (patch: Partial<DemoConfig>) => void
  isVisible: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<SrsRtcWhipWhepAsync | null>(null)
  const [playStatus, setPlayStatus] = useState<'idle' | 'playing'>('idle')
  const [playError, setPlayError] = useState('')

  useEffect(() => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.srcObject = playerRef.current?.stream ?? null
    if (playerRef.current?.stream) {
      void videoRef.current.play().catch(() => undefined)
    }
  }, [playStatus])

  async function startPlay() {
    if (config.playProtocol !== 'rtc') {
      setPlayError('当前只接入了 RTC 低延迟播放，其他协议后续补上。')
      return
    }

    setPlayError('')
    try {
      if (playerRef.current) {
        await playerRef.current.close()
      }

      const player = new SrsRtcWhipWhepAsync()
      playerRef.current = player
      await player.play(config.playUrl)
      setPlayStatus('playing')
      if (videoRef.current) {
        videoRef.current.srcObject = player.stream
        void videoRef.current.play().catch(() => undefined)
      }
    } catch (error) {
      setPlayStatus('idle')
      setPlayError(error instanceof Error ? error.message : '播放失败')
      playerRef.current = null
    }
  }

  async function stopPlay() {
    setPlayStatus('idle')
    if (playerRef.current) {
      await playerRef.current.close()
      playerRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  return (
    <section className={isVisible ? 'page page--play' : 'page page--play page--hidden'}>
      <div className="page__grid page__grid--play">
        <article className="card card--main">
          <div className="card__header">
            <div>
              <p className="eyebrow">观众侧</p>
              <h2>播放页</h2>
            </div>
            <span className="badge">RTC / RTMP / HLS / RTSP</span>
          </div>

          <div className="form-grid">
            <label className="field field--wide">
              <span>播放地址</span>
              <input
                value={config.playUrl}
                onChange={(event) => updateConfig({ playUrl: event.target.value })}
                spellCheck={false}
              />
            </label>

            <label className="field">
              <span>播放协议</span>
              <select
                value={config.playProtocol}
                onChange={(event) =>
                  updateConfig({
                    playProtocol: event.target.value as 'rtc' | 'rtmp' | 'hls' | 'rtsp',
                  })
                }
              >
                <option value="rtc">RTC 低延迟</option>
                <option value="rtmp">RTMP</option>
                <option value="hls">HLS</option>
                <option value="rtsp">RTSP</option>
              </select>
            </label>

            <label className="field">
              <span>播放房间 / 频道</span>
              <input
                value={config.roomId}
                onChange={(event) => updateConfig({ roomId: event.target.value })}
                spellCheck={false}
              />
            </label>
          </div>

          <div className="button-row">
            <button type="button" className="primary-button" onClick={() => void startPlay()}>
              连接播放引擎
            </button>
            <button type="button" className="ghost-button" onClick={() => void stopPlay()}>
              停止播放
            </button>
          </div>

          <div className="status-row">
            <StatusCard label="默认协议" value={config.playProtocol.toUpperCase()} />
            <StatusCard label="播放地址" value={config.playUrl} />
            <StatusCard label="设计目标" value="低延迟 / 省资源" />
          </div>

          <div className="notice">
            现在 RTC 播放已连到同一个 SRS WebRTC 类，后续可继续补 RTMP / HLS / RTSP 降级。
          </div>

          {playError ? <div className="notice notice--error">{playError}</div> : null}
          <div className="notice">播放状态：{playStatus === 'playing' ? '播放中' : '未播放'}</div>
        </article>

        <aside className="card card--preview card--info">
          <div className="card__header">
            <div>
              <p className="eyebrow">协议规划</p>
              <h2>播放能力说明</h2>
            </div>
            <span className="badge badge--subtle">Roadmap</span>
          </div>

          <div className="preview-frame preview-frame--player">
            <video ref={videoRef} autoPlay playsInline controls muted={false} />
          </div>

          <ul className="roadmap-list">
            <li>
              <strong>RTC</strong>
              <span>用于低延迟播放，适合互动场景。</span>
            </li>
            <li>
              <strong>RTMP / HLS / RTSP</strong>
              <span>用于更高延迟但更省带宽和 CPU 的播放场景。</span>
            </li>
            <li>
              <strong>Config Provider</strong>
              <span>统一控制协议优先级、地址和播放参数。</span>
            </li>
          </ul>
        </aside>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  )
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-card">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  )
}

export default App
