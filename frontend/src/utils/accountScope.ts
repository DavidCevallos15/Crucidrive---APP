/** Una respuesta solo pertenece a la sesión que inició su petición. */
export function captureAccountScope(read: () => { authGeneration: number; user: { id: string } | null }) {
  const { authGeneration, user } = read();
  return {
    userId: user?.id,
    isCurrent: () => {
      const current = read();
      return Boolean(user && current.user?.id === user.id && current.authGeneration === authGeneration);
    },
  };
}
