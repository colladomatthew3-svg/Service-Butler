import { expect, test } from "@playwright/test";
import { applyAssignmentWebhookStatus } from "../src/lib/v2/assignment-webhook";

test("assignment webhook uses transition flow for rejected assignments", async () => {
  let transitionCalls = 0;

  const result = await applyAssignmentWebhookStatus({
    supabase: {} as never,
    tenantId: "tenant-1",
    assignmentId: "assignment-1",
    status: "rejected",
    transitionAssignment: async (input) => {
      transitionCalls += 1;
      expect(input.action).toBe("reject");
      return {
        id: String(input.assignmentId),
        status: "escalated"
      } as never;
    }
  });

  expect(transitionCalls).toBe(1);
  expect(result.assignment.status).toBe("escalated");
});

test("assignment webhook uses transition flow for accepted assignments", async () => {
  let transitionCalls = 0;

  const result = await applyAssignmentWebhookStatus({
    supabase: {} as never,
    tenantId: "tenant-1",
    assignmentId: "assignment-2",
    status: "accepted",
    transitionAssignment: async (input) => {
      transitionCalls += 1;
      expect(input.action).toBe("accept");
      return {
        id: String(input.assignmentId),
        status: "accepted"
      } as never;
    }
  });

  expect(transitionCalls).toBe(1);
  expect(result.assignment.status).toBe("accepted");
});
