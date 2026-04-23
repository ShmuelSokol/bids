-- dbo.customer_profiles_category  (10 rows)
CREATE TABLE dbo.customer_profiles_category (
  category             varchar(50) NOT NULL,
  name                 varchar(50),
  description          varchar(1000),
  PRIMARY KEY (category)
);