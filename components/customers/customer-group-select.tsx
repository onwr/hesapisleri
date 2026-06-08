"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

type CustomerGroupOption = {
  name: string;
  color?: string | null;
};

type CustomerGroupSelectProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function CustomerGroupSelect({
  value,
  onChange,
  error,
}: CustomerGroupSelectProps) {
  const [groups, setGroups] = useState<CustomerGroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGroups() {
      try {
        const response = await fetch("/api/customers/groups");
        const result = (await response.json()) as {
          success?: boolean;
          data?: CustomerGroupOption[];
        };

        if (response.ok && result.success && result.data) {
          setGroups(result.data.map((group) => ({ name: group.name, color: group.color })));
        }
      } catch {
        setGroups([{ name: "Genel" }]);
      } finally {
        setLoading(false);
      }
    }

    void loadGroups();
  }, []);

  const selectedValue = value || "Genel";

  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        Müşteri Grubu
      </label>

      <div className="relative mt-2">
        <select
          value={selectedValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={loading}
          className={[
            "h-12 w-full appearance-none rounded-2xl border bg-white px-4 pr-10 text-[13px] font-bold text-[#0f1f4d] outline-none transition focus:ring-4",
            error
              ? "border-rose-200 focus:border-rose-300 focus:ring-rose-50"
              : "border-slate-200 focus:border-blue-200 focus:ring-blue-50",
          ].join(" ")}
        >
          {groups.length === 0 ? <option value="Genel">Genel</option> : null}

          {groups.map((group) => (
            <option key={group.name} value={group.name}>
              {group.name}
            </option>
          ))}

          {selectedValue &&
          !groups.some((group) => group.name === selectedValue) ? (
            <option value={selectedValue}>{selectedValue}</option>
          ) : null}
        </select>

        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      {error ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{error}</p>
      ) : null}
    </div>
  );
}
