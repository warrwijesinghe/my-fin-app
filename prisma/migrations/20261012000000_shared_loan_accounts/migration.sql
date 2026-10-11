-- One loan can be viewed and paid by both logins. Account.owner identifies
-- the liable person, so only that person's position and targets include it.
ALTER TABLE Account ADD COLUMN isSharedLoan BOOLEAN NOT NULL DEFAULT false;
