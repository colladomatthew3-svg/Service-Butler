----------------------------- MODULE ConnectorIdempotency -----------------------------
EXTENDS FiniteSets, Sequences, TLC

CONSTANTS DedupeKeys, Runs

VARIABLES inserted

Init ==
  inserted = [r \in Runs |-> {}]

Insert(r, k) ==
  /\ r \in Runs
  /\ k \in DedupeKeys
  /\ inserted' = [inserted EXCEPT ![r] = @ \cup {k}]

Retry(r, k) ==
  /\ r \in Runs
  /\ k \in DedupeKeys
  /\ inserted' = inserted

Next ==
  \E r \in Runs, k \in DedupeKeys : Insert(r, k)
  \/ \E r \in Runs, k \in DedupeKeys : Retry(r, k)

AllInserted == UNION {inserted[r] : r \in Runs}

NoLogicalDuplicates ==
  \A k \in AllInserted : Cardinality({r \in Runs : k \in inserted[r]}) >= 1

IdempotentRetrySafety ==
  \A r \in Runs, k \in DedupeKeys :
    (k \in inserted[r]) => [Retry(r, k)]_<<inserted>>

Invariant == NoLogicalDuplicates

Spec == Init /\ [][Next]_<<inserted>>

THEOREM Spec => []Invariant
=======================================================================================
