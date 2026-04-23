-- dbo.dtproperties  (0 rows)
CREATE TABLE dbo.dtproperties (
  id                   int NOT NULL,
  objectid             int,
  property             varchar(64) NOT NULL,
  value                varchar(255),
  uvalue               nvarchar(255),
  lvalue               image(2147483647),
  version              int NOT NULL DEFAULT (0),
  PRIMARY KEY (id, property)
);