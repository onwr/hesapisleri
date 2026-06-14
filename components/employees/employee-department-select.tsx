"use client";

import { useEffect, useState } from "react";
import type { SerializedEmployeeDepartment } from "@/lib/employee-department-utils";

type EmployeeDepartmentSelectProps = {
  value: string;
  legacyDepartment?: string | null;
  onChange: (departmentId: string) => void;
  disabled?: boolean;
  className?: string;
};

export function EmployeeDepartmentSelect({
  value,
  legacyDepartment,
  onChange,
  disabled = false,
  className = "",
}: EmployeeDepartmentSelectProps) {
  const [departments, setDepartments] = useState<SerializedEmployeeDepartment[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/employees/departments")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && Array.isArray(json.departments)) {
          setDepartments(json.departments);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const hasLegacy =
    legacyDepartment &&
    !departments.some(
      (d) => d.name.toLowerCase() === legacyDepartment.toLowerCase()
    );

  return (
    <div className="space-y-1">
      <select
        value={value}
        disabled={disabled || loading}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        <option value="">Departman yok</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
      {hasLegacy ? (
        <p className="text-[11px] font-semibold text-amber-700">
          Eski departman: {legacyDepartment}
        </p>
      ) : null}
    </div>
  );
}
