import { NextResponse } from "next/server";
import {
  createEmployee,
  EmployeeServiceError,
  listEmployees,
} from "@/lib/employee-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") ?? undefined;
    const search = url.searchParams.get("q") ?? undefined;
    const department = url.searchParams.get("department") ?? undefined;
    const employmentType = url.searchParams.get("employmentType") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const hasUserAccountParam = url.searchParams.get("hasUserAccount");
    const sort = url.searchParams.get("sort") ?? undefined;

    const hasUserAccount =
      hasUserAccountParam === "yes"
        ? true
        : hasUserAccountParam === "no"
          ? false
          : undefined;

    const result = await listEmployees({
      companyId: auth.companyId,
      filters: {
        tab,
        search,
        department,
        employmentType: employmentType as never,
        status: status as never,
        hasUserAccount,
        sort,
      },
    });

    return NextResponse.json({
      success: true,
      employees: result.employees,
      summary: result.summary,
    });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEES_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Çalışanlar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const body = await req.json();

    const employee = await createEmployee({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        avatarUrl: body.avatarUrl,
        nationalId: body.nationalId,
        jobTitle: body.jobTitle,
        department: body.department,
        employmentType: body.employmentType,
        startDate: body.startDate,
        endDate: body.endDate,
        birthDate: body.birthDate,
        address: body.address,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        notes: body.notes,
        companyUserId: body.companyUserId,
        salary: body.salary,
      },
    });

    return NextResponse.json({ success: true, employee });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEES_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Çalışan oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
