-- dbo.customer_profiles_type  (24 rows)
CREATE TABLE dbo.customer_profiles_type (
  type                 varchar(50) NOT NULL,
  name                 varchar(50),
  description          varchar(1000),
  PRIMARY KEY (type)
);