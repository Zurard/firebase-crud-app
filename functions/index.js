const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");

initializeApp();
const db = getFirestore();

const writeActivity = async ({ type, taskId, payload }) => {
  await db.collection("activity").add({
    type,
    taskId,
    ownerId: payload.ownerId || null,
    title: payload.title || "",
    status: payload.status || "",
    priority: payload.priority || "",
    timestamp: Date.now(),
  });
};

exports.logTaskCreated = onDocumentCreated("tasks/{taskId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  await writeActivity({
    type: "task_created",
    taskId: event.params.taskId,
    payload: data,
  });
});

exports.logTaskUpdated = onDocumentUpdated("tasks/{taskId}", async (event) => {
  const data = event.data?.after?.data();
  if (!data) return;

  await writeActivity({
    type: "task_updated",
    taskId: event.params.taskId,
    payload: data,
  });
});

exports.logTaskDeleted = onDocumentDeleted("tasks/{taskId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  await writeActivity({
    type: "task_deleted",
    taskId: event.params.taskId,
    payload: data,
  });
});
