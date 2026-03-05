import { Inbox, Mail, MessageSquare, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";

const conversations = [
  { id: "c1", name: "James Roper", channel: "SMS", lastMessage: "Can someone come this afternoon?", unread: true },
  { id: "c2", name: "Maria Fernandez", channel: "Email", lastMessage: "Photos attached. Please quote this.", unread: false },
  { id: "c3", name: "Chris Parker", channel: "SMS", lastMessage: "Tomorrow morning works.", unread: false }
];

export default function InboxPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Inbox" subtitle="Reply quickly and keep conversations tied to leads and jobs." />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Threads</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {conversations.map((thread) => (
              <article key={thread.id} className="rounded-xl border border-semantic-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-semantic-text">{thread.name}</p>
                  <Badge variant={thread.channel === "SMS" ? "brand" : "default"}>{thread.channel}</Badge>
                </div>
                <p className="mt-2 text-sm text-semantic-muted">{thread.lastMessage}</p>
                {thread.unread && (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-accent-600">Unread</p>
                )}
              </article>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="dashboard-section-title text-semantic-text">Conversation</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-3">
              <div className="max-w-[80%] rounded-2xl bg-semantic-surface2 px-4 py-3 text-sm text-semantic-text">
                Can someone come this afternoon? AC unit is warm.
              </div>
              <div className="ml-auto max-w-[80%] rounded-2xl bg-semantic-brand px-4 py-3 text-sm text-white">
                Yes, we can send a tech between 3-5PM. Does that work?
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary">
                <MessageSquare className="h-4 w-4" /> SMS
              </Button>
              <Button variant="secondary">
                <Mail className="h-4 w-4" /> Email
              </Button>
            </div>
            <div className="space-y-2">
              <Textarea rows={4} placeholder="Type your reply..." />
              <Button size="lg">
                <Send className="h-4 w-4" />
                Send reply
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <EmptyState
        icon={<Inbox className="h-5 w-5" />}
        title="No unresolved escalations"
        description="Escalated conversations from low ratings or failed deliveries will appear here."
      />
    </div>
  );
}
