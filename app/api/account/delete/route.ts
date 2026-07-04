import { getServiceClient } from "../../billing/_lib";
import { optionsResponse, pulseError, pulseJson, resolvePulseSession } from "../../pulse/_lib";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { user } = await resolvePulseSession({
      accessToken: body?.accessToken,
      refreshToken: body?.refreshToken,
    });
    const userId = String(user.id || "").trim();
    if (!userId) throw new Error("Could not determine the signed-in account.");

    const service = getServiceClient();
    const deleteUser = await service.auth.admin.deleteUser(userId);
    if (deleteUser.error) throw new Error(deleteUser.error.message);

    // auth.users cascades into profiles, but this keeps the account-profile
    // cleanup explicit if the schema is ever copied without that FK.
    const profileDelete = await service.from("profiles").delete().eq("user_id", userId);
    if (profileDelete.error) throw new Error(profileDelete.error.message);

    return pulseJson({ ok: true });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error || "Could not delete account.");
    const status = /login required|expired|sign in/i.test(message) ? 401 : 400;
    return pulseError(message, status);
  }
}
