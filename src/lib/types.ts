export type Task = {
  id: string;
  title: string;
  detail: string;
  status: "todo" | "doing" | "done";
  createdAt: number;
  updatedAt: number;
};

export type TaskFormState = {
  title: string;
  detail: string;
  status: "todo" | "doing" | "done";
};
