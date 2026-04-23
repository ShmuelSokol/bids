-- dbo.customer_profiles_profile  (13 rows)
CREATE TABLE dbo.customer_profiles_profile (
  profile              varchar(50) NOT NULL,
  name                 varchar(50),
  description          varchar(1000),
  PRIMARY KEY (profile)
);