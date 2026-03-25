/**
 * Authentication Configuration
 *
 * Simple credentials-based auth for internal use.
 * In production, consider adding:
 * - LDAP/Active Directory integration
 * - Role-based access (Abe = admin, warehouse = viewer)
 * - Session timeout
 */

// Hardcoded users for now — move to database in production
const USERS = [
  { id: "1", username: "abe", password: "dibs2026", name: "Abe", role: "admin" },
  { id: "2", username: "admin", password: "dibs2026", name: "Admin", role: "admin" },
  { id: "3", username: "warehouse", password: "warehouse", name: "Warehouse", role: "viewer" },
];

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export function authenticateUser(username: string, password: string): AuthUser | null {
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}
