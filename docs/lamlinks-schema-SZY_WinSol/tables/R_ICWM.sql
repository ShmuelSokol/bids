-- dbo.R_ICWM  (116334 rows)
CREATE TABLE dbo.R_ICWM (
  WHSE                 char(2) NOT NULL,
  PRODCT               char(20) NOT NULL,
  PRILOC               varchar(8),
  ONHQTY               numeric(8,0),
  WGHTCST              numeric(10,4),
  LATCST               numeric(10,4),
  ORDQTY               numeric(8,0),
  RESQTY               numeric(8,0),
  BOQTY                numeric(8,0),
  PRIMARY KEY (PRODCT, WHSE)
);