-- dbo.R_ICI1  (113203 rows)
CREATE TABLE dbo.R_ICI1 (
  PRODCT               char(20) NOT NULL,
  PRODCTDES            varchar(35),
  PROTYP               char(2),
  SKU                  varchar(4),
  SECLOC               varchar(8),
  PRIMARY KEY (PRODCT)
);