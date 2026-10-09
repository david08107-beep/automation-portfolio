(function(root){const messages={
  "personal": [
    {
      "sender": "Alex Rivera",
      "subject": "Family lunch — can you confirm Saturday?",
      "to": "alex.rivera@family.example",
      "body": "Hi Dave,\n\nLet’s meet Saturday at noon. Can you confirm by tonight and bring something for the table? Jamie will join us. Let me know what would be easiest for you.\n\nAlex",
      "summary": "Alex needs your lunch confirmation and an offer to bring something.",
      "recommendation": "Review the prepared reply, edit it, and explicitly send when ready.",
      "received": "8:42 AM",
      "priority": "High",
      "draft": "Hi Alex,\n\nSaturday at noon works for me. I can bring groceries and a salad. Looking forward to catching up!\n\nBest,\nDave",
      "id": "personal-message-0",
      "workspaceId": "personal",
      "index": 0
    },
    {
      "sender": "Harbor Care Desk",
      "subject": "Appointment reminder for Friday",
      "to": "care@harbor.example",
      "body": "Hi Dave,\n\nThis is a fictional reminder for your Friday, October 9 appointment at 10:00 AM Eastern. Please arrive 10 minutes early. The appointment lasts one hour. No real appointment or health account is connected.\n\nHarbor Care Desk",
      "summary": "Friday’s appointment starts at 10:00 AM; arrive 10 minutes early.",
      "recommendation": "Create a local reminder or add the appointment to the demo calendar.",
      "received": "8:15 AM",
      "priority": "High",
      "draft": "Hi Harbor,\n\nThanks for the update. I’ll review the plan and follow up with you.\n\nBest,\nDave",
      "id": "personal-message-1",
      "workspaceId": "personal",
      "index": 1
    },
    {
      "sender": "Harbor Utilities",
      "subject": "Monthly bill reminder",
      "to": "billing@utilities.example",
      "body": "Hi Dave,\n\nYour fictional household utility bill of $86.40 is due Friday, October 9. Please review your household plan. Marking this message handled does not pay a bill. No payment service is connected.\n\nHarbor Utilities",
      "summary": "A fictional $86.40 bill needs review before Friday; no payment is connected.",
      "recommendation": "Create a reminder, snooze, or mark handled after reviewing; this does not pay it.",
      "received": "Yesterday",
      "priority": "Normal",
      "draft": "Hi Harbor,\n\nThanks for the update. I’ll review the plan and follow up with you.\n\nBest,\nDave",
      "id": "personal-message-2",
      "workspaceId": "personal",
      "index": 2
    },
    {
      "sender": "Jamie Chen",
      "subject": "Weekend errands and grocery list",
      "to": "jamie.chen@family.example",
      "body": "Hi Dave,\n\nI added pantry items to our weekend grocery plan. Could you confirm which errands you can cover? We can group grocery pickup and the library return after Saturday’s lunch.\n\nJamie",
      "summary": "Jamie is coordinating pantry items and weekend errands.",
      "recommendation": "Reply to coordinate errands and optionally add the lunch to the demo calendar.",
      "received": "Yesterday",
      "priority": "Normal",
      "draft": "Hi Jamie,\n\nThanks for the update. I’ll review the plan and follow up with you.\n\nBest,\nDave",
      "id": "personal-message-3",
      "workspaceId": "personal",
      "index": 3
    }
  ],
  "work": [
    {
      "sender": "Sarah Mitchell",
      "subject": "Q4 partnership — ready for your sign-off",
      "to": "sarah.mitchell@northstar.example",
      "body": "Hi Dave,\n\nThe updated Northstar partnership proposal is ready for your review. Can you confirm the revised terms before Friday? If they work for you, we can discuss a kickoff next Tuesday at 10:00 AM Eastern.\n\nSarah",
      "summary": "Sarah needs confirmation of the partnership terms before Friday.",
      "recommendation": "Review Orbit’s draft and confirm the response before Friday.",
      "received": "8:42 AM",
      "priority": "High",
      "draft": "Hi Sarah,\n\nThanks for sharing the revised proposal. The updated terms look good to me. Let’s plan a kickoff for next Tuesday at 10:00 AM Eastern, subject to your availability.\n\nBest,\nDave",
      "id": "work-message-0",
      "workspaceId": "work",
      "index": 0
    },
    {
      "sender": "Daniel Kim",
      "subject": "Board meeting: final agenda & materials",
      "to": "daniel.kim@board.example",
      "body": "Hi Dave,\n\nThe final agenda and revised board deck are ready for tomorrow’s meeting. Please review the budget section and bring any open questions. These materials are fictional.\n\nDaniel",
      "summary": "Daniel’s board materials need review before tomorrow’s meeting.",
      "recommendation": "Create a review task or follow-up; reply if you have questions.",
      "received": "8:15 AM",
      "priority": "High",
      "draft": "Hi Daniel,\n\nThanks for the update. I’ll review the details and follow up with the next steps.\n\nBest,\nDave",
      "id": "work-message-1",
      "workspaceId": "work",
      "index": 1
    },
    {
      "sender": "Aisha Patel",
      "subject": "Design sprint recap + next steps",
      "to": "aisha.patel@project.example",
      "body": "Hi Dave,\n\nThe design sprint recap identifies three decisions: onboarding scope, prototype ownership, and the review deadline. Please create a follow-up for next week’s sprint planning.\n\nAisha",
      "summary": "Aisha needs three sprint decisions and a follow-up.",
      "recommendation": "Create a sprint task or follow-up and reply with your decisions.",
      "received": "Yesterday",
      "priority": "Normal",
      "draft": "Hi Aisha,\n\nThanks for the update. I’ll review the details and follow up with the next steps.\n\nBest,\nDave",
      "id": "work-message-2",
      "workspaceId": "work",
      "index": 2
    },
    {
      "sender": "Thomas Wright",
      "subject": "October offsite — venue shortlist",
      "to": "thomas.wright@team.example",
      "body": "Hi Dave,\n\nI shortlisted two fictional offsite venues. Please compare team capacity, travel time, and budget, then let me know which option we should explore.\n\nThomas",
      "summary": "Thomas needs a venue preference after reviewing constraints.",
      "recommendation": "Create a comparison task or reply with your preference.",
      "received": "Yesterday",
      "priority": "Normal",
      "draft": "Hi Thomas,\n\nThanks for the update. I’ll review the details and follow up with the next steps.\n\nBest,\nDave",
      "id": "work-message-3",
      "workspaceId": "work",
      "index": 3
    }
  ]
};if(typeof module!=="undefined" && module.exports)module.exports=messages;else root.OrbitReplyFixtures=messages;})(globalThis);
