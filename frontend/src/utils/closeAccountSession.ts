interface LogoutActions {
  stopTracking(): Promise<unknown>;
  forgetDevice(): Promise<unknown>;
  revoke(): Promise<{ error: unknown }>;
  clearSession(): void;
}

/** Solo anunciar salida cuando Auth confirmó la eliminación de sus credenciales. */
export async function closeAccountSession(actions: LogoutActions): Promise<boolean> {
  await Promise.allSettled([
    Promise.resolve().then(() => actions.stopTracking()),
    Promise.resolve().then(() => actions.forgetDevice()),
  ]);
  try {
    const { error } = await actions.revoke();
    if (error) return false;
    actions.clearSession();
    return true;
  } catch {
    return false;
  }
}
