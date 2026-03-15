----------------------------- MODULE SLAEscalation -----------------------------
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS Assignments

VARIABLES status, timerExpired

Init ==
  /\ status \in [Assignments -> {"pending", "accepted", "escalated", "complete"}]
  /\ timerExpired \in [Assignments -> BOOLEAN]

Accept(a) ==
  /\ a \in Assignments
  /\ status[a] = "pending"
  /\ status' = [status EXCEPT ![a] = "accepted"]
  /\ UNCHANGED timerExpired

ExpireTimer(a) ==
  /\ a \in Assignments
  /\ timerExpired' = [timerExpired EXCEPT ![a] = TRUE]
  /\ UNCHANGED status

Escalate(a) ==
  /\ a \in Assignments
  /\ status[a] = "pending"
  /\ timerExpired[a] = TRUE
  /\ status' = [status EXCEPT ![a] = "escalated"]
  /\ UNCHANGED timerExpired

Complete(a) ==
  /\ a \in Assignments
  /\ status[a] \in {"accepted", "escalated"}
  /\ status' = [status EXCEPT ![a] = "complete"]
  /\ UNCHANGED timerExpired

Next ==
  \E a \in Assignments : Accept(a)
  \/ \E a \in Assignments : ExpireTimer(a)
  \/ \E a \in Assignments : Escalate(a)
  \/ \E a \in Assignments : Complete(a)

EscalatedImpliesExpired ==
  \A a \in Assignments : status[a] = "escalated" => timerExpired[a] = TRUE

CompleteNotPending ==
  \A a \in Assignments : status[a] = "complete" => status[a] # "pending"

Invariant == EscalatedImpliesExpired /\ CompleteNotPending

Spec == Init /\ [][Next]_<<status, timerExpired>>

THEOREM Spec => []Invariant
=======================================================================================
