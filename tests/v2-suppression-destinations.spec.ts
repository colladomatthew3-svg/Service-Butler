import { expect, test } from "@playwright/test";
import { extractLeadChannelDestination, normalizeDestinationForChannel } from "../src/lib/v2/contact-destinations";

test("suppression destination normalization uses canonical phone and email values", async () => {
  expect(normalizeDestinationForChannel("sms", "(631) 555-0199")).toBe("+16315550199");
  expect(normalizeDestinationForChannel("voice", "+1 631 555 0199")).toBe("+16315550199");
  expect(normalizeDestinationForChannel("email", " Ops@Example.com ")).toBe("ops@example.com");
});

test("suppression destination extraction pulls the correct lead channel value", async () => {
  const channels = {
    phone: "(631) 555-0199",
    email: "dispatch@example.com"
  };

  expect(extractLeadChannelDestination("sms", channels)).toBe("+16315550199");
  expect(extractLeadChannelDestination("voice", channels)).toBe("+16315550199");
  expect(extractLeadChannelDestination("email", channels)).toBe("dispatch@example.com");
  expect(extractLeadChannelDestination("crm_task", channels)).toBeNull();
});
