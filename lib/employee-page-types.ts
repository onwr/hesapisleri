import type { serializeEmployee } from "@/lib/employee-service";

export type SerializedEmployee = ReturnType<typeof serializeEmployee>;
