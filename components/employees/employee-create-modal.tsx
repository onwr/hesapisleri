"use client";

import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { EmployeeAvatar } from "@/components/employees/employee-avatar";
import { EmployeeDepartmentSelect } from "@/components/employees/employee-department-select";
import { EMPLOYEE_AVATAR_UPLOAD_FOLDER } from "@/lib/employee-pos-utils";
import { uploadImageToCdn } from "@/lib/storage/upload-client";

type EmployeeCreateModalProps = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

const STEPS = ["Kimlik & Fotoğraf", "İş Bilgileri", "Maaş", "Özet"];

export function EmployeeCreateModal({
  open,
  saving,
  onClose,
  onSubmit,
}: EmployeeCreateModalProps) {
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [startDate, setStartDate] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState("MONTHLY");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  if (!open) return null;

  function resetAndClose() {
    setStep(0);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setAvatarUrl(null);
    setJobTitle("");
    setDepartmentId("");
    setEmploymentType("FULL_TIME");
    setStartDate("");
    setSalaryAmount("");
    setSalaryPeriod("MONTHLY");
    setUploadError("");
    onClose();
  }

  async function handlePhotoChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadImageToCdn(file, EMPLOYEE_AVATAR_UPLOAD_FOLDER);
      setAvatarUrl(url);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Fotoğraf yüklenemedi."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      email: email || undefined,
      phone: phone || undefined,
      avatarUrl: avatarUrl || undefined,
      jobTitle: jobTitle || undefined,
      departmentId: departmentId || null,
      employmentType,
      startDate: startDate || undefined,
    };

    if (salaryAmount && Number(salaryAmount) > 0) {
      payload.salary = {
        amount: Number(salaryAmount),
        period: salaryPeriod,
        currency: "TRY",
      };
    }

    await onSubmit(payload);
    resetAndClose();
  }

  const inputClass =
    "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        className={[TEAM_CARD_CLASS, "w-full max-w-xl overflow-hidden"].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Adım {step + 1} / {STEPS.length}
            </p>
            <h2 className="text-lg font-black text-[#0f1f4d]">
              {STEPS[step]}
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {step === 0 ? (
            <>
              <div className="flex items-center gap-4">
                <EmployeeAvatar
                  name={`${firstName} ${lastName}`.trim() || "Yeni Çalışan"}
                  avatarUrl={avatarUrl}
                  size="lg"
                />
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-[#0f1f4d] hover:bg-slate-50">
                    <Upload size={14} />
                    {uploading ? "Yükleniyor..." : "Fotoğraf yükle"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploading || saving}
                      onChange={(event) =>
                        handlePhotoChange(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  {avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="block text-xs font-bold text-red-600"
                    >
                      Fotoğrafı kaldır
                    </button>
                  ) : null}
                  {uploadError ? (
                    <p className="text-xs font-semibold text-red-600">
                      {uploadError}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-slate-500">Ad *</span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-slate-500">
                    Soyad *
                  </span>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">E-posta</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Telefon</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </label>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Görev</span>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">
                  Departman
                </span>
                <EmployeeDepartmentSelect
                  value={departmentId}
                  onChange={setDepartmentId}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">
                  İstihdam tipi
                </span>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className={inputClass}
                >
                  <option value="FULL_TIME">Tam zamanlı</option>
                  <option value="PART_TIME">Yarı zamanlı</option>
                  <option value="CONTRACTOR">Sözleşmeli</option>
                  <option value="INTERN">Stajyer</option>
                  <option value="SEASONAL">Mevsimlik</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">
                  İşe başlama
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="text-xs font-semibold text-slate-500">
                Maaş bilgileri sadece yetkili kişiler tarafından görüntülenir.
              </p>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">
                  Maaş tutarı (TRY)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  className={inputClass}
                  placeholder="Opsiyonel"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Periyot</span>
                <select
                  value={salaryPeriod}
                  onChange={(e) => setSalaryPeriod(e.target.value)}
                  className={inputClass}
                >
                  <option value="MONTHLY">Aylık</option>
                  <option value="WEEKLY">Haftalık</option>
                  <option value="DAILY">Günlük</option>
                  <option value="HOURLY">Saatlik</option>
                </select>
              </label>
            </>
          ) : null}

          {step === 3 ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
              <p>
                <span className="font-bold">Ad Soyad:</span> {firstName}{" "}
                {lastName}
              </p>
              <p>
                <span className="font-bold">Görev:</span>{" "}
                {jobTitle || "—"} / {departmentId ? "Seçili departman" : "—"}
              </p>
              <p>
                <span className="font-bold">Maaş:</span>{" "}
                {salaryAmount ? `₺${salaryAmount} (${salaryPeriod})` : "—"}
              </p>
              <p>
                <span className="font-bold">Fotoğraf:</span>{" "}
                {avatarUrl ? "Eklenecek" : "Yok"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-between border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            disabled={step === 0 || saving}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-xl px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-40"
          >
            Geri
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={step === 0 && !firstName && !lastName}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl bg-[#0f1f4d] px-4 py-2 text-xs font-black text-white disabled:opacity-40"
            >
              İleri
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || uploading || (!firstName && !lastName)}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 py-2 text-xs font-black text-white disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Çalışanı Oluştur
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
