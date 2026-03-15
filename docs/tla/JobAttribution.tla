----------------------------- MODULE JobAttribution -----------------------------
EXTENDS FiniteSets, Sequences, TLC

CONSTANTS Jobs, Opportunities, NullOpportunity

VARIABLES primaryOpportunity

Init ==
  primaryOpportunity \in [Jobs -> Opportunities \cup {NullOpportunity}]

SetPrimary(job, opp) ==
  /\ job \in Jobs
  /\ opp \in Opportunities
  /\ primaryOpportunity[job] = NullOpportunity
  /\ primaryOpportunity' = [primaryOpportunity EXCEPT ![job] = opp]

LockAttribution(job) ==
  /\ job \in Jobs
  /\ primaryOpportunity[job] # NullOpportunity
  /\ UNCHANGED primaryOpportunity

Next ==
  \E j \in Jobs, o \in Opportunities : SetPrimary(j, o)
  \/ \E j \in Jobs : LockAttribution(j)

AtMostOnePrimary ==
  \A j \in Jobs : primaryOpportunity[j] \in Opportunities \cup {NullOpportunity}

Invariant == AtMostOnePrimary

Spec == Init /\ [][Next]_<<primaryOpportunity>>

THEOREM Spec => []Invariant
=======================================================================================
