-- dbo.R_INID_3  (118583 rows)
CREATE TABLE dbo.R_INID_3 (
  INVOICE              char(7) NOT NULL,
  LINEK                char(3) NOT NULL,
  SUPCHADES            varchar(25),
  AMT                  numeric(8,2),
  PRIMARY KEY (INVOICE, LINEK)
);