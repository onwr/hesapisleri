export type ProductDeleteBlockCode = "SALE_HISTORY" | "TRANSFER_HISTORY";

export type ProductDeleteErrorPayload = {
  code: ProductDeleteBlockCode | "GENERIC";
  message: string;
  saleItemCount?: number;
  transferCount?: number;
};

export function buildProductDeleteHelp(code: ProductDeleteBlockCode) {
  if (code === "SALE_HISTORY") {
    return {
      title: "Satış geçmişi var",
      summary:
        "Bu ürün en az bir satış veya POS kaydında kullanıldığı için kalıcı olarak silinemez.",
      steps: [
        "Satış geçmişi olan ürünler muhasebe ve rapor bütünlüğü için korunur.",
        "Ürünü listeden kaldırmak için Pasife al seçeneğini kullanın; satış kayıtları etkilenmez.",
        "Kalıcı silme yalnızca hiç satılmamış ve depo transferi olmayan ürünlerde mümkündür.",
      ],
      recommendation: "Pasife al",
    };
  }

  return {
    title: "Depo transfer geçmişi var",
    summary:
      "Bu ürün depolar arası transfer kayıtlarında yer aldığı için kalıcı olarak silinemez.",
    steps: [
      "Transfer geçmişi stok izlenebilirliği için saklanır.",
      "Ürünü kullanımdan kaldırmak için Pasife alın.",
      "Kalıcı silme için ürünün transfer ve satış kaydı bulunmamalıdır.",
    ],
    recommendation: "Pasife al",
  };
}
