"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = InboxPage;
const lucide_react_1 = require("lucide-react");
const page_header_1 = require("@/components/ui/page-header");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const empty_state_1 = require("@/components/ui/empty-state");
const textarea_1 = require("@/components/ui/textarea");
const conversations = [
    { id: "c1", name: "James Roper", channel: "SMS", lastMessage: "Can someone come this afternoon?", unread: true },
    { id: "c2", name: "Maria Fernandez", channel: "Email", lastMessage: "Photos attached. Please quote this.", unread: false },
    { id: "c3", name: "Chris Parker", channel: "SMS", lastMessage: "Tomorrow morning works.", unread: false }
];
function InboxPage() {
    return (<div className="space-y-6">
      <page_header_1.PageHeader title="Inbox" subtitle="Reply quickly and keep conversations tied to leads and jobs."/>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <card_1.Card>
          <card_1.CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Threads</h2>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-3">
            {conversations.map((thread) => (<article key={thread.id} className="rounded-xl border border-semantic-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-semantic-text">{thread.name}</p>
                  <badge_1.Badge variant={thread.channel === "SMS" ? "brand" : "default"}>{thread.channel}</badge_1.Badge>
                </div>
                <p className="mt-2 text-sm text-semantic-muted">{thread.lastMessage}</p>
                {thread.unread && (<p className="mt-2 text-xs font-semibold uppercase tracking-wide text-accent-600">Unread</p>)}
              </article>))}
          </card_1.CardBody>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Conversation</h2>
          </card_1.CardHeader>
          <card_1.CardBody className="space-y-4">
            <div className="space-y-3">
              <div className="max-w-[80%] rounded-2xl bg-semantic-surface2 px-4 py-3 text-sm text-semantic-text">
                Can someone come this afternoon? AC unit is warm.
              </div>
              <div className="ml-auto max-w-[80%] rounded-2xl bg-semantic-brand px-4 py-3 text-sm text-white">
                Yes, we can send a tech between 3-5PM. Does that work?
              </div>
            </div>
            <div className="flex gap-2">
              <button_1.Button variant="secondary">
                <lucide_react_1.MessageSquare className="h-4 w-4"/> SMS
              </button_1.Button>
              <button_1.Button variant="secondary">
                <lucide_react_1.Mail className="h-4 w-4"/> Email
              </button_1.Button>
            </div>
            <div className="space-y-2">
              <textarea_1.Textarea rows={4} placeholder="Type your reply..."/>
              <button_1.Button size="lg">
                <lucide_react_1.Send className="h-4 w-4"/>
                Send reply
              </button_1.Button>
            </div>
          </card_1.CardBody>
        </card_1.Card>
      </div>

      <empty_state_1.EmptyState icon={<lucide_react_1.Inbox className="h-5 w-5"/>} title="No unresolved escalations" description="Escalated conversations from low ratings or failed deliveries will appear here."/>
    </div>);
}
