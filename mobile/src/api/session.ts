// Holds the backend JWT for the current app session. In memory only: the user signs in
// again after a restart. Moving this to expo-secure-store is the next step.
let token: string | null = null;

export function setToken(value: string | null) {
  token = value;
}

export function getToken(): string {
  return token ?? "";
}
