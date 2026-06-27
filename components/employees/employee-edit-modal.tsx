"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { EmployeeAvatar } from "@/components/employees/employee-avatar";
import { EmployeeDepartmentSelect } from "@/components/employees/employee-department-select";
import {
  EMPLOYEE_AVATAR_UPLOAD_FOLDER,
} from "@/lib/employee-pos-utils";
import { uploadImageToCdn } from "@/lib/storage/upload-client";
import { usePlatformUploadLimits } from "@/components/platform-runtime/platform-runtime-provider";
import type { SerializedEmployee } from "@/lib/employee-page-types";

type EmployeeEditModalProps = {
  open: boolean;
  saving: boolean;
  employee: SerializedEmployee | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

export function EmployeeEditModal({
  open,
  saving,
  employee,
  onClose,
  onSubmit,
}: EmployeeEditModalProps) {
  const { maxImageBytes } = usePlatformUploadLimits();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [legacyDepartment, setLegacyDepartment] = useState<string | null>(null);
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!employee) return;
    setFirstName(employee.firstName);
    setLastName(employee.lastName);
    setEmail(employee.email ?? "");
    setPhone(employee.phone ?? "");
    setJobTitle(employee.jobTitle ?? "");
    setDepartmentId(employee.departmentId ?? "");
    setLegacyDepartment(
      employee.departmentInfo?.isLegacy ? employee.departmentInfo.name : null
    );
    setEmploymentType(employee.employmentType);
    setAvatarUrl(employee.avatarUrl);
    setUploadError("");
  }, [employee]);

  if (!open || !employee) return null;

  async function handlePhotoChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadImageToCdn(file, EMPLOYEE_AVATAR_UPLOAD_FOLDER, maxImageBytes);
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
    await onSubmit({
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      jobTitle: jobTitle || null,
      departmentId: departmentId || null,
      employmentType,
      avatarUrl,
    });
  }

  const inputClass =
    "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        className={[TEAM_CARD_CLASS, "w-full max-w-xl overflow-hidden"].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-black text-[#0f1f4d]">Çalışanı Düzenle</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <EmployeeAvatar
              name={`${firstName} ${lastName}`.trim() || employee.fullName}
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
                <p className="text-xs font-semibold text-red-600">{uploadError}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-500">Ad</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-500">Soyad</span>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-500">Görev</span>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-bold text-slate-500">Departman</span>
              <EmployeeDepartmentSelect
                value={departmentId}
                legacyDepartment={legacyDepartment}
                onChange={setDepartmentId}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">İstihdam tipi</span>
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
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-black text-slate-500"
          >
            İptal
          </button>
          <button
            type="button"
            disabled={saving || uploading}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
