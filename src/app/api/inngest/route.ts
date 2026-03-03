import { serve } from "inngest/next";
import { inngest } from "@/lib/workflows/client";
import {
  campaignDispatch,
  missedCallFollowup,
  newLeadFollowup,
  reviewRequest
} from "@/lib/workflows/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [missedCallFollowup, newLeadFollowup, reviewRequest, campaignDispatch]
});
