export default function MaterialPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1600px] px-8 py-10">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white">
            素材库
          </h1>
          <p className="text-base text-white/60">管理您的所有生成素材</p>
        </div>
        <div className="flex h-96 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="mt-3 text-sm text-white/50">暂无素材，请先在 AI DESIGN / AI RENDER / AI VIDEO 中生成内容</p>
          </div>
        </div>
      </div>
    </div>
  );
}
