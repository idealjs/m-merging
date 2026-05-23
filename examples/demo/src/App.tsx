import { useCallback, useState } from "react";
import { ConfigProvider, useConfig } from "./app/ConfigProvider";
import { PublishConfigModal } from "./app/PublishConfigModal";

function App() {
  return (
    <ConfigProvider>
      <DemoShell />
    </ConfigProvider>
  );
}

function DemoShell() {
  const { config, isReady } = useConfig();
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const closePublishModal = useCallback(() => {
    setIsPublishModalOpen(false);
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center justify-center">
          <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
            <h1 className="text-2xl font-semibold text-white">加载中</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">正在读取推流配置。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            m-merging demo
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">推流配置</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            点击下面按钮打开配置弹窗，选择要共享的屏幕并开始推流。
          </p>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-300 sm:w-auto"
              onClick={() => setIsPublishModalOpen(true)}
            >
              打开推流配置
            </button>
          </div>
        </div>
      </main>

      <PublishConfigModal
        open={isPublishModalOpen}
        config={config}
        onClose={closePublishModal}
      />
    </div>
  );
}

export default App;
