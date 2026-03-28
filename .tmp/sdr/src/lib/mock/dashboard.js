"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.urgencyFilters = exports.statusFilters = exports.serviceTypes = exports.mockJobs = exports.mockLeads = void 0;
exports.findLeadById = findLeadById;
exports.mockLeads = [
    {
        id: "l-1001",
        name: "James Roper",
        phone: "+1 (813) 555-0182",
        serviceType: "HVAC",
        urgency: "HIGH",
        location: "Tampa, FL",
        status: "NEW",
        lastContact: "6 min ago",
        nextStep: "Call back in 10 min",
        notes: ["AC stopped blowing cold air", "Available today after 3PM"],
        timeline: [
            { time: "09:12 AM", label: "Inbound call missed", detail: "Call lasted 22 seconds before voicemail." },
            { time: "09:13 AM", label: "Auto SMS sent", detail: "Asked for issue details and best callback time." }
        ]
    },
    {
        id: "l-1002",
        name: "Maria Fernandez",
        phone: "+1 (407) 555-0150",
        serviceType: "Plumbing",
        urgency: "MEDIUM",
        location: "Orlando, FL",
        status: "QUALIFIED",
        lastContact: "42 min ago",
        nextStep: "Send estimate",
        notes: ["Kitchen sink backing up", "Prefers text only"],
        timeline: [
            { time: "08:40 AM", label: "Lead captured", detail: "Website form submitted." },
            { time: "08:50 AM", label: "Dispatcher replied", detail: "Requested photos of under-sink plumbing." }
        ]
    },
    {
        id: "l-1003",
        name: "Chris Parker",
        phone: "+1 (904) 555-0134",
        serviceType: "Roofing",
        urgency: "HIGH",
        location: "Jacksonville, FL",
        status: "SCHEDULED",
        lastContact: "1 hr ago",
        nextStep: "Confirm arrival window",
        notes: ["Storm leak near chimney", "Insurance claim started"],
        timeline: [
            { time: "07:52 AM", label: "Inbound SMS", detail: "Customer sent roof leak photos." },
            { time: "08:10 AM", label: "Job scheduled", detail: "Booked for tomorrow 9:00-11:00 AM." }
        ]
    },
    {
        id: "l-1004",
        name: "Lana Brooks",
        phone: "+1 (727) 555-0198",
        serviceType: "Electrical",
        urgency: "LOW",
        location: "St. Petersburg, FL",
        status: "CONTACTED",
        lastContact: "2 hrs ago",
        nextStep: "Follow up by email",
        notes: ["Need EV charger install", "HOA approval pending"],
        timeline: [{ time: "06:55 AM", label: "Lead captured", detail: "Facebook ad form imported." }]
    }
];
exports.mockJobs = [
    {
        id: "j-501",
        customer: "Chris Parker",
        serviceType: "Roofing repair",
        tech: "D. Nguyen",
        startWindow: "Tomorrow 9:00-11:00 AM",
        location: "Jacksonville, FL",
        status: "Scheduled"
    },
    {
        id: "j-502",
        customer: "Mia Carter",
        serviceType: "Water heater install",
        tech: "S. Howard",
        startWindow: "Today 1:00-3:00 PM",
        location: "Tampa, FL",
        status: "In Progress"
    },
    {
        id: "j-503",
        customer: "Ava Stone",
        serviceType: "Panel upgrade",
        tech: "R. Patel",
        startWindow: "Today 8:00-10:00 AM",
        location: "Orlando, FL",
        status: "Completed"
    }
];
exports.serviceTypes = ["All", "Plumbing", "HVAC", "Electrical", "Roofing"];
exports.statusFilters = ["All", "NEW", "CONTACTED", "QUALIFIED", "SCHEDULED", "WON", "LOST"];
exports.urgencyFilters = ["All", "LOW", "MEDIUM", "HIGH"];
function findLeadById(id) {
    return exports.mockLeads.find((lead) => lead.id === id);
}
