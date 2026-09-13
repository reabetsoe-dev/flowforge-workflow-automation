export type UserRole =
  | "ADMINISTRATOR"
  | "WORKFLOW_DESIGNER"
  | "MANAGER"
  | "EMPLOYEE"
  | "AUDITOR";

export type User = {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  department_id: number | null;
  department_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserCreateInput = {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  department_id: number | null;
  active: boolean;
};

export type UserUpdateInput = Partial<UserCreateInput>;

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: User;
};
