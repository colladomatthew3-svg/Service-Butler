----------------------------- MODULE TenantIsolation -----------------------------
EXTENDS FiniteSets, Sequences, TLC

CONSTANTS Tenants, Users

VARIABLES canRead, ownerOf

Init ==
  /\ canRead \in [Users -> SUBSET Tenants]
  /\ ownerOf \in [Tenants -> Users]

Read(u, t) ==
  /\ u \in Users
  /\ t \in Tenants
  /\ t \in canRead[u]
  /\ UNCHANGED <<canRead, ownerOf>>

GrantParentVisibility(u, t) ==
  /\ u \in Users
  /\ t \in Tenants
  /\ canRead' = [canRead EXCEPT ![u] = @ \cup {t}]
  /\ UNCHANGED ownerOf

Next ==
  \E u \in Users, t \in Tenants : Read(u, t)
  \/ \E u \in Users, t \in Tenants : GrantParentVisibility(u, t)

OwnersAreUsers ==
  \A t \in Tenants : ownerOf[t] \in Users

ReadSetsWithinTenantUniverse ==
  \A u \in Users : canRead[u] \subseteq Tenants

Invariant == OwnersAreUsers /\ ReadSetsWithinTenantUniverse

Spec == Init /\ [][Next]_<<canRead, ownerOf>>

THEOREM Spec => []Invariant
=======================================================================================
