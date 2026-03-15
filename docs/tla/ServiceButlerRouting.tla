----------------------------- MODULE ServiceButlerRouting -----------------------------
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
  Opportunities,
  Territories,
  Franchisees,
  Unassigned,
  MaxAssignments,
  NullTerritory

ASSUME Unassigned \notin Franchisees

VARIABLES
  oppStatus,
  oppTerritory,
  oppAssignedTo,
  oppRoutingStatus,
  oppScore,
  territoryOwner,
  assignmentCount

Init ==
  /\ oppStatus \in [Opportunities -> {"new"}]
  /\ oppTerritory \in [Opportunities -> Territories \cup {NullTerritory}]
  /\ oppAssignedTo \in [Opportunities -> {Unassigned}]
  /\ oppRoutingStatus \in [Opportunities -> {"pending"}]
  /\ oppScore \in [Opportunities -> Nat]
  /\ territoryOwner \in [Territories -> Franchisees]
  /\ assignmentCount \in [Franchisees -> Nat]

OpportunityDetected(o, t, s) ==
  /\ o \in Opportunities
  /\ t \in Territories
  /\ s \in Nat
  /\ oppStatus[o] = "new"
  /\ oppTerritory' = [oppTerritory EXCEPT ![o] = t]
  /\ oppScore' = [oppScore EXCEPT ![o] = s]
  /\ UNCHANGED <<oppStatus, oppAssignedTo, oppRoutingStatus, territoryOwner, assignmentCount>>

RouteOpportunity(o) ==
  /\ o \in Opportunities
  /\ oppStatus[o] = "new"
  /\ oppTerritory[o] # NullTerritory
  /\ LET owner == territoryOwner[oppTerritory[o]] IN
      /\ oppAssignedTo' = [oppAssignedTo EXCEPT ![o] = owner]
      /\ oppRoutingStatus' = [oppRoutingStatus EXCEPT ![o] = "routed"]
      /\ oppStatus' = [oppStatus EXCEPT ![o] = "assigned"]
      /\ assignmentCount' = [assignmentCount EXCEPT ![owner] = @ + 1]
  /\ UNCHANGED <<oppTerritory, oppScore, territoryOwner>>

EscalateUnassigned(o, newOwner) ==
  /\ o \in Opportunities
  /\ newOwner \in Franchisees
  /\ oppStatus[o] \in {"assigned", "pending_acceptance"}
  /\ oppAssignedTo[o] # newOwner
  /\ oppAssignedTo' = [oppAssignedTo EXCEPT ![o] = newOwner]
  /\ oppRoutingStatus' = [oppRoutingStatus EXCEPT ![o] = "escalated"]
  /\ assignmentCount' = [assignmentCount EXCEPT ![newOwner] = @ + 1]
  /\ UNCHANGED <<oppStatus, oppTerritory, oppScore, territoryOwner>>

BookJob(o) ==
  /\ o \in Opportunities
  /\ oppStatus[o] \in {"assigned", "contacted", "qualified"}
  /\ oppStatus' = [oppStatus EXCEPT ![o] = "booked_job"]
  /\ oppRoutingStatus' = [oppRoutingStatus EXCEPT ![o] = "complete"]
  /\ UNCHANGED <<oppTerritory, oppAssignedTo, oppScore, territoryOwner, assignmentCount>>

CloseLost(o) ==
  /\ o \in Opportunities
  /\ oppStatus[o] \in {"new", "assigned", "contacted", "qualified"}
  /\ oppStatus' = [oppStatus EXCEPT ![o] = "closed_lost"]
  /\ oppRoutingStatus' = [oppRoutingStatus EXCEPT ![o] = "complete"]
  /\ UNCHANGED <<oppTerritory, oppAssignedTo, oppScore, territoryOwner, assignmentCount>>

Next ==
  \E o \in Opportunities, t \in Territories, s \in Nat : OpportunityDetected(o, t, s)
  \/ \E o \in Opportunities : RouteOpportunity(o)
  \/ \E o \in Opportunities, f \in Franchisees : EscalateUnassigned(o, f)
  \/ \E o \in Opportunities : BookJob(o)
  \/ \E o \in Opportunities : CloseLost(o)

AssignedOnlyIfTerritoryKnown ==
  \A o \in Opportunities : oppAssignedTo[o] # Unassigned => oppTerritory[o] # NullTerritory

BookedOnlyIfAssigned ==
  \A o \in Opportunities : oppStatus[o] = "booked_job" => oppAssignedTo[o] # Unassigned

NoDoubleRoutingWithoutAssignment ==
  \A o \in Opportunities : oppRoutingStatus[o] = "routed" => oppAssignedTo[o] \in Franchisees

ValidAssignmentCounts ==
  \A f \in Franchisees : assignmentCount[f] <= MaxAssignments

TerminalStatesAreComplete ==
  \A o \in Opportunities :
    oppStatus[o] \in {"booked_job", "closed_lost"} => oppRoutingStatus[o] = "complete"

Invariant ==
  AssignedOnlyIfTerritoryKnown
  /\ BookedOnlyIfAssigned
  /\ NoDoubleRoutingWithoutAssignment
  /\ ValidAssignmentCounts
  /\ TerminalStatesAreComplete

Spec == Init /\ [][Next]_<<oppStatus, oppTerritory, oppAssignedTo, oppRoutingStatus, oppScore, territoryOwner, assignmentCount>>

THEOREM Spec => []Invariant
=======================================================================================
