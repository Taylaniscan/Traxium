-- Remove the dead legacy Approval model. The active workflow is the
-- PhaseChangeRequest / PhaseChangeRequestApproval flow, which is unchanged.
DROP TABLE IF EXISTS "Approval";
