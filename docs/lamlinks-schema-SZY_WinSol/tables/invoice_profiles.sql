-- dbo.invoice_profiles  (104084 rows)
CREATE TABLE dbo.invoice_profiles (
  invoice              char(7) NOT NULL,
  customer             varchar(7) NOT NULL,
  profile              varchar(50) NOT NULL,
  notes                varchar(1000),
  category             varchar(50) NOT NULL,
  type                 varchar(50) NOT NULL,
  PRIMARY KEY (invoice)
);