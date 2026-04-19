export type Task = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  title: string;
  detail: string;
  status: "todo" | "doing" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string;
  attachmentUrl: string;
  attachmentName: string;
  attachmentPath: string;
  createdAt: number;
  updatedAt: number;
};

export type TaskFormState = {
  title: string;
  detail: string;
  status: "todo" | "doing" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string;
};
