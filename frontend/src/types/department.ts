export type Department = {
  id: number;
  name: string;
  description: string | null;
  user_count: number;
  created_at: string;
  updated_at: string;
};

export type DepartmentCreateInput = {
  name: string;
  description: string | null;
};

export type DepartmentUpdateInput = Partial<DepartmentCreateInput>;
