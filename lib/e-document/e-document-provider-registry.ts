import type { EDocumentProvider } from "@prisma/client";

export type EDocumentProviderMeta = {
  code: EDocumentProvider;
  label: string;
  description: string;
  connectionReady: boolean;
  selectable: boolean;
};

export const E_DOCUMENT_PROVIDERS: EDocumentProviderMeta[] = [
  {
    code: "EFINANS",
    label: "eFinans",
    description: "Kullanıcı adı, şifre ve firma kodu ile bağlantı",
    connectionReady: false,
    selectable: true,
  },
  {
    code: "TRENDYOL_EFATURAM",
    label: "Trendyol E-Faturam",
    description: "Trendyol E-Faturam panel e-postası ve şifresi ile bağlantı",
    connectionReady: true,
    selectable: true,
  },
  {
    code: "OTHER",
    label: "Diğer / Yakında",
    description: "Diğer sağlayıcılar yakında eklenecek",
    connectionReady: false,
    selectable: true,
  },
];

export function getEDocumentProviderMeta(provider: EDocumentProvider) {
  return (
    E_DOCUMENT_PROVIDERS.find((item) => item.code === provider) ??
    E_DOCUMENT_PROVIDERS[2]
  );
}

export function isEDocumentProviderConnectionReady(provider: EDocumentProvider) {
  return getEDocumentProviderMeta(provider).connectionReady;
}
