-- dbo.customer_profiles  (261 rows)
CREATE TABLE dbo.customer_profiles (
  customer             varchar(7) NOT NULL,
  profile              varchar(50) NOT NULL,
  notes                varchar(1000),
  category             varchar(50) NOT NULL,
  type                 varchar(50) NOT NULL,
  PRIMARY KEY (customer)
);