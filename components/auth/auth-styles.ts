export const authInputClassName =
  "h-12 rounded-2xl border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-[#0f1f4d] shadow-none focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-50";

export const authInputWithToggleClassName =
  "h-12 rounded-2xl border-slate-200 bg-white pl-11 pr-11 text-sm font-medium text-[#0f1f4d] shadow-none focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-50";

const authPrimaryButtonBaseClassName =
  "h-12 rounded-2xl bg-linear-to-r from-blue-600 to-violet-600 text-sm font-black text-white shadow-lg shadow-blue-100 hover:opacity-95 disabled:opacity-60";

export const authPrimaryButtonClassName = `${authPrimaryButtonBaseClassName} w-full`;

/** Geri + Devam Et yan yana — taşmayı önler */
export const authPrimaryButtonInlineClassName = `${authPrimaryButtonBaseClassName} min-w-0 flex-1`;

export const authCardClassName =
  "w-full rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-8";

/** Login / register — düz beyaz panel, kart gölgesi yok */
export const authFlatFormClassName = "w-full";
