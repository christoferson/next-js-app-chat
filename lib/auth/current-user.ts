import 'server-only';

export interface CurrentUser {
  id: string;
  displayName: string;
}

/** Auth seam: v1 returns a stub user. Replace with Auth.js/Cognito later. */
export async function getCurrentUser(): Promise<CurrentUser> {
  return { id: 'local-user', displayName: 'Local User' };
}
