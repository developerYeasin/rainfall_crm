-- Individual ads (creative level) so clients see which ad performs and what it costs.
ALTER TABLE ad_insights MODIFY level ENUM('account','campaign','adset','ad') NOT NULL;
