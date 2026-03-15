import { serve } from "inngest/next";
import { inngest } from "@/lib/workflows/client";
import {
  campaignDispatch,
  missedCallFollowup,
  newLeadFollowup,
  reviewRequest
} from "@/lib/workflows/functions";
import { v2AssignmentSlaWatch, v2ConnectorRunRequested } from "@/lib/workflows/v2-functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [missedCallFollowup, newLeadFollowup, reviewRequest, campaignDispatch, v2ConnectorRunRequested, v2AssignmentSlaWatch]
});
