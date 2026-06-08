export const loadingPresets = {
  default: {
    title: "Yükleniyor",
    subtitle: "Lütfen bekleyin...",
  },
  login: {
    title: "Giriş yapılıyor",
    subtitle: "Bilgileriniz doğrulanıyor...",
  },
  loginRedirect: {
    title: "Panele yönlendiriliyorsunuz",
    subtitle: "İşletme paneliniz hazırlanıyor...",
  },
  register: {
    title: "Hesap oluşturuluyor",
    subtitle: "Firma ve kullanıcı bilgileriniz kaydediliyor...",
  },
  registerRedirect: {
    title: "Panele yönlendiriliyorsunuz",
    subtitle: "Hesabınız hazır, dashboard açılıyor...",
  },
  dashboard: {
    title: "Dashboard yükleniyor",
    subtitle: "Özet verileriniz getiriliyor...",
  },
  admin: {
    title: "Admin paneli yükleniyor",
    subtitle: "Platform verileri getiriliyor...",
  },
  adminCompanies: {
    title: "Firmalar yükleniyor",
    subtitle: "Platform firmaları getiriliyor...",
  },
  adminCompanyDetail: {
    title: "Firma detayı yükleniyor",
    subtitle: "Firma bilgileri getiriliyor...",
  },
  adminUsers: {
    title: "Kullanıcılar yükleniyor",
    subtitle: "Platform kullanıcıları getiriliyor...",
  },
  adminLogs: {
    title: "Sistem logları yükleniyor",
    subtitle: "İşlem geçmişi getiriliyor...",
  },
  adminPayments: {
    title: "Ödemeler yükleniyor",
    subtitle: "Üyelik ödemeleri getiriliyor...",
  },
  adminUserDetail: {
    title: "Kullanıcı detayı yükleniyor",
    subtitle: "Kullanıcı bilgileri getiriliyor...",
  },
  sales: {
    title: "Satışlar yükleniyor",
    subtitle: "Satış kayıtlarınız hazırlanıyor...",
  },
  saleDetail: {
    title: "Satış detayı yükleniyor",
    subtitle: "Satış bilgileri getiriliyor...",
  },
  pos: {
    title: "POS ekranı hazırlanıyor",
    subtitle: "Ürünler ve müşteriler getiriliyor...",
  },
  customers: {
    title: "Müşteriler yükleniyor",
    subtitle: "Müşteri listesi getiriliyor...",
  },
  customerBulkActions: {
    title: "Toplu işlemler yükleniyor",
    subtitle: "Müşteri grupları ve listeler hazırlanıyor...",
  },
  products: {
    title: "Ürünler yükleniyor",
    subtitle: "Ürün kataloğunuz hazırlanıyor...",
  },
  expenses: {
    title: "Giderler yükleniyor",
    subtitle: "Gider kayıtlarınız getiriliyor...",
  },
  reports: {
    title: "Raporlar yükleniyor",
    subtitle: "Finans özetiniz hazırlanıyor...",
  },
  aiAssistant: {
    title: "AI Asistan yükleniyor",
    subtitle: "Finans verileriniz analiz ediliyor...",
  },
  orders: {
    title: "Siparişler yükleniyor",
    subtitle: "Sipariş ve entegrasyon verileri getiriliyor...",
  },
  stocks: {
    title: "Stoklar yükleniyor",
    subtitle: "Ürün ve stok hareketleri getiriliyor...",
  },
  invoices: {
    title: "Faturalar yükleniyor",
    subtitle: "Fatura kayıtlarınız getiriliyor...",
  },
  cashBank: {
    title: "Kasa & Banka yükleniyor",
    subtitle: "Hesap hareketleriniz hazırlanıyor...",
  },
  settings: {
    title: "Ayarlar yükleniyor",
    subtitle: "Tercihleriniz getiriliyor...",
  },
  notifications: {
    title: "Bildirimler yükleniyor",
    subtitle: "Sistem bildirimleriniz getiriliyor...",
  },
  onboarding: {
    title: "Firma bilgileri yükleniyor",
    subtitle: "Mevcut kayıtlarınız getiriliyor...",
  },
  imageUpload: {
    title: "Görsel yükleniyor",
    subtitle: "Dosyanız CDN'e aktarılıyor, lütfen bekleyin...",
  },
} as const;

export type LoadingPreset = keyof typeof loadingPresets;
