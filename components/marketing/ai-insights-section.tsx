const INSIGHT_CARDS = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: "Tahsilat Performansı",
    value: "%86",
    unit: "tahsil oranı",
    trend: "+4%",
    trendUp: true,
    trendLabel: "geçen aya göre",
    desc: "Son 30 günde kesilen faturaların tahsilat oranı ve vadesi geçen belgeler.",
    color: "emerald",
    bar: 86,
    sparkline: [55, 60, 58, 70, 74, 78, 82, 80, 86],
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    label: "Nakit Akışı",
    value: "₺48.320",
    unit: "cari bakiye",
    trend: "+₺6.840",
    trendUp: true,
    trendLabel: "bu hafta girdi",
    desc: "Kasa ve banka hesaplarınızın anlık toplamı. Giren ve çıkan hareketler.",
    color: "blue",
    bar: 68,
    sparkline: [30, 38, 35, 42, 48, 45, 52, 58, 68],
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
      </svg>
    ),
    label: "En Çok Satan",
    value: "Elektronik",
    unit: "kategori — bu ay",
    trend: "142 adet",
    trendUp: true,
    trendLabel: "satış adedi",
    desc: "Bu ay en fazla ciro getiren ürün grubu. Satış adedi ve kâr marjı.",
    color: "violet",
    bar: 74,
    sparkline: [40, 50, 48, 60, 65, 62, 70, 72, 74],
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: "Geciken Ödemeler",
    value: "3 belge",
    unit: "vadesi geçmiş",
    trend: "−1",
    trendUp: true,
    trendLabel: "geçen haftaya göre",
    desc: "Vadesi geçmiş faturalar ve tahsilat takibi. Müşteri bazında gecikme süresi.",
    color: "amber",
    bar: 30,
    sparkline: [70, 65, 60, 55, 50, 45, 42, 38, 30],
  },
];

const COLOR = {
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", bar: "bg-emerald-500", val: "text-emerald-700", spark: "#10b981" },
  blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    bar: "bg-blue-500",    val: "text-blue-700",    spark: "#3b82f6" },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  bar: "bg-violet-500",  val: "text-violet-700",  spark: "#8b5cf6" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   bar: "bg-amber-500",   val: "text-amber-700",   spark: "#f59e0b" },
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const path = `M${pts.join(" L")}`;
  const area = `M0,${h} L${pts.join(" L")} L${w},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2" fill={color} />
    </svg>
  );
}

export function AiInsightsSection() {
  return (
    <section id="ozellikler" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">
            İşletme Özeti
          </p>
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            İşletme verilerinizi daha kolay yorumlayın
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Satış, tahsilat, stok ve finans verilerinizden oluşturulan anlaşılır özetlerle
            önemli gelişmeleri tek ekranda görün.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {INSIGHT_CARDS.map((card) => {
            const c = COLOR[card.color as keyof typeof COLOR];
            return (
              <div
                key={card.label}
                className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.bg} ${c.icon}`}>
                    {card.icon}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 rounded-full border border-slate-200 px-2 py-0.5">
                    Demo
                  </span>
                </div>

                {/* Label */}
                <p className="text-xs font-semibold text-slate-500 mb-1">{card.label}</p>

                {/* Value */}
                <p className={`text-2xl font-extrabold ${c.val} leading-tight`}>{card.value}</p>
                <p className="text-[11px] text-slate-400 mb-3">{card.unit}</p>

                {/* Trend */}
                <div className="flex items-center gap-1 mb-4">
                  <span className={`text-xs font-bold ${card.trendUp ? "text-emerald-600" : "text-rose-500"}`}>
                    {card.trendUp ? "↑" : "↓"} {card.trend}
                  </span>
                  <span className="text-[11px] text-slate-400">{card.trendLabel}</span>
                </div>

                {/* Sparkline */}
                <div className="mb-3">
                  <Sparkline data={card.sparkline} color={c.spark} />
                </div>

                {/* Progress */}
                <div className="mt-auto">
                  <div className="h-1 w-full rounded-full bg-slate-100 mb-3">
                    <div
                      className={`h-1 rounded-full ${c.bar}`}
                      style={{ width: `${card.bar}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Demo verilerdir. Gerçek hesabınızda kendi işletme verileriniz görünür.
        </p>
      </div>
    </section>
  );
}
