----------------------------- MODULE OutreachSequencing -----------------------------
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS Leads

VARIABLES optedOut, sends, replies

Init ==
  /\ optedOut \in [Leads -> BOOLEAN]
  /\ sends \in [Leads -> Nat]
  /\ replies \in [Leads -> BOOLEAN]

Send(lead) ==
  /\ lead \in Leads
  /\ ~optedOut[lead]
  /\ ~replies[lead]
  /\ sends' = [sends EXCEPT ![lead] = @ + 1]
  /\ UNCHANGED <<optedOut, replies>>

ReceiveReply(lead) ==
  /\ lead \in Leads
  /\ replies' = [replies EXCEPT ![lead] = TRUE]
  /\ UNCHANGED <<optedOut, sends>>

OptOut(lead) ==
  /\ lead \in Leads
  /\ optedOut' = [optedOut EXCEPT ![lead] = TRUE]
  /\ UNCHANGED <<sends, replies>>

Next ==
  \E l \in Leads : Send(l)
  \/ \E l \in Leads : ReceiveReply(l)
  \/ \E l \in Leads : OptOut(l)

SendCountIsNatural ==
  \A l \in Leads : sends[l] \in Nat

ReplyAndOptOutAreBoolean ==
  \A l \in Leads : replies[l] \in BOOLEAN /\ optedOut[l] \in BOOLEAN

Invariant == SendCountIsNatural /\ ReplyAndOptOutAreBoolean

Spec == Init /\ [][Next]_<<optedOut, sends, replies>>

THEOREM Spec => []Invariant
=======================================================================================
