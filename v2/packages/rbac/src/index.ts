import { PERMISSIONS } from '@ops/shared';

export function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes(PERMISSIONS.SUPER_ALL)) return true;
  if (userPermissions.includes(required)) return true;
  const [dept, resource, action] = required.split('.');
  if (dept && userPermissions.includes(`${dept}.*.*`)) return true;
  if (dept && resource && userPermissions.includes(`${dept}.${resource}.*`)) return true;
  return false;
}

export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}

export function requirePermission(userPermissions: string[], required: string): void {
  if (!hasPermission(userPermissions, required)) {
    const err = new Error('Forbidden');
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
}
