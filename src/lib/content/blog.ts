export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tag: "Operations" | "Dispatch" | "Revenue" | "Sales" | "Automation" | "Scheduling";
  body: string[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "how-hvac-companies-stop-losing-leads",
    title: "How HVAC Companies Stop Losing Leads",
    date: "2026-02-20",
    tag: "Revenue",
    excerpt: "The lead recovery system top HVAC teams use to convert missed opportunities into booked work.",
    body: [
      "Strong HVAC teams reduce lead loss by shortening response time and keeping the handoff from office to field clear.",
      "A shared inbox, consistent follow-up language, and one owner for next actions prevents leads from getting stuck.",
      "When crews trust dispatch notes and customers get fast replies, conversion improves without extra headcount."
    ]
  },
  {
    slug: "why-missed-calls-cost-home-service-companies-thousands",
    title: "Why Missed Calls Cost Home Service Companies Thousands",
    date: "2026-02-11",
    tag: "Revenue",
    excerpt: "A simple look at how unreturned calls turn into lost jobs and delayed cash flow.",
    body: [
      "Most homeowners call multiple providers. If your team responds slowly, the job often goes to someone else.",
      "Fast acknowledgment, clear service qualification, and immediate scheduling options protect close rates.",
      "Tracking missed calls as a revenue metric helps teams prioritize fixes that move the bottom line."
    ]
  },
  {
    slug: "5-ways-to-improve-technician-scheduling",
    title: "5 Ways to Improve Technician Scheduling",
    date: "2026-01-31",
    tag: "Scheduling",
    excerpt: "Practical scheduling tactics that increase on-time arrival rates and reduce reschedules.",
    body: [
      "Dispatch outcomes improve when windows are realistic and tech availability stays visible in one board.",
      "Offer two customer-friendly time windows, then confirm quickly to avoid uncertainty.",
      "A predictable scheduling rhythm helps reduce office stress and keeps crews productive."
    ]
  },
  {
    slug: "dispatch-workflows-that-scale-without-chaos",
    title: "Dispatch Workflows That Scale Without Chaos",
    date: "2026-01-18",
    tag: "Dispatch",
    excerpt: "A reliable dispatch structure for busy home service teams handling higher lead volume.",
    body: [
      "As volume grows, handoffs break when teams rely on memory or separate tools.",
      "Use clear queue ownership, status standards, and short daily reviews to keep work moving.",
      "Simple processes reduce errors and create better experiences for both customers and crews."
    ]
  },
  {
    slug: "inbox-best-practices-for-service-teams",
    title: "Inbox Best Practices for Service Teams",
    date: "2026-01-06",
    tag: "Operations",
    excerpt: "A cleaner inbox process that helps office teams prioritize high-intent leads first.",
    body: [
      "Inbox quality impacts conversion more than most teams realize.",
      "Set clear response targets by lead type and create templates for common scenarios.",
      "When inbox actions are standardized, teams move faster with fewer mistakes."
    ]
  },
  {
    slug: "how-restoration-teams-win-with-faster-follow-up",
    title: "How Restoration Teams Win With Faster Follow-Up",
    date: "2025-12-22",
    tag: "Automation",
    excerpt: "Restoration companies can improve close rates by tightening the first 15 minutes of response.",
    body: [
      "Urgent jobs reward teams that acknowledge quickly and set expectations early.",
      "A structured first-response flow protects trust and improves conversion under pressure.",
      "The best systems combine speed, clear messaging, and immediate scheduling options."
    ]
  }
];

export function getBlogPosts() {
  return [...blogPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

export function formatBlogDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
