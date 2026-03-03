import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "servicebutler",
  eventKey: process.env.INNGEST_EVENT_KEY
});
