-- dbo.R_POPI  (145508 rows)
CREATE TABLE dbo.R_POPI (
  PRODCT               char(20) NOT NULL,
  SUPPLR               char(6) NOT NULL,
  PER                  varchar(4),
  SUPPRO               varchar(30),
  BUYUNT               numeric(5,0),
  SELUNT               numeric(5,0),
  PURPRI               numeric(12,4),
  SUPPRO2              varchar(30),
  PRIMARY KEY (PRODCT, SUPPLR)
);