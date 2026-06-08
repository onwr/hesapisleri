import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed başlatıldı...");

  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.membershipPayment.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.accountTransaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.companyUser.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("123456", 10);

  const user = await prisma.user.create({
    data: {
      name: "Ahmet Yılmaz",
      email: "admin@hesapisleri.com",
      password,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const superAdmin = await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "superadmin@hesapisleri.com",
      password,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  const company = await prisma.company.create({
    data: {
      name: "Örnek Ticaret",
      taxNo: "1234567890",
      taxOffice: "Beyoğlu Vergi Dairesi",
      phone: "+90 212 123 45 67",
      email: "info@ornekticaret.com",
      address: "İstiklal Cad. No:123 D:4 Beyoğlu / İstanbul",
      status: "ACTIVE",
    },
  });

  await prisma.companyUser.create({
    data: {
      companyId: company.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
      isOwner: true,
    },
  });

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: "ABC Ltd. Şti.",
        phone: "0532 123 45 67",
        email: "info@abcltd.com",
        taxNo: "1234567890",
        group: "Toptan Müşteri",
        balance: 15750,
        status: "ACTIVE",
      },
    }),
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: "Mehmet Kaya",
        phone: "0541 987 65 43",
        email: "mehmetkaya@gmail.com",
        taxNo: "1234567891",
        group: "Perakende",
        balance: 0,
        status: "ACTIVE",
      },
    }),
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: "Yıldız Day. Tük. Mal.",
        phone: "0533 456 78 90",
        email: "info@yildizday.com",
        taxNo: "9876543210",
        group: "Toptan Müşteri",
        balance: -8450,
        status: "ACTIVE",
      },
    }),
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: "Demir İnşaat Ltd.",
        phone: "0536 111 22 33",
        email: "info@demirinsaat.com",
        taxNo: "1112223334",
        group: "Kurumsal",
        balance: 12300,
        status: "ACTIVE",
      },
    }),
  ]);

  const categories = await Promise.all([
    prisma.productCategory.create({
      data: {
        companyId: company.id,
        name: "Bilgisayar",
        color: "blue",
      },
    }),
    prisma.productCategory.create({
      data: {
        companyId: company.id,
        name: "Telefon",
        color: "purple",
      },
    }),
    prisma.productCategory.create({
      data: {
        companyId: company.id,
        name: "Aksesuar",
        color: "orange",
      },
    }),
    prisma.productCategory.create({
      data: {
        companyId: company.id,
        name: "Kırtasiye",
        color: "green",
      },
    }),
  ]);

  const products = await Promise.all([
    prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: categories[0].id,
        name: "Laptop Lenovo V15",
        sku: "LENOVO-V15-15",
        barcode: "8698756456231",
        stock: 25,
        buyPrice: 17000,
        sellPrice: 21000,
        vatRate: 20,
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: categories[1].id,
        name: "iPhone 13 128GB",
        sku: "IP13-128-BLK",
        barcode: "8698756456232",
        stock: 18,
        buyPrice: 25500,
        sellPrice: 28500,
        vatRate: 20,
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: categories[2].id,
        name: "Logitech Klavye K120",
        sku: "LOG-K120",
        barcode: "8698756456236",
        stock: 8,
        buyPrice: 180,
        sellPrice: 250,
        vatRate: 20,
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: categories[2].id,
        name: "USB 32GB",
        sku: "USB32-3.0",
        barcode: "8698756456240",
        stock: 60,
        buyPrice: 75,
        sellPrice: 120,
        vatRate: 20,
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: categories[3].id,
        name: "A4 Fotokopi Kağıdı",
        sku: "A4-80GR",
        barcode: "8698756456238",
        stock: 120,
        buyPrice: 65,
        sellPrice: 85,
        vatRate: 20,
        status: "ACTIVE",
      },
    }),
  ]);

  const cashAccount = await prisma.account.create({
    data: {
      companyId: company.id,
      type: "CASH",
      name: "Merkez Kasa",
      balance: 12450,
      currency: "TRY",
      status: "ACTIVE",
    },
  });

  const bankAccount1 = await prisma.account.create({
    data: {
      companyId: company.id,
      type: "BANK",
      name: "İş Bankası",
      bankName: "İş Bankası",
      iban: "TR12 0006 4000 0011 1234 5678 90",
      balance: 56750,
      currency: "TRY",
      status: "ACTIVE",
    },
  });

  const bankAccount2 = await prisma.account.create({
    data: {
      companyId: company.id,
      type: "BANK",
      name: "Garanti BBVA",
      bankName: "Garanti BBVA",
      iban: "TR98 0006 2000 0021 9876 5432 10",
      balance: 42300,
      currency: "TRY",
      status: "ACTIVE",
    },
  });

  const sale1 = await prisma.sale.create({
    data: {
      companyId: company.id,
      customerId: customers[0].id,
      userId: user.id,
      saleNo: "S-2026-00123",
      subtotal: 21490,
      vatTotal: 4298,
      discount: 0,
      total: 25788,
      status: "COMPLETED",
      paymentStatus: "PAID",
      note: "Mağaza satışı",
      items: {
        create: [
          {
            productId: products[0].id,
            name: products[0].name,
            quantity: 1,
            unitPrice: 21000,
            vatRate: 20,
            total: 21000,
          },
          {
            productId: products[2].id,
            name: products[2].name,
            quantity: 1,
            unitPrice: 250,
            vatRate: 20,
            total: 250,
          },
          {
            productId: products[3].id,
            name: products[3].name,
            quantity: 2,
            unitPrice: 120,
            vatRate: 20,
            total: 240,
          },
        ],
      },
    },
  });

  const sale2 = await prisma.sale.create({
    data: {
      companyId: company.id,
      customerId: customers[1].id,
      userId: user.id,
      saleNo: "S-2026-00124",
      subtotal: 8750,
      vatTotal: 1750,
      discount: 0,
      total: 10500,
      status: "COMPLETED",
      paymentStatus: "PARTIAL",
      note: "Tahsilat bekliyor",
      items: {
        create: [
          {
            productId: products[1].id,
            name: products[1].name,
            quantity: 1,
            unitPrice: 8750,
            vatRate: 20,
            total: 8750,
          },
        ],
      },
    },
  });

  await prisma.invoice.createMany({
    data: [
      {
        companyId: company.id,
        customerId: customers[0].id,
        saleId: sale1.id,
        invoiceNo: "EFT-2026-00521",
        type: "E_INVOICE",
        status: "SENT",
        total: 15750,
        paymentStatus: "PAID",
        gibStatus: "GONDERILDI",
        gibMessage: "Fatura başarıyla gönderildi.",
      },
      {
        companyId: company.id,
        customerId: customers[1].id,
        invoiceNo: "EAR-2026-00487",
        type: "E_ARCHIVE",
        status: "APPROVED",
        total: 8450,
        paymentStatus: "PARTIAL",
        gibStatus: "ONAY_BEKLIYOR",
        gibMessage: "Fatura onay bekliyor.",
      },
      {
        companyId: company.id,
        customerId: customers[2].id,
        invoiceNo: "EFT-2026-00520",
        type: "E_INVOICE",
        status: "SENT",
        total: 22300,
        paymentStatus: "UNPAID",
        gibStatus: "GONDERILDI",
        gibMessage: "Fatura başarıyla gönderildi.",
      },
      {
        companyId: company.id,
        customerId: customers[3].id,
        invoiceNo: "EAR-2026-00486",
        type: "E_ARCHIVE",
        status: "DRAFT",
        total: 12300,
        paymentStatus: "UNPAID",
        gibStatus: "TASLAK",
        gibMessage: "Taslak olarak kaydedildi.",
      },
    ],
  });

  await prisma.expense.createMany({
    data: [
      {
        companyId: company.id,
        userId: user.id,
        title: "Kira Ödemesi",
        category: "Kira",
        supplier: "Meral Apt. No:5",
        amount: 15000,
        status: "APPROVED",
      },
      {
        companyId: company.id,
        userId: user.id,
        title: "Elektrik Faturası",
        category: "Fatura",
        supplier: "CK Enerji",
        amount: 2450,
        status: "APPROVED",
      },
      {
        companyId: company.id,
        userId: user.id,
        title: "Ofis Malzemeleri",
        category: "Ofis Giderleri",
        supplier: "Vatan Kırtasiye",
        amount: 850,
        status: "APPROVED",
      },
      {
        companyId: company.id,
        userId: user.id,
        title: "Reklam Gideri",
        category: "Reklam",
        supplier: "Meta Platforms",
        amount: 1350,
        status: "APPROVED",
      },
    ],
  });

  await prisma.accountTransaction.createMany({
    data: [
      {
        accountId: cashAccount.id,
        type: "COLLECTION",
        title: "Tahsilat - ABC Ltd. Şti.",
        amount: 5000,
      },
      {
        accountId: bankAccount1.id,
        type: "PAYMENT",
        title: "Ödeme - Vatan Kırtasiye",
        amount: 850,
      },
      {
        accountId: bankAccount2.id,
        type: "TRANSFER",
        title: "Garanti’den kasaya transfer",
        amount: 3000,
      },
    ],
  });

  await prisma.stockMovement.createMany({
    data: [
      {
        companyId: company.id,
        productId: products[0].id,
        type: "SALE",
        quantity: -1,
        note: "Satıştan stok düşüldü.",
      },
      {
        companyId: company.id,
        productId: products[2].id,
        type: "SALE",
        quantity: -1,
        note: "Satıştan stok düşüldü.",
      },
      {
        companyId: company.id,
        productId: products[3].id,
        type: "SALE",
        quantity: -2,
        note: "Satıştan stok düşüldü.",
      },
      {
        companyId: company.id,
        productId: products[4].id,
        type: "IN",
        quantity: 50,
        note: "Yeni stok girişi.",
      },
    ],
  });

  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  await prisma.membershipPayment.create({
    data: {
      companyId: company.id,
      periodStart: now,
      periodEnd: nextMonth,
      amount: 1499,
      status: "PAID",
      provider: "PayTR",
      paymentRef: "PAYTR-DEMO-001",
      paidAt: now,
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        companyId: company.id,
        userId: user.id,
        type: "SUCCESS",
        title: "e-Fatura gönderildi",
        message: "EFT-2026-00521 numaralı e-Fatura başarıyla gönderildi.",
      },
      {
        companyId: company.id,
        userId: user.id,
        type: "WARNING",
        title: "Stok seviyesi düşük",
        message: "Logitech Klavye K120 ürünü kritik stok seviyesine yaklaştı.",
      },
      {
        companyId: company.id,
        userId: user.id,
        type: "INFO",
        title: "Yeni satış oluşturuldu",
        message: "S-2026-00123 numaralı satış başarıyla oluşturuldu.",
      },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      {
        companyId: company.id,
        userId: user.id,
        action: "CREATE",
        module: "sales",
        message: "Yeni satış oluşturuldu.",
        ip: "127.0.0.1",
      },
      {
        companyId: company.id,
        userId: user.id,
        action: "SEND",
        module: "e-invoice",
        message: "e-Fatura gönderildi.",
        ip: "127.0.0.1",
      },
      {
        companyId: company.id,
        userId: superAdmin.id,
        action: "LOGIN",
        module: "admin",
        message: "Super admin giriş yaptı.",
        ip: "127.0.0.1",
      },
    ],
  });

  console.log("Seed tamamlandı.");
  console.log("Demo kullanıcı: admin@hesapisleri.com");
  console.log("Demo şifre: 123456");
  console.log("Super admin: superadmin@hesapisleri.com");
  console.log("Super admin şifre: 123456");
}

main()
  .catch((error) => {
    console.error("Seed hatası:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });