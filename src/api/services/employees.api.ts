import { apiClient, query } from '../client';
import { Employee, EmployeePayload, EmployeePermissions } from '../types';

export const employeesApi = {
  /**
   * The store comes from `user.storeId` (resolved by /auth/me). The web app
   * instead fetches every store and matches `s.userId === user.id`, which is a
   * needless round-trip.
   */
  listByStore(storeId: string, skip = 0, take = 1000) {
    return apiClient.get<Employee[]>(`/employees/store/${storeId}${query({ skip, take })}`);
  },

  getById(id: string) {
    return apiClient.get<Employee>(`/employees/${id}`);
  },

  /** Also creates the linked User account with role `employee`. */
  create(storeId: string, payload: EmployeePayload) {
    return apiClient.post<Employee>(`/employees/store/${storeId}`, payload);
  },

  /** `isActive` is routed to the linked User — Employee has no such column. */
  update(id: string, payload: Partial<EmployeePayload>) {
    return apiClient.patch<Employee>(`/employees/${id}`, payload);
  },

  remove(id: string) {
    return apiClient.delete<void>(`/employees/${id}`);
  },

  /**
   * What this employee holds, plus what may still be assigned.
   *
   * `grantable` comes from the server rather than being derived here, so the
   * per-designation rules live in one place — an app release is not needed for
   * a change to them to take effect.
   */
  permissions(id: string) {
    return apiClient.get<EmployeePermissions>(`/employees/${id}/permissions`);
  },

  /** Owner only. Replaces the whole set; the base module cannot be revoked. */
  setPermissions(id: string, permissions: string[]) {
    return apiClient.patch<EmployeePermissions>(`/employees/${id}/permissions`, { permissions });
  },
};
