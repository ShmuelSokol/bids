-- dbo.R_INID_L  (6000279 rows)
CREATE TABLE dbo.R_INID_L (
  INVOICE              char(7) NOT NULL,
  LINEK                char(3) NOT NULL,
  RECTYP               char(1),
  PRIMARY KEY (INVOICE, LINEK)
);