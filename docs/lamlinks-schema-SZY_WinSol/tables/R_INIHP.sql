-- dbo.R_INIHP  (1863362 rows)
CREATE TABLE dbo.R_INIHP (
  CUSTMR               char(7) NOT NULL,
  INVOICE              char(7) NOT NULL,
  TRANSCTN             char(2) NOT NULL,
  PAYDAT               datetime,
  PAYAMT               numeric(10,2),
  DISTAK               numeric(10,2),
  CHEQUE               varchar(8),
  DIFCUS               varchar(30),
  ADJFLA               char(3),
  CHEAMT               numeric(9,2),
  INVCAMT              numeric(10,2),
  INVCDAT              datetime,
  CHECUSTMR            varchar(7),
  GLACCT               varchar(8),
  PRIMARY KEY (CUSTMR, INVOICE, TRANSCTN)
);